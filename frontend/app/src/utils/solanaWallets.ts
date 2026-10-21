import { WalletAdapterNetwork, type Adapter } from "@solana/wallet-adapter-base";
import { CoinbaseWalletAdapter } from "@solana/wallet-adapter-coinbase";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-walletconnect";

/** The Solana wallets a user can sign in with, configured from the build env. */
export function solanaWallets(): Adapter[] {
    return [
        new PhantomWalletAdapter(),
        new CoinbaseWalletAdapter(),
        new WalletConnectWalletAdapter({
            network: WalletAdapterNetwork.Mainnet,
            options: { projectId: import.meta.env.OC_WALLET_CONNECT_PROJECT_ID! },
        }),
    ];
}
