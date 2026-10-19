import type { OpenChat } from "@client";
import { WalletAdapterNetwork, type WalletName } from "@solana/wallet-adapter-base";
import { CoinbaseWalletAdapter } from "@solana/wallet-adapter-coinbase";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-walletconnect";
import { initialize, settledWallet } from "@src/stores/solana/walletStore";
import { buildSiwsMessage } from "@src/utils/siws";
import base58 from "bs58";

// Sign in with a Solana wallet, as the old UI's SigninWithSol.svelte does: connect, sign the SIWS
// message the backend prepares, then sign in with the signature. Loaded on demand.

let initialised: Promise<void> | undefined;
// the wallet's own error: a connect the store starts by itself (auto-connect) swallows it
let lastError: Error | undefined;

function initialiseWallets(): Promise<void> {
    // a failed start isn't kept, so the next sign-in tries again
    initialised ??= initialize({
        wallets: [
            new PhantomWalletAdapter(),
            new CoinbaseWalletAdapter(),
            new WalletConnectWalletAdapter({
                network: WalletAdapterNetwork.Mainnet,
                options: { projectId: import.meta.env.OC_WALLET_CONNECT_PROJECT_ID! },
            }),
        ],
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
 * Resolves once the client has the wallet's identity; rejects if any step fails or is declined,
 * or once `signal` gives the sign-in up (a wallet answered late doesn't sign in after all).
 */
export async function signInWithSolana(
    client: OpenChat,
    walletName: string,
    signal?: AbortSignal,
): Promise<void> {
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
    const result = await client.signInWithWallet("sol", account, signature, true);
    if (result.kind !== "success") throw new Error("Solana sign-in failed");
}
