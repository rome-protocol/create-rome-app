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
