// The state and logic for setting, changing, clearing and resetting a pin number, so that the
// components in both trees can be as purely presentational as possible. It returns outcomes; each
// tree shows them.

import type { OpenChat, ResourceKey, SetPinNumberResponse, Verification } from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { supportsForgot, type PinOperation } from "@src/stores/pinNumber";

export type PinSaveOutcome =
    | { kind: "saved"; operation: "set" | "clear" | "change"; pin: string | undefined }
    | { kind: "failed" };

function isPinValid(pin: string[]): boolean {
    return pin.filter((c) => /^[0-9]$/.test(c)).length === 6;
}

export class PinNumberForm {
    #client: OpenChat;
    // Proof that the user has just signed in again, which stands in for a pin they've forgotten
    #signInProofJwt = $state<string>();

    operation = $state<PinOperation>({ kind: "set" });
    currentPin = $state<string[]>([]);
    newPin = $state<string[]>([]);
    busy = $state(false);
    // Why signing in again didn't let the user reset their pin
    error = $state<ResourceKey>();

    constructor(client: OpenChat, operation: PinOperation) {
        this.#client = client;
        this.operation = operation;
    }

    get showCurrentPin(): boolean {
        return this.operation.kind !== "set" && this.#signInProofJwt === undefined;
    }

    get valid(): boolean {
        const verified = isPinValid(this.currentPin) || this.#signInProofJwt !== undefined;
        switch (this.operation.kind) {
            case "forgot":
                return true;
            case "set":
                return isPinValid(this.newPin);
            case "change":
                return verified && isPinValid(this.newPin);
            case "clear":
                return verified;
            case "enter":
                return false;
        }
    }

    // How the user proves they may make the change, or undefined if they haven't
    #verification(): Verification | undefined {
        if (this.#signInProofJwt !== undefined) {
            return { kind: "reauthenticated", signInProofJwt: this.#signInProofJwt };
        }
        switch (this.operation.kind) {
            case "clear":
            case "change":
                // a wrong pin counts towards locking the user out, so never send one that can't
                // be theirs
                return isPinValid(this.currentPin)
                    ? { kind: "pin_verification", pin: this.currentPin.join("") }
                    : undefined;
            default:
                return { kind: "no_verification" };
        }
    }

    async save(): Promise<PinSaveOutcome> {
        const operation = this.operation.kind;
        if (operation !== "set" && operation !== "clear" && operation !== "change") {
            return { kind: "failed" };
        }
        const verification = this.#verification();
        if (verification === undefined) return { kind: "failed" };
        const pin = operation === "clear" ? undefined : this.newPin.join("");

        this.busy = true;
        let resp: SetPinNumberResponse;
        try {
            resp = await this.#client.setPinNumber(verification, pin);
        } catch (err) {
            console.log("SetPinNumber failed", err);
            return { kind: "failed" };
        } finally {
            this.busy = false;
        }
        if (resp.kind !== "success") {
            // a pin failure shows through pinNumberErrorMessageStore
            console.log("SetPinNumber failed", resp);
            return { kind: "failed" };
        }
        return { kind: "saved", operation, pin };
    }

    /**
     * The user signed in again to reset a pin they've forgotten. Clearing needs nothing more, so
     * it goes straight away; otherwise the user goes on to choose a new pin. A sign-in that gave
     * no proof can't reset anything, so the user is told and nothing is sent.
     */
    async reauthenticated(signInProofJwt: string | undefined): Promise<PinSaveOutcome | undefined> {
        if (this.operation.kind !== "forgot") return;
        if (signInProofJwt === undefined) {
            this.error = i18nKey("identity.failure.unexpectedError");
            return;
        }
        this.error = undefined;
        this.#signInProofJwt = signInProofJwt;
        if (this.operation.while.kind === "clear") {
            this.operation = { kind: "clear" };
            return this.save();
        }
        this.operation = { kind: "change" };
    }

    forgot() {
        if (supportsForgot(this.operation)) {
            this.error = undefined;
            this.operation = { kind: "forgot", while: this.operation };
        }
    }
}
