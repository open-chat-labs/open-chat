import type { EventWrapper, Message, MultiUserChatIdentifier } from "./chat";
import type { Level } from "./structure";

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

/**
 * What the right panel shows for the last `rightPanelHistory` entry, read for the selected chat
 * and community (`rightPanelView` in `@client`). A `tab` is the channel-and-community view opened
 * on that side.
 */
export type RightPanelView =
    | { kind: "none" }
    | { kind: "group_details" }
    | { kind: "direct_chat_details" }
    | { kind: "channel_summary"; tab: "channel" | "community" }
    | { kind: "community_details" }
    | { kind: "group_members" }
    | { kind: "community_members"; userGroupId?: number }
    | { kind: "channel_or_community_members"; tab: "channel" | "community" }
    | { kind: "invite_users"; level: Level }
    | { kind: "channel_or_community_invite"; tab: "channel" | "community" }
    | { kind: "pinned" }
    | { kind: "user_profile" }
    | { kind: "thread"; rootEvent: EventWrapper<Message> }
    | { kind: "proposal_filters" }
    | { kind: "community_filters" }
    | {
          kind: "call_participants";
          chatId: MultiUserChatIdentifier;
          messageId: bigint;
          isOwner: boolean;
      };
