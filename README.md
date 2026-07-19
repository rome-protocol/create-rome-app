# create-rome-app

Scaffold a **dual-lane Rome app** in seconds — one Solidity contract that both a **MetaMask (EVM)** wallet and a **Phantom (Solana)** wallet drive, on [`@rome-protocol/sdk`](https://github.com/rome-protocol/rome-sdk-ts).

```bash
npx github:rome-protocol/create-rome-app my-app
cd my-app
npm install
# fill in .env (EVM_KEY + SOLANA_KEY), fund both wallets
npm run demo    # headless: a MetaMask lane AND a Phantom lane each hit ONE Vault
npm run dev     # the web app — connect both wallets, deposit/withdraw
```

## What you get

A minimal app where both wallets deposit into + withdraw from the same `Vault`, sharing the same state:

- **`lib/rome.ts`** — both lanes in one file (`submitRomeTx` for EVM, `submitRomeTxSolanaLane` for Solana)
- **`contracts/Vault.sol`** — a plain ERC-20 vault over the wUSDC wrapper
- **`scripts/demo.ts`** — the funded proof that both lanes hit one Vault
- **`src/App.tsx`** — connect MetaMask + Phantom, deposit/withdraw
- registry-driven config (default chain: **Rome Hadrian**) — no hardcoded ids or addresses

Read the scaffolded app's `README.md` + `AGENTS.md`, and [docs.rome.builders](https://docs.rome.builders).

## What Rome is

Rome is an EVM execution environment inside Solana: your Solidity app is open to everyone at once — EVM users with MetaMask **and** Solana users with Phantom, driving the same contract. This template is the smallest thing that shows both lanes working.

MIT.
