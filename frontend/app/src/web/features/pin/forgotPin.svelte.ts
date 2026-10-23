import { pinNumberFailureStore, type OpenChat, type ResourceKey } from "@client";
import { PinNumberForm, type PinSaveOutcome } from "@src/logic/pin/pinNumberForm.svelte";
import { SignInAgain } from "../auth/signInAgain.svelte";

// "I've forgotten my pin" while the client waits for one, as the old UIs' SetPinNumberModal in
// { kind: "forgot", while: { kind: "enter" } }: sign in again (SignInAgain, through the client's
// reAuthenticate), then choose a new pin, which answers the waiting request. PinNumberForm does
// the resetting, and never without the sign-in's proof.

export class ForgotPin {
    readonly form: PinNumberForm;
    readonly signIn: SignInAgain;

    constructor(client: OpenChat, translate: (key: ResourceKey) => string) {
        pinNumberFailureStore.set(undefined);
        this.form = new PinNumberForm(client, { kind: "forgot", while: { kind: "enter" } });
        this.signIn = new SignInAgain(client, translate, async (outcome) => {
            await this.form.reauthenticated(outcome.signInProofJwt);
            return this.form.error;
        });
    }

    /** Signed in again: the user goes on to choose a new pin. */
    get signedIn(): boolean {
        return this.form.operation.kind !== "forgot";
    }

    /** Closing: stops waiting on a sign-in or an emailed link. */
    dispose = (): void => {
        this.signIn.dispose();
    };

    /** Saves the new pin; `saved` carries it, to answer the waiting request with. */
    save(): Promise<PinSaveOutcome> {
        return this.form.save();
    }
}
