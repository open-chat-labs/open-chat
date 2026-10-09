import type {
    ChatEvent,
    ChatEventsArgs,
    ChatEventsResponse,
    ChatMap,
    EventWrapper,
    GroupChatSummary,
    MultiUserChatIdentifier,
    UpdatedEvent,
} from "@shared";
import { ChatMap as ChatMapImpl, ResponseTooLargeError } from "@shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CachePrimer } from "./cachePrimer";

const LUI = "lui-1";

function groupChat(
    groupId: string,
    latestEventIndex: number,
    lastUpdated = 1,
    readByMeUpTo = latestEventIndex,
): GroupChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        localUserIndex: LUI,
        lastUpdated: BigInt(lastUpdated),
        latestEventIndex,
        latestMessageIndex: latestEventIndex,
        minVisibleEventIndex: 0,
        membership: { archived: false, readByMeUpTo },
    } as unknown as GroupChatSummary;
}

function memberJoined(index: number): EventWrapper<ChatEvent> {
    return {
        index,
        timestamp: BigInt(index),
        event: { kind: "member_joined", userId: "u1" },
    } as unknown as EventWrapper<ChatEvent>;
}

function message(index: number, repliesToEventIndex?: number): EventWrapper<ChatEvent> {
    return {
        index,
        timestamp: BigInt(index),
        event: {
            kind: "message",
            sender: "u1",
            content: { kind: "text_content", text: "hi" },
            reactions: [],
            repliesTo:
                repliesToEventIndex === undefined
                    ? undefined
                    : { kind: "raw_reply_context", eventIndex: repliesToEventIndex },
        },
    } as unknown as EventWrapper<ChatEvent>;
}

function success(events: EventWrapper<ChatEvent>[]): ChatEventsResponse {
    return {
        kind: "success",
        result: { events, expiredEventRanges: [], latestEventIndex: undefined },
    } as unknown as ChatEventsResponse;
}

function range(from: number, to: number): number[] {
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function updated(groupId: string, events: UpdatedEvent[]): ChatMap<UpdatedEvent[]> {
    const map = new ChatMapImpl<UpdatedEvent[]>();
    map.set({ kind: "group_chat", groupId }, events);
    return map;
}

function proposalChat(groupId: string, latestEventIndex = 5, archived = false): GroupChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        subtype: { kind: "governance_proposals" },
        localUserIndex: LUI,
        lastUpdated: BigInt(1),
        latestEventIndex,
        latestMessageIndex: latestEventIndex,
        minVisibleEventIndex: 0,
        membership: { archived, readByMeUpTo: latestEventIndex },
    } as unknown as GroupChatSummary;
}

describe("CachePrimer", () => {
    let getEventsBatch: ReturnType<typeof vi.fn>;
    let updateProposalTallies: ReturnType<typeof vi.fn>;
    let loadUsers: ReturnType<typeof vi.fn>;
    let saveEventIndexesLoadedUpTo: ReturnType<typeof vi.fn>;
    let eventIndexesLoadedUpTo: Record<string, number>;
    let primer: CachePrimer;

    function createPrimer() {
        primer = new CachePrimer(
            LUI,
            eventIndexesLoadedUpTo,
            getEventsBatch as never,
            updateProposalTallies as never,
            loadUsers as never,
            saveEventIndexesLoadedUpTo as never,
        );
    }

    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(console, "debug").mockImplementation(() => {});
        getEventsBatch = vi.fn((_lui: string, reqs: ChatEventsArgs[]) =>
            Promise.resolve(reqs.map(() => ({ kind: "failure" }))),
        );
        updateProposalTallies = vi.fn(() => Promise.resolve());
        loadUsers = vi.fn(() => Promise.resolve());
        saveEventIndexesLoadedUpTo = vi.fn(() => Promise.resolve());
        eventIndexesLoadedUpTo = {};
        createPrimer();
    });

    afterEach(() => {
        primer.stop();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    test("proposal chats are passed to updateProposalTallies once each, even when seen on repeated iterations", async () => {
        const chat = proposalChat("g1");
        primer.processUpdates([], [chat], []);
        await vi.advanceTimersByTimeAsync(1000);

        expect(updateProposalTallies).toHaveBeenCalledTimes(1);
        expect(updateProposalTallies.mock.calls[0][1]).toEqual([chat.id]);

        // Subsequent update iterations re-present the same chat (latestEventIndex bumped so it is queued again)
        primer.processUpdates([], [proposalChat("g1", 6), proposalChat("g1", 7)], []);
        await vi.advanceTimersByTimeAsync(60_000);

        expect(updateProposalTallies).toHaveBeenCalledTimes(2);
        const ids = updateProposalTallies.mock.calls[1][1] as MultiUserChatIdentifier[];
        expect(ids).toEqual([chat.id]);
    });

    test("a removed proposal chat is no longer polled", async () => {
        primer.processUpdates([], [proposalChat("g1"), proposalChat("g2")], []);
        await vi.advanceTimersByTimeAsync(1000);
        expect(updateProposalTallies.mock.calls[0][1]).toHaveLength(2);

        primer.processUpdates([], [], [], undefined, undefined, ["g1"]);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(updateProposalTallies).toHaveBeenCalledTimes(2);
        expect(updateProposalTallies.mock.calls[1][1]).toEqual([
            { kind: "group_chat", groupId: "g2" },
        ]);
    });

    test("stop() cancels the proposal tally poll and the batch runner", async () => {
        primer.processUpdates([], [proposalChat("g1")], []);
        await vi.advanceTimersByTimeAsync(1000);
        expect(updateProposalTallies).toHaveBeenCalledTimes(1);
        expect(getEventsBatch).toHaveBeenCalledTimes(1);

        primer.stop();
        await vi.advanceTimersByTimeAsync(5 * 60_000);
        expect(updateProposalTallies).toHaveBeenCalledTimes(1);

        // Further updates after stop are ignored
        primer.processUpdates([], [proposalChat("g2", 9)], []);
        await vi.advanceTimersByTimeAsync(5 * 60_000);
        expect(updateProposalTallies).toHaveBeenCalledTimes(1);
        expect(getEventsBatch).toHaveBeenCalledTimes(1);
    });

    test("an update which arrives while the chat is being fetched is fetched in the next batch", async () => {
        let resolveFirst: (responses: ChatEventsResponse[]) => void = () => {};
        getEventsBatch.mockImplementationOnce(
            () => new Promise<ChatEventsResponse[]>((resolve) => (resolveFirst = resolve)),
        );
        getEventsBatch.mockImplementation((_lui: string, reqs: ChatEventsArgs[]) =>
            Promise.resolve(reqs.map(() => success([]))),
        );

        primer.processUpdates([], [groupChat("g1", 5, 1)], []);
        await vi.advanceTimersByTimeAsync(0);
        expect(getEventsBatch).toHaveBeenCalledTimes(1);

        primer.processUpdates([], [groupChat("g1", 8, 2)], []);
        resolveFirst([success(range(0, 5).map(memberJoined))]);
        await vi.advanceTimersByTimeAsync(500);

        expect(getEventsBatch).toHaveBeenCalledTimes(2);
        const [request] = getEventsBatch.mock.calls[1][1] as ChatEventsArgs[];
        expect(request.args).toMatchObject({ kind: "page", ascending: true, startIndex: 6 });
        expect(request.latestKnownUpdate).toBe(BigInt(2));
    });

    test("a chat updated again while queued is fetched once, with its latest update", async () => {
        primer.processUpdates([], [groupChat("g1", 5, 1)], []);
        primer.processUpdates([], [groupChat("g1", 7, 3)], []);
        await vi.advanceTimersByTimeAsync(0);

        expect(getEventsBatch).toHaveBeenCalledTimes(1);
        const requests = getEventsBatch.mock.calls[0][1] as ChatEventsArgs[];
        expect(requests).toHaveLength(1);
        expect(requests[0].args).toMatchObject({ kind: "page", eventIndexRange: [0, 7] });
        expect(requests[0].latestKnownUpdate).toBe(BigInt(3));
    });

    test("the most recently updated chats are fetched first", async () => {
        primer.processUpdates(
            [],
            Array.from({ length: 25 }, (_, i) => groupChat(`g${i}`, 5, i)),
            [],
        );
        await vi.advanceTimersByTimeAsync(0);

        const requests = getEventsBatch.mock.calls[0][1] as ChatEventsArgs[];
        expect(requests).toHaveLength(20);
        expect(requests[0].latestKnownUpdate).toBe(BigInt(24));
        expect(requests[19].latestKnownUpdate).toBe(BigInt(5));
    });

    test("thread-only event updates for an up to date chat don't queue a request", async () => {
        eventIndexesLoadedUpTo["g1"] = 5;
        createPrimer();
        primer.processUpdates(
            [],
            [groupChat("g1", 5)],
            [],
            updated("g1", [{ eventIndex: 2, threadRootMessageIndex: 1, timestamp: BigInt(1) }]),
        );
        await vi.advanceTimersByTimeAsync(1000);

        expect(getEventsBatch).not.toHaveBeenCalled();
    });

    test("updated events are fetched by index unless the page fetches them", async () => {
        eventIndexesLoadedUpTo["g1"] = 5;
        createPrimer();
        primer.processUpdates(
            [],
            [groupChat("g1", 8)],
            [],
            updated("g1", [
                { eventIndex: 2, timestamp: BigInt(1) },
                { eventIndex: 7, timestamp: BigInt(1) },
            ]),
        );
        await vi.advanceTimersByTimeAsync(0);

        const requests = getEventsBatch.mock.calls[0][1] as ChatEventsArgs[];
        expect(requests.map((r) => r.args)).toMatchObject([
            { kind: "page", startIndex: 6 },
            { kind: "by_index", events: [2] },
        ]);
    });

    test("only the page or window request moves the loaded up to mark", async () => {
        getEventsBatch.mockImplementation((_lui: string, reqs: ChatEventsArgs[]) =>
            Promise.resolve(
                reqs.map((r) =>
                    r.args.kind === "by_index"
                        ? success(r.args.events.map(memberJoined))
                        : success(range(150, 250).map(memberJoined)),
                ),
            ),
        );

        // 300 unread, so a window around the first unread message is fetched
        primer.processUpdates(
            [],
            [groupChat("g1", 300, 1, 0)],
            [],
            updated("g1", [{ eventIndex: 290, timestamp: BigInt(1) }]),
        );
        await vi.advanceTimersByTimeAsync(0);

        const requests = getEventsBatch.mock.calls[0][1] as ChatEventsArgs[];
        expect(requests.map((r) => r.args.kind)).toEqual(["window", "by_index"]);
        expect(saveEventIndexesLoadedUpTo).toHaveBeenCalledTimes(1);
        expect(saveEventIndexesLoadedUpTo.mock.calls[0][0]).toEqual(new Map([["g1", 250]]));
    });

    test("replies to events in the same response aren't fetched again", async () => {
        getEventsBatch.mockImplementation((_lui: string, reqs: ChatEventsArgs[]) =>
            Promise.resolve(
                reqs.map((r) =>
                    r.args.kind === "by_index"
                        ? success(r.args.events.map((i) => message(i)))
                        : success([message(2), message(3, 2), message(4, 0), message(5)]),
                ),
            ),
        );

        eventIndexesLoadedUpTo["g1"] = 1;
        createPrimer();
        primer.processUpdates([], [groupChat("g1", 5)], []);
        await vi.advanceTimersByTimeAsync(0);

        expect(getEventsBatch).toHaveBeenCalledTimes(2);
        const [repliesRequest] = getEventsBatch.mock.calls[1][1] as ChatEventsArgs[];
        expect(repliesRequest.args).toEqual({ kind: "by_index", events: [0] });
    });

    test("archived proposal chats aren't polled, and are once unarchived", async () => {
        primer.processUpdates([], [proposalChat("g1", 5, true), proposalChat("g2")], []);
        await vi.advanceTimersByTimeAsync(1000);
        expect(updateProposalTallies).toHaveBeenCalledTimes(1);
        expect(updateProposalTallies.mock.calls[0][1]).toEqual([
            { kind: "group_chat", groupId: "g2" },
        ]);

        primer.processUpdates([], [proposalChat("g1"), proposalChat("g2", 5, true)], []);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(updateProposalTallies).toHaveBeenCalledTimes(2);
        expect(updateProposalTallies.mock.calls[1][1]).toEqual([
            { kind: "group_chat", groupId: "g1" },
        ]);
    });

    test("the tally poll starts when the only proposal chat is unarchived", async () => {
        primer.processUpdates([], [proposalChat("g1", 5, true)], []);
        await vi.advanceTimersByTimeAsync(1000);
        expect(updateProposalTallies).not.toHaveBeenCalled();

        primer.processUpdates([], [proposalChat("g1")], []);
        await vi.advanceTimersByTimeAsync(1000);
        expect(updateProposalTallies).toHaveBeenCalledTimes(1);
        expect(updateProposalTallies.mock.calls[0][1]).toEqual([
            { kind: "group_chat", groupId: "g1" },
        ]);
    });

    test("users whose load fails are loaded again by a later batch", async () => {
        getEventsBatch.mockImplementation((_lui: string, reqs: ChatEventsArgs[]) =>
            Promise.resolve(reqs.map(() => success([memberJoined(5)]))),
        );
        loadUsers.mockImplementationOnce(() => Promise.reject(new Error("offline")));

        primer.processUpdates([], [groupChat("g1", 5)], []);
        await vi.advanceTimersByTimeAsync(0);
        primer.processUpdates([], [groupChat("g2", 5)], []);
        await vi.advanceTimersByTimeAsync(1000);

        expect(loadUsers).toHaveBeenCalledTimes(2);
        expect(loadUsers.mock.calls[1][0]).toEqual(["u1"]);
    });

    test("a chat which is too large is dropped, even if it was queued again meanwhile", async () => {
        let rejectFirst: (error: Error) => void = () => {};
        getEventsBatch.mockImplementationOnce(
            () => new Promise<ChatEventsResponse[]>((_, reject) => (rejectFirst = reject)),
        );

        primer.processUpdates([], [groupChat("g1", 5, 1)], []);
        await vi.advanceTimersByTimeAsync(0);
        primer.processUpdates([], [groupChat("g1", 8, 2)], []);
        rejectFirst(new ResponseTooLargeError(new Error("too large"), 3_000_000, 2_000_000));
        await vi.advanceTimersByTimeAsync(1000);

        expect(getEventsBatch).toHaveBeenCalledTimes(1);

        primer.processUpdates([], [groupChat("g1", 9, 3)], []);
        await vi.advanceTimersByTimeAsync(1000);
        expect(getEventsBatch).toHaveBeenCalledTimes(1);
    });
});
