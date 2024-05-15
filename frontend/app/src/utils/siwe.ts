import { mainnet } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { createConfig, http } from "@wagmi/core";

export const wagmiConfig = createConfig({
    chains: [mainnet],
    connectors: [
        coinbaseWallet({ appName: "OpenChat" }),
        injected(),
        walletConnect({ projectId: process.env.WALLETCONNECT_PROJECT_ID }),
    ],
    transports: {
        [mainnet.id]: http(),
    },
});

wagmiConfig.connectors[0].
