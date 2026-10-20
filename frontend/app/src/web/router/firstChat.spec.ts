import type { ChatSummary } from "@client";
import { firstChatRoute, firstChatUrl } from "./firstChat";

const chat = (userId: string, archived = false) =>
    ({
        kind: "direct_chat",
        id: { kind: "direct_chat", userId },
        membership: { archived },
    }) as unknown as ChatSummary;

describe("where a chat list with nothing selected goes", () => {
    test("is its first chat that isn't archived, in the list's scope", () => {
        expect(firstChatRoute("chats", [chat("a", true), chat("b"), chat("c")], false)).toBe(
            "/chats/user/b",
        );
        expect(firstChatRoute("favourite", [chat("b")], false)).toBe("/favourite/user/b");
    });

    test("is nowhere on a narrow screen, or without such a chat", () => {
        expect(firstChatRoute("chats", [chat("b")], true)).toBeUndefined();
        expect(firstChatRoute("chats", [chat("a", true)], false)).toBeUndefined();
        expect(firstChatRoute("chats", [], false)).toBeUndefined();
    });
});

describe("going to the first chat", () => {
    test("keeps the list's thread list, or an overlay, open over it", () => {
        expect(firstChatUrl("/chats/group/g1", "?threads")).toBe("/chats/group/g1?threads");
        expect(firstChatUrl("/chats/group/g1", "?profile&threads")).toBe(
            "/chats/group/g1?profile&threads",
        );
        expect(firstChatUrl("/chats/group/g1", "")).toBe("/chats/group/g1");
    });
});
