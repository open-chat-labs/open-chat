import type ChatListPanel from "@openchat/ui/src/features/components/ChatListPanel.svelte";
import type { MenuItem } from "@openchat/ui/src/lib/types";
import type { CommunityMenuPermissions } from "@src/logic/groupOrCommunity/detailsPermissions";
import type { ComponentProps } from "svelte";

// The chat list's community header menu. The rows are logic/chats/chatRow's, shared with the
// native Chats tab.

/** ChatListPanel's row: a chat list row (logic/chats/chatRow) with its menu. */
export type ChatListPanelRow = ComponentProps<typeof ChatListPanel>["rows"][number];

const icon = (name: string) => `var(--icon-${name}) center/contain no-repeat`;

export type CommunityHeaderMenuState = CommunityMenuPermissions & {
    canManageUserGroups: boolean;
    /** The app's words for a key. */
    label: (key: string) => string;
};

/**
 * ChatListHeader's community menu, as the design's (`_commMenuAll`): members, invite, edit, new
 * channel, embedded channel, new user group, mark all read, then leave and delete, where the app's rules allow them. Members,
 * invite and edit open Manage. Picking one reports its id (`onMenu`).
 */
export function communityHeaderMenu(
    state: CommunityHeaderMenuState,
): (MenuItem & { id: string })[] {
    const { label } = state;
    const items: (MenuItem & { id: string })[] = [
        { id: "members", label: "ui.chatListHeader.members", mask: icon("users") },
    ];
    if (state.canInvite) {
        items.push({ id: "invite", label: "ui.chatListHeader.invite", mask: icon("invite") });
    }
    if (state.canEdit) {
        items.push({
            id: "editCommunity",
            label: "ui.chatListHeader.editCommunity",
            mask: icon("edit"),
        });
    }
    if (state.canCreateChannel) {
        items.push(
            { id: "newChannel", label: "ui.chatListHeader.newChannel", mask: icon("plus") },
            {
                id: "embedChannel",
                label: "ui.chatListHeader.addEmbeddedChannel",
                mask: icon("embed"),
            },
        );
    }
    if (state.canManageUserGroups) {
        items.push({
            id: "newUserGroup",
            label: "ui.groupPanel.menu.newUserGroup",
            mask: icon("at"),
        });
    }
    items.push({
        id: "markAllRead",
        label: "ui.chatListHeader.markAllRead",
        mask: icon("check-double"),
    });
    if (state.canLeave) {
        items.push({
            id: "leave",
            label: "ui.chatListHeader.leaveCommunity",
            mask: icon("exit"),
            variant: "danger",
        });
    }
    if (state.canDelete) {
        items.push({
            id: "delete",
            label: label("communities.delete"),
            mask: icon("trash"),
            variant: "danger",
        });
    }
    return items;
}
