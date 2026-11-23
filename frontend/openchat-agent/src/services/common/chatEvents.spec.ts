import { emptyEventsResponse, ResponseTooLargeError, type Stream } from "@shared";
import { describe, expect, test, vi } from "vitest";
import type { ChatsDb } from "../../utils/chatsDb";
import { CachedChatEventsReader, type IChatEventsReader } from "./chatEvents";

const GROUP = { kind: "group_chat", groupId: "rdmx6-jaaaa-aaaaa-aaadq-cai" } as const;
const failure = new Error("Failed to fetch");

// The error the stream rejects with, failing if it gives a final result first
function errorFrom<T>(stream: Stream<T>): Promise<unknown> {
    return new Promise((resolve, reject) =>
        stream.subscribe({
            onResult: (_value, final) => {
                if (final) reject(new Error("resolved"));
            },
            onError: resolve,
        }),
    );
}

function eventsReader(
    groupClient: Partial<IChatEventsReader>,
    chatsDb: Partial<ChatsDb>,
): CachedChatEventsReader {
    return new CachedChatEventsReader(
        {} as IChatEventsReader,
        groupClient as IChatEventsReader,
        {} as IChatEventsReader,
        { setCachedEvents: () => Promise.resolve(), ...chatsDb } as ChatsDb,
    );
}

describe("loading a chat's events, when it fails", () => {
    test("a cache that can't be read fails the stream", async () => {
        const reader = eventsReader({}, { getCachedEvents: () => Promise.reject(failure) });

        expect(await errorFrom(reader.chatEvents(GROUP, [0, 100], 50, false, undefined, 1n))).toBe(
            failure,
        );
    });

    test("a response too large, then a failure loading it in chunks, fails the stream", async () => {
        const tooLarge = new ResponseTooLargeError(new Error("too large"), 3_000_000, 2_000_000);
        const reader = eventsReader(
            {
                chatEvents: vi.fn().mockRejectedValueOnce(tooLarge).mockRejectedValue(failure),
            },
            {
                // Nothing cached and nothing said to be missing, so it goes to the backend
                getCachedEvents: () =>
                    Promise.resolve([emptyEventsResponse(), new Set<number>(), new Set<number>()]),
            },
        );

        expect(await errorFrom(reader.chatEvents(GROUP, [0, 100], 50, false, undefined, 1n))).toBe(
            failure,
        );
    });

    test("a message window too large, then a failure loading it in chunks, fails the stream", async () => {
        const tooLarge = new ResponseTooLargeError(new Error("too large"), 3_000_000, 2_000_000);
        const reader = eventsReader(
            {
                chatEventsWindow: vi
                    .fn()
                    .mockRejectedValueOnce(tooLarge)
                    .mockRejectedValue(failure),
            },
            {
                getCachedEventsWindowByMessageIndex: () =>
                    Promise.resolve([
                        emptyEventsResponse(),
                        new Set<number>(),
                        new Set<number>(),
                        true,
                    ]),
            },
        );

        expect(await errorFrom(reader.chatEventsWindow(GROUP, [0, 100], 50, undefined, 1n))).toBe(
            failure,
        );
    });
});
