import store from "../store";
import { ChatId } from "./model/chats";
import { Option } from "./model/common";
import markMessagesAsReadServerSync from "../actions/chats/markMessagesAsReadServerSync";

const SYNC_DELAY_MS = 3_000;

type MarkAsReadPending = {
    chatId: ChatId,
    messageIds: Set<number>,
    timeoutId: NodeJS.Timeout
}

class MarkAsReadHandler {
    pending: Option<MarkAsReadPending> = null;

    public markRead = (chatId: ChatId, messageIds: number[]) : void => {
        if (this.pending) {
            if (this.pending.chatId !== chatId) {
                this.updateServer();
            } else {
                // Clear the current timeout and start waiting again, so we flush to the server once no new messages are
                // marked as read for SYNC_DELAY_MS
                clearTimeout(this.pending.timeoutId);
                this.pending.timeoutId = setTimeout(() => this.updateServer(), SYNC_DELAY_MS);
            }
        }
        if (!this.pending) {
            this.pending = {
                chatId,
                messageIds: new Set<number>(),
                timeoutId: setTimeout(() => this.updateServer(), SYNC_DELAY_MS)
            }
        }

        for (const messageId of messageIds) {
            this.pending.messageIds.add(messageId);
        }
    }

    public updateServer = () : void => {
        const pending = this.pending;
        if (!pending || !pending.messageIds.size) return;

        const ordered = Array.from(pending.messageIds).sort();
        const ranges: [number, number][] = [];
        let current: Option<[number, number]> = null;
        for (const messageId of ordered) {
            if (!current) {
                current = [messageId, messageId];
            } else if (messageId === current[1] + 1) {
                current[1] = messageId;
            } else {
                ranges.push(current);
                current = [messageId, messageId];
            }
        }
        if (current) {
            ranges.push(current);
        }

        ranges.forEach(r => store.dispatch<any>(markMessagesAsReadServerSync(pending.chatId, r[0], r[1])));

        this.pending = null;
    }
}

const handler = new MarkAsReadHandler();

export default handler;
