import type { BotMatch, GroupMatch, UserSummary } from "@shared";
import { describe, expect, test, vi } from "vitest";
import {
    chatListSearchMatches,
    chatListSearchResults,
    runChatListSearch,
    type ChatListSearch,
    type ChatListSearchCalls,
    type ChatListSearchResults,
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
        expect(await chatListSearchResults(runChatListSearch("lucy", c))).toEqual({
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
        expect(await chatListSearchResults(runChatListSearch("lucy", c))).toEqual({
            users: [user],
            bots: [bot],
            groups: [group],
        });
        expect(c.groups).toHaveBeenCalledWith("lucy");
    });

    // L1 invariant 4: the server search never calls the backend for an empty term
    test("asks the backend nothing for an empty term", async () => {
        const c = withGroups();
        expect(await chatListSearchResults(runChatListSearch("", c))).toEqual({
            users: [],
            bots: [],
            groups: [],
        });
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
        const search = runChatListSearch("lucy", c);
        expect(await search.users).toEqual([user]);
        expect(await search.bots).toEqual([]);
        expect(await search.groups).toEqual([]);
        warn.mockRestore();
    });

    // review of #10477: a slow group index holds back no people or bots
    test("each kind arrives on its own: the people don't wait for the groups", async () => {
        const c = { ...calls(), groups: vi.fn(() => new Promise<GroupMatch[]>(() => {})) };
        const search = runChatListSearch("lucy", c);
        expect(await search.users).toEqual([user]);
        expect(await search.bots).toEqual([bot]);
    });
});

describe("chatListSearchResults", () => {
    function deferred<T>() {
        let resolve: (value: T) => void = () => {};
        const promise = new Promise<T>((r) => (resolve = r));
        return { promise, resolve };
    }

    test("tells what has arrived as each kind does, then is everything", async () => {
        const users = deferred<UserSummary[]>();
        const bots = deferred<BotMatch[]>();
        const groups = deferred<GroupMatch[]>();
        const search: ChatListSearch = {
            users: users.promise,
            bots: bots.promise,
            groups: groups.promise,
        };
        const soFar: ChatListSearchResults[] = [];
        const all = chatListSearchResults(search, (found) => soFar.push(found));

        users.resolve([user]);
        await Promise.resolve();
        expect(soFar).toEqual([{ users: [user], bots: [], groups: [] }]);

        bots.resolve([bot]);
        await Promise.resolve();
        expect(soFar.at(-1)).toEqual({ users: [user], bots: [bot], groups: [] });

        groups.resolve([group]);
        expect(await all).toEqual({ users: [user], bots: [bot], groups: [group] });
        expect(soFar.at(-1)).toEqual({ users: [user], bots: [bot], groups: [group] });
        expect(soFar).toHaveLength(3);
    });
});

describe("chatListSearchMatches", () => {
    test("is the people, then the bots, as one list (the groups are apart)", () => {
        const bob = { userId: "u2", username: "bob" } as UserSummary;
        const found: ChatListSearchResults = { users: [user, bob], bots: [bot], groups: [group] };
        expect(chatListSearchMatches(found)).toEqual([user, bob, bot]);
    });

    test("is nothing when nothing was found", () => {
        expect(chatListSearchMatches({ users: [], bots: [] })).toEqual([]);
    });
});
