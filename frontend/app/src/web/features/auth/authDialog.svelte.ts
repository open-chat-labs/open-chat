import type { AuthProvider } from "@client";
import type { AuthPerson } from "@openchat/ui/src/features/components/AuthDialog.svelte";
import type { PageAuth } from "@openchat/ui/src/pages/pageAuth.svelte";
import { authOptions } from "./auth.adapter";
import type { Auth } from "./signIn";

/**
 * AuthDialog's props for one host, all but `kind` and `onClose`: the same for the app's
 * AuthScreen and for Landing and Learn (their PageAuth), so the two can't drift apart. It reads
 * the referral link's referrer, and the method last used, once, when it's made: a method that's
 * started becomes the last one used, and the tiles mustn't move under the cursor.
 */
export class AuthDialogProps {
    #referrer = $state<AuthPerson | undefined>(undefined);

    constructor(
        private readonly auth: Auth,
        private readonly last: AuthProvider,
    ) {
        auth.loadReferrer().then((person) => (this.#referrer = person));
    }

    /** The methods `?auth=` (`restrictTo`) and the browser allow, the one last used first. */
    props(restrictTo: string[]): PageAuth {
        const auth = this.auth;
        return {
            methods: authOptions(restrictTo, "PublicKeyCredential" in window, this.last),
            email: auth.lastEmail(),
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

    track<T>(call: Promise<T>, { signup = false } = {}): Promise<T> {
        this.pending++;
        this.signupFailed = false;
        return call
            .catch((err) => {
                this.signupFailed = signup;
                throw err;
            })
            .finally(() => this.pending--);
    }
}

export const pageSignIns = new PageSignIns();
