import type { ChatSummary } from "@client";
import { chatRow, listed, swatchFor, type RowContext } from "./chatList.adapter";

const membership = { notificationsMuted: false, archived: false, joined: 0n };

function dm(userId: string, latest?: { sender: string; text: string; at: bigint }): ChatSummary {
    return {
        kind: "direct_chat",
        id: { kind: "direct_chat", userId },
        them: { kind: "direct_chat", userId },
        dateCreated: 1n,
        eventsTtlLastUpdated: 0n,
        membership,
        latestMessage: latest && {
            timestamp: latest.at,
            event: { sender: latest.sender, content: { kind: "text_content", text: latest.text } },
        },
    } as unknown as ChatSummary;
}

function group(
    groupId: string,
    name: string,
    latest?: { sender: string; text: string },
): ChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        name,
        eventsTtlLastUpdated: 0n,
        membership,
        latestMessage: latest && {
            timestamp: 5n,
            event: { sender: latest.sender, content: { kind: "text_content", text: latest.text } },
        },
    } as unknown as ChatSummary;
}

const ctx: RowContext = {
    me: "me",
    you: "You",
    userName: (id) => ({ alice: "Alice", bob: "Bob" })[id] ?? id,
    contentText: (content) => (content as { text: string }).text,
    date: (timestamp) => `t${timestamp}`,
    unread: () => 0,
    pinned: new Set<string>(),
};

describe("a chat list row", () => {
    test("for a DM is the other user, with their latest message as it is", () => {
        expect(chatRow(dm("alice", { sender: "alice", text: "hi", at: 7n }), ctx)).toMatchObject({
            id: "alice",
            title: "Alice",
            preview: "hi",
            time: "t7",
            kind: "user",
        });
    });

    test("for a group puts the sender before its latest message, the reader as You", () => {
        expect(chatRow(group("g1", "Hikers", { sender: "bob", text: "trail?" }), ctx).preview).toBe(
            "Bob: trail?",
        );
        expect(chatRow(group("g1", "Hikers", { sender: "me", text: "yes" }), ctx).preview).toBe(
            "You: yes",
        );
        expect(chatRow(group("g1", "Hikers"), ctx)).toMatchObject({
            title: "Hikers",
            preview: "",
            kind: "group",
        });
    });

    test("is pinned (in the Pinned section), selected and unread as the context says", () => {
        const row = chatRow(dm("bob"), {
            ...ctx,
            pinned: new Set(["bob"]),
            selected: "bob",
            unread: () => 3,
        });
        expect(row).toMatchObject({
            pinned: true,
            section: "Pinned",
            selected: true,
            unreadCount: 3,
        });
        expect(chatRow(dm("alice"), ctx)).toMatchObject({
            pinned: false,
            section: "Recent",
            selected: false,
        });
    });

    test("shows a call going on and muted notifications", () => {
        const live = {
            ...dm("bob"),
            videoCallInProgress: { messageIndex: 1 },
        } as unknown as ChatSummary;
        expect(chatRow(live, ctx).liveCall).toBe("video");
        const muted = {
            ...dm("bob"),
            membership: { ...membership, notificationsMuted: true },
        } as ChatSummary;
        expect(chatRow(muted, ctx).muted).toBe(true);
        expect(chatRow(dm("bob"), ctx)).toMatchObject({ liveCall: "", muted: false });
    });

    test("gets the same swatch for the same chat, from the design's", () => {
        expect(swatchFor("alice")).toBe(swatchFor("alice"));
        expect(["violet", "blue", "teal", "amber", "plum"]).toContain(swatchFor("bob"));
    });
});

describe("a chat whose latest message has disappeared", () => {
    const expiring = (expiresAt: number) => {
        const chat = dm("alice", { sender: "alice", text: "secret", at: 7n });
        return { ...chat, latestMessage: { ...chat.latestMessage!, expiresAt } } as ChatSummary;
    };
    const unread = { ...ctx, unread: () => 3 };

    test("shows no preview and no unread count", () => {
        expect(chatRow(expiring(1_000), unread, 2_000)).toMatchObject({
            preview: "",
            unreadCount: 0,
        });
    });

    test("shows them until it goes", () => {
        expect(chatRow(expiring(3_000), unread, 2_000)).toMatchObject({
            preview: "secret",
            unreadCount: 3,
        });
    });
});

describe("whether a chat is in the list", () => {
    const archived = {
        ...group("g1", "Archive"),
        membership: { ...membership, archived: true },
    } as ChatSummary;

    test("leaves archived chats out until there's a search", () => {
        expect(listed(group("g2", "Open"), "Open", "")).toBe(true);
        expect(listed(archived, "Archive", "  ")).toBe(false);
        expect(listed(archived, "Archive", "arch")).toBe(true);
    });

    test("searching, takes the chats whose title has the text, in any case", () => {
        expect(listed(group("g2", "Open"), "Open", " OP ")).toBe(true);
        expect(listed(group("g2", "Open"), "Open", "closed")).toBe(false);
    });
});
