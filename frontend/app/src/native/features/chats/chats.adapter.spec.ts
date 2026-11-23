import type { BotMatch, ChatSummary, GroupMatch, UserSummary } from "@client";
import type { ChatListRow } from "@src/logic/chats/chatRow";
import { describe, expect, test } from "vitest";
import {
    chatResult,
    foundResults,
    groupResult,
    nativeChatRow,
    personResult,
    rowMenuItems,
    searchSections,
    type ResultRow,
} from "./chats.adapter";

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
    suspended: false,
    titleLoading: false,
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
            suspended: false,
            titleLoading: false,
            fav: true,
        });
    });

    test("shows a DM whose other user is still loading as loading, as the web's row", () => {
        const dm: ChatListRow = { ...row, kind: "user", locked: false, titleLoading: true };
        expect(nativeChatRow(dm, false).titleLoading).toBe(true);
    });

    test("marks a DM whose other user is suspended, as the web's row", () => {
        const dm: ChatListRow = { ...row, kind: "user", locked: false, suspended: true };
        expect(nativeChatRow(dm, false).suspended).toBe(true);
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
            subMarkdown: false,
            kind: "user",
        });
        const group = { kind: "group_chat" } as ChatSummary;
        expect(chatResult(group, row, "hik", () => undefined)).toMatchObject({
            sub: "Lucy: see you there",
            subMarkdown: true,
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
            subMarkdown: false,
            kind: "user",
        });
    });

    test("a public group is its name, matched, over its member count", () => {
        const group = {
            chatId: { kind: "group_chat", groupId: "g9" },
            name: "N6 Book Club",
            memberCount: 12,
        } as GroupMatch;
        expect(groupResult(group, "12 members", "book")).toMatchObject({
            id: "g9",
            title: { before: "N6 ", match: "Book", after: " Club" },
            sub: "12 members",
            subMarkdown: false,
            kind: "group",
        });
    });
});

describe("what the search found on OpenChat", () => {
    const user = (userId: string, username: string) => ({ userId, username }) as UserSummary;
    const bot = (id: string, name: string) =>
        ({ id, name, definition: { description: `${name} helps` } }) as BotMatch;
    const group = (groupId: string, name: string, memberCount: number) =>
        ({ chatId: { kind: "group_chat", groupId }, name, memberCount }) as GroupMatch;
    const dm = (userId: string) =>
        ({
            kind: "direct_chat",
            id: { kind: "direct_chat", userId },
            them: { userId },
        }) as ChatSummary;
    const joined = (groupId: string) =>
        ({ kind: "group_chat", id: { kind: "group_chat", groupId } }) as ChatSummary;

    const results = (chats: ChatSummary[]) =>
        foundResults({
            found: {
                users: [user("me", "me"), user("u1", "lucy"), user("u2", "matt")],
                bots: [bot("b1", "Quizzer")],
                groups: [group("g1", "N6 Book Club", 3), group("g2", "N6 Runners", 1)],
            },
            chats,
            me: "me",
            term: "n6",
            userName: (u) => u.username,
            members: (count) => `${count} members`,
        });

    test("people are the people found, then the bots; groups the public groups", () => {
        const { people, groups } = results([]);
        expect(people.map((r) => r.id)).toEqual(["u1", "u2", "b1"]);
        expect(people[2]).toMatchObject({ sub: "Quizzer helps", kind: "user" });
        expect(groups.map((r) => r.id)).toEqual(["g1", "g2"]);
        expect(groups[0]).toMatchObject({ sub: "3 members", kind: "group" });
    });

    test("leave out the user, anyone already a DM, and the groups the user is in", () => {
        const { people, groups } = results([dm("u2"), joined("g1")]);
        expect(people.map((r) => r.id)).toEqual(["u1", "b1"]);
        expect(groups.map((r) => r.id)).toEqual(["g2"]);
    });
});

describe("the search's sections", () => {
    const rows = (prefix: string, n: number): ResultRow[] =>
        Array.from({ length: n }, (_, i) => ({
            id: `${prefix}${i}`,
            title: { before: `${prefix}${i}`, match: "", after: "" },
            sub: "",
            subMarkdown: false,
            kind: "user",
            color: "teal",
        }));

    test("are Chats, People and Public groups in that order, the empty ones left out", () => {
        const sections = searchSections(
            { chats: rows("c", 1), people: [], groups: rows("g", 2) },
            {},
        );
        expect(sections.map((s) => s.id)).toEqual(["chats", "groups"]);
    });

    test("show their first 3 until expanded, with Show all", () => {
        const [groups] = searchSections({ chats: [], people: [], groups: rows("g", 5) }, {});
        expect(groups?.section).toMatchObject({ total: 5, more: true });
        expect(groups?.section.rows.map((r) => r.id)).toEqual(["g0", "g1", "g2"]);
        const [all] = searchSections(
            { chats: [], people: [], groups: rows("g", 5) },
            { groups: true },
        );
        expect(all?.section.rows).toHaveLength(5);
    });
});
