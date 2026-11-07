import {
    isOwnMessage,
    localUpdates,
    messageMenu,
    type BridgedUserSummary,
    type ChatSummary,
    type EventWrapper,
    type Message,
    type MessageMenu,
    type OpenChat,
} from "@client";
import { canShareMessage } from "@src/utils/share";

// What a message in a chat's own timeline offers (`messageMenu`, as the old trees decide it), for
// every conversation that shows its messages with the library (src/web's, src/native's): its menu's
// actions, which also say what its swipes and Retry do. Read as a row renders, so the row follows
// the chat's permissions and the message's state.

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
};

/** What a message in the chat's own timeline (not a thread) offers. */
export function messageOffer(
    client: MessageOfferClient,
    chat: ChatSummary,
    evt: EventWrapper<Message>,
    state: MessageOfferState,
): MessageMenu {
    const msg = evt.event;
    const chatId = chat.id;
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
        ephemeral: localUpdates.isEphemeral({ chatId }, msg.messageId),
        pinned: state.pinned.has(msg.messageIndex),
        translated: state.translated.has(msg.messageId),
        undeleting: state.undeleting.has(msg.messageId),
        now: Date.now(),
        // TODO(4c): the thread's own list
        thread: undefined,
        supportsEdit: true,
        supportsReply: true,
        shareable: canShareMessage(msg.content),
        // TODO(phase 5, 5b): tipping
        tipRecipient: undefined,
        tipsEnabled: state.tipsEnabled,
        permissions: {
            send: client.canSendMessage(chatId, "message"),
            react: client.canReactToMessages(chatId),
            pin: client.canPinMessages(chatId),
            tip: client.canTipMessages(chatId),
            deleteOthers: client.canDeleteOtherUsersMessages(chatId),
            blockSender: client.canBlockUsers(chatId) && !state.blocked.has(msg.sender),
            startThread: client.canSendMessage(chatId, "thread"),
        },
    });
}
