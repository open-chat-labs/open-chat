import { params, querystring } from "svelte-spa-router";
import { derived } from "svelte/store";

export type RouteParams = {
    chatId?: string;
    messageIndex?: number;
    threadMessageIndex?: number;
    open: boolean;
};

export const pathParams = derived([params, querystring], ([$params, $qs]) => {
    if ($params === undefined) {
        return {} as RouteParams;
    } else {
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
