import type { GroupPermissions } from "domain/chat/chat";
import type { ChatController } from "./chat.controller";

export type RightPanelState =
    | GroupDetailsPanel
    | AddParticipantsPanel
    | ShowParticipantsPanel
    | ShowPinnedPanel
    | UserProfilePanel
    | NewGroupPanel
    | NoPanel;

export type GroupPanel = {
    controller: ChatController;
};

export type NoPanel = {
    kind: "no_panel";
};

export type GroupDetailsPanel = GroupPanel & {
    kind: "group_details";
};

export type UserProfilePanel = {
    kind: "user_profile";
};

export type NewGroupPanel = {
    kind: "new_group_panel";
};

export type AddParticipantsPanel = GroupPanel & {
    kind: "add_participants";
};

export type ShowParticipantsPanel = GroupPanel & {
    kind: "show_participants";
};

export type ShowPinnedPanel = GroupPanel & {
    kind: "show_pinned";
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
