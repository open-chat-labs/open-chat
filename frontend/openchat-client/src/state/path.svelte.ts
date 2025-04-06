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
    #params = $state<RouteParams>({ kind: "not_found_route" });
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
    public get params(): Readonly<RouteParams> {
        return this.#params;
    }
    public setParams(ctx: PageJS.Context, p: RouteParams) {
        this.#params = p;
        this.#pathContextStore = ctx;
        this.#notFound = false;
    }
}

import type {
    ChannelIdentifier,
    ChatIdentifier,
    DirectChatIdentifier,
    GroupChatIdentifier,
    CommunityIdentifier,
    ChatListScope,
} from "openchat-client";

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

type RouteCommon = { scope: ChatListScope };

export type ChatListRoute = RouteCommon & { kind: "chat_list_route" };
export type HomeLandingRoute = { kind: "home_landing_route" };
export type FeaturesRoute = { kind: "features_route" };
export type ArchitectureRoute = { kind: "architecture_route" };
export type WhitepaperRoute = { kind: "whitepaper_route" };
export type RoadmapRoute = { kind: "roadmap_route" };
export type FaqRoute = { kind: "faq_route" };
export type DiamondRoute = { kind: "diamond_route" };
export type GuidelinesRoute = { kind: "guidelines_route" };
export type TermsRoute = { kind: "terms_route" };

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

export type AdminRoute = {
    kind: "admin_route";
};

export type ShareRoute = {
    kind: "share_route";
    title: string;
    text: string;
    url: string;
};

export type HotGroupsRoute = RouteCommon & {
    kind: "explore_groups_route";
};

export type BlogRoute = {
    kind: "blog_route";
    slug?: string;
};

export type NotFound = {
    kind: "not_found_route";
};
