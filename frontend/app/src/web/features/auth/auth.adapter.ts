import {
    AuthProvider,
    type HandleMagicLinkResponse,
    type IdentityState,
    type UserSummary,
} from "@client";
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

/**
 * The sign-in options on offer: `?auth=` narrows them, and without WebAuthn only email is left
 * (a passkey is WebAuthn; the old UI also left the others out). The method last signed in with comes first (as the old UI's ChooseSignInOption).
 */
export function authOptions(
    restrictTo: string[],
    hasWebAuthn: boolean,
    last?: AuthProvider,
): AuthOption[] {
    const supported = hasWebAuthn ? ALL_OPTIONS : ALL_OPTIONS.filter((o) => o === "email");
    // the email link's own URL has a bare `?auth`, which narrows nothing
    const names = restrictTo.filter((name) => name !== "");
    const offered =
        names.length === 0
            ? supported
            : supported.filter((o) => QUERY_NAMES[o].some((name) => names.includes(name)));
    const lastOption = offered.find((o) => QUERY_NAMES[o].includes(last ?? ""));
    return lastOption === undefined
        ? offered
        : [lastOption, ...offered.filter((o) => o !== lastOption)];
}

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

export type SignedIn = "logged_in" | "registering";

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

/** Whether the identity is signed in without an account, or loading on the way to sign-up. */
export function withoutAccount(state: IdentityState): boolean {
    return state.kind === "registering" || (state.kind === "loading_user" && state.registering);
}

/**
 * Whether "/" shows Landing: for someone signed out, for a sign-in or sign-up still going on in
 * Landing's own dialog, whose outcome decides (the app, or Landing again with the reason), and
 * for a sign-up that failed there, which the dialog shows the reason for and lets them try again.
 */
export function showsSignedOut(
    state: IdentityState,
    anonUser: boolean,
    signingInOnPage: boolean,
    signupFailedOnPage: boolean,
): boolean {
    return (
        anonUser &&
        (state.kind === "anon" || signingInOnPage || (signupFailedOnPage && withoutAccount(state)))
    );
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

/**
 * What closing an AuthDialog, or leaving the app with its dialog open, does to the identity: a
 * sign-in the client is still logging in is given up, so "/" shows Landing. (An identity without
 * an account the dialog leaves behind is signed out by `Auth.cancel`.)
 */
export function onAuthClosed(state: IdentityState): "anon" | undefined {
    return state.kind === "logging_in" ? "anon" : undefined;
}

/**
 * Where a sign-in someone walked away from (closed its dialog, left its page) has got to: a new
 * sign-in (the client asking again) or a user ends it; an identity that turns up without an
 * account (a passkey or window completed anyway) is signed out; anything else waits.
 */
export function afterAbandoned(state: IdentityState): "end" | "sign_out" | "wait" {
    switch (state.kind) {
        case "logging_in":
        case "logged_in":
            return "end";
        case "registering":
            return "sign_out";
        default:
            return "wait";
    }
}

/** What the referral link's referrer lookup came to: someone, no one, an error, or not yet. */
export type ReferralLookup = "found" | "none" | "failed" | "pending";

/**
 * What a sign-up does with the stored referral code: sets the referrer the form names; without
 * one, clears a code that a referrer the person removed came from (one they picked here, or the
 * link's, shown to them) or that names no one, and keeps the link's code when its lookup failed
 * or hadn't finished, as nobody removed it.
 */
export function referralCode(
    referrerId: string | undefined,
    lookup: ReferralLookup,
    codeFromForm: boolean,
): "set" | "clear" | "keep" {
    if (referrerId !== undefined) return "set";
    if (codeFromForm || lookup === "found" || lookup === "none") return "clear";
    return "keep";
}
