import { params, querystring } from "svelte-spa-router";
import { derived, get } from "svelte/store";

export type RouteParams = {
    chatId?: string;
    messageIndex?: number;
    threadMessageIndex?: number;
    open: boolean;
};

export const pathParams = derived([params], ([$params]) => {
    if ($params === undefined) {
        return {} as RouteParams;
    } else {
        // NB: it's important that we do not *derive* from the querystring store as well as it is set at a slightly different time
        // to the params store and that causes us problems
        const $qs = get(querystring);
        const params = {
            chatId: $params["chatId"] == null ? undefined : $params["chatId"],
            messageIndex:
                $params["messageIndex"] == null ? undefined : Number($params["messageIndex"]),
            threadMessageIndex:
                $params["threadMessageIndex"] == null
                    ? undefined
                    : Number($params["threadMessageIndex"]),
            open: $qs?.includes("open=true") ?? false,
        };
        return params;
    }
});
