import type { User, UserOrUserGroup } from "@client";

// The message entry's decisions, shared by every tree: what a typed message is sent as, why one
// can't be sent, and when the others hear someone is typing.

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

/** What the message entry knows about where it is. */
export type EntryState = {
    /** The reader's account is suspended (the old UI hid the composer). */
    suspended: boolean;
    /** The chat, or its community, is frozen. */
    frozen: boolean;
    /** A DM with someone the reader has blocked. */
    blocked: boolean;
    /** Not a member of the group or channel (a preview), or a lapsed one. */
    previewing: boolean;
    lapsed: boolean;
    /** A direct chat (never a preview). */
    direct: boolean;
    /** A channel showing external content, which can't be posted to. */
    externalContent: boolean;
    /** Signed out. */
    anonymous: boolean;
    /** The reader's role lets them send here. */
    canSend: boolean;
    /** The entry is a thread's. */
    thread: boolean;
};

/** What stands in place of the message entry, when the reader can't send. */
export type EntryBlock =
    | { kind: "suspended" }
    | { kind: "frozen" }
    | { kind: "blocked" }
    // the preview's Join (or, lapsed, re-join) footer
    | { kind: "preview"; lapsed: boolean }
    | { kind: "external" }
    | { kind: "read_only"; key: "sendMessageDisabledAnon" | "readOnlyThread" | "readOnlyChat" };

/**
 * Why the reader can't send here, in the order the old footers checked; none when they can. Every
 * tree's entry shows this, each in its own way.
 */
export function entryBlock(state: EntryState): EntryBlock | undefined {
    if (state.suspended) return { kind: "suspended" };
    if (state.frozen) return { kind: "frozen" };
    if (state.blocked) return { kind: "blocked" };
    if ((state.previewing || state.lapsed) && !state.direct) {
        return { kind: "preview", lapsed: state.lapsed };
    }
    if (state.externalContent) return { kind: "external" };
    if (state.anonymous) return { kind: "read_only", key: "sendMessageDisabledAnon" };
    if (!state.canSend) {
        return { kind: "read_only", key: state.thread ? "readOnlyThread" : "readOnlyChat" };
    }
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

    /** Left: forgotten, without telling the others (they're another chat's by now; their own
     * "typing" runs out by itself). */
    cancel(): void {
        clearTimeout(this.#stopTimer);
        this.#stopTimer = undefined;
        this.#typing = false;
    }

    /** Sent, or emptied: stopped, if they were typing. */
    stopped(): void {
        clearTimeout(this.#stopTimer);
        this.#stopTimer = undefined;
        if (this.#typing) {
            this.#typing = false;
            this.stop();
        }
    }
}
