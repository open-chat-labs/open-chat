import DRange from "drange";
import type { ServiceContainer } from "services/serviceContainer";
import type { Subscriber, Unsubscriber } from "svelte/store";
import type { MarkReadRequest, MarkReadResponse } from "../domain/chat/chat";
import { indexIsInRanges } from "../domain/chat/chat.utils";
import { unconfirmed } from "./unconfirmed";

const MARK_READ_INTERVAL = 10 * 1000;

export interface MarkMessagesRead {
    markMessagesRead: (request: MarkReadRequest) => Promise<MarkReadResponse>;
}

type MessageRangesByChat = Record<string, DRange>;

export type MessageReadState = {
    serverState: MessageRangesByChat;
    waiting: Record<string, Map<bigint, number>>;
    state: MessageRangesByChat;
};

export class MessageReadTracker {
    private interval: number | undefined;
    public serverState: MessageRangesByChat = {};
    public waiting: Record<string, Map<bigint, number>> = {}; // The map is messageId -> (unconfirmed) messageIndex
    public state: MessageRangesByChat = {};
    private subscribers: Subscriber<MessageReadState>[] = [];

    public subscribe(sub: Subscriber<MessageReadState>): Unsubscriber {
        this.subscribers.push(sub);
        sub({
            serverState: this.serverState,
            waiting: this.waiting,
            state: this.state,
        });
        return () => {
            this.subscribers = this.subscribers.filter((s) => s !== sub);
        };
    }

    start(api: ServiceContainer): void {
        if (process.env.NODE_ENV !== "test") {
            this.interval = window.setInterval(() => this.sendToServer(api), MARK_READ_INTERVAL);
        }
        if (process.env.NODE_ENV !== "test") {
            window.onbeforeunload = () => this.sendToServer(api);
        }
    }

    stop(): void {
        if (this.interval !== undefined) {
            console.log("stopping the mark read poller");
            clearInterval(this.interval);
        }
    }

    private sendToServer(api: ServiceContainer): void {
        const req = Object.entries(this.state).reduce<MarkReadRequest>((req, [chatId, ranges]) => {
            if (ranges.length > 0) {
                req.push({
                    chatId,
                    ranges,
                });
            }
            return req;
        }, [] as MarkReadRequest);

        if (req.length > 0) {
            console.log("Sending messages read to the server: ", JSON.stringify(req));
            api.markMessagesRead(req);
        }
    }

    /** this will notify all subscribers that something that affects the unread message count has changed */
    public publish(): void {
        this.subscribers.forEach((sub) => {
            sub({
                serverState: this.serverState,
                waiting: this.waiting,
                state: this.state,
            });
        });
    }

    markMessageRead(chatId: string, messageIndex: number, messageId: bigint): void {
        if (!this.state[chatId]) {
            this.state[chatId] = new DRange();
        }
        if (unconfirmed.contains(chatId, messageId)) {
            // if a message is unconfirmed we will just tuck it away until we are told it has been confirmed
            if (this.waiting[chatId] === undefined) {
                this.waiting[chatId] = new Map<bigint, number>();
            }
            this.waiting[chatId].set(messageId, messageIndex);
        } else {
            this.state[chatId] = (this.state[chatId] ?? new DRange()).add(messageIndex);
        }

        this.publish();
    }

    markRangeRead(chatId: string, from: number, to: number): void {
        if (!this.state[chatId]) {
            this.state[chatId] = new DRange();
        }
        this.state[chatId].add(from, to);
        this.publish();
    }

    confirmMessage(chatId: string, messageIndex: number, messageId: bigint): boolean {
        // this is called when a message is confirmed so that we can move it from
        // the unconfirmed read to the confirmed read. This means that it will get
        // marked as read on the back end
        if (this.removeUnconfirmedMessage(chatId, messageId)) {
            this.markMessageRead(chatId, messageIndex, messageId);
            return true;
        }
        return false;
    }

    removeUnconfirmedMessage(chatId: string, messageId: bigint): boolean {
        return this.waiting[chatId] !== undefined && this.waiting[chatId].delete(messageId);
    }

    unreadMessageCount(
        chatId: string,
        firstMessageIndex: number,
        latestMessageIndex: number | undefined
    ): number {
        if (latestMessageIndex === undefined) {
            return 0;
        }

        const total = latestMessageIndex - firstMessageIndex + 1;
        const read =
            (this.serverState[chatId]?.length ?? 0) +
            (this.state[chatId]?.length ?? 0) +
            (this.waiting[chatId]?.size ?? 0);
        return Math.max(total - read, 0);
    }

    getFirstUnreadMessageIndex(
        chatId: string,
        firstMessageIndex: number,
        latestMessageIndex: number | undefined
    ): number | undefined {
        if (this.unreadMessageCount(chatId, firstMessageIndex, latestMessageIndex) === 0) {
            return undefined;
        }

        // Start with all visible messages
        const unreadMessageIndexes = new DRange(firstMessageIndex, latestMessageIndex);

        // Subtract the messages marked as read on the server
        const serverState = this.serverState[chatId];
        if (serverState) unreadMessageIndexes.subtract(serverState);

        // Subtract the confirmed messages marked as read locally
        const localState = this.state[chatId];
        if (localState) unreadMessageIndexes.subtract(localState);

        // Subtract the unconfirmed messages marked as read locally
        const waiting = this.waiting[chatId];
        if (waiting) {
            for (const messageIndex of waiting.values()) {
                unreadMessageIndexes.subtract(messageIndex);
            }
        }

        return unreadMessageIndexes.length > 0 ? unreadMessageIndexes.index(0) : undefined;
    }

    syncWithServer(chatId: string, ranges: DRange): void {
        this.serverState[chatId] = ranges;

        const state = this.state[chatId];
        if (state) {
            state.subtract(ranges);
        }
        this.publish();
    }

    isRead(chatId: string, messageIndex: number, messageId: bigint): boolean {
        if (unconfirmed.contains(chatId, messageId)) {
            return this.waiting[chatId] !== undefined && this.waiting[chatId].has(messageId);
        } else {
            const serverState = this.serverState[chatId];
            if (serverState && indexIsInRanges(messageIndex, serverState)) return true;
            const localState = this.state[chatId];
            if (localState && indexIsInRanges(messageIndex, localState)) return true;
            return false;
        }
    }
}

export const messagesRead = new MessageReadTracker();

export function startMessagesReadTracker(api: ServiceContainer): void {
    messagesRead.start(api);
}
