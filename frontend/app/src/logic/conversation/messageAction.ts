import {
    cryptoLookup,
    i18nKey,
    messageReplyContext,
    type ChatIdentifier,
    type EventWrapper,
    type Message,
    type MessageContext,
    type MessageFormatter,
    type MessageMenuAction,
    type OpenChat,
    type ResourceKey,
    type UserLookup,
} from "@client";
import { buildMessageUrl, shareMessageOrFail } from "@src/utils/share";
import { copyToClipboard } from "@src/utils/urls";
import { copyableMessageText } from "./copyableMessageText";
import { editMessage, replyToMessage } from "./draftActions";
import type { MentionLookups } from "./typedMentions";
import { translateMessage } from "./translateMessage";

// What each of a message's actions does (its menu, the hover bar, the swipes), as the old message
// menus did it, for every tree: the client's operation, then what came of it for the view to show
// (a toast, a dialog, a chat to open). The view never strings the steps together itself.

/** The client calls a message's actions make. */
export type MessageActionClient = Pick<
    OpenChat,
    | "blockUser"
    | "cancelMessageReminder"
    | "deleteFailedMessage"
    | "deleteMessage"
    | "followThread"
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

export type MessageActionTarget = {
    client: MessageActionClient;
    /** Where the message is: the chat, or a thread in it. */
    context: MessageContext;
    /** In a thread, its root message (what following it follows). */
    threadRoot?: Message;
    evt: EventWrapper<Message>;
    failed: boolean;
    /** The signed-in user. */
    me: string;
    users: UserLookup;
    /** The user groups the message's mentions can name: the open chat's community's. */
    userGroups: MentionLookups["userGroups"];
    formatter: MessageFormatter;
    locale: string | null | undefined;
    diamond: boolean;
    /**
     * Ask before deleting (the "don't show again" setting, `confirmMessageDeletion`). The native
     * tree asks with an alert, then offers Undo as well.
     */
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

/** What came of a message's action, for the view to show. */
export type MessageActionOutcome =
    /** Done (or nothing to do), and nothing to say. */
    | { kind: "done" }
    /** The action needs the user first: the view shows this, and carries it out from there. */
    | { kind: "ask"; dialog: MessageMenuDialog }
    /** Done, and worth saying so. */
    | { kind: "succeeded"; message: ResourceKey }
    | { kind: "failed"; message: ResourceKey }
    /** The message's text, copied (or not: the clipboard refused). */
    | { kind: "copied"; ok: boolean }
    /** A link to the message, copied (or not: the clipboard refused). */
    | { kind: "link_copied"; ok: boolean; url: string }
    /** The message, shared (or dismissed); `ok` false: it couldn't be shared. */
    | { kind: "shared"; ok: boolean }
    /** A sent message deleted (or not: it shows again, as the client puts it back). */
    | { kind: "deleted"; ok: boolean }
    /** A private reply: the sender's DM, made if there was none, with the reply set. */
    | { kind: "open_chat"; chatId: ChatIdentifier }
    /** The sender's DM couldn't be made. */
    | { kind: "not_found" }
    /** Translating is for Diamond members: the view offers the upgrade. */
    | { kind: "upgrade" }
    /** The message's thread, to open (a new one starts as it opens). */
    | { kind: "open_thread"; threadRootMessageIndex: number };

const DONE: MessageActionOutcome = { kind: "done" };

/**
 * Does what the action says to the message, or says which dialog to show first. Each action is
 * only run where `messageMenu` offered it.
 */
export async function messageAction(
    action: MessageMenuAction,
    target: MessageActionTarget,
): Promise<MessageActionOutcome> {
    const { client, context, evt } = target;
    const { chatId, threadRootMessageIndex } = context;
    const msg = evt.event;
    switch (action) {
        case "reply":
            replyToMessage(chatId, evt, target.users);
            return DONE;
        case "edit":
            editMessage(chatId, evt, target.users);
            return DONE;
        case "forward":
            return { kind: "ask", dialog: { kind: "forward", evt } };
        case "report":
            return { kind: "ask", dialog: { kind: "report", evt } };
        case "remind":
            return { kind: "ask", dialog: { kind: "remind", evt } };
        case "reply_privately": {
            // the sender's DM, made if there's none, with the reply set
            const dm = await client.replyPrivately(
                messageReplyContext(evt, target.users.get(msg.sender), context),
            );
            return dm === undefined ? { kind: "not_found" } : { kind: "open_chat", chatId: dm };
        }
        case "start_thread":
            return { kind: "open_thread", threadRootMessageIndex: msg.messageIndex };
        case "follow_thread":
        case "unfollow_thread": {
            const follow = action === "follow_thread";
            if (await client.followThread(chatId, target.threadRoot ?? msg, follow)) return DONE;
            return failed(follow ? "followThreadFailed" : "unfollowThreadFailed");
        }
        case "copy": {
            // mentions as typed (@name), not as stored (@UserId(…))
            const text = copyableMessageText(msg.content, {
                formatter: target.formatter,
                cryptoLookup: cryptoLookup.value,
                users: target.users,
                userGroups: target.userGroups,
            });
            return { kind: "copied", ok: await copyToClipboard(text) };
        }
        case "copy_url": {
            const url = buildMessageUrl(chatId, msg.messageIndex, threadRootMessageIndex);
            return { kind: "link_copied", ok: await copyToClipboard(url), url };
        }
        case "share":
            return {
                kind: "shared",
                ok: await shareMessageOrFail(
                    target.formatter,
                    target.me,
                    msg.sender === target.me,
                    msg,
                    cryptoLookup.value,
                ),
            };
        case "translate": {
            const outcome = await translateMessage(client, msg, {
                diamond: target.diamond,
                locale: target.locale,
            });
            if (outcome === "upgrade") return { kind: "upgrade" };
            return outcome === "failed" ? failed("unableToTranslate") : DONE;
        }
        case "untranslate":
            client.untranslate(msg.messageId);
            return DONE;
        case "pin":
        case "unpin": {
            if (chatId.kind === "direct_chat") return DONE;
            const done =
                action === "pin"
                    ? await client.pinMessage(chatId, msg.messageIndex)
                    : await client.unpinMessage(chatId, msg.messageIndex);
            if (done) return DONE;
            return failed(action === "pin" ? "pinMessageFailed" : "unpinMessageFailed");
        }
        case "cancel_reminder": {
            if (msg.content.kind !== "message_reminder_created_content") return DONE;
            const cancelled = await client.cancelMessageReminder(msg.messageId, {
                ...msg.content,
                hidden: true,
            });
            return cancelled
                ? { kind: "succeeded", message: i18nKey("reminders.cancelSuccess") }
                : failed("reminders.cancelFailure");
        }
        case "retry":
            void client.retrySendMessage(context, evt);
            return DONE;
        case "reveal":
            if (msg.content.kind === "blocked_content") {
                client.revealBlockedMessage(msg.messageId);
            } else {
                void client.revealDeletedMessage(chatId, msg.messageId, threadRootMessageIndex);
            }
            return DONE;
        case "undelete":
            return (await client.undeleteMessage(chatId, threadRootMessageIndex, msg))
                ? DONE
                : failed("undeleteMessageFailed");
        case "block_user": {
            if (chatId.kind !== "group_chat") return DONE;
            return (await client.blockUser(chatId, msg.sender))
                ? { kind: "succeeded", message: i18nKey("blockUserSucceeded") }
                : failed("blockUserFailed");
        }
        case "delete":
        case "delete_for_me":
            // a failed message was never sent: it goes from here only
            if (target.failed) {
                void client.deleteFailedMessage(chatId, msg.messageId, threadRootMessageIndex);
                return DONE;
            }
            if (target.confirmDelete) return { kind: "ask", dialog: { kind: "delete", evt } };
            return { kind: "deleted", ok: await deleteMessage(client, context, evt) };
        default:
            // not carried out here yet (tipping, a proposal's)
            return DONE;
    }
}

function failed(key: string): MessageActionOutcome {
    return { kind: "failed", message: i18nKey(key) };
}

/**
 * Deletes a sent message: it shows as deleted at once, and comes back if that fails (false). Its
 * sender (or whoever deleted it) can have it back for a while (`undeleteMessage`).
 */
export function deleteMessage(
    client: Pick<OpenChat, "deleteMessage">,
    context: MessageContext,
    evt: EventWrapper<Message>,
): Promise<boolean> {
    return client.deleteMessage(
        context.chatId,
        context.threadRootMessageIndex,
        evt.event.messageId,
    );
}

/**
 * Brings back a message the user deleted: one shown deleted (revealed, or just deleted, as a
 * delete's Undo has it) is restored for everyone it was deleted for.
 */
export function undeleteMessage(
    client: Pick<OpenChat, "undeleteMessage">,
    context: MessageContext,
    msg: Message,
): Promise<boolean> {
    return client.undeleteMessage(context.chatId, context.threadRootMessageIndex, {
        ...msg,
        deleted: true,
    });
}
