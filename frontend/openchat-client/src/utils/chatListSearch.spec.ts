import type { BotMatch, GroupMatch, UserSummary } from "@shared";
import { describe, expect, test, vi } from "vitest";
import {
    chatListSearchMatches,
    runChatListSearch,
    type ChatListSearchCalls,
} from "./chatListSearch";

const user = { userId: "u1", username: "lucy" } as UserSummary;
const bot = { kind: "bot_match", id: "b1", name: "lucybot" } as BotMatch;
const group = {
    kind: "group_match",
    chatId: { kind: "group_chat", groupId: "g1" },
    name: "Lucy's hikers",
} as GroupMatch;

function calls(): ChatListSearchCalls {
    return {
        users: vi.fn(async () => [user]),
        bots: vi.fn(async () => [bot]),
    };
}

function withGroups() {
    return { ...calls(), groups: vi.fn(async () => [group]) };
}

describe("runChatListSearch", () => {
    test("finds the people and bots for a term, and no groups without a groups call", async () => {
        const c = calls();
        expect(await runChatListSearch("lucy", c)).toEqual({
            users: [user],
            bots: [bot],
            groups: [],
        });
        expect(c.users).toHaveBeenCalledWith("lucy");
        expect(c.bots).toHaveBeenCalledWith("lucy");
    });

    // the new web UI's search lists public groups (the user's decision, 2026-11-12)
    test("finds the public groups too with a groups call", async () => {
        const c = withGroups();
        expect(await runChatListSearch("lucy", c)).toEqual({
            users: [user],
            bots: [bot],
            groups: [group],
        });
        expect(c.groups).toHaveBeenCalledWith("lucy");
    });

    // L1 invariant 4: the server search never calls the backend for an empty term
    test("asks the backend nothing for an empty term", async () => {
        const c = withGroups();
        expect(await runChatListSearch("", c)).toEqual({ users: [], bots: [], groups: [] });
        expect(c.users).not.toHaveBeenCalled();
        expect(c.bots).not.toHaveBeenCalled();
        expect(c.groups).not.toHaveBeenCalled();
    });

    test("a call that fails finds nothing, and the others still count", async () => {
        const c = {
            ...withGroups(),
            bots: vi.fn(async () => Promise.reject(new Error("offline"))),
            groups: vi.fn(async () => Promise.reject(new Error("offline"))),
        };
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(await runChatListSearch("lucy", c)).toEqual({
            users: [user],
            bots: [],
            groups: [],
        });
        warn.mockRestore();
    });
});

describe("chatListSearchMatches", () => {
    test("is the people, then the bots, as one list (the groups are apart)", () => {
        const bob = { userId: "u2", username: "bob" } as UserSummary;
        expect(chatListSearchMatches({ users: [user, bob], bots: [bot], groups: [group] })).toEqual(
            [user, bob, bot],
        );
    });

    test("is nothing when nothing was found", () => {
        expect(chatListSearchMatches({ users: [], bots: [], groups: [] })).toEqual([]);
    });
});
