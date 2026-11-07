import { describe, expect, test } from "vitest";
import { isRouteThread, threadClosedPath, threadOpenPath } from "./threadUrl";

describe("threadClosedPath", () => {
    test("4c invariant 4: drops /:tmi and ?open, keeping the rest of the query (?threads)", () => {
        expect(threadClosedPath("/group/g1/5/7", "?open=true&threads", 7)).toBe(
            "/group/g1/5?threads",
        );
        expect(threadClosedPath("/community/c1/channel/9/5", "?threads&open=true", undefined)).toBe(
            "/community/c1/channel/9/5?threads",
        );
    });

    test("drops ?open alone when the route has no reply index", () => {
        expect(threadClosedPath("/group/g1/5", "?open=true", undefined)).toBe("/group/g1/5");
    });

    test("a reply index opened without ?open is dropped too", () => {
        expect(threadClosedPath("/chats/group/g1/5/17", "", 17)).toBe("/chats/group/g1/5");
    });

    test("leaves a path that doesn't end in the reply index as it is", () => {
        expect(threadClosedPath("/group/g1/57", "?open=true", 7)).toBe("/group/g1/57");
    });
});

describe("threadOpenPath", () => {
    const chatId = { kind: "group_chat" as const, groupId: "g1" };

    test("4c invariant 5: the root's path with ?open=true, keeping ?threads", () => {
        expect(threadOpenPath("chats", chatId, 5, "?threads")).toBe(
            "/chats/group/g1/5?open=true&threads",
        );
    });

    test("doesn't add ?threads when the list isn't showing, or carry other params", () => {
        expect(threadOpenPath("chats", chatId, 5, "?profile")).toBe("/chats/group/g1/5?open=true");
    });
});

describe("isRouteThread", () => {
    const chatId = { kind: "group_chat", groupId: "g1" } as const;
    const other = { kind: "group_chat", groupId: "g2" } as const;

    test("is the thread at the route's root in its selected chat, while it's open", () => {
        const route = { open: true, chatId, messageIndex: 5 };
        expect(isRouteThread(route, chatId, 5)).toBe(true);
        expect(isRouteThread(route, chatId, 6)).toBe(false);
        expect(isRouteThread(route, other, 5)).toBe(false);
        // the route at the message without ?open: the chat at it, no thread
        expect(isRouteThread({ ...route, open: false }, chatId, 5)).toBe(false);
    });
});
