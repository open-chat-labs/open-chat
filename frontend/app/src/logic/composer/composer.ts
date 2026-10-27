import { ScreenWidth } from "@client";

// The message entry's decisions, shared by every tree: why a message can't be sent, when the
// others hear someone is typing, and when it takes focus. (What a typed message is sent as, its
// mentions expanded, is up to the client's send.)

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

/**
 * Too many messages a minute: whole seconds until sending resumes (rounded up, so it never reads
 * 0s while sends are still refused) and how much of the minute is left, or undefined once the
 * deadline has passed (or there is none).
 */
export function throttleCountdown(
    deadline: number,
    now: number,
): { seconds: number; percent: number } | undefined {
    if (deadline <= now) return undefined;
    const seconds = Math.ceil((deadline - now) / 1000);
    return { seconds, percent: Math.floor((seconds / 60) * 100) };
}

/**
 * Whether the message entry takes focus when a chat or thread is opened: only on a wide screen
 * that isn't a touch-only device (a tablet runs the wide layout too), since focusing would
 * otherwise bring up the on-screen keyboard over the messages.
 */
export function focusEntryOnOpen(width: ScreenWidth, touchOnly: boolean): boolean {
    if (touchOnly) return false;
    switch (width) {
        case ScreenWidth.Large:
        case ScreenWidth.ExtraLarge:
        case ScreenWidth.ExtraExtraLarge:
            return true;
        default:
            return false;
    }
}
