import type { ChatSummary, MultiUserChatIdentifier } from "openchat-shared";
import { pathState, type RouteParams } from "./path.svelte";

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

export type ProposalFilterPanel = {
    kind: "proposal_filters";
};

export type CommunityFilters = {
    kind: "community_filters";
};

export type NoPanel = {
    kind: "no_panel";
};

export type MessageThreadPanel = {
    kind: "message_thread_panel";
    threadRootMessageIndex: number;
    threadRootMessageId: bigint;
};

export type GroupDetailsPanel = {
    kind: "group_details";
};

export type UserProfilePanel = {
    kind: "user_profile";
};

export type InviteGroupMembersPanel = {
    kind: "invite_group_users";
};

export type InviteCommunityMembers = {
    kind: "invite_community_users";
};

export type ShowGroupMembersPanel = {
    kind: "show_group_members";
};

export type CommunityDetails = {
    kind: "community_details";
};

export type ShowCommunityMembers = {
    kind: "show_community_members";
    userGroupId?: number;
};

export type CallParticipantsPanel = {
    kind: "call_participants_panel";
    chatId: MultiUserChatIdentifier;
    messageId: bigint;
    isOwner: boolean;
};

export type ShowPinnedPanel = {
    kind: "show_pinned";
};

function numberFromLocalStorage(key: string): number | undefined {
    const val = localStorage.getItem(key);
    return val ? Number(val) : undefined;
}

export function getCurrentFontScale(): FontScale {
    return Number(localStorage.getItem("openchat_font_size") ?? "2") as FontScale;
}

function translateScale(scale: FontScale): number {
    if (scale === 0) return 0.75;
    if (scale === 1) return 0.875;
    if (scale === 2) return 1;
    if (scale === 3) return 1.125;
    if (scale === 4) return 1.25;
    throw new Error("Unexpected font scale value");
}

export class UIState {
    constructor() {
        this.#runningInIframe = window.self !== window.top;
        window.addEventListener("resize", this.#resize);
        this.popRightPanelHistory = this.popRightPanelHistory.bind(this);
    }
    #getDimensions = () => {
        return { width: window.innerWidth, height: window.innerHeight };
    };
    #resize = () => {
        this.#dimensions = this.#getDimensions();
    };
    #dimensions = $state<Dimensions>(this.#getDimensions());
    #screenWidth = $derived.by(() => {
        if (this.#dimensions.width < 354) {
            return ScreenWidth.ExtraExtraSmall;
        } else if (this.#dimensions.width < 576) {
            return ScreenWidth.ExtraSmall;
        } else if (this.#dimensions.width < 768) {
            return ScreenWidth.Small;
        } else if (this.#dimensions.width < 992) {
            return ScreenWidth.Medium;
        } else if (this.#dimensions.width < 1200) {
            return ScreenWidth.Large;
        } else if (this.#dimensions.width < 1792) {
            return ScreenWidth.ExtraLarge; // this is the default width on 15' macbook
        } else {
            return ScreenWidth.ExtraExtraLarge;
        }
    });

    #pixelsFromRems(rem: number, width: number): number {
        if (width < 768) {
            return rem * 14;
        } else {
            return rem * 16;
        }
    }

    // this probably does not belong here
    toPixel(rem: number): number {
        return this.#pixelsFromRems(rem, this.#dimensions.width);
    }

    #fullWidth = $derived(this.#screenWidth === ScreenWidth.ExtraExtraLarge);
    #mobileWidth = $derived(this.#dimensions.width < 768);
    #ipadWidth = $derived(this.#dimensions.width < 992);
    #availableHeight = $derived(
        this.#dimensions.height - this.#pixelsFromRems(5, this.#dimensions.width),
    );
    #iconSize = $derived(this.#mobileWidth ? "1.6em" : "1.4em");
    #rightPanelWidth = $state<number | undefined>(
        numberFromLocalStorage("openchat_right_panel_width"),
    );
    #runningInIframe = $state<boolean>(false);
    #disableLeftNav = $state<boolean>(false);
    #rightPanelHistory = $state<RightPanelContent[]>([]);
    #lastRightPanelState = $derived(
        this.#rightPanelHistory[this.#rightPanelHistory.length - 1] ?? { kind: "no_panel" },
    );
    #navOpen = $state<boolean>(false);
    #fontScale = $state<FontScale>(getCurrentFontScale());
    #baseFontSize = $derived(this.#mobileWidth ? 14 : 16);
    #fontSize = $derived.by(() => {
        return this.#baseFontSize * translateScale(this.#fontScale);
    });
    #layout = $derived.by<Layout>(() => {
        if (this.#mobileWidth) {
            const showRight = this.#rightPanelHistory.length > 0;
            const showMiddle = !this.#someHomeRoute(pathState.route.kind) && !showRight;
            const showLeft = !showMiddle && !showRight;
            const showNav =
                !this.#disableLeftNav &&
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
            const showRight = this.#rightPanelHistory.length > 0 || this.#fullWidth;
            const floatRight = !this.#fullWidth;
            const showLeft =
                pathState.route.kind !== "communities_route" &&
                pathState.route.kind !== "admin_route";

            return {
                showNav: !this.#disableLeftNav,
                showMiddle: true,
                showLeft,
                rightPanel: (showRight
                    ? floatRight
                        ? "floating"
                        : "inline"
                    : "hidden") as RightPanelMode,
            };
        }
    });

    #someHomeRoute(route: RouteParams["kind"]): boolean {
        return (
            route === "home_route" ||
            route === "chat_list_route" ||
            route === "selected_community_route"
        );
    }

    public setFontScale(scale: FontScale) {
        this.#fontScale = scale;
        localStorage.setItem("openchat_font_size", scale.toString());
    }

    public get fontScale() {
        return this.#fontScale;
    }

    public get showNav(): boolean {
        return this.#layout.showNav;
    }

    public get showLeft(): boolean {
        return this.#layout.showLeft;
    }

    public get showMiddle(): boolean {
        return this.#layout.showMiddle;
    }

    public get rightPanelMode(): RightPanelMode {
        return this.#layout.rightPanel;
    }

    public get navOpen(): boolean {
        return this.#navOpen;
    }

    public toggleNav() {
        this.#navOpen = !this.#navOpen;
    }

    public closeNavIfOpen() {
        if (this.#navOpen) {
            this.#navOpen = false;
        }
    }

    public get layout(): Readonly<Layout> {
        return this.#layout;
    }

    public filterRightPanelHistory(fn: (state: RightPanelContent) => boolean) {
        this.#rightPanelHistory = this.#rightPanelHistory.filter(fn);
    }

    public get fontSize() {
        return this.#fontSize;
    }

    public filterRightPanelHistoryByChatType(chat?: ChatSummary) {
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

    public set rightPanelHistory(val: RightPanelContent[]) {
        this.#rightPanelHistory = val;
    }

    public get rightPanelHistory() {
        return this.#rightPanelHistory;
    }

    public pushRightPanelHistory(val: RightPanelContent) {
        this.#rightPanelHistory.push(val);
    }

    public popRightPanelHistory() {
        this.#rightPanelHistory = this.#rightPanelHistory.slice(
            0,
            this.#rightPanelHistory.length - 1,
        );
    }

    public rightPanelContains(kind: RightPanelContent["kind"]) {
        return this.#rightPanelHistory.find((p) => p.kind === kind) !== undefined;
    }

    public get lastRightPanelState() {
        return this.#lastRightPanelState;
    }

    public set rightPanelWidth(val: number | undefined) {
        if (val === undefined) {
            localStorage.removeItem("openchat_right_panel_width");
        } else {
            localStorage.setItem("openchat_right_panel_width", val.toString());
        }
        this.#rightPanelWidth = val;
    }

    public get rightPanelWidth() {
        return this.#rightPanelWidth;
    }

    public set disableLeftNav(val: boolean) {
        this.#disableLeftNav = val;
    }

    public get disableLeftNav() {
        return this.#disableLeftNav;
    }

    public get runningInIframe() {
        return this.#runningInIframe;
    }

    public get iconSize() {
        return this.#iconSize;
    }

    public get dimensions(): Readonly<Dimensions> {
        return this.#dimensions;
    }

    public get screenWidth() {
        return this.#screenWidth;
    }

    public get mobileWidth() {
        return this.#mobileWidth;
    }

    public get fullWidth() {
        return this.#fullWidth;
    }

    public get ipadWidth() {
        return this.#ipadWidth;
    }

    public get availableHeight() {
        return this.#availableHeight;
    }
}

export const ui = new UIState();
