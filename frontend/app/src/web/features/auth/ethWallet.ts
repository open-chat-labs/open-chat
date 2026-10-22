import type { OpenChat } from "@client";
import type { AuthWallet } from "@openchat/ui/src/features/components/AuthDialog.svelte";
import { ethWagmiConfig } from "@src/utils/wagmi";
import { signMessage } from "@wagmi/core";
import { uniqueWallets } from "./auth.adapter";

// Sign in with an Ethereum wallet, as the old UI's SigninWithEth.svelte does: connect, and sign
// the SIWE message the backend prepares; the client signs in with the signature. Loaded on demand,
// as wagmi is large.

/** The wallets to pick from: the configured ones and any the browser announces. */
export function ethWallets(): AuthWallet[] {
    return uniqueWallets(ethWagmiConfig().connectors);
}

/**
 * Resolves with the wallet's address and its signature of the sign-in message; rejects if any step
 * fails or is declined, or once `signal` gives the sign-in up (a wallet answered late doesn't sign
 * in after all).
 */
export async function signWithEthereum(
    client: OpenChat,
    connectorId: string,
    signal?: AbortSignal,
): Promise<{ address: string; signature: string }> {
    const cfg = ethWagmiConfig();
    const connector = cfg.connectors.find((c) => c.id === connectorId);
    if (connector === undefined) throw new Error(`No Ethereum wallet connector ${connectorId}`);
    const { accounts } = await connector.connect();
    signal?.throwIfAborted();
    const account = accounts[0];
    if (account === undefined) throw new Error("The wallet didn't give an address");
    const prepared = await client.siwePrepareLogin(account);
    signal?.throwIfAborted();
    if (prepared.kind !== "success") throw new Error("Couldn't prepare the Ethereum sign-in");
    const signature = await signMessage(cfg, { account, connector, message: prepared.siweMessage });
    signal?.throwIfAborted();
    return { address: account, signature };
}
