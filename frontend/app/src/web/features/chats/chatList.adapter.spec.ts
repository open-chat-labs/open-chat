import type { ChatSummary } from "@client";
import {
    chatRow,
    communityHeaderMenu,
    listed,
    swatchFor,
    type RowContext,
} from "./chatList.adapter";

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
    userName: (id) => ({ alice: "Alice", bob: "Bob" })[id] ?? id,
    // the preview line itself is latestMessagePreview's (app/src/logic/chats)
    preview: (chat) =>
        (chat.latestMessage?.event.content as { text: string } | undefined)?.text ?? "",
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

    test("for a group is its name and kind", () => {
        expect(chatRow(group("g1", "Hikers"), ctx)).toMatchObject({
            title: "Hikers",
            kind: "group",
        });
    });

    test("is locked for a private group, not a public one or a direct chat", () => {
        const g = group("g1", "Hikers");
        expect(chatRow({ ...g, public: false } as ChatSummary, ctx).locked).toBe(true);
        expect(chatRow({ ...g, public: true } as ChatSummary, ctx).locked).toBe(false);
        expect(chatRow(dm("bob"), ctx).locked).toBe(false);
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

    test("shows no unread count once it has gone", () => {
        expect(chatRow(expiring(1_000), unread, 2_000).unreadCount).toBe(0);
        expect(chatRow(expiring(3_000), unread, 2_000).unreadCount).toBe(3);
    });
});

describe("whether a chat is in the list", () => {
    const archived = {
        ...group("g1", "Archive"),
        membership: { ...membership, archived: true },
    } as ChatSummary;
    const users = new Map([
        ["alice", { userId: "alice", username: "alice_w", displayName: "Wanda" }],
    ]) as never;
    const withDescription = { ...group("g2", "Open"), description: "weekend walks" } as ChatSummary;

    test("leaves archived chats out until there's a search", () => {
        expect(listed(withDescription, "", users)).toBe(true);
        expect(listed(archived, "  ", users)).toBe(false);
        expect(listed({ ...archived, description: "" } as ChatSummary, "arch", users)).toBe(true);
    });

    /** Invariant: the new list searches as the old one does (chatMatchesSearch). */
    test("searching, matches a group's description and a DM's username or display name", () => {
        expect(listed(withDescription, " WALKS ", users)).toBe(true);
        expect(listed(dm("alice"), "alice_", users)).toBe(true);
        expect(listed(dm("alice"), "wan", users)).toBe(true);
        expect(listed(withDescription, "closed", users)).toBe(false);
    });
});

describe("a community's header menu", () => {
    const ids = (can: { canCreateChannel: boolean; canManageUserGroups: boolean }) =>
        communityHeaderMenu({
            canLeave: true,
            canDelete: false,
            canEdit: true,
            canInvite: true,
            ...can,
            label: (key) => key,
        }).map((item) => item.id);

    // 4b invariant 7: New user group only for someone who may manage user groups
    test("offers New user group only to someone who may manage them", () => {
        expect(ids({ canCreateChannel: true, canManageUserGroups: false })).not.toContain(
            "newUserGroup",
        );
        expect(ids({ canCreateChannel: true, canManageUserGroups: true })).toContain(
            "newUserGroup",
        );
    });

    // 4b invariant 7: New channel and Add embedded channel only for someone who can create one
    test("offers the new channel items only to someone who can create a channel", () => {
        const without = ids({ canCreateChannel: false, canManageUserGroups: true });
        expect(without).not.toContain("newChannel");
        expect(without).not.toContain("embedChannel");
        expect(ids({ canCreateChannel: true, canManageUserGroups: true })).toEqual(
            expect.arrayContaining(["newChannel", "embedChannel"]),
        );
    });
});
