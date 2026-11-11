import type { ChatSummary, UserSummary } from "@client";
import type { ChatListRow } from "@src/logic/chats/chatRow";
import { describe, expect, test } from "vitest";
import { chatResult, nativeChatRow, personResult, rowMenuItems } from "./chats.adapter";

const row: ChatListRow = {
    id: "g1",
    title: "Hikers",
    preview: "Lucy: see you there",
    previewIcon: "forward",
    time: "10:48",
    kind: "group",
    color: "teal",
    avatarUrl: "/assets/group.svg",
    locked: true,
    unreadCount: 2,
    mentions: 1,
    muted: true,
    pinned: true,
    section: "Pinned",
    liveCall: "",
    selected: false,
};

describe("a row's long-press menu", () => {
    test("has the design's icons, and the destructive items in red under one divider", () => {
        const items = rowMenuItems(["pin", "favourite", "mute", "archive", "leave"], (a) => a);
        expect(items.map((i) => i.icon)).toEqual(["pin", "heart", "bell-off", "eye-off", "exit"]);
        expect(items.filter((i) => i.danger).map((i) => i.id)).toEqual(["leave"]);
        expect(items.filter((i) => i.separator).map((i) => i.id)).toEqual(["leave"]);
    });

    test("labels each item with the screen's words", () => {
        const items = rowMenuItems(["unmute"], (a) => `label:${a}`);
        expect(items[0]).toMatchObject({ id: "unmute", label: "label:unmute", icon: "bell" });
    });
});

describe("a native chat row", () => {
    test("is the list row's ChatRow props, with the favourite's heart", () => {
        expect(nativeChatRow(row, true)).toEqual({
            title: "Hikers",
            preview: "Lucy: see you there",
            previewIcon: "forward",
            time: "10:48",
            kind: "group",
            color: "teal",
            locked: true,
            unreadCount: 2,
            muted: true,
            pinned: true,
            liveCall: "",
            fav: true,
        });
    });
});

describe("search results", () => {
    test("a DM shows the other user's @username; a group its latest message", () => {
        const dm = {
            kind: "direct_chat",
            them: { kind: "direct_chat", userId: "u1" },
        } as ChatSummary;
        const dmRow = { ...row, id: "u1", title: "Lucy Linden", kind: "user" } as const;
        expect(chatResult(dm, dmRow, "lin", () => "lucy")).toMatchObject({
            id: "u1",
            title: { before: "Lucy ", match: "Lin", after: "den" },
            sub: "@lucy",
            kind: "user",
        });
        const group = { kind: "group_chat" } as ChatSummary;
        expect(chatResult(group, row, "hik", () => undefined)).toMatchObject({
            sub: "Lucy: see you there",
            kind: "group",
            color: "teal",
        });
    });

    test("a person is their name, matched, over their @username", () => {
        const user = { userId: "u2", username: "matt" } as UserSummary;
        expect(personResult(user, "Matt Webb", "web")).toMatchObject({
            id: "u2",
            title: { before: "Matt ", match: "Web", after: "b" },
            sub: "@matt",
            kind: "user",
        });
    });
});
