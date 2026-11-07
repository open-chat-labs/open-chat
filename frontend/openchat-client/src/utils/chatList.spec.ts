import { ChatMap, ChatSet, type ChatIdentifier, type ChatSummary } from "@shared";
import { describe, expect, test } from "vitest";
import { chatListOrder, chatsInScope } from "./chatList";

// only what the list reads: the kind, the id and the date it sorts by
function dm(userId: string, created: bigint): ChatSummary {
    return {
        kind: "direct_chat",
        id: { kind: "direct_chat", userId },
        them: { kind: "direct_chat", userId },
        dateCreated: created,
    } as ChatSummary;
}

function group(groupId: string, joined: bigint): ChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        membership: { joined },
    } as ChatSummary;
}

function channel(communityId: string, channelId: number): ChatSummary {
    return {
        kind: "channel",
        id: { kind: "channel", communityId, channelId },
        membership: { joined: 1n },
    } as ChatSummary;
}

const alice = dm("alice", 3n);
const bob = dm("bob", 1n);
const hikers = group("hikers", 2n);
const general = channel("c1", 1);
const other = channel("c2", 1);
const all = ChatMap.fromList([alice, bob, hikers, general, other]);

const ids = (chats: Iterable<ChatSummary>) => [...chats].map((c) => JSON.stringify(c.id));
const idsOf = (...chats: ChatSummary[]) => chats.map((c) => JSON.stringify(c.id));

describe("chatsInScope", () => {
    test("chats are the DMs and groups", () => {
        const chats = chatsInScope({ kind: "chats" }, all, new ChatSet());
        expect(ids(chats.values()).sort()).toEqual(idsOf(alice, bob, hikers).sort());
    });

    test("a community is its own channels", () => {
        const scope = { kind: "community", id: { kind: "community", communityId: "c1" } } as const;
        expect(ids(chatsInScope(scope, all, new ChatSet()).values())).toEqual(idsOf(general));
    });

    test("favourites are the favourite chats there are, of any kind", () => {
        const missing: ChatIdentifier = { kind: "group_chat", groupId: "gone" };
        const favourites = new ChatSet([bob.id, general.id, missing]);
        const chats = chatsInScope({ kind: "favourite" }, all, favourites);
        expect(ids(chats.values()).sort()).toEqual(idsOf(bob, general).sort());
    });

    test("no scope has no chats", () => {
        expect(chatsInScope({ kind: "none" }, all, new ChatSet()).size).toBe(0);
    });
});

describe("chatListOrder", () => {
    const chats = ChatMap.fromList([alice, bob, hikers]);

    test("the latest first", () => {
        expect(ids(chatListOrder([], chats))).toEqual(idsOf(alice, hikers, bob));
    });

    test("pinned chats first, in their pinned order, then the rest", () => {
        expect(ids(chatListOrder([bob.id, hikers.id], chats))).toEqual(idsOf(bob, hikers, alice));
    });

    test("a pinned chat that isn't in the scope is left out", () => {
        const elsewhere: ChatIdentifier = { kind: "group_chat", groupId: "elsewhere" };
        expect(ids(chatListOrder([elsewhere], chats))).toEqual(idsOf(alice, hikers, bob));
    });
});
