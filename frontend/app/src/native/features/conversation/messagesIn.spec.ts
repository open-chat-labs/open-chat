import type { ChatIdentifier, ChatSummary } from "@client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { messagesIn, messagesShown } from "./messagesIn";

const dm = (userId: string): ChatIdentifier => ({ kind: "direct_chat", userId });
const chat = (userId: string, latestEventIndex = 30) =>
    ({ id: dm(userId), latestEventIndex }) as ChatSummary;

// a store that can be set, with a count of who's listening
function source<T>(value: T) {
    const runs = new Set<(value: T) => void>();
    return {
        subscribe(run: (value: T) => void) {
            runs.add(run);
            run(value);
            return () => runs.delete(run);
        },
        set(next: T) {
            value = next;
            runs.forEach((run) => run(next));
        },
        get listening() {
            return runs.size;
        },
    };
}

describe("what a conversation shows at first", () => {
    test("is in once its chat is selected with messages", () => {
        expect(messagesShown(dm("u1"), chat("u1"), [{}])).toBe(true);
        expect(messagesShown(dm("u1"), chat("u1"), [])).toBe(false);
    });

    test("isn't another chat's", () => {
        expect(messagesShown(dm("u1"), chat("u2"), [{}])).toBe(false);
        expect(messagesShown(dm("u1"), undefined, [{}])).toBe(false);
    });

    test("is in at once for a new chat, which has nothing to load", () => {
        expect(messagesShown(dm("u1"), chat("u1", 0), [])).toBe(true);
    });
});

describe("waiting for a conversation's first messages", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test("ends when they come in, and stops listening", async () => {
        const selected = source<ChatSummary | undefined>(undefined);
        const events = source<readonly unknown[]>([]);
        const done = vi.fn();
        void messagesIn(dm("u1"), { selected, events }, 500).then(done);
        selected.set(chat("u1"));
        await Promise.resolve();
        expect(done).not.toHaveBeenCalled();
        events.set([{}, {}]);
        await vi.waitFor(() => expect(done).toHaveBeenCalled());
        expect(selected.listening + events.listening).toBe(0);
    });

    test("ends at once when they're already in", async () => {
        const selected = source<ChatSummary | undefined>(chat("u1"));
        const events = source<readonly unknown[]>([{}]);
        await messagesIn(dm("u1"), { selected, events }, 500);
        expect(selected.listening + events.listening).toBe(0);
    });

    test("gives up after the cap, for a chat with nothing in the cache", async () => {
        const selected = source<ChatSummary | undefined>(chat("u1"));
        const events = source<readonly unknown[]>([]);
        const done = vi.fn();
        void messagesIn(dm("u1"), { selected, events }, 500).then(done);
        vi.advanceTimersByTime(499);
        await Promise.resolve();
        expect(done).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        await vi.waitFor(() => expect(done).toHaveBeenCalled());
        expect(selected.listening + events.listening).toBe(0);
    });
});
