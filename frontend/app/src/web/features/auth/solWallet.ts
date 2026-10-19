import type { OpenChat, SiwsMessage } from "@client";
import { WalletAdapterNetwork, type WalletName } from "@solana/wallet-adapter-base";
import { CoinbaseWalletAdapter } from "@solana/wallet-adapter-coinbase";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-walletconnect";
import { initialize, settledWallet } from "@src/stores/solana/walletStore";
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

// The message the wallet signs, in the format the SIWS canister checks
export function buildSignInRequest(siwsMessage: SiwsMessage): string {
    // expiration_time and issued_at are in nanoseconds
    const expMilliseconds = Number(siwsMessage.expirationTime / BigInt(1000000));
    const issuedAtMilliseconds = Number(siwsMessage.issuedAt / BigInt(1000000));

    let request = `${siwsMessage.domain} wants you to sign in with your Solana account:\n${siwsMessage.address}\n\n`;
    request += `${siwsMessage.statement}\n\n`;
    request += `URI: ${siwsMessage.uri}\n`;
    request += `Version: ${siwsMessage.version}\n`;
    request += `Chain ID: ${siwsMessage.chainId}\n`;
    request += `Nonce: ${siwsMessage.nonce}\n`;
    request += `Issued At: ${new Date(issuedAtMilliseconds).toISOString()}\n`;
    request += `Expiration Time: ${new Date(expMilliseconds).toISOString()}`;
    return request;
}

/** Resolves once the client has the wallet's identity; rejects if any step fails or is declined. */
export async function signInWithSolana(client: OpenChat, walletName: string): Promise<void> {
    await initialiseWallets();
    // a returning user's wallet auto-connects as the adapters start, and connect() returns
    // straight away while that's in flight; so is picking a wallet that auto-connects
    const { select, connect } = await settledWallet();
    lastError = undefined;
    await select(walletName as WalletName);
    await connect();
    const { publicKey, wallet, signMessage } = await settledWallet();
    if (!publicKey || !wallet || !signMessage) {
        throw lastError ?? new Error("The wallet didn't connect");
    }
    const account = publicKey.toBase58();
    const prepared = await client.siwsPrepareLogin(account);
    if (prepared.kind !== "success") throw new Error("Couldn't prepare the Solana sign-in");
    const data = new TextEncoder().encode(buildSignInRequest(prepared.siwsMessage));
    const signature = base58.encode(await signMessage(data));
    const result = await client.signInWithWallet("sol", account, signature, true);
    if (result.kind !== "success") throw new Error("Solana sign-in failed");
}
