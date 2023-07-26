import { Readable, derived, writable } from "svelte/store";
import { ScreenWidth, screenWidth } from "./screenDimensions";
import { mobileWidth } from "./screenDimensions";
import { rightPanelHistory } from "./rightPanel";
import { RouteParams, pathParams } from "../routes";
import { communitiesEnabled } from "../utils/features";

export const navOpen = writable<boolean>(false);

export const fullWidth = derived(
    screenWidth,
    ($screenWidth) => $screenWidth === ScreenWidth.ExtraExtraLarge
);

type RightPanelState = "hidden" | "floating" | "inline";

type Layout = {
    showNav: boolean;
    showMiddle: boolean;
    showLeft: boolean;
    rightPanel: RightPanelState;
};

function someHomeRoute(route: RouteParams["kind"]): boolean {
    return (
        route === "home_route" ||
        route === "chat_list_route" ||
        route === "selected_community_route"
    );
}

// TODO - we really need some tests around this and now that it's out of the Home component we can do that easily
export const layoutStore: Readable<Layout> = derived(
    [rightPanelHistory, mobileWidth, pathParams, communitiesEnabled, fullWidth],
    ([$rightPanelHistory, $mobileWidth, $pathParams, $communitiesEnabled, $fullWidth]) => {
        if ($mobileWidth) {
            const showRight = $rightPanelHistory.length > 0;
            const showMiddle = !someHomeRoute($pathParams.kind) && !showRight;
            const showLeft = !showMiddle && !showRight;
            const showNav =
                $communitiesEnabled &&
                (showLeft || ($pathParams.kind === "communities_route" && !showRight));
            return {
                showNav,
                showMiddle,
                showLeft,
                rightPanel: (showRight ? "inline" : "hidden") as RightPanelState,
                $pathParams,
            };
        } else {
            const showRight = $rightPanelHistory.length > 0 || $fullWidth;
            const floatRight = !$fullWidth;
            const showLeft = $pathParams.kind !== "communities_route";

            return {
                showNav: $communitiesEnabled,
                showMiddle: true,
                showLeft,
                rightPanel: (showRight
                    ? floatRight
                        ? "floating"
                        : "inline"
                    : "hidden") as RightPanelState,
            };
        }
    }
);
