# Rome dual-lane app

A minimal **dual-lane** app on [Rome](https://docs.rome.builders): one Solidity `Vault` that **both** a MetaMask (EVM) wallet and a Phantom (Solana) wallet deposit into and withdraw from — same contract, same state, each with the wallet they already have. Built on [`@rome-protocol/sdk`](https://github.com/rome-protocol/rome-sdk-ts).

```
contracts/Vault.sol      the app contract — a plain ERC-20 vault over wUSDC
lib/rome.ts              BOTH lanes in one file (EVM via submitRomeTx, Solana via submitRomeTxV1)
lib/phantomV1.ts         Phantom as a v1-lane signer (readable authorization + transaction)
lib/config.ts            registry-driven config (chain, RPCs, wUSDC, program id) — no hardcoding
scripts/demo.ts          headless: deploy a Vault + drive BOTH lanes → prove they hit one Vault
scripts/deploy.ts        deploy the Vault
src/App.tsx              the web app — connect both wallets, deposit/withdraw
```

## Setup

```bash
npm install
cp .env.example .env      # then fill in the two wallet keys
```

`.env`:
- `ROME_EVM_KEY` — a MetaMask-style key holding at least **1 USDC as Rome gas** — a
  demo run costs ~0.5 (it deploys a fresh Vault + wraps 0.15 into wUSDC). Bridge USDC
  in (`rome fund hadrian --from base-sepolia --amount 1`); there is no faucet.
- `ROME_SOLANA_KEY` — a Phantom-style secret-key array holding at least **0.6 USDC +
  0.02 SOL** (the demo moves 0.5 USDC through the synthetic and sweeps it back; the
  SOL pays Solana tx fees).

The names match the [`rome` CLI](https://github.com/rome-protocol/rome-cli): `npm run
verify` loads `.env` itself, and if you export the same two vars in your shell,
`rome verify` / `rome fund` read the very keys you funded here.

Everything else (chain 200010 Hadrian, RPCs, the wUSDC wrapper, the USDC mint, the rome-evm program id) resolves from [`@rome-protocol/registry`](https://github.com/rome-protocol/rome-registry).

## Run it

```bash
npm run demo     # headless: deploys a Vault, then a MetaMask lane AND a Phantom lane
                 # each deposit + withdraw into the SAME Vault. Proves dual-lane end-to-end.

npm run deploy   # deploy a Vault → set VAULT_ADDRESS in .env
npm run verify   # the works-gate (the rome CLI's `verify`): the SAME contract answers on BOTH lanes
npm run dev      # the web app — connect MetaMask + Phantom, deposit/withdraw
```

## The two lanes (see `lib/rome.ts`)

- **EVM lane** — `submitRomeTx(provider, tx)`. The SDK sizes gas (Rome's estimator undercounts Solana-CPI cost) and supplies fee fields. A MetaMask user wraps 0.15 of native gas into wUSDC (`evmWrapToWusdc`), then it's a normal ERC-20 `approve` → `deposit`.
- **Solana lane** — `submitRomeTxV1(deps, call)`, the mirror, with **no Ethereum key**. Each call is **one Solana v1 transaction** composed by the proxy, with no lookup table and no account list to build. A Solana user's EVM identity is their *synthetic address*; their spendable balance is their wallet's token account surfaced as wUSDC. Value flows *through* the synthetic: **fund leg** in, **sweep leg** out. The wallet is asked **twice per call**: first to approve a readable authorization message, then to sign the transaction. A fresh synthetic is **provisioned explicitly, once** (`solanaProvision`) before its first approve; the v1 lane does not do it for you.

Both call the identical `Vault` and share the same `balanceOf` state. Point the constructor at any chain's wUSDC (from the registry) to run elsewhere.

## Learn more

- [docs.rome.builders](https://docs.rome.builders) — Build a dual-lane app, Call EVM from Solana
- [`@rome-protocol/sdk`](https://github.com/rome-protocol/rome-sdk-ts) · [`AGENTS.md`](./AGENTS.md) for AI agents

MIT.
