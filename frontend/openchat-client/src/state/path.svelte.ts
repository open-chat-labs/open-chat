import { dequal } from "dequal";
import "page";
import { SvelteURLSearchParams } from "svelte/reactivity";

const noScope: NullScope = { kind: "none" };

function routesAreEqual(r1: RouteParams, r2: RouteParams) {
    return dequal(r1, r2);
}

export class PathState {
    #notFound = $state<boolean>(false);
    #pathContextStore = $state<PageJS.Context | undefined>(undefined);
    #routerReady = $state<boolean>(false);
    #location = $derived(this.#pathContextStore ? this.#pathContextStore.routePath : "");
    #querystring = $derived(
        this.#pathContextStore
            ? new SvelteURLSearchParams(this.#pathContextStore.querystring)
            : new SvelteURLSearchParams(),
    );
    #route = $state<RouteParams>({ scope: noScope, kind: "not_found_route" });
    #querystringCode = $derived(this.#querystring.get("code"));
    #querystringReferralCode = $derived(this.#querystring.get("ref"));
    #exploring = $derived(this.#querystring.get("explore"));
    #routeKind = $derived(this.#route.kind);
    #messageIndex = $derived(
        this.hasMessageIndex(this.#route) ? this.#route.messageIndex : undefined,
    );
    #threadMessageIndex = $derived(
        this.hasMessageIndex(this.#route) ? this.#route.threadMessageIndex : undefined,
    );
    #threadOpen = $derived(
        (this.#route.kind === "global_chat_selected_route" ||
            this.#route.kind === "selected_channel_route") &&
            this.#route.messageIndex !== undefined &&
            this.#route.open,
    );

    get exploring() {
        return this.#exploring;
    }
    set routerReady(val: boolean) {
        this.#routerReady = val;
    }
    get threadOpen() {
        return this.#threadOpen;
    }
    get messageIndex() {
        return this.#messageIndex;
    }
    get threadMessageIndex() {
        return this.#threadMessageIndex;
    }
    get querystring(): URLSearchParams {
        return this.#querystring;
    }
    get location(): string {
        return this.#location;
    }
    get notFound(): boolean {
        return this.#notFound;
    }
    get routerReady(): boolean {
        return this.#routerReady;
    }
    set notFound(val: boolean) {
        this.#notFound = val;
    }
    get routeKind() {
        return this.#routeKind;
    }
    get route(): Readonly<RouteParams> {
        return this.#route;
    }
    get querystringCode() {
        return this.#querystringCode;
    }
    get querystringReferral() {
        return this.#querystringReferralCode;
    }
    setRouteParams(ctx: PageJS.Context, p: RouteParams) {
        if (!routesAreEqual(this.#route, p)) {
            this.#route = p;
        }
        this.#pathContextStore = ctx;
        this.#notFound = false;
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

    hasMessageIndex(route: RouteParams): route is MessageIndexRoute {
        return (
            route.kind === "global_chat_selected_route" ||
            route.kind === "favourites_route" ||
            route.kind === "selected_channel_route"
        );
    }
}

import type {
    ChannelIdentifier,
    ChatIdentifier,
    ChatListScope,
    CommunityIdentifier,
    DirectChatIdentifier,
    GroupChatIdentifier,
    NullScope,
} from "openchat-shared";

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
