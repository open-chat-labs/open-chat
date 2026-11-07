import {
    pollVoteChange,
    type ChatSummary,
    type Message,
    type OpenChat,
    type PollContent,
} from "@client";

/**
 * A vote on a poll in a chat's timeline, or a thread's (`threadRootMessageIndex`), if the poll can
 * take it (`pollVoteChange`; 5a invariant
 * 4): the vote shows at once, as in the old trees. "none" when there was nothing to send (a DM's
 * poll, or no change), "failed" when the vote didn't go through, for the view to say so.
 */
export async function votePoll(
    client: Pick<OpenChat, "isChatReadOnly" | "registerPollVote">,
    chat: ChatSummary,
    me: string,
    msg: Pick<Message, "sender" | "messageId" | "messageIndex">,
    content: PollContent,
    next: number[],
    threadRootMessageIndex?: number,
): Promise<"voted" | "none" | "failed"> {
    if (chat.kind === "direct_chat") return "none";
    const change = pollVoteChange(
        content,
        { me, sender: msg.sender, direct: false, readonly: client.isChatReadOnly(chat.id) },
        next,
    );
    if (change === undefined) return "none";
    const voted = await client.registerPollVote(
        chat.id,
        threadRootMessageIndex,
        msg.messageId,
        msg.messageIndex,
        change.answerIndex,
        change.type,
    );
    return voted ? "voted" : "failed";
}
