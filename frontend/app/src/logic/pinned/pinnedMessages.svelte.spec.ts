import type {
    EventsResponse,
    EventWrapper,
    Message,
    MultiUserChatIdentifier,
    ReadonlySet,
} from "@client";
import { flushSync } from "svelte";
import { describe, expect, test, vi } from "vitest";
import { PinnedMessages } from "./pinnedMessages.svelte";

const chatId: MultiUserChatIdentifier = { kind: "group_chat", groupId: "g1" };

function evt(messageIndex: number): EventWrapper<Message> {
    return { index: messageIndex, event: { messageIndex } } as EventWrapper<Message>;
}

function response(indexes: number[]): EventsResponse<Message> {
    return { events: indexes.map(evt), expiredEventRanges: [], latestEventIndex: undefined };
}

// the backend's answers, in the order the test gives them
function deferred() {
    let resolve: (resp: EventsResponse<Message>) => void = () => {};
    const promise = new Promise<EventsResponse<Message>>((r) => (resolve = r));
    return { promise, resolve };
}

function client(answers: Promise<EventsResponse<Message>>[]) {
    let n = 0;
    return {
        getMessagesByMessageIndex: vi.fn(
            (_chatId: unknown, _thread: unknown, _indexes: number[]) => answers[n++],
        ),
        groupMessagesByDate: (events: EventWrapper<Message>[]) => [events],
        unreadPinned: () => false,
        markPinnedMessagesRead: vi.fn(),
        logError: vi.fn(),
    };
}

function indexes(loader: PinnedMessages): number[] | undefined {
    const messages = loader.messages;
    return messages.kind === "success"
        ? messages.data.flat().map((e) => e.event.messageIndex)
        : undefined;
}

describe("PinnedMessages", () => {
    test("keeps the latest load when an older one finishes after it", async () => {
        const first = deferred();
        const second = deferred();
        let pinned = new Set([1, 2]) as ReadonlySet<number>;
        const loader = new PinnedMessages(
            client([first.promise, second.promise]),
            () => chatId,
            () => undefined,
            { pinned: () => pinned, detailsLoaded: () => true },
        );

        // pinned, then that pin taken back: the second load is the latest
        const older = loader.sync();
        pinned = new Set([1]);
        const newer = loader.sync();

        second.resolve(response([1]));
        expect(await newer).toBe(true);
        first.resolve(response([1, 2]));
        expect(await older).toBe(false);

        expect(indexes(loader)).toEqual([1]);
    });

    test("drops a load overtaken by the chat's details going", async () => {
        const first = deferred();
        let loaded = $state(true);
        const loader = new PinnedMessages(
            client([first.promise]),
            () => chatId,
            () => undefined,
            {
                pinned: () => new Set([1]),
                detailsLoaded: () => loaded,
            },
        );

        const older = loader.sync();
        loaded = false;
        await loader.sync();
        first.resolve(response([1]));
        expect(await older).toBe(false);

        expect(loader.messages.kind).toBe("loading");
    });

    test("syncs again for the pinned set and the details arriving, not for every update to them", () => {
        let pinned = $state<ReadonlySet<number>>(new Set([1]));
        // the chat's details, as selectedServerChatStore sends them: undefined until they're in
        let details = $state<{ version: number } | undefined>(undefined);
        const answers = [Promise.resolve(response([1])), Promise.resolve(response([1, 2]))];
        const loader = new PinnedMessages(
            client(answers),
            () => chatId,
            () => undefined,
            {
                pinned: () => pinned,
                detailsLoaded: () => details !== undefined,
            },
        );
        const sync = vi.spyOn(loader, "sync");

        const stop = $effect.root(() => {
            $effect(() => {
                void loader.sync();
            });
        });
        flushSync();
        expect(sync).toHaveBeenCalledTimes(1);

        details = { version: 1 };
        flushSync();
        expect(sync).toHaveBeenCalledTimes(2);

        // members, settings…: the same pins, nothing to load again
        details = { version: 2 };
        flushSync();
        expect(sync).toHaveBeenCalledTimes(2);

        pinned = new Set([1, 2]);
        flushSync();
        expect(sync).toHaveBeenCalledTimes(3);
        stop();
    });
});
