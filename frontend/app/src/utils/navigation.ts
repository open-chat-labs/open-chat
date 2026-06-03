import { publish, routeStore, routerReadyStore, subscribe } from "openchat-client";
import type { RouteParams } from "openchat-shared";
import page from "page";
import { get } from "svelte/store";
import { onPopstate, syncCurrentHistoryState } from "./history";

export type NavigationIntent = "in-app" | "notification" | "auto";
export type NavigationMode = "push" | "pop" | "replace";

type PendingNavigation = {
    to: string;
    intent: NavigationIntent;
};

const TAB_ROUTES: RouteParams["kind"][] = [
    "chat_list_route",
    "communities_route",
    "notifications_route",
    "wallet_route",
    "profile_summary_route",
];

const ROOT_TAB: RouteParams["kind"] = "chat_list_route";

// Mirrors the route patterns registered in Router.svelte — page.js owns the regexp generation.
// We access .regexp directly to avoid the match() method's dependency on the page instance.
const ROUTE_MATCHERS: Array<{ regexp: RegExp; kind: RouteParams["kind"] }> = (
    [
        { path: "/", kind: "chat_list_route" },
        { path: "/share", kind: "share_route" },
        { path: "/admin", kind: "admin_route" },
        { path: "/welcome", kind: "welcome_route" },
        { path: "/wallet", kind: "wallet_route" },
        { path: "/communities", kind: "communities_route" },
        { path: "/chats", kind: "chat_list_route" },
        { path: "/notifications", kind: "notifications_route" },
        { path: "/favourite", kind: "favourites_route" },
        { path: "/profile_summary", kind: "profile_summary_route" },
        { path: "/community/:communityId", kind: "selected_community_route" },
        {
            path: "/community/:communityId/channel/:channelId/:messageIndex?/:threadMessageIndex?",
            kind: "selected_channel_route",
        },
        {
            path: "/favourite/community/:communityId/channel/:channelId/:messageIndex?/:threadMessageIndex?",
            kind: "selected_channel_route",
        },
        {
            path: "/favourite/user/:chatId/:messageIndex?/:threadMessageIndex?",
            kind: "global_chat_selected_route",
        },
        {
            path: "/favourite/group/:chatId/:messageIndex?/:threadMessageIndex?",
            kind: "global_chat_selected_route",
        },
        {
            path: "/user/:chatId/:messageIndex?/:threadMessageIndex?",
            kind: "global_chat_selected_route",
        },
        {
            path: "/group/:chatId/:messageIndex?/:threadMessageIndex?",
            kind: "global_chat_selected_route",
        },
        {
            path: "/chats/user/:chatId/:messageIndex?/:threadMessageIndex?",
            kind: "global_chat_selected_route",
        },
        {
            path: "/chats/group/:chatId/:messageIndex?/:threadMessageIndex?",
            kind: "global_chat_selected_route",
        },
    ] as Array<{ path: string; kind: RouteParams["kind"] }>
).map(({ path, kind }) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    regexp: (new page.Route(path) as any).regexp as RegExp,
    kind,
}));

function pathToRouteKind(path: string): RouteParams["kind"] {
    const pathname = path.split("?")[0];
    for (const { regexp, kind } of ROUTE_MATCHERS) {
        if (regexp.test(pathname)) return kind;
    }
    return "not_found_route";
}

/**
 * Returns true if the destination path includes a threadMessageIndex segment,
 * meaning a thread panel will be open at the destination.
 */
function pathHasThread(path: string): boolean {
    const [pathname, qs] = path.split("?");
    if (qs && new URLSearchParams(qs).get("open") === "true") return true;
    const segs = pathname.split("/").filter(Boolean);
    if (segs[0] === "group" || segs[0] === "user") return segs.length >= 4;
    if (segs[0] === "chats" && (segs[1] === "group" || segs[1] === "user")) return segs.length >= 5;
    if (segs[0] === "community" && segs[2] === "channel") return segs.length >= 6;
    if (segs[0] === "favourite") {
        if (segs[1] === "group" || segs[1] === "user") return segs.length >= 5;
        if (segs[1] === "community") return segs.length >= 7;
    }
    return false;
}

function routeHasThread(route: RouteParams): boolean {
    if (
        route.kind === "global_chat_selected_route" ||
        route.kind === "selected_channel_route" ||
        route.kind === "favourites_route"
    ) {
        return route.threadMessageIndex !== undefined || route.open;
    }
    return false;
}

/**
 * Determines whether a navigation should push a new history entry, replace the
 * current one, or pop back to the previous one.
 *
 * Rules (chats is the root tab — back always returns there):
 *   notification intent                    → replace
 *   chats    → anywhere else               → push
 *   non-root tab → chats                   → pop
 *   non-root tab → non-root tab            → replace  (lateral)
 *   non-root tab → chat                    → push
 *   community → channel (same community)   → push
 *   community → chats                      → pop
 *   channel   → community                  → push
 *   chat (no thread) → same chat + thread  → push     (open thread)
 *   chat + thread → same chat (no thread)  → pop      (close thread)
 *   chat + thread → chat + thread          → replace  (switch thread)
 *   chat     → chats                       → pop
 *   chat     → non-root tab                → replace  (leave chat, switch tab)
 *   chat     → chat                        → replace  (lateral at depth)
 *   anything else                          → replace
 */
export function navigationMode(
    to: string,
    from: RouteParams,
    intent: NavigationIntent = "in-app",
): NavigationMode {
    if (intent === "notification" || intent === "auto") return "replace";

    const toKind = pathToRouteKind(to);
    const fromIsRootTab = from.kind === ROOT_TAB;
    const fromIsNonRootTab = TAB_ROUTES.includes(from.kind) && !fromIsRootTab;
    const fromIsChat = ["global_chat_selected_route", "selected_channel_route"].includes(from.kind);
    const fromIsCommunity = from.kind === "selected_community_route";
    const toIsRootTab = toKind === ROOT_TAB;
    const toIsNonRootTab = TAB_ROUTES.includes(toKind) && !toIsRootTab;
    const toIsChat = ["global_chat_selected_route", "selected_channel_route"].includes(toKind);
    const toIsCommunity = toKind === "selected_community_route";

    if (fromIsRootTab && !toIsRootTab) return "push";
    if (fromIsNonRootTab && toIsRootTab) return "pop";
    if (fromIsNonRootTab && toIsNonRootTab) return "replace";
    if (fromIsNonRootTab && toIsChat) return "push";
    if (fromIsCommunity && toIsChat) return "push";
    if (fromIsCommunity && toIsRootTab) return "pop";
    if (fromIsChat && toIsCommunity) return "push";
    if (fromIsChat && toIsRootTab) return "pop";
    if (fromIsChat && toIsNonRootTab) return "replace";
    if (fromIsChat && toIsChat) {
        const fromThread = routeHasThread(from);
        const toThread = pathHasThread(to);
        if (!fromThread && toThread) return "push"; // opening a thread
        if (fromThread && !toThread) return "pop"; // closing a thread
        return "replace"; // lateral (thread↔thread or chat↔chat)
    }

    return "replace";
}

/**
 * Tracks how many entries this session has pushed onto the history stack.
 * Used to detect whether a pop has a real entry to go back to, or whether
 * we should fall back to a replace (e.g. user arrived via deep link).
 */
let pushDepth = 0;
let pendingNavigation: PendingNavigation | null = null;

function handlePopstate(event: PopStateEvent) {
    const { previousAction } = onPopstate(event);

    if (previousAction !== undefined) {
        return;
    }

    if (pushDepth > 0) {
        pushDepth--;
    }
}

function doNavigate(to: string, intent: NavigationIntent, retries = 0) {
    if (!get(routerReadyStore)) {
        if (retries >= 10) {
            console.error("ROUTER: router not ready after 10 retries, giving up");
            return;
        }
        console.debug("ROUTER: router not ready, retrying in 100ms");
        window.setTimeout(() => doNavigate(to, intent, retries + 1), 100);
        return;
    }
    const mode = navigationMode(to, routeStore.value, intent);
    console.log("Navigating: (from, to, mode)", routeStore.value, to, mode);
    switch (mode) {
        case "push":
            pushDepth++;
            page(to);
            syncCurrentHistoryState(history.state);
            break;
        case "replace":
            page.replace(to);
            syncCurrentHistoryState(history.state);
            break;
        case "pop":
            if (pushDepth > 0) {
                history.back();
            } else {
                page.replace(to);
                syncCurrentHistoryState(history.state);
            }
            break;
    }
}

/**
 * It is very important that all navigation is done via this function.
 * If modals are open they will be closed first; navigation fires once the
 * history stack is clean.
 */
export function navigate(to: string, intent: NavigationIntent = "in-app") {
    // record the pending navigation
    pendingNavigation = { to, intent };

    // This will close any open modal stack if necessary and then call flushPendingNavigation
    publish("closeModalStack", undefined);
}

/**
 * Called by Modals.svelte when the modal stack has fully drained.
 * Fires any navigation that was deferred by navigate().
 */
export function flushPendingNavigation() {
    if (pendingNavigation) {
        const { to, intent } = pendingNavigation;
        pendingNavigation = null;
        doNavigate(to, intent);
    }
}

export function hasPendingNavigation(): boolean {
    return pendingNavigation !== null;
}

export function initNavigationHistoryTracking() {
    syncCurrentHistoryState(history.state);
    window.addEventListener("popstate", handlePopstate);
    const unsubNavigateTo = subscribe("navigateTo", ({ url, intent }) => navigate(url, intent ?? "in-app"));

    return () => {
        window.removeEventListener("popstate", handlePopstate);
        unsubNavigateTo();
    };
}

// this is called from the iOS only back gesture detection. Do not call this under any other circumstances (that means you AI)
export function navigateBack() {
    if (history.length > 1) {
        history.back();
    }
}
