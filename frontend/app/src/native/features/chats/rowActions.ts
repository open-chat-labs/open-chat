import {
    i18nKey,
    pinChatFailureMessage,
    type ChatSummary,
    type MessageFormatter,
    type OpenChat,
} from "@client";
import type { ChatRowAction } from "@src/logic/chats/chatMenu";
import { toastStore } from "@src/stores/toast";
import type { ScreenContext } from "../app/screens";
import { favouriteWithToast, muteWithToast } from "./chatToasts";
import { removeWithUndo } from "./removeWithUndo";

// What a chat row's long-press menu item does (`chatRowMenu`'s actions), in the Chats tab and for a
// community's channels in the Communities tab: pin, favourite, mute, mark as read and archive at
// once with a toast; leave and delete with Undo (the shell's PendingRemovals).

/** The row pressed: its chat, its title (the toasts name it) and its key in PendingRemovals. */
export type PressedChat = { chat: ChatSummary; title: string; key: string };

export async function runRowAction(
    action: ChatRowAction,
    { chat, title, key }: PressedChat,
    client: OpenChat,
    context: Pick<ScreenContext, "toast" | "removals" | "pendingToast">,
    formatter: MessageFormatter,
): Promise<void> {
    const $_ = formatter;
    switch (action) {
        case "pin":
        case "unpin": {
            const pin = action === "pin";
            if (await (pin ? client.pinChat(chat.id) : client.unpinChat(chat.id))) {
                context.toast(
                    $_(pin ? "native.chats.toast.pinned" : "native.chats.toast.unpinned"),
                );
            } else {
                toastStore.showFailureToast(pinChatFailureMessage(pin));
            }
            break;
        }
        case "favourite":
        case "unfavourite": {
            const adding = action === "favourite";
            await favouriteWithToast(
                client,
                context,
                chat.id,
                adding,
                $_(adding ? "native.chats.toast.favourited" : "native.chats.toast.unfavourited"),
            );
            break;
        }
        case "mute":
        case "unmute": {
            const mute = action === "mute";
            await muteWithToast(
                client,
                context,
                chat.id,
                mute,
                $_(mute ? "native.chats.toast.muted" : "native.chats.toast.unmuted"),
                $_,
            );
            break;
        }
        case "mark_read":
            client.markAllRead(chat);
            break;
        case "archive":
            // one column: archiving the open chat goes to the list, never another chat
            if (await client.archiveChat(chat.id, true)) {
                context.toast(
                    $_("native.chats.toast.archived"),
                    () => void unarchive(client, chat),
                );
            } else {
                toastStore.showFailureToast(i18nKey("archiveChatFailed"));
            }
            break;
        case "unarchive":
            await unarchive(client, chat);
            break;
        case "leave":
            if (chat.kind !== "direct_chat") {
                removeWithUndo(
                    client,
                    context,
                    key,
                    { kind: "leave", chatId: chat.id },
                    $_("native.chats.toast.left", { values: { name: title } }),
                );
            }
            break;
        case "delete":
            if (chat.kind === "direct_chat") {
                removeWithUndo(
                    client,
                    context,
                    key,
                    { kind: "delete_direct_chat", chatId: chat.id, blockUser: false },
                    $_("native.chats.toast.deleted"),
                );
            }
            break;
        case "remove":
            client.removeFromList(chat);
            break;
    }
}

async function unarchive(client: OpenChat, chat: ChatSummary) {
    if (!(await client.unarchiveChats([chat.id]))) {
        toastStore.showFailureToast(i18nKey("unarchiveChatFailed"));
    }
}
