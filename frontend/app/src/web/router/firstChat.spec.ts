import type { ChatSummary } from "@client";
import { firstChatRoute } from "./firstChat";

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
