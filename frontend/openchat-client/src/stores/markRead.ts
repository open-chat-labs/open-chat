import type { Subscriber, Unsubscriber } from "svelte/store";
import {
    chatIdentifierToString,
    type ChatIdentifier,
    type MarkReadRequest,
    type MarkReadResponse,
    type ThreadRead,
    type ThreadSyncDetails,
} from "openchat-shared";
import { unconfirmed } from "./unconfirmed";
import { bigIntMax } from "../utils/bigint";
import type { OpenChat } from "../openchat";

const MARK_READ_INTERVAL = 10 * 1000;

export interface MarkMessagesRead {
    markMessagesRead: (request: MarkReadRequest) => Promise<MarkReadResponse>;
}

export class MessagesRead {
    public readUpTo: number | undefined;
    public threads: Record<number, number>;
    public dateReadPinned: bigint | undefined;

    constructor() {
        this.readUpTo = undefined;
        this.threads = {};
        this.dateReadPinned = undefined;
    }

    get threadsList(): ThreadRead[] {
        return Object.entries(this.threads).map(([threadRootMessageIndex, readUpTo]) => ({
            threadRootMessageIndex: Number(threadRootMessageIndex),
            readUpTo,
        }));
    }

    empty(): boolean {
        return (
            this.readUpTo === undefined &&
            Object.keys(this.threads).length === 0 &&
            this.dateReadPinned === undefined
        );
    }

    markReadUpTo(index: number): void {
        this.readUpTo = Math.max(this.readUpTo ?? 0, index);
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

    markReadPinned(dateReadPinned: bigint | undefined): void {
        this.dateReadPinned = dateReadPinned;
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

    private triggerLoop(api: OpenChat): void {
        this.timeout = window.setTimeout(() => this.sendToServer(api), MARK_READ_INTERVAL);
    }

    start(api: OpenChat): void {
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

    private sendToServer(api: OpenChat): void {
        const req = Object.entries(this.state).reduce<MarkReadRequest>((req, [chatId, data]) => {
            if (!data.empty()) {
                req.push({
                    chatId,
                    readUpTo: data.readUpTo,
                    threads: data.threadsList,
                    dateReadPinned: data.dateReadPinned,
                });
            }
            return req;
        }, [] as MarkReadRequest);

        if (req.length > 0) {
            console.log("Sending messages read to the server: ", JSON.stringify(req));
            api.sendRequest({ kind: "markMessagesRead", payload: req }).finally(() =>
                this.triggerLoop(api)
            );
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

    private stateForId(chatId: ChatIdentifier): MessagesRead {
        const key = chatIdentifierToString(chatId);
        if (!this.state[key]) {
            this.state[key] = new MessagesRead();
        }
        return this.state[key];
    }

    markThreadRead(chatId: ChatIdentifier, threadRootMessageIndex: number, readUpTo: number): void {
        this.stateForId(chatId).updateThread(threadRootMessageIndex, readUpTo);
        this.publish();
    }

    markMessageRead(
        chatId: ChatIdentifier,
        messageIndex: number,
        messageId: bigint | undefined
    ): void {
        const key = chatIdentifierToString(chatId);
        if (!this.state[key]) {
            this.state[key] = new MessagesRead();
        }
        if (messageId !== undefined && unconfirmed.contains(key, messageId)) {
            // if a message is unconfirmed we will just tuck it away until we are told it has been confirmed
            if (this.waiting[key] === undefined) {
                this.waiting[key] = new Map<bigint, number>();
            }
            this.waiting[key].set(messageId, messageIndex);
            this.publish();
        } else {
            // Mark the chat as read up to the new messageIndex
            this.markReadUpTo(chatId, messageIndex);
        }
    }

    markReadUpTo(chatId: ChatIdentifier, to: number): void {
        this.stateForId(chatId).markReadUpTo(to);
        this.publish();
    }

    markPinnedMessagesRead(chatId: ChatIdentifier, dateLastPinned: bigint): void {
        this.stateForId(chatId).markReadPinned(dateLastPinned);
        this.publish();
    }

    confirmMessage(chatId: ChatIdentifier, messageIndex: number, messageId: bigint): boolean {
        // this is called when a message is confirmed so that we can move it from
        // the unconfirmed read to the confirmed read. This means that it will get
        // marked as read on the back end
        if (this.removeUnconfirmedMessage(chatId, messageId)) {
            this.markMessageRead(chatId, messageIndex, messageId);
            return true;
        }
        return false;
    }

    removeUnconfirmedMessage(chatId: ChatIdentifier, messageId: bigint): boolean {
        const key = chatIdentifierToString(chatId);
        return this.waiting[key] !== undefined && this.waiting[key].delete(messageId);
    }

    staleThreadCountForChat(chatId: ChatIdentifier, threads: ThreadSyncDetails[]): number {
        return threads
            .map<number>((thread) => {
                return this.threadReadUpTo(chatId, thread.threadRootMessageIndex) <
                    thread.latestMessageIndex
                    ? 1
                    : 0;
            })
            .reduce((total, n) => total + n, 0);
    }

    threadReadUpTo(chatId: ChatIdentifier, threadRootMessageIndex: number): number {
        const key = chatIdentifierToString(chatId);
        const local = this.state[key]?.threads[threadRootMessageIndex];
        const server = this.serverState[key]?.threads[threadRootMessageIndex];
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
        chatId: ChatIdentifier,
        threadRootMessageIndex: number,
        latestMessageIndex: number
    ): number {
        return latestMessageIndex - this.threadReadUpTo(chatId, threadRootMessageIndex);
    }

    unreadMessageCount(chatId: ChatIdentifier, latestMessageIndex: number | undefined): number {
        const key = chatIdentifierToString(chatId);

        // previewed chats will not exist in this.serverState
        if (latestMessageIndex === undefined || this.serverState[key] === undefined) {
            return 0;
        }

        const readUpToServer = this.serverState[key]?.readUpTo;
        const readUpToLocal = this.state[key]?.readUpTo;

        const readUpToConfirmed = Math.max(readUpToServer ?? -1, readUpToLocal ?? -1);
        const readUnconfirmedCount = this.waiting[key]?.size ?? 0;

        const total = latestMessageIndex - readUpToConfirmed - readUnconfirmedCount;
        return Math.max(total, 0);
    }

    unreadPinned(chatId: ChatIdentifier, dateLastPinned: bigint | undefined): boolean {
        const key = chatIdentifierToString(chatId);
        const readServer = this.serverState[key]?.dateReadPinned ?? BigInt(0);
        const readLocal = this.state[key]?.dateReadPinned ?? BigInt(0);
        const dateReadPinned = bigIntMax(readServer, readLocal);
        return (dateLastPinned ?? BigInt(0)) > dateReadPinned;
    }

    getFirstUnreadMessageIndex(
        chatId: ChatIdentifier,
        latestMessageIndex: number | undefined
    ): number | undefined {
        if (latestMessageIndex === undefined) {
            return undefined;
        }
        const key = chatIdentifierToString(chatId);
        const readUpToServer = this.serverState[key]?.readUpTo;
        const readUpToLocal = this.state[key]?.readUpTo;

        const readUpToConfirmed = Math.max(readUpToServer ?? -1, readUpToLocal ?? -1);

        if (readUpToConfirmed < latestMessageIndex) {
            const readUnconfirmed = this.waiting[key] ?? new Map();
            const unconfirmedMessageIndexes = [...readUnconfirmed.values()];

            for (let i = readUpToConfirmed + 1; i <= latestMessageIndex; i++) {
                if (!unconfirmedMessageIndexes.includes(i)) {
                    return i;
                }
            }
        }
        return undefined;
    }

    syncWithServer(
        chatId: ChatIdentifier,
        readUpTo: number | undefined,
        threads: ThreadRead[],
        dateReadPinned: bigint | undefined
    ): void {
        const key = chatIdentifierToString(chatId);
        const serverState = new MessagesRead();
        serverState.readUpTo = readUpTo;
        serverState.setThreads(threads);
        serverState.markReadPinned(dateReadPinned);
        this.serverState[key] = serverState;

        const state = this.state[key];
        if (state) {
            if (
                readUpTo !== undefined &&
                state.readUpTo !== undefined &&
                state.readUpTo <= readUpTo
            ) {
                state.readUpTo = undefined;
            }

            // for each thread we get from the server
            // remove the corresponding thread data from the client state unless the client state is more recent
            threads.forEach((t) => {
                const readUpTo = state.threads[t.threadRootMessageIndex];
                if (readUpTo !== undefined && readUpTo <= t.readUpTo) {
                    delete state.threads[t.threadRootMessageIndex];
                }
            });

            if (
                dateReadPinned !== undefined &&
                state.dateReadPinned !== undefined &&
                state.dateReadPinned <= dateReadPinned
            ) {
                state.dateReadPinned = undefined;
            }
        }
        this.publish();
    }

    isRead(chatId: ChatIdentifier, messageIndex: number, messageId: bigint | undefined): boolean {
        const key = chatIdentifierToString(chatId);
        if (messageId !== undefined && unconfirmed.contains(key, messageId)) {
            return this.waiting[key] !== undefined && this.waiting[key].has(messageId);
        } else {
            const serverState = this.serverState[key];
            if (serverState?.readUpTo !== undefined && serverState.readUpTo >= messageIndex)
                return true;
            const localState = this.state[key];
            if (localState?.readUpTo !== undefined && localState.readUpTo >= messageIndex)
                return true;
            return false;
        }
    }
}

export const messagesRead = new MessageReadTracker();

export function startMessagesReadTracker(api: OpenChat): void {
    messagesRead.start(api);
}
