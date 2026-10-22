import { publish, type ChatIdentifier, type ChatSet } from "@shared";
import { allChatsStore } from "../state";
import { messagesRead } from "../state/unread/markRead";

/**
 * Brings each of a sync answer's chats that is archived and has unread messages out of the
 * archive, in one request. Chats are read with local updates merged and in every scope, not
 * just the open one. A chat already on its way out (in `inFlight`) isn't asked again until its
 * request settles. A failed request publishes `unarchiveChatFailed` once.
 */
export async function unarchiveChatsWithUnread(
    answerChatIds: Iterable<ChatIdentifier>,
    inFlight: ChatSet,
    unarchive: (chatIds: ChatIdentifier[]) => Promise<boolean>,
): Promise<void> {
    const allChats = allChatsStore.value;
    const chatIds: ChatIdentifier[] = [];
    for (const id of answerChatIds) {
        const chat = allChats.get(id);
        if (chat === undefined || !chat.membership.archived) continue;
        if (messagesRead.unreadMessagesInChat(chat) === 0) continue;
        chatIds.push(chat.id);
    }
    return unarchiveChatsReportingFailure(chatIds, inFlight, unarchive);
}

/**
 * Takes the chats out of the archive in one request, skipping any already in `inFlight` until
 * its request settles. A failed request publishes `unarchiveChatFailed` once. Selecting an
 * archived chat and the sync answer's auto-unarchive share `inFlight`, so they never both ask
 * for, or both report, the same chat.
 */
export async function unarchiveChatsReportingFailure(
    candidates: ChatIdentifier[],
    inFlight: ChatSet,
    unarchive: (chatIds: ChatIdentifier[]) => Promise<boolean>,
): Promise<void> {
    const chatIds = candidates.filter((id) => !inFlight.has(id));
    if (chatIds.length === 0) return;
    chatIds.forEach((id) => inFlight.add(id));
    const success = await unarchive(chatIds).catch(() => false);
    chatIds.forEach((id) => inFlight.delete(id));
    if (!success) publish("unarchiveChatFailed");
}
