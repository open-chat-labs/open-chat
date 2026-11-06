import {
    routeForChatIdentifier,
    routeForScope,
    type ChatIdentifier,
    type ChatListScope,
    type CommunityIdentifier,
    type RouteParams,
    type WalletRoute,
} from "@client";
import { isLandingPageRoute } from "@src/utils/urls";

// Where each URL is in the native tree (native design notes §1 Structure): which of the five tabs,
// and the push stack on it, from the tab's root to the screen the URL names. The URLs are the web
// tree's (utils/routeTable.ts, src/web/ROUTES.md); the native tree never makes up its own, so the
// same URL opens the same place in either tree, and a shared link or a notification lands in the
// right place whichever one is mounted. `/chats/user/x` is the Chats tab with the list, then the
// conversation.

export const NATIVE_TABS = ["chats", "communities", "wallet", "activity", "you"] as const;
export type NativeTabId = (typeof NATIVE_TABS)[number];

/** A route that names a chat: a DM or group (global), or a channel. */
export type ChatRoute = Extract<
    RouteParams,
    { kind: "global_chat_selected_route" | "selected_channel_route" }
>;

type WalletFlow = Extract<WalletRoute, { view: "send" | "receive" | "swap" }>;

/** A screen of the native tree: a tab's root, or one pushed onto its stack. */
export type NativeScreen =
    // the tabs' roots
    | { kind: "chats"; scope: ChatListScope }
    | { kind: "communities"; communityId: CommunityIdentifier }
    | { kind: "wallet" }
    | { kind: "activity" }
    | { kind: "you" }
    // pushed
    | { kind: "conversation"; route: ChatRoute }
    | { kind: "thread"; route: ChatRoute }
    | { kind: "threads"; scope: ChatListScope }
    | { kind: "explore" }
    | { kind: "token"; ledger: string }
    | { kind: "wallet_flow"; view: WalletFlow["view"]; ledger?: string }
    | { kind: "recipients" }
    | { kind: "admin" };

/**
 * A screen in a stack, with the URL it shows at, which Back goes to from the screen above it.
 * `key` is the screen's identity: the same key is the same screen, whatever its URL's details (a
 * conversation scrolled to another message). A root showing something else is another root: the
 * Chats list or Favourites, one community or another, or Explore without one.
 */
export type StackStep = { key: string; screen: NativeScreen; url: string };

/** A tab and its stack, from its root (`steps[0]`) to the screen showing. */
export type TabsLocation = { area: "tabs"; tab: NativeTabId; steps: StackStep[] };

export type NativeLocation =
    | TabsLocation
    // the marketing pages, and "/" signed out: outside the tabs
    | { area: "marketing"; route: RouteParams }
    | { area: "not_found" };

/** What a URL's place depends on besides the URL. */
export type LocationContext = {
    /** An anonymous user without an account: "/" is Landing, as on the web. */
    signedOut: boolean;
    /**
     * The community the Communities tab shows (the one it was left on, else the default): Explore
     * is pushed over it. None without a community, when Explore is the tab's root.
     */
    community: CommunityIdentifier | undefined;
};

/** The place of `route`, whose URL is `url` (path and query). */
export function locationFor(
    route: RouteParams,
    url: string,
    context: LocationContext,
): NativeLocation {
    if (isLandingPageRoute(route) || (route.kind === "home_route" && context.signedOut)) {
        return { area: "marketing", route };
    }
    if (route.kind === "not_found_route") {
        return { area: "not_found" };
    }
    const query = queryOf(url);
    // the web's profile dialog (?profile) is the You tab here
    if (query.has("profile")) {
        return tabs("you", url, [youRoot()]);
    }
    switch (route.kind) {
        case "global_chat_selected_route":
            return tabs("chats", url, [chatsRoot(route.scope), ...chatSteps(route, query)]);
        case "selected_channel_route":
            // a favourite channel is in Chats (Favourites), any other in its community
            return route.scope.kind === "favourite"
                ? tabs("chats", url, [chatsRoot(route.scope), ...chatSteps(route, query)])
                : tabs("communities", url, [
                      communitiesRoot(route.communityId),
                      ...chatSteps(route, query),
                  ]);
        case "selected_community_route":
            return tabs("communities", url, [
                communitiesRoot(route.communityId),
                ...threadsStep({ kind: "community", id: route.communityId }, query),
            ]);
        case "communities_route":
        case "welcome_route":
            return tabs(
                "communities",
                url,
                context.community !== undefined
                    ? [communitiesRoot(context.community), exploreStep()]
                    : [exploreStep()],
            );
        case "wallet_route":
            return tabs("wallet", url, [walletRoot(), ...walletSteps(route)]);
        case "notifications_route":
            return tabs("activity", url, [
                step("activity", { kind: "activity" }, "/notifications"),
            ]);
        case "profile_summary_route":
            return tabs("you", url, [youRoot()]);
        case "admin_route":
            return tabs("you", url, [youRoot(), step("admin", { kind: "admin" }, "/admin")]);
        case "chat_list_route":
            return tabs("chats", url, [chatsRoot(route.scope), ...threadsStep(route.scope, query)]);
        default:
            // "/" (which redirects to a chat list once the chats are in), a share (the chat picker,
            // to come), and the routes the table doesn't make (favourites, explore groups)
            return tabs("chats", url, [chatsRoot({ kind: "chats" })]);
    }
}

/**
 * Whether the tab bar shows over this stack: only on a tab's root (the five pages the bar names),
 * as the prototype has it. Every pushed screen (a conversation, a thread, Followed threads, a
 * token page …) has the whole window, and Back is the way out of it.
 */
export function showsTabBar(steps: readonly StackStep[]): boolean {
    return steps.length <= 1;
}

/** Where a tab opens when it has no stack yet: its root. */
export function tabRootUrl(tab: NativeTabId, community: CommunityIdentifier | undefined): string {
    switch (tab) {
        case "chats":
            return "/chats";
        case "communities":
            // mobile's page for no communities, which is Explore
            return community !== undefined ? communityUrl(community) : "/welcome";
        case "wallet":
            return "/wallet";
        case "activity":
            return "/notifications";
        case "you":
            return "/profile_summary";
    }
}

// The top step shows at the URL itself (its query and message index kept); the ones under it at
// their own canonical URLs.
function tabs(tab: NativeTabId, url: string, steps: StackStep[]): TabsLocation {
    const top = steps[steps.length - 1];
    return { area: "tabs", tab, steps: [...steps.slice(0, -1), { ...top, url }] };
}

function step(key: string, screen: NativeScreen, url: string): StackStep {
    return { key, screen, url };
}

function chatsRoot(scope: ChatListScope): StackStep {
    // the Chats tab lists DMs and groups, or favourites
    const listed: ChatListScope = scope.kind === "favourite" ? scope : { kind: "chats" };
    return step(`chats:${listed.kind}`, { kind: "chats", scope: listed }, routeForScope(listed));
}

function communitiesRoot(communityId: CommunityIdentifier): StackStep {
    return step(
        `communities:${communityId.communityId}`,
        { kind: "communities", communityId },
        communityUrl(communityId),
    );
}

function communityUrl(communityId: CommunityIdentifier): string {
    return `/community/${communityId.communityId}`;
}

function exploreStep(): StackStep {
    return step("explore", { kind: "explore" }, "/communities");
}

function walletRoot(): StackStep {
    return step("wallet", { kind: "wallet" }, "/wallet");
}

function youRoot(): StackStep {
    return step("you", { kind: "you" }, "/profile_summary");
}

// The followed threads list (?threads) over a chat list
function threadsStep(scope: ChatListScope, query: URLSearchParams): StackStep[] {
    return query.has("threads")
        ? [step("threads", { kind: "threads", scope }, `${routeForScope(scope)}?threads`)]
        : [];
}

// A chat's screens: the threads list it was opened from (?threads), the conversation, and the
// thread open in it (`/:rootIndex?open=true`, or `/:rootIndex/:threadIndex`)
function chatSteps(route: ChatRoute, query: URLSearchParams): StackStep[] {
    const chat = chatKey(route.chatId);
    const steps = [
        ...threadsStep(route.scope, query),
        step(
            `conversation:${chat}`,
            { kind: "conversation", route },
            routeForChatIdentifier(route.scope.kind, route.chatId),
        ),
    ];
    if (
        route.messageIndex !== undefined &&
        (route.open || route.threadMessageIndex !== undefined)
    ) {
        const url = `${routeForChatIdentifier(route.scope.kind, route.chatId)}/${route.messageIndex}?open=true`;
        steps.push(step(`thread:${chat}:${route.messageIndex}`, { kind: "thread", route }, url));
    }
    return steps;
}

// The wallet's pages: a token's, and Send / Receive / Swap over the token they started from
// (?token=), else over the wallet
function walletSteps(route: WalletRoute): StackStep[] {
    switch (route.view) {
        case "all":
            return [];
        case "token":
            return [tokenStep(route.ledger)];
        case "recipients":
            return [step("recipients", { kind: "recipients" }, "/wallet/recipients")];
        default: {
            const flow = step(
                `wallet_flow:${route.view}`,
                { kind: "wallet_flow", view: route.view, ledger: route.ledger },
                route.ledger !== undefined
                    ? `/wallet/${route.view}?token=${encodeURIComponent(route.ledger)}`
                    : `/wallet/${route.view}`,
            );
            return route.ledger !== undefined ? [tokenStep(route.ledger), flow] : [flow];
        }
    }
}

function tokenStep(ledger: string): StackStep {
    return step(
        `token:${ledger}`,
        { kind: "token", ledger },
        `/wallet/${encodeURIComponent(ledger)}`,
    );
}

function chatKey(id: ChatIdentifier): string {
    switch (id.kind) {
        case "direct_chat":
            return `user/${id.userId}`;
        case "group_chat":
            return `group/${id.groupId}`;
        case "channel":
            return `channel/${id.communityId}/${id.channelId}`;
    }
}

function queryOf(url: string): URLSearchParams {
    const search = url.split("#")[0].split("?")[1];
    return new URLSearchParams(search ?? "");
}
