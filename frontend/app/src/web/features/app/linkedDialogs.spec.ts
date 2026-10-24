import { backIntent, handOffAt, sameUrl } from "./linkedDialogs";

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

describe("the same URL", () => {
    test("is the same path and query once parsed, flags with or without =", () => {
        expect(sameUrl("/chats?threads&chit", "/chats?threads=&chit")).toBe(true);
        expect(sameUrl("/chats?chit&threads", "/chats?threads=&chit")).toBe(true);
        expect(sameUrl("/chats?chit", "/chats?chit=earn")).toBe(false);
        expect(sameUrl("/chats?chit", "/communities?chit")).toBe(false);
    });

    test("so another flag in the URL still goes back in history to the CHIT dialog", () => {
        expect(
            backIntent(
                { to: "/chats?threads&chit=earn", from: "/chats?threads&chit" },
                "/chats?threads&chit=earn",
                "/chats?threads=&chit",
            ),
        ).toBe("dismiss");
    });
});

describe("a hand-off", () => {
    const handOff = { to: "/chats?chit=earn", from: "/chats?chit" };

    test("is kept on its way to its URL, and while it shows", () => {
        // the URL told again as it was, before the navigation lands
        expect(handOffAt(handOff, "/chats?chit")).toBe(handOff);
        expect(handOffAt(handOff, "/chats?chit=earn")).toEqual({ ...handOff, reached: true });
    });

    test("is forgotten once its URL has been left, so coming back to it later some other way isn't taken for it", () => {
        expect(handOffAt({ ...handOff, reached: true }, "/chats")).toBeUndefined();
        expect(handOffAt(undefined, "/chats?chit=earn")).toBeUndefined();
    });
});
