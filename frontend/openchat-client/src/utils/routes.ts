import {
    toBigInt32,
    type ChatListScope,
    type ChatType,
    type CommunityIdentifier,
    type DirectChatIdentifier,
    type GroupChatIdentifier,
    type NullScope,
    type RouteParams,
} from "openchat-shared";
import page from "page";
import { get } from "svelte/store";
import { routerReadyStore } from "../state";

const noScope: NullScope = { kind: "none" };

// if we attempt to use the router before it is set up it will blow up
function getRouter(): Promise<typeof page> {
    return new Promise((resolve) => {
        function checkReadiness(iterations: number = 0) {
            if (iterations > 10)
                throw new Error("Router readiness check has failed - router cannot be used");

            if (get(routerReadyStore)) {
                resolve(page);
            } else {
                console.debug("ROUTER: router not ready, trying again in 100ms");
                window.setTimeout(() => checkReadiness(iterations + 1), 100);
            }
        }
        checkReadiness();
    });
}

page("*", (ctx, next) => {
    if (ctx.init || !document.startViewTransition) return next();
    document.startViewTransition(() => next());
});

// No need to use this for router stuff, but can be used to do transitions between *any* dom states
export function transition(fn: () => void) {
    if (!document.startViewTransition) {
        fn();
        return;
    }

    document.startViewTransition(fn);
}

export function pageReplace(url: string) {
    return getRouter().then((r) => r.replace(url));
}

export function pageRedirect(url: string) {
    return getRouter().then((r) => r.redirect(url));
}

function qs(ctx: PageJS.Context): URLSearchParams {
    return new URLSearchParams(ctx.querystring);
}

export function adminRoute(_ctx: PageJS.Context): RouteParams {
    return {
        kind: "admin_route",
        scope: noScope,
    };
}
export function profileSummaryRoute(_ctx: PageJS.Context): RouteParams {
    return {
        kind: "profile_summary_route",
        scope: noScope,
    };
}

export function communitesRoute(_ctx: PageJS.Context): RouteParams {
    return {
        kind: "communities_route",
        scope: noScope,
    };
}

export function shareRoute(ctx: PageJS.Context): RouteParams {
    const $qs = qs(ctx);
    return {
        kind: "share_route",
        title: $qs.get("title") ?? "",
        text: $qs.get("text") ?? "",
        url: $qs.get("url") ?? "",
        scope: noScope,
    };
}

export function blogRoute(ctx: PageJS.Context): RouteParams {
    return {
        kind: "blog_route",
        slug: ctx.params["slug"],
        scope: noScope,
    };
}

export function chatListRoute(scope: ChatListScope) {
    return (_ctx: PageJS.Context): RouteParams => {
        return {
            kind: "chat_list_route",
            scope,
        };
    };
}

export function globalDirectChatSelectedRoute(scope: ChatListScope) {
    return (ctx: PageJS.Context): RouteParams => {
        return chatSelectedRoute(ctx, "direct_chat", scope);
    };
}

export function globalGroupChatSelectedRoute(scope: ChatListScope) {
    return (ctx: PageJS.Context): RouteParams => {
        return chatSelectedRoute(ctx, "group_chat", scope);
    };
}

function createCommunityIdentifier(id: string): CommunityIdentifier {
    return { kind: "community", communityId: id };
}

export function selectedCommunityRoute(ctx: PageJS.Context): RouteParams {
    return {
        kind: "selected_community_route",
        communityId: { kind: "community", communityId: ctx.params["communityId"] },
        scope: { kind: "community", id: createCommunityIdentifier(ctx.params["communityId"]) },
    };
}

export function routeForScope(scope: ChatListScope): string {
    switch (scope.kind) {
        case "community":
            return `/community/${scope.id.communityId}`;
        case "chats":
            return "/chats";
        case "favourite":
            return "/favourite";
        default:
            return "/";
    }
}

export function selectedChannelRoute(fav: boolean) {
    return (ctx: PageJS.Context): RouteParams => {
        const $qs = qs(ctx);
        return {
            kind: "selected_channel_route",
            chatId: {
                kind: "channel",
                communityId: ctx.params["communityId"],
                channelId: Number(toBigInt32(ctx.params["channelId"])),
            },
            communityId: { kind: "community", communityId: ctx.params["communityId"] },
            messageIndex: ctx.params["messageIndex"]
                ? Number(ctx.params["messageIndex"])
                : undefined,
            threadMessageIndex: ctx.params["threadMessageIndex"]
                ? Number(ctx.params["threadMessageIndex"])
                : undefined,
            open: $qs.get("open") === "true",
            scope: fav
                ? {
                      kind: "favourite",
                  }
                : { kind: "community", id: createCommunityIdentifier(ctx.params["communityId"]) },
        };
    };
}

export function favouritesRoute(ctx: PageJS.Context): RouteParams {
    const $qs = qs(ctx);
    return {
        kind: "favourites_route",
        chatId: ctx.params["chatId"] || undefined,
        messageIndex: ctx.params["messageIndex"] ? Number(ctx.params["messageIndex"]) : undefined,
        threadMessageIndex: ctx.params["threadMessageIndex"]
            ? Number(ctx.params["threadMessageIndex"])
            : undefined,
        open: $qs.get("open") === "true",
        scope: { kind: "favourite" },
    };
}

function chatSelectedRoute(
    ctx: PageJS.Context,
    chatType: "direct_chat" | "group_chat",
    scope: ChatListScope,
): RouteParams {
    const $qs = qs(ctx);

    const chatId = ctx.params["chatId"] || undefined;

    if (chatId === undefined) {
        return {
            kind: "home_route",
            scope,
        };
    }

    const identifier =
        chatType === "direct_chat"
            ? ({ kind: "direct_chat", userId: chatId } as DirectChatIdentifier)
            : ({ kind: "group_chat", groupId: chatId } as GroupChatIdentifier);

    return {
        kind: "global_chat_selected_route",
        chatId: identifier,
        chatType,
        messageIndex: ctx.params["messageIndex"] ? Number(ctx.params["messageIndex"]) : undefined,
        threadMessageIndex: ctx.params["threadMessageIndex"]
            ? Number(ctx.params["threadMessageIndex"])
            : undefined,
        open: $qs.get("open") === "true",
        scope,
    };
}

export function chatTypeToPath(chatType: ChatType): string {
    return chatType === "direct_chat" ? "user" : "group";
}
