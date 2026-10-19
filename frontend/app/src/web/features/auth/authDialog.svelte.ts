import { identityStateStore, type AuthProvider } from "@client";
import type { AuthPerson } from "@openchat/ui/src/features/components/AuthDialog.svelte";
import type { PageAuth } from "@openchat/ui/src/pages/pageAuth.svelte";
import { authOptions, withoutAccount } from "./auth.adapter";
import type { Auth } from "./signIn";

/**
 * AuthDialog's props for one host, all but `kind` and `onClose`: the same for the app's
 * AuthScreen and for Landing and Learn (their PageAuth), so the two can't drift apart. Hosts
 * call `opening` as the dialog opens.
 */
export class AuthDialogProps {
    #referrer = $state<AuthPerson | undefined>(undefined);
    #referrerAsked = false;
    // AuthDialog only reads it as it mounts, so it's read as the dialog opens
    #email = $state("");

    constructor(private readonly auth: Auth) {}

    /**
     * The dialog is opening: reads the address a link last went to, and looks up the referral
     * link's referrer the first time (not on every visit to a page that never opens it).
     */
    opening(): void {
        this.#email = this.auth.lastEmail();
        if (this.#referrerAsked) return;
        this.#referrerAsked = true;
        this.auth.loadReferrer().then((person) => (this.#referrer = person));
    }

    /**
     * The methods `?auth=` (`restrictTo`) and the browser allow, `last` first. Hosts read `last`
     * as the dialog opens rather than live: starting a method makes it the last one used, and the
     * tiles mustn't move under the cursor.
     */
    props(restrictTo: string[], last: AuthProvider): PageAuth {
        const auth = this.auth;
        const methods = authOptions(restrictTo, "PublicKeyCredential" in window, last);
        return {
            methods,
            // sign-up's form makes a passkey: without one on offer, a new person signs in another
            // way and gets the form from there
            passkeySignup: methods.includes("passkey"),
            email: this.#email,
            referrer: this.#referrer,
            wallets: auth.wallets,
            termsUrl: auth.termsUrl,
            checkUsername: auth.checkUsername,
            searchReferrers: auth.searchReferrers,
            onMethod: auth.onMethod,
            onRequestEmailLink: auth.onRequestEmailLink,
            onCancelEmailLink: auth.onCancelEmailLink,
            onSignup: auth.onSignup,
        };
    }
}

/**
 * Sign-ins and sign-ups going on in a marketing page's own dialog. While one is, "/" keeps
 * showing Landing (RouteScreen), so that dialog sees it through: otherwise the identity leaving
 * "anon" would swap the page for the app mid-flow. So does a sign-up that failed there leaving an
 * identity without an account, whose dialog says why (showsSignedOut).
 */
class PageSignIns {
    pending = $state(0);
    signupFailed = $state(false);
    // an email link the page asked for and waits on: from the request until it signs in, is
    // given up, or the dialog closes
    awaitingEmail = $state(false);
    // closing the dialog moves it on: what an attempt from before then comes to isn't a failure
    #dialog = 0;

    track<T>(call: Promise<T>, { signup = false } = {}): Promise<T> {
        const dialog = this.#dialog;
        this.pending++;
        this.started();
        return call
            .catch((err) => {
                // a sign-up that failed before its passkey left nothing behind to keep Landing for
                if (dialog === this.#dialog) {
                    this.signupFailed = signup && withoutAccount(identityStateStore.value);
                }
                throw err;
            })
            .finally(() => this.pending--);
    }

    /** Whether the page is seeing a sign-in through: one it waits on, or an email link. */
    get signingIn(): boolean {
        return this.pending > 0 || this.awaitingEmail;
    }

    /** A new attempt on the page: any failure is past. */
    started(): void {
        this.signupFailed = false;
    }

    /**
     * An email link asked for: a new attempt, which the page waits on from the request (an
     * identity left by a failed sign-up mustn't swap Landing for the app meanwhile). A request
     * that fails leaves the page waiting on the link before it, if there was one.
     */
    trackEmail<T>(request: Promise<T>): Promise<T> {
        const dialog = this.#dialog;
        const before = this.awaitingEmail;
        this.started();
        this.awaitingEmail = true;
        return request.catch((err) => {
            if (dialog === this.#dialog) this.awaitingEmail = before;
            throw err;
        });
    }

    /** The email link signed in, or was given up: the page no longer waits on it. */
    emailDone(): void {
        this.awaitingEmail = false;
    }

    /**
     * The dialog was closed: what its attempts come to from now on isn't a failure of the page's.
     * A failed sign-up whose identity has no account still keeps Landing up: closing signs it out
     * (and the page reloads), and until then "/" mustn't show the app for it.
     */
    closed(): void {
        this.#dialog++;
        this.awaitingEmail = false;
        if (!withoutAccount(identityStateStore.value)) this.signupFailed = false;
    }

    /**
     * The page is going: whether it leaves a sign-in going or a failed sign-up behind (which the
     * host then walks away from, as on a close).
     */
    left(): boolean {
        const leftBehind = this.signingIn || this.signupFailed;
        this.closed();
        return leftBehind;
    }
}

export const pageSignIns = new PageSignIns();
