import type { MultiUserChatIdentifier } from "./chat";
import type { PublicProfile } from "./user";

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
    | UserProfileSettings
    | NoPanel;

type UserProfileSettings = {
    kind: "user_profile_settings";
    profile: PublicProfile;
};

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
