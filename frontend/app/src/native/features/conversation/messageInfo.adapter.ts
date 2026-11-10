import type { MessageStatus } from "@src/logic/conversation/messageRow";

// A message's info (native design notes §3.3): its status in words, and its reactions as rows of
// who added which.

/** A DM's own message's status, as the info's Status row says it (the double tick, "delivered", is read). */
export function infoStatus(status: MessageStatus): string {
    switch (status) {
        case "sending":
            return "native.conversation.info.sending";
        case "failed":
            return "native.conversation.info.failed";
        case "delivered":
            return "native.conversation.info.read";
        case "sent":
            return "native.conversation.info.sent";
    }
}

export type ReactionRow = { userId: string; name: string; emoji: string };

/**
 * Who reacted with what: a row for each, by reaction as the message lists them, the reader's own
 * first in each, then by name.
 */
export function reactionRows(
    reactions: readonly { reaction: string; userIds: ReadonlySet<string> }[],
    me: string,
    name: (userId: string) => string,
): ReactionRow[] {
    return reactions.flatMap((r) =>
        [...r.userIds]
            .map((userId) => ({ userId, name: name(userId), emoji: r.reaction }))
            .sort((a, b) =>
                a.userId === me ? -1 : b.userId === me ? 1 : a.name.localeCompare(b.name),
            ),
    );
}
