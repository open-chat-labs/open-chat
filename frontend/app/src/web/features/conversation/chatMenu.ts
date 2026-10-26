import type {
    ChatSummary,
    CommunitySummary,
    MessageFormatter,
    OpenChat,
    UserLookup,
} from "@client";
import { chatMenuActions } from "@src/logic/chats/chatMenu";
import { muteChat } from "@src/logic/chats/muteChat";
import { chatDetailsPermissions } from "@src/logic/groupOrCommunity/detailsPermissions";
import { toastStore } from "@src/stores/toast";
import { copyPageUrl } from "@src/utils/urls";
import type { DialogStack } from "../../shell/dialogStack.svelte";
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
    };
}

export type ChatMenuContext = {
    client: OpenChat;
    chat: ChatSummary;
    /** The chat's name, for the leave and delete confirms. */
    title: string;
    dialogs: DialogStack<LocalDialog>;
    formatter: MessageFormatter;
};

/** Does what the chat menu's item with this id says. */
export function runChatMenuItem(
    id: string,
    { client, chat, title, dialogs, formatter }: ChatMenuContext,
) {
    const mute = async (mute: boolean | undefined, atEveryone: boolean | undefined) => {
        const failed = await muteChat(client, chat.id, mute, atEveryone, formatter);
        if (failed !== undefined) toastStore.showFailureToast(failed);
    };
    switch (id) {
        case "manage":
            if (chat.kind !== "direct_chat") {
                dialogs.open({ kind: "manage", target: chat.id, section: "main" });
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
    }
}
