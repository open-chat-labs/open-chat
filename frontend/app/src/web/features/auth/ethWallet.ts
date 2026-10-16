import type { OpenChat } from "@client";
import { coinbaseWallet, metaMask, walletConnect } from "@wagmi/connectors";
import { createConfig, http, signMessage, type Config } from "@wagmi/core";
import { mainnet } from "@wagmi/core/chains";

// Sign in with an Ethereum wallet, as the old UI's SigninWithEth.svelte does: connect, sign the
// SIWE message the backend prepares, then sign in with the signature. Loaded on demand, as wagmi
// is large.

let config: Config | undefined;

function wagmiConfig(): Config {
    config ??= createConfig({
        chains: [mainnet],
        connectors: [
            metaMask(),
            coinbaseWallet({ appName: "OpenChat" }),
            walletConnect({ projectId: import.meta.env.OC_WALLET_CONNECT_PROJECT_ID! }),
        ],
        transports: {
            [mainnet.id]: http(),
        },
    });
    return config;
}

/** Resolves once the client has the wallet's identity; rejects if any step fails or is declined. */
export async function signInWithEthereum(client: OpenChat, connectorId: string): Promise<void> {
    const cfg = wagmiConfig();
    const connector = cfg.connectors.find((c) => c.id === connectorId);
    if (connector === undefined) throw new Error(`No Ethereum wallet connector ${connectorId}`);
    const { accounts } = await connector.connect();
    const account = accounts[0];
    if (account === undefined) throw new Error("The wallet didn't give an address");
    const prepared = await client.siwePrepareLogin(account);
    if (prepared.kind !== "success") throw new Error("Couldn't prepare the Ethereum sign-in");
    const signature = await signMessage(cfg, { account, connector, message: prepared.siweMessage });
    const result = await client.signInWithWallet("eth", account, signature, true);
    if (result.kind !== "success") throw new Error("Ethereum sign-in failed");
}
