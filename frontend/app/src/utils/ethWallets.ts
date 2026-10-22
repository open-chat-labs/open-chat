// The Ethereum wallets every UI lists to sign in with: wagmi's connectors (the configured ones,
// then any the browser announces, EIP-6963), one per name, with our icon for the configured ones.
// Kept apart from utils/wagmi so listing them doesn't load wagmi.

/** Our icons for the configured connectors, by wagmi connector id. */
export const ETH_WALLET_ICONS: Record<string, string> = {
    metaMaskSDK: "/assets/metamask.svg",
    coinbaseWalletSDK: "/assets/coinbase.svg",
    walletConnect: "/assets/walletconnect.svg",
};

/** The connectors, one per name: the first of a name wins (the configured one, as listed first). */
export function uniqueByName<C extends { name: string }>(connectors: readonly C[]): C[] {
    const names = new Set<string>();
    return connectors.filter((c) => {
        if (names.has(c.name)) return false;
        names.add(c.name);
        return true;
    });
}

/** A connector's icon: ours for a configured one, else the wallet's own. */
export function ethWalletIcon(connector: { id: string; icon?: string }): string | undefined {
    return ETH_WALLET_ICONS[connector.id] ?? connector.icon;
}
