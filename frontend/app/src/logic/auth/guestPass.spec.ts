import {
    anonymousUser,
    currentUserStore,
    identityStateStore,
    type ChatListScope,
    type IdentityState,
    type OpenChat,
    type RouteParams,
} from "@client";
import { CANCELLED, isCancelled } from "@openchat/ui/src/lib/behaviours/optimistic.svelte";
import {
    askToSignIn,
    askToSignInForThisPage,
    guestRouteAccess,
    signInFirst,
    signInFirstOrCancel,
} from "./guestPass";

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

// the client's two post-login calls, on the real identity store: updateIdentityState keeps a
// post-login state it isn't given a new one for, as the client's does
function fakeClient(): Pick<OpenChat, "updateIdentityState" | "clearPostLoginState"> {
    return {
        updateIdentityState: vi.fn((next: IdentityState) =>
            identityStateStore.update((previous) => ({
                ...next,
                postLogin: next.postLogin ?? previous.postLogin,
            })),
        ),
        clearPostLoginState: vi.fn(() =>
            identityStateStore.update((state) => ({ ...state, postLogin: undefined })),
        ),
    };
}

const continueTo = (path: string) => ({ kind: "continue_to", path }) as const;

describe("asking a guest to sign in", () => {
    beforeEach(() => identityStateStore.set({ kind: "anon" }));
    afterEach(() => {
        identityStateStore.set({ kind: "anon" });
        currentUserStore.set(anonymousUser());
        window.history.replaceState(null, "", "/");
    });

    test("opens the sign-in, going on to the page they were going to once they're in", () => {
        askToSignIn(fakeClient(), "/wallet?token=abc");
        expect(identityStateStore.value).toEqual({
            kind: "logging_in",
            postLogin: continueTo("/wallet?token=abc"),
        });
    });

    test("without a page, they stay where they are", () => {
        askToSignIn(fakeClient());
        expect(identityStateStore.value).toEqual({ kind: "logging_in", postLogin: undefined });
    });

    test("without a page, an earlier sign-in's page is forgotten", () => {
        // asked for /wallet, then the II window closed: back to anonymous with the dialog gone,
        // and nothing closed it, so the client still has /wallet
        identityStateStore.set({ kind: "anon", postLogin: continueTo("/wallet") });
        askToSignIn(fakeClient());
        expect(identityStateStore.value.postLogin).toBeUndefined();
        // and a join left the same way
        identityStateStore.set({
            kind: "anon",
            postLogin: { kind: "create_community" },
        });
        askToSignIn(fakeClient());
        expect(identityStateStore.value.postLogin).toBeUndefined();
    });

    test("with a page, it replaces an earlier one", () => {
        identityStateStore.set({ kind: "anon", postLogin: continueTo("/wallet") });
        askToSignIn(fakeClient(), "/notifications");
        expect(identityStateStore.value.postLogin).toEqual(continueTo("/notifications"));
    });

    test("for this page, goes on to it, its query and all", () => {
        window.history.replaceState(null, "", "/wallet?token=abc");
        askToSignInForThisPage(fakeClient());
        expect(identityStateStore.value.postLogin).toEqual(continueTo("/wallet?token=abc"));
    });

    test("for something that needs an account, only a guest is asked, and the caller stops", () => {
        const client = fakeClient();
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        expect(signInFirst(client)).toBe(false);
        expect(client.updateIdentityState).not.toHaveBeenCalled();
        currentUserStore.set(anonymousUser());
        expect(signInFirst(client)).toBe(true);
        expect(identityStateStore.value).toEqual({ kind: "logging_in", postLogin: undefined });
    });

    test("for a change shown before it's made, a guest's is given up quietly (CANCELLED)", () => {
        const client = fakeClient();
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        expect(() => signInFirstOrCancel(client)).not.toThrow();
        expect(client.updateIdentityState).not.toHaveBeenCalled();
        currentUserStore.set(anonymousUser());
        let thrown: unknown;
        try {
            signInFirstOrCancel(client);
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toBe(CANCELLED);
        expect(isCancelled(thrown)).toBe(true);
        expect(identityStateStore.value.kind).toBe("logging_in");
    });
});
