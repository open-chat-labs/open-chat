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
 * Calls `settle` once with the first outcome that isn't "pending" (from the current identity on),
 * skipping "failed" when `anonFails` is off. Returns a stop function.
 */
function watchSignIn(
    settle: (outcome: SignedIn | "failed") => void,
    anonFails: boolean,
): () => void {
    let done = false;
    let unsubscribe: (() => void) | undefined = undefined;
    unsubscribe = identityStateStore.subscribe((state) => {
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

/** Runs `start`, then settles once the identity is signed in, or rejects when it falls back to anonymous. */
export async function untilSignedIn(start: () => Promise<unknown> | void): Promise<SignedIn> {
    await start();
    return new Promise((resolve, reject) => {
        watchSignIn((outcome) => {
            if (outcome === "failed") reject(new Error("Sign-in didn't complete"));
            else resolve(outcome);
        }, true);
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
    /** Whoever the referral link this browser came in on names, if anyone. */
    loadReferrer: () => Promise<AuthPerson | undefined>;
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
    const email = new EmailSigninHandler(client, "registration", true);
    let stopEmailWatch = () => {};
    // the referrer the dialog was given: if sign-up comes back without one, it was removed
    let offeredReferrer: string | undefined = undefined;

    const failure = (key: string): AuthFailure => ({ reason: translate(key) });

    function signIn(method: AuthMethod, wallet: string | undefined): Promise<SignedIn> {
        client.gaTrack("initiated_signin", "registration", PROVIDERS[method]);
        selectedAuthProviderStore.set(PROVIDERS[method]);
        switch (method) {
            case "passkey":
                return untilSignedIn(() => client.signInWithWebAuthn());
            case "eth":
                return untilSignedIn(async () => {
                    const { signInWithEthereum } = await import("./ethWallet");
                    await signInWithEthereum(client, wallet ?? WALLETS.eth[0].id);
                });
            case "sol":
                return untilSignedIn(async () => {
                    const { signInWithSolana } = await import("./solWallet");
                    await signInWithSolana(client, wallet ?? WALLETS.sol[0].id);
                });
            default:
                // Internet Identity and NFID open the auth client's window
                return untilSignedIn(() => client.login());
        }
    }

    return {
        wallets: WALLETS,
        termsUrl: "/terms",

        // sign-up is the form (onSignup); every method signs in, and an identity without an
        // account goes on to the form from there (identityStateStore "registering")
        onMethod: (method, _kind, wallet) => signIn(method, wallet),

        async onRequestEmailLink(address): Promise<EmailLinkSent> {
            stopEmail();
            client.gaTrack("initiated_signin", "registration", AuthProvider.EMAIL);
            localStorage.setItem(configKeys.selectedAuthEmail, address);
            selectedAuthProviderStore.set(AuthProvider.EMAIL);
            const resp = await email.generateMagicLink(address);
            if (resp.kind !== "success") throw failure(emailLinkFailureKey(resp.kind));
            // the person follows the link on another page, and this one signs in when the poller
            // hears of it. Until then the identity can sit at anonymous.
            stopEmailWatch = watchSignIn((outcome) => {
                if (outcome !== "failed") onEmailSignedIn?.(outcome);
            }, false);
            return { code: resp.code };
        },

        onCancelEmailLink() {
            client.gaTrack("email_signin_cancelled", "registration");
            stopEmail();
        },

        lastEmail: () => localStorage.getItem(configKeys.selectedAuthEmail) ?? "",

        async loadReferrer() {
            const user = await client.getReferringUser();
            offeredReferrer = user?.userId;
            return user === undefined ? undefined : person(user);
        },

        async onSignup({ username, email: recoveryEmail, referrerId }: SignupDetails) {
            if (referrerId !== undefined) {
                client.setReferralCode(referrerId);
            } else if (offeredReferrer !== undefined) {
                client.clearReferralCode();
                offeredReferrer = undefined;
            }
            selectedAuthProviderStore.set(AuthProvider.PASSKEY);
            // an identity without an account (signed in some other way, or a passkey made on an
            // earlier try) only needs the account; otherwise the passkey comes first
            if (identityStateStore.value.kind !== "registering") {
                await client.signUpWithWebAuthn(true, username);
            }
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
    };

    function stopEmail() {
        stopEmailWatch();
        email.stopPolling();
    }
}
