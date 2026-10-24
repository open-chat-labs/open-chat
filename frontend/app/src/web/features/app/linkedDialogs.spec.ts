import { backIntent } from "./linkedDialogs";

describe("going back to a linked dialog", () => {
    test("goes back in history when this one was opened from it", () => {
        expect(
            backIntent(
                { to: "/chats?chit=earn", from: "/chats?chit" },
                "/chats?chit=earn",
                "/chats?chit",
            ),
        ).toBe("dismiss");
    });

    test("goes to it in place when this one wasn't (opened from a toast or a link)", () => {
        // the toast opened the ways to earn from the page: nothing of the CHIT dialog behind
        expect(
            backIntent(
                { to: "/chats?chit=earn%3Asent_text", from: "/chats" },
                "/chats?chit=earn%3Asent_text",
                "/chats?chit",
            ),
        ).toBe("auto");
        // reached some other way since the last hand-off
        expect(
            backIntent(
                { to: "/chats?chit=earn", from: "/chats?chit" },
                "/chats?chit=insurance",
                "/chats?chit",
            ),
        ).toBe("auto");
        expect(backIntent(undefined, "/chats?chit=earn", "/chats?chit")).toBe("auto");
    });
});
