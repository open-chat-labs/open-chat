import {
    pinNumberFailureStore,
    selectedAuthProviderStore,
    type OpenChat,
    type ReAuthOutcome,
    type ResourceKey,
} from "@client";
import { configKeys } from "@shared";
import type {
    AuthFailure,
    AuthMethod,
    EmailLinkSent,
} from "@openchat/ui/src/features/components/AuthDialog.svelte";
import { PinNumberForm, type PinSaveOutcome } from "@src/logic/pin/pinNumberForm.svelte";
import { signInMethod } from "../auth/signIn";

// "I've forgotten my pin" while the client waits for one, as the old UIs' SetPinNumberModal in
// { kind: "forgot", while: { kind: "enter" } }: sign in again (AuthDialog, through the client's
// reAuthenticate), then choose a new pin, which answers the waiting request. PinNumberForm does
// the resetting, and never without the sign-in's proof.

export class ForgotPin {
    #client: OpenChat;
    #translate: (key: ResourceKey) => string;
    // the sign-ins and the emailed link being waited on; dispose gives them up
    #attempts = new AbortController();

    readonly form: PinNumberForm;
    // why a sign-in through an emailed link failed, once the dialog had stopped waiting on it
    linkFailure = $state<string>();
    // a new AuthDialog after such a failure, back at its choices
    attempt = $state(0);

    constructor(client: OpenChat, translate: (key: ResourceKey) => string) {
        this.#client = client;
        this.#translate = translate;
        pinNumberFailureStore.set(undefined);
        this.form = new PinNumberForm(client, { kind: "forgot", while: { kind: "enter" } });
    }

    /** Signed in again: the user goes on to choose a new pin. */
    get signedIn(): boolean {
        return this.form.operation.kind !== "forgot";
    }

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

    /** Saves the new pin; `saved` carries it, to answer the waiting request with. */
    save(): Promise<PinSaveOutcome> {
        return this.form.save();
    }

    lastEmail(): string {
        return localStorage.getItem(configKeys.selectedAuthEmail) ?? "";
    }

    async #followed(reAuthenticated: Promise<ReAuthOutcome>): Promise<void> {
        try {
            await this.#reAuthenticated(await reAuthenticated);
        } catch (err) {
            if (isAuthFailure(err)) {
                this.linkFailure = err.reason;
                this.attempt++;
            }
        }
    }

    async #reAuthenticated(outcome: ReAuthOutcome): Promise<void> {
        switch (outcome.kind) {
            case "cancelled":
                throw new Error("Sign-in given up");
            case "failed":
                throw this.#failure(outcome.reason);
            case "success":
                // the way the user last signed in, as the old trees' sign-in again records it
                selectedAuthProviderStore.set(outcome.provider);
                await this.form.reauthenticated(outcome.signInProofJwt);
                if (this.form.error !== undefined) throw this.#failure(this.form.error);
        }
    }

    #failure(reason: ResourceKey): AuthFailure {
        return { reason: this.#translate(reason) };
    }
}

function isAuthFailure(err: unknown): err is AuthFailure {
    return typeof err === "object" && err !== null && "reason" in err;
}
