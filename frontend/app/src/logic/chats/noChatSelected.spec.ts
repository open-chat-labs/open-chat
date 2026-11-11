import { describe, expect, test } from "vitest";
import { noChatSelectedText } from "./noChatSelected";

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
