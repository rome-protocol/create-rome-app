# AGENTS.md — building on Rome

This is a **dual-lane Rome app**: one Solidity contract that both a MetaMask (EVM) wallet and a Phantom (Solana) wallet drive, on `@rome-protocol/sdk`. If you're an AI agent extending it, these are the Rome-specific rules. (See also the SDK's own [`AGENTS.md`](https://github.com/rome-protocol/rome-sdk-ts/blob/main/AGENTS.md) and [docs.rome.builders](https://docs.rome.builders).)

## The one rule that matters

**Every Rome write goes through the SDK — never raw `eth_sendTransaction` / wagmi `writeContract`.**

- EVM wallet → `submitRomeTx(provider, tx)` — sizes gas (Rome's estimator undercounts Solana-CPI cost) + supplies EIP-1559 fee fields, so the wallet never shows "Network fee: Unavailable" and never under-gasses a CPI write.
- Solana wallet → `submitRomeTxSolanaLane(deps, call)` — the mirror; a Solana wallet drives your EVM contract with no Ethereum key.

`lib/rome.ts` has both lanes for the `Vault` in one file — copy its shape for new contract calls.

## The dual-lane model (the Solana lane)

- A Solana user's EVM identity is their **synthetic address** (`keccak256(pubkey)[12:]`) — their `msg.sender`. It **holds nothing at rest**.
- Their spendable balance is the wallet's SPL token account, surfaced 1:1 as the **ERC20SPL wrapper** (`wUSDC`). Move it with ERC-20 `transfer` / `transferFrom` — **not** native `msg.value` (a Solana user has none at rest).
- Value **in** = the **fund leg** (`buildFundLeg`, wallet → synthetic); value **out** = the **sweep leg** (`buildSweepLeg`, synthetic → wallet).
- A brand-new synthetic is **auto-provisioned** (`create_pda`) on its first lane write — the SDK handles it (`autoProvision` default on).

## Config — registry-driven, never hardcode

Chain ids, RPCs, the wUSDC wrapper, the USDC mint, and the rome-evm program id all come from **`@rome-protocol/registry`** (`lib/config.ts`). Default chain: **Rome Hadrian (200010)**. The registry reads the filesystem (Node-only), so the web app imports a **build-time projection** (`scripts/gen-config.ts` → `src/config.generated.json`) instead of calling it in the browser.

## Funding

Gas is **USDC**. There is **no faucet** — bridge USDC into Rome. A Solana user needs a little **SOL** (tx fees) + **USDC**; an EVM user needs **USDC** gas (and wraps some into wUSDC via `evmWrapToWusdc`).

## Verify before claiming done

Drive real flows: `npm run demo` runs BOTH lanes against one Vault on-chain and asserts they hit the same state. Don't claim a lane works until it's landed a real transaction.
