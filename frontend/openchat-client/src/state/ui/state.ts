import type { ChatSummary, MultiUserChatIdentifier } from "openchat-shared";
import { get } from "svelte/store";
import { fontScaleStore, navOpen, rightPanelHistory, rightPanelWidth } from "./stores";

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

export type RightPanelMode = "hidden" | "floating" | "inline";

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

export class UIState {
    constructor() {
        this.popRightPanelHistory = this.popRightPanelHistory.bind(this);
    }

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
