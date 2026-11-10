import type { ChatListScope, RouteParams } from "@client";
import { askToSignIn, guestRouteAccess, signInFirst } from "./guestPass";

const none = { kind: "none" } as const;
const chats = { kind: "chats" } as const;
const favourite = { kind: "favourite" } as const;
const community = { kind: "community", id: { kind: "community", communityId: "c1" } } as const;

function chatRoute(
    chatType: "group_chat" | "direct_chat",
    scope: ChatListScope = chats,
): RouteParams {
    return {
        kind: "global_chat_selected_route",
        chatId:
            chatType === "group_chat"
                ? { kind: "group_chat", groupId: "g1" }
                : { kind: "direct_chat", userId: "u1" },
        chatType,
        open: false,
        scope,
    };
}

describe("what a guest can open", () => {
    test("Explore, the chat lists and previews of groups, communities and channels", () => {
        const open: RouteParams[] = [
            { kind: "communities_route", scope: none },
            { kind: "welcome_route", scope: none },
            { kind: "chat_list_route", scope: chats },
            { kind: "chat_list_route", scope: community },
            chatRoute("group_chat"),
            { kind: "selected_community_route", communityId: community.id, scope: community },
            {
                kind: "selected_channel_route",
                chatId: { kind: "channel", communityId: "c1", channelId: 1 },
                communityId: community.id,
                open: false,
                scope: community,
            },
            { kind: "not_found_route", scope: none },
        ];
        open.forEach((route) => expect(guestRouteAccess(route)).toBe("open"));
    });

    test("asks to sign in for a DM, the favourites, notifications, the wallet, the profile, sharing and the console", () => {
        const signIn: RouteParams[] = [
            chatRoute("direct_chat"),
            { kind: "chat_list_route", scope: favourite },
            { kind: "favourites_route", open: false, scope: favourite },
            { kind: "notifications_route", scope: none },
            { kind: "wallet_route", view: "all", scope: none },
            { kind: "wallet_route", view: "send", ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai", scope: none },
            { kind: "profile_summary_route", scope: none },
            { kind: "share_route", title: "t", text: "x", url: "u", scope: none },
            { kind: "admin_route", scope: none },
        ];
        signIn.forEach((route) => expect(guestRouteAccess(route)).toBe("sign_in"));
    });

    test("leaves a chat on a /favourite URL open: it goes on to its own URL", () => {
        expect(guestRouteAccess(chatRoute("group_chat", favourite))).toBe("open");
        expect(
            guestRouteAccess({
                kind: "favourites_route",
                chatId: { kind: "group_chat", groupId: "g1" },
                open: false,
                scope: favourite,
            }),
        ).toBe("open");
    });
});

describe("asking a guest to sign in", () => {
    test("opens the sign-in, going on to the page they were going to once they're in", () => {
        const client = { updateIdentityState: vi.fn() };
        askToSignIn(client, "/wallet?token=abc");
        expect(client.updateIdentityState).toHaveBeenCalledWith({
            kind: "logging_in",
            postLogin: { kind: "continue_to", path: "/wallet?token=abc" },
        });
    });

    test("without a page, they stay where they are", () => {
        const client = { updateIdentityState: vi.fn() };
        askToSignIn(client);
        expect(client.updateIdentityState).toHaveBeenCalledWith({
            kind: "logging_in",
            postLogin: undefined,
        });
    });

    test("for something that needs an account, only a guest is asked, and the caller stops", () => {
        const client = { updateIdentityState: vi.fn() };
        expect(signInFirst(client, false)).toBe(false);
        expect(client.updateIdentityState).not.toHaveBeenCalled();
        expect(signInFirst(client, true)).toBe(true);
        expect(client.updateIdentityState).toHaveBeenCalledWith({
            kind: "logging_in",
            postLogin: undefined,
        });
    });
});
