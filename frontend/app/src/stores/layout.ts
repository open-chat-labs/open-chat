import { Readable, derived } from "svelte/store";
import { ScreenWidth, screenWidth } from "./screenDimensions";
import { mobileWidth } from "./screenDimensions";
import { rightPanelHistory } from "./rightPanel";
import { pathParams } from "../routes";

export const numberOfColumns: Readable<3 | 2> = derived(screenWidth, ($screenWidth) => {
    return $screenWidth === ScreenWidth.ExtraExtraLarge ? 3 : 2;
});

type RightPanelState = "hidden" | "floating" | "inline";

type Layout = {
    numberOfColumns: 3 | 2;
    showMiddle: boolean;
    showLeft: boolean;
    rightPanel: RightPanelState;
};

export const layoutStore: Readable<Layout> = derived(
    [numberOfColumns, rightPanelHistory, mobileWidth, pathParams],
    ([$numberOfColumns, $rightPanelHistory, $mobileWidth, $pathParams]) => {
        const showRight = $rightPanelHistory.length > 0 || $numberOfColumns === 3;
        const floatRight = !$mobileWidth && $numberOfColumns < 3;
        const middleSelected =
            $pathParams.kind === "chat_selected_route" ||
            $pathParams.kind === "hot_groups_route" ||
            $pathParams.kind === "communities_route";
        const leftSelected = $pathParams.kind === "home_route";
        const showMiddle = !$mobileWidth || (middleSelected && !showRight);
        const showLeft = !$mobileWidth || (leftSelected && !showRight);

        return {
            numberOfColumns: $numberOfColumns,
            showMiddle,
            showLeft,
            rightPanel: (showRight
                ? floatRight
                    ? "floating"
                    : "inline"
                : "hidden") as RightPanelState,
        };
    }
);
