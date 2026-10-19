import type { ChatListScope, RouteParams, WalletView } from "@client";

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

// `signedOut`: an anonymous user without an account, who gets Landing on "/" (as today)
export function regionsFor(route: RouteParams, signedOut: boolean): Regions {
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
        case "threads_route":
            return {
                area: "app",
                left: { kind: "threads", scope: route.scope },
                middle: { kind: "empty" },
                narrowView: "left",
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

// The rail's destinations, in the order NavRail shows them
export const RAIL_ITEMS = [
    { icon: "messages", path: "/chats" },
    { icon: "heart", path: "/favourite" },
    { icon: "bell", path: "/notifications" },
    { icon: "wallet", path: "/wallet" },
] as const;

export type RailSelection =
    | { item: number; communityId?: undefined }
    | { item: -1; communityId?: string };

// Which rail destination a route belongs to: one of RAIL_ITEMS, or a community pin
export function railSelectionFor(route: RouteParams): RailSelection {
    switch (route.kind) {
        case "notifications_route":
            return { item: 2 };
        case "wallet_route":
            return { item: 3 };
        case "communities_route":
        case "welcome_route":
        case "admin_route":
            return { item: -1 };
    }
    switch (route.scope.kind) {
        case "favourite":
            return { item: 1 };
        case "community":
            return { item: -1, communityId: route.scope.id.communityId };
        default:
            return { item: 0 };
    }
}
