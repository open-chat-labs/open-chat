import { derived, writable } from "svelte/store";
import type { ChatType } from "openchat-client";

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

export function communitesRoute(ctx: PageJS.Context): RouteParams {
    return {
        kind: "communities_route",
        communityId: ctx.params["communityId"],
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

export function globalDirectChatRoute(ctx: PageJS.Context): RouteParams {
    return chatSelectedRoute(ctx, "direct_chat");
}

export function globalGroupChatRoute(ctx: PageJS.Context): RouteParams {
    return chatSelectedRoute(ctx, "group_chat");
}

export function chatSelectedRoute(
    ctx: PageJS.Context,
    chatType: ChatType | "unknown" = "unknown"
): RouteParams {
    const $qs = qs(ctx);

    const chatId = ctx.params["chatId"] || undefined;

    if (chatId === undefined) {
        return {
            kind: "home_route",
        };
    }

    return {
        kind: "global_chat_selected_route",
        chatId,
        chatType,
        messageIndex: ctx.params["messageIndex"] ? Number(ctx.params["messageIndex"]) : undefined,
        threadMessageIndex: ctx.params["threadMessageIndex"]
            ? Number(ctx.params["threadMessageIndex"])
            : undefined,
        open: $qs.get("open") === "true",
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
    | GlobalChatSelectedRoute
    | CommunitiesRoute
    | ShareRoute
    | NotFound
    | HotGroupsRoute;

export type HomeLandingRoute = { kind: "home_landing_route" };
export type FeaturesRoute = { kind: "features_route" };
export type ArchitectureRoute = { kind: "architecture_route" };
export type WhitepaperRoute = { kind: "whitepaper_route" };
export type RoadmapRoute = { kind: "roadmap_route" };
export type MiamiRoute = { kind: "miami_route" };
export type FaqRoute = { kind: "faq_route" };
export type DiamondRoute = { kind: "diamond_route" };
export type GuidelinesRoute = { kind: "guidelines_route" };

export type HomeRoute = {
    kind: "home_route";
};

export type GlobalChatSelectedRoute = {
    kind: "global_chat_selected_route";
    chatType: ChatType | "unknown";
    chatId: string;
    messageIndex?: number;
    threadMessageIndex?: number;
    open: boolean;
};

export type CommunitiesRoute = {
    kind: "communities_route";
    communityId?: string;
};

export type ShareRoute = {
    kind: "share_route";
    title: string;
    text: string;
    url: string;
};

export type HotGroupsRoute = {
    kind: "hot_groups_route";
};

export type BlogRoute = {
    kind: "blog_route";
    slug?: string;
};

export type NotFound = {
    kind: "not_found_route";
};
