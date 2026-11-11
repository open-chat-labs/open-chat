import type { BotMatch, UserSummary } from "@shared";
import { describe, expect, test, vi } from "vitest";
import {
    chatListSearchMatches,
    runChatListSearch,
    type ChatListSearchCalls,
} from "./chatListSearch";

const user = { userId: "u1", username: "lucy" } as UserSummary;
const bot = { kind: "bot_match", id: "b1", name: "lucybot" } as BotMatch;

function calls(): ChatListSearchCalls {
    return {
        users: vi.fn(async () => [user]),
        bots: vi.fn(async () => [bot]),
    };
}

describe("runChatListSearch", () => {
    // web plan 04: chats, people and messages; public groups aren't searched
    test("finds the people and bots for a term, and no groups", async () => {
        const c = calls();
        expect(await runChatListSearch("lucy", c)).toEqual({ users: [user], bots: [bot] });
        expect(c.users).toHaveBeenCalledWith("lucy");
        expect(c.bots).toHaveBeenCalledWith("lucy");
    });

    // L1 invariant 4: the server search never calls the backend for an empty term
    test("asks the backend nothing for an empty term", async () => {
        const c = calls();
        expect(await runChatListSearch("", c)).toEqual({ users: [], bots: [] });
        expect(c.users).not.toHaveBeenCalled();
        expect(c.bots).not.toHaveBeenCalled();
    });

    test("a call that fails finds nothing, and the others still count", async () => {
        const c = { ...calls(), bots: vi.fn(async () => Promise.reject(new Error("offline"))) };
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(await runChatListSearch("lucy", c)).toEqual({ users: [user], bots: [] });
        warn.mockRestore();
    });
});

describe("chatListSearchMatches", () => {
    test("is the people, then the bots, as one list", () => {
        const bob = { userId: "u2", username: "bob" } as UserSummary;
        expect(chatListSearchMatches({ users: [user, bob], bots: [bot] })).toEqual([
            user,
            bob,
            bot,
        ]);
    });

    test("is nothing when nothing was found", () => {
        expect(chatListSearchMatches({ users: [], bots: [] })).toEqual([]);
    });
});
