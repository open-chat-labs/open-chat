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
    emptySyncStamps,
    emptyTouched,
    mergeUpdatedEventStamps,
    nextSyncStamps,
    SYNCED_FIELDS,
    updatesSince,
    type SyncStamps,
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

describe("nextSyncStamps", () => {
    test("stamps touched and unknown chats with the version and keeps the rest", () => {
        const prev: SyncStamps = {
            ...emptySyncStamps(),
            directChats: { u1: 3, u2: 3 },
            groupChats: { a: 2 },
        };
        const next = nextSyncStamps(
            prev,
            state({
                directChats: [direct("u1"), direct("u2"), direct("u3")],
                groupChats: [groupA],
            }),
            touched({ directChats: new Set(["u2"]) }),
            7,
        );
        expect(next.directChats).toEqual({ u1: 3, u2: 7, u3: 7 });
        expect(next.groupChats).toEqual({ a: 2 });
    });

    test("a chat that was stamped and is now gone gets a tombstone at the version", () => {
        const prev: SyncStamps = {
            ...emptySyncStamps(),
            groupChats: { a: 2, b: 2 },
            removedCommunities: { c9: 1 },
        };
        const next = nextSyncStamps(prev, state({ groupChats: [groupA] }), touched(), 5);
        expect(next.groupChats).toEqual({ a: 2 });
        expect(next.removedGroupChats).toEqual({ b: 5 });
        // older tombstones for other kinds are carried
        expect(next.removedCommunities).toEqual({ c9: 1 });
    });

    test("a tombstone is dropped when its chat is back", () => {
        const prev: SyncStamps = { ...emptySyncStamps(), removedGroupChats: { b: 4 } };
        const next = nextSyncStamps(prev, state({ groupChats: [groupB] }), touched(), 6);
        expect(next.removedGroupChats).toEqual({});
        expect(next.groupChats).toEqual({ b: 6 });
    });

    test("every field is stamped the first time and touched fields move to the version", () => {
        const first = nextSyncStamps(undefined, state(), touched(), 1);
        for (const field of SYNCED_FIELDS) {
            expect(first.fields[field]).toBe(1);
        }
        const second = nextSyncStamps(
            first,
            state(),
            touched({ fields: new Set(["blockedUsers"]) }),
            2,
        );
        expect(second.fields.blockedUsers).toBe(2);
        expect(second.fields.avatarId).toBe(1);
    });

    test("chit events are batched at the version and the suspension version is recorded", () => {
        const events = [chitEvent(1)];
        const next = nextSyncStamps(
            undefined,
            state(),
            touched({ chitEvents: events, suspensionChanged: true }),
            3,
        );
        expect(next.chitEvents).toEqual([{ version: 3, events }]);
        expect(next.suspension).toBe(3);

        const later = nextSyncStamps(next, state(), touched(), 4);
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

    test("returns only the records and removals stamped after since", () => {
        const stamps: SyncStamps = {
            ...emptySyncStamps(),
            directChats: { u1: 1, u2: 5 },
            groupChats: { a: 5, b: 2 },
            communities: { c1: 1 },
            removedDirectChats: { u9: 4 },
            removedGroupChats: { g9: 3 },
            removedCommunities: { c9: 6 },
        };
        const result = updatesSince(full, stamps, 3);
        expect(result.directChatsAddedUpdated.map((c) => c.id.userId)).toEqual(["u2"]);
        expect(result.groupsAddedUpdated.map((g) => g.id.groupId)).toEqual(["a"]);
        expect(result.communitiesAddedUpdated).toEqual([]);
        expect(result.directChatsRemoved).toEqual(["u9"]);
        expect(result.groupsRemoved).toEqual([]);
        expect(result.communitiesRemoved).toEqual(["c9"]);
    });

    test("a record with no stamp is carried rather than skipped", () => {
        const stamps: SyncStamps = { ...emptySyncStamps(), groupChats: { a: 1 } };
        const result = updatesSince(full, stamps, 10);
        expect(result.groupsAddedUpdated.map((g) => g.id.groupId)).toEqual(["b"]);
        expect(result.directChatsAddedUpdated.map((c) => c.id.userId)).toEqual(["u1", "u2"]);
    });

    test("fields stamped after since are returned, option fields as option updates", () => {
        const stamps = nextSyncStamps(undefined, full, touched(), 1);
        const before = updatesSince(full, stamps, 1);
        expect(before.avatarId).toBeUndefined();
        expect(before.blockedUsers).toBeUndefined();
        expect(before.pinNumberSettings).toBeUndefined();

        const after = updatesSince(full, stamps, 0);
        expect(after.avatarId).toEqual({ value: 99n });
        expect(after.blockedUsers).toEqual(["x"]);
        expect(after.pinNumberSettings).toBe("set_to_none");
        expect(after.streakInsurance).toBe("set_to_none");
    });

    test("updated events stamped after since come back for every chat, once each", () => {
        const stamps = nextSyncStamps(
            nextSyncStamps(
                undefined,
                full,
                touched({
                    updatedEvents: updatedEvents([[groupA, [{ eventIndex: 5, timestamp: 1n }]]]),
                }),
                1,
            ),
            full,
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
        const result = new ChatMap(updatesSince(full, stamps, 1).updatedEvents);
        expect(result.get(groupA.id)).toEqual([
            { eventIndex: 5, threadRootMessageIndex: undefined, timestamp: 2n },
            { eventIndex: 20, threadRootMessageIndex: undefined, timestamp: 2n },
            { eventIndex: 21, threadRootMessageIndex: 7, timestamp: 2n },
        ]);
        expect(result.get(groupB.id)?.map((e) => e.eventIndex)).toEqual([20]);

        expect(updatesSince(full, stamps, 2).updatedEvents.size).toBe(0);
    });

    test("new achievements and a suspension change are carried while past since", () => {
        const stamps = nextSyncStamps(
            undefined,
            full,
            touched({ chitEvents: [chitEvent(5)], suspensionChanged: true }),
            4,
        );
        const fresh = updatesSince(full, stamps, 3);
        expect(fresh.newAchievements).toEqual([chitEvent(5)]);
        expect(fresh.suspensionChanged).toBe(true);

        const seen = updatesSince(full, stamps, 4);
        expect(seen.newAchievements).toEqual([]);
        expect(seen.suspensionChanged).toBeUndefined();
    });
});
