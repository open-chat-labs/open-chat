import type { ChatSummary, EventWrapper, GroupPermissions, Message } from "./chat/chat";

export type RightPanelState =
    | GroupDetailsPanel
    | AddMembersPanel
    | ShowMembersPanel
    | ShowPinnedPanel
    | UserProfilePanel
    | NewGroupPanel
    | MessageThreadPanel
    | ProposalFilterPanel
    | NoPanel;

export type NoPanel = {
    kind: "no_panel";
};

export type MessageThreadPanel = {
    kind: "message_thread_panel";
    rootEvent: EventWrapper<Message>;
};

export type GroupDetailsPanel = {
    kind: "group_details";
};

export type UserProfilePanel = {
    kind: "user_profile";
};

export type NewGroupPanel = {
    kind: "new_group_panel";
};

export type AddMembersPanel = {
    kind: "add_members";
};

export type ShowMembersPanel = {
    kind: "show_members";
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
