import {
    cryptoLookup,
    i18nKey,
    messageReplyContext,
    publish,
    routeForChatIdentifier,
    type ChatListScope,
    type EventWrapper,
    type Message,
    type MessageContext,
    type MessageFormatter,
    type MessageMenuAction,
    type OpenChat,
    type UserLookup,
} from "@client";
import { editMessage, replyToMessage } from "@src/logic/conversation/draftActions";
import { translateMessage } from "@src/logic/conversation/translateMessage";
import { threadOpenPath } from "@src/logic/threads/threadUrl";
import { toastStore } from "@src/stores/toast";
import { copyMessageUrl, shareMessage } from "@src/utils/share";
import { navigate } from "@src/utils/navigation";
import { copyToClipboard } from "@src/utils/urls";

// What each of a message's actions does in the conversation or a thread (MessageActions, the
// hover bar and the swipes), as the old message menus did it. One that needs the user first comes
// back as the dialog to show.

/** The client calls a message's actions make. */
export type MessageMenuClient = Pick<
    OpenChat,
    | "blockUser"
    | "cancelMessageReminder"
    | "deleteFailedMessage"
    | "deleteMessage"
    | "followThread"
    | "getContentAsText"
    | "pinMessage"
    | "replyPrivately"
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
    /** Where the message is: the chat, or a thread in it. */
    context: MessageContext;
    /** In a thread, its root message (what following it follows). */
    threadRoot?: Message;
    /** The chat list the chat is open in, for the thread a message starts. */
    scope: ChatListScope["kind"];
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

/**
 * A dialog an action needs before it's done: confirming a delete, picking where to forward to,
 * why it's reported or when to be reminded.
 */
export type MessageMenuDialog =
    | { kind: "delete"; evt: EventWrapper<Message> }
    | { kind: "forward"; evt: EventWrapper<Message> }
    | { kind: "report"; evt: EventWrapper<Message> }
    | { kind: "remind"; evt: EventWrapper<Message> };

/**
 * Does what the action says to the message, or says which dialog to show first. Each action is
 * only run where `messageMenu` offered it.
 */
export async function runMessageAction(
    action: MessageMenuAction,
    target: MessageMenuTarget,
): Promise<MessageMenuDialog | undefined> {
    const { client, context, evt } = target;
    const { chatId, threadRootMessageIndex } = context;
    const msg = evt.event;
    switch (action) {
        case "reply":
            replyToMessage(chatId, evt, target.users);
            return;
        case "edit":
            editMessage(chatId, evt, target.users);
            return;
        case "forward":
            return { kind: "forward", evt };
        case "report":
            return { kind: "report", evt };
        case "remind":
            return { kind: "remind", evt };
        case "reply_privately": {
            // the sender's DM, made if there's none, with the reply set
            const dm = await client.replyPrivately(
                messageReplyContext(evt, target.users.get(msg.sender), context),
            );
            if (dm === undefined) {
                publish("notFound");
            } else {
                navigate(routeForChatIdentifier("chats", dm));
            }
            return;
        }
        case "start_thread":
            // the message's thread, opened in the right column (a new one starts as it opens)
            navigate(threadOpenPath(target.scope, chatId, msg.messageIndex, location.search));
            return;
        case "follow_thread":
        case "unfollow_thread": {
            const follow = action === "follow_thread";
            if (!(await client.followThread(chatId, target.threadRoot ?? msg, follow))) {
                toastStore.showFailureToast(
                    i18nKey(follow ? "followThreadFailed" : "unfollowThreadFailed"),
                );
            }
            return;
        }
        case "copy":
            void copyToClipboard(client.getContentAsText(target.formatter, msg.content));
            return;
        case "copy_url":
            copyMessageUrl(chatId, msg.messageIndex, threadRootMessageIndex);
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
                void client.revealDeletedMessage(chatId, msg.messageId, threadRootMessageIndex);
            }
            return;
        case "undelete":
            if (!(await client.undeleteMessage(chatId, threadRootMessageIndex, msg))) {
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
                void client.deleteFailedMessage(chatId, msg.messageId, threadRootMessageIndex);
                return;
            }
            if (target.confirmDelete) return { kind: "delete", evt };
            await deleteMessage(client, context, evt);
            return;
        default:
            // not carried out here yet (see messageMenuItems)
            return;
    }
}

/** Deletes a sent message (it shows as deleted at once, and comes back if that fails). */
export async function deleteMessage(
    client: Pick<OpenChat, "deleteMessage">,
    context: MessageContext,
    evt: EventWrapper<Message>,
): Promise<void> {
    await client.deleteMessage(context.chatId, context.threadRootMessageIndex, evt.event.messageId);
}
