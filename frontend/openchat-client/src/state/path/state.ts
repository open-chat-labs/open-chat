import {
    type ArchitectureRoute,
    type BlogRoute,
    type ChatListRoute,
    type CommunitiesRoute,
    type CommunityIdentifier,
    type DiamondRoute,
    type FaqRoute,
    type GlobalSelectedChatRoute,
    type GuidelinesRoute,
    type HomeRoute,
    type RoadmapRoute,
    type RouteParams,
    type SelectedChannelRoute,
    type SelectedCommunityRoute,
    type ShareRoute,
    type TermsRoute,
    type WhitepaperRoute,
} from "openchat-shared";
import {
    exploringStore,
    notFoundStore,
    pathContextStore,
    querystringCodeStore,
    querystringReferralCodeStore,
    querystringStore,
    routerReadyStore,
    routeStore,
    selectedCommunityIdStore,
} from "./stores";

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

export const pathState = new PathState();
