import type { EventWrapper, Message } from "@client";
import {
    messageRow,
    isOpenThread,
    type ConversationContext,
    type MessageRow,
    type MessageStatus,
} from "./messageRow";

/**
 * The conversation's rows, kept per event while nothing a row shows changes (the event, its
 * status, the names in it, and its thread link's state: whether it's the thread open and its unread
 * replies), so a row stays the same object, and its bubble isn't redone, as users and other chat
 * state update. The screen clears it when the wording, the day or the chat changes.
 */
export class RowCache {
    #rows = new Map<
        string,
        {
            evt: EventWrapper<Message>;
            status: MessageStatus;
            names: string;
            thread: string;
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
        const names = `${name(msg.sender)}\n${reply?.kind === "rehydrated_reply_context" ? name(reply.senderId) : ""}`;
        // another thread opening, or a thread's replies being read, redoes only the rows it concerns
        const thread =
            msg.thread === undefined
                ? ""
                : `${isOpenThread(msg, ctx.openThread)}|${ctx.unreadInThread(msg.messageIndex)}`;
        const kept = this.#rows.get(key);
        if (
            kept?.evt === evt &&
            kept.status === status &&
            kept.names === names &&
            kept.thread === thread
        ) {
            return kept.row;
        }
        const row = messageRow(evt, status, ctx);
        this.#rows.set(key, { evt, status, names, thread, row });
        return row;
    }

    clear(): void {
        this.#rows.clear();
    }
}
