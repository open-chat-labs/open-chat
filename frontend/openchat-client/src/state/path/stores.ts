import { dequal } from "dequal";
import type {
    CommunityIdentifier,
    MessageIndexRoute,
    NullScope,
    RouteParams,
} from "openchat-shared";
import "page";
import { derived, writable } from "../../utils/stores";

const noScope: NullScope = { kind: "none" };

function hasMessageIndex(route: RouteParams): route is MessageIndexRoute {
    return (
        route.kind === "global_chat_selected_route" ||
        route.kind === "favourites_route" ||
        route.kind === "selected_channel_route"
    );
}

export const notFoundStore = writable<boolean>(false);
export const pathContextStore = writable<PageJS.Context | undefined>(undefined, undefined, dequal);
export const routerReadyStore = writable<boolean>(false);
export const locationStore = derived(pathContextStore, (pathContext) =>
    pathContext ? pathContext.routePath : "",
);
export const querystringStore = derived(pathContextStore, (pathContext) =>
    pathContext ? new URLSearchParams(pathContext.querystring) : new URLSearchParams(),
);
export const routeStore = writable<RouteParams>(
    { scope: noScope, kind: "not_found_route" },
    undefined,
    dequal,
);
export const querystringCodeStore = derived(querystringStore, (qs) => qs.get("code"));
export const querystringReferralCodeStore = derived(querystringStore, (qs) => qs.get("ref"));
export const exploringStore = derived(querystringStore, (qs) => qs.get("explore") != null);
export const routeKindStore = derived(routeStore, (route) => route.kind);
export const messageIndexStore = derived(routeStore, (route) =>
    hasMessageIndex(route) ? route.messageIndex : undefined,
);
export const threadMessageIndexStore = derived(routeStore, (route) =>
    hasMessageIndex(route) ? route.threadMessageIndex : undefined,
);
export const threadOpenStore = derived(
    routeStore,
    (route) =>
        (route.kind === "global_chat_selected_route" || route.kind === "selected_channel_route") &&
        route.messageIndex !== undefined &&
        route.open,
);
export const selectedCommunityIdStore = derived(routeStore, (route) => {
    switch (route.kind) {
        case "selected_community_route":
        case "selected_channel_route":
            return route.communityId;
        case "favourites_route":
            if (route.chatId?.kind === "channel") {
                return {
                    kind: "community",
                    communityId: route.chatId.communityId,
                } as CommunityIdentifier;
            }
            return undefined;
        default:
            return undefined;
    }
});
