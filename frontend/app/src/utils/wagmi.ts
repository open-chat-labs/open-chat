import { coinbaseWallet, metaMask, walletConnect } from "@wagmi/connectors";
import { createConfig, http, type Config } from "@wagmi/core";
import { mainnet } from "@wagmi/core/chains";

let config: Config | undefined;

/**
 * The wagmi config every UI signs in with Ethereum through, made the first time it's needed. Its
 * connectors are the three configured wallets and any the browser announces (EIP-6963).
 */
export function ethWagmiConfig(): Config {
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
