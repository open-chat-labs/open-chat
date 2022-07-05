import { params } from "svelte-spa-router";
import { derived } from "svelte/store";

export type RouteParams = {
    chatId?: string;
    messageIndex?: number;
    threadMessageIndex?: number;
};

export const pathParams = derived([params], ([$params]) => {
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
        };
        return params;
    }
});
