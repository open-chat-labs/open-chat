import type { RouteParams } from "@client";
import { narrowBack, railItems, railSelectionFor, regionsFor } from "./regions";

const none = { kind: "none" } as const;
const chats = { kind: "chats" } as const;
const community = { kind: "community", id: { kind: "community", communityId: "c1" } } as const;

const route = (r: object) => r as RouteParams;
const groupChat = route({
    kind: "global_chat_selected_route",
    chatId: { kind: "group_chat", groupId: "g1" },
    chatType: "group_chat",
    open: false,
    scope: chats,
});

describe("what a route shows", () => {
    test("marketing pages sit outside the shell, and so does '/' for someone signed out", () => {
        expect(regionsFor(route({ kind: "faq_route", scope: none }), false).area).toBe("marketing");
        expect(regionsFor(route({ kind: "home_route", scope: none }), true).area).toBe("marketing");
        expect(regionsFor(route({ kind: "home_route", scope: none }), false).area).toBe("app");
    });

    test("a chat shows its list and the conversation, which a narrow screen shows first", () => {
        expect(regionsFor(groupChat, false)).toEqual({
            area: "app",
            left: { kind: "chats", scope: chats },
            middle: { kind: "conversation", route: groupChat },
            narrowView: "middle",
        });
    });

    test("a chat list on its own starts on the list", () => {
        expect(regionsFor(route({ kind: "chat_list_route", scope: chats }), false)).toMatchObject({
            left: { kind: "chats", scope: chats },
            middle: { kind: "empty" },
            narrowView: "left",
        });
    });

    test("?threads shows the list's threads on the left, over whatever the middle shows", () => {
        expect(
            regionsFor(route({ kind: "chat_list_route", scope: community }), false, true),
        ).toMatchObject({
            left: { kind: "threads", scope: community },
            middle: { kind: "empty" },
        });
        expect(regionsFor(groupChat, false, true)).toMatchObject({
            left: { kind: "threads", scope: groupChat.scope },
            middle: { kind: "conversation", route: groupChat },
            // a narrow screen shows the conversation (a thread opened from the list)
            narrowView: "middle",
        });
        // only over a chat list
        expect(
            regionsFor(route({ kind: "notifications_route", scope: none }), false, true),
        ).toMatchObject({ left: { kind: "activity" } });
    });

    test("activity and the wallet bring their own left column", () => {
        expect(
            regionsFor(route({ kind: "notifications_route", scope: none }), false),
        ).toMatchObject({
            left: { kind: "activity" },
        });
        expect(
            regionsFor(
                route({ kind: "wallet_route", scope: none, view: "send", ledger: "l1" }),
                false,
            ),
        ).toMatchObject({
            left: { kind: "wallet" },
            middle: { kind: "wallet", view: "send", ledger: "l1" },
            narrowView: "middle",
        });
        expect(
            regionsFor(route({ kind: "wallet_route", scope: none, view: "all" }), false),
        ).toMatchObject({
            narrowView: "left",
        });
    });

    test("explore is full width, without the right column, signed in or out", () => {
        for (const kind of ["communities_route", "welcome_route"]) {
            for (const signedOut of [false, true]) {
                expect(regionsFor(route({ kind, scope: none }), signedOut)).toEqual({
                    area: "app",
                    middle: { kind: "explore" },
                    narrowView: "middle",
                    rightColumn: false,
                });
            }
        }
    });

    test("the wallet has no right column, on its home or a token's page", () => {
        for (const view of ["all", "token"]) {
            expect(
                regionsFor(route({ kind: "wallet_route", scope: none, view, ledger: "x" }), false),
            ).toMatchObject({ rightColumn: false });
        }
    });

    test("a chat and the notifications have the right column", () => {
        expect(
            regionsFor(route({ kind: "chat_list_route", scope: { kind: "chats" } }), false),
        ).not.toHaveProperty("rightColumn");
        expect(
            regionsFor(route({ kind: "notifications_route", scope: none }), false),
        ).not.toHaveProperty("rightColumn");
    });

    test("mobile's profile path has no page of its own (the router redirects it)", () => {
        expect(
            regionsFor(route({ kind: "profile_summary_route", scope: none }), false),
        ).toMatchObject({
            left: { kind: "chats" },
            middle: { kind: "empty" },
        });
    });

    test("not found is its own page", () => {
        expect(regionsFor(route({ kind: "not_found_route", scope: none }), false)).toEqual({
            area: "not_found",
        });
    });
});

describe("the rail's selection", () => {
    test("follows the route's destination", () => {
        expect(railSelectionFor(groupChat)).toEqual({ item: "chats" });
        expect(
            railSelectionFor(route({ kind: "chat_list_route", scope: { kind: "favourite" } })),
        ).toEqual({ item: "favourites" });
        expect(railSelectionFor(route({ kind: "notifications_route", scope: none }))).toEqual({
            item: "notifications",
        });
        expect(railSelectionFor(route({ kind: "wallet_route", scope: none, view: "all" }))).toEqual(
            { item: "wallet" },
        );
    });

    test("selects a community's pin for its channels and threads", () => {
        expect(railSelectionFor(route({ kind: "chat_list_route", scope: community }))).toEqual({
            communityId: "c1",
        });
    });

    test("selects nothing for explore", () => {
        expect(railSelectionFor(route({ kind: "communities_route", scope: none }))).toEqual({});
    });
});

describe("the rail's destinations", () => {
    const ids = (hasFavourites: boolean, selection = {}) =>
        railItems(hasFavourites, selection).map((item) => item.id);

    test("are chats, notifications, favourites and the wallet, in that order", () => {
        expect(ids(true)).toEqual(["chats", "notifications", "favourites", "wallet"]);
    });

    test("leave favourites out until something is a favourite, unless it's open", () => {
        expect(ids(false)).toEqual(["chats", "notifications", "wallet"]);
        expect(ids(false, { item: "favourites" })).toEqual([
            "chats",
            "notifications",
            "favourites",
            "wallet",
        ]);
    });
});

describe("a narrow screen's Back from the middle", () => {
    test("goes to the list the conversation was opened from", () => {
        expect(narrowBack(regionsFor(groupChat, false))).toBe("/chats");
    });

    test("keeps the thread list a thread was opened from", () => {
        expect(narrowBack(regionsFor(groupChat, false, true))).toBe("/chats?threads");
        expect(
            narrowBack(
                regionsFor(route({ kind: "chat_list_route", scope: community }), false, true),
            ),
        ).toBe("/community/c1?threads");
    });

    test("goes to the wallet's tokens from a wallet page, and nowhere from the others", () => {
        expect(
            narrowBack(
                regionsFor(
                    route({ kind: "wallet_route", scope: none, view: "token", ledger: "l1" }),
                    false,
                ),
            ),
        ).toBe("/wallet");
        expect(
            narrowBack(regionsFor(route({ kind: "notifications_route", scope: none }), false)),
        ).toBeUndefined();
    });
});
