#!/usr/bin/env node
// Scaffold a dual-lane Rome app: copy template/ → <app-name>/, set the package
// name, seed .env from .env.example, print next steps.
import { cpSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const templateDir = join(here, "..", "template");

const name = process.argv[2];
if (!name) {
  console.error("usage: npx github:rome-protocol/create-rome-app <app-name>");
  process.exit(1);
}
const target = resolve(process.cwd(), name);
if (existsSync(target)) {
  console.error(`✖ ${target} already exists`);
  process.exit(1);
}

// Never copy install artifacts, local env, or generated config. Test the path
// RELATIVE to template/ — the absolute install path legitimately contains
// node_modules when run via npx (.npm/_npx/<hash>/node_modules/create-rome-app),
// and matching on it would skip the entire template.
const skip = new RegExp(`(^|[\\\\/])(node_modules|dist|\\.env|config\\.generated\\.json)($|[\\\\/])`);
cpSync(templateDir, target, { recursive: true, filter: (src) => !skip.test(relative(templateDir, src)) });

// npm pack strips dotted .gitignore from git installs, so the template ships a
// dotless `gitignore`; make it real here. Without it, a scaffolded app has no
// ignore file and its .env (which holds private keys) is one `git init` from leaking.
const dotless = join(target, "gitignore");
if (existsSync(dotless)) renameSync(dotless, join(target, ".gitignore"));

const pkgPath = join(target, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = name.split(sep).pop().replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "rome-dual-lane-app";
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const example = join(target, ".env.example");
if (existsSync(example) && !existsSync(join(target, ".env"))) cpSync(example, join(target, ".env"));

console.log(`
✔ Created ${name}

Next:
  cd ${name}
  npm install
  # fill in .env: EVM_KEY (USDC gas on Rome) + SOLANA_KEY (SOL + USDC), then fund both wallets
  npm run demo      # headless — a MetaMask lane AND a Phantom lane hit ONE Vault
  npm run deploy    # deploy a Vault → set VAULT_ADDRESS in .env
  npm run dev       # the web app — connect both wallets

Docs: https://docs.rome.builders
`);
