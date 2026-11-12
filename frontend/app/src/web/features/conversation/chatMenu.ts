import {
    allUsersStore,
    publish,
    type ChatSummary,
    type CommunitySummary,
    type MessageFormatter,
    type OpenChat,
    type ResourceKey,
    type UserLookup,
} from "@client";
import { signInFirst } from "@src/logic/auth/guestPass";
import { chatMenuActions } from "@src/logic/chats/chatMenu";
import { muteChat } from "@src/logic/chats/muteChat";
import { chatDetailsPermissions } from "@src/logic/groupOrCommunity/detailsPermissions";
import type { PendingToastHost } from "@openchat/ui/src/lib/toasts.svelte";
import {
    moderatorChatActionLabel,
    moderatorChatActions,
    unsuspend,
} from "@src/logic/moderation/chatModeration";
import { freezeItem as freezeItemAction, type FreezeTarget } from "@src/logic/moderation/freeze";
import { toastStore } from "@src/stores/toast";
import { copyPageUrl } from "@src/utils/urls";
import type { DialogStack } from "../../shell/dialogStack.svelte";
import { runInPendingToast } from "../../shell/pendingToast";
import type { LocalDialog } from "../app/dialogs";
import type { HeaderMenuState } from "./conversation.adapter";

// The chat menu the conversation header and the quick panel share: what it offers for the open
// chat, and what each item does.

export type ChatMenuInput = {
    favourite: boolean;
    blocked: { has(userId: string): boolean };
    users: UserLookup;
    community: CommunitySummary | undefined;
    anon: boolean;
    unblockLabel: string;
    /** `platformModeratorStore`: the moderator's items (freeze, suspend). */
    platformModerator: boolean;
    /** The app's words for a key (the moderator's items). */
    translate: (key: ResourceKey) => string;
};

/** What the chat menu offers for this chat. */
export function chatMenuState(
    client: OpenChat,
    chat: ChatSummary,
    input: ChatMenuInput,
): HeaderMenuState {
    const them = chat.kind === "direct_chat" ? input.users.get(chat.them.userId) : undefined;
    const isBot = them?.kind === "bot";
    return {
        kind:
            chat.kind === "direct_chat" ? "user" : chat.kind === "group_chat" ? "group" : "channel",
        favourite: input.favourite,
        muted: chat.membership.notificationsMuted,
        everyoneMuted: chat.membership.atEveryoneMuted,
        isBot,
        unread: client.unreadMessageCount(chat.id, chat.latestMessage?.event.messageIndex) > 0,
        actions: chatMenuActions(chat, {
            canLeave: chat.kind !== "direct_chat" && client.canLeaveGroup(chat.id),
            blocked: chat.kind === "direct_chat" && input.blocked.has(chat.them.userId),
            isBot,
        }),
        unblockLabel: input.unblockLabel,
        canEdit:
            chat.kind !== "direct_chat" &&
            chatDetailsPermissions(client, chat, input.community, input.anon).canEdit,
        moderation: moderatorChatActions(chat, {
            platformModerator: input.platformModerator,
            themSuspended: them?.suspended ?? false,
            isBot,
        }).map((action) => ({
            action,
            label: input.translate(moderatorChatActionLabel(action)),
        })),
    };
}

export type ChatMenuContext = {
    client: OpenChat;
    chat: ChatSummary;
    /** The chat's name, for the leave and delete confirms. */
    title: string;
    dialogs: DialogStack<LocalDialog>;
    formatter: MessageFormatter;
    /** The app's pending toasts (`getPendingToastHost`): unfreeze and un-suspend run in one. */
    pendingToasts: PendingToastHost | undefined;
};

// the items that don't need an account
const GUEST_ITEMS = new Set(["manage", "copyUrl"]);

/** Does what the chat menu's item with this id says. */
export function runChatMenuItem(
    id: string,
    { client, chat, title, dialogs, formatter, pendingToasts }: ChatMenuContext,
) {
    const mute = async (mute: boolean | undefined, atEveryone: boolean | undefined) => {
        const failed = await muteChat(client, chat.id, mute, atEveryone, formatter);
        if (failed !== undefined) toastStore.showFailureToast(failed);
    };
    // a guest can look at the details and copy the link; the rest asks them to sign in
    if (!GUEST_ITEMS.has(id) && signInFirst(client)) return;
    switch (id) {
        case "manage":
            if (chat.kind !== "direct_chat") {
                dialogs.open({ kind: "manage", target: chat.id, section: "main" });
            }
            break;
        case "chatSettings":
            if (chat.kind === "direct_chat") {
                dialogs.open({
                    kind: "user",
                    userId: chat.them.userId,
                    chatButton: false,
                    inGlobalContext: true,
                    dmTab: "chat",
                });
            }
            break;
        case "leave":
            if (chat.kind !== "direct_chat") {
                dialogs.open({
                    kind: "leave_or_delete",
                    action: { kind: "leave", chatId: chat.id },
                    name: title,
                });
            }
            break;
        case "delete":
            if (chat.kind === "direct_chat") {
                dialogs.open({
                    kind: "leave_or_delete",
                    action: { kind: "delete_direct_chat", chatId: chat.id, blockUser: false },
                    name: title,
                });
            }
            break;
        case "block":
        case "unblock":
            if (chat.kind === "direct_chat") {
                void client
                    .setBlockedInDirectChat(chat.them.userId, id === "block")
                    .then((outcome) => toastStore.showOutcome(outcome));
            }
            break;
        case "favourite":
            client.addToFavourites(chat.id);
            break;
        case "unfavourite":
            client.removeFromFavourites(chat.id);
            break;
        case "mute":
        case "unmute":
            void mute(id === "mute", undefined);
            break;
        case "muteEveryone":
        case "unmuteEveryone":
            void mute(undefined, id === "muteEveryone");
            break;
        case "markRead":
            client.markAllRead(chat);
            break;
        case "copyUrl":
            copyPageUrl(client);
            break;
        // a platform moderator's (TODO(design): no place for them in the design). Only a group's:
        // a community is frozen from its own header's menu. Freezing asks first (freezeItem).
        case "freeze":
        case "unfreeze":
            if (chat.kind === "group_chat") {
                freezeItem(
                    client,
                    { kind: "group", id: chat.id },
                    title,
                    id === "freeze",
                    dialogs,
                    pendingToasts,
                    formatter,
                );
            }
            break;
        case "suspend":
            // the reason is asked for in SuspendUserDialog (appEvents' suspendUser)
            if (chat.kind === "direct_chat") publish("suspendUser", chat.them.userId);
            break;
        case "unsuspend":
            if (chat.kind === "direct_chat") {
                void runInPendingToast(
                    pendingToasts,
                    unsuspend(client, chat.them.userId, allUsersStore.value),
                    formatter,
                );
            }
            break;
    }
}

/**
 * A platform moderator's Freeze or Unfreeze item for a group (the chat menus) or a community (its
 * header's menu), `name` being its name: freezing opens the confirm (FreezeDialogScreen, which
 * freezes and offers Undo); unfreezing goes ahead in a pending toast ("Unfreezing {name}…", then
 * how it went): a preview's timeline may not show the change at once.
 */
export function freezeItem(
    client: OpenChat,
    target: FreezeTarget,
    name: string,
    freeze: boolean,
    dialogs: DialogStack<LocalDialog>,
    pendingToasts: PendingToastHost | undefined,
    formatter: MessageFormatter,
): void {
    const item = freezeItemAction(client, target, name, freeze);
    if (item.kind === "confirm") {
        dialogs.open({ kind: "confirm_freeze", target: item.target, name });
    } else {
        void runInPendingToast(pendingToasts, item.action, formatter);
    }
}
