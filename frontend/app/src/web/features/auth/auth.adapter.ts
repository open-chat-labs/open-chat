import {
    AuthProvider,
    type CreatedUser,
    type HandleMagicLinkResponse,
    type IdentityState,
    type RegisterUserResponse,
    type UserSummary,
} from "@client";
import type {
    AuthMethod,
    AuthOption,
    AuthPerson,
    AuthWallet,
    EmailLinkResult,
} from "@openchat/ui/src/features/components/AuthDialog.svelte";

// Mapping between the client's sign-in (identity states, providers, responses) and AuthDialog's
// props. The calls themselves are in signIn.ts.

export const PROVIDERS: Record<AuthMethod, AuthProvider> = {
    passkey: AuthProvider.PASSKEY,
    ii: AuthProvider.II,
    nfid: AuthProvider.NFID,
    eth: AuthProvider.ETH,
    sol: AuthProvider.SOL,
};

const ALL_OPTIONS: AuthOption[] = ["passkey", "email", "ii", "eth", "sol", "nfid"];

// ?auth=II&auth=EMAIL … narrows the sign-in options (by the old names, or AuthProvider's values)
const QUERY_NAMES: Record<AuthOption, string[]> = {
    passkey: ["PASSKEY", AuthProvider.PASSKEY],
    email: ["EMAIL", AuthProvider.EMAIL],
    ii: ["II", AuthProvider.II],
    eth: ["ETH", AuthProvider.ETH],
    sol: ["SOL", AuthProvider.SOL],
    nfid: ["NFID", AuthProvider.NFID],
};

/** The sign-in options on offer: `?auth=` narrows them, and without WebAuthn only passkey and email are left (as today). */
export function authOptions(restrictTo: string[], hasWebAuthn: boolean): AuthOption[] {
    const supported = hasWebAuthn
        ? ALL_OPTIONS
        : ALL_OPTIONS.filter((o) => o === "passkey" || o === "email");
    if (restrictTo.length === 0) return supported;
    return supported.filter((o) => QUERY_NAMES[o].some((name) => restrictTo.includes(name)));
}

export const WALLETS: Record<"eth" | "sol", AuthWallet[]> = {
    // wagmi connector ids
    eth: [
        { id: "metaMaskSDK", name: "MetaMask", icon: "/assets/metamask.svg" },
        { id: "coinbaseWalletSDK", name: "Coinbase Wallet", icon: "/assets/coinbase.svg" },
        { id: "walletConnect", name: "WalletConnect", icon: "/assets/walletconnect.svg" },
    ],
    // Solana wallet adapter names
    sol: [
        { id: "Phantom", name: "Phantom" },
        { id: "Coinbase Wallet", name: "Coinbase Wallet", icon: "/assets/coinbase.svg" },
        { id: "WalletConnect", name: "WalletConnect", icon: "/assets/walletconnect.svg" },
    ],
};

export type SignedIn = "logged_in" | "registering";

/** Where a sign-in has got to: signed in (with or without an account), still going, or back to anonymous. */
export function signInOutcome(state: IdentityState): SignedIn | "pending" | "failed" {
    switch (state.kind) {
        case "logged_in":
            return "logged_in";
        case "registering":
            return "registering";
        case "anon":
            return "failed";
        default:
            return "pending";
    }
}

export function createdUser(
    username: string,
    resp: Extract<RegisterUserResponse, { kind: "success" }>,
): CreatedUser {
    return {
        kind: "created_user",
        username,
        dateCreated: BigInt(Date.now()),
        displayName: undefined,
        cryptoAccount: resp.icpAccount,
        userId: resp.userId,
        isPlatformModerator: false,
        isPlatformOperator: false,
        suspensionDetails: undefined,
        isSuspectedBot: false,
        diamondStatus: { kind: "inactive" },
        moderationFlagsEnabled: 0,
        updated: 0n,
        isBot: false,
        isUniquePerson: false,
        totalChitEarned: 0,
        chitBalance: 0,
        streak: 0,
        maxStreak: 0,
        hideOnlineStatus: false,
    };
}

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

export type AuthDialogKind = "login" | "signup";

/**
 * Which in-app AuthDialog shows after an identity change, as the old UI's onboarding modal
 * (Home.svelte): asking for sign-in opens it, a signed-in identity without an account turns it
 * into sign-up, and it closes once there's a user, or on going back to anonymous (a cancelled
 * sign-in). While the user loads it stays as it is.
 */
export function nextAuthKind(
    current: AuthDialogKind | null,
    state: IdentityState,
): AuthDialogKind | null {
    switch (state.kind) {
        case "logging_in":
            return current ?? "login";
        case "registering":
            return "signup";
        case "loading_user":
            return state.registering ? "signup" : current;
        default:
            return null;
    }
}
