import { type Readable, derived, writable } from "svelte/store";
import { ScreenWidth, screenWidth } from "./screenDimensions";
import { mobileWidth } from "./screenDimensions";
import { rightPanelHistory } from "./rightPanel";
import { type RouteParams, pathParams } from "../routes";
import { disableLeftNav } from "./xframe";

export const navOpen = writable<boolean>(false);

export const fullWidth = derived(
    screenWidth,
    ($screenWidth) => $screenWidth === ScreenWidth.ExtraExtraLarge,
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
    [rightPanelHistory, mobileWidth, pathParams, fullWidth, disableLeftNav],
    ([$rightPanelHistory, $mobileWidth, $pathParams, $fullWidth, $disableLeftNav]) => {
        if ($mobileWidth) {
            const showRight = $rightPanelHistory.length > 0;
            const showMiddle = !someHomeRoute($pathParams.kind) && !showRight;
            const showLeft = !showMiddle && !showRight;
            const showNav =
                !$disableLeftNav &&
                (showLeft ||
                    (($pathParams.kind === "communities_route" ||
                        $pathParams.kind === "admin_route") &&
                        !showRight));
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
            const showLeft =
                $pathParams.kind !== "communities_route" && $pathParams.kind !== "admin_route";

            return {
                showNav: !$disableLeftNav,
                showMiddle: true,
                showLeft,
                rightPanel: (showRight
                    ? floatRight
                        ? "floating"
                        : "inline"
                    : "hidden") as RightPanelState,
            };
        }
    },
);

export function numberFromLocalStorage(key: string): number | undefined {
    const val = localStorage.getItem(key);
    return val ? Number(val) : undefined;
}

function createPanelWidthStore(key: string) {
    const val = localStorage.getItem(key);
    const store = writable<number | undefined>(val ? Number(val) : undefined);
    return {
        subscribe: store.subscribe,
        set: (val: number | undefined): void => {
            store.set(val);
            if (val === undefined) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, val.toString());
            }
        },
        update: store.update,
    };
}

export const rightPanelWidth = createPanelWidthStore("openchat_right_panel_width");
