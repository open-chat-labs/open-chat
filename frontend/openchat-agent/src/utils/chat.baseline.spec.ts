// Characterisation tests for the worker-side summary merge that runs on every
// getUpdates cycle. They pin down CURRENT behaviour (including the unbounded
// mention dedupe/cap) so performance work can be verified against them.
import {
    emptyChatMetrics,
    ROLE_ADMIN,
    ROLE_MEMBER,
    type EventWrapper,
    type GroupCanisterGroupChatSummaryUpdates,
    type GroupChatSummary,
    type Mention,
    type Message,
    type UserCanisterGroupChatSummaryUpdates,
} from "@shared";
import { MAX_MENTIONS, mergeGroupChatUpdates, mergeMentions } from "./chat";

function mention(index: number): Mention {
    return { messageId: BigInt(index), eventIndex: index, messageIndex: index };
}

function message(index: number): EventWrapper<Message> {
    return {
        index,
        timestamp: BigInt(1_700_000_000_000 + index),
        event: {
            kind: "message",
            messageId: BigInt(index),
            messageIndex: index,
            sender: "u1",
            content: { kind: "text_content", text: `m${index}` },
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: false,
            blockLevelMarkdown: false,
            ogPreviews: [],
            messagePreviews: [],
        },
    };
}

function group(id: string, extra: Partial<GroupChatSummary> = {}): GroupChatSummary {
    return {
        kind: "group_chat",
        name: id,
        description: "",
        id: { kind: "group_chat", groupId: id },
        lastUpdated: 0n,
        latestMessage: message(5),
        public: true,
        historyVisible: true,
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        latestEventIndex: 5,
        latestMessageIndex: 5,
        memberCount: 3,
        permissions: {
            changeRoles: ROLE_ADMIN,
            removeMembers: ROLE_ADMIN,
            deleteMessages: ROLE_ADMIN,
            updateGroup: ROLE_ADMIN,
            pinMessages: ROLE_ADMIN,
            inviteUsers: ROLE_ADMIN,
            addMembers: ROLE_ADMIN,
            reactToMessages: ROLE_MEMBER,
            mentionAllMembers: ROLE_MEMBER,
            startVideoCall: ROLE_ADMIN,
            messagePermissions: { default: ROLE_MEMBER },
            threadPermissions: undefined,
        },
        metrics: emptyChatMetrics(),
        subtype: undefined,
        previewed: false,
        frozen: false,
        dateLastPinned: undefined,
        dateReadPinned: undefined,
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        level: "group",
        eventsTTL: undefined,
        eventsTtlLastUpdated: 0n,
        membership: {
            lapsed: false,
            archived: false,
            mentions: [{ messageId: 1n, eventIndex: 1, messageIndex: 1 }],
            notificationsMuted: false,
            atEveryoneMuted: false,
            role: ROLE_MEMBER,
            readByMeUpTo: 3,
            joined: 0n,
            myMetrics: emptyChatMetrics(),
            rulesAccepted: true,
            latestThreads: [
                { threadRootMessageIndex: 1, lastUpdated: 1n, latestEventIndex: 3, latestMessageIndex: 3, readUpTo: 2 },
                { threadRootMessageIndex: 2, lastUpdated: 1n, latestEventIndex: 3, latestMessageIndex: 3 },
            ],
        },
        localUserIndex: "lui",
        isInvited: false,
        messagesVisibleToNonMembers: false,
        verified: false,
        ...extra,
    };
}

function groupUpdate(
    id: string,
    extra: Partial<GroupCanisterGroupChatSummaryUpdates> = {},
): GroupCanisterGroupChatSummaryUpdates {
    return {
        id: { kind: "group_chat", groupId: id },
        lastUpdated: 10n,
        name: undefined,
        description: undefined,
        subtype: undefined,
        avatarId: undefined,
        public: undefined,
        latestMessage: undefined,
        latestEventIndex: undefined,
        latestMessageIndex: undefined,
        memberCount: undefined,
        permissions: undefined,
        metrics: undefined,
        frozen: undefined,
        updatedEvents: [],
        dateLastPinned: undefined,
        gateConfig: undefined,
        eventsTTL: undefined,
        videoCallInProgress: undefined,
        membership: undefined,
        ...extra,
    };
}

function userUpdate(
    id: string,
    extra: Partial<UserCanisterGroupChatSummaryUpdates> = {},
): UserCanisterGroupChatSummaryUpdates {
    return {
        id: { kind: "group_chat", groupId: id },
        readByMeUpTo: undefined,
        threadsRead: {},
        archived: undefined,
        dateReadPinned: undefined,
        ...extra,
    };
}

describe("mergeGroupChatUpdates", () => {
    test("returns the same array when there are no updates", () => {
        const chats = [group("a")];
        expect(mergeGroupChatUpdates(chats, [], [])).toBe(chats);
    });

    test("returns the same chat object for chats with no matching update", () => {
        const chats = [group("a"), group("b")];
        const out = mergeGroupChatUpdates(chats, [], [groupUpdate("b", { name: "B!" })]);
        expect(out[0]).toBe(chats[0]);
        expect(out[1]).not.toBe(chats[1]);
        expect(out[1].name).toBe("B!");
    });

    test("prepends new mentions onto existing ones, deduped by messageId", () => {
        const chats = [group("a")];
        const upd = groupUpdate("a", {
            membership: {
                myRole: undefined,
                notificationsMuted: undefined,
                atEveryoneMuted: undefined,
                lapsed: undefined,
                unfollowedThreads: [],
                rulesAccepted: undefined,
                latestThreads: [],
                mentions: [
                    { messageId: 7n, eventIndex: 7, messageIndex: 7 },
                    { messageId: 1n, eventIndex: 1, messageIndex: 1 },
                ],
                myMetrics: undefined,
            },
        });
        const out = mergeGroupChatUpdates(chats, [], [upd]);
        expect(out[0].membership.mentions.map((m) => m.messageIndex)).toEqual([7, 1]);
    });

    test("mergeMentions dedupes by messageId keeping the incoming (newest) copy first", () => {
        const out = mergeMentions(
            [mention(9), mention(5)],
            [mention(5), mention(3)],
        );
        expect(out.map((m) => m.messageIndex)).toEqual([9, 5, 3]);
    });

    test("mergeMentions caps at MAX_MENTIONS keeping the newest", () => {
        // incoming 110..51 (newest first), existing 10..1
        const incoming = Array.from({ length: 60 }, (_, i) => mention(110 - i));
        const existing = Array.from({ length: 10 }, (_, i) => mention(10 - i));
        const out = mergeMentions(incoming, existing);
        expect(MAX_MENTIONS).toBe(50);
        expect(out.length).toBe(50);
        expect(out[0].messageIndex).toBe(110);
        expect(out[49].messageIndex).toBe(61);
    });

    test("group update without membership leaves mentions untouched", () => {
        const out = mergeGroupChatUpdates([group("a")], [], [groupUpdate("a", { name: "x" })]);
        expect(out[0].membership.mentions.map((m) => m.messageIndex)).toEqual([1]);
    });

    test("drops latestMessage when it no longer matches latestMessageIndex", () => {
        const out = mergeGroupChatUpdates(
            [group("a")],
            [],
            [groupUpdate("a", { latestMessageIndex: 9, latestEventIndex: 9 })],
        );
        expect(out[0].latestMessage).toBeUndefined();
        expect(out[0].latestMessageIndex).toBe(9);
    });

    test("clamps readByMeUpTo to the latest message index", () => {
        const out = mergeGroupChatUpdates([group("a")], [userUpdate("a", { readByMeUpTo: 50 })], []);
        expect(out[0].membership.readByMeUpTo).toBe(5);
    });

    test("merges threads: unfollowed removed, updates merged by root index, readUpTo only moves forward", () => {
        const upd = groupUpdate("a", {
            membership: {
                myRole: undefined,
                notificationsMuted: undefined,
                atEveryoneMuted: undefined,
                lapsed: undefined,
                unfollowedThreads: [2],
                rulesAccepted: undefined,
                latestThreads: [
                    { threadRootMessageIndex: 1, lastUpdated: 9n, latestEventIndex: 8, latestMessageIndex: 8 },
                    { threadRootMessageIndex: 3, lastUpdated: 9n, latestEventIndex: 1, latestMessageIndex: 1 },
                ],
                mentions: [],
                myMetrics: undefined,
            },
        });
        const u = userUpdate("a", { threadsRead: { 1: 1, 3: 1 } });
        const out = mergeGroupChatUpdates([group("a")], [u], [upd]);
        expect(out[0].membership.latestThreads).toEqual([
            { threadRootMessageIndex: 1, lastUpdated: 9n, latestEventIndex: 8, latestMessageIndex: 8, readUpTo: 2 },
            { threadRootMessageIndex: 3, lastUpdated: 9n, latestEventIndex: 1, latestMessageIndex: 1, readUpTo: 1 },
        ]);
    });

    test("does not mutate the input chat", () => {
        const chat = group("a");
        const snap = JSON.stringify(chat, (_, v) => (typeof v === "bigint" ? v.toString() : v));
        mergeGroupChatUpdates(
            [chat],
            [userUpdate("a", { readByMeUpTo: 4 })],
            [groupUpdate("a", { name: "changed" })],
        );
        expect(JSON.stringify(chat, (_, v) => (typeof v === "bigint" ? v.toString() : v))).toBe(snap);
    });

    test("snapshot of a full merge", () => {
        const out = mergeGroupChatUpdates(
            [group("a"), group("b")],
            [userUpdate("a", { readByMeUpTo: 4, archived: true, dateReadPinned: 77n })],
            [
                groupUpdate("a", {
                    name: "A2",
                    description: "desc",
                    avatarId: { value: 123n },
                    frozen: { value: true },
                    latestMessage: message(6),
                    latestMessageIndex: 6,
                    latestEventIndex: 6,
                    memberCount: 4,
                    dateLastPinned: 55n,
                    eventsTTL: { value: 1000n },
                    eventsTtlLastUpdated: 20n,
                    membership: {
                        myRole: ROLE_ADMIN,
                        notificationsMuted: true,
                        atEveryoneMuted: undefined,
                        lapsed: undefined,
                        unfollowedThreads: [],
                        rulesAccepted: false,
                        latestThreads: [],
                        mentions: [{ messageId: 6n, eventIndex: 6, messageIndex: 6 }],
                        myMetrics: undefined,
                    },
                }),
            ],
        );
        expect(out).toMatchSnapshot();
    });
});
