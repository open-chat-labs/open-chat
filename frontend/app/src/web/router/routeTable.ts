import {
    adminRoute,
    blogRoute,
    chatListRoute,
    communitesRoute,
    globalDirectChatSelectedRoute,
    globalGroupChatSelectedRoute,
    notificationsRoute,
    profileSummaryRoute,
    selectedChannelRoute,
    selectedCommunityRoute,
    shareRoute,
    walletRoute,
    welcomeRoute,
    type RouteParams,
} from "@client";

export type RouteEntry = {
    path: string;
    parse: (ctx: PageJS.Context) => RouteParams;
};

// The thread lists' paths from before they were a view (?threads), sent on to it. They come
// ahead of the routes, as the legacy /:chatId/... route would take /chats/threads as a group.
export const redirectTable: { path: string; to: (params: Record<string, string>) => string }[] = [
    { path: "/chats/threads", to: () => "/chats?threads" },
    { path: "/favourite/threads", to: () => "/favourite?threads" },
    {
        path: "/community/:communityId/threads",
        to: ({ communityId }) => `/community/${encodeURIComponent(communityId)}?threads`,
    },
];

const page = (kind: Extract<RouteParams, { scope: { kind: "none" } }>["kind"]) => () =>
    ({ kind, scope: { kind: "none" } }) as RouteParams;

// Every path the new web UI routes, in the order page.js tries them: the first match wins.
// ROUTES.md says what each one renders. It's the existing desktop router's table (every current
// path stays) plus the paths the new UI adds, which have to come before the legacy
// /:chatId/... route, as that takes any one to three segment path as a group id.
export const routeTable: RouteEntry[] = [
    // marketing pages, outside the shell
    { path: "/home", parse: page("home_landing_route") },
    { path: "/features", parse: page("features_route") },
    { path: "/roadmap", parse: page("roadmap_route") },
    { path: "/blog/:slug?", parse: blogRoute },
    { path: "/whitepaper", parse: page("whitepaper_route") },
    { path: "/guidelines", parse: page("guidelines_route") },
    { path: "/terms", parse: page("terms_route") },
    { path: "/privacy", parse: page("privacy_route") },
    { path: "/faq", parse: page("faq_route") },
    { path: "/diamond", parse: page("diamond_route") },
    { path: "/architecture", parse: page("architecture_route") },
    { path: "/csea-reporting", parse: page("csea_reporting_route") },

    // explore
    { path: "/communities", parse: communitesRoute },

    // new in the web UI (mobile's paths where it has them)
    { path: "/welcome", parse: welcomeRoute },
    { path: "/wallet/:segment?", parse: walletRoute },
    { path: "/notifications", parse: notificationsRoute },
    { path: "/profile_summary", parse: profileSummaryRoute },

    // chats
    {
        path: "/user/:chatId/:messageIndex?/:threadMessageIndex?",
        parse: globalDirectChatSelectedRoute({ kind: "chats" }),
    },
    {
        path: "/group/:chatId/:messageIndex?/:threadMessageIndex?",
        parse: globalGroupChatSelectedRoute({ kind: "chats" }),
    },
    { path: "/community/:communityId", parse: selectedCommunityRoute },
    {
        path: "/community/:communityId/channel/:channelId/:messageIndex?/:threadMessageIndex?",
        parse: selectedChannelRoute(false),
    },
    { path: "/chats", parse: chatListRoute({ kind: "chats" }) },
    {
        path: "/chats/user/:chatId/:messageIndex?/:threadMessageIndex?",
        parse: globalDirectChatSelectedRoute({ kind: "chats" }),
    },
    {
        path: "/chats/group/:chatId/:messageIndex?/:threadMessageIndex?",
        parse: globalGroupChatSelectedRoute({ kind: "chats" }),
    },
    { path: "/favourite", parse: chatListRoute({ kind: "favourite" }) },
    {
        path: "/favourite/group/:chatId/:messageIndex?/:threadMessageIndex?",
        parse: globalGroupChatSelectedRoute({ kind: "favourite" }),
    },
    {
        path: "/favourite/user/:chatId/:messageIndex?/:threadMessageIndex?",
        parse: globalDirectChatSelectedRoute({ kind: "favourite" }),
    },
    {
        path: "/favourite/community/:communityId/channel/:channelId/:messageIndex?/:threadMessageIndex?",
        parse: selectedChannelRoute(true),
    },
    { path: "/share", parse: shareRoute },
    { path: "/admin", parse: adminRoute },
    { path: "/", parse: () => ({ kind: "home_route", scope: { kind: "none" } }) },

    // legacy links to a group
    {
        path: "/:chatId/:messageIndex?/:threadMessageIndex?",
        parse: globalGroupChatSelectedRoute({ kind: "chats" }),
    },
    { path: "*", parse: page("not_found_route") },
];
