import { derived, writable } from "svelte/store";
import type {
    ChannelIdentifier,
    ChatIdentifier,
    ChatType,
    DirectChatIdentifier,
    GroupChatIdentifier,
    CommunityIdentifier,
    ChatListScope,
} from "openchat-client";

export const notFound = writable(false);

export const pathContextStore = writable<PageJS.Context | undefined>(undefined);

export const location = derived(pathContextStore, ($store) => {
    return $store ? $store.routePath : "";
});

export const querystring = derived(pathContextStore, ($store) => {
    return $store ? new URLSearchParams($store.querystring) : new URLSearchParams();
});

function qs(ctx: PageJS.Context): URLSearchParams {
    return new URLSearchParams(ctx.querystring);
}

export function communitesRoute(_ctx: PageJS.Context): RouteParams {
    return {
        kind: "communities_route",
    };
}

export function shareRoute(ctx: PageJS.Context): RouteParams {
    const $qs = qs(ctx);
    return {
        kind: "share_route",
        title: $qs.get("title") ?? "",
        text: $qs.get("text") ?? "",
        url: $qs.get("url") ?? "",
    };
}

export function isBlogRoute(route: RouteParams): route is BlogRoute {
    return route.kind === "blog_route";
}

export function isMiamiRoute(route: RouteParams): route is MiamiRoute {
    return route.kind === "miami_route";
}

export function isRoadmapRoute(route: RouteParams): route is RoadmapRoute {
    return route.kind === "roadmap_route";
}

export function isWhitepaperRoute(route: RouteParams): route is WhitepaperRoute {
    return route.kind === "whitepaper_route";
}

export function isArchitectureRoute(route: RouteParams): route is ArchitectureRoute {
    return route.kind === "architecture_route";
}

export function isGuidelinesRoute(route: RouteParams): route is GuidelinesRoute {
    return route.kind === "guidelines_route";
}

export function isFaqRoute(route: RouteParams): route is FaqRoute {
    return route.kind === "faq_route";
}

export function isDiamondRoute(route: RouteParams): route is DiamondRoute {
    return route.kind === "diamond_route";
}

export function blogRoute(ctx: PageJS.Context): RouteParams {
    return {
        kind: "blog_route",
        slug: ctx.params["slug"],
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
        case "direct_chat":
            return "/user";
        case "group_chat":
            return "/group";
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
                channelId: ctx.params["channelId"],
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
                      communityId: createCommunityIdentifier(ctx.params["communityId"]),
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
    scope: ChatListScope
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

export const pathParams = writable<RouteParams>({ kind: "not_found_route" });

export type LandingPageRoute =
    | HomeLandingRoute
    | FeaturesRoute
    | ArchitectureRoute
    | WhitepaperRoute
    | RoadmapRoute
    | BlogRoute
    | MiamiRoute
    | FaqRoute
    | GuidelinesRoute
    | DiamondRoute;

export type RouteType = RouteParams["kind"];

export type RouteParams =
    | LandingPageRoute
    | HomeRoute
    | FavouritesRoute
    | ChatListRoute
    | GlobalSelectedChatRoute
    | CommunitiesRoute
    | SelectedCommunityRoute
    | SelectedChannelRoute
    | ShareRoute
    | NotFound
    | HotGroupsRoute;

type RouteCommon = { scope: ChatListScope };

export type ChatListRoute = RouteCommon & { kind: "chat_list_route" };
export type HomeLandingRoute = { kind: "home_landing_route" };
export type FeaturesRoute = { kind: "features_route" };
export type ArchitectureRoute = { kind: "architecture_route" };
export type WhitepaperRoute = { kind: "whitepaper_route" };
export type RoadmapRoute = { kind: "roadmap_route" };
export type MiamiRoute = { kind: "miami_route" };
export type FaqRoute = { kind: "faq_route" };
export type DiamondRoute = { kind: "diamond_route" };
export type GuidelinesRoute = { kind: "guidelines_route" };

export type HomeRoute = RouteCommon & {
    kind: "home_route";
};

export type GlobalSelectedChatRoute = RouteCommon & {
    kind: "global_chat_selected_route";
    chatId: GroupChatIdentifier | DirectChatIdentifier;
    chatType: "group_chat" | "direct_chat";
    messageIndex?: number;
    threadMessageIndex?: number;
    open: boolean;
};

export type FavouritesRoute = RouteCommon & {
    kind: "favourites_route";
    chatId?: ChatIdentifier;
    messageIndex?: number;
    threadMessageIndex?: number;
    open: boolean;
};

export type SelectedCommunityRoute = RouteCommon & {
    kind: "selected_community_route";
    communityId: CommunityIdentifier;
};

export type SelectedChannelRoute = RouteCommon & {
    kind: "selected_channel_route";
    chatId: ChannelIdentifier;
    communityId: CommunityIdentifier;
    messageIndex?: number;
    threadMessageIndex?: number;
    open: boolean;
};

export type CommunitiesRoute = {
    kind: "communities_route";
};

export type ShareRoute = {
    kind: "share_route";
    title: string;
    text: string;
    url: string;
};

export type HotGroupsRoute = RouteCommon & {
    kind: "hot_groups_route";
};

export type BlogRoute = {
    kind: "blog_route";
    slug?: string;
};

export type NotFound = {
    kind: "not_found_route";
};
