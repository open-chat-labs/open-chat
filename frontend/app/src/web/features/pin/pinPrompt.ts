import {
    chatIdentifiersEqual,
    type ChatIdentifier,
    type PinNumberResolver,
    type RulesAcceptanceResolver,
} from "@shared";

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
 * Whether a prompt that opened while `openedIn` was the selected chat is declined now `selected`
 * is: another chat (or none, or one where there was none) declines it. The client reads the
 * selected chat's rules when the rules are answered, and a PIN belongs to the transfer in the chat
 * it started in. A navigation within the same chat (a thread, a query) keeps it.
 */
export function declinesPrompt(
    openedIn: ChatIdentifier | undefined,
    selected: ChatIdentifier | undefined,
): boolean {
    if (openedIn === undefined || selected === undefined) return openedIn !== selected;
    return !chatIdentifiersEqual(openedIn, selected);
}

/** Declines a waiting prompt: the rules aren't accepted, the PIN isn't given. */
export function declinePrompt(prompt: WaitingPrompt): void {
    switch (prompt.kind) {
        case "rules":
            return prompt.request.resolve(false);
        case "pin":
            return prompt.request.reject();
    }
}

/**
 * Calls `decline` once when the selected chat changes from the one selected as this starts
 * (`chats` gives it on subscribing). Returns the unsubscribe.
 */
export function declineOnChatChange(
    chats: { subscribe: (fn: (chat: ChatIdentifier | undefined) => void) => () => void },
    decline: () => void,
): () => void {
    let started = false;
    let declined = false;
    let openedIn: ChatIdentifier | undefined;
    return chats.subscribe((chat) => {
        if (!started) {
            started = true;
            openedIn = chat;
        } else if (!declined && declinesPrompt(openedIn, chat)) {
            declined = true;
            decline();
        }
    });
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
