import { mainnet } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { createConfig, http } from "@wagmi/core";

const WALLETCONNECT_PROJECT_ID = "b9aafebed2abfaf8341afd9428c947d5";

export const wagmiConfig = createConfig({
    chains: [mainnet],
    connectors: [
        coinbaseWallet({ appName: "OpenChat" }),
        injected(),
        walletConnect({ projectId: WALLETCONNECT_PROJECT_ID }),
    ],
    transports: {
        [mainnet.id]: http(),
    },
});

wagmiConfig.connectors[0].
