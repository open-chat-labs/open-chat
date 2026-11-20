import {
    isOwnMessage,
    localUpdates,
    messageMenu,
    type BridgedUserSummary,
    type ChatSummary,
    type EventWrapper,
    type Message,
    type MessageMenu,
    type MessageMenuAction,
    type MessageMenuInput,
    type OpenChat,
} from "@client";
import { canShareMessage } from "@src/utils/share";
import { rowMessageContext } from "./threadTimeline";

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
    /**
     * The reader is a guest (signed out, reading a preview): the message offers what someone with
     * an account could do with it (`guestMessageAction` says what asks them to sign in).
     */
    guest: boolean;
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

// A guest reads a preview, which is read only, but the message offers them what anyone with an
// account could do with it, as a member who can send, react and reply in a thread: nothing a
// role gives (pinning, deleting others' messages, blocking), and no tips (a guest has no wallet).
const GUEST_PERMISSIONS: MessageMenuInput["permissions"] = {
    send: true,
    react: true,
    pin: false,
    tip: false,
    deleteOthers: false,
    blockSender: false,
    startThread: true,
};

// What a guest can do with a message signed out: copy its text or its link, share it (the
// device's share sheet), fold a proposal away, and hide a revealed message again (on this device)
const SIGNED_OUT_ACTIONS: ReadonlySet<OfferedAction> = new Set<OfferedAction>([
    "copy",
    "copy_url",
    "share",
    "collapse_proposal",
    "hide",
]);

/**
 * What a guest's press on one of a message's actions does: `run`, it works signed out; `sign_in`,
 * it needs an account (a reply, a thread, forwarding, a reminder, a report, following a thread, a
 * translation, which is for Diamond members), so they're asked to sign in and stay on the chat.
 * A reaction always asks.
 */
export function guestMessageAction(action: OfferedAction): "run" | "sign_in" {
    return SIGNED_OUT_ACTIONS.has(action) ? "run" : "sign_in";
}

/**
 * What a message in the chat's own timeline offers, or in a thread's (`state.thread`), where nothing
 * is pinned and the thread's own send permission applies. A guest's (`state.guest`) offers what
 * anyone with an account could do.
 */
export function messageOffer(
    client: MessageOfferClient,
    chat: ChatSummary,
    evt: EventWrapper<Message>,
    state: MessageOfferState,
): MessageOffer {
    const msg = evt.event;
    const chatId = chat.id;
    const thread = state.thread;
    const isRoot = thread !== undefined && msg.messageId === thread.root.messageId;
    // where the message is: in a thread, its root is the chat's
    const context = rowMessageContext(chatId, thread?.root, msg);
    const offered = messageMenu({
        message: msg,
        userId: state.me,
        showAsMe: isOwnMessage(msg, state.me, state.bridgedUsers),
        chatKind: chat.kind,
        publicGroup: chat.kind !== "direct_chat" && chat.public,
        confirmed: state.confirmed,
        failed: state.failed,
        collapsed: false,
        readonly: state.readonly && !state.guest,
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
        permissions: state.guest
            ? GUEST_PERMISSIONS
            : {
                  send: client.canSendMessage(chatId, thread === undefined ? "message" : "thread"),
                  react: client.canReactToMessages(chatId),
                  pin: client.canPinMessages(chatId),
                  tip: client.canTipMessages(chatId),
                  deleteOthers: client.canDeleteOtherUsersMessages(chatId),
                  blockSender: client.canBlockUsers(chatId) && !state.blocked.has(msg.sender),
                  startThread: client.canSendMessage(chatId, "thread"),
              },
    });
    return peekOffer(offered, msg);
}

/**
 * What a message's menu, hover bar and swipes can do in the new UIs: `messageMenu`'s actions, and
 * Hide, which puts a revealed deleted message back behind its placeholder (`hideRevealedMessage`).
 */
export type OfferedAction = MessageMenuAction | "hide";

/** What a message offers in the new UIs (`messageMenu`'s, with `OfferedAction`s). */
export type MessageOffer = Omit<MessageMenu, "actions"> & { actions: ReadonlySet<OfferedAction> };

/**
 * Whether a message is a deleted one revealed (`revealDeletedMessage`): its content back, still
 * deleted.
 */
export function isRevealedDeleted(msg: Pick<Message, "deleted" | "content">): boolean {
    return msg.deleted && msg.content.kind !== "deleted_content";
}

// what a revealed deleted message's menu keeps of `messageMenu`'s (Hide is added)
const PEEK_ACTIONS: ReadonlySet<MessageMenuAction> = new Set<MessageMenuAction>([
    "undelete",
    "copy",
]);

/**
 * A revealed deleted message is only peeked at (the user's decision of 2026-11-20): its menu
 * offers Undelete and Copy where `messageMenu` does, and Hide; no reactions (its own stay, read
 * only), no reply, edit, forward, pin, thread, reminder, report or tip, and no Info (native: it's
 * inert). `messageMenu`, which the old trees read, still offers them all there. Any other message
 * offers what `messageMenu` says.
 */
export function peekOffer(
    offered: MessageMenu,
    msg: Pick<Message, "deleted" | "content">,
): MessageOffer {
    if (!isRevealedDeleted(msg)) return offered;
    const actions = new Set<OfferedAction>([...offered.actions].filter((a) => PEEK_ACTIONS.has(a)));
    if (offered.menu) actions.add("hide");
    return { ...offered, inert: true, react: false, canEdit: false, canTip: false, actions };
}
