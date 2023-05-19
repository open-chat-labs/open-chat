import type { GroupChatSummary } from "openchat-client";
import { Readable, derived, writable } from "svelte/store";
import type { RemoteData } from "./utils/remoteData";

export const notFound = writable(false);

export const pathContextStore = writable<PageJS.Context | undefined>(undefined);

export const location = derived(pathContextStore, ($store) => {
    return $store ? $store.routePath : "";
});

export const querystring = derived(pathContextStore, ($store) => {
    return $store ? new URLSearchParams($store.querystring) : new URLSearchParams();
});

export const pathParams: Readable<RouteParams> = derived(
    [pathContextStore, querystring],
    ([$store, $qs]) => {
        if ($store === undefined) return { kind: "not_found_route" } as NotFound;

        const $params = $store.params;

        if ($store.routePath.startsWith("/communities")) {
            return {
                kind: "communities_route",
                communityId: $params["communityId"],
            } as CommunitiesRoute;
        }

        if ($store.routePath.startsWith("/share")) {
            return {
                kind: "share_route",
                title: $qs.get("title") ?? "",
                text: $qs.get("text") ?? "",
                url: $qs.get("url") ?? "",
            } as ShareRoute;
        }

        if ($store.routePath.startsWith("/hotgroups")) {
            return {
                kind: "hot_groups_route",
            } as HotGroupsRoute;
        }

        if ($store.routePath.startsWith("/blog")) {
            return {
                kind: "blog_route",
                slug: $params["slug"],
            } as BlogRoute;
        }

        const chatId = $params["chatId"] || undefined;

        if (chatId === undefined) {
            return {
                kind: "home_route",
            } as HomeRoute;
        }

        return {
            kind: "chat_selected_route",
            chatId,
            messageIndex: $params["messageIndex"] ? Number($params["messageIndex"]) : undefined,
            threadMessageIndex: $params["threadMessageIndex"]
                ? Number($params["threadMessageIndex"])
                : undefined,
            open: $qs.get("open") === "true",
        } as ChatSelectedRoute;
    }
);

export type RouteParams =
    | HomeRoute
    | ChatSelectedRoute
    | CommunitiesRoute
    | ShareRoute
    | NotFound
    | BlogRoute
    | HotGroupsRoute;

type HomeRoute = {
    kind: "home_route";
};

type ChatSelectedRoute = {
    kind: "chat_selected_route";
    chatId: string;
    messageIndex?: number;
    threadMessageIndex?: number;
    open: boolean;
};

type CommunitiesRoute = {
    kind: "communities_route";
    communityId?: string;
};

type ShareRoute = {
    kind: "share_route";
    title: string;
    text: string;
    url: string;
};

type HotGroupsRoute = {
    kind: "hot_groups_route";
};

type BlogRoute = {
    kind: "blog_route";
    slug?: string;
};

type NotFound = {
    kind: "not_found_route";
};
