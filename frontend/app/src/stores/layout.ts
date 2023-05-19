import { Readable, derived, writable } from "svelte/store";
import { ScreenWidth, screenWidth } from "./screenDimensions";
import { mobileWidth } from "./screenDimensions";
import { rightPanelHistory } from "./rightPanel";
import { pathParams } from "../routes";
import { communitiesEnabled } from "../utils/features";

export const navOpen = writable<boolean>(false);

export const numberOfColumns: Readable<3 | 2> = derived(screenWidth, ($screenWidth) => {
    return $screenWidth === ScreenWidth.ExtraExtraLarge ? 3 : 2;
});

type RightPanelState = "hidden" | "floating" | "inline";

type Layout = {
    showNav: boolean;
    showMiddle: boolean;
    showLeft: boolean;
    rightPanel: RightPanelState;
};

function debug<T>(label: string, obj: T): T {
    console.log(label, obj);
    return obj;
}

// TODO - we really need some tests around this and now that it's out of the Home component we can do that easily
export const layoutStore: Readable<Layout> = derived(
    [numberOfColumns, rightPanelHistory, mobileWidth, pathParams, communitiesEnabled],
    ([$numberOfColumns, $rightPanelHistory, $mobileWidth, $pathParams, $communitiesEnabled]) => {
        if ($mobileWidth) {
            const showRight = $rightPanelHistory.length > 0;
            const showMiddle = $pathParams.kind !== "home_route" && !showRight;
            const showLeft = !showMiddle && !showRight;
            const showNav =
                $communitiesEnabled && (showLeft || $pathParams.kind === "communities_route");
            return debug("Layout: ", {
                showNav,
                showMiddle,
                showLeft,
                rightPanel: (showRight ? "inline" : "hidden") as RightPanelState,
            });
        } else {
            const showRight =
                $pathParams.kind !== "communities_route" &&
                ($rightPanelHistory.length > 0 || $numberOfColumns === 3);
            const floatRight = $numberOfColumns < 3;
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
