// Project the registry config to a static JSON the browser bundle can import
// (@rome-protocol/registry reads the filesystem, so it can't run in the browser).
// Runs before `dev` / `build`. Reads .env overrides + the deployed VAULT_ADDRESS.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { loadConfig } from "../lib/config.js";

const cfg = loadConfig({ proxyUrl: process.env.PROXY_URL, solanaRpc: process.env.SOLANA_RPC });
const out = { ...cfg, vault: (process.env.VAULT_ADDRESS || null) as string | null };
writeFileSync(new URL("../src/config.generated.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log("wrote src/config.generated.json —", `chain ${out.chainId}`, out.vault ? `vault ${out.vault}` : "(deploy a Vault, then set VAULT_ADDRESS)");
