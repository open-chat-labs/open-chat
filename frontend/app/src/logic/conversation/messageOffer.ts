import {
    isOwnMessage,
    localUpdates,
    messageMenu,
    type BridgedUserSummary,
    type ChatSummary,
    type EventWrapper,
    type Message,
    type MessageContext,
    type MessageMenu,
    type OpenChat,
} from "@client";
import { canShareMessage } from "@src/utils/share";

// What a message in a chat's timeline or a thread's offers (`messageMenu`, as the old trees decide
// it), for every conversation that shows its messages with the library (src/web's, src/native's):
// its menu's actions, which also say what its swipes and Retry do. Read as a row renders, so the
// row follows the chat's permissions and the message's state.

/** The client's permission checks a message's offer reads. */
export type MessageOfferClient = Pick<
    OpenChat,
    | "canSendMessage"
    | "canReactToMessages"
    | "canPinMessages"
    | "canTipMessages"
    | "canDeleteOtherUsersMessages"
    | "canBlockUsers"
>;

/** The message's state, and the stores' values, a message's offer depends on. */
export type MessageOfferState = {
    /** The signed-in user. */
    me: string;
    bridgedUsers: ReadonlyMap<string, BridgedUserSummary>;
    failed: boolean;
    confirmed: boolean;
    /** The chat can only be read (`isChatReadOnly`). */
    readonly: boolean;
    /** The chat's pinned messages, by index. */
    pinned: { has(messageIndex: number): boolean };
    /** The messages shown translated, and those being undeleted, by id. */
    translated: { has(messageId: bigint): boolean };
    undeleting: { has(messageId: bigint): boolean };
    /** Who is blocked from the chat. */
    blocked: { has(userId: string): boolean };
    /** Tipping is on in this build. */
    tipsEnabled: boolean;
    /**
     * In a thread's list: its root, which can't be edited or replied to there, and whether the
     * reader follows the thread. None in the chat's own timeline.
     */
    thread?: { root: Pick<Message, "messageId" | "messageIndex">; following: boolean };
};

/**
 * What a message in the chat's own timeline offers, or in a thread's (`state.thread`), where nothing
 * is pinned and the thread's own send permission applies.
 */
export function messageOffer(
    client: MessageOfferClient,
    chat: ChatSummary,
    evt: EventWrapper<Message>,
    state: MessageOfferState,
): MessageMenu {
    const msg = evt.event;
    const chatId = chat.id;
    const thread = state.thread;
    const isRoot = thread !== undefined && msg.messageId === thread.root.messageId;
    const context: MessageContext =
        thread === undefined
            ? { chatId }
            : { chatId, threadRootMessageIndex: thread.root.messageIndex };
    return messageMenu({
        message: msg,
        userId: state.me,
        showAsMe: isOwnMessage(msg, state.me, state.bridgedUsers),
        chatKind: chat.kind,
        publicGroup: chat.kind !== "direct_chat" && chat.public,
        confirmed: state.confirmed,
        failed: state.failed,
        collapsed: false,
        readonly: state.readonly,
        ephemeral: localUpdates.isEphemeral(context, msg.messageId),
        pinned: thread === undefined && state.pinned.has(msg.messageIndex),
        translated: state.translated.has(msg.messageId),
        undeleting: state.undeleting.has(msg.messageId),
        now: Date.now(),
        thread: thread === undefined ? undefined : { following: thread.following },
        supportsEdit: !isRoot,
        supportsReply: !isRoot,
        shareable: canShareMessage(msg.content),
        // TODO(phase 5, 5b): tipping (in a thread too, by the "tip messages" permission)
        tipRecipient: undefined,
        tipsEnabled: state.tipsEnabled,
        permissions: {
            send: client.canSendMessage(chatId, thread === undefined ? "message" : "thread"),
            react: client.canReactToMessages(chatId),
            pin: client.canPinMessages(chatId),
            tip: client.canTipMessages(chatId),
            deleteOthers: client.canDeleteOtherUsersMessages(chatId),
            blockSender: client.canBlockUsers(chatId) && !state.blocked.has(msg.sender),
            startThread: client.canSendMessage(chatId, "thread"),
        },
    });
}
