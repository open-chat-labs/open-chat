import {
    routeForScope,
    type ChatListScope,
    type RouteParams,
    type WalletPage,
    type WalletRoute,
} from "@client";
import { isLandingPageRoute } from "@src/utils/urls";

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
              // `over`: opened over another page's middle (?panel=activity), with Back to its own
              | { kind: "activity"; over?: true }
              | { kind: "wallet" };
          middle:
              | { kind: "empty" }
              | { kind: "conversation"; route: Extract<RouteParams, { chatId: unknown }> }
              | { kind: "explore" }
              | ({ kind: "wallet" } & WalletPage)
              | { kind: "admin" };
          // the column a narrow screen shows
          narrowView: "left" | "middle";
          // a route with no right column (details) says so; the others have one (ROUTES.md)
          rightColumn?: false;
      };

/**
 * The regions a route shows. `signedOut`: an anonymous user without an account, who gets Landing
 * on "/" (as today). The URL's query can change the left column only, over whatever the middle
 * shows (ROUTES.md): `?panel=activity` (decision 7) puts the activity feed over a chat list's or
 * the wallet's page, and `?threads` a chat list's threads in place of the list.
 */
export function regionsFor(
    route: RouteParams,
    signedOut: boolean,
    query: URLSearchParams = new URLSearchParams(),
): Regions {
    const regions = routeRegions(route, signedOut);
    if (regions.area !== "app") return regions;
    const left = regions.left;
    if (query.get("panel") === "activity" && (left?.kind === "chats" || left?.kind === "wallet")) {
        return { ...regions, left: { kind: "activity", over: true }, narrowView: "left" };
    }
    if (query.has("threads") && left?.kind === "chats") {
        // a narrow screen still shows a conversation (a thread opened from the list) over the list
        return {
            ...regions,
            left: { kind: "threads", scope: left.scope },
            narrowView: regions.middle.kind === "empty" ? "left" : regions.narrowView,
        };
    }
    return regions;
}

function walletPage(route: WalletRoute): WalletPage {
    switch (route.view) {
        case "all":
        case "recipients":
            return { view: route.view };
        case "token":
            return { view: route.view, ledger: route.ledger };
        default:
            return { view: route.view, ledger: route.ledger };
    }
}

function routeRegions(route: RouteParams, signedOut: boolean): Regions {
    if (isLandingPageRoute(route) || (route.kind === "home_route" && signedOut)) {
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
                middle: { kind: "wallet", ...walletPage(route) },
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

/**
 * Whether Notifications opens the activity feed over the page that's showing (?panel=activity,
 * decision 7): over a chat or a wallet page it does, so the middle stays; otherwise it goes to
 * /notifications.
 */
export function activityOverPage(regions: Regions): boolean {
    return (
        regions.area === "app" &&
        regions.middle.kind !== "empty" &&
        (regions.left?.kind === "chats" ||
            regions.left?.kind === "threads" ||
            regions.left?.kind === "wallet" ||
            (regions.left?.kind === "activity" && regions.left.over === true))
    );
}
