import {
    AuthProvider,
    identityStateStore,
    selectedAuthProviderStore,
    type OpenChat,
} from "@client";
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
import { EmailSigninHandler } from "@src/utils/signin";
import {
    createdUser,
    emailLinkFailureKey,
    emailLinkResult,
    onAuthClosed,
    person,
    registerFailureKey,
    PROVIDERS,
    signInOutcome,
    WALLETS,
    type SignedIn,
} from "./auth.adapter";

// AuthDialog's host callbacks, on the client's existing sign-in flows (onboard/SignIn.svelte and
// SignUp.svelte in the old UI). None of those flows returns a promise that settles on sign-in, so
// the callbacks settle on identityStateStore instead (DATA.md, Auth).

/**
 * Calls `settle` once with the first outcome that isn't "pending", skipping "failed" when
 * `anonFails` is off. That's from the current identity on, or with `fromNow` from the first
 * identity that differs from it. Returns a stop function.
 */
function watchSignIn(
    settle: (outcome: SignedIn | "failed") => void,
    { anonFails, fromNow = false }: { anonFails: boolean; fromNow?: boolean },
): () => void {
    let done = false;
    let unsubscribe: (() => void) | undefined = undefined;
    const startedAt = identityStateStore.value.kind;
    let changed = !fromNow;
    unsubscribe = identityStateStore.subscribe((state) => {
        changed ||= state.kind !== startedAt;
        if (!changed) return;
        const outcome = signInOutcome(state);
        if (done || outcome === "pending" || (outcome === "failed" && !anonFails)) return;
        done = true;
        unsubscribe?.();
        settle(outcome);
    });
    // the store calls back during subscribe, before `unsubscribe` was set
    if (done) unsubscribe();
    return () => {
        done = true;
        unsubscribe?.();
    };
}

/**
 * Runs `start`, then settles once the identity is signed in, or rejects when it falls back to
 * anonymous. `signal` gives it up, whether `start` has settled or not (a wallet's window the
 * person walked away from), and stops the watch.
 */
export function untilSignedIn(
    start: () => Promise<unknown> | void,
    signal?: AbortSignal,
): Promise<SignedIn> {
    return new Promise((resolve, reject) => {
        let stopWatch = () => {};
        const abandoned = () => {
            stopWatch();
            reject(new Error("Sign-in given up"));
        };
        if (signal?.aborted) return abandoned();
        signal?.addEventListener("abort", abandoned, { once: true });
        const settle = (outcome: SignedIn | "failed") => {
            signal?.removeEventListener("abort", abandoned);
            if (outcome === "failed") reject(new Error("Sign-in didn't complete"));
            else resolve(outcome);
        };
        let started: Promise<unknown>;
        try {
            started = Promise.resolve(start());
        } catch (err) {
            return reject(err);
        }
        started.then(
            () => {
                if (!signal?.aborted) stopWatch = watchSignIn(settle, { anonFails: true });
            },
            (err) => {
                signal?.removeEventListener("abort", abandoned);
                reject(err);
            },
        );
    });
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
    wallets: typeof WALLETS;
    termsUrl: string;
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
     * until the next sign-in starts.
     */
    cancel: () => void;
    /** The host is going: stops the email link and anything `cancel` left watching. */
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
    // the link being waited on: each request has its own handler, so a resend that fails leaves
    // the earlier link working, and one that's sent replaces it
    let emailLink: EmailSigninHandler | undefined = undefined;
    let stopEmailWatch = () => {};
    // each link request's number: stopping moves it on, so a link still being sent is dropped
    let emailRequests = 0;
    // each sign-up's number: cancelling moves it on, so the one in flight stops after its passkey
    let signups = 0;
    // the sign-ins the dialog is waiting on; cancelling gives them up
    let attempts = new AbortController();
    let referrer: Promise<AuthPerson | undefined> | undefined = undefined;
    // after a cancel, signs out an identity without an account that turns up
    let stopLeftBehind = () => {};

    const failure = (key: string): AuthFailure => ({ reason: translate(key) });

    function signIn(method: AuthMethod, wallet: string | undefined): Promise<SignedIn> {
        stopLeftBehind();
        const signal = attempts.signal;
        client.gaTrack("initiated_signin", "registration", PROVIDERS[method]);
        selectedAuthProviderStore.set(PROVIDERS[method]);
        switch (method) {
            case "passkey":
                return untilSignedIn(() => client.signInWithWebAuthn(), signal);
            case "eth":
                return untilSignedIn(async () => {
                    const { signInWithEthereum } = await import("./ethWallet");
                    await signInWithEthereum(client, wallet ?? WALLETS.eth[0].id);
                }, signal);
            case "sol":
                return untilSignedIn(async () => {
                    const { signInWithSolana } = await import("./solWallet");
                    await signInWithSolana(client, wallet ?? WALLETS.sol[0].id);
                }, signal);
            default:
                // Internet Identity and NFID open the auth client's window
                return untilSignedIn(() => client.login(), signal);
        }
    }

    return {
        wallets: WALLETS,
        termsUrl: "/terms",

        // sign-up is the form (onSignup); every method signs in, and an identity without an
        // account goes on to the form from there (identityStateStore "registering")
        onMethod: (method, _kind, wallet) => signIn(method, wallet),

        async onRequestEmailLink(address): Promise<EmailLinkSent> {
            stopLeftBehind();
            const request = ++emailRequests;
            client.gaTrack("initiated_signin", "registration", AuthProvider.EMAIL);
            localStorage.setItem(configKeys.selectedAuthEmail, address);
            selectedAuthProviderStore.set(AuthProvider.EMAIL);
            const handler = new EmailSigninHandler(client, "registration", true);
            const resp = await handler.generateMagicLink(address);
            if (request !== emailRequests) {
                // stopped while it was being sent (the dialog closed)
                handler.stopPolling();
                throw new Error("Email link given up");
            }
            // a link that couldn't be sent leaves an earlier one working
            if (resp.kind !== "success") throw failure(emailLinkFailureKey(resp.kind));
            emailLink?.stopPolling();
            emailLink = handler;
            // the person follows the link on another page, and this one signs in when the poller
            // hears of it. Until then the identity can sit at anonymous, or at an identity
            // without an account from an earlier try, which isn't the link's
            stopEmailWatch();
            stopEmailWatch = watchSignIn(
                (outcome) => {
                    if (outcome !== "failed") onEmailSignedIn?.(outcome);
                },
                { anonFails: false, fromNow: true },
            );
            return { code: resp.code };
        },

        onCancelEmailLink() {
            client.gaTrack("email_signin_cancelled", "registration");
            stopEmail();
        },

        lastEmail: () => localStorage.getItem(configKeys.selectedAuthEmail) ?? "",

        loadReferrer() {
            // without a referrer (none stored, or the lookup failed) sign-up offers none
            referrer ??= client
                .getReferringUser()
                .catch(() => undefined)
                .then((user) => (user === undefined ? undefined : person(user)));
            return referrer;
        },

        async onSignup({ username, email: recoveryEmail, referrerId }: SignupDetails) {
            // the stored code is whoever the form has, so a removed referrer, or a referral link's
            // code that names no one, isn't sent
            stopLeftBehind();
            const signup = ++signups;
            if (referrerId !== undefined) {
                client.setReferralCode(referrerId);
            } else {
                client.clearReferralCode();
            }
            selectedAuthProviderStore.set(AuthProvider.PASSKEY);
            // an identity without an account (signed in some other way, or a passkey made on an
            // earlier try) only needs the account; otherwise the passkey comes first
            if (identityStateStore.value.kind !== "registering") {
                await client.signUpWithWebAuthn(true, username);
            }
            if (signup !== signups) throw new Error("Sign-up cancelled");
            const resp = await client.registerUser(username, recoveryEmail);
            if (resp.kind !== "success") {
                const key = registerFailureKey(resp.kind);
                throw key === undefined
                    ? new Error(`Couldn't register: ${resp.kind}`)
                    : failure(key);
            }
            client.onRegisteredUser(createdUser(username, resp));
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
            signups++;
            attempts.abort();
            attempts = new AbortController();
            if (onAuthClosed(identityStateStore.value) === "anon") {
                client.updateIdentityState({ kind: "anon" });
            }
            stopLeftBehind();
            stopLeftBehind = watchSignIn(
                (outcome) => {
                    if (outcome === "registering") client.logout();
                },
                { anonFails: false },
            );
        },

        dispose() {
            stopEmail();
            stopLeftBehind();
        },
    };

    function stopEmail() {
        emailRequests++;
        stopEmailWatch();
        emailLink?.stopPolling();
        emailLink = undefined;
    }
}
