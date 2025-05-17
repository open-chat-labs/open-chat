import { dequal } from "dequal";
import "page";

const noScope: NullScope = { kind: "none" };

function hasMessageIndex(route: RouteParams): route is MessageIndexRoute {
    return (
        route.kind === "global_chat_selected_route" ||
        route.kind === "favourites_route" ||
        route.kind === "selected_channel_route"
    );
}

export const notFoundStore = writable<boolean>(false);
export const pathContextStore = writable<PageJS.Context | undefined>(undefined, dequal);
export const routerReadyStore = writable<boolean>(false);
export const locationStore = derived(pathContextStore, (pathContext) =>
    pathContext ? pathContext.routePath : "",
);
export const querystringStore = derived(pathContextStore, (pathContext) =>
    pathContext ? new URLSearchParams(pathContext.querystring) : new URLSearchParams(),
);
export const routeStore = writable<RouteParams>(
    { scope: noScope, kind: "not_found_route" },
    dequal,
);
export const querystringCodeStore = derived(querystringStore, (qs) => qs.get("code"));
export const querystringReferralCodeStore = derived(querystringStore, (qs) => qs.get("ref"));
export const exploringStore = derived(querystringStore, (qs) => qs.get("explore") != null);
export const routeKindStore = derived(routeStore, (route) => route.kind);
export const messageIndexStore = derived(routeStore, (route) =>
    hasMessageIndex(route) ? route.messageIndex : undefined,
);
export const threadMessageIndexStore = derived(routeStore, (route) =>
    hasMessageIndex(route) ? route.threadMessageIndex : undefined,
);
export const threadOpenStore = derived(
    routeStore,
    (route) =>
        (route.kind === "global_chat_selected_route" || route.kind === "selected_channel_route") &&
        route.messageIndex !== undefined &&
        route.open,
);
export const selectedCommunityIdStore = derived(routeStore, (route) => {
    switch (route.kind) {
        case "selected_community_route":
        case "selected_channel_route":
            return route.communityId;
        case "favourites_route":
            if (route.chatId?.kind === "channel") {
                return {
                    kind: "community",
                    communityId: route.chatId.communityId,
                } as CommunityIdentifier;
            }
            return undefined;
        default:
            return undefined;
    }
});

export class PathState {
    #communityId = $state<CommunityIdentifier | undefined>();
    #routerReady = false;
    #route!: RouteParams;
    #exploring = $state<boolean>(false);
    #querystring!: URLSearchParams;
    #querystringCode?: string;
    #querystringReferralCode?: string;

    constructor() {
        selectedCommunityIdStore.subscribe((val) => (this.#communityId = val));
        exploringStore.subscribe((val) => (this.#exploring = val));
        routerReadyStore.subscribe((val) => (this.#routerReady = val));
        querystringStore.subscribe((val) => (this.#querystring = val));
        querystringCodeStore.subscribe((val) => (this.#querystringCode = val ?? undefined));
        querystringReferralCodeStore.subscribe(
            (val) => (this.#querystringReferralCode = val ?? undefined),
        );
        routeStore.subscribe((val) => (this.#route = val));
    }

    get communityId() {
        return this.#communityId;
    }
    get exploring() {
        return this.#exploring;
    }
    set routerReady(val: boolean) {
        this.#routerReady = val;
    }
    get querystring(): URLSearchParams {
        return this.#querystring;
    }
    get route() {
        return this.#route;
    }
    get routerReady(): boolean {
        return this.#routerReady;
    }
    get querystringCode() {
        return this.#querystringCode;
    }
    get querystringReferral() {
        return this.#querystringReferralCode;
    }
    setRouteParams(ctx: PageJS.Context, p: RouteParams) {
        // TODO - this is a case for a transaction
        routeStore.set(p);
        pathContextStore.set(ctx);
        notFoundStore.set(false);
    }
    isChatListRoute(route: RouteParams): route is ChatListRoute {
        return route.kind === "chat_list_route";
    }

    isHomeRoute(route: RouteParams): route is HomeRoute {
        return route.kind === "home_route";
    }

    isCommunitiesRoute(route: RouteParams): route is CommunitiesRoute {
        return route.kind === "communities_route";
    }

    isSelectedCommunityRoute(route: RouteParams): route is SelectedCommunityRoute {
        return route.kind === "selected_community_route";
    }

    isSelectedChannelRoute(route: RouteParams): route is SelectedChannelRoute {
        return route.kind === "selected_channel_route";
    }

    isShareRoute(route: RouteParams): route is ShareRoute {
        return route.kind === "share_route";
    }

    isGlobalChatSelectedRoute(route: RouteParams): route is GlobalSelectedChatRoute {
        return route.kind === "global_chat_selected_route";
    }

    isBlogRoute(route: RouteParams): route is BlogRoute {
        return route.kind === "blog_route";
    }

    isRoadmapRoute(route: RouteParams): route is RoadmapRoute {
        return route.kind === "roadmap_route";
    }

    isWhitepaperRoute(route: RouteParams): route is WhitepaperRoute {
        return route.kind === "whitepaper_route";
    }

    isArchitectureRoute(route: RouteParams): route is ArchitectureRoute {
        return route.kind === "architecture_route";
    }

    isGuidelinesRoute(route: RouteParams): route is GuidelinesRoute {
        return route.kind === "guidelines_route";
    }

    isTermsRoute(route: RouteParams): route is TermsRoute {
        return route.kind === "terms_route";
    }

    isFaqRoute(route: RouteParams): route is FaqRoute {
        return route.kind === "faq_route";
    }

    isDiamondRoute(route: RouteParams): route is DiamondRoute {
        return route.kind === "diamond_route";
    }
}

import {
    type ChannelIdentifier,
    type ChatIdentifier,
    type ChatListScope,
    type CommunityIdentifier,
    type DirectChatIdentifier,
    type GroupChatIdentifier,
    type NullScope,
} from "openchat-shared";
import { derived } from "svelte/store";
import { writable } from "./writable";

export type LandingPageRoute =
    | HomeLandingRoute
    | FeaturesRoute
    | ArchitectureRoute
    | WhitepaperRoute
    | RoadmapRoute
    | BlogRoute
    | FaqRoute
    | GuidelinesRoute
    | TermsRoute
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
    | HotGroupsRoute
    | AdminRoute;

export type MessageIndexRoute = GlobalSelectedChatRoute | FavouritesRoute | SelectedChannelRoute;

type Scoped = { scope: ChatListScope };
type NoScope = { scope: { kind: "none" } };

export type ChatListRoute = Scoped & { kind: "chat_list_route" };
export type HomeLandingRoute = NoScope & { kind: "home_landing_route" };
export type FeaturesRoute = NoScope & { kind: "features_route" };
export type ArchitectureRoute = NoScope & { kind: "architecture_route" };
export type WhitepaperRoute = NoScope & { kind: "whitepaper_route" };
export type RoadmapRoute = NoScope & { kind: "roadmap_route" };
export type FaqRoute = NoScope & { kind: "faq_route" };
export type DiamondRoute = NoScope & { kind: "diamond_route" };
export type GuidelinesRoute = NoScope & { kind: "guidelines_route" };
export type TermsRoute = NoScope & { kind: "terms_route" };

export type HomeRoute = Scoped & {
    kind: "home_route";
};

export type GlobalSelectedChatRoute = Scoped & {
    kind: "global_chat_selected_route";
    chatId: GroupChatIdentifier | DirectChatIdentifier;
    chatType: "group_chat" | "direct_chat";
    messageIndex?: number;
    threadMessageIndex?: number;
    open: boolean;
};

export type FavouritesRoute = Scoped & {
    kind: "favourites_route";
    chatId?: ChatIdentifier;
    messageIndex?: number;
    threadMessageIndex?: number;
    open: boolean;
};

export type SelectedCommunityRoute = Scoped & {
    kind: "selected_community_route";
    communityId: CommunityIdentifier;
};

export type SelectedChannelRoute = Scoped & {
    kind: "selected_channel_route";
    chatId: ChannelIdentifier;
    communityId: CommunityIdentifier;
    messageIndex?: number;
    threadMessageIndex?: number;
    open: boolean;
};

export type CommunitiesRoute = NoScope & {
    kind: "communities_route";
};

export type AdminRoute = NoScope & {
    kind: "admin_route";
};

export type ShareRoute = NoScope & {
    kind: "share_route";
    title: string;
    text: string;
    url: string;
};

export type HotGroupsRoute = Scoped & {
    kind: "explore_groups_route";
};

export type BlogRoute = NoScope & {
    kind: "blog_route";
    slug?: string;
};

export type NotFound = NoScope & {
    kind: "not_found_route";
};

export const pathState = new PathState();
