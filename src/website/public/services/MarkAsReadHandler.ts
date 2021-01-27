import store from "../store";
import { ChatId } from "../model/chats";
import { Option } from "../model/common";
import markMessagesAsReadServerSync from "../actions/chats/markMessagesAsReadServerSync";

const pending = new Map<ChatId, [Set<number>, NodeJS.Timeout]>();
const SYNC_DELAY_MS = 10_000;

export default class MarkAsReadHandler {
    public static markRead(chatId: ChatId, messageIds: number[]) : void {
        let values = pending.get(chatId);
        if (!values) {
            const timeout = setTimeout(() => this.updateServer(chatId), SYNC_DELAY_MS);
            values = [new Set<number>(), timeout];
            pending.set(chatId, values);
        }
        for (const messageId of messageIds) {
            values[0].add(messageId);
        }
    }

    static updateServer(chatId: ChatId) : void {
        const values = pending.get(chatId);
        if (!values) return;

        pending.delete(chatId);

        const [messageIds] = values;
        if (!messageIds.size) return;

        const ordered = Array.from(messageIds).sort();
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

        ranges.forEach(r => store.dispatch<any>(markMessagesAsReadServerSync(chatId, r[0], r[1])));
    }
}