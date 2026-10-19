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

/** The app's message (as the old sign-up showed it) for a refused registration, if it has one. */
export function registerFailureKey(kind: RegisterUserResponse["kind"]): string | undefined {
    switch (kind) {
        case "username_taken":
            return "register.usernameTaken";
        case "username_too_short":
            return "register.usernameTooShort";
        case "username_too_long":
            return "register.usernameTooLong";
        case "username_invalid":
            return "register.usernameInvalid";
        case "email_invalid":
            return "register.emailInvalid";
        case "user_limit_reached":
            return "register.userLimitReached";
        // the old UI had keys for the other two that were never written; this one covers them
        case "referral_code_invalid":
        case "referral_code_already_claimed":
        case "referral_code_expired":
            return "register.referralCodeInvalid";
        case "internal_error":
            return "unexpectedError";
        default:
            return undefined;
    }
}

/** The app's message (as the old sign-in showed it) for a sign-in link that couldn't be sent. */
export function emailLinkFailureKey(kind: string): string {
    switch (kind) {
        case "email_invalid":
            return "loginDialog.invalidEmail";
        case "failed_to_send_email":
            return "loginDialog.failedToSendEmail";
        default:
            return "loginDialog.unexpectedError";
    }
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
 * Whether the in-app dialog, closed, may open again for this identity: only for a new sign-in
 * (the client asking again) or once there's a user. An identity that turns up without an account
 * after the close (a passkey or window that completed anyway) doesn't bring it back.
 */
export function endsDismissal(state: IdentityState): boolean {
    return state.kind === "logging_in" || state.kind === "logged_in";
}
