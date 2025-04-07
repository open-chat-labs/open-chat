import type { MultiUserChatIdentifier } from "openchat-shared";
import type { ScreenDimensionState } from "./screenDimensions.svelte";
import type { PathState, RouteParams } from "./path.svelte";

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

export class LayoutState {
    #disableLeftNav = $state<boolean>(false);
    #rightPanelHistory = $state<RightPanelContent[]>([]);
    #navOpen = $state<boolean>(false);
    #layout = $derived.by<Layout>(() => {
        if (this.screenDimensions.mobileWidth) {
            const showRight = this.#rightPanelHistory.length > 0;
            const showMiddle = !this.#someHomeRoute(this.path.params.kind) && !showRight;
            const showLeft = !showMiddle && !showRight;
            const showNav =
                !this.#disableLeftNav &&
                (showLeft ||
                    ((this.path.params.kind === "communities_route" ||
                        this.path.params.kind === "admin_route") &&
                        !showRight));
            return {
                showNav,
                showLeft,
                showMiddle,
                rightPanel: (showRight ? "inline" : "hidden") as RightPanelMode,
            };
        } else {
            const showRight = this.#rightPanelHistory.length > 0 || this.screenDimensions.fullWidth;
            const floatRight = !this.screenDimensions.fullWidth;
            const showLeft =
                this.path.params.kind !== "communities_route" &&
                this.path.params.kind !== "admin_route";

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

    constructor(
        private screenDimensions: ScreenDimensionState,
        private path: PathState,
    ) {}

    public get showNav(): boolean {
        return this.#layout.showNav;
    }

    public get showLeft(): boolean {
        return this.#layout.showLeft;
    }

    public get showMiddle(): boolean {
        return this.#layout.showMiddle;
    }

    public get rightPanel(): RightPanelMode {
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
}
