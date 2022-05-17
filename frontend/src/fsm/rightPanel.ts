import type { GroupPermissions } from "domain/chat/chat";
import type { ChatController } from "./chat.controller";

export type RightPanelState =
    | GroupDetailsPanel
    | AddParticipantsPanel
    | ShowParticipantsPanel
    | ShowPinnedPanel
    | ShowAlertsPanel
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

export type AddParticipantsPanel = GroupPanel & {
    kind: "add_participants";
};

export type ShowParticipantsPanel = GroupPanel & {
    kind: "show_participants";
};

export type ShowPinnedPanel = GroupPanel & {
    kind: "show_pinned";
};

export type ShowAlertsPanel = {
    kind: "show_alerts";
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
