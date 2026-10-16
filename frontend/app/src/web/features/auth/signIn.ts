import {
    AuthProvider,
    identityStateStore,
    selectedAuthProviderStore,
    type OpenChat,
} from "@client";
import type {
    AuthMethod,
    EmailLinkResult,
    EmailLinkSent,
    SignupDetails,
} from "@openchat/ui/src/features/components/AuthDialog.svelte";
import type { PageAuth } from "@openchat/ui/src/pages/pageAuth.svelte";
import { EmailSigninHandler } from "@src/utils/signin";
import {
    createdUser,
    emailLinkResult,
    person,
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
        "onMethod" | "onSignup" | "onRequestEmailLink" | "checkUsername" | "searchReferrers"
    >
> & {
    wallets: typeof WALLETS;
    termsUrl: string;
    /** The email link page's code: completes the sign-in the link belongs to. */
    onLinkCode: (querystring: string, code: string) => Promise<EmailLinkResult>;
    /** Stops waiting for an emailed link to be followed. */
    stopEmail: () => void;
};

/**
 * The sign-in callbacks for one AuthDialog host. `onEmailSignedIn` runs when a link sent from
 * this host signs the person in (it's followed on another page, so nothing else here settles).
 */
export function createAuth(client: OpenChat, onEmailSignedIn?: (outcome: SignedIn) => void): Auth {
    const email = new EmailSigninHandler(client, "registration", true);
    let stopEmailWatch = () => {};

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
            selectedAuthProviderStore.set(AuthProvider.EMAIL);
            const resp = await email.generateMagicLink(address);
            if (resp.kind !== "success")
                throw new Error(`Couldn't send the sign-in link: ${resp.kind}`);
            // the person follows the link on another page, and this one signs in when the poller
            // hears of it. Until then the identity can sit at anonymous.
            stopEmailWatch = watchSignIn((outcome) => {
                if (outcome !== "failed") onEmailSignedIn?.(outcome);
            }, false);
            return { code: resp.code };
        },

        async onSignup({ username, email: recoveryEmail, referrerId }: SignupDetails) {
            if (referrerId !== undefined) client.setReferralCode(referrerId);
            selectedAuthProviderStore.set(AuthProvider.PASSKEY);
            // an identity without an account (signed in some other way, or a passkey made on an
            // earlier try) only needs the account; otherwise the passkey comes first
            if (identityStateStore.value.kind !== "registering") {
                await client.signUpWithWebAuthn(true, username);
            }
            const resp = await client.registerUser(username, recoveryEmail);
            if (resp.kind !== "success") throw new Error(`Couldn't register: ${resp.kind}`);
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
