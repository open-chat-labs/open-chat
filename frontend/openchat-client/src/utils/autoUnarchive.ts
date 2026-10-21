import type { ChatIdentifier, ChatSet, ChatSummary } from "@shared";

/**
 * Brings each archived chat with unread messages out of the archive. A chat already on its way
 * out (in `inFlight`) isn't asked again until that request settles; `failed` runs once for each
 * request that fails.
 */
export function unarchiveChatsWithUnread(
    chats: Iterable<ChatSummary>,
    unread: (chat: ChatSummary) => number,
    inFlight: ChatSet,
    unarchive: (chatId: ChatIdentifier) => Promise<boolean>,
    failed: () => void,
): Promise<void>[] {
    const requests: Promise<void>[] = [];
    for (const chat of chats) {
        if (!chat.membership.archived || inFlight.has(chat.id) || unread(chat) === 0) continue;
        inFlight.add(chat.id);
        requests.push(
            unarchive(chat.id)
                .catch(() => false)
                .then((success) => {
                    inFlight.delete(chat.id);
                    if (!success) failed();
                }),
        );
    }
    return requests;
}
