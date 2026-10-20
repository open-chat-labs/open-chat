import { regionSummary, screenLoader } from "./screens";

describe("a placeholder's account of a region", () => {
    test("is its values on one line, without its kind", () => {
        expect(regionSummary({ kind: "wallet", view: "token", ledger: "abc" } as never)).toBe(
            "view: token · ledger: abc",
        );
    });

    test("takes nested values too, with their kinds, and writes big numbers out", () => {
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
        expect(regionSummary(conversation)).toBe(
            "route: global_chat_selected_route · scope: chats · chatId: direct_chat · userId: abc · messageIndex: 12 · open: true",
        );
    });

    test("tells chat lists apart by their scope", () => {
        const community = (communityId: string) => ({
            kind: "chats",
            scope: { kind: "community", id: { kind: "community", communityId } },
        });
        expect(regionSummary(community("A"))).toBe("scope: community · communityId: A");
        expect(regionSummary(community("B"))).not.toBe(regionSummary(community("A")));
        const direct = { kind: "chats", scope: { kind: "direct_chat" } };
        expect(regionSummary(direct)).toBe("scope: direct_chat");
        const groupThreads = { kind: "threads", scope: { kind: "group_chat" } };
        expect(regionSummary(groupThreads)).toBe("scope: group_chat");
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
