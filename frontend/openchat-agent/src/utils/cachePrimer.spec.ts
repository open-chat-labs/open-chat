import type { ChatEventsArgs, GroupChatSummary, MultiUserChatIdentifier } from "@shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CachePrimer } from "./cachePrimer";

const LUI = "lui-1";

function proposalChat(groupId: string, latestEventIndex = 5): GroupChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        subtype: { kind: "governance_proposals" },
        localUserIndex: LUI,
        lastUpdated: BigInt(1),
        latestEventIndex,
        latestMessageIndex: latestEventIndex,
        minVisibleEventIndex: 0,
        membership: { archived: false, readByMeUpTo: latestEventIndex },
    } as unknown as GroupChatSummary;
}

describe("CachePrimer", () => {
    let getEventsBatch: ReturnType<typeof vi.fn>;
    let updateProposalTallies: ReturnType<typeof vi.fn>;
    let primer: CachePrimer;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(console, "debug").mockImplementation(() => {});
        getEventsBatch = vi.fn((_lui: string, reqs: ChatEventsArgs[]) =>
            Promise.resolve(reqs.map(() => ({ kind: "failure" }))),
        );
        updateProposalTallies = vi.fn(() => Promise.resolve());
        primer = new CachePrimer(
            LUI,
            {},
            getEventsBatch as never,
            updateProposalTallies as never,
            () => {},
        );
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
});
