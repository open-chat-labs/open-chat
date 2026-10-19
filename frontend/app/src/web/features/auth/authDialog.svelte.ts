import type { AuthProvider } from "@client";
import type { AuthPerson } from "@openchat/ui/src/features/components/AuthDialog.svelte";
import type { PageAuth } from "@openchat/ui/src/pages/pageAuth.svelte";
import { authOptions } from "./auth.adapter";
import type { Auth } from "./signIn";

/**
 * AuthDialog's props for one host, all but `kind` and `onClose`: the same for the app's
 * AuthScreen and for Landing and Learn (their PageAuth), so the two can't drift apart. It reads
 * the referral link's referrer once, when it's made.
 */
export class AuthDialogProps {
    #referrer = $state<AuthPerson | undefined>(undefined);
    // read when the dialog is made and again as it opens (refresh): AuthDialog only reads it then
    #email = $state("");

    constructor(private readonly auth: Auth) {
        this.#email = auth.lastEmail();
        auth.loadReferrer().then((person) => (this.#referrer = person));
    }

    /** Reads what may have changed since the dialog last opened: the address a link went to. */
    refresh(): void {
        this.#email = this.auth.lastEmail();
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
 * "anon" would swap the page for the app mid-flow. So does a sign-up that failed there, whose
 * dialog says why (showsSignedOut).
 */
class PageSignIns {
    pending = $state(0);
    signupFailed = $state(false);
    // closing the dialog moves it on: what an attempt from before then comes to isn't a failure
    #dialog = 0;

    track<T>(call: Promise<T>, { signup = false } = {}): Promise<T> {
        const dialog = this.#dialog;
        this.pending++;
        this.signupFailed = false;
        return call
            .catch((err) => {
                if (dialog === this.#dialog) this.signupFailed = signup;
                throw err;
            })
            .finally(() => this.pending--);
    }

    /** The dialog was closed: a failed sign-up no longer keeps Landing. */
    closed(): void {
        this.#dialog++;
        this.signupFailed = false;
    }

    /**
     * The page is going: whether it leaves a sign-in going or a failed sign-up behind, which it
     * then forgets, as on a close.
     */
    left(): boolean {
        const leftBehind = this.pending > 0 || this.signupFailed;
        this.closed();
        return leftBehind;
    }
}

export const pageSignIns = new PageSignIns();
