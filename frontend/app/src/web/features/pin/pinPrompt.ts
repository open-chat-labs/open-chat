import type { PinNumberResolver, RulesAcceptanceResolver } from "@shared";

// The prompts the client waits on while it sends: a chat's rules to accept, then the user's PIN
// (pinNumberResolverStore), as the old UIs' Home answered them.

export const PIN_LENGTH = 6;

export type WaitingPrompt =
    | { kind: "none" }
    | { kind: "rules"; request: RulesAcceptanceResolver }
    | { kind: "pin"; request: PinNumberResolver };

/** The prompt to show: the rules come first, and no PIN prompt shows while they're waiting. */
export function waitingPrompt(
    rules: RulesAcceptanceResolver | undefined,
    pin: PinNumberResolver | undefined,
): WaitingPrompt {
    if (rules !== undefined) return { kind: "rules", request: rules };
    if (pin !== undefined) return { kind: "pin", request: pin };
    return { kind: "none" };
}

/**
 * One waiting PIN request's answer. Six digits resolve it and closing rejects it (the client then
 * gives the transfer up), whichever comes first: it's answered once.
 */
export class PinAnswer {
    #request: PinNumberResolver;
    #answered = false;

    constructor(request: PinNumberResolver) {
        this.#request = request;
    }

    /** Resolves the request with `pin`, if it's six digits and the request is still waiting. */
    enter(pin: string): boolean {
        if (this.#answered || !new RegExp(`^[0-9]{${PIN_LENGTH}}$`).test(pin)) return false;
        this.#answered = true;
        this.#request.resolve(pin);
        return true;
    }

    /** Rejects the request, if it's still waiting. */
    close(): void {
        if (this.#answered) return;
        this.#answered = true;
        this.#request.reject();
    }
}
