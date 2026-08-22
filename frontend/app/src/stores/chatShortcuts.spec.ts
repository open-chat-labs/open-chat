import type { ChatSummary } from "@client";
import { selectShortcutChats } from "./chatShortcuts";

// Characterisation of the Direct Share tile selection. Input is already
// sorted by recency (most recent first), which is what the store hands it.
function direct(userId: string, date: number): ChatSummary {
    return {
        kind: "direct_chat",
        id: { kind: "direct_chat", userId },
        them: { kind: "user", userId },
        latestMessage: undefined,
        latestEventIndex: 0,
        dateCreated: BigInt(date),
        membership: {},
    } as unknown as ChatSummary;
}

function group(groupId: string, date: number): ChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        name: groupId,
        latestMessage: undefined,
        latestEventIndex: 0,
        membership: { joined: BigInt(date) },
    } as unknown as ChatSummary;
}

const ids = (chats: ChatSummary[]) =>
    chats.map((c) =>
        c.kind === "direct_chat" ? c.them.userId : c.kind === "group_chat" ? c.id.groupId : "",
    );

describe("selectShortcutChats", () => {
    test("reserves 2 directs and 1 group, fills by recency, re-sorted by recency", () => {
        const sorted = [
            group("g1", 10),
            group("g2", 9),
            group("g3", 8),
            direct("d1", 7),
            direct("d2", 6),
            group("g4", 5),
        ];
        expect(ids(selectShortcutChats(sorted))).toEqual(["g1", "g2", "d1", "d2"]);
    });

    test("falls back to groups when there are no directs", () => {
        const sorted = [group("g1", 10), group("g2", 9), group("g3", 8), group("g4", 7), group("g5", 6)];
        expect(ids(selectShortcutChats(sorted))).toEqual(["g1", "g2", "g3", "g4"]);
    });

    test("falls back to directs when there are no groups", () => {
        const sorted = [direct("d1", 10), direct("d2", 9), direct("d3", 8), direct("d4", 7), direct("d5", 6)];
        expect(ids(selectShortcutChats(sorted))).toEqual(["d1", "d2", "d3", "d4"]);
    });

    test("returns fewer than 4 when there are fewer sendable chats", () => {
        expect(ids(selectShortcutChats([direct("d1", 2), group("g1", 1)]))).toEqual(["d1", "g1"]);
        expect(selectShortcutChats([])).toEqual([]);
    });
});
