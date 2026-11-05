import {
    cryptoLookup,
    i18nKey,
    localUpdates,
    messageReplyContext,
    publish,
    type ChatIdentifier,
    type EventWrapper,
    type Message,
    type MessageFormatter,
    type MessageMenuAction,
    type OpenChat,
    type UserLookup,
} from "@client";
import { translateMessage } from "@src/logic/conversation/translateMessage";
import { toastStore } from "@src/stores/toast";
import { copyMessageUrl, shareMessage } from "@src/utils/share";
import { copyToClipboard } from "@src/utils/urls";

// What each of a message's actions does in the conversation (MessageActions, the hover bar and
// the swipes), as the old message menus did it. One that needs the user first comes back as the
// dialog to show.

/** The client calls a message's actions make. */
export type MessageMenuClient = Pick<
    OpenChat,
    | "blockUser"
    | "cancelMessageReminder"
    | "deleteFailedMessage"
    | "deleteMessage"
    | "getContentAsText"
    | "pinMessage"
    | "retrySendMessage"
    | "revealBlockedMessage"
    | "revealDeletedMessage"
    | "translateMessage"
    | "undeleteMessage"
    | "unpinMessage"
    | "untranslate"
>;

export type MessageMenuTarget = {
    client: MessageMenuClient;
    chatId: ChatIdentifier;
    evt: EventWrapper<Message>;
    failed: boolean;
    /** The signed-in user. */
    me: string;
    users: UserLookup;
    formatter: MessageFormatter;
    locale: string | null | undefined;
    diamond: boolean;
    /** Ask before deleting (the "don't show again" setting, `confirmMessageDeletion`). */
    confirmDelete: boolean;
};

/** A dialog an action needs before it's done. */
export type MessageMenuDialog = { kind: "delete"; evt: EventWrapper<Message> };

/**
 * Does what the action says to the message, or says which dialog to show first. Each action is
 * only run where `messageMenu` offered it.
 */
export async function runMessageAction(
    action: MessageMenuAction,
    target: MessageMenuTarget,
): Promise<MessageMenuDialog | undefined> {
    const { client, chatId, evt } = target;
    const msg = evt.event;
    const context = { chatId };
    switch (action) {
        case "reply":
            localUpdates.draftMessages.setReplyingTo(
                context,
                messageReplyContext(evt, target.users.get(msg.sender), context),
            );
            return;
        case "edit":
            localUpdates.draftMessages.setEditing(context, evt, target.users);
            return;
        case "copy":
            void copyToClipboard(client.getContentAsText(target.formatter, msg.content));
            return;
        case "copy_url":
            copyMessageUrl(chatId, msg.messageIndex);
            return;
        case "share":
            shareMessage(
                target.formatter,
                target.me,
                msg.sender === target.me,
                msg,
                cryptoLookup.value,
            );
            return;
        case "translate": {
            const outcome = await translateMessage(client, msg, {
                diamond: target.diamond,
                locale: target.locale,
            });
            if (outcome === "upgrade") publish("upgrade");
            if (outcome === "failed") toastStore.showFailureToast(i18nKey("unableToTranslate"));
            return;
        }
        case "untranslate":
            client.untranslate(msg.messageId);
            return;
        case "pin":
        case "unpin": {
            if (chatId.kind === "direct_chat") return;
            const done =
                action === "pin"
                    ? await client.pinMessage(chatId, msg.messageIndex)
                    : await client.unpinMessage(chatId, msg.messageIndex);
            if (!done) {
                toastStore.showFailureToast(
                    i18nKey(action === "pin" ? "pinMessageFailed" : "unpinMessageFailed"),
                );
            }
            return;
        }
        case "cancel_reminder": {
            if (msg.content.kind !== "message_reminder_created_content") return;
            const cancelled = await client.cancelMessageReminder(msg.messageId, {
                ...msg.content,
                hidden: true,
            });
            if (cancelled) {
                toastStore.showSuccessToast(i18nKey("reminders.cancelSuccess"));
            } else {
                toastStore.showFailureToast(i18nKey("reminders.cancelFailure"));
            }
            return;
        }
        case "retry":
            void client.retrySendMessage(context, evt);
            return;
        case "reveal":
            if (msg.content.kind === "blocked_content") {
                client.revealBlockedMessage(msg.messageId);
            } else {
                void client.revealDeletedMessage(chatId, msg.messageId, undefined);
            }
            return;
        case "undelete":
            if (!(await client.undeleteMessage(chatId, undefined, msg))) {
                toastStore.showFailureToast(i18nKey("undeleteMessageFailed"));
            }
            return;
        case "block_user": {
            if (chatId.kind !== "group_chat") return;
            const blocked = await client.blockUser(chatId, msg.sender);
            if (blocked) {
                toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("blockUserFailed"));
            }
            return;
        }
        case "delete":
        case "delete_for_me":
            // a failed message was never sent: it goes from here only
            if (target.failed) {
                void client.deleteFailedMessage(chatId, msg.messageId, undefined);
                return;
            }
            if (target.confirmDelete) return { kind: "delete", evt };
            await deleteMessage(client, chatId, evt);
            return;
        default:
            // not carried out here yet (see messageMenuItems)
            return;
    }
}

/** Deletes a sent message (it shows as deleted at once, and comes back if that fails). */
export async function deleteMessage(
    client: Pick<OpenChat, "deleteMessage">,
    chatId: ChatIdentifier,
    evt: EventWrapper<Message>,
): Promise<void> {
    await client.deleteMessage(chatId, undefined, evt.event.messageId);
}
