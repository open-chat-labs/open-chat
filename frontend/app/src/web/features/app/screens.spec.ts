import { regionSummary, screenLoader } from "./screens";

describe("a placeholder's account of a region", () => {
    test("is its values on one line, without its kind", () => {
        expect(regionSummary({ kind: "wallet", view: "token", ledger: "abc" } as never)).toBe(
            "view: token · ledger: abc",
        );
    });

    test("takes nested values too, leaving out kinds and scopes, and writes big numbers out", () => {
        const conversation = {
            kind: "conversation",
            route: {
                kind: "global_chat_selected_route",
                scope: { kind: "chats" },
                chatId: { kind: "direct_chat", userId: "abc" },
                messageIndex: 12n,
                open: true,
                threadMessageIndex: undefined,
            },
        };
        expect(regionSummary(conversation)).toBe("userId: abc · messageIndex: 12 · open: true");
    });

    test("is empty for a region with nothing else", () => {
        expect(regionSummary({ kind: "empty" })).toBe("");
    });
});

describe("a screen's loader", () => {
    test("is the same for every region that shows the screen, so it loads once", () => {
        const load = async () => ({ default: (() => {}) as never });
        expect(screenLoader(load)).toBe(screenLoader(load));
        expect(screenLoader(load)).not.toBe(
            screenLoader(async () => ({ default: (() => {}) as never })),
        );
    });
});
