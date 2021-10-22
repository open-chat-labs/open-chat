/* eslint-disable @typescript-eslint/no-non-null-assertion */

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
    UpdateGroupResponse,
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
    pruneLocalReactions,
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
import type { IMessageReadTracker, MessageReadTracker } from "../stores/markRead";
import { unconfirmed } from "../stores/unconfirmed";
import { userStore } from "../stores/user";
import { overwriteCachedEvents } from "../utils/caching";
import { writable } from "svelte/store";
import { rollbar } from "../utils/logging";
import { toastStore } from "../stores/toast";

const PRUNE_LOCAL_REACTIONS_INTERVAL = 30 * 1000;

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
    public chatId: string;
    private pruneInterval: number | undefined;

    // private sendingMessage?: SendMessageEvent;

    constructor(
        public api: ServiceContainer,
        public user: UserSummary,
        private _chat: ChatSummary,
        public markRead: IMessageReadTracker,
        private _replyingTo: EnhancedReplyContext | undefined,
        private _focusMessageIndex: number | undefined
    ) {
        this.events = writable([]);
        this.loading = writable(false);
        this.focusMessageIndex = writable(_focusMessageIndex);
        this.replyingTo = writable(_replyingTo);
        this.fileToAttach = writable(undefined);
        this.editingEvent = writable(undefined);
        this.chat = writable(_chat);
        this.chatId = _chat.chatId;

        if (process.env.NODE_ENV !== "test") {
            this.loadPreviousMessages();
            this.pruneInterval = window.setInterval(() => {
                this.localReactions = pruneLocalReactions(this.localReactions);
            }, PRUNE_LOCAL_REACTIONS_INTERVAL);
        }
    }

    destroy(): void {
        if (this.pruneInterval !== undefined) {
            window.clearInterval(this.pruneInterval);
        }
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

    get kind(): "direct_chat" | "group_chat" {
        return this.chatVal.kind;
    }

    private upToDate(): boolean {
        const events = get(this.events);
        return (
            (events[events.length - 1]?.index >= this.chatVal.latestEventIndex &&
                this.chatVal.latestMessage !== undefined) ||
            this.chatVal.latestMessage === undefined
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
                    get(this.focusMessageIndex) === undefined ? events : [],
                    resp.events
                ),
                resp.affectedEvents,
                this.localReactions
            );
        });
    }

    private async loadEventWindow(messageIndex: number) {
        this.loading.set(true);
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
        this.loading.set(false);
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
        this.chat.set({
            ...chat,
        });
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

    dismissAsAdmin(userId: string): Promise<void> {
        return this.api
            .dismissAsAdmin(this.chatId, userId)
            .then((resp) => {
                if (resp !== "success") {
                    rollbar.warn("Unable to dismiss as admin", resp);
                    toastStore.showFailureToast("dismissAsAdminFailed");
                }
            })
            .catch((err) => {
                rollbar.error("Unable to dismiss as admin", err);
                toastStore.showFailureToast("dismissAsAdminFailed");
            });
    }

    makeAdmin(userId: string): Promise<void> {
        return this.api
            .makeAdmin(this.chatId, userId)
            .then((resp) => {
                if (resp !== "success") {
                    rollbar.warn("Unable to make admin", resp);
                    toastStore.showFailureToast("makeAdminFailed");
                }
            })
            .catch((err) => {
                rollbar.error("Unable to make admin", err);
                toastStore.showFailureToast("makeAdminFailed");
            });
    }

    removeParticipant(userId: string): Promise<void> {
        return this.api
            .removeParticipant(this.chatId, userId)
            .then((resp) => {
                if (resp !== "success") {
                    rollbar.warn("Unable to remove participant", resp);
                    toastStore.showFailureToast("removeParticipantFailed");
                }
            })
            .catch((err) => {
                rollbar.error("Unable to remove participant", err);
                toastStore.showFailureToast("removeParticipantFailed");
            });
    }

    blockUser(userId: string): Promise<void> {
        return this.api
            .blockUserFromGroupChat(this.chatId, userId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("blockUserSucceeded");
                } else {
                    toastStore.showFailureToast("blockUserFailed");
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("blockUserFailed");
                rollbar.error("Error blocking user", err);
            });
    }

    updateGroup(name: string, desc: string, avatar?: Uint8Array): Promise<boolean> {
        return this.api
            .updateGroup(this.chatId, name, desc, avatar)
            .then((resp) => {
                const err = this.groupUpdateErrorMessage(resp);
                if (err) {
                    toastStore.showFailureToast(err);
                    return false;
                } else {
                    return true;
                }
            })
            .catch((err) => {
                rollbar.error("Update group failed: ", err);
                toastStore.showFailureToast("groupUpdateFailed");
                return false;
            });
    }

    private groupUpdateErrorMessage(resp: UpdateGroupResponse): string | undefined {
        if (resp === "success") return undefined;
        if (resp === "unchanged") return undefined;
        if (resp === "desc_too_long") return "groupDescTooLong";
        if (resp === "internal_error") return "groupUpdateFailed";
        if (resp === "not_authorised") return "groupUpdateFailed";
        if (resp === "name_too_long") return "groupNameTooLong";
        if (resp === "name_taken") return "groupAlreadyExists";
    }
}
