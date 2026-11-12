import {
    chatIdentifierToString,
    type BotMatch,
    type ChatListSearchResults,
    type UserSummary,
} from "@client";
import type ChatListPanel from "@openchat/ui/src/features/components/ChatListPanel.svelte";
import type { MenuItem } from "@openchat/ui/src/lib/types";
import { swatchFor } from "@src/logic/chats/chatRow";
import type { CommunityMenuPermissions } from "@src/logic/groupOrCommunity/detailsPermissions";
import { freezeLabel } from "@src/logic/moderation/freeze";
import type { ComponentProps } from "svelte";

// The chat list's community header menu and its search's rows for what isn't in the list. The
// chats' rows are logic/chats/chatRow's, shared with the native Chats tab.

/** ChatListPanel's row: a chat list row (logic/chats/chatRow) with its menu. */
export type ChatListPanelRow = ComponentProps<typeof ChatListPanel>["rows"][number];

const icon = (name: string) => `var(--icon-${name}) center/contain no-repeat`;

export type CommunityHeaderMenuState = CommunityMenuPermissions & {
    canManageUserGroups: boolean;
    /**
     * A platform moderator's Freeze or Unfreeze community (the old desktop menu's), with whether
     * it's frozen now; undefined for anyone else.
     */
    moderation: { frozen: boolean } | undefined;
    /** The app's words for a key. */
    label: (key: string) => string;
};

/**
 * ChatListHeader's community menu, as the design's (`_commMenuAll`): members, invite, edit, new
 * channel, embedded channel, new user group, mark all read, then leave and delete, where the app's rules allow them. Members,
 * invite and edit open Manage. Last, a platform moderator's Freeze or Unfreeze community
 * (TODO(design): the design has no moderator items). Picking one reports its id (`onMenu`).
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
    if (state.moderation !== undefined) {
        const { frozen } = state.moderation;
        items.push({
            id: frozen ? "unfreezeCommunity" : "freezeCommunity",
            label: label(freezeLabel("community", frozen).key),
            mask: icon(frozen ? "lock-open" : "lock"),
            variant: frozen ? "regular" : "danger",
        });
    }
    return items;
}

/** What picking a search result does: a chat with the user or bot. */
export type FoundTarget = { kind: "chat_with"; userId: string };

/** A search result's row and what picking it does. */
export type FoundRow = { row: ChatListPanelRow; target: FoundTarget };

export type FoundRowsInput = {
    /** What the search found outside the list (`outsideList`). */
    found: ChatListSearchResults;
    /** A user's name as the app shows it. */
    userName: (user: UserSummary) => string;
    /**
     * Whether a user is suspended now (`allUsersStore`, else the search's copy), so a person's row
     * follows a suspend or un-suspend after the search, as their DM's row does.
     */
    userSuspended: (user: UserSummary) => boolean;
    /** A person's own picture; none gives the row's swatch (ownUserAvatarUrl). */
    userAvatar: (user: UserSummary) => string | undefined;
    botAvatar: (bot: BotMatch) => string;
};

type FoundFields = Pick<
    ChatListPanelRow,
    "title" | "preview" | "kind" | "color" | "avatarUrl" | "suspended"
>;

function foundRow(id: string, fields: FoundFields): ChatListPanelRow {
    return { id: `found:${id}`, ...fields, time: "", menu: [] };
}

// a user's or bot's swatch is their DM's
const dmSwatch = (userId: string) =>
    swatchFor(chatIdentifierToString({ kind: "direct_chat", userId }));

/**
 * The search's people as ChatListPanel's `people` rows, its People tab and All's People section:
 * people, then bots (web plan 04's search has chats, people and messages: no public groups). A
 * person's line is their @username, a bot's its description; a suspended person is marked as a
 * DM's row is (`suspended`). Their ids can't be a chat's (`found:…`), and they have no menu.
 */
export function foundRows(input: FoundRowsInput): FoundRow[] {
    const { found } = input;
    const users = found.users.map(
        (user): FoundRow => ({
            row: foundRow(`user:${user.userId}`, {
                title: input.userName(user),
                preview: `@${user.username}`,
                kind: "user",
                color: dmSwatch(user.userId),
                avatarUrl: input.userAvatar(user),
                suspended: input.userSuspended(user),
            }),
            target: { kind: "chat_with", userId: user.userId },
        }),
    );
    const bots = found.bots.map(
        (bot): FoundRow => ({
            row: foundRow(`bot:${bot.id}`, {
                title: bot.name,
                preview: bot.definition.description,
                kind: "user",
                color: dmSwatch(bot.id),
                avatarUrl: input.botAvatar(bot),
            }),
            target: { kind: "chat_with", userId: bot.id },
        }),
    );
    return [...users, ...bots];
}
