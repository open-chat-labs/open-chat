import type {
    ChatStateFull,
    ChitEvent,
    CommunitySummary,
    DirectChatSummary,
    GroupChatSummary,
    UpdatedEvent,
} from "@shared";
import { ChatMap } from "@shared";
import { describe, expect, test } from "vitest";
import {
    chatRowKey,
    chatRowsToWrite,
    emptyTouched,
    globalsOf,
    mergeUpdatedEventStamps,
    nextSyncStamps,
    removedFromTombstones,
    stateFromRows,
    SYNCED_FIELDS,
    updatesSince,
    type ChatsSince,
    type RemovedChats,
    type SyncTouched,
} from "./sync";

const direct = (userId: string) =>
    ({ kind: "direct_chat", id: { kind: "direct_chat", userId } }) as unknown as DirectChatSummary;
const group = (groupId: string) =>
    ({ kind: "group_chat", id: { kind: "group_chat", groupId } }) as unknown as GroupChatSummary;
const community = (communityId: string) =>
    ({ kind: "community", id: { kind: "community", communityId } }) as unknown as CommunitySummary;

function state(overrides: Partial<ChatStateFull> = {}): ChatStateFull {
    return {
        latestUserCanisterUpdates: 0n,
        directChats: [],
        groupChats: [],
        communities: [],
        avatarId: undefined,
        blockedUsers: [],
        pinnedChats: [],
        pinnedFavouriteChats: [],
        pinnedChannels: [],
        favouriteChats: [],
        pinNumberSettings: undefined,
        userCanisterLocalUserIndex: "lui",
        achievements: new Set(),
        achievementsLastSeen: 0n,
        chitState: {
            streak: 0,
            streakEnds: 0n,
            maxStreak: 0,
            nextDailyChitClaim: 0n,
            chitBalance: 0,
            totalChitEarned: 0,
        },
        referrals: [],
        walletConfig: { kind: "auto_wallet", minDollarValue: 1 },
        messageActivitySummary: { readUpToTimestamp: 0n, latestTimestamp: 0n, unreadCount: 0 },
        installedBots: new Map(),
        bitcoinAddress: undefined,
        oneSecAddress: undefined,
        streakInsurance: undefined,
        premiumItems: new Set(),
        ...overrides,
    };
}

function touched(overrides: Partial<SyncTouched> = {}): SyncTouched {
    return { ...emptyTouched(), ...overrides };
}

function updatedEvents(
    entries: [DirectChatSummary | GroupChatSummary, UpdatedEvent[]][],
): ChatMap<UpdatedEvent[]> {
    const map = new ChatMap<UpdatedEvent[]>();
    for (const [chat, events] of entries) {
        map.set(chat.id, events);
    }
    return map;
}

const chitEvent = (amount: number): ChitEvent => ({
    amount,
    timestamp: BigInt(amount),
    reason: { kind: "daily_claim" },
});

const groupA = group("a");
const groupB = group("b");

describe("chatRowsToWrite", () => {
    const keys = (...ks: string[]) => new Set(ks);
    const putKeys = (plan: ReturnType<typeof chatRowsToWrite>) => plan.put.map((p) => p.key);

    test("writes touched and uncached chats and leaves the rest alone", () => {
        const plan = chatRowsToWrite(
            state({
                directChats: [direct("u1"), direct("u2"), direct("u3")],
                groupChats: [groupA],
            }),
            touched({ directChats: new Set(["u2"]) }),
            keys("direct_chat|u1", "direct_chat|u2", "group_chat|a"),
            false,
        );
        expect(putKeys(plan)).toEqual(["direct_chat|u2", "direct_chat|u3"]);
        expect(plan.put.map((p) => p.isNew)).toEqual([false, true]);
        expect(plan.removed).toEqual([]);
    });

    test("a cached chat that is gone is removed, keeping its kind and id", () => {
        const plan = chatRowsToWrite(
            state({ groupChats: [groupA] }),
            touched(),
            keys("group_chat|a", "group_chat|b", "community|c1"),
            false,
        );
        expect(plan.put).toEqual([]);
        expect(plan.removed).toEqual([
            { key: "group_chat|b", kind: "group_chat", id: "b" },
            { key: "community|c1", kind: "community", id: "c1" },
        ]);
    });

    test("a direct chat and a group chat with the same id are separate rows", () => {
        expect(chatRowKey("direct_chat", "same")).not.toBe(chatRowKey("group_chat", "same"));
        const plan = chatRowsToWrite(
            state({ directChats: [direct("same")] }),
            touched(),
            keys("group_chat|same", "direct_chat|same"),
            false,
        );
        expect(plan.put).toEqual([]);
        expect(plan.removed.map((r) => r.key)).toEqual(["group_chat|same"]);
    });

    test("rewriteAll writes every chat, and still removes the ones that are gone", () => {
        const plan = chatRowsToWrite(
            state({ groupChats: [groupA], communities: [community("c1")] }),
            touched(),
            keys("group_chat|a", "group_chat|b"),
            true,
        );
        expect(putKeys(plan)).toEqual(["group_chat|a", "community|c1"]);
        expect(plan.removed.map((r) => r.key)).toEqual(["group_chat|b"]);
    });
});

describe("stateFromRows", () => {
    test("puts the rows back into their lists beside the globals", () => {
        const full = state({ avatarId: 5n });
        const rebuilt = stateFromRows(globalsOf(full), [
            { kind: "group_chat", version: 1, summary: groupA },
            { kind: "direct_chat", version: 2, summary: direct("u1") },
            { kind: "community", version: 3, summary: community("c1") },
        ]);
        expect(rebuilt.avatarId).toBe(5n);
        expect(rebuilt.directChats).toEqual([direct("u1")]);
        expect(rebuilt.groupChats).toEqual([groupA]);
        expect(rebuilt.communities).toEqual([community("c1")]);
        expect("directChats" in globalsOf(full)).toBe(false);
    });

    test("tombstones are sorted by kind", () => {
        expect(
            removedFromTombstones([
                { kind: "community", id: "c", version: 1 },
                { kind: "direct_chat", id: "u", version: 1 },
                { kind: "group_chat", id: "g", version: 1 },
            ]),
        ).toEqual({ directChats: ["u"], groupChats: ["g"], communities: ["c"] });
    });
});

describe("nextSyncStamps", () => {
    test("every field is stamped the first time and touched fields move to the version", () => {
        const first = nextSyncStamps(undefined, touched(), 1);
        for (const field of SYNCED_FIELDS) {
            expect(first.fields[field]).toBe(1);
        }
        const second = nextSyncStamps(first, touched({ fields: new Set(["blockedUsers"]) }), 2);
        expect(second.fields.blockedUsers).toBe(2);
        expect(second.fields.avatarId).toBe(1);
    });

    test("chit events are batched at the version and the suspension version is recorded", () => {
        const events = [chitEvent(1)];
        const next = nextSyncStamps(
            undefined,
            touched({ chitEvents: events, suspensionChanged: true }),
            3,
        );
        expect(next.chitEvents).toEqual([{ version: 3, events }]);
        expect(next.suspension).toBe(3);

        const later = nextSyncStamps(next, touched(), 4);
        expect(later.chitEvents).toEqual([{ version: 3, events }]);
        expect(later.suspension).toBe(3);
    });
});

describe("mergeUpdatedEventStamps", () => {
    test("an event updated again is kept once, at the newest version", () => {
        const first = mergeUpdatedEventStamps(
            [],
            updatedEvents([
                [
                    groupA,
                    [
                        { eventIndex: 10, timestamp: 1n },
                        { eventIndex: 11, timestamp: 1n, threadRootMessageIndex: 3 },
                    ],
                ],
            ]),
            1,
        );
        const second = mergeUpdatedEventStamps(
            first,
            updatedEvents([[groupA, [{ eventIndex: 10, timestamp: 2n }]]]),
            2,
        );
        expect(second.map((s) => [s.eventIndex, s.threadRootMessageIndex, s.version])).toEqual([
            [10, undefined, 2],
            [11, 3, 1],
        ]);
    });

    test("drops stamps that have fallen far behind the version being written", () => {
        const first = mergeUpdatedEventStamps(
            [],
            updatedEvents([[groupA, [{ eventIndex: 1, timestamp: 1n }]]]),
            1,
        );
        const stillNear = mergeUpdatedEventStamps(
            first,
            updatedEvents([[groupA, [{ eventIndex: 2, timestamp: 1n }]]]),
            400,
        );
        expect(stillNear.map((s) => s.eventIndex)).toEqual([1, 2]);

        const farLater = mergeUpdatedEventStamps(
            stillNear,
            updatedEvents([[groupA, [{ eventIndex: 3, timestamp: 1n }]]]),
            800,
        );
        expect(farLater.map((s) => s.eventIndex)).toEqual([2, 3]);
    });

    test("a direct chat and a group chat with the same id are kept apart", () => {
        const stamps = mergeUpdatedEventStamps(
            [],
            updatedEvents([
                [direct("same"), [{ eventIndex: 1, timestamp: 1n }]],
                [group("same"), [{ eventIndex: 1, timestamp: 1n }]],
            ]),
            1,
        );
        expect(stamps.map((s) => s.chatId.kind)).toEqual(["direct_chat", "group_chat"]);
    });

    test("returns the previous stamps untouched when there is nothing new", () => {
        const prev = mergeUpdatedEventStamps(
            [],
            updatedEvents([[groupA, [{ eventIndex: 1, timestamp: 1n }]]]),
            1,
        );
        expect(mergeUpdatedEventStamps(prev, new ChatMap(), 2)).toBe(prev);
    });
});

describe("updatesSince", () => {
    const full = state({
        directChats: [direct("u1"), direct("u2")],
        groupChats: [groupA, groupB],
        communities: [community("c1")],
        avatarId: 99n,
        blockedUsers: ["x"],
        pinNumberSettings: undefined,
    });
    const noneRemoved: RemovedChats = { directChats: [], groupChats: [], communities: [] };
    const since = (s: ChatsSince["state"] = full, removed = noneRemoved): ChatsSince => ({
        state: s,
        removed,
    });

    test("carries the chats and removals it is given as they are", () => {
        const changed = state({ directChats: [direct("u2")], groupChats: [groupA] });
        const removed = { directChats: ["u9"], groupChats: [], communities: ["c9"] };
        const stamps = nextSyncStamps(undefined, touched(), 1);
        const result = updatesSince(since(changed, removed), stamps, 3);
        expect(result.directChatsAddedUpdated.map((c) => c.id.userId)).toEqual(["u2"]);
        expect(result.groupsAddedUpdated.map((g) => g.id.groupId)).toEqual(["a"]);
        expect(result.communitiesAddedUpdated).toEqual([]);
        expect(result.directChatsRemoved).toEqual(["u9"]);
        expect(result.groupsRemoved).toEqual([]);
        expect(result.communitiesRemoved).toEqual(["c9"]);
    });

    test("fields stamped after since are returned, option fields as option updates", () => {
        const stamps = nextSyncStamps(undefined, touched(), 1);
        const before = updatesSince(since(), stamps, 1);
        expect(before.avatarId).toBeUndefined();
        expect(before.blockedUsers).toBeUndefined();
        expect(before.pinNumberSettings).toBeUndefined();

        const after = updatesSince(since(), stamps, 0);
        expect(after.avatarId).toEqual({ value: 99n });
        expect(after.blockedUsers).toEqual(["x"]);
        expect(after.pinNumberSettings).toBe("set_to_none");
        expect(after.streakInsurance).toBe("set_to_none");
    });

    test("a field with no stamp is carried rather than skipped", () => {
        const result = updatesSince(
            since(),
            { ...nextSyncStamps(undefined, touched(), 1), fields: {} },
            10,
        );
        expect(result.blockedUsers).toEqual(["x"]);
    });

    test("updated events stamped after since come back for every chat, once each", () => {
        const stamps = nextSyncStamps(
            nextSyncStamps(
                undefined,
                touched({
                    updatedEvents: updatedEvents([[groupA, [{ eventIndex: 5, timestamp: 1n }]]]),
                }),
                1,
            ),
            touched({
                updatedEvents: updatedEvents([
                    [
                        groupA,
                        [
                            // updated again: comes back once, at the newer version
                            { eventIndex: 5, timestamp: 2n },
                            { eventIndex: 20, timestamp: 2n },
                            { eventIndex: 21, timestamp: 2n, threadRootMessageIndex: 7 },
                        ],
                    ],
                    [groupB, [{ eventIndex: 20, timestamp: 2n }]],
                ]),
            }),
            2,
        );
        const result = new ChatMap(updatesSince(since(), stamps, 1).updatedEvents);
        expect(result.get(groupA.id)).toEqual([
            { eventIndex: 5, threadRootMessageIndex: undefined, timestamp: 2n },
            { eventIndex: 20, threadRootMessageIndex: undefined, timestamp: 2n },
            { eventIndex: 21, threadRootMessageIndex: 7, timestamp: 2n },
        ]);
        expect(result.get(groupB.id)?.map((e) => e.eventIndex)).toEqual([20]);

        expect(updatesSince(since(), stamps, 2).updatedEvents.size).toBe(0);
    });

    test("new achievements and a suspension change are carried while past since", () => {
        const stamps = nextSyncStamps(
            undefined,
            touched({ chitEvents: [chitEvent(5)], suspensionChanged: true }),
            4,
        );
        const fresh = updatesSince(since(), stamps, 3);
        expect(fresh.newAchievements).toEqual([chitEvent(5)]);
        expect(fresh.suspensionChanged).toBe(true);

        const seen = updatesSince(since(), stamps, 4);
        expect(seen.newAchievements).toEqual([]);
        expect(seen.suspensionChanged).toBeUndefined();
    });
});
