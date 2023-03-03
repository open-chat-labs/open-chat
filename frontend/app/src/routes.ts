import { derived, writable } from "svelte/store";

export const notFound = writable(false);

export const pathContextStore = writable<PageJS.Context | undefined>(undefined);

export const location = derived(pathContextStore, ($store) => {
    return $store ? $store.path : "";
});

export const querystring = derived(pathContextStore, ($store) => {
    return $store ? $store.querystring : "";
});

export type RouteParams = {
    chatId?: string;
    messageIndex?: number;
    threadMessageIndex?: number;
    slug?: string;
    open: boolean;
};

export const pathParams = derived(pathContextStore, ($store) => {
    if ($store === undefined) return {} as RouteParams;

    const $qs = $store.querystring;
    const $params = $store.params;
    const params = {
        chatId: $params["chatId"] || undefined,
        messageIndex: $params["messageIndex"] ? Number($params["messageIndex"]) : undefined,
        threadMessageIndex: $params["threadMessageIndex"]
            ? Number($params["threadMessageIndex"])
            : undefined,
        slug: $params["slug"],
        open: $qs?.includes("open=true") ?? false,
    };
    return params;
});
