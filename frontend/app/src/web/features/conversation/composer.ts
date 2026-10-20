import type { User, UserOrUserGroup } from "@client";

// The composer's decisions (phase 3c), as the old UI's MessageEntry made them: what a typed
// message is sent as, why one can't be sent, and when the others hear someone is typing.

/**
 * A message's text as it's sent: each @username the chat knows becomes the client's mention
 * (`@UserId(…)`, `@UserGroup(…)`, `@everyone`), and the users mentioned are listed.
 */
export function expandMentions(
    text: string,
    lookup: (username: string) => UserOrUserGroup | undefined,
): { text: string; mentioned: User[] } {
    const mentioned = new Map<string, User>();
    const expanded = text.replace(/@(\w+)/g, (match, username: string) => {
        const found = lookup(username);
        if (found === undefined) return match;
        switch (found.kind) {
            case "user_group":
                return `@UserGroup(${found.id})`;
            case "everyone":
                return "@everyone";
            default:
                mentioned.set(found.userId, found);
                return `@UserId(${found.userId})`;
        }
    });
    return { text: expanded, mentioned: [...mentioned.values()] };
}

export type SendState = {
    /** The chat, or its community, is frozen. */
    frozen: boolean;
    /** A DM with someone the reader has blocked. */
    blocked: boolean;
    /** Not a member of the group or channel (a preview), or a lapsed one. */
    previewing: boolean;
    lapsed: boolean;
    /** Signed out. */
    anonymous: boolean;
    /** The reader's role lets them send messages here. */
    canSend: boolean;
};

export type Blocked = { key: string; tone: "info" | "warning" };

/** Why the reader can't send a message here, in the old footer's words; none when they can. */
export function sendBlocked(state: SendState): Blocked | undefined {
    if (state.frozen) return { key: "chatFrozen", tone: "warning" };
    if (state.blocked) return { key: "userIsBlocked", tone: "info" };
    if (state.lapsed) return { key: "access.lapsed.label", tone: "info" };
    if (state.anonymous) return { key: "sendMessageDisabledAnon", tone: "info" };
    // TODO(phase 9): a preview's Join (and its access gates), as the old PreviewFooter
    if (state.previewing || !state.canSend) return { key: "readOnlyChat", tone: "info" };
    return undefined;
}

// as the old composer: say "typing" at most once a second, and "stopped" after 5s without input
const START_INTERVAL_MS = 1000;
const STOP_AFTER_MS = 5000;

/** Tells the others someone is typing while they write, and when they've stopped. */
export class TypingNotifier {
    #lastStart = 0;
    #typing = false;
    #stopTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private readonly start: () => void,
        private readonly stop: () => void,
        private readonly now: () => number = Date.now,
    ) {}

    /** The draft changed: typing, or (emptied) stopped. */
    input(text: string): void {
        if (text.trim() === "") {
            this.stopped();
            return;
        }
        const now = this.now();
        if (!this.#typing || now - this.#lastStart > START_INTERVAL_MS) {
            this.#lastStart = now;
            this.#typing = true;
            this.start();
        }
        clearTimeout(this.#stopTimer);
        this.#stopTimer = setTimeout(() => this.stopped(), STOP_AFTER_MS);
    }

    /** Sent, left, or emptied: stopped, if they were typing. */
    stopped(): void {
        clearTimeout(this.#stopTimer);
        this.#stopTimer = undefined;
        if (this.#typing) {
            this.#typing = false;
            this.stop();
        }
    }
}
