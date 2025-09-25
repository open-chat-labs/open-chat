import type {
    ChannelIdentifier,
    ChatIdentifier,
    DirectChatIdentifier,
    GroupChatIdentifier,
} from "./chat";
import type { CommunityIdentifier } from "./community";
import type { ChatListScope } from "./structure";

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
    | AdminRoute
    | ProfileSummaryRoute;

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

export type ProfileSummaryRoute = NoScope & {
    kind: "profile_summary_route";
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
