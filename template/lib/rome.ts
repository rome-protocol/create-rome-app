// The dual-lane core. Both lanes act on the SAME Vault + the SAME wUSDC wrapper.
// Every function is environment-agnostic — the demo/deploy scripts feed a Node
// signer, the web app feeds an injected wallet (window.ethereum / window.solana).
import {
  submitRomeTx,
  submitRomeTxV1,
  syntheticAddress,
  buildFundLeg,
  buildSweepLeg,
  buildCreatePdaCall,
  isSyntheticProvisioned,
  submitSolanaInstructions,
  toLaneSigner,
  type SignerLike,
} from "@rome-protocol/sdk";
import { createPublicClient, http, encodeFunctionData, erc20Abi, parseAbi, type Hex } from "viem";
import { Connection, PublicKey, type Transaction } from "@solana/web3.js";
import type { RomeConfig } from "./config.js";

export const VAULT_ABI = parseAbi([
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
  "function totalDeposits() view returns (uint256)",
]);

// Withdraw precompile (0x42..16): `withdraw_to_ata` wraps native gas (USDC) into
// the wUSDC wrapper — how a MetaMask user gets wUSDC to spend.
const WITHDRAW = "0x4200000000000000000000000000000000000016" as const;
const WITHDRAW_ABI = parseAbi(["function withdraw_to_ata(uint256 wei_)"]);

type Eip1193 = { request: (args: { method: string; params?: any[] }) => Promise<any> };
type SolSigner = (tx: Transaction) => Promise<Transaction>;
/**
 * What a Solana user hands the lane helpers. `signer` signs the v1 calls (a
 * wallet's LaneSigner, or a Keypair in scripts); `signTransaction` signs the
 * two ordinary Solana transactions (the fund and the sweep's token-account step).
 */
export type SolanaWallet = { signer: SignerLike; signTransaction: SolSigner };

// ------------------------------ reads (either lane) ------------------------------
export function publicClient(cfg: RomeConfig) {
  return createPublicClient({ transport: http(cfg.proxyUrl) });
}
export function vaultBalanceOf(cfg: RomeConfig, vault: Hex, who: Hex): Promise<bigint> {
  return publicClient(cfg).readContract({ address: vault, abi: VAULT_ABI, functionName: "balanceOf", args: [who] }) as Promise<bigint>;
}
export function wusdcBalanceOf(cfg: RomeConfig, who: Hex): Promise<bigint> {
  return publicClient(cfg).readContract({ address: cfg.wusdc, abi: erc20Abi, functionName: "balanceOf", args: [who] }) as Promise<bigint>;
}

// ------------------------------ EVM lane (MetaMask) ------------------------------
// A MetaMask user has native gas (USDC). `evmWrapToWusdc` turns some into the
// wUSDC wrapper (18-dec `weiAmount` in, 6-dec wUSDC out); then it's a normal
// ERC-20 approve → deposit → withdraw, each via `submitRomeTx`.
export function evmWrapToWusdc(provider: Eip1193, from: Hex, weiAmount: bigint) {
  return submitRomeTx(provider, { from, to: WITHDRAW, data: encodeFunctionData({ abi: WITHDRAW_ABI, functionName: "withdraw_to_ata", args: [weiAmount] }) });
}
export function evmApprove(provider: Eip1193, from: Hex, cfg: RomeConfig, vault: Hex, amount: bigint) {
  return submitRomeTx(provider, { from, to: cfg.wusdc, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [vault, amount] }) });
}
export function evmDeposit(provider: Eip1193, from: Hex, vault: Hex, amount: bigint) {
  return submitRomeTx(provider, { from, to: vault, data: encodeFunctionData({ abi: VAULT_ABI, functionName: "deposit", args: [amount] }) });
}
export function evmWithdraw(provider: Eip1193, from: Hex, vault: Hex, amount: bigint) {
  return submitRomeTx(provider, { from, to: vault, data: encodeFunctionData({ abi: VAULT_ABI, functionName: "withdraw", args: [amount] }) });
}

// ------------------------------ Solana lane (Phantom) ------------------------------
// A Phantom user drives the same Vault with no EVM key. Their EVM identity is the
// synthetic address; their spendable balance is the wallet ATA, surfaced as wUSDC.
// The synthetic holds nothing at rest — value flows through it (fund → act → sweep).
// Each call goes through `submitRomeTxV1`: the proxy composes ONE Solana v1
// transaction for it (no lookup table, no account list to build), and the wallet
// is asked twice per call — first to approve a readable authorization message,
// then to sign the transaction itself.
export function syntheticFor(payer: PublicKey): Hex {
  return syntheticAddress(payer);
}
function laneV1Deps(cfg: RomeConfig, signer: SignerLike) {
  return { connection: new Connection(cfg.solanaRpc, "confirmed"), proxyUrl: cfg.proxyUrl, chainId: cfg.chainId, programId: cfg.programId, signer };
}
const payerOf = (w: SolanaWallet) => toLaneSigner(w.signer).payer;
/** Fund leg: move `amount` (6-dec) of USDC from the wallet into the synthetic's token account. */
export function solanaFund(cfg: RomeConfig, wallet: SolanaWallet, amount: bigint) {
  const payer = payerOf(wallet);
  return submitSolanaInstructions(
    buildFundLeg({ programId: cfg.programId, chainId: cfg.chainId, mint: new PublicKey(cfg.usdcMint), amount, wallet: payer, synthetic: syntheticAddress(payer) }),
    { connection: new Connection(cfg.solanaRpc, "confirmed"), feePayer: payer, signTransaction: wallet.signTransaction },
  );
}
/** One-time setup for a fresh synthetic (`create_pda`). The v1 lane does not do it for you; call it before the first approve. Returns undefined when it was already done. */
export async function solanaProvision(cfg: RomeConfig, wallet: SolanaWallet) {
  const synthetic = syntheticAddress(payerOf(wallet));
  const deps = laneV1Deps(cfg, wallet.signer);
  if (await isSyntheticProvisioned(deps.connection, cfg.programId, synthetic)) return undefined;
  return submitRomeTxV1(deps, buildCreatePdaCall(synthetic));
}
export function solanaApprove(cfg: RomeConfig, wallet: SolanaWallet, vault: Hex, amount: bigint) {
  return submitRomeTxV1(laneV1Deps(cfg, wallet.signer), { to: cfg.wusdc, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [vault, amount] }) });
}
export function solanaDeposit(cfg: RomeConfig, wallet: SolanaWallet, vault: Hex, amount: bigint) {
  return submitRomeTxV1(laneV1Deps(cfg, wallet.signer), { to: vault, data: encodeFunctionData({ abi: VAULT_ABI, functionName: "deposit", args: [amount] }) });
}
export function solanaWithdraw(cfg: RomeConfig, wallet: SolanaWallet, vault: Hex, amount: bigint) {
  return submitRomeTxV1(laneV1Deps(cfg, wallet.signer), { to: vault, data: encodeFunctionData({ abi: VAULT_ABI, functionName: "withdraw", args: [amount] }) });
}
/** Sweep leg: push `amount` (6-dec) of wUSDC from the synthetic back to the wallet, so it holds nothing at rest. */
export async function solanaSweep(cfg: RomeConfig, wallet: SolanaWallet, amount: bigint) {
  const payer = payerOf(wallet);
  const connection = new Connection(cfg.solanaRpc, "confirmed");
  const sweep = buildSweepLeg({ programId: cfg.programId, mint: new PublicKey(cfg.usdcMint), amount, wallet: payer, synthetic: syntheticAddress(payer) });
  await submitSolanaInstructions([sweep.ensureWalletAtaIx], { connection, feePayer: payer, signTransaction: wallet.signTransaction });
  return submitRomeTxV1(laneV1Deps(cfg, wallet.signer), { to: sweep.helperTo, data: sweep.calldata });
}
