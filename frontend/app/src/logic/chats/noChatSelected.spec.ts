import { describe, expect, test } from "vitest";
import { middleWithoutChatText, noChatSelectedText } from "./noChatSelected";

describe("the words for a chat list with nothing selected", () => {
    test("a community's channels ask for a channel", () => {
        const text = noChatSelectedText("community");
        expect(text.title.key).toBe("noChannelSelected");
        expect(text.body.key).toBe("selectAChannel");
    });

    test("the favourites say how to add some", () => {
        const text = noChatSelectedText("favourite");
        expect(text.title.key).toBe("noChatSelected");
        expect(text.body.key).toBe("selectAFavourite");
    });

    test("the chats, and any other list, ask for a chat", () => {
        for (const scope of ["chats", "none"] as const) {
            const text = noChatSelectedText(scope);
            expect(text.title.key).toBe("noChatSelected");
            expect(text.body.key).toBe("selectAChat");
        }
    });
});

describe("the middle with nothing selected", () => {
    test("says the chat list's words while the list has chats", () => {
        expect(middleWithoutChatText({ kind: "favourite" }, true)?.body.key).toBe(
            "selectAFavourite",
        );
    });

    test("says nothing beside an empty list, which says so itself", () => {
        expect(middleWithoutChatText({ kind: "chats" }, false)).toBeUndefined();
    });

    test("says nothing beside anything else (the activity feed, the threads)", () => {
        expect(middleWithoutChatText(undefined, true)).toBeUndefined();
    });
});
