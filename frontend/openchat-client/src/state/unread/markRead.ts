/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    ChatMap,
    MessageContextMap,
    bigIntMax,
    emptyUnreadCounts,
    mergeUnreadCounts,
    type ChatIdentifier,
    type ChatSummary,
    type CombinedUnreadCounts,
    type MarkReadRequest,
    type MarkReadResponse,
    type Mention,
    type MessageContext,
    type ThreadRead,
    type ThreadSyncDetails,
} from "openchat-shared";
import { type Subscriber, type Unsubscriber } from "svelte/store";
import type { OpenChat } from "../../openchat";
import { offlineStore } from "../../stores";
import { withPausedStores, writable } from "../../utils/stores";
import { localUpdates } from "../localUpdates";
import { notEq } from "../utils";

const MARK_READ_INTERVAL = 10 * 1000;

export interface MarkMessagesRead {
    markMessagesRead: (request: MarkReadRequest) => Promise<MarkReadResponse>;
}

export class MessagesRead {
    readUpTo?: number;
    threads = new Map<number, number>();
    dateReadPinned?: bigint;

    get threadsList(): ThreadRead[] {
        return [...this.threads.entries()].map(([threadRootMessageIndex, readUpTo]) => ({
            threadRootMessageIndex: Number(threadRootMessageIndex),
            readUpTo,
        }));
    }

    get empty() {
        return (
            this.readUpTo === undefined &&
            this.threads.size === 0 &&
            this.dateReadPinned === undefined
        );
    }

    markReadUpTo(index: number): void {
        this.readUpTo = Math.max(this.readUpTo ?? 0, index);
    }

    updateThread(rootIndex: number, readUpTo: number): void {
        const current = this.threads.get(rootIndex);
        if (current === undefined || current < readUpTo) {
            this.threads.set(rootIndex, readUpTo);
        }
    }

    setThreads(threads: ThreadRead[]): void {
        this.threads = threads.reduce((rec, t) => {
            rec.set(t.threadRootMessageIndex, t.readUpTo);
            return rec;
        }, new Map<number, number>());
    }

    markReadPinned(dateReadPinned: bigint | undefined): void {
        this.dateReadPinned = dateReadPinned;
    }
}

type MessagesReadByChat = ChatMap<MessagesRead>;

export type MessageReadState = {
    serverState: MessagesReadByChat;
    waiting: MessageContextMap<Map<bigint, number>>;
    state: MessagesReadByChat;
};

/**
 * Let's try to leave this logic alone as much as we can
 * and just focus on converting the actual underlying state to svelte 5 runes
 */
export class MessageReadTracker {
    #timeout: number | undefined;
    #stopped: boolean = false;

    #store = writable<MessageReadState>(
        {
            serverState: new ChatMap<MessagesRead>(),
            waiting: new MessageContextMap<Map<bigint, number>>(),
            state: new ChatMap<MessagesRead>(),
        },
        undefined,
        notEq,
    );

    get dirty() {
        return this.#store.dirty;
    }

    get value() {
        return this.#store.value;
    }

    subscribe(sub: Subscriber<MessageReadState>, invalidate?: () => void) {
        return this.#store.subscribe(sub, invalidate);
    }

    #triggerLoop(api: OpenChat): void {
        if (!this.#stopped) {
            this.#timeout = window.setTimeout(() => this.#sendToServer(api), MARK_READ_INTERVAL);
        }
    }

    start(api: OpenChat): void {
        console.log("starting the mark read poller");
        this.#stopped = false;
        if (import.meta.env.OC_NODE_ENV !== "test") {
            this.#triggerLoop(api);
        }
        if (import.meta.env.OC_NODE_ENV !== "test") {
            window.onbeforeunload = () => this.#sendToServer(api);
        }
    }

    stop(): void {
        console.log("stopping the mark read poller");
        this.#stopped = true;
        if (this.#timeout !== undefined) {
            window.clearTimeout(this.#timeout);
        }
    }

    #sendToServer(api: OpenChat): void {
        const req = this.value.state.reduce<MarkReadRequest>((req, [chatId, data]) => {
            if (!data.empty) {
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
            api.sendMarkReadRequest(req)
                .catch((err) => {
                    console.log("Error calling markMessagesRead", err);
                })
                .finally(() => this.#triggerLoop(api));
        } else {
            this.#triggerLoop(api);
        }
    }

    #stateForId(chatId: ChatIdentifier, state: MessagesReadByChat): MessagesRead {
        if (!state.has(chatId)) {
            state.set(chatId, new MessagesRead());
        }
        return state.get(chatId)!;
    }

    markMessageRead(
        context: MessageContext,
        messageIndex: number,
        messageId: bigint | undefined,
    ): void {
        const { state, waiting } = this.value;
        withPausedStores(() => {
            const chatState = this.#stateForId(context.chatId, state);
            if (messageId !== undefined && localUpdates.isUnconfirmed(context, messageId)) {
                // if a message is unconfirmed we will just tuck it away until we are told it has been confirmed
                if (!waiting.has(context)) {
                    waiting.set(context, new Map<bigint, number>());
                }
                waiting.get(context)?.set(messageId, messageIndex);
            } else if (context.threadRootMessageIndex !== undefined) {
                chatState.updateThread(context.threadRootMessageIndex, messageIndex);
            } else {
                // Mark the chat as read up to the new messageIndex
                chatState.markReadUpTo(messageIndex);
            }
            this.#store.update((s) => ({ ...s, state, waiting }));
        });
    }

    markReadUpTo(context: MessageContext, index: number): void {
        const { state } = this.value;
        const chatState = this.#stateForId(context.chatId, state);
        if (context.threadRootMessageIndex !== undefined) {
            chatState.updateThread(context.threadRootMessageIndex, index);
        } else {
            chatState.markReadUpTo(index);
        }
        this.#store.update((s) => ({ ...s, state }));
    }

    markPinnedMessagesRead(chatId: ChatIdentifier, dateLastPinned: bigint): void {
        const { state } = this.value;
        this.#stateForId(chatId, state).markReadPinned(dateLastPinned);
        this.#store.update((s) => ({ ...s, state }));
    }

    confirmMessage(context: MessageContext, messageIndex: number, messageId: bigint): boolean {
        // this is called when a message is confirmed so that we can move it from
        // the unconfirmed read to the confirmed read. This means that it will get
        // marked as read on the back end
        return withPausedStores(() => {
            if (this.removeUnconfirmedMessage(context, messageId)) {
                this.markMessageRead(context, messageIndex, messageId);
                return true;
            }
            return false;
        });
    }

    removeUnconfirmedMessage(context: MessageContext, messageId: bigint): boolean {
        const { waiting } = this.value;
        const deleted = waiting.get(context)?.delete(messageId) ?? false;
        if (deleted) {
            this.#store.update((s) => ({ ...s, waiting }));
        }
        return deleted;
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
        const { state, serverState, waiting } = this.value;
        const local = state.get(chatId)?.threads.get(threadRootMessageIndex) ?? -1;
        const server = serverState.get(chatId)?.threads.get(threadRootMessageIndex) ?? -1;
        const unconfirmedReadCount = waiting.get({ chatId, threadRootMessageIndex })?.size ?? 0;
        return Math.max(local + unconfirmedReadCount, server);
    }

    staleThreadsCount(threads: ChatMap<ThreadSyncDetails[]>): number {
        return threads.reduce((total, [chatId, threads]) => {
            const forChat = this.staleThreadCountForChat(chatId, threads);
            return forChat > 0 ? total + forChat : total;
        }, 0);
    }

    unreadThreadMessageCount(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number,
        latestMessageIndex: number,
    ): number {
        return Math.max(
            latestMessageIndex - this.threadReadUpTo(chatId, threadRootMessageIndex),
            0,
        );
    }

    unreadMessageCount(chatId: ChatIdentifier, latestMessageIndex: number | undefined): number {
        const { state, serverState, waiting } = this.value;

        // previewed chats will not exist in this.serverState
        if (latestMessageIndex === undefined || !serverState.has(chatId)) {
            return 0;
        }

        const readUpToServer = serverState.get(chatId)?.readUpTo;
        const readUpToLocal = state.get(chatId)?.readUpTo;

        const readUpToConfirmed = Math.max(readUpToServer ?? -1, readUpToLocal ?? -1);
        const readUnconfirmedCount = waiting.get({ chatId })?.size ?? 0;

        const total = latestMessageIndex - readUpToConfirmed - readUnconfirmedCount;
        return Math.max(total, 0);
    }

    unreadPinned(chatId: ChatIdentifier, dateLastPinned: bigint | undefined): boolean {
        const { state, serverState } = this.value;
        const readServer = serverState.get(chatId)?.dateReadPinned ?? BigInt(0);
        const readLocal = state.get(chatId)?.dateReadPinned ?? BigInt(0);
        const dateReadPinned = bigIntMax(readServer, readLocal);
        return (dateLastPinned ?? BigInt(0)) > dateReadPinned;
    }

    getFirstUnreadMessageIndex(
        chatId: ChatIdentifier,
        latestMessageIndex: number | undefined,
    ): number | undefined {
        if (latestMessageIndex === undefined) {
            return undefined;
        }

        const { state, serverState, waiting } = this.value;
        const readUpToServer = serverState.get(chatId)?.readUpTo;
        const readUpToLocal = state.get(chatId)?.readUpTo;

        const readUpToConfirmed = Math.max(readUpToServer ?? -1, readUpToLocal ?? -1);

        if (readUpToConfirmed < latestMessageIndex) {
            const readUnconfirmed = waiting.get({ chatId }) ?? new Map();
            const unconfirmedMessageIndexes = [...readUnconfirmed.values()];

            for (let i = readUpToConfirmed + 1; i <= latestMessageIndex; i++) {
                if (!unconfirmedMessageIndexes.includes(i)) {
                    return i;
                }
            }
        }
        return undefined;
    }

    getFirstUnreadMention(chat: ChatSummary): Mention | undefined {
        return chat.membership.mentions.find(
            (m) => !this.isRead({ chatId: chat.id }, m.messageIndex, m.messageId),
        );
    }

    markAllRead(chat: ChatSummary) {
        withPausedStores(() => {
            const latestMessageIndex = chat.latestMessage?.event.messageIndex;
            if (latestMessageIndex !== undefined) {
                if (!this.isRead({ chatId: chat.id }, latestMessageIndex, undefined)) {
                    this.markReadUpTo({ chatId: chat.id }, latestMessageIndex);
                }

                if (chat.kind !== "direct_chat") {
                    for (const thread of chat.membership.latestThreads) {
                        const context = {
                            chatId: chat.id,
                            threadRootMessageIndex: thread.threadRootMessageIndex,
                        };
                        if (!this.isRead(context, thread.latestMessageIndex, undefined)) {
                            this.markReadUpTo(context, thread.latestMessageIndex);
                        }
                    }
                }
            }
        });
    }

    syncWithServer(
        chatId: ChatIdentifier,
        readUpTo: number | undefined,
        threads: ThreadRead[],
        dateReadPinned: bigint | undefined,
    ): void {
        const { state } = this.value;
        const serverState = new MessagesRead();
        serverState.readUpTo = readUpTo;
        serverState.setThreads(threads);
        serverState.markReadPinned(dateReadPinned);

        const chatState = state.get(chatId);
        if (chatState) {
            if (
                readUpTo !== undefined &&
                chatState.readUpTo !== undefined &&
                chatState.readUpTo <= readUpTo
            ) {
                chatState.readUpTo = undefined;
            }

            // for each thread we get from the server
            // remove the corresponding thread data from the client state unless the client state is more recent
            threads.forEach((t) => {
                const readUpTo = chatState.threads.get(t.threadRootMessageIndex);
                if (readUpTo !== undefined && readUpTo <= t.readUpTo) {
                    chatState.threads.delete(t.threadRootMessageIndex);
                }
            });

            if (
                dateReadPinned !== undefined &&
                chatState.dateReadPinned !== undefined &&
                chatState.dateReadPinned <= dateReadPinned
            ) {
                chatState.dateReadPinned = undefined;
            }
        }
        this.#store.update((s) => {
            s.serverState.set(chatId, serverState);
            if (chatState !== undefined) {
                s.state.set(chatId, chatState);
            }
            return s;
        });
    }

    isRead(context: MessageContext, messageIndex: number, messageId: bigint | undefined): boolean {
        const { state, serverState, waiting } = this.value;
        if (messageId !== undefined && localUpdates.isUnconfirmed(context, messageId)) {
            return waiting.get(context)?.has(messageId) ?? false;
        } else if (messageId !== undefined && localUpdates.isEphemeral(context, messageId)) {
            return true;
        } else if (context.threadRootMessageIndex !== undefined) {
            const serverStateForChat = serverState.get(context.chatId);
            if (
                (serverStateForChat?.threads.get(context.threadRootMessageIndex) ?? -1) >=
                messageIndex
            )
                return true;
            const localStateForChat = state.get(context.chatId);
            if (
                (localStateForChat?.threads.get(context.threadRootMessageIndex) ?? -1) >=
                messageIndex
            )
                return true;
        } else {
            const serverStateForChat = serverState.get(context.chatId);
            if (
                serverStateForChat?.readUpTo !== undefined &&
                serverStateForChat.readUpTo >= messageIndex
            )
                return true;
            const localStateForChat = state.get(context.chatId);
            if (
                localStateForChat?.readUpTo !== undefined &&
                localStateForChat.readUpTo >= messageIndex
            )
                return true;
        }
        return false;
    }

    combinedUnreadCountForChats(chats: ChatMap<ChatSummary>): CombinedUnreadCounts {
        return chats.reduce(
            (counts, [id, chat]) => {
                if (chat === undefined) return counts;

                const muted = chat.membership.notificationsMuted;
                const unreadMessages = this.unreadMessageCount(
                    id,
                    chat.latestMessage?.event.messageIndex,
                );
                const mentions = unreadMessages > 0 && this.#hasUnreadMentions(chat);
                const unreadThreads = this.staleThreadCountForChat(
                    id,
                    chat.membership.latestThreads,
                );
                return {
                    chats: mergeUnreadCounts(unreadMessages, muted, mentions, counts.chats),
                    threads: mergeUnreadCounts(
                        unreadThreads,
                        muted,
                        false,
                        counts.threads,
                        unreadThreads,
                    ),
                };
            },
            {
                chats: emptyUnreadCounts(),
                threads: emptyUnreadCounts(),
            } as CombinedUnreadCounts,
        );
    }

    #hasUnreadMentions(chat: ChatSummary): boolean {
        if (chat.kind === "direct_chat") return false;
        return (
            chat.membership.mentions.filter(
                (m) => !this.isRead({ chatId: chat.id }, m.messageIndex, m.messageId),
            ).length > 0
        );
    }
}

export const messagesRead = new MessageReadTracker();

let networkUnsub: Unsubscriber | undefined;

export function startMessagesReadTracker(api: OpenChat): void {
    if (networkUnsub !== undefined) {
        networkUnsub();
    }
    networkUnsub = offlineStore.subscribe((offline) => {
        if (offline) {
            messagesRead.stop();
        } else {
            messagesRead.start(api);
        }
    });
}
