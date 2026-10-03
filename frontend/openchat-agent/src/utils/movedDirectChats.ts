import type { DirectChatSummary } from "@shared";

/**
 * When the other user in a direct chat is migrated to a MultiUser canister, they get a new id, and
 * the chat is moved onto it: the User canister's next updates remove the chat under the old id and,
 * in the same answer, add it under the new one, with nothing to link the two. A chat is only moved
 * if there's no chat under the new id already, else both are kept, and it keeps the date it was
 * created.
 *
 * This picks out the chats among `removed`, the user ids of the direct chats an answer removed,
 * which were moved rather than deleted: those whose user's latest id, from `latestUserIds`, is one
 * `added` has a chat with, which was created when the chat cached under the old id, if there is
 * one, was. That rules out a chat which was deleted, and a new one with the same user, since
 * migrated, which happened to come in the same answer. Each is mapped to that latest id.
 */
export function movedDirectChats(
    removed: string[],
    added: DirectChatSummary[],
    cached: DirectChatSummary[],
    latestUserIds: ReadonlyMap<string, string>,
): Map<string, string> {
    const addedChats = new Map(added.map((chat) => [chat.id.userId, chat]));
    const cachedChats = new Map(cached.map((chat) => [chat.id.userId, chat]));
    const moved = new Map<string, string>();
    for (const userId of removed) {
        const latest = latestUserIds.get(userId);
        if (latest === undefined || latest === userId) continue;
        const addedChat = addedChats.get(latest);
        const cachedChat = cachedChats.get(userId);
        if (
            addedChat !== undefined &&
            (cachedChat === undefined || cachedChat.dateCreated === addedChat.dateCreated)
        ) {
            moved.set(userId, latest);
        }
    }
    return moved;
}

/**
 * The chats among `removed` which were moved rather than deleted, as `movedDirectChats` finds them.
 * A move adds the chat under the new id in the same answer, so only if the answer added a chat are
 * the users looked up by `lookUpLatestUserIds`, by the ids the chats were under. Throws if that
 * does, so that the answer can be fetched again, rather than a move being taken for a deletion.
 */
export async function findMovedDirectChats(
    removed: string[],
    added: DirectChatSummary[],
    cached: DirectChatSummary[],
    lookUpLatestUserIds: (userIds: string[]) => Promise<ReadonlyMap<string, string>>,
): Promise<Map<string, string>> {
    if (removed.length === 0 || added.length === 0) return new Map();
    return movedDirectChats(removed, added, cached, await lookUpLatestUserIds(removed));
}
