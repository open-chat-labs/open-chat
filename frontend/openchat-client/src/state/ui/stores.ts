import { dequal } from "dequal";
import {
    ScreenWidth,
    type Dimensions,
    type FontScale,
    type RightPanelContent,
    type RightPanelMode,
    type RouteParams,
    type XFrameOverrides,
} from "openchat-shared";
import { type Readable } from "svelte/store";
import { pageReplace } from "../../utils/routes";
import { derived, writable } from "../../utils/stores";
import { isCanisterUrl, removeQueryStringParam } from "../../utils/url";
import { LocalStorageStore } from "../localStorageStore";
import { routeStore } from "../path/stores";
import { notEq } from "../utils";

function translateScale(scale: FontScale): number {
    if (scale === 0) return 0.75;
    if (scale === 1) return 0.875;
    if (scale === 2) return 1;
    if (scale === 3) return 1.125;
    if (scale === 4) return 1.25;
    throw new Error("Unexpected font scale value");
}

export const runningInIframe: Readable<boolean> = writable(window.self !== window.top);
export const activityFeedShowing = writable(false);
export const notificationsSupported =
    !isCanisterUrl &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
export const eventListScrollTop = writable<number | undefined>(undefined);
export const eventListLastScrolled = writable<number>(0);
export const eventListScrolling = writable<boolean>(false);
export const communityListScrollTop = writable<number | undefined>(undefined);
function getDimensions() {
    return { width: window.innerWidth, height: window.innerHeight };
}
export const dimensions = writable<Dimensions>(getDimensions());
export const dimensionsHeight = derived(dimensions, (dimensions) => dimensions.height);
export const dimensionsWidth = derived(dimensions, (dimensions) => dimensions.width);
export const screenWidth = derived(dimensionsWidth, (width) => {
    if (width < 354) {
        return ScreenWidth.ExtraExtraSmall;
    } else if (width < 576) {
        return ScreenWidth.ExtraSmall;
    } else if (width < 768) {
        return ScreenWidth.Small;
    } else if (width < 992) {
        return ScreenWidth.Medium;
    } else if (width < 1200) {
        return ScreenWidth.Large;
    } else if (width < 1792) {
        return ScreenWidth.ExtraLarge; // this is the default width on 15' macbook
    } else {
        return ScreenWidth.ExtraExtraLarge;
    }
});
export const fullWidth = derived(
    screenWidth,
    (screenWidth) => screenWidth === ScreenWidth.ExtraExtraLarge,
);
function pixelsFromRems(rem: number, width: number): number {
    if (width < 768) {
        return rem * 14;
    } else {
        return rem * 16;
    }
}
export const mobileWidth = derived(dimensionsWidth, (width) => width < 768);
export const ipadWidth = derived(dimensionsWidth, (width) => width < 992);
export const availableHeight = derived(
    dimensions,
    ({ width, height }) => height - pixelsFromRems(5, width),
);
export function toPixel(rem: number): number {
    return pixelsFromRems(rem, dimensionsWidth.value);
}
export const iconSize = derived(mobileWidth, (mobileWidth) => (mobileWidth ? "1.6em" : "1.4em"));
export const baseFontSize = derived(mobileWidth, (mobileWidth) => {
    if (localStorage.getItem("openchat_v2_layout") === "true") {
        return 16;
    }
    return mobileWidth ? 14 : 16;
});

export const fontScaleStore = new LocalStorageStore<FontScale>(
    "openchat_font_size",
    2,
    (fs) => fs.toString(),
    (fs) => Number(fs) as FontScale,
);

export const fontSize = derived([baseFontSize, fontScaleStore], ([baseFontSize, fontScale]) => {
    return baseFontSize * translateScale(fontScale);
});
function someHomeRoute(route: RouteParams["kind"]): boolean {
    return (
        route === "home_route" ||
        route === "chat_list_route" ||
        route === "selected_community_route"
    );
}
export const rightPanelHistory = writable<RightPanelContent[]>([], undefined, notEq);
export const lastRightPanelState = derived(
    rightPanelHistory,
    (rightPanelHistory) => rightPanelHistory[rightPanelHistory.length - 1] ?? { kind: "no_panel" },
);
export function setRightPanelHistory(history: RightPanelContent[]) {
    if (rightPanelHistory.value.find((p) => p.kind === "message_thread_panel") !== undefined) {
        pageReplace(removeQueryStringParam("open"));
    }
    rightPanelHistory.set(history);
}

export const showProfileStore = derived(
    lastRightPanelState,
    (lastRightPanelState) => {
        return lastRightPanelState.kind === "user_profile";
    },
    notEq,
);

export const xframeOverrides = writable<XFrameOverrides>({
    disableLeftNav: false,
    restrictTo: undefined,
});

export const restrictToSelectedCommunity = derived(xframeOverrides, ({ restrictTo }) => {
    return restrictTo !== undefined;
});

export const restrictToSelectedChat = derived(xframeOverrides, ({ restrictTo }) => {
    return restrictTo === "selected_chat";
});

export const layout = derived(
    [mobileWidth, fullWidth, rightPanelHistory, xframeOverrides, routeStore],
    ([mobileWidth, fullWidth, rightPanelHistory, xframeOverrides, route]) => {
        const disableLeftNav =
            xframeOverrides.restrictTo !== undefined || xframeOverrides.disableLeftNav;
        const disableLeft = xframeOverrides.restrictTo === "selected_chat";
        if (mobileWidth) {
            const showRight = rightPanelHistory.length > 0;
            const showMiddle = !someHomeRoute(route.kind) && !showRight;
            const showLeft = !showMiddle && !showRight && !disableLeft;
            const showNav =
                !disableLeftNav &&
                (showLeft ||
                    ((route.kind === "communities_route" || route.kind === "admin_route") &&
                        !showRight));
            return {
                showNav,
                showLeft,
                showMiddle,
                rightPanel: (showRight ? "inline" : "hidden") as RightPanelMode,
            };
        } else {
            const showRight = rightPanelHistory.length > 0 || fullWidth;
            const floatRight = !fullWidth;
            const showLeft =
                route.kind !== "communities_route" && route.kind !== "admin_route" && !disableLeft;

            return {
                showNav: !disableLeftNav,
                showMiddle: true,
                showLeft,
                rightPanel: (showRight
                    ? floatRight
                        ? "floating"
                        : "inline"
                    : "hidden") as RightPanelMode,
            };
        }
    },
    dequal,
);
export const showMiddle = derived(layout, (layout) => layout.showMiddle);
export const showNav = derived(layout, (layout) => layout.showNav);
export const showLeft = derived(layout, (layout) => layout.showLeft);
export const rightPanelMode = derived(layout, (layout) => layout.rightPanel);
export const navOpen = writable<boolean>(false);
export const rightPanelWidth = new LocalStorageStore<number | undefined>(
    "openchat_right_panel_width",
    undefined,
    (n) => n?.toString() ?? "",
    (n) => Number(n),
);

window.addEventListener("resize", () => {
    dimensions.set(getDimensions());
});
