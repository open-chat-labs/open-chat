import type { GroupChatSummary, GroupPermissions } from "../domain/chat/chat";
import { get, Readable } from "svelte/store";
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

export type GroupDetailsPanel = {
    chat: GroupChatSummary;
    participantCount: number;
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

export type ShowPinnedPanel = {
    kind: "show_pinned";
    chatId: string;
    pinned: Readable<Set<number>>;
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

/** what a horrible mess */
export function updateRightPanelController(
    history: RightPanelState[],
    controller: ChatController | undefined
): RightPanelState[] {
    if (controller === undefined) return history;

    return history.map((state) => {
        if (state.kind === "group_details") {
            const chat = controller.chatVal as GroupChatSummary;
            const participants = get(controller.participants);
            return {
                ...state,
                chat,
                participantCount: participants.length,
            };
        } else if (state.kind === "show_pinned") {
            return {
                ...state,
                pinned: controller.pinnedMessages,
                chatId: controller.chatId,
            };
        } else if ("controller" in state) {
            return {
                ...state,
                controller,
            };
        }
        return state;
    });
}
