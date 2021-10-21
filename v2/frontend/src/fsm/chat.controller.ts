/* eslint-disable @typescript-eslint/no-non-null-assertion */
// let's just try to make something like the chat machine, but just a plain class
// and just see what happens
// the context will be converted to internal state
// the events will be converted to methods
// I suspect it will be half the code and 1000% easier to understand

import { get, Writable } from "svelte/store";
import type {
    ChatEvent,
    ChatSummary,
    EnhancedReplyContext,
    EventsResponse,
    EventWrapper,
    LocalReaction,
    Message,
    MessageContent,
    SendMessageSuccess,
} from "../domain/chat/chat";
import {
    containsReaction,
    createMessage,
    earliestLoadedEventIndex,
    getMinVisibleEventIndex,
    getMinVisibleMessageIndex,
    getNextEventIndex,
    getNextMessageIndex,
    indexRangeForChat,
    latestLoadedEventIndex,
    replaceAffected,
    replaceLocal,
    replaceMessageContent,
    serialiseMessageForRtc,
    setLastMessageOnChat,
    toggleReaction,
    userIdsFromChatSummaries,
    userIdsFromChatSummary,
} from "../domain/chat/chat.utils";
import type { UserSummary } from "../domain/user/user";
import { missingUserIds } from "../domain/user/user.utils";
import { rtcConnectionsManager } from "../domain/webrtc/RtcConnectionsManager";
import type { ServiceContainer } from "../services/serviceContainer";
import { blockedUsers } from "../stores/blockedUsers";
import { chatStore } from "../stores/chat";
import type { MessageReadTracker } from "../stores/markRead";
import { unconfirmed } from "../stores/unconfirmed";
import { userStore } from "../stores/user";
import { overwriteCachedEvents } from "../utils/caching";
import { writable } from "svelte/store";

export class ChatController {
    public events: Writable<EventWrapper<ChatEvent>[]>;
    public focusMessageIndex: Writable<number | undefined>;
    public replyingTo: Writable<EnhancedReplyContext | undefined>;
    public fileToAttach: Writable<MessageContent | undefined>;
    private localReactions: Record<string, LocalReaction[]> = {};
    public editingEvent: Writable<EventWrapper<Message> | undefined>;
    private initialised = false;
    public loading: Writable<boolean>;
    public chat: Writable<ChatSummary>;

    // private sendingMessage?: SendMessageEvent;

    constructor(
        public api: ServiceContainer,
        public user: UserSummary,
        private _chat: ChatSummary,
        private markRead: MessageReadTracker
    ) {
        // todo - lets make it so that *only* the chat controller updates these writable stores
        // then we can keep a local copy of the chat so that we don't have to use get(this.chat)
        // everywhere
        this.events = writable([]);
        this.loading = writable(false);
        this.focusMessageIndex = writable(undefined);
        this.replyingTo = writable(undefined);
        this.fileToAttach = writable(undefined);
        this.editingEvent = writable(undefined);
        this.chat = writable(_chat);
        this.loadPreviousMessages();
    }

    get chatVal(): ChatSummary {
        return get(this.chat);
    }

    get notificationsMuted(): boolean {
        return this.chatVal.notificationsMuted;
    }

    get minVisibleMessageIndex(): number {
        return getMinVisibleMessageIndex(this.chatVal);
    }

    get unreadMessageCount(): number {
        return this.markRead.unreadMessageCount(
            this.chatId,
            this.minVisibleMessageIndex,
            this.chatVal.latestMessage?.event.messageIndex
        );
    }

    get chatId(): string {
        return this.chatVal.chatId;
    }

    get kind(): "direct_chat" | "group_chat" {
        return this.chatVal.kind;
    }

    private upToDate(): boolean {
        const events = get(this.events);
        return (
            events[events.length - 1]?.index >= this.chatVal.latestEventIndex &&
            this.chatVal.latestMessage !== undefined
        );
    }

    private handleEventsResponse(resp: EventsResponse<ChatEvent>): void {
        if (resp === "events_failed") return;

        this.initialised = true;
        this.events.update((events) => {
            return replaceAffected(
                this.chatId,
                replaceLocal(
                    this.user.userId,
                    this.chatId,
                    this.markRead,
                    this.focusMessageIndex === undefined ? events : [],
                    resp.events
                ),
                resp.affectedEvents,
                this.localReactions
            );
        });
    }

    private async loadEventWindow(messageIndex: number) {
        const range = indexRangeForChat(this.chatVal);
        const eventsPromise: Promise<EventsResponse<ChatEvent>> =
            this.chatVal.kind === "direct_chat"
                ? this.api.directChatEventsWindow(range, this.chatVal.them, messageIndex)
                : this.api.groupChatEventsWindow(range, this.chatId, messageIndex);
        const [, eventsResponse] = await Promise.all([this.loadUsersForChat(), eventsPromise]);

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return undefined;
        }

        this.handleEventsResponse(eventsResponse);
    }

    newMessageCriteria(): [number, boolean] | undefined {
        const lastLoaded = latestLoadedEventIndex(get(this.events), get(unconfirmed));
        if (lastLoaded !== undefined && lastLoaded < this.chatVal.latestEventIndex) {
            const from = lastLoaded + 1;
            return [from, true];
        } else {
            // this implies that we have not loaded any messages which should never happen
            return undefined;
        }
    }

    highestUnloadedEventIndex(): number {
        const earliestLoaded = earliestLoadedEventIndex(get(this.events));
        if (earliestLoaded !== undefined) {
            return earliestLoaded - 1; // the one before the first one we *have* loaded
        } else {
            return this.chatVal.latestEventIndex; //or the latest index if we haven't loaded *any*
        }
    }

    previousMessagesCriteria(): [number, boolean] | undefined {
        const start = this.highestUnloadedEventIndex();
        const min = getMinVisibleEventIndex(this.chatVal);
        return start >= min ? [start, false] : undefined;
    }

    loadEvents(startIndex: number, ascending: boolean): Promise<EventsResponse<ChatEvent>> {
        if (this.chatVal.kind === "direct_chat") {
            return this.api.directChatEvents(
                indexRangeForChat(this.chatVal),
                this.chatVal.them,
                startIndex,
                ascending
            );
        }
        return this.api.groupChatEvents(
            indexRangeForChat(this.chatVal),
            this.chatVal.chatId,
            startIndex,
            ascending
        );
    }

    public async loadNewMessages(): Promise<void> {
        this.loading.set(true);
        const criteria = this.newMessageCriteria();

        const [, eventsResponse] = await Promise.all([
            this.loadUsersForChat(),
            criteria ? this.loadEvents(criteria[0], criteria[1]) : undefined,
        ]);

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            this.loading.set(false);
            return undefined;
        }

        this.handleEventsResponse(eventsResponse);

        chatStore.set({
            chatId: this.chatId,
            event: { kind: "loaded_new_messages" },
        });
        this.loading.set(false);
    }

    public async loadPreviousMessages(): Promise<void> {
        this.loading.set(true);
        const criteria = this.previousMessagesCriteria();

        const [, eventsResponse] = await Promise.all([
            this.loadUsersForChat(),
            criteria ? this.loadEvents(criteria[0], criteria[1]) : undefined,
        ]);

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            this.loading.set(false);
            return undefined;
        }

        this.handleEventsResponse(eventsResponse);

        chatStore.set({
            chatId: this.chatId,
            event: { kind: "loaded_previous_messages" },
        });

        this.loading.set(false);
    }

    async loadUsersForChat(): Promise<void> {
        if (this.chatVal.kind === "group_chat") {
            const userIds = userIdsFromChatSummaries([this.chatVal], true);
            const { users } = await this.api.getUsers(
                missingUserIds(get(userStore), userIds),
                BigInt(0) // timestamp irrelevant for missing users
            );
            userStore.addMany(users);
        }
    }

    async sendMessage(messageEvent: EventWrapper<Message>, userId: string): Promise<void> {
        let jumping = false;
        if (!this.upToDate()) {
            jumping = true;
            await this.loadEventWindow(this.chatVal.latestMessage!.event.messageIndex);
        }

        this.replyingTo.set(undefined);
        this.fileToAttach.set(undefined);
        this.editingEvent.set(undefined);
        this.focusMessageIndex.set(undefined);

        if (get(this.editingEvent)) {
            this.events.update((events) => {
                return events.map((e) => {
                    if (
                        e.event.kind === "message" &&
                        e.event.messageId === messageEvent.event.messageId
                    ) {
                        return messageEvent;
                    }
                    return e;
                });
            });
        } else {
            unconfirmed.add(messageEvent.event.messageId);

            // this message may have come in via webrtc
            const sentByMe = userId === this.user.userId;
            if (sentByMe) {
                rtcConnectionsManager.sendMessage(userIdsFromChatSummary(this.chatVal), {
                    kind: "remote_user_sent_message",
                    chatType: this.chatVal.kind,
                    chatId: this.chatId,
                    messageEvent: serialiseMessageForRtc(messageEvent),
                    userId: userId,
                });
                // mark our own messages as read manually since we will not be observing them
                this.markRead.markMessageRead(
                    this.chatId,
                    messageEvent.event.messageIndex,
                    messageEvent.event.messageId
                );
            }
            this.events.update((events) => [...events, messageEvent]);
            this.chat.update((chat) =>
                sentByMe ? setLastMessageOnChat(chat, messageEvent) : chat
            );
            console.log("Eventz: ", get(this.events));
            chatStore.set({
                chatId: this.chatId,
                event: {
                    kind: "sending_message",
                    messageIndex: messageEvent.event.messageIndex,
                    sentByMe,
                    scroll: jumping ? "auto" : "smooth",
                },
            });
        }
    }

    undeleteMessage(message: Message, userId: string): void {
        if (userId === this.user.userId) {
            rtcConnectionsManager.sendMessage(userIdsFromChatSummary(this.chatVal), {
                kind: "remote_user_undeleted_message",
                chatType: this.chatVal.kind,
                chatId: this.chatVal.chatId,
                message: message,
                userId: userId,
            });
        }

        this.events.update((events) =>
            replaceMessageContent(events, BigInt(message.messageId), message.content)
        );
    }

    deleteMessage(messageId: bigint, userId: string): void {
        if (userId === this.user.userId) {
            rtcConnectionsManager.sendMessage(userIdsFromChatSummary(this.chatVal), {
                kind: "remote_user_deleted_message",
                chatType: this.chatVal.kind,
                chatId: this.chatVal.chatId,
                messageId: messageId,
                userId: userId,
            });
        }
        this.events.update((events) =>
            replaceMessageContent(events, BigInt(messageId), {
                kind: "deleted_content",
                deletedBy: userId,
                timestamp: BigInt(+new Date()),
            })
        );
    }

    removeMessage(messageId: bigint, userId: string): void {
        if (userId === this.user.userId) {
            rtcConnectionsManager.sendMessage(userIdsFromChatSummary(this.chatVal), {
                kind: "remote_user_removed_message",
                chatType: this.chatVal.kind,
                chatId: this.chatVal.chatId,
                messageId: messageId,
                userId: userId,
            });
        }
        unconfirmed.delete(messageId);
        this.events.update((events) =>
            events.filter((e) => e.event.kind === "message" && e.event.messageId !== messageId)
        );
    }

    toggleReaction(messageId: bigint, reaction: string, userId: string): void {
        messageId = BigInt(messageId);
        const key = messageId.toString();
        if (this.localReactions[key] === undefined) {
            this.localReactions[key] = [];
        }
        const messageReactions = this.localReactions[key];
        this.events.update((events) =>
            events.map((e) => {
                if (e.event.kind === "message" && e.event.messageId === messageId) {
                    const addOrRemove = containsReaction(userId, reaction, e.event.reactions)
                        ? "remove"
                        : "add";
                    messageReactions.push({
                        reaction,
                        timestamp: +new Date(),
                        kind: addOrRemove,
                        userId,
                    });
                    const updatedEvent = {
                        ...e,
                        event: {
                            ...e.event,
                            reactions: toggleReaction(userId, e.event.reactions, reaction),
                        },
                    };
                    overwriteCachedEvents(this.chatId, [updatedEvent]);
                    if (userId === this.user.userId) {
                        rtcConnectionsManager.sendMessage(userIdsFromChatSummary(this.chatVal), {
                            kind: "remote_user_toggled_reaction",
                            chatType: this.chatVal.kind,
                            chatId: this.chatVal.chatId,
                            messageId,
                            userId,
                            reaction,
                        });
                    }
                    return updatedEvent;
                }
                return e;
            })
        );
    }

    isDirectChatWith(userId: string): boolean {
        return this.chatVal.kind === "direct_chat" && this.chatVal.them === userId;
    }

    isBlockedUser(): boolean {
        return this.chatVal.kind === "direct_chat" && get(blockedUsers).has(this.chatVal.them);
    }

    async goToMessageIndex(messageIndex: number): Promise<void> {
        this.focusMessageIndex.set(messageIndex);
        await this.loadEventWindow(messageIndex);
    }

    chatUpdated(chat: ChatSummary): void {
        this.chat.set(chat);
        chatStore.set({
            chatId: this.chatId,
            event: { kind: "chat_updated" },
        });
    }

    markAllRead(): void {
        const latestMessageIndex = this.chatVal.latestMessage?.event.messageIndex;
        if (latestMessageIndex) {
            this.markRead.markRangeRead(this.chatId, {
                from: getMinVisibleMessageIndex(this.chatVal),
                to: latestMessageIndex,
            });
        }
    }

    cancelReply(): void {
        this.replyingTo.set(undefined);
    }

    getNextMessageIndex(): number {
        return getNextMessageIndex(this.chatVal, get(this.events));
    }

    getNextEventIndex(): number {
        return getNextEventIndex(this.chatVal, get(this.events));
    }

    createMessage(textContent: string | null, fileToAttach: MessageContent | undefined): Message {
        const nextMessageIndex = this.getNextMessageIndex();

        return createMessage(
            this.user.userId,
            nextMessageIndex,
            textContent ?? undefined,
            get(this.replyingTo),
            fileToAttach
        );
    }

    updateMessage(candidate: Message, resp: SendMessageSuccess): void {
        this.events.update((events) =>
            events.map((e) => {
                if (e.event === candidate) {
                    return {
                        event: {
                            ...e.event,
                            messageIndex: resp.messageIndex,
                        },
                        index: resp.eventIndex,
                        timestamp: resp.timestamp,
                    };
                }
                return e;
            })
        );
    }

    attachFile(content: MessageContent): void {
        this.fileToAttach.set(content);
    }

    startTyping(): void {
        rtcConnectionsManager.sendMessage(userIdsFromChatSummary(this.chatVal), {
            kind: "remote_user_typing",
            chatType: this.kind,
            chatId: this.chatId,
            userId: this.user.userId,
        });
    }

    stopTyping(): void {
        rtcConnectionsManager.sendMessage(userIdsFromChatSummary(this.chatVal), {
            kind: "remote_user_stopped_typing",
            chatType: this.kind,
            chatId: this.chatId,
            userId: this.user.userId,
        });
    }

    clearAttachment(): void {
        this.fileToAttach.set(undefined);
    }

    isRead(messageIndex: number, messageId: bigint): boolean {
        return this.markRead.isRead(this.chatId, messageIndex, messageId);
    }

    setFocusMessageIndex(idx: number): void {
        this.focusMessageIndex.set(idx);
    }

    clearFocusMessageIndex(): void {
        this.focusMessageIndex.set(undefined);
    }

    earliestIndex(): number {
        return earliestLoadedEventIndex(get(this.events)) ?? this.chatVal.latestEventIndex;
    }

    morePreviousMessagesAvailable(): boolean {
        return this.earliestIndex() > this.earliestAvailableEventIndex();
    }

    earliestAvailableEventIndex(): number {
        return this.chatVal.kind === "group_chat" ? this.chatVal.minVisibleEventIndex : 0;
    }

    moreNewMessagesAvailable(): boolean {
        const lastLoaded = latestLoadedEventIndex(get(this.events), get(unconfirmed));
        return lastLoaded === undefined || lastLoaded < this.chatVal.latestEventIndex;
    }

    replyTo(context: EnhancedReplyContext): void {
        this.replyingTo.set(context);
    }

    editEvent(event: EventWrapper<Message>): void {
        this.editingEvent.set(event);
        this.fileToAttach.set(
            event.event.content.kind !== "text_content" ? event.event.content : undefined
        );
        this.replyingTo.set(
            event.event.repliesTo && event.event.repliesTo.kind === "rehydrated_reply_context"
                ? {
                      ...event.event.repliesTo,
                      content: event.event.content,
                      sender: get(userStore)[event.event.sender],
                  }
                : undefined
        );
    }
}
