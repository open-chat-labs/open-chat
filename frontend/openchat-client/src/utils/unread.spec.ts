import {
    CommunityMap,
    emptyCombinedUnreadCounts,
    type ChatSummary,
    type CombinedUnreadCounts,
} from "@shared";
import { describe, expect, test } from "vitest";
import { scopeUnreadCounts, unreadCountShown, unreadMentionCount } from "./unread";

const mentions = [
    { messageIndex: 1, messageId: 11n },
    { messageIndex: 2, messageId: 12n },
    { messageIndex: 3, messageId: 13n },
];

const chat = (kind: ChatSummary["kind"]) => ({ kind, membership: { mentions } }) as ChatSummary;

describe("unreadMentionCount", () => {
    // L1 invariant 1: a DM's unread mention count is always 0
    test("is 0 for a DM, whatever it holds", () => {
        expect(unreadMentionCount(chat("direct_chat"), () => false)).toBe(0);
    });

    // L1 invariant 1: a group's or channel's counts only the mentions isMessageRead says are unread
    test("counts a group's or channel's mentions that aren't read yet", () => {
        const read = (index: number, id: bigint) => index === 2 && id === 12n;
        expect(unreadMentionCount(chat("group_chat"), read)).toBe(2);
        expect(unreadMentionCount(chat("channel"), read)).toBe(2);
        expect(unreadMentionCount(chat("channel"), () => true)).toBe(0);
    });
});

describe("scopeUnreadCounts", () => {
    const counts = (n: number): CombinedUnreadCounts => ({
        chats: { muted: 0, unmuted: n, mentions: false },
        threads: { muted: n, unmuted: 0, mentions: false },
    });
    const communityId = { kind: "community", communityId: "c1" } as const;
    const communityChannels = new CommunityMap<CombinedUnreadCounts>();
    communityChannels.set(communityId, counts(3));
    const input = { directAndGroup: counts(1), favourite: counts(2), communityChannels };

    // L1 invariant 3: the route scope's counts (community scope: that community's)
    test("are the scope's: DMs and groups, favourites, or that community's channels", () => {
        expect(scopeUnreadCounts({ kind: "chats" }, input)).toEqual(counts(1));
        expect(scopeUnreadCounts({ kind: "favourite" }, input)).toEqual(counts(2));
        expect(scopeUnreadCounts({ kind: "community", id: communityId }, input)).toEqual(counts(3));
    });

    test("are empty for a community with no counts, and for no scope", () => {
        const other = { kind: "community", id: { kind: "community", communityId: "c2" } } as const;
        expect(scopeUnreadCounts(other, input)).toEqual(emptyCombinedUnreadCounts());
        expect(scopeUnreadCounts({ kind: "none" }, input)).toEqual(emptyCombinedUnreadCounts());
    });
});

describe("unreadCountShown", () => {
    test("is the unmuted count while there is one", () => {
        expect(unreadCountShown({ muted: 4, unmuted: 2, mentions: false })).toEqual({
            count: 2,
            muted: false,
        });
    });

    test("is the muted count, muted, when nothing unmuted is unread and nothing mentions", () => {
        expect(unreadCountShown({ muted: 4, unmuted: 0, mentions: false })).toEqual({
            count: 4,
            muted: true,
        });
    });

    test("stays unmuted with a mention, even at 0", () => {
        expect(unreadCountShown({ muted: 4, unmuted: 0, mentions: true })).toEqual({
            count: 0,
            muted: false,
        });
    });
});
