import {
    selectedAuthProviderStore,
    type AuthProvider,
    type OpenChat,
    type ReAuthOutcome,
    type ResourceKey,
} from "@client";
import type {
    AuthFailure,
    AuthMethod,
    EmailLinkSent,
} from "@openchat/ui/src/features/components/AuthDialog.svelte";
import type { ReAuthSuccess } from "@src/logic/auth/reAuthentication.svelte";
import { configKeys } from "@shared";
import { i18nKey } from "@src/i18n/i18n";
import { signInMethod } from "./signIn";

// Signing in again to prove it's the user, in AuthDialog (SignInAgainDialog): before resetting a
// forgotten pin, before deleting the account. The client signs in (reAuthenticate) and refuses
// another account; `signedIn` is what proving it was for, and may say why that then failed.

export type SignedIn = (outcome: ReAuthSuccess) => Promise<ResourceKey | undefined>;

export class SignInAgain {
    #client: OpenChat;
    #translate: (key: ResourceKey) => string;
    #signedIn: SignedIn;
    // the sign-ins and the emailed link being waited on; dispose gives them up
    #attempts = new AbortController();

    // the ways to offer: those linked to the account, or all of them until that's known
    providers = $state<Set<AuthProvider>>(new Set());
    // why a sign-in through an emailed link failed, once the dialog had stopped waiting on it
    linkFailure = $state<string>();
    // a new AuthDialog after such a failure, back at its choices
    attempt = $state(0);

    constructor(client: OpenChat, translate: (key: ResourceKey) => string, signedIn: SignedIn) {
        this.#client = client;
        this.#translate = translate;
        this.#signedIn = signedIn;
    }

    /** The dialog is opening: finds out which ways to offer. */
    loadProviders = async (): Promise<void> => {
        this.providers = await this.#client.reAuthProviders();
    };

    /** AuthDialog's onMethod: signs in again; rejects with the reason it didn't. */
    onMethod = async (method: AuthMethod, _kind: unknown, wallet?: string): Promise<void> => {
        const signal = this.#attempts.signal;
        const how = await signInMethod(this.#client, method, wallet, signal);
        await this.#reAuthenticated(await this.#client.reAuthenticate(how, signal));
    };

    /** AuthDialog's onRequestEmailLink: the link signs in again once it's followed. */
    onRequestEmailLink = async (email: string): Promise<EmailLinkSent> => {
        localStorage.setItem(configKeys.selectedAuthEmail, email);
        this.linkFailure = undefined;
        const resp = await this.#client.requestEmailReAuthentication(email, this.#attempts.signal);
        if (resp.kind === "cancelled") throw new Error("Email link given up");
        if (resp.kind === "failed") throw this.#failure(resp.reason);
        this.#followed(resp.reAuthenticated);
        return { code: resp.code };
    };

    /** AuthDialog's onCancelEmailLink, and closing: stops waiting on anything. */
    dispose = (): void => {
        this.#attempts.abort();
        this.#attempts = new AbortController();
    };

    lastEmail(): string {
        return localStorage.getItem(configKeys.selectedAuthEmail) ?? "";
    }

    // the dialog has stopped waiting on the link, so whatever goes wrong is said here and the dialog
    // starts over; otherwise it would sit on "check your inbox" for good
    async #followed(reAuthenticated: Promise<ReAuthOutcome>): Promise<void> {
        try {
            await this.#reAuthenticated(await reAuthenticated);
        } catch (err) {
            if (err instanceof GivenUp) return;
            this.linkFailure = isAuthFailure(err)
                ? err.reason
                : this.#translate(i18nKey("identity.failure.unexpectedError"));
            this.attempt++;
        }
    }

    async #reAuthenticated(outcome: ReAuthOutcome): Promise<void> {
        switch (outcome.kind) {
            case "cancelled":
                throw new GivenUp();
            case "failed":
                throw this.#failure(outcome.reason);
            case "success": {
                // the way the user last signed in, as the old trees' sign-in again records it
                selectedAuthProviderStore.set(outcome.provider);
                const failure = await this.#signedIn(outcome);
                if (failure !== undefined) throw this.#failure(failure);
            }
        }
    }

    #failure(reason: ResourceKey): AuthFailure {
        return { reason: this.#translate(reason) };
    }
}

// the user gave the sign-in up: nothing to say
class GivenUp extends Error {
    constructor() {
        super("Sign-in given up");
    }
}

function isAuthFailure(err: unknown): err is AuthFailure {
    return typeof err === "object" && err !== null && "reason" in err;
}
