import {
    allChatsStore,
    chatsInitialisedStore,
    messagesRead,
    subscribe,
    type ChatSummary,
} from "@client";
import { releaseNotifications, type NotificationIdentifier } from "tauri-plugin-oc-api";

// A chat's notifications only go when it's opened on the phone, or the notification is tapped or
// swiped away. So once the chats have caught up after the app started or came back to the
// foreground, the notifications of every chat (or thread) read on another device are released.
//
// Neither shell can say which chats it holds notifications for, and releasing every read chat
// would be a native call per chat, hundreds of them, on every resume. So only the chats that could
// have gained a notification since the last check are released: those that had unread messages
// then, and those with a newer message since. The first check compares against the chats as they
// were cached, so a cold start counts too.

/** A chat, or one of its threads, as the shell's notifications are grouped */
export type NotificationContext = {
    id: NotificationIdentifier;
    latestMessageIndex: number;
    unread: number;
};

/** The contexts as they were at the last check, by `contextKey` */
export type ReadMarks = Map<string, { latestMessageIndex: number; unread: number }>;

function contextKey(id: NotificationIdentifier): string {
    switch (id.kind) {
        case "dms":
            return `dms/${id.senderId}`;
        case "group":
            return `group/${id.groupId}/${id.threadIndex ?? ""}`;
        case "channel":
            return `channel/${id.communityId}/${id.channelId}/${id.threadIndex ?? ""}`;
    }
}

/** Every chat with a message, and each of its threads, with what's unread in it */
export function notificationContexts(
    chats: Iterable<ChatSummary>,
    unreadInChat: (chat: ChatSummary) => number,
    unreadInThread: (chat: ChatSummary, threadRootMessageIndex: number, latest: number) => number,
): NotificationContext[] {
    const contexts: NotificationContext[] = [];
    for (const chat of chats) {
        const latestMessageIndex = chat.latestMessage?.event.messageIndex;
        if (latestMessageIndex === undefined) continue;
        const unread = unreadInChat(chat);
        if (chat.kind === "direct_chat") {
            contexts.push({
                id: { kind: "dms", senderId: chat.id.userId },
                latestMessageIndex,
                unread,
            });
            continue;
        }
        const id: NotificationIdentifier =
            chat.kind === "group_chat"
                ? { kind: "group", groupId: chat.id.groupId }
                : {
                      kind: "channel",
                      communityId: chat.id.communityId,
                      channelId: chat.id.channelId,
                  };
        contexts.push({ id, latestMessageIndex, unread });
        for (const thread of chat.membership.latestThreads) {
            const threadIndex = thread.threadRootMessageIndex;
            contexts.push({
                id: { ...id, threadIndex },
                latestMessageIndex: thread.latestMessageIndex,
                unread: unreadInThread(chat, threadIndex, thread.latestMessageIndex),
            });
        }
    }
    return contexts;
}

export function readMarks(contexts: NotificationContext[]): ReadMarks {
    return new Map(
        contexts.map(({ id, latestMessageIndex, unread }) => [
            contextKey(id),
            { latestMessageIndex, unread },
        ]),
    );
}

/**
 * The contexts whose notifications go: nothing unread now, and at the last check either something
 * unread or an older latest message. A context the last check didn't see is left alone, so a
 * check with nothing to compare against releases nothing rather than everything.
 */
export function readElsewhere(
    before: ReadMarks,
    now: NotificationContext[],
): NotificationIdentifier[] {
    return now
        .filter(({ id, latestMessageIndex, unread }) => {
            const then = before.get(contextKey(id));
            return (
                unread === 0 &&
                then !== undefined &&
                (then.unread > 0 || latestMessageIndex > then.latestMessageIndex)
            );
        })
        .map(({ id }) => id);
}

function currentContexts(): NotificationContext[] {
    return notificationContexts(
        allChatsStore.value.values(),
        (chat) => messagesRead.unreadMessagesInChat(chat),
        (chat, root, latest) => messagesRead.unreadThreadMessageCount(chat.id, root, latest),
    );
}

/** Native apps only. Runs for the rest of the page session. */
export function releaseNotificationsReadElsewhere(): void {
    let before: ReadMarks | undefined = undefined;

    // The chats as cached, before the session's first pass brings them up to date. Forgotten on
    // sign-out, so one account is never compared with another.
    chatsInitialisedStore.subscribe((initialised) => {
        before = initialised ? readMarks(currentContexts()) : undefined;
    });

    subscribe("chatsCaughtUp", () => {
        if (before === undefined) return;
        const now = currentContexts();
        for (const id of readElsewhere(before, now)) {
            releaseNotifications(id).catch((err) =>
                console.warn("Unable to release notifications", err),
            );
        }
        before = readMarks(now);
    });
}
