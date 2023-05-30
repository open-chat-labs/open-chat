import { writable } from "svelte/store";

import type { ChatSummary, GroupPermissions } from "openchat-client";

export type RightPanelState =
    | GroupDetailsPanel
    | InviteMembersPanel
    | ShowMembersPanel
    | ShowPinnedPanel
    | UserProfilePanel
    | MessageThreadPanel
    | ProposalFilterPanel
    | CommunityChannels
    | NoPanel;

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

export type InviteMembersPanel = {
    kind: "invite_users";
};

export type ShowMembersPanel = {
    kind: "show_members";
};

export type CommunityChannels = {
    kind: "community_channels";
    communityId: string;
};

export type ShowPinnedPanel = {
    kind: "show_pinned";
};

export type ProposalFilterPanel = {
    kind: "proposal_filters";
};

export type UpdatedAvatar = {
    blobUrl?: string;
    blobData?: Uint8Array;
};

export type UpdatedGroup = {
    name: string;
    desc: string;
    avatar?: UpdatedAvatar;
    permissions: GroupPermissions;
};

export function filterByChatType(
    history: RightPanelState[],
    chat: ChatSummary | undefined
): RightPanelState[] {
    if (chat === undefined) return [];
    return history.filter((panel) => {
        if (chat.kind === "direct_chat") {
            return ["new_group_panel", "user_profile"].includes(panel.kind);
        }
        if (
            chat.kind == "group_chat" &&
            (chat.previewed ||
                (!(chat.subtype?.isNns ?? false) && panel.kind === "proposal_filters"))
        ) {
            return false;
        }
        return true;
    });
}

export const rightPanelHistory = writable<RightPanelState[]>([]);

export function popRightPanelHistory(): void {
    rightPanelHistory.update((history) => history.slice(0, history.length - 1));
}
