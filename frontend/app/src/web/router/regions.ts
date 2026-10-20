import { routeForScope, type ChatListScope, type RouteParams, type WalletView } from "@client";

// What a route shows (ROUTES.md). The screens behind each region come in later phases; until then
// each one is a placeholder that says what it will be.
export type Regions =
    | { area: "marketing"; route: RouteParams }
    | { area: "not_found" }
    | {
          area: "app";
          left?:
              | { kind: "chats"; scope: ChatListScope }
              | { kind: "threads"; scope: ChatListScope }
              | { kind: "activity" }
              | { kind: "wallet" };
          middle:
              | { kind: "empty" }
              | { kind: "conversation"; route: Extract<RouteParams, { chatId: unknown }> }
              | { kind: "explore" }
              | { kind: "wallet"; view: WalletView; ledger?: string }
              | { kind: "admin" };
          // the column a narrow screen shows
          narrowView: "left" | "middle";
          // a route with no right column (details) says so; the others have one (ROUTES.md)
          rightColumn?: false;
      };

const MARKETING_KINDS: RouteParams["kind"][] = [
    "home_landing_route",
    "features_route",
    "roadmap_route",
    "blog_route",
    "whitepaper_route",
    "guidelines_route",
    "terms_route",
    "privacy_route",
    "faq_route",
    "diamond_route",
    "architecture_route",
    "csea_reporting_route",
];

/**
 * The regions a route shows. `signedOut`: an anonymous user without an account, who gets Landing
 * on "/" (as today). `threads` (the URL's `?threads`): the left column shows the chat list's
 * threads in place of the list, over whatever the middle shows (ROUTES.md).
 */
export function regionsFor(route: RouteParams, signedOut: boolean, threads = false): Regions {
    const regions = routeRegions(route, signedOut);
    if (!threads || regions.area !== "app" || regions.left?.kind !== "chats") return regions;
    // a narrow screen still shows a conversation (a thread opened from the list) over the list
    return {
        ...regions,
        left: { kind: "threads", scope: regions.left.scope },
        narrowView: regions.middle.kind === "empty" ? "left" : regions.narrowView,
    };
}

function routeRegions(route: RouteParams, signedOut: boolean): Regions {
    if (MARKETING_KINDS.includes(route.kind) || (route.kind === "home_route" && signedOut)) {
        return { area: "marketing", route };
    }
    switch (route.kind) {
        case "not_found_route":
            return { area: "not_found" };
        case "global_chat_selected_route":
        case "selected_channel_route":
            return {
                area: "app",
                left: { kind: "chats", scope: route.scope },
                middle: { kind: "conversation", route },
                narrowView: "middle",
            };
        case "notifications_route":
            return {
                area: "app",
                left: { kind: "activity" },
                middle: { kind: "empty" },
                narrowView: "left",
            };
        case "communities_route":
        case "welcome_route":
            // full width, without the details column (joining is a dialog)
            return {
                area: "app",
                middle: { kind: "explore" },
                narrowView: "middle",
                rightColumn: false,
            };
        case "wallet_route":
            return {
                area: "app",
                left: { kind: "wallet" },
                middle: { kind: "wallet", view: route.view, ledger: route.ledger },
                // the wallet's own panel is its home on a narrow screen
                narrowView: route.view === "all" ? "left" : "middle",
                // its settings are a dialog
                rightColumn: false,
            };
        case "admin_route":
            return { area: "app", middle: { kind: "admin" }, narrowView: "middle" };
        default:
            // the chat lists (and routes that redirect to one: "/", /community/:id, /share)
            return {
                area: "app",
                left: { kind: "chats", scope: route.scope },
                middle: { kind: "empty" },
                narrowView: "left",
            };
    }
}

// The rail's destinations, in the order NavRail shows them, with their labels: the app's own
// strings, which are translated (the library's are English only so far)
export const RAIL_ITEMS = [
    { id: "chats", icon: "messages", label: "communities.dmsAndGroupChats", path: "/chats" },
    { id: "notifications", icon: "bell", label: "upgrade.notifications", path: "/notifications" },
    { id: "favourites", icon: "heart", label: "communities.favourites", path: "/favourite" },
    { id: "wallet", icon: "wallet", label: "wallet", path: "/wallet" },
] as const;

export type RailItem = (typeof RAIL_ITEMS)[number];
export type RailItemId = RailItem["id"];

export type RailSelection =
    | { item: RailItemId; communityId?: undefined }
    | { item?: undefined; communityId?: string };

/**
 * The rail's destinations to show: Favourites only once something is a favourite (as the old
 * UI's left nav), or while it's the page open.
 */
export function railItems(hasFavourites: boolean, selection: RailSelection): RailItem[] {
    return RAIL_ITEMS.filter(
        (item) => item.id !== "favourites" || hasFavourites || selection.item === "favourites",
    );
}

// Which rail destination a route belongs to: one of RAIL_ITEMS, a community pin, or neither
export function railSelectionFor(route: RouteParams): RailSelection {
    switch (route.kind) {
        case "notifications_route":
            return { item: "notifications" };
        case "wallet_route":
            return { item: "wallet" };
        case "communities_route":
        case "welcome_route":
        case "admin_route":
            return {};
    }
    switch (route.scope.kind) {
        case "favourite":
            return { item: "favourites" };
        case "community":
            return { communityId: route.scope.id.communityId };
        default:
            return { item: "chats" };
    }
}

/**
 * Where a narrow screen's Back goes from the middle: the list it came from (the thread list
 * keeping its ?threads), or the wallet's tokens; nowhere for the others.
 */
export function narrowBack(regions: Regions): string | undefined {
    if (regions.area !== "app") return undefined;
    const left = regions.left;
    switch (left?.kind) {
        case "chats":
            return routeForScope(left.scope);
        case "threads":
            return `${routeForScope(left.scope)}?threads`;
        case "wallet":
            return "/wallet";
        default:
            return undefined;
    }
}
