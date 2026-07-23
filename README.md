# create-rome-app

> **Rome Protocol runs EVM chains natively inside the Solana runtime** — Solidity apps call Solana programs atomically (CPI), and Solana users drive EVM apps: two VMs, one chain, one block.

Scaffold a **dual-lane Rome app** in seconds — one Solidity contract that both a **MetaMask (EVM)** wallet and a **Phantom (Solana)** wallet drive, on [`@rome-protocol/sdk`](https://github.com/rome-protocol/rome-sdk-ts).

```bash
npx github:rome-protocol/create-rome-app my-app
cd my-app
npm install
# fill in .env (EVM_KEY + SOLANA_KEY), fund both wallets — gas is USDC, bridge it in
npm run demo      # headless: a MetaMask lane AND a Phantom lane each hit ONE Vault
npm run deploy    # deploy your own Vault → set VAULT_ADDRESS in .env
npm run dev       # the web app — connect both wallets, deposit/withdraw
```

Prefer one command? **`rome new my-app --chain hadrian`** (the [`rome` CLI](https://github.com/rome-protocol/rome-cli)) wraps this scaffolder, pre-wires the chain into `.env`, and prints the fund → deploy → demo → verify lifecycle.

## What you get

A minimal app where both wallets deposit into + withdraw from the same `Vault`, sharing the same state:

- **`lib/rome.ts`** — both lanes in one file (`submitRomeTx` for EVM, `submitRomeTxSolanaLane` for Solana)
- **`contracts/Vault.sol`** — a plain ERC-20 vault over the wUSDC wrapper
- **`scripts/demo.ts`** — the funded proof that both lanes hit one Vault
- **`src/App.tsx`** — connect MetaMask + Phantom, deposit/withdraw
- registry-driven config — no hardcoded ids or addresses. Default chain: **Rome Hadrian**; pick another with `CHAIN_ID=<id>` in `.env` (`gen-config`, `deploy`, and `demo` all honor it)
- a `.gitignore` that keeps `.env` (your private keys) out of git from the first commit

Read the scaffolded app's `README.md` + `AGENTS.md`. For how EVM execution works inside Solana — and the four ways to build on it — see the **[Rome Protocol Documentation](https://docs.rome.builders)**.

## What Rome gives your app

- **Single state** — EVM contracts and Solana programs share one state; no bridging or sync delay.
- **Atomic CPI access** — Solidity calls any Solana program directly (SPL Token, Meteora, …) inside one atomic transaction.
- **App Sovereignty** — each app runs its own EVM chain with a custom gas token and captures its own fee revenue.

## Developing this scaffolder

```bash
npm test   # node:test regression suite (npx-layout scaffold, .gitignore, existing-dir refusal)
```

MIT.
