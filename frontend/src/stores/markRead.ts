import DRange from "drange";
import type { ServiceContainer } from "../services/serviceContainer";
import type { Subscriber, Unsubscriber } from "svelte/store";
import type {
    MarkReadRequest,
    MarkReadResponse,
    ThreadRead,
    ThreadSyncDetails,
} from "../domain/chat/chat";
import { indexIsInRanges } from "../domain/chat/chat.utils";
import { unconfirmed } from "./unconfirmed";

const MARK_READ_INTERVAL = 10 * 1000;

export interface MarkMessagesRead {
    markMessagesRead: (request: MarkReadRequest) => Promise<MarkReadResponse>;
}

export class MessagesRead {
    public ranges: DRange;
    public threads: Record<number, number>;

    constructor() {
        this.ranges = new DRange();
        this.threads = {};
    }

    get threadsList(): ThreadRead[] {
        return Object.entries(this.threads).map(([threadRootMessageIndex, readUpTo]) => ({
            threadRootMessageIndex: Number(threadRootMessageIndex),
            readUpTo,
        }));
    }

    empty(): boolean {
        return this.ranges.length === 0 && Object.keys(this.threads).length === 0;
    }

    addRange(from: number, to?: number): void {
        this.ranges.add(from, to);
    }

    updateThread(rootIndex: number, readUpTo: number): void {
        this.threads[rootIndex] = readUpTo;
    }

    setThreads(threads: ThreadRead[]): void {
        this.threads = threads.reduce((rec, t) => {
            rec[t.threadRootMessageIndex] = t.readUpTo;
            return rec;
        }, {} as Record<number, number>);
    }
}

type MessagesReadByChat = Record<string, MessagesRead>;

export type MessageReadState = {
    serverState: MessagesReadByChat;
    waiting: Record<string, Map<bigint, number>>;
    state: MessagesReadByChat;
};

export class MessageReadTracker {
    private timeout: number | undefined;
    public serverState: MessagesReadByChat = {};

    /**
     * The waiting structure is either keyed on chatId for normal chat messages or
     * of chatId_threadRootMessageIndex for thread messages
     */
    public waiting: Record<string, Map<bigint, number>> = {}; // The map is messageId -> (unconfirmed) messageIndex
    public state: MessagesReadByChat = {};
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

    private triggerLoop(api: ServiceContainer): void {
        this.timeout = window.setTimeout(() => this.sendToServer(api), MARK_READ_INTERVAL);
    }

    start(api: ServiceContainer): void {
        if (process.env.NODE_ENV !== "test") {
            this.triggerLoop(api);
        }
        if (process.env.NODE_ENV !== "test") {
            window.onbeforeunload = () => this.sendToServer(api);
        }
    }

    stop(): void {
        if (this.timeout !== undefined) {
            console.log("stopping the mark read poller");
            window.clearTimeout(this.timeout);
        }
    }

    private sendToServer(api: ServiceContainer): void {
        const req = Object.entries(this.state).reduce<MarkReadRequest>((req, [chatId, data]) => {
            if (!data.empty()) {
                req.push({
                    chatId,
                    ranges: data.ranges,
                    threads: data.threadsList,
                });
            }
            return req;
        }, [] as MarkReadRequest);

        if (req.length > 0) {
            console.log("Sending messages read to the server: ", JSON.stringify(req));
            api.markMessagesRead(req).finally(() => this.triggerLoop(api));
        } else {
            this.triggerLoop(api);
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

    markThreadRead(chatId: string, threadRootMessageIndex: number, readUpTo: number): void {
        if (!this.state[chatId]) {
            this.state[chatId] = new MessagesRead();
        }
        this.state[chatId].updateThread(threadRootMessageIndex, readUpTo);

        this.publish();
    }

    markMessageRead(chatId: string, messageIndex: number, messageId: bigint): void {
        if (!this.state[chatId]) {
            this.state[chatId] = new MessagesRead();
        }
        if (unconfirmed.contains(chatId, messageId)) {
            // if a message is unconfirmed we will just tuck it away until we are told it has been confirmed
            if (this.waiting[chatId] === undefined) {
                this.waiting[chatId] = new Map<bigint, number>();
            }
            this.waiting[chatId].set(messageId, messageIndex);
        } else {
            this.state[chatId].addRange(messageIndex);
        }

        this.publish();
    }

    markRangeRead(chatId: string, from: number, to: number): void {
        if (!this.state[chatId]) {
            this.state[chatId] = new MessagesRead();
        }
        this.state[chatId].addRange(from, to);
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

    staleThreadCountForChat(chatId: string, threads: ThreadSyncDetails[]): number {
        return threads
            .map<number>((thread) => {
                return this.threadReadUpTo(chatId, thread.threadRootMessageIndex) <
                    thread.latestMessageIndex
                    ? 1
                    : 0;
            })
            .reduce((total, n) => total + n, 0);
    }

    threadReadUpTo(chatId: string, threadRootMessageIndex: number): number {
        const local = this.state[chatId]?.threads[threadRootMessageIndex];
        const server = this.serverState[chatId]?.threads[threadRootMessageIndex];
        if (server === undefined) {
            return local ?? -1;
        }
        if (local === undefined) {
            return server ?? -1;
        }
        return Math.max(local, server);
    }

    staleThreadsCount(threads: Record<string, ThreadSyncDetails[]>): number {
        return Object.entries(threads).reduce((total, [chatId, threads]) => {
            const forChat = this.staleThreadCountForChat(chatId, threads);
            return forChat > 0 ? total + forChat : total;
        }, 0);
    }

    unreadThreadMessageCount(
        chatId: string,
        threadRootMessageIndex: number,
        latestMessageIndex: number
    ): number {
        return latestMessageIndex - this.threadReadUpTo(chatId, threadRootMessageIndex);
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
            (this.serverState[chatId]?.ranges?.length ?? 0) +
            (this.state[chatId]?.ranges?.length ?? 0) +
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
        const serverState = this.serverState[chatId]?.ranges;
        if (serverState) unreadMessageIndexes.subtract(serverState);

        // Subtract the confirmed messages marked as read locally
        const localState = this.state[chatId]?.ranges;
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

    syncWithServer(chatId: string, ranges: DRange, threads: ThreadRead[]): void {
        const serverState = new MessagesRead();
        serverState.ranges = ranges;
        serverState.setThreads(threads);
        this.serverState[chatId] = serverState;

        const state = this.state[chatId];
        if (state) {
            state.ranges.subtract(ranges);

            // for each thread we get from the server
            // remove the corresponding thread data from the client state unless the client state is more recent
            threads.forEach((t) => {
                const readUpTo = state.threads[t.threadRootMessageIndex];
                if (readUpTo !== undefined && readUpTo <= t.readUpTo) {
                    delete state.threads[t.threadRootMessageIndex];
                }
            });
        }
        this.publish();
    }

    isRead(chatId: string, messageIndex: number, messageId: bigint): boolean {
        if (unconfirmed.contains(chatId, messageId)) {
            return this.waiting[chatId] !== undefined && this.waiting[chatId].has(messageId);
        } else {
            const serverState = this.serverState[chatId];
            if (serverState && indexIsInRanges(messageIndex, serverState.ranges)) return true;
            const localState = this.state[chatId];
            if (localState && indexIsInRanges(messageIndex, localState.ranges)) return true;
            return false;
        }
    }
}

export const messagesRead = new MessageReadTracker();

export function startMessagesReadTracker(api: ServiceContainer): void {
    messagesRead.start(api);
}
