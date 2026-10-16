import {
    chatsInitialisedStore,
    notFoundStore,
    pathContextStore,
    routeStore,
    type OpenChat,
    type RouteParams,
} from "@client";
import { createRawSnippet, flushSync, mount, tick, unmount } from "svelte";
import Router from "./Router.svelte";

// The client calls the router's effects make, recorded. setRouteParams does what the real one does.
function fakeClient() {
    return {
        setRouteParams: (ctx: PageJS.Context, route: RouteParams) => {
            routeStore.set(route);
            pathContextStore.set(ctx);
            notFoundStore.set(false);
        },
        captureReferralCode: () => false,
        setSelectedCommunity: vi.fn(async () => false),
        removeCommunityIfPreviewing: vi.fn(),
        openThreadFromMessageIndex: vi.fn(),
        filterRightPanelHistory: vi.fn(),
        selectDefaultChat: vi.fn(),
        setSelectedChat: vi.fn(),
        updateIdentityState: vi.fn(),
        isChatListRoute: (r: RouteParams) => r.kind === "chat_list_route",
        isHomeRoute: (r: RouteParams) => r.kind === "home_route",
        isShareRoute: (r: RouteParams) => r.kind === "share_route",
        setChatListScopeAndRedirect: () => false,
        getDefaultScope: () => ({ kind: "chats" }),
    };
}

describe("the web UI's router", () => {
    let target: HTMLElement;
    let app: object | undefined;
    let client: ReturnType<typeof fakeClient>;

    beforeEach(() => {
        vi.stubGlobal("gtag", vi.fn());
        target = document.body.appendChild(document.createElement("div"));
        client = fakeClient();
        chatsInitialisedStore.set(true);
    });

    afterEach(() => {
        if (app) unmount(app);
        app = undefined;
        target.remove();
        vi.unstubAllGlobals();
        history.replaceState(null, "", "/");
    });

    // Opens the app on `url`, as page.js reads the location when it starts
    async function open(url: string) {
        history.replaceState(null, "", url);
        app = mount(Router, {
            target,
            props: { children: createRawSnippet(() => ({ render: () => "<div></div>" })) },
            context: new Map([["client", client as unknown as OpenChat]]),
        });
        flushSync();
        await tick();
        flushSync();
    }

    test("sets the route from the URL", async () => {
        await open("/wallet/swap");
        expect(routeStore.value).toMatchObject({ kind: "wallet_route", view: "swap" });
    });

    test("selects the chat a URL names, with its message", async () => {
        await open("/chats/group/g1/4");
        expect(client.setSelectedChat).toHaveBeenCalledWith(
            { kind: "group_chat", groupId: "g1" },
            4,
            undefined,
        );
    });

    test("takes a chat list with nothing selected to its default chat", async () => {
        await open("/favourite");
        expect(client.selectDefaultChat).toHaveBeenCalled();
    });

    test("leaves a thread list where it is", async () => {
        await open("/chats/threads");
        expect(routeStore.value.kind).toBe("threads_route");
        expect(client.selectDefaultChat).not.toHaveBeenCalled();
    });

    test("loads the community whose threads are listed", async () => {
        await open("/community/c1/threads");
        expect(client.setSelectedCommunity).toHaveBeenCalledWith({
            kind: "community",
            communityId: "c1",
        });
    });

    test("sends ?wallet to the wallet's own route", async () => {
        await open("/chats?wallet");
        await vi.waitFor(() => expect(location.pathname).toBe("/wallet"));
        expect(routeStore.value).toMatchObject({ kind: "wallet_route", view: "all" });
    });

    test("opens mobile's profile path as the profile dialog over the default chat list", async () => {
        await open("/profile_summary");
        await vi.waitFor(() => expect(location.pathname + location.search).toBe("/chats?profile"));
        expect(routeStore.value).toMatchObject({
            kind: "chat_list_route",
            scope: { kind: "chats" },
        });
    });

    test("marks a path nothing matches as not found", async () => {
        await open("/a/b/c/d");
        expect(notFoundStore.value).toBe(true);
    });
});
