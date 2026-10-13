// The template's dev-experience contract, locked by test:
//
// 1. Env names match the rome CLI (ROME_EVM_KEY / ROME_SOLANA_KEY) — one set of
//    names across scaffold and CLI, so `rome verify` sees the same env the
//    scripts read.
// 2. Funding guidance states concrete minimums — "a little USDC" reads as 0.1
//    and the demo then dies mid-run with an on-chain error (the demo's fund leg
//    moves 0.5 USDC, and each run deploys a fresh Vault at real gas cost).
// 3. Scripts gate on the keys BEFORE any RPC call — an unfilled .env must fail
//    with instructions, not a viem stack trace.
// 4. `npm run verify` exists — the works-gate runs straight from the scaffold.
//
// Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const template = join(dirname(fileURLToPath(import.meta.url)), "..", "template");
const read = (...p) => readFileSync(join(template, ...p), "utf8");

test("env names match the rome CLI (ROME_EVM_KEY / ROME_SOLANA_KEY)", () => {
  const env = read(".env.example");
  assert.match(env, /^ROME_EVM_KEY=/m, ".env.example must use ROME_EVM_KEY");
  assert.match(env, /^ROME_SOLANA_KEY=/m, ".env.example must use ROME_SOLANA_KEY");
  assert.ok(!/^EVM_KEY=/m.test(env), "bare EVM_KEY must be gone (CLI reads ROME_EVM_KEY)");
  assert.ok(!/^SOLANA_KEY=/m.test(env), "bare SOLANA_KEY must be gone (CLI reads ROME_SOLANA_KEY)");
  for (const f of ["scripts/demo.ts", "scripts/deploy.ts"]) {
    const src = read(f);
    assert.ok(!/env\.EVM_KEY|env\.SOLANA_KEY/.test(src), `${f} must not read the old env names`);
  }
});

test("funding guidance states concrete minimums, not 'a little'", () => {
  const env = read(".env.example");
  const readme = read("README.md");
  // Each key's paragraph (comment + var) must state numeric minimums.
  const block = (name) => {
    const b = env.split(/\n\s*\n/).find((p) => p.includes(`${name}=`));
    assert.ok(b, `.env.example must have a ${name} block`);
    return b;
  };
  assert.match(block("ROME_EVM_KEY"), /\d+(\.\d+)?\s*USDC/, "EVM block must state a USDC gas minimum");
  assert.match(block("ROME_SOLANA_KEY"), /\d+(\.\d+)?\s*USDC/, "Solana block must state a USDC minimum");
  assert.match(block("ROME_SOLANA_KEY"), /\d+(\.\d+)?\s*SOL\b/, "Solana block must state a SOL minimum");
  assert.match(readme, /\d+(\.\d+)?\s*USDC/, "README must state funding amounts");
  assert.ok(!/a little\b/i.test(readme), "README must not hand-wave amounts as 'a little'");
});

test("scripts gate on keys before any RPC call (no raw stack trace on unfilled .env)", () => {
  const keys = read("lib", "keys.ts");
  assert.match(keys, /ROME_EVM_KEY/, "lib/keys.ts must validate ROME_EVM_KEY");
  assert.match(keys, /ROME_SOLANA_KEY/, "lib/keys.ts must validate ROME_SOLANA_KEY");
  for (const f of ["scripts/demo.ts", "scripts/deploy.ts"]) {
    const src = read(f);
    assert.match(src, /requireEvmKey/, `${f} must go through the key gate`);
    assert.ok(!/privateKeyToAccount\(process\.env/.test(src), `${f} must not feed raw env to viem`);
  }
  assert.match(read("scripts/demo.ts"), /requireSolanaKey/, "demo.ts must gate the Solana key too");
});

test("`npm run verify` runs the works-gate from the scaffold", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts.verify, "package.json must have a verify script");
  const verify = read("scripts", "verify.ts");
  assert.match(verify, /rome-protocol\/rome-cli/, "verify.ts must invoke the rome CLI (same gate, not a reimplementation)");
  assert.match(verify, /dotenv\/config/, "verify.ts must load .env so the CLI sees the keys");
});

test("the Solana lane is the v1 lane (submitRomeTxV1), with explicit provisioning", () => {
  const rome = read("lib", "rome.ts");
  assert.match(rome, /submitRomeTxV1/, "lib/rome.ts must send Solana-lane calls through submitRomeTxV1");
  assert.ok(!/submitRomeTxSolanaLane|extraAccounts/.test(rome), "lib/rome.ts must not use the legacy lane or pass extraAccounts");
  assert.match(rome, /export (async )?function solanaProvision/, "lib/rome.ts must expose the one-time provisioning step");
  assert.match(read("src", "App.tsx"), /solanaProvision/, "the app must provision a fresh synthetic before its first approve");
  assert.match(read("scripts", "demo.ts"), /submitRomeTxV1/, "demo.ts must name the v1 lane");
});

test("both lanes grant the wUSDC wrapper before the first approve", () => {
  const rome = read("lib", "rome.ts");
  assert.match(rome, /export async function wrapperGrantCall/, "lib/rome.ts must expose the wrapper-grant check");
  assert.match(rome, /0xff00000000000000000000000000000000000009/, "the grant goes straight to the Helper precompile");
  assert.match(rome, /approve_spl/, "the grant is approve_spl");
  assert.match(rome, /isEnabled/, "the grant is skipped when isEnabled is true");
  assert.match(rome, /export (async )?function evmGrant/, "lib/rome.ts must expose evmGrant");
  assert.match(rome, /export (async )?function solanaGrant/, "lib/rome.ts must expose solanaGrant");
  const before = (src, grant, approve, what) => {
    const g = src.indexOf(grant), a = src.indexOf(approve);
    assert.ok(g !== -1 && a !== -1 && g < a, `${what}: ${grant} must come before ${approve}`);
  };
  const app = read("src", "App.tsx");
  before(app, "rome.evmGrant", "rome.evmApprove", "App.tsx EVM deposit");
  before(app, "rome.solanaGrant", "rome.solanaApprove", "App.tsx Solana deposit");
  const demo = read("scripts", "demo.ts");
  before(demo, "rome.evmGrant", "rome.evmApprove", "demo.ts EVM lane");
  before(demo, "rome.solanaGrant", "rome.solanaApprove", "demo.ts Solana lane");
  assert.match(demo, /already enabled/, "demo.ts prints 'already enabled' when the grant is skipped");
});
