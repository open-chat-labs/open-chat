import { describe, expect, test } from "vitest";
import {
    groupMembersLine,
    sharedDraftText,
    shareTargets,
    type ShareableChat,
    type ShareTargetsInput,
} from "./shareTargets";

const dm = (userId: string): ShareableChat => ({
    kind: "direct_chat",
    id: { kind: "direct_chat", userId },
    them: { userId },
});
const group = (id: string, name: string): ShareableChat => ({
    kind: "group_chat",
    id: { kind: "group_chat", groupId: id },
    name,
});
const channel = (communityId: string, channelId: number, name: string): ShareableChat => ({
    kind: "channel",
    id: { kind: "channel", communityId, channelId },
    name,
});

const USERS: Record<string, { name: string; username: string }> = {
    u1: { name: "Zoe", username: "zoe_42" },
    u2: { name: "Adam", username: "adamsmith" },
};

function input(
    over: Partial<
        ShareTargetsInput<ShareableChat, { name: string; channels: ShareableChat[] }>
    > = {},
) {
    return {
        directChats: [dm("u1"), dm("u2")],
        groupChats: [group("g1", "Rust fans"), group("g2", "Announcements")],
        communities: [
            { name: "OpenChat", channels: [channel("c1", 1, "General"), channel("c1", 2, "Dev")] },
            { name: "Gardening", channels: [channel("c2", 1, "Roses")] },
        ],
        isFavourite: (id: { kind: string }) =>
            id.kind === "group_chat" && "groupId" in id && id.groupId === "g1",
        directChatName: (userId: string) => USERS[userId],
        canSendText: () => true,
        selectedChatId: undefined,
        excludeCurrent: true,
        search: "",
        ...over,
    };
}

const names = (ts: { name: string }[]) => ts.map((t) => t.name);

describe("the chats something can be shared to", () => {
    test("are the DMs, groups, favourites and communities' channels, each sorted by name", () => {
        const t = shareTargets(input());
        expect(names(t.directChats)).toEqual(["Adam", "Zoe"]);
        expect(names(t.groupChats)).toEqual(["Announcements", "Rust fans"]);
        expect(names(t.favourites)).toEqual(["Rust fans"]);
        expect(t.communities.map((c) => c.community.name)).toEqual(["Gardening", "OpenChat"]);
        expect(names(t.communities[1].channels)).toEqual(["Dev", "General"]);
    });

    test("invariant 1: never a chat the user can't send text in", () => {
        const t = shareTargets(
            input({ canSendText: (id) => !(id.kind === "group_chat" && id.groupId === "g2") }),
        );
        expect(names(t.groupChats)).toEqual(["Rust fans"]);
    });

    test("invariant 2: the open chat is left out unless the caller asks for it", () => {
        const open = { kind: "direct_chat" as const, userId: "u1" };
        expect(names(shareTargets(input({ selectedChatId: open })).directChats)).toEqual(["Adam"]);
        expect(
            names(shareTargets(input({ selectedChatId: open, excludeCurrent: false })).directChats),
        ).toEqual(["Adam", "Zoe"]);
    });

    test("a search matches a name or a DM's @username", () => {
        expect(names(shareTargets(input({ search: "@zoe" })).directChats)).toEqual(["Zoe"]);
        expect(names(shareTargets(input({ search: "rust" })).groupChats)).toEqual(["Rust fans"]);
        expect(shareTargets(input({ search: "nothing like it" })).directChats).toEqual([]);
    });

    test("a community whose name matches keeps all its channels, else only those that match", () => {
        const byName = shareTargets(input({ search: "open" }));
        expect(byName.communities.map((c) => names(c.channels))).toEqual([["Dev", "General"]]);
        const byChannel = shareTargets(input({ search: "gen" }));
        expect(byChannel.communities.map((c) => names(c.channels))).toEqual([["General"]]);
    });
});

describe("a group's line in the picker", () => {
    test("says whether it's public and how many members it has, in its level", () => {
        expect(groupMembersLine({ public: true, memberCount: 12, level: "group" })).toEqual({
            kind: "resource_key",
            key: "publicGroupWithN",
            params: { number: 12 },
            level: "group",
            lowercase: true,
        });
    });
});

describe("the text a share from another app puts in the draft", () => {
    test("invariant 3: the text or else the title, then the url on its own line; no blank line for an empty field", () => {
        expect(sharedDraftText({ title: "T", text: "Body", url: "https://x" })).toBe(
            "Body\nhttps://x",
        );
        expect(sharedDraftText({ title: "T", text: "", url: "https://x" })).toBe("T\nhttps://x");
        expect(sharedDraftText({ text: "Body" })).toBe("Body");
        expect(sharedDraftText({ url: "https://x" })).toBe("https://x");
        expect(sharedDraftText({})).toBe("");
    });
});
