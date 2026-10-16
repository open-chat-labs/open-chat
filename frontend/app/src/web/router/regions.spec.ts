import type { RouteParams } from "@client";
import { railSelectionFor, regionsFor } from "./regions";

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

    test("threads, activity and the wallet bring their own left column", () => {
        expect(regionsFor(route({ kind: "threads_route", scope: community }), false)).toMatchObject(
            {
                left: { kind: "threads", scope: community },
            },
        );
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

    test("explore is full width", () => {
        for (const kind of ["communities_route", "welcome_route"]) {
            expect(regionsFor(route({ kind, scope: none }), false)).toEqual({
                area: "app",
                middle: { kind: "explore" },
                narrowView: "middle",
            });
        }
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
        expect(railSelectionFor(groupChat)).toEqual({ item: 0 });
        expect(
            railSelectionFor(route({ kind: "chat_list_route", scope: { kind: "favourite" } })),
        ).toEqual({
            item: 1,
        });
        expect(railSelectionFor(route({ kind: "notifications_route", scope: none }))).toEqual({
            item: 2,
        });
        expect(railSelectionFor(route({ kind: "wallet_route", scope: none, view: "all" }))).toEqual(
            {
                item: 3,
            },
        );
    });

    test("selects a community's pin for its channels and threads", () => {
        expect(railSelectionFor(route({ kind: "threads_route", scope: community }))).toEqual({
            item: -1,
            communityId: "c1",
        });
    });

    test("selects nothing for explore", () => {
        expect(railSelectionFor(route({ kind: "communities_route", scope: none }))).toEqual({
            item: -1,
        });
    });
});
