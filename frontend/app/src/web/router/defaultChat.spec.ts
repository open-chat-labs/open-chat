import type { ChatSummary } from "@client";
import { defaultChatRoute, defaultChatUrl } from "./defaultChat";

const chat = (userId: string, archived = false) =>
    ({
        kind: "direct_chat",
        id: { kind: "direct_chat", userId },
        membership: { archived },
    }) as unknown as ChatSummary;

const id = (userId: string) => ({ kind: "direct_chat", userId }) as const;

/** Invariant: a chat list with nothing selected opens the chat last opened in its scope, as the
 * old UI does, else its first unarchived one. */
describe("where a chat list with nothing selected goes", () => {
    test("is the chat last opened in the scope, while it's still in the list", () => {
        const chats = [chat("a"), chat("b"), chat("c")];
        expect(defaultChatRoute("chats", chats, id("c"), false)).toBe("/chats/user/c");
        expect(defaultChatRoute("chats", chats, id("gone"), false)).toBe("/chats/user/a");
        // archived since, it's still the one opened (opening it unarchives it), as the old UI
        expect(defaultChatRoute("chats", [chat("a"), chat("c", true)], id("c"), false)).toBe(
            "/chats/user/c",
        );
    });

    test("is otherwise its first chat that isn't archived, in the list's scope", () => {
        expect(
            defaultChatRoute("chats", [chat("a", true), chat("b"), chat("c")], undefined, false),
        ).toBe("/chats/user/b");
        expect(defaultChatRoute("favourite", [chat("b")], undefined, false)).toBe(
            "/favourite/user/b",
        );
    });

    test("is nowhere on a narrow screen, or without such a chat", () => {
        expect(defaultChatRoute("chats", [chat("b")], id("b"), true)).toBeUndefined();
        expect(defaultChatRoute("chats", [chat("a", true)], undefined, false)).toBeUndefined();
        expect(defaultChatRoute("chats", [], undefined, false)).toBeUndefined();
    });
});

describe("going to that chat", () => {
    test("keeps the list's thread list, or an overlay, open over it", () => {
        expect(defaultChatUrl("/chats/group/g1", "?threads")).toBe("/chats/group/g1?threads");
        expect(defaultChatUrl("/chats/group/g1", "?profile&threads")).toBe(
            "/chats/group/g1?profile&threads",
        );
        expect(defaultChatUrl("/chats/group/g1", "")).toBe("/chats/group/g1");
    });
});
