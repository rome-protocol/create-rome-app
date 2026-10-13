import { useCallback, useEffect, useState } from "react";
import { formatUnits, parseUnits, type Hex } from "viem";
import { PublicKey, type Transaction } from "@solana/web3.js";
import type { RomeConfig } from "../lib/config";
import * as rome from "../lib/rome";
import { phantomLaneSigner } from "../lib/phantomV1";
import configJson from "./config.generated.json";

// Static config projected from the registry at build time (see scripts/gen-config.ts).
const cfg = configJson as unknown as RomeConfig;
const VAULT = (configJson as { vault: string | null }).vault as Hex | null;

const box: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 12, padding: 20, flex: 1, minWidth: 260 };
const btn: React.CSSProperties = { padding: "8px 14px", marginRight: 8, borderRadius: 8, border: "1px solid #888", cursor: "pointer" };

export default function App() {
  const [evmAddr, setEvmAddr] = useState<Hex>();
  const [solPk, setSolPk] = useState<PublicKey>();
  const [evmBal, setEvmBal] = useState("0");
  const [synthBal, setSynthBal] = useState("0");
  const [amount, setAmount] = useState("0.1");
  const [busy, setBusy] = useState("");

  const eth = () => (window as any).ethereum;
  const phantom = () => (window as any).solana;
  const synth = solPk ? rome.syntheticFor(solPk) : undefined;
  const amt = () => parseUnits(amount || "0", 6);

  const refresh = useCallback(async () => {
    if (!VAULT) return;
    if (evmAddr) setEvmBal(formatUnits(await rome.vaultBalanceOf(cfg, VAULT, evmAddr), 6));
    if (synth) setSynthBal(formatUnits(await rome.vaultBalanceOf(cfg, VAULT, synth), 6));
  }, [evmAddr, synth]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try { await fn(); await refresh(); } catch (e: any) { alert(e?.message ?? String(e)); } finally { setBusy(""); }
  }

  // EVM lane (MetaMask → submitRomeTx). Wrap gas → wUSDC, grant the wrapper (first time), then approve + deposit.
  const connectEvm = () => run("connecting MetaMask", async () => { const [a] = await eth().request({ method: "eth_requestAccounts" }); setEvmAddr(a); });
  const evmDeposit = () => run("EVM deposit", async () => {
    await rome.evmWrapToWusdc(eth(), evmAddr!, parseUnits(amount, 18));
    await rome.evmGrant(eth(), evmAddr!, cfg);
    await rome.evmApprove(eth(), evmAddr!, cfg, VAULT!, amt());
    await rome.evmDeposit(eth(), evmAddr!, VAULT!, amt());
  });
  const evmWithdraw = () => run("EVM withdraw", () => rome.evmWithdraw(eth(), evmAddr!, VAULT!, amt()));

  // Solana lane (Phantom → submitRomeTxV1). Fund → provision (first time) → grant the wrapper (first time) → approve → deposit; withdraw → sweep.
  // `signTransaction` signs the two plain Solana transactions; `signer` signs each v1 call (two prompts).
  const solWallet = (pk: PublicKey): rome.SolanaWallet => ({
    signTransaction: (tx: Transaction) => phantom().signTransaction(tx),
    signer: phantomLaneSigner(pk, phantom(), cfg.solanaCluster),
  });
  const connectPhantom = () => run("connecting Phantom", async () => { const r = await phantom().connect(); setSolPk(new PublicKey(r.publicKey.toString())); });
  const solDeposit = () => run("Solana deposit", async () => {
    const w = solWallet(solPk!);
    await rome.solanaFund(cfg, w, amt());
    await rome.solanaProvision(cfg, w);
    await rome.solanaGrant(cfg, w);
    await rome.solanaApprove(cfg, w, VAULT!, amt());
    await rome.solanaDeposit(cfg, w, VAULT!, amt());
  });
  const solWithdraw = () => run("Solana withdraw", async () => {
    const w = solWallet(solPk!);
    await rome.solanaWithdraw(cfg, w, VAULT!, amt());
    await rome.solanaSweep(cfg, w, amt());
  });

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "40px auto", padding: "0 16px", lineHeight: 1.5 }}>
      <h1>Rome dual-lane vault</h1>
      <p>One Vault. Two wallets. Same state — a MetaMask user and a Phantom user deposit the same wUSDC into the same contract on Rome chain {cfg.chainId}.</p>
      {!VAULT && <p style={{ color: "#b00" }}>⚠ No Vault yet — run <code>npm run deploy</code>, set <code>VAULT_ADDRESS</code> in <code>.env</code>, then restart.</p>}
      {VAULT && <p style={{ fontSize: 13, color: "#666" }}>Vault {VAULT}</p>}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
        <section style={box}>
          <h2>MetaMask · EVM lane</h2>
          {evmAddr ? (
            <>
              <p style={{ fontSize: 13, wordBreak: "break-all" }}>{evmAddr}</p>
              <p>in vault: <b>{evmBal}</b> wUSDC</p>
              <button style={btn} disabled={!!busy || !VAULT} onClick={evmDeposit}>Deposit</button>
              <button style={btn} disabled={!!busy || !VAULT} onClick={evmWithdraw}>Withdraw</button>
            </>
          ) : <button style={btn} onClick={connectEvm}>Connect MetaMask</button>}
        </section>

        <section style={box}>
          <h2>Phantom · Solana lane</h2>
          {solPk ? (
            <>
              <p style={{ fontSize: 13, wordBreak: "break-all" }}>{solPk.toBase58()}</p>
              <p style={{ fontSize: 12, color: "#666", wordBreak: "break-all" }}>synthetic {synth}</p>
              <p>in vault: <b>{synthBal}</b> wUSDC</p>
              <button style={btn} disabled={!!busy || !VAULT} onClick={solDeposit}>Deposit</button>
              <button style={btn} disabled={!!busy || !VAULT} onClick={solWithdraw}>Withdraw</button>
            </>
          ) : <button style={btn} onClick={connectPhantom}>Connect Phantom</button>}
          <p style={{ fontSize: 12, color: "#666" }}>Each call to the Rome contract asks Phantom twice: once to approve the readable authorization, once to sign the transaction.</p>
        </section>
      </div>

      <p style={{ marginTop: 20 }}>
        Amount: <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 80, padding: 6 }} /> wUSDC
        {busy && <span style={{ marginLeft: 12, color: "#06c" }}>{busy}…</span>}
      </p>
      <p style={{ fontSize: 13, color: "#666" }}>The Solana lane needs a little SOL for fees + USDC to deposit; the EVM lane needs USDC gas. There is no faucet — bridge USDC into Rome. See <a href="https://docs.rome.builders">docs.rome.builders</a>.</p>
    </main>
  );
}
