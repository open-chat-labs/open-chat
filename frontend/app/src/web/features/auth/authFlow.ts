import type { IdentityState } from "@client";

// The sign-in flow's decisions, made from the client's identity state. Only src/web uses them, so
// they live beside its screens until another tree needs them (then app/src/logic/auth).

export type SignedIn = "logged_in" | "registering";

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
