import { mainnet } from "@wagmi/chains";
import { coinbaseWallet, injected, walletConnect, mock } from "@wagmi/connectors";
import { createConfig, http } from "@wagmi/core";

console.log("ProjectId: ", "process.env.WALLETCONNECT_PROJECT_ID");

export const wagmiConfig = createConfig({
    chains: [mainnet],
    connectors: [
        coinbaseWallet({ appName: "OpenChat" }),
        injected(),
        walletConnect({ projectId: "process.env.WALLETCONNECT_PROJECT_ID" }),
        mock({
            accounts: [
                "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
                "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
                "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            ],
        }),
    ],
    transports: {
        [mainnet.id]: http(),
    },
});
