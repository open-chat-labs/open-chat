// A username being typed, checked with the backend as it changes: the profile form's and sign-up's,
// in every tree. The check waits for typing to pause, and only the latest one counts.

import { isUsernameValid, type OpenChat } from "@client";

const CHECK_DELAY_MS = 350;

// unchanged: the name it started from (the saved one, or sign-up's last try), not checked again.
// invalid: not a username, or the backend said it can't be one. checking: waiting for the backend.
export type UsernameStatus =
    | "unchanged"
    | "invalid"
    | "checking"
    | "available"
    | "taken"
    | "check_failed";

export class UsernameCheck {
    #client: Pick<OpenChat, "checkUsername" | "logError">;
    #original: () => string;
    #ownName: boolean;
    // undefined: the original, which may change underneath (a save, the profile loading)
    #value = $state<string>();
    #timer: ReturnType<typeof setTimeout> | undefined;
    // only the latest check counts
    #run = 0;

    status = $state<UsernameStatus>("unchanged");

    /**
     * `original` is the name the check starts from. `ownName` says it's the user's own, as on the
     * profile (not sign-up's last try, which may have been turned down): then a change of case
     * alone is theirs to make, without asking the backend.
     */
    constructor(
        client: Pick<OpenChat, "checkUsername" | "logError">,
        original: () => string,
        { ownName }: { ownName: boolean },
    ) {
        this.#client = client;
        this.#original = original;
        this.#ownName = ownName;
    }

    get value(): string {
        return this.#value ?? this.#original();
    }

    get valid(): boolean {
        switch (this.status) {
            case "unchanged":
                return this.value.length > 0;
            case "available":
                return true;
            default:
                return false;
        }
    }

    get checking(): boolean {
        return this.status === "checking";
    }

    /** Why the name can't be used, as an i18n key, when the user can do something about it. */
    get error(): string | undefined {
        switch (this.status) {
            case "taken":
                return "register.usernameTaken";
            case "check_failed":
                return "register.errorCheckingUsername";
            default:
                return undefined;
        }
    }

    set(value: string): void {
        this.#cancel();
        const original = this.#original();
        if (value === original) {
            this.#value = undefined;
            this.status = "unchanged";
            return;
        }
        this.#value = value;
        // the user's own name in another case: theirs, even if it's shorter than the rules now ask
        // (3 characters, say), so there's nothing to ask the backend
        if (this.#ownName && value.toLowerCase() === original.toLowerCase()) {
            this.status = "available";
            return;
        }
        if (!isUsernameValid(value)) {
            this.status = "invalid";
            return;
        }
        this.status = "checking";
        const run = this.#run;
        this.#timer = setTimeout(() => this.#check(value, run), CHECK_DELAY_MS);
    }

    /** Back to the original, as after it's saved. */
    reset(): void {
        this.#cancel();
        this.#value = undefined;
        this.status = "unchanged";
    }

    destroy(): void {
        this.#cancel();
    }

    #cancel(): void {
        clearTimeout(this.#timer);
        this.#run++;
    }

    async #check(value: string, run: number): Promise<void> {
        try {
            const resp = await this.#client.checkUsername(value, false);
            if (run !== this.#run) return;
            if (resp === "success") {
                this.status = "available";
            } else {
                this.status = resp === "username_taken" ? "taken" : "invalid";
            }
        } catch (err) {
            if (run !== this.#run) return;
            this.status = "check_failed";
            this.#client.logError("Unable to check username: ", err);
        }
    }
}
