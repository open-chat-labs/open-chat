import type { EventWrapper, Message } from "@client";
import {
    messageRow,
    type ConversationContext,
    type MessageRow,
    type MessageStatus,
} from "./conversation.adapter";

/**
 * The conversation's rows, kept per event while nothing a row shows changes (the event, its
 * status and the names in it), so a row stays the same object, and its bubble isn't redone, as
 * users and other chat state update. The screen clears it when the wording, the day or the chat
 * changes.
 */
export class RowCache {
    #rows = new Map<
        string,
        { evt: EventWrapper<Message>; status: MessageStatus; names: string; row: MessageRow }
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
        const kept = this.#rows.get(key);
        if (kept?.evt === evt && kept.status === status && kept.names === names) {
            return kept.row;
        }
        const row = messageRow(evt, status, ctx);
        this.#rows.set(key, { evt, status, names, row });
        return row;
    }

    clear(): void {
        this.#rows.clear();
    }
}
