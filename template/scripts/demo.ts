// Headless proof that BOTH lanes drive the SAME Vault. Fund the two wallets in
// .env (EVM: USDC gas on Rome; Solana: SOL + USDC), then `npm run demo`.
// This is exactly what the web app (src/App.tsx) does, minus the wallet UI.
import "dotenv/config";
import { formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Keypair } from "@solana/web3.js";
import { loadConfig } from "../lib/config.js";
import { eip1193FromAccount } from "../lib/eip1193Node.js";
import { deployVault } from "./deploy.js";
import * as rome from "../lib/rome.js";

const cfg = loadConfig({ proxyUrl: process.env.PROXY_URL, solanaRpc: process.env.SOLANA_RPC });
const evm = privateKeyToAccount(process.env.EVM_KEY as `0x${string}`);
const sol = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.SOLANA_KEY!)));
const solSign = async (tx: any) => { tx.partialSign(sol); return tx; };
const provider = eip1193FromAccount(evm, cfg.proxyUrl, cfg.chainId);
const synth = rome.syntheticFor(sol.publicKey);
const w = (x: bigint) => `${formatUnits(x, 6)} wUSDC`;

const AMT = 100_000n; // 0.1 wUSDC deposited by each lane

console.log("chain", cfg.chainId, "| wUSDC", cfg.wusdc);
console.log("EVM (MetaMask)", evm.address, "\nSolana (Phantom)", sol.publicKey.toBase58(), "→ synthetic", synth);

const vault = await deployVault(cfg, evm);
console.log("Vault:", vault);

// ---- EVM lane: wrap gas → wUSDC, then approve → deposit → withdraw ----
console.log("\n== EVM lane (submitRomeTx) ==");
await rome.evmWrapToWusdc(provider, evm.address, 150_000_000_000_000_000n); // 0.15 native USDC → wUSDC
await rome.evmApprove(provider, evm.address, cfg, vault, AMT);
await rome.evmDeposit(provider, evm.address, vault, AMT);
const evmDeposited = await rome.vaultBalanceOf(cfg, vault, evm.address);
console.log("EVM deposited →", w(evmDeposited));
if (evmDeposited !== AMT) throw new Error("EVM deposit didn't hit the vault");
await rome.evmWithdraw(provider, evm.address, vault, AMT);

// ---- Solana lane: fund → approve (auto-provision) → deposit → withdraw → sweep ----
console.log("\n== Solana lane (submitRomeTxSolanaLane) ==");
await rome.solanaFund(cfg, sol.publicKey, solSign, 500_000n);      // 0.5 USDC → synthetic
await rome.solanaApprove(cfg, sol.publicKey, solSign, vault, AMT); // first lane call → auto-provision (create_pda)
await rome.solanaDeposit(cfg, sol.publicKey, solSign, vault, AMT);
const synthDeposited = await rome.vaultBalanceOf(cfg, vault, synth);
console.log("Solana deposited →", w(synthDeposited));
if (synthDeposited !== AMT) throw new Error("Solana deposit didn't hit the vault");
await rome.solanaWithdraw(cfg, sol.publicKey, solSign, vault, AMT);
await rome.solanaSweep(cfg, sol.publicKey, solSign, 500_000n);     // sweep everything back to the wallet

// ---- both lanes used the SAME vault ----
console.log("\n== both lanes, one Vault ==");
const evmBal = await rome.vaultBalanceOf(cfg, vault, evm.address);
const synthBal = await rome.vaultBalanceOf(cfg, vault, synth);
console.log("vault.balanceOf(EVM)   =", w(evmBal), "(deposited then withdrew)");
console.log("vault.balanceOf(synth) =", w(synthBal), "(deposited then withdrew)");
if (evmBal === 0n && synthBal === 0n) {
  console.log("\n✅ A MetaMask wallet AND a Phantom wallet each deposited into + withdrew from the SAME Vault. Dual-lane works.");
} else {
  throw new Error("unexpected residual vault balance");
}
