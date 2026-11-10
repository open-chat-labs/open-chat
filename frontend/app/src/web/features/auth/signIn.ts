import { AuthProvider, identityStateStore, type OpenChat, type SignInMethod } from "@client";
import type {
    AuthFailure,
    AuthMethod,
    EmailLinkResult,
    EmailLinkSent,
    SignupDetails,
} from "@openchat/ui/src/features/components/AuthDialog.svelte";
import { configKeys, type SignInOutcome } from "@shared";
import type { PageAuth } from "@openchat/ui/src/pages/pageAuth.svelte";
import type { AuthDialogHost } from "@src/logic/auth/authDialog.svelte";
import { onAuthClosed, type SignedIn } from "@src/logic/auth/authFlow";
import {
    abandonSignIn,
    Referral,
    resolveReferrer,
    resumeSignIn,
    searchReferrers,
    signUp,
} from "@src/logic/auth/signUp";
import { emailLinkResult, OPTIONS, person, PROVIDERS, WALLETS } from "./auth.adapter";

// AuthDialog's host callbacks, on the client's operations: a sign-in settles with client.signIn's
// outcome, an emailed link with client.requestEmailSignIn's, a sign-up with client.signUp's
// (DATA.md, Auth). The sign-up, the referrer and a sign-in walked away from are the shared ones
// (logic/auth/signUp.ts), as the native tree's signed-out start has them too.

export { signInAbandoned } from "@src/logic/auth/signUp";

/** AuthDialog's host callbacks (what its props are made from), and the hosts' own steps. */
export type Auth = AuthDialogHost & {
    /** The email link page's code: completes the sign-in the link belongs to. */
    onLinkCode: (querystring: string, code: string) => Promise<EmailLinkResult>;
    /** Stops waiting for an emailed link to be followed. */
    stopEmail: () => void;
    /**
     * The dialog was closed: gives up the sign-ins it was waiting on (back to anonymous, for one
     * the client is still logging in), stops a sign-up in flight from going on to make the
     * account, and stops the email link (one still being sent too).
     * An identity without an account left behind is signed out, now or once it gets there,
     * until the next sign-in starts, whichever host is mounted by then (signInAbandoned).
     */
    cancel: () => void;
    /** The host is going: stops the email link. */
    dispose: () => void;
};

export type AuthOptions = {
    /** The app's own copy: the reasons a sign-in or sign-up failed are its translated messages. */
    translate: (key: string) => string;
    /** Runs when a link sent from this host signs the person in. */
    onEmailSignedIn?: (outcome: SignedIn) => void;
};

/**
 * AuthDialog's wallets: the configured ones and those the browser announces (EIP-6963), as the
 * old UI lists them; wagmi is loaded when Ethereum is picked.
 */
export const AUTH_WALLETS: NonNullable<PageAuth["wallets"]> = {
    eth: async () => (await import("./ethWallet")).ethWallets(),
    sol: WALLETS.sol,
};

/**
 * The client's sign-in method for one AuthDialog picked: a wallet signs the backend's sign-in
 * message here first; the rest is the client's. (AuthDialog has no linking code: that's the
 * native tree's.)
 */
export async function signInMethod(
    client: OpenChat,
    method: AuthMethod,
    wallet: string | undefined,
    signal: AbortSignal,
): Promise<Exclude<SignInMethod, { kind: "linking_code" }>> {
    switch (method) {
        case "passkey":
            return { kind: "passkey" };
        case "eth": {
            const { signWithEthereum } = await import("./ethWallet");
            const signed = await signWithEthereum(client, wallet ?? WALLETS.eth[0].id, signal);
            return { kind: "wallet", token: "eth", ...signed };
        }
        case "sol": {
            const { signWithSolana } = await import("./solWallet");
            const signed = await signWithSolana(client, wallet ?? WALLETS.sol[0].id, signal);
            return { kind: "wallet", token: "sol", ...signed };
        }
        default:
            // Internet Identity and NFID open the auth client's window
            return { kind: "auth_client", provider: method };
    }
}

/**
 * The sign-in callbacks for one AuthDialog host. An emailed link is followed on another page, so
 * `onEmailSignedIn` is the only thing that hears of it here.
 */
export function createAuth(client: OpenChat, { translate, onEmailSignedIn }: AuthOptions): Auth {
    // the link being waited on, given up through its request's signal: a resend that fails leaves
    // the earlier link working, and one that's sent replaces it
    let emailLink: AbortController | undefined = undefined;
    // the link request still being sent: a new request, or stopping, drops it once it is
    let emailRequest: AbortController | undefined = undefined;
    // the sign-up in progress: cancelling gives it up, so one still making its passkey goes no
    // further than that
    let signup = new AbortController();
    // the sign-ins the dialog is waiting on; cancelling gives them up
    let attempts = new AbortController();
    // the referral link's referrer, and what a sign-up does with the stored code
    const referral = new Referral(client);

    const failure = (key: string): AuthFailure => ({ reason: translate(key) });

    async function signIn(method: AuthMethod, wallet: string | undefined): Promise<SignedIn> {
        resumeSignIn();
        const signal = attempts.signal;
        client.gaTrack("initiated_signin", "registration", PROVIDERS[method]);
        const outcome = await client.signIn(
            await signInMethod(client, method, wallet, signal),
            signal,
        );
        switch (outcome.kind) {
            case "logged_in":
                return "logged_in";
            case "needs_account":
                return "registering";
            case "cancelled":
                throw new Error("Sign-in given up");
            case "failed":
                throw failure(outcome.reason.key);
        }
    }

    return {
        wallets: AUTH_WALLETS,
        termsUrl: "/terms",
        options: OPTIONS,
        native: client.isNativeApp(),

        // sign-up is the form (onSignup); every method signs in, and an identity without an
        // account goes on to the form from there (identityStateStore "registering")
        onMethod: (method, _kind, wallet) => signIn(method, wallet),

        async onRequestEmailLink(address): Promise<EmailLinkSent> {
            resumeSignIn();
            const request = new AbortController();
            emailRequest?.abort();
            emailRequest = request;
            client.gaTrack("initiated_signin", "registration", AuthProvider.EMAIL);
            localStorage.setItem(configKeys.selectedAuthEmail, address);
            const resp = await client.requestEmailSignIn(address, request.signal);
            if (emailRequest === request) emailRequest = undefined;
            // stopped while it was being sent (the dialog closed, or a newer request)
            if (resp.kind === "cancelled") throw new Error("Email link given up");
            // a link that couldn't be sent leaves an earlier one working
            if (resp.kind === "failed") throw failure(resp.reason.key);
            emailLink?.abort();
            emailLink = request;
            // the person follows the link on another page, and this one signs in when the client
            // hears of it
            awaitEmailLink(resp.signedIn, request);
            return { code: resp.code };
        },

        onCancelEmailLink() {
            // only a link still waited on is a cancel: not one that has signed in, nor a second
            // stop for the same link
            if (emailLink !== undefined) client.gaTrack("email_signin_cancelled", "registration");
            stopEmail();
        },

        lastEmail: () => localStorage.getItem(configKeys.selectedAuthEmail) ?? "",

        async loadReferrer() {
            // without a referrer (none stored, or the lookup failed) sign-up offers none
            const user = await referral.link();
            return user === undefined ? undefined : person(user);
        },

        async onSignup({
            username,
            email: recoveryEmail,
            referrerId,
            termsAccepted,
        }: SignupDetails) {
            const { signal } = signup;
            referral.apply(referrerId);
            // once the account is asked for it's made even if the dialog closes: a walk-away
            // waits for it
            const outcome = await signUp(client, username, recoveryEmail, termsAccepted, signal);
            switch (outcome.kind) {
                case "success":
                    return;
                case "cancelled":
                    throw new Error("Sign-up cancelled");
                // a refused referral code isn't sent again, so the next try goes ahead without it
                case "referral_refused":
                case "failed":
                    throw failure(outcome.reason.key);
            }
        },

        async checkUsername(username) {
            const resp = await client.checkUsername(username, false);
            if (resp === "offline") throw new Error("offline");
            return resp === "success";
        },

        async searchReferrers(query) {
            return (await searchReferrers(client, query)).map(person);
        },

        // an invite link's `ref` is the referrer's user id, as the link this browser came in on
        async resolveReferrer(code) {
            const user = await resolveReferrer(client, code);
            return user === undefined ? undefined : person(user);
        },

        async onLinkCode(querystring, code) {
            const resp = await client.handleMagicLink(`${querystring}&c=${code}`);
            return emailLinkResult(resp.kind);
        },

        stopEmail,

        cancel() {
            stopEmail();
            signup.abort();
            signup = new AbortController();
            attempts.abort();
            attempts = new AbortController();
            if (onAuthClosed(identityStateStore.value) === "anon") {
                client.updateIdentityState({ kind: "anon" });
            }
            abandonSignIn(client);
        },

        dispose: stopEmail,
    };

    async function awaitEmailLink(
        signedIn: Promise<SignInOutcome>,
        request: AbortController,
    ): Promise<void> {
        const outcome = await signedIn;
        // signed in: nothing left to wait for, or to call cancelled
        if (emailLink === request) emailLink = undefined;
        if (outcome.kind === "logged_in") onEmailSignedIn?.("logged_in");
        if (outcome.kind === "needs_account") onEmailSignedIn?.("registering");
    }

    function stopEmail() {
        emailRequest?.abort();
        emailRequest = undefined;
        emailLink?.abort();
        emailLink = undefined;
    }
}
