import { type ChatIdentifier, type ChatSummary, chatIdentifiersEqual } from "@shared";
import { dequal } from "dequal";

/**
 * Whether a folded updates answer changed `chatId`: events in it were updated, or its summary
 * came back different from `previous`, the summary held before the fold. A pulled answer carries
 * only what changed since the cursor, but a channel comes back whenever anything in its
 * community did, so a summary that came back is compared rather than taken as a change.
 */
export function answerTouchesChat(
    chatId: ChatIdentifier,
    previous: ChatSummary | undefined,
    chatsAddedUpdated: ChatSummary[],
    updatedEventCount: number,
): boolean {
    if (updatedEventCount > 0) return true;
    const returned = chatsAddedUpdated.find((c) => chatIdentifiersEqual(c.id, chatId));
    return returned !== undefined && (previous === undefined || !dequal(returned, previous));
}
