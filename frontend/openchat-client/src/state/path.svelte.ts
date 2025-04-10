import "page";

export class PathState {
    #notFound = $state<boolean>(false);
    #pathContextStore = $state<PageJS.Context | undefined>(undefined);
    #routerReady = $state<boolean>(false);
    #location = $derived(this.#pathContextStore ? this.#pathContextStore.routePath : "");
    #querystring = $derived(
        this.#pathContextStore
            ? new URLSearchParams(this.#pathContextStore.querystring)
            : new URLSearchParams(),
    );
    #route = $state<RouteParams>({ kind: "not_found_route" });
    public set routerReady(val: boolean) {
        this.#routerReady = val;
    }
    public get querystring(): URLSearchParams {
        return this.#querystring;
    }
    public get location(): string {
        return this.#location;
    }
    public get notFound(): boolean {
        return this.#notFound;
    }
    public get routerReady(): boolean {
        return this.#routerReady;
    }
    public set notFound(val: boolean) {
        this.#notFound = val;
    }
    public get route(): Readonly<RouteParams> {
        return this.#route;
    }
    public setRouteParams(ctx: PageJS.Context, p: RouteParams) {
        this.#route = p;
        this.#pathContextStore = ctx;
        this.#notFound = false;
    }

    public scopedRoute(route: RouteParams): route is ScopedRoute {
        const scopedKinds: RouteParams["kind"][] = [
            "chat_list_route",
            "home_route",
            "global_chat_selected_route",
            "favourites_route",
            "selected_community_route",
            "selected_channel_route",
            "explore_groups_route",
        ];
        return scopedKinds.includes(route.kind);
    }

    public chatListRoute(route: RouteParams): route is ChatListRoute {
        return route.kind === "chat_list_route";
    }

    public homeRoute(route: RouteParams): route is HomeRoute {
        return route.kind === "home_route";
    }

    public communitiesRoute(route: RouteParams): route is CommunitiesRoute {
        return route.kind === "communities_route";
    }

    public selectedCommunityRoute(route: RouteParams): route is SelectedCommunityRoute {
        return route.kind === "selected_community_route";
    }

    public selectedChannelRoute(route: RouteParams): route is SelectedChannelRoute {
        return route.kind === "selected_channel_route";
    }

    public shareRoute(route: RouteParams): route is ShareRoute {
        return route.kind === "share_route";
    }

    public globalChatSelectedRoute(route: RouteParams): route is GlobalSelectedChatRoute {
        return route.kind === "global_chat_selected_route";
    }
}

import type {
    ChannelIdentifier,
    ChatIdentifier,
    ChatListScope,
    CommunityIdentifier,
    DirectChatIdentifier,
    GroupChatIdentifier,
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

type ScopedRoute =
    | ChatListRoute
    | HomeRoute
    | GlobalSelectedChatRoute
    | FavouritesRoute
    | SelectedCommunityRoute
    | SelectedChannelRoute
    | HotGroupsRoute;

type Scoped = { scope: ChatListScope };

export type ChatListRoute = Scoped & { kind: "chat_list_route" };
export type HomeLandingRoute = { kind: "home_landing_route" };
export type FeaturesRoute = { kind: "features_route" };
export type ArchitectureRoute = { kind: "architecture_route" };
export type WhitepaperRoute = { kind: "whitepaper_route" };
export type RoadmapRoute = { kind: "roadmap_route" };
export type FaqRoute = { kind: "faq_route" };
export type DiamondRoute = { kind: "diamond_route" };
export type GuidelinesRoute = { kind: "guidelines_route" };
export type TermsRoute = { kind: "terms_route" };

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

export type CommunitiesRoute = {
    kind: "communities_route";
};

export type AdminRoute = {
    kind: "admin_route";
};

export type ShareRoute = {
    kind: "share_route";
    title: string;
    text: string;
    url: string;
};

export type HotGroupsRoute = Scoped & {
    kind: "explore_groups_route";
};

export type BlogRoute = {
    kind: "blog_route";
    slug?: string;
};

export type NotFound = {
    kind: "not_found_route";
};

export const pathState = new PathState();
