import { ChatId } from "../model/chats";
import { Option } from "../model/common";
import markMessagesAsRead from "../actions/chats/markMessagesAsRead";
import store from "../store";

const pending = new Map<ChatId, [Set<number>, NodeJS.Timeout]>();
const TEN_SECONDS_MS= 10_000;

export default class markAsReadHandler {
    public static markRead(chatId: ChatId, messageId: number) : void {
        const createTimeout = () => setTimeout(() => this.updateServer(chatId), TEN_SECONDS_MS);

        const existing = pending.get(chatId);
        if (existing) {
            existing[0].add(messageId);
        } else {
            pending.set(chatId, [new Set<number>([messageId]), createTimeout()]);
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

        ranges.forEach(r => store.dispatch<any>(markMessagesAsRead(chatId, r[0], r[1])));
    }
}