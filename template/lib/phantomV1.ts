// Phantom as a v1-lane signer. The v1 lane asks the wallet for two signatures
// per call: a readable authorization message, then the Solana transaction.
// The injected provider (window.solana) shows the message text; the transaction
// goes through Wallet Standard, which handles the v1 wire format.
import { getWallets } from "@wallet-standard/app";
import type { PublicKey } from "@solana/web3.js";
import type { LaneSigner } from "@rome-protocol/sdk";

type Injected = { signMessage: (m: Uint8Array, display: string) => Promise<{ signature: Uint8Array }> };

// Wallet Standard chain id for the cluster the registry names.
const chainFor = (cluster: string) => (/^mainnet/.test(cluster) ? "solana:mainnet" : cluster === "testnet" ? "solana:testnet" : "solana:devnet");

export function phantomLaneSigner(payer: PublicKey, injected: Injected, cluster: string): LaneSigner {
  // Find the wallet up front, so a missing or mismatched Phantom fails before any
  // prompt and before any value moves, not halfway through a deposit.
  const wallet = getWallets().get().find((w) => w.name.includes("Phantom") && "solana:signTransaction" in w.features);
  const account = wallet?.accounts.find((a) => a.address === payer.toBase58());
  if (!wallet || !account) throw new Error("Phantom is not available through Wallet Standard for this account. Open Phantom, unlock it and reconnect.");
  const feature = (wallet.features as any)["solana:signTransaction"];
  return {
    payer,
    signAuthHash: async (message) => (await injected.signMessage(message, "utf8")).signature,
    signV1Wire: async (wire) => {
      const [{ signedTransaction }] = await feature.signTransaction({ account, transaction: wire, chain: chainFor(cluster) });
      return signedTransaction.slice(-64); // the 64-byte signature at the end of the signed wire
    },
  };
}
