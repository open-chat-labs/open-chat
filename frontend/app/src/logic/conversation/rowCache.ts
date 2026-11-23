import { proposalTopicLabel, type EventWrapper, type Message } from "@client";
import {
    messageRow,
    isOpenThread,
    proposalVoting,
    quoteText,
    type ConversationContext,
    type DailyResultView,
    type MessageRow,
    type MessageStatus,
} from "./messageRow";

/**
 * The conversation's rows, kept per event while nothing a row shows changes (the event, its
 * status, the names in it, its quote's text with the mentions named, its sender's picture, and its
 * thread link's state: whether it's the thread open and its unread replies, whether a deleted
 * message is being undeleted, and a proposal's type, the reader's vote on it this session and how long
 * its voting has left, which the screen's clock moves on), so a row stays the same object, and its bubble isn't redone, as users and other chat state update. The screen clears it when the wording, the day or the chat changes.
 */
export class RowCache {
    #rows = new Map<
        string,
        {
            evt: EventWrapper<Message>;
            status: MessageStatus;
            names: string;
            thread: string;
            undeleting: boolean;
            proposal: string;
            result: string;
            row: MessageRow;
        }
    >();

    row(
        key: string,
        evt: EventWrapper<Message>,
        status: MessageStatus,
        ctx: ConversationContext,
    ): MessageRow {
        const msg = evt.event;
        const reply = msg.repliesTo;
        const name = (userId: string) => (userId === ctx.me ? ctx.you : ctx.userName(userId));
        // a quote's mentions are named from the users and user groups, which can load after the row
        // is made; the sender's picture goes with their name: one loading late redoes their rows
        const quoted = reply?.kind === "rehydrated_reply_context" ? reply : undefined;
        const names = `${ctx.userName(msg.sender)}\n${quoted ? `${name(quoted.senderId)}\n${quoteText(quoted.content, ctx)}` : ""}\n${ctx.avatar(msg.sender) ?? ""}\n${namedInRow(msg, ctx).join("\n")}`;
        // another thread opening, or a thread's replies being read, redoes only the rows it concerns
        const thread =
            msg.thread === undefined || !ctx.threads
                ? ""
                : `${isOpenThread(msg, ctx.openThread)}|${ctx.unreadInThread(msg.messageIndex)}`;
        // a deleted message's tombstone says while it's being undeleted
        const undeleting = msg.content.kind === "deleted_content" && ctx.undeleting(msg.messageId);
        // a proposal's type (the chat's names load late), a vote cast on it this session, and how
        // long its voting has left ("" once it's over)
        const content = msg.content;
        const proposal =
            content.kind === "proposal_content"
                ? `${ctx.proposalVote(msg.messageId) ?? ""}|${proposalTopicLabel(content, ctx.proposalTopics)}|${proposalVoting(content.proposal.deadline, ctx.now).left}`
                : "";
        // a daily puzzle result's check against the results index landing, and whether it still
        // offers today's puzzle
        const result =
            content.kind === "daily_result" ? dailyResultKey(ctx.dailyResult(content)) : "";
        const kept = this.#rows.get(key);
        if (
            kept?.evt === evt &&
            kept.status === status &&
            kept.names === names &&
            kept.thread === thread &&
            kept.undeleting === undeleting &&
            kept.proposal === proposal &&
            kept.result === result
        ) {
            return kept.row;
        }
        const row = messageRow(evt, status, ctx);
        this.#rows.set(key, { evt, status, names, thread, undeleting, proposal, result, row });
        return row;
    }

    clear(): void {
        this.#rows.clear();
    }
}

function dailyResultKey(view: DailyResultView): string {
    return `${view.verification.kind}|${view.drawable}|${view.offersPlay}`;
}

/**
 * The names a message's row shows besides its sender's and its quote's, which can load after the
 * row is made: whoever deleted it (its placeholder's popover, or a revealed message's bin's), a
 * transfer's or a prize win's recipient, and whoever tipped it (its tip chips' tooltips).
 */
export function namedInRow(
    msg: Message,
    ctx: Pick<ConversationContext, "userName" | "deletion">,
): string[] {
    const content = msg.content;
    const names: string[] = [];
    if (content.kind === "deleted_content") names.push(ctx.userName(content.deletedBy));
    else if (msg.deleted) {
        // revealed: who deleted it is the server's copy's
        const deletion = ctx.deletion(msg.messageId);
        if (deletion !== undefined) names.push(ctx.userName(deletion.deletedBy));
    }
    if (content.kind === "crypto_content") names.push(ctx.userName(content.transfer.recipient));
    if (content.kind === "prize_winner_content") {
        names.push(ctx.userName(content.transaction.recipient));
    }
    for (const byUser of Object.values(msg.tips)) {
        for (const userId of Object.keys(byUser)) names.push(ctx.userName(userId));
    }
    return names;
}
