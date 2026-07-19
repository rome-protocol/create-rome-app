# AGENTS.md

`create-rome-app` scaffolds a **dual-lane Rome app**. The Rome-specific rules for *building* live in the scaffolded app's [`template/AGENTS.md`](./template/AGENTS.md) — read that.

In short: every Rome write goes through `@rome-protocol/sdk` (`submitRomeTx` for the EVM lane, `submitRomeTxSolanaLane` for the Solana lane); config is registry-driven (`@rome-protocol/registry`, default chain Rome Hadrian); gas is USDC with no faucet.

This repo itself is just a copier (`bin/create-rome-app.mjs`) plus the `template/`. To change what gets scaffolded, edit `template/`.
