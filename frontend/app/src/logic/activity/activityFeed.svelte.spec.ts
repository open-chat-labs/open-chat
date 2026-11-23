import type { MessageActivityEvent, MessageActivityFeedResponse, OpenChat } from "@client";
import { activityFeedState } from "./activity.svelte";
import { ActivityFeedLoad, markActivityRead } from "./activityFeed.svelte";

type Subscribe = OpenChat["subscribeToMessageActivityFeed"];

function client() {
    const calls: { onResult: Parameters<Subscribe>[0]; onError?: Parameters<Subscribe>[1] }[] = [];
    const subscribe: Subscribe = (onResult, onError) => {
        calls.push({ onResult, onError });
    };
    return { calls, client: { subscribeToMessageActivityFeed: subscribe } };
}

const response = (timestamp: bigint) =>
    ({ events: [{ timestamp } as MessageActivityEvent], total: 1 }) as MessageActivityFeedResponse;

describe("the activity feed's loading", () => {
    test("loads until the feed has the summary's latest activity", () => {
        const { calls, client: c } = client();
        const load = new ActivityFeedLoad(c);
        expect(load.needed(5n)).toBe(true);
        load.load();
        calls[0].onResult(response(5n), true);
        expect(load.needed(5n)).toBe(false);
        // newer activity than the feed has
        expect(load.needed(6n)).toBe(true);
    });

    test("a failed load waits for Retry", () => {
        const { calls, client: c } = client();
        const load = new ActivityFeedLoad(c);
        load.load();
        calls[0].onError?.(new Error("no"));
        expect(load.failed).toBe(true);
        expect(load.needed(99n)).toBe(false);
        load.retry();
        expect(load.failed).toBe(false);
        expect(load.needed(99n)).toBe(true);
    });

    test("a superseded load's failure doesn't fail the later one", () => {
        const { calls, client: c } = client();
        const load = new ActivityFeedLoad(c);
        load.load();
        load.load();
        calls[0].onError?.(new Error("late"));
        expect(load.failed).toBe(false);
    });

    afterEach(() => {
        activityFeedState.activityEvents = [];
    });
});

describe("marking the feed read", () => {
    test("marks up to the time given, and resolves when it stuck", async () => {
        const mark = vi.fn(async () => true);
        // the summary's read-up-to time is still the server's: it isn't what says it worked
        await expect(
            markActivityRead({ markActivityFeedRead: mark }, 4n, 1n),
        ).resolves.toBeUndefined();
        expect(mark).toHaveBeenCalledWith(4n);
    });

    test("rejects a mark the client undid", async () => {
        const mark = vi.fn(async () => false);
        await expect(markActivityRead({ markActivityFeedRead: mark }, 4n, 1n)).rejects.toThrow();
    });

    test("does nothing for nothing new", async () => {
        const mark = vi.fn(async () => true);
        await markActivityRead({ markActivityFeedRead: mark }, undefined, 1n);
        await markActivityRead({ markActivityFeedRead: mark }, 3n, 3n);
        expect(mark).not.toHaveBeenCalled();
    });
});
