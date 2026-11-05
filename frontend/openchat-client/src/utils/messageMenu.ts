import {
    bridgedFrom,
    isEditableContent,
    type ChatSummary,
    type EnhancedReplyContext,
    type EventWrapper,
    type Message,
    type MessageContext,
    type SelectedEmoji,
    type UserSummary,
} from "@shared";
import { canForward, getMessageText, userCanDeleteMessage } from "./chat";

// What a message's menu and hover bar offer, as both old trees' message menus decided it
// (ChatMessage, ChatMessageMenu, ChatMessageOptions), so every tree offers the same.

/** Something a message's menu offers. Each tree lays them out in its own order. */
export type MessageMenuAction =
    | "collapse_proposal"
    | "follow_thread"
    | "unfollow_thread"
    | "share"
    | "copy_url"
    | "copy"
    | "remind"
    | "cancel_reminder"
    | "pin"
    | "unpin"
    | "reply"
    | "start_thread"
    | "forward"
    | "reply_privately"
    | "translate"
    | "untranslate"
    | "edit"
    | "tip"
    | "block_user"
    // in a DM, someone else's message is deleted for the reader only
    | "delete"
    | "delete_for_me"
    | "report"
    | "reveal"
    | "undelete"
    | "retry";

export type MessageMenuInput = {
    message: Pick<Message, "messageId" | "sender" | "senderContext" | "content" | "deleted">;
    /** The signed-in user. */
    userId: string;
    /**
     * Shown as the user's own: sent by them, or relayed from an account they've linked
     * (`shouldShowAsMe`). Blocking and reporting the author go by this, as they'd act on the
     * bridge bot; everything else goes by who sent it.
     */
    showAsMe: boolean;
    chatKind: ChatSummary["kind"];
    /** A public group or channel. */
    publicGroup: boolean;
    confirmed: boolean;
    failed: boolean;
    /** A proposal folded away. */
    collapsed: boolean;
    /** The chat can only be read (previewing, suspended …). */
    readonly: boolean;
    /** Shown only to the user, for a while (a bot's private reply). */
    ephemeral: boolean;
    pinned: boolean;
    translated: boolean;
    /** Being undeleted right now (`undeletingMessagesStore`). */
    undeleting: boolean;
    /** Now, in ms, for how long ago it was deleted and whether a reminder is still to come. */
    now: number;
    /** In a thread: whether the user follows it. Undefined in the chat itself. */
    thread: { following: boolean } | undefined;
    /** Whether the list it's shown in lets it be edited / replied to (a thread's root can't be). */
    supportsEdit: boolean;
    supportsReply: boolean;
    /** The device can share it (`canShareMessage`). */
    shareable: boolean;
    /** Who a tip goes to (`tipRecipient`); undefined when it can't be tipped. */
    tipRecipient: string | undefined;
    /** Tipping is on in this build (off in an app store build). */
    tipsEnabled: boolean;
    permissions: {
        /** Send a message (and so quote one in a reply). */
        send: boolean;
        react: boolean;
        pin: boolean;
        tip: boolean;
        /** Delete other people's messages. */
        deleteOthers: boolean;
        /** Block the sender: the chat lets the user block people, and the sender isn't blocked. */
        blockSender: boolean;
        /** Reply in a thread. */
        startThread: boolean;
    };
};

export type MessageMenu = {
    /** Deleted, blocked, restricted or folded away: shown, but not acted on. */
    inert: boolean;
    /** Whether it has a menu (and hover bar) at all. */
    menu: boolean;
    /** Reactions can be added to it. */
    react: boolean;
    canEdit: boolean;
    canTip: boolean;
    /** What its menu offers (none without a menu). */
    actions: ReadonlySet<MessageMenuAction>;
};

const DELETED_REVEAL_WINDOW_MS = 5 * 60 * 1000;

/**
 * What a message offers: a menu only if it isn't inert (or it can be revealed), the chat isn't
 * read only and it isn't ephemeral; and in that menu each action under the old menus' guards.
 * Pin is never offered in a thread or a DM, tip never on the user's own, an unconfirmed, failed
 * or inert message, or one with no one to pay. Undelete and reveal are offered only for the
 * user's own deletion within five minutes (a moderator's deletion of someone else's message can
 * always be revealed), and delete never on a call still in progress.
 */
export function messageMenu(input: MessageMenuInput): MessageMenu {
    const { message: msg, userId, confirmed, failed, permissions } = input;
    const content = msg.content;
    const me = msg.sender === userId;
    const inThread = input.thread !== undefined;
    const multiUserChat = input.chatKind !== "direct_chat";
    const inert =
        content.kind === "deleted_content" ||
        content.kind === "blocked_content" ||
        content.kind === "restricted_content" ||
        input.collapsed;

    const deletedByMe = content.kind === "deleted_content" && content.deletedBy === userId;
    const permanentlyDeleted =
        deletedByMe &&
        me &&
        content.kind === "deleted_content" &&
        Number(content.timestamp) < input.now - DELETED_REVEAL_WINDOW_MS;
    const canRevealDeleted = deletedByMe && !input.undeleting && !permanentlyDeleted;
    const canRevealBlocked = content.kind === "blocked_content";
    const canUndelete = msg.deleted && content.kind !== "deleted_content";

    const canEdit = me && input.supportsEdit && !msg.deleted && isEditableContent(content.kind);
    const canTip =
        input.tipsEnabled &&
        permissions.tip &&
        !me &&
        confirmed &&
        !inert &&
        !failed &&
        input.tipRecipient !== undefined &&
        input.tipRecipient !== userId;

    const menu =
        (!inert || canRevealDeleted || canRevealBlocked) && !input.readonly && !input.ephemeral;

    const actions = new Set<MessageMenuAction>();
    if (menu) {
        // what can be done with a message that's there, sent and seen by the others
        const live = confirmed && !inert && !failed;
        const add = (action: MessageMenuAction, when: boolean) => {
            if (when) actions.add(action);
        };

        add("collapse_proposal", content.kind === "proposal_content" && !inert);
        add("follow_thread", live && input.thread !== undefined && !input.thread.following);
        add("unfollow_thread", live && input.thread?.following === true);
        add("share", live && input.publicGroup && input.shareable);
        add("copy_url", live);
        add("copy", true);
        add(
            "remind",
            live &&
                content.kind !== "message_reminder_content" &&
                content.kind !== "message_reminder_created_content",
        );
        add(
            "cancel_reminder",
            live &&
                content.kind === "message_reminder_created_content" &&
                content.remindAt > input.now,
        );
        const pinnable = live && permissions.pin && !inThread && multiUserChat;
        add("pin", pinnable && !input.pinned);
        add("unpin", pinnable && input.pinned);
        add("reply", live && input.supportsReply && permissions.send);
        add("start_thread", live && input.supportsReply && !inThread && permissions.startThread);
        add("forward", canForward(content) && !inThread && !inert && !failed);
        // a private reply goes to the sender, which for a relayed message is the bridge bot
        add(
            "reply_privately",
            live &&
                multiUserChat &&
                !inThread &&
                !me &&
                bridgedFrom(msg.senderContext) === undefined &&
                content.kind !== "proposal_content",
        );
        const translatable = !me && !failed && (getMessageText(content) ?? "").length > 0;
        add("translate", translatable && !input.translated);
        add("untranslate", translatable && input.translated);
        add("edit", canEdit && !inert && !failed);
        add("tip", canTip);
        add(
            "block_user",
            confirmed &&
                input.chatKind === "group_chat" &&
                !input.showAsMe &&
                permissions.blockSender &&
                !failed,
        );
        const canDelete =
            userCanDeleteMessage(msg, confirmed, userId, permissions.deleteOthers) && !inert;
        add(multiUserChat || me ? "delete" : "delete_for_me", canDelete);
        add("report", confirmed && !input.showAsMe && !inert);
        add("reveal", canRevealDeleted || canRevealBlocked);
        add("undelete", canUndelete);
        add("retry", failed);
    }

    return {
        inert,
        menu,
        react: permissions.react && !inert && !failed,
        canEdit,
        canTip,
        actions,
    };
}

/**
 * A message as a reply quotes it: what the composer's reply holds (`setReplyingTo`), and what a
 * private reply carries to the sender's DM.
 */
export function messageReplyContext(
    evt: EventWrapper<Message>,
    sender: UserSummary | undefined,
    sourceContext: MessageContext,
): EnhancedReplyContext {
    const msg = evt.event;
    return {
        kind: "rehydrated_reply_context",
        senderId: msg.sender,
        eventIndex: evt.index,
        content: msg.content,
        sender,
        messageId: msg.messageId,
        messageIndex: msg.messageIndex,
        edited: msg.edited,
        isThreadRoot: msg.thread !== undefined,
        sourceContext,
        senderContext: msg.senderContext,
    };
}

/** The reaction a picked emoji adds: a native emoji itself, a custom one as `@CE(code)`. */
export function emojiReaction(selected: SelectedEmoji): string {
    return selected.kind === "native" ? selected.unicode : `@CE(${selected.code})`;
}
