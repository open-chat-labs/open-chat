/**
 * When the other user in a direct chat is migrated to a MultiUser canister, they get a new id, and
 * the chat is moved onto it: the User canister's next updates remove the chat under the old id and,
 * in the same answer, add it under the new one, with nothing to link the two. A chat is only moved
 * if there's no chat under the new id already, else both are kept. This picks out the chats among
 * `removed`, the user ids of the direct chats an answer removed, which were moved rather than
 * deleted: those whose user's latest id, from `latestUserIds`, is one `added` has a chat with. Each
 * is mapped to that id.
 */
export function movedDirectChats(
    removed: string[],
    added: string[],
    latestUserIds: ReadonlyMap<string, string>,
): Map<string, string> {
    const addedIds = new Set(added);
    const moved = new Map<string, string>();
    for (const userId of removed) {
        const latest = latestUserIds.get(userId);
        if (latest !== undefined && latest !== userId && addedIds.has(latest)) {
            moved.set(userId, latest);
        }
    }
    return moved;
}
