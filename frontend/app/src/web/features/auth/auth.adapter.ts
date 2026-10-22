import { AuthProvider, type HandleMagicLinkResponse, type UserSummary } from "@client";
import type {
    AuthMethod,
    AuthOption,
    AuthPerson,
    AuthWallet,
    EmailLinkResult,
} from "@openchat/ui/src/features/components/AuthDialog.svelte";
import { ETH_WALLET_ICONS, ethWalletIcon, uniqueByName } from "@src/utils/ethWallets";

// Mapping between the client's sign-in (identity states, providers, responses) and AuthDialog's
// props. The calls themselves are in signIn.ts.

export const PROVIDERS: Record<AuthMethod, AuthProvider> = {
    passkey: AuthProvider.PASSKEY,
    ii: AuthProvider.II,
    nfid: AuthProvider.NFID,
    eth: AuthProvider.ETH,
    sol: AuthProvider.SOL,
};

/** A sign-in option (signInOptions) as AuthDialog names it. */
export const OPTIONS: Record<AuthProvider, AuthOption> = {
    [AuthProvider.PASSKEY]: "passkey",
    [AuthProvider.EMAIL]: "email",
    [AuthProvider.II]: "ii",
    [AuthProvider.ETH]: "eth",
    [AuthProvider.SOL]: "sol",
    [AuthProvider.NFID]: "nfid",
};

/**
 * The Ethereum wallets to pick from, as the old UI's SigninWithEth lists wagmi's connectors: the
 * configured ones first, then any the browser announces (EIP-6963), one per name, with our icon
 * for the configured ones and the wallet's own for the rest.
 */
export function uniqueWallets(
    connectors: readonly { id: string; name: string; icon?: string }[],
): AuthWallet[] {
    return uniqueByName(connectors).map((c) => ({
        id: c.id,
        name: c.name,
        icon: ethWalletIcon(c),
    }));
}

export const WALLETS: Record<"eth" | "sol", AuthWallet[]> = {
    // wagmi connector ids
    eth: [
        { id: "metaMaskSDK", name: "MetaMask", icon: ETH_WALLET_ICONS.metaMaskSDK },
        {
            id: "coinbaseWalletSDK",
            name: "Coinbase Wallet",
            icon: ETH_WALLET_ICONS.coinbaseWalletSDK,
        },
        { id: "walletConnect", name: "WalletConnect", icon: ETH_WALLET_ICONS.walletConnect },
    ],
    // Solana wallet adapter names
    sol: [
        { id: "Phantom", name: "Phantom" },
        { id: "Coinbase Wallet", name: "Coinbase Wallet", icon: "/assets/coinbase.svg" },
        { id: "WalletConnect", name: "WalletConnect", icon: "/assets/walletconnect.svg" },
    ],
};

export function person(user: UserSummary): AuthPerson {
    return {
        userId: user.userId,
        name: user.displayName ?? user.username,
        handle: user.username,
        grad: "var(--accent)",
    };
}

/** What became of an email link's code (client.handleMagicLink), as AuthDialog names it. */
export function emailLinkResult(kind: HandleMagicLinkResponse["kind"]): EmailLinkResult {
    switch (kind) {
        case "success":
            return "signed_in";
        case "session_not_found":
            return "elsewhere";
        case "link_expired":
            return "expired";
        default:
            return "invalid";
    }
}
