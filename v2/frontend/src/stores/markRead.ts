import { get, Subscriber, Unsubscriber, Writable, writable } from "svelte/store";
import type { MarkReadRequest, MarkReadResponse, MessageIndexRange } from "../domain/chat/chat";
import {
    indexIsInRanges,
    insertIndexIntoRanges,
    mergeMessageIndexRanges,
    messageIndexRangesAreEqual,
} from "../domain/chat/chat.utils";
import { unconfirmed } from "./unconfirmed";

const MARK_READ_INTERVAL = 10 * 1000;

export interface MarkMessagesRead {
    markMessagesRead: (request: MarkReadRequest) => Promise<MarkReadResponse>;
}

type MessageRangesByChat = Record<string, MessageIndexRange[]>;

export interface IMessageReadTracker {
    markRangeRead: (chatId: string, range: MessageIndexRange) => void;
    markMessageRead: (chatId: string, messageIndex: number, messageId: bigint) => void;
    confirmMessage: (chatId: string, messageIndex: number, messageId: bigint) => boolean;
    removeUnconfirmedMessage: (chatId: string, messageId: bigint) => boolean;
    syncWithServer: (chatId: string, ranges: MessageIndexRange[]) => void;
    unreadMessageCount: (
        chatId: string,
        firstMessageIndex: number,
        latestMessageIndex: number | undefined
    ) => number;
    isRead: (chatId: string, messageIndex: number, messageId: bigint) => boolean;
    stop: () => void;
    subscribe(sub: Subscriber<MessageReadState>): Unsubscriber;
}

export type MessageReadState = {
    serverState: MessageRangesByChat;
    waiting: Record<string, Set<bigint>>;
    state: MessageRangesByChat;
};

export class MessageReadTracker implements IMessageReadTracker {
    private interval: number | undefined;
    public serverState: MessageRangesByChat = {};
    public waiting: Record<string, Set<bigint>> = {};
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

    constructor(private api: MarkMessagesRead) {
        if (process.env.NODE_ENV !== "test") {
            this.interval = window.setInterval(() => this.sendToServer(), MARK_READ_INTERVAL);
        }
        if (process.env.NODE_ENV !== "test") {
            window.onbeforeunload = () => this.sendToServer();
        }
    }

    stop(): void {
        if (this.interval !== undefined) {
            console.log("stopping the mark read poller");
            clearInterval(this.interval);
        }
    }

    private sendToServer(): void {
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
            console.log("Sending messages read to the server: ", req);
            this.api.markMessagesRead(req);
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
            this.state[chatId] = [];
        }
        if (get(unconfirmed).has(messageId)) {
            // if a message is unconfirmed we will just tuck it away until we are told it has been confirmed
            if (this.waiting[chatId] === undefined) {
                this.waiting[chatId] = new Set<bigint>();
            }
            this.waiting[chatId].add(messageId);
        } else {
            this.state[chatId] = insertIndexIntoRanges(messageIndex, this.state[chatId] ?? []);
        }

        this.publish();
    }

    markRangeRead(chatId: string, range: MessageIndexRange): void {
        if (!this.state[chatId]) {
            this.state[chatId] = [];
        }
        this.state[chatId] = mergeMessageIndexRanges(this.state[chatId], [range]);
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
        if (this.waiting[chatId] !== undefined && this.waiting[chatId].has(messageId)) {
            return this.waiting[chatId].delete(messageId);
        }
        return false;
    }

    syncWithServer(chatId: string, ranges: MessageIndexRange[]): void {
        this.serverState[chatId] = ranges;

        // if the range from the server is equal to the range on the client and the range on the server merged
        // that means we are in sync and we can clear the local state
        const merged = mergeMessageIndexRanges(this.serverState[chatId], this.state[chatId] ?? []);
        if (messageIndexRangesAreEqual(this.serverState[chatId], merged)) {
            this.state[chatId] = [];
        }
        this.publish();
    }

    unreadMessageCount(
        chatId: string,
        firstMessageIndex: number,
        latestMessageIndex: number | undefined
    ): number {
        const numWaiting = this.waiting[chatId] === undefined ? 0 : this.waiting[chatId].size;

        if (latestMessageIndex === undefined) {
            return 0;
        }

        const merged = mergeMessageIndexRanges(
            this.serverState[chatId] ?? [],
            this.state[chatId] ?? []
        );
        if (merged.length === 0) {
            // this means we haven't officially read *any* messages so the whole range is
            // unread (minus any that we have read only locally)
            return latestMessageIndex - firstMessageIndex + 1 - numWaiting;
        }

        const [, unread, lastRead] = merged.reduce(
            ([first, unread], { from, to }) => {
                return [to + 1, unread + Math.max(from, first) - first, to];
            },
            [firstMessageIndex, 0, 0] // [firstIndex, unreadCount, lastReadIndex]
        );
        return latestMessageIndex - lastRead + unread - numWaiting;
    }

    isRead(chatId: string, messageIndex: number, messageId: bigint): boolean {
        if (get(unconfirmed).has(messageId)) {
            return this.waiting[chatId] !== undefined && this.waiting[chatId].has(messageId);
        } else {
            const merged = mergeMessageIndexRanges(
                this.serverState[chatId] ?? [],
                this.state[chatId] ?? []
            );
            return indexIsInRanges(messageIndex, merged);
        }
    }
}

export class FakeMessageReadTracker implements IMessageReadTracker {
    markRangeRead(_chatId: string, _range: MessageIndexRange): void {
        return undefined;
    }

    markMessageRead(_chat: string, _messageIndex: number, _messageId: bigint): void {
        return undefined;
    }

    confirmMessage(_chatId: string, _messageIndex: number, _messageId: bigint): boolean {
        return false;
    }

    syncWithServer(_chatId: string, _ranges: MessageIndexRange[]): void {
        return undefined;
    }

    unreadMessageCount(
        _chatId: string,
        _firstMessageIndex: number,
        _latestMessageIndex: number | undefined
    ): number {
        return 0;
    }

    isRead(_chat: string, _messageIndex: number, _messageId: bigint): boolean {
        return false;
    }

    stop(): void {
        return undefined;
    }

    store = writable<MessageReadState>({
        waiting: {},
        state: {},
        serverState: {},
    });

    subscribe(_sub: Subscriber<MessageReadState>): Unsubscriber {
        return () => undefined;
    }
}
