import { uniqueWallets } from "./auth.adapter";

describe("the Ethereum wallets", () => {
    test("are wagmi's connectors, one per name, with our icons for the configured ones", () => {
        expect(
            uniqueWallets([
                { id: "metaMaskSDK", name: "MetaMask" },
                { id: "walletConnect", name: "WalletConnect", icon: "data:wc" },
                // announced by the browser (EIP-6963)
                { id: "io.metamask", name: "MetaMask", icon: "data:mm" },
                { id: "io.rabby", name: "Rabby Wallet", icon: "data:rabby" },
            ]),
        ).toEqual([
            { id: "metaMaskSDK", name: "MetaMask", icon: "/assets/metamask.svg" },
            { id: "walletConnect", name: "WalletConnect", icon: "/assets/walletconnect.svg" },
            { id: "io.rabby", name: "Rabby Wallet", icon: "data:rabby" },
        ]);
    });
});
