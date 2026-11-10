import { OPENCHAT_BOT_USER_ID, ROLE_MEMBER, ROLE_NONE, type ChatSummary } from "@client";
import { describe, expect, test } from "vitest";
import { chatMenuActions, chatRowActionLabel, chatRowHasMenu, chatRowMenu } from "./chatMenu";

function dm(userId: string): ChatSummary {
    return { kind: "direct_chat", id: { kind: "direct_chat", userId } } as ChatSummary;
}

const person = { canLeave: false, blocked: false, isBot: false };

describe("chatMenuActions", () => {
    // 4b invariant 4: the OpenChat bot's DM is never offered for deletion, whether or not the
    // caller says it's a bot (the chat-list row doesn't)
    test("never offers to delete the OpenChat bot's DM", () => {
        for (const isBot of [true, false]) {
            expect(chatMenuActions(dm(OPENCHAT_BOT_USER_ID), { ...person, isBot })).not.toContain(
                "delete",
            );
        }
    });

    test("offers to delete any other DM, and to block or unblock a person", () => {
        expect(chatMenuActions(dm("them"), person)).toEqual(["block", "delete"]);
        expect(chatMenuActions(dm("them"), { ...person, blocked: true })).toEqual([
            "unblock",
            "delete",
        ]);
    });

    test("offers to leave a group only to a member", () => {
        const group = (role: number) =>
            ({
                kind: "group_chat",
                id: { kind: "group_chat", groupId: "g" },
                membership: { role },
            }) as ChatSummary;
        expect(chatMenuActions(group(ROLE_MEMBER), { ...person, canLeave: true })).toEqual([
            "leave",
        ]);
        expect(chatMenuActions(group(ROLE_NONE), { ...person, canLeave: true })).toEqual([]);
    });
});

describe("chatRowMenu", () => {
    const membership = { notificationsMuted: false, archived: false, role: ROLE_MEMBER };
    const directChat = { ...dm("them"), membership } as ChatSummary;
    const group = (role: number, archived = false) =>
        ({
            kind: "group_chat",
            id: { kind: "group_chat", groupId: "g" },
            membership: { ...membership, role, archived },
        }) as ChatSummary;
    const state = { pinned: false, favourite: false, unread: 0, canLeave: true, canRemove: false };

    test("a DM: pin, favourite, mute, archive and delete, in the design's order", () => {
        expect(chatRowMenu(directChat, state)).toEqual([
            "pin",
            "favourite",
            "mute",
            "archive",
            "delete",
        ]);
    });

    test("a group the user is in: the same, with leave in place of delete", () => {
        expect(chatRowMenu(group(ROLE_MEMBER), state)).toEqual([
            "pin",
            "favourite",
            "mute",
            "archive",
            "leave",
        ]);
    });

    test("each toggle offers the other way round once it's on", () => {
        const muted = {
            ...directChat,
            membership: { ...membership, notificationsMuted: true },
        } as ChatSummary;
        expect(chatRowMenu(muted, { ...state, pinned: true, favourite: true })).toEqual(
            expect.arrayContaining(["unpin", "unfavourite", "unmute"]),
        );
        expect(chatRowMenu(group(ROLE_MEMBER, true), state)).toContain("unarchive");
    });

    test("mark as read only while something is unread", () => {
        expect(chatRowMenu(directChat, state)).not.toContain("mark_read");
        expect(chatRowMenu(directChat, { ...state, unread: 2 })).toContain("mark_read");
    });

    test("a group previewed but not joined can't be archived or left, only removed", () => {
        const actions = chatRowMenu(group(ROLE_NONE), { ...state, canRemove: true });
        expect(actions).not.toContain("archive");
        expect(actions).not.toContain("leave");
        expect(actions).toContain("remove");
    });
});

describe("chatRowHasMenu", () => {
    const membership = { notificationsMuted: false, archived: false, lapsed: false };
    const group = (role: number, lapsed = false) =>
        ({
            kind: "group_chat",
            id: { kind: "group_chat", groupId: "g" },
            membership: { ...membership, role, lapsed },
        }) as ChatSummary;
    const channel = (role: number) =>
        ({
            kind: "channel",
            id: { kind: "channel", communityId: "c", channelId: 1 },
            membership: { ...membership, role },
        }) as ChatSummary;

    test("a preview's row has none, a group's or a channel's (a guest's are all previews)", () => {
        expect(chatRowHasMenu(group(ROLE_NONE))).toBe(false);
        expect(chatRowHasMenu(channel(ROLE_NONE))).toBe(false);
    });

    test("a member's row has one, a lapsed member's too, and a DM's", () => {
        expect(chatRowHasMenu(group(ROLE_MEMBER))).toBe(true);
        expect(chatRowHasMenu(channel(ROLE_MEMBER))).toBe(true);
        expect(chatRowHasMenu(group(ROLE_MEMBER, true))).toBe(true);
        expect(chatRowHasMenu({ ...dm("them"), membership } as ChatSummary)).toBe(true);
    });
});

describe("chatRowActionLabel", () => {
    const channel = {
        kind: "channel",
        id: { kind: "channel", communityId: "c", channelId: 1 },
        level: "channel",
    } as ChatSummary;

    test("each item in the app's words", () => {
        expect(chatRowActionLabel("pin", dm("them")).key).toBe("pinChat.menuItem");
        expect(chatRowActionLabel("unfavourite", dm("them")).key).toBe(
            "communities.removeFromFavourites",
        );
        expect(chatRowActionLabel("mark_read", dm("them")).key).toBe("markAllRead");
        expect(chatRowActionLabel("delete", dm("them")).key).toBe("deleteChat");
    });

    test("leaving names the chat's level, lower case", () => {
        expect(chatRowActionLabel("leave", channel)).toMatchObject({
            key: "leaveGroup",
            level: "channel",
            lowercase: true,
        });
    });
});
