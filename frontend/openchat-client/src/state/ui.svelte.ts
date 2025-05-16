import type { ChatSummary, MultiUserChatIdentifier } from "openchat-shared";
import { derived, get, type Readable } from "svelte/store";
import { isCanisterUrl } from "../utils/url";
import { LocalStorageBoolStore, LocalStorageStore } from "./localStorageStore";
import { pathState, type RouteParams } from "./path.svelte";
import { writable } from "./writable";

export type FontScale = 0 | 1 | 2 | 3 | 4;

export enum ScreenWidth {
    ExtraExtraSmall = "ExtraExtraSmall",
    ExtraSmall = "ExtraSmall",
    Small = "Small",
    Medium = "Medium",
    Large = "Large",
    ExtraLarge = "ExtraLarge",
    ExtraExtraLarge = "ExtraExtraLarge",
}

export enum ScreenHeight {
    Small = "Small",
    Large = "Large",
}

export type Dimensions = {
    width: number;
    height: number;
};

type RightPanelMode = "hidden" | "floating" | "inline";

export type Layout = {
    showNav: boolean;
    showMiddle: boolean;
    showLeft: boolean;
    rightPanel: RightPanelMode;
};

export type RightPanelContent =
    | GroupDetailsPanel
    | InviteGroupMembersPanel
    | InviteCommunityMembers
    | ShowGroupMembersPanel
    | ShowCommunityMembers
    | ShowPinnedPanel
    | UserProfilePanel
    | MessageThreadPanel
    | ProposalFilterPanel
    | CommunityFilters
    | CommunityDetails
    | CallParticipantsPanel
    | NoPanel;

type ProposalFilterPanel = {
    kind: "proposal_filters";
};

type CommunityFilters = {
    kind: "community_filters";
};

type NoPanel = {
    kind: "no_panel";
};

type MessageThreadPanel = {
    kind: "message_thread_panel";
    threadRootMessageIndex: number;
    threadRootMessageId: bigint;
};

type GroupDetailsPanel = {
    kind: "group_details";
};

type UserProfilePanel = {
    kind: "user_profile";
};

type InviteGroupMembersPanel = {
    kind: "invite_group_users";
};

type InviteCommunityMembers = {
    kind: "invite_community_users";
};

type ShowGroupMembersPanel = {
    kind: "show_group_members";
};

type CommunityDetails = {
    kind: "community_details";
};

type ShowCommunityMembers = {
    kind: "show_community_members";
    userGroupId?: number;
};

type CallParticipantsPanel = {
    kind: "call_participants_panel";
    chatId: MultiUserChatIdentifier;
    messageId: bigint;
    isOwner: boolean;
};

type ShowPinnedPanel = {
    kind: "show_pinned";
};

function translateScale(scale: FontScale): number {
    if (scale === 0) return 0.75;
    if (scale === 1) return 0.875;
    if (scale === 2) return 1;
    if (scale === 3) return 1.125;
    if (scale === 4) return 1.25;
    throw new Error("Unexpected font scale value");
}

export const runningInIframe: Readable<boolean> = writable(window.self !== window.top);
export const hideMessagesFromDirectBlocked = new LocalStorageBoolStore(
    "openchat_hideblocked",
    false,
);
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
export const screenWidth = derived(dimensions, (dimensions) => {
    if (dimensions.width < 354) {
        return ScreenWidth.ExtraExtraSmall;
    } else if (dimensions.width < 576) {
        return ScreenWidth.ExtraSmall;
    } else if (dimensions.width < 768) {
        return ScreenWidth.Small;
    } else if (dimensions.width < 992) {
        return ScreenWidth.Medium;
    } else if (dimensions.width < 1200) {
        return ScreenWidth.Large;
    } else if (dimensions.width < 1792) {
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
export const mobileWidth = derived(dimensions, (dimensions) => dimensions.width < 768);
export const ipadWidth = derived(dimensions, (dimensions) => dimensions.width < 992);
export const availableHeight = derived(
    dimensions,
    (dimensions) => dimensions.height - pixelsFromRems(5, dimensions.width),
);
export function toPixel(rem: number): number {
    return pixelsFromRems(rem, get(dimensions).width);
}
export const iconSize = derived(mobileWidth, (mobileWidth) => (mobileWidth ? "1.6em" : "1.4em"));
export const baseFontSize = derived(mobileWidth, (mobileWidth) => (mobileWidth ? 14 : 16));

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
export const rightPanelHistory = writable<RightPanelContent[]>([]);
export const lastRightPanelState = derived(
    rightPanelHistory,
    (rightPanelHistory) => rightPanelHistory[rightPanelHistory.length - 1] ?? { kind: "no_panel" },
);
export const disableLeftNav = writable<boolean>(false);
export const layout = derived(
    [mobileWidth, fullWidth, rightPanelHistory, disableLeftNav],
    ([mobileWidth, fullWidth, rightPanelHistory, disableLeftNav]) => {
        if (mobileWidth) {
            const showRight = rightPanelHistory.length > 0;
            const showMiddle = !someHomeRoute(pathState.route.kind) && !showRight;
            const showLeft = !showMiddle && !showRight;
            const showNav =
                !disableLeftNav &&
                (showLeft ||
                    ((pathState.route.kind === "communities_route" ||
                        pathState.route.kind === "admin_route") &&
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
                pathState.route.kind !== "communities_route" &&
                pathState.route.kind !== "admin_route";

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

export class UIState {
    constructor() {
        window.addEventListener("resize", this.#resize);
        this.popRightPanelHistory = this.popRightPanelHistory.bind(this);
    }
    #resize = () => {
        dimensions.set(getDimensions());
    };

    set fontScale(scale: FontScale) {
        fontScaleStore.set(scale);
    }

    toggleNav() {
        navOpen.update((v) => !v);
    }

    closeNavIfOpen() {
        navOpen.update((open) => {
            if (open) {
                return false;
            }
            return open;
        });
    }

    filterRightPanelHistory(fn: (state: RightPanelContent) => boolean) {
        rightPanelHistory.update((h) => h.filter(fn));
    }

    filterRightPanelHistoryByChatType(chat?: ChatSummary) {
        if (chat === undefined) return;

        return this.filterRightPanelHistory((p) => {
            if (chat.kind === "direct_chat") {
                return ["new_group_panel", "user_profile"].includes(p.kind);
            }
            if (
                chat.kind === "group_chat" &&
                (chat.previewed ||
                    (!(chat.subtype?.isNns ?? false) && p.kind === "proposal_filters"))
            ) {
                return false;
            }
            return true;
        });
    }

    pushRightPanelHistory(val: RightPanelContent) {
        rightPanelHistory.update((h) => {
            return [...h, val];
        });
    }

    popRightPanelHistory() {
        rightPanelHistory.update((h) => {
            return h.slice(0, h.length - 1);
        });
    }

    rightPanelContains(kind: RightPanelContent["kind"]) {
        return get(rightPanelHistory).find((p) => p.kind === kind) !== undefined;
    }

    set rightPanelWidth(val: number | undefined) {
        rightPanelWidth.set(val);
    }
}

export const ui = new UIState();
