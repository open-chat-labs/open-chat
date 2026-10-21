import type { OpenChat } from "@client";
import type { WalletName } from "@solana/wallet-adapter-base";
import { initialize, settledWallet } from "@src/stores/solana/walletStore";
import { buildSiwsMessage } from "@src/utils/siws";
import { solanaWallets } from "@src/utils/solanaWallets";
import base58 from "bs58";

// Sign in with a Solana wallet, as the old UI's SigninWithSol.svelte does: connect, and sign the
// SIWS message the backend prepares; the client signs in with the signature. Loaded on demand.

let initialised: Promise<void> | undefined;
// the wallet's own error: a connect the store starts by itself (auto-connect) swallows it
let lastError: Error | undefined;

function initialiseWallets(): Promise<void> {
    // a failed start isn't kept, so the next sign-in tries again
    initialised ??= initialize({
        wallets: solanaWallets(),
        autoConnect: true,
        localStorageKey: "walletAdapter",
        onError: (error) => {
            lastError = error;
            console.error("WalletError: ", error);
        },
    }).catch((err) => {
        initialised = undefined;
        throw err;
    });
    return initialised;
}

/**
 * Resolves with the wallet's address and its signature of the sign-in message; rejects if any step
 * fails or is declined, or once `signal` gives the sign-in up (a wallet answered late doesn't sign
 * in after all).
 */
export async function signWithSolana(
    client: OpenChat,
    walletName: string,
    signal?: AbortSignal,
): Promise<{ address: string; signature: string }> {
    await initialiseWallets();
    // a returning user's wallet auto-connects as the adapters start, and connect() returns
    // straight away while that's in flight; so is picking a wallet that auto-connects
    const { select, connect } = await settledWallet();
    signal?.throwIfAborted();
    lastError = undefined;
    await select(walletName as WalletName);
    await connect();
    const { publicKey, wallet, signMessage } = await settledWallet();
    signal?.throwIfAborted();
    if (!publicKey || !wallet || !signMessage) {
        throw lastError ?? new Error("The wallet didn't connect");
    }
    const account = publicKey.toBase58();
    const prepared = await client.siwsPrepareLogin(account);
    signal?.throwIfAborted();
    if (prepared.kind !== "success") throw new Error("Couldn't prepare the Solana sign-in");
    const data = new TextEncoder().encode(buildSiwsMessage(prepared.siwsMessage));
    const signature = base58.encode(await signMessage(data));
    signal?.throwIfAborted();
    return { address: account, signature };
}
