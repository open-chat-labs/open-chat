import { AuthProvider, identityStateStore, type OpenChat, type SignInMethod } from "@client";
import type {
    AuthFailure,
    AuthMethod,
    AuthPerson,
    EmailLinkResult,
    EmailLinkSent,
    SignupDetails,
} from "@openchat/ui/src/features/components/AuthDialog.svelte";
import { configKeys } from "@shared";
import type { PageAuth } from "@openchat/ui/src/pages/pageAuth.svelte";
import { emailLinkResult, person, PROVIDERS, WALLETS } from "./auth.adapter";
import {
    afterAbandoned,
    onAuthClosed,
    referralCode,
    type ReferralLookup,
    type SignedIn,
} from "./authFlow";

// AuthDialog's host callbacks, on the client's operations: a sign-in settles with client.signIn's
// outcome, an emailed link with client.requestEmailSignIn's, a sign-up with client.signUp's
// (DATA.md, Auth).

// A sign-in someone walked away from (closed its dialog, or left its page). It's kept here rather
// than in a host, so whichever host is mounted when it comes to something, it's handled the same:
// an identity without an account it leaves behind is signed out, and until then the in-app dialog
// doesn't open for it (signInAbandoned). A new sign-in, or a user, ends it (afterAbandoned).
let stopAbandoned: (() => void) | undefined = undefined;
// an account being made: walking away lets it finish (it can't be taken back), and signs out only
// an identity it left without one
let registration: Promise<unknown> | undefined = undefined;

/** Whether a sign-in someone walked away from is still being seen through. */
export function signInAbandoned(): boolean {
    return stopAbandoned !== undefined;
}

function abandonSignIn(client: OpenChat): void {
    stopAbandoned?.();
    let done = false;
    let unsubscribe: (() => void) | undefined = undefined;
    const stop = () => {
        done = true;
        unsubscribe?.();
        if (stopAbandoned === stop) stopAbandoned = undefined;
    };
    stopAbandoned = stop;
    unsubscribe = identityStateStore.subscribe((state) => {
        if (done) return;
        const next = afterAbandoned(state);
        if (next === "wait") return;
        if (next === "end") return stop();
        // still abandoned until signed out, so the in-app dialog doesn't open meanwhile
        done = true;
        unsubscribe?.();
        Promise.resolve(registration)
            .catch(() => undefined)
            .then(() => {
                // the account it was making may have made it
                if (afterAbandoned(identityStateStore.value) !== "sign_out") return stop();
                return Promise.resolve(client.logout()).finally(stop);
            });
    });
    // the store calls back during subscribe, before `unsubscribe` was set
    if (done) unsubscribe();
}

function resumeSignIn(): void {
    stopAbandoned?.();
}

export type Auth = Required<
    Pick<
        PageAuth,
        | "onMethod"
        | "onSignup"
        | "onRequestEmailLink"
        | "onCancelEmailLink"
        | "checkUsername"
        | "searchReferrers"
    >
> & {
    wallets: NonNullable<PageAuth["wallets"]>;
    termsUrl: string;
    /** Whether this is the native app (its passkeys don't need the browser's WebAuthn). */
    native: boolean;
    /** The email link page's code: completes the sign-in the link belongs to. */
    onLinkCode: (querystring: string, code: string) => Promise<EmailLinkResult>;
    /** Stops waiting for an emailed link to be followed. */
    stopEmail: () => void;
    /** The address a sign-in link was last sent to, to prefill the field with. */
    lastEmail: () => string;
    /** Whoever the referral link this browser came in on names, if anyone (looked up once). */
    loadReferrer: () => Promise<AuthPerson | undefined>;
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
    let referrer: Promise<AuthPerson | undefined> | undefined = undefined;
    // what the referral link's lookup came to, and whether a sign-up here stored a code
    let referralLookup: ReferralLookup = "pending";
    let codeFromForm = false;

    const failure = (key: string): AuthFailure => ({ reason: translate(key) });

    async function signIn(method: AuthMethod, wallet: string | undefined): Promise<SignedIn> {
        resumeSignIn();
        const signal = attempts.signal;
        client.gaTrack("initiated_signin", "registration", PROVIDERS[method]);
        const outcome = await client.signIn(await signInMethod(method, wallet, signal), signal);
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

    // a wallet signs the backend's sign-in message here first; the rest is the client's
    async function signInMethod(
        method: AuthMethod,
        wallet: string | undefined,
        signal: AbortSignal,
    ): Promise<SignInMethod> {
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

    return {
        wallets: {
            // the configured wallets and those the browser announces (EIP-6963), as the old UI
            // lists them; wagmi is loaded when Ethereum is picked
            eth: async () => (await import("./ethWallet")).ethWallets(),
            sol: WALLETS.sol,
        },
        termsUrl: "/terms",
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
            resp.signedIn.then((outcome) => {
                // signed in: nothing left to wait for, or to call cancelled
                if (emailLink === request) emailLink = undefined;
                if (outcome.kind === "logged_in") onEmailSignedIn?.("logged_in");
                if (outcome.kind === "needs_account") onEmailSignedIn?.("registering");
            });
            return { code: resp.code };
        },

        onCancelEmailLink() {
            // only a link still waited on is a cancel: not one that has signed in, nor a second
            // stop for the same link
            if (emailLink !== undefined) client.gaTrack("email_signin_cancelled", "registration");
            stopEmail();
        },

        lastEmail: () => localStorage.getItem(configKeys.selectedAuthEmail) ?? "",

        loadReferrer() {
            // without a referrer (none stored, or the lookup failed) sign-up offers none
            referrer ??= client.getReferringUser().then(
                (user) => {
                    referralLookup = user === undefined ? "none" : "found";
                    return user === undefined ? undefined : person(user);
                },
                () => {
                    referralLookup = "failed";
                    return undefined;
                },
            );
            return referrer;
        },

        async onSignup({
            username,
            email: recoveryEmail,
            referrerId,
            termsAccepted,
        }: SignupDetails) {
            resumeSignIn();
            const { signal } = signup;
            switch (referralCode(referrerId, referralLookup, codeFromForm)) {
                case "set":
                    client.setReferralCode(referrerId!);
                    codeFromForm = true;
                    break;
                case "clear":
                    client.clearReferralCode();
                    break;
            }
            // once the account is asked for it's made even if the dialog closes: a walk-away
            // waits for it
            const signingUp = client.signUp(username, recoveryEmail, termsAccepted, signal);
            registration = signingUp;
            const outcome = await signingUp.finally(() => {
                if (registration === signingUp) registration = undefined;
            });
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
            return (await client.searchUsers(query, 20)).map(person);
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

    function stopEmail() {
        emailRequest?.abort();
        emailRequest = undefined;
        emailLink?.abort();
        emailLink = undefined;
    }
}
