/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { get, Writable } from "svelte/store";
import type {
    AddParticipantsResponse,
    ChatEvent,
    ChatSummary,
    EnhancedReplyContext,
    EventsResponse,
    EventWrapper,
    FullParticipant,
    GroupChatDetails,
    LocalReaction,
    Message,
    MessageContent,
    Participant,
    ParticipantRole,
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
    userIdsFromEvents,
} from "../domain/chat/chat.utils";
import type { UserSummary } from "../domain/user/user";
import { missingUserIds, userIsOnline } from "../domain/user/user.utils";
import { rtcConnectionsManager } from "../domain/webrtc/RtcConnectionsManager";
import type { ServiceContainer } from "../services/serviceContainer";
import { blockedUsers } from "../stores/blockedUsers";
import type { ChatState } from "../stores/chat";
import type { IMessageReadTracker } from "../stores/markRead";
import { unconfirmed } from "../stores/unconfirmed";
import { userStore } from "../stores/user";
import { overwriteCachedEvents } from "../utils/caching";
import { writable } from "svelte/store";
import { rollbar } from "../utils/logging";
import { toastStore } from "../stores/toast";
import type { WebRtcMessage } from "../domain/webrtc/webrtc";

const PRUNE_LOCAL_REACTIONS_INTERVAL = 30 * 1000;
const MAX_RTC_CONNECTIONS_PER_CHAT = 10;

export class ChatController {
    public events: Writable<EventWrapper<ChatEvent>[]>;
    public focusMessageIndex: Writable<number | undefined>;
    public replyingTo: Writable<EnhancedReplyContext | undefined>;
    public fileToAttach: Writable<MessageContent | undefined>;
    public editingEvent: Writable<EventWrapper<Message> | undefined>;
    public chat: Writable<ChatSummary>;
    public chatId: string;
    public participants: Writable<Participant[]>;
    public blockedUsers: Writable<Set<string>>;
    public chatUserIds: Set<string>;
    public loading: Writable<boolean>;

    private localReactions: Record<string, LocalReaction[]> = {};
    private initialised = false;
    private pruneInterval: number | undefined;
    private groupDetails: GroupChatDetails | undefined;
    private onEvent?: (evt: ChatState) => void;
    private maxLoadedEventIndex = 0;

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
        this.participants = writable([]);
        this.blockedUsers = writable(new Set<string>());
        this.chat = writable(_chat);
        this.chatId = _chat.chatId;
        this.chatUserIds = new Set<string>();
        this.maxLoadedEventIndex = _chat.latestEventIndex;

        if (process.env.NODE_ENV !== "test") {
            if (_focusMessageIndex !== undefined) {
                this.loadEventWindow(_focusMessageIndex);
            } else {
                this.loadPreviousMessages();
            }
            this.pruneInterval = window.setInterval(() => {
                this.localReactions = pruneLocalReactions(this.localReactions);
            }, PRUNE_LOCAL_REACTIONS_INTERVAL);
        }
    }

    destroy(): void {
        if (this.pruneInterval !== undefined) {
            console.log("Stopping the local reactions pruner");
            window.clearInterval(this.pruneInterval);
            this.events.set([]);
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

    subscribe(fn: (evt: ChatState) => void): void {
        this.onEvent = fn;
    }

    async loadDetails(): Promise<void> {
        // currently this is only meaningful for group chats, but we'll set it up generically just in case
        if (this.chatVal.kind === "group_chat") {
            if (this.groupDetails === undefined) {
                const resp = await this.api.getGroupDetails(this.chatId);
                if (resp !== "caller_not_in_group") {
                    this.groupDetails = resp;
                    this.participants.set(resp.participants);
                    this.blockedUsers.set(resp.blockedUsers);
                }
                await this.updateUserStore(userIdsFromEvents(get(this.events)));
            } else {
                this.updateDetails();
            }
        }
    }

    async updateDetails(): Promise<void> {
        if (this.chatVal.kind === "group_chat") {
            if (
                this.groupDetails !== undefined &&
                this.groupDetails.latestEventIndex < this.chatVal.latestEventIndex
            ) {
                this.groupDetails = await this.api.getGroupDetailsUpdates(
                    this.chatId,
                    this.groupDetails
                );
                this.participants.set(this.groupDetails.participants);
                this.blockedUsers.set(this.groupDetails.blockedUsers);
                console.log(
                    "loading chat details updated to: ",
                    this.groupDetails.latestEventIndex
                );
            }
            await this.updateUserStore(userIdsFromEvents(get(this.events)));
        }
    }

    private async updateUserStore(userIdsFromEvents: Set<string>): Promise<void> {
        const participantIds = get(this.participants).map((p) => p.userId);
        const blockedIds = [...get(this.blockedUsers)];
        const allUserIds = [...participantIds, ...blockedIds, ...userIdsFromEvents];
        allUserIds.forEach((u) => {
            if (u !== this.user.userId) {
                this.chatUserIds.add(u);
            }
        });

        const resp = await this.api.getUsers(
            missingUserIds(get(userStore), new Set<string>(allUserIds)),
            BigInt(0)
        );

        userStore.addMany(resp.users);
    }

    private upToDate(): boolean {
        const events = get(this.events);
        return (
            (events[events.length - 1]?.index >= this.chatVal.latestEventIndex &&
                this.chatVal.latestMessage !== undefined) ||
            this.chatVal.latestMessage === undefined
        );
    }

    private async handleEventsResponse(resp: EventsResponse<ChatEvent>): Promise<void> {
        if (resp === "events_failed") return;

        this.initialised = true;
        const events = get(this.events);
        const updated = replaceAffected(
            this.chatId,
            replaceLocal(
                this.user.userId,
                this.chatId,
                this.markRead,
                this._chat.readByMe,
                get(this.focusMessageIndex) === undefined ? events : [],
                resp.events
            ),
            resp.affectedEvents,
            this.localReactions
        );

        const userIds = this._chat.kind === "direct_chat"
            ? new Set([this._chat.them])
            : userIdsFromEvents(updated);

        await this.updateUserStore(userIds);
        this.makeRtcConnections(userIds);
        this.events.set(updated);
        this.maxLoadedEventIndex = Math.max(
            updated[updated.length - 1].index,
            this.maxLoadedEventIndex
        );
    }

    private makeRtcConnections(userIds: Set<string>): void {
        // FIXME - this needs some refinement so that the total number of connections
        // does not exceed MAX.
        // we also need to disconnect when the chat is unselected
        const lookup = get(userStore);
        [...userIds]
            .filter((u) => u !== this.user.userId)
            .map((u) => lookup[u])
            .filter((user) => user && userIsOnline(lookup, user.userId))
            .sort((a, b) => b.lastOnline - a.lastOnline)
            .slice(0, MAX_RTC_CONNECTIONS_PER_CHAT)
            .filter((user) => !rtcConnectionsManager.exists(user.userId))
            .map((user) => user.userId)
            .forEach((userId) => {
                rtcConnectionsManager.create(this.user.userId, userId);
            });
    }

    private async loadEventWindow(messageIndex: number) {
        this.loading.set(true);
        const range = indexRangeForChat(this.chatVal);
        const eventsPromise: Promise<EventsResponse<ChatEvent>> =
            this.chatVal.kind === "direct_chat"
                ? this.api.directChatEventsWindow(range, this.chatVal.them, messageIndex)
                : this.api.groupChatEventsWindow(range, this.chatId, messageIndex);
        const eventsResponse = await eventsPromise;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return undefined;
        }

        await this.handleEventsResponse(eventsResponse);
        this.loading.set(false);

        this.raiseEvent({
            chatId: this.chatId,
            event: { kind: "loaded_event_window", messageIndex: messageIndex },
        });
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

    private raiseEvent(evt: ChatState): void {
        if (this.onEvent) {
            this.onEvent(evt);
        }
    }

    public async loadNewMessages(): Promise<void> {
        this.loading.set(true);
        const criteria = this.newMessageCriteria();

        const eventsResponse = criteria
            ? await this.loadEvents(criteria[0], criteria[1])
            : undefined;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            this.loading.set(false);
            return undefined;
        }

        await this.handleEventsResponse(eventsResponse);

        this.raiseEvent({
            chatId: this.chatId,
            event: { kind: "loaded_new_messages" },
        });
        this.loading.set(false);
    }

    public async loadPreviousMessages(): Promise<EventWrapper<ChatEvent>[]> {
        this.loading.set(true);
        const criteria = this.previousMessagesCriteria();
        console.log("loading previous messages: ", criteria);

        const eventsResponse = criteria
            ? await this.loadEvents(criteria[0], criteria[1])
            : undefined;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            this.loading.set(false);
            return [];
        }

        await this.handleEventsResponse(eventsResponse);

        this.raiseEvent({
            chatId: this.chatId,
            event: { kind: "loaded_previous_messages" },
        });

        this.loading.set(false);
        return get(this.events);
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
                rtcConnectionsManager.sendMessage([...this.chatUserIds], {
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
            this.raiseEvent({
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
            rtcConnectionsManager.sendMessage([...this.chatUserIds], {
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
            rtcConnectionsManager.sendMessage([...this.chatUserIds], {
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
                timestamp: BigInt(Date.now()),
            })
        );
    }

    removeMessage(messageId: bigint, userId: string): void {
        if (userId === this.user.userId) {
            rtcConnectionsManager.sendMessage([...this.chatUserIds], {
                kind: "remote_user_removed_message",
                chatType: this.chatVal.kind,
                chatId: this.chatVal.chatId,
                messageId: messageId,
                userId: userId,
            });
        }
        unconfirmed.delete(messageId);
        this.markRead.removeUnconfirmedMessage(this.chatId, messageId);
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
                        timestamp: Date.now(),
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
                        rtcConnectionsManager.sendMessage([...this.chatUserIds], {
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
        return this.loadEventWindow(messageIndex);
    }

    async externalGoToMessage(messageIndex: number): Promise<void> {
        // we just want to raise the event which will trigger the data load
        // *only* if it is actually necessary
        this.raiseEvent({
            chatId: this.chatId,
            event: { kind: "loaded_event_window", messageIndex: messageIndex },
        });
    }

    async chatUpdated(chat: ChatSummary): Promise<void> {
        this.chat.set({
            ...chat,
        });

        this.updateDetails();

        this.raiseEvent({
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

    confirmMessage(candidate: Message, resp: SendMessageSuccess): void {
        if (unconfirmed.delete(candidate.messageId)) {
            this.markRead.confirmMessage(this.chatId, resp.messageIndex, candidate.messageId);
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
    }

    attachFile(content: MessageContent): void {
        this.fileToAttach.set(content);
    }

    startTyping(): void {
        rtcConnectionsManager.sendMessage([...this.chatUserIds], {
            kind: "remote_user_typing",
            chatType: this.kind,
            chatId: this.chatId,
            userId: this.user.userId,
        });
    }

    stopTyping(): void {
        rtcConnectionsManager.sendMessage([...this.chatUserIds], {
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

    viewingEventWindow(): boolean {
        const latestLoaded = latestLoadedEventIndex(get(this.events), get(unconfirmed));
        return latestLoaded !== undefined && latestLoaded < this.maxLoadedEventIndex;
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
        this.participants.update((ps) =>
            ps.map((p) => (p.userId === userId ? { ...p, role: "participant" } : p))
        );
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

    private transferOwnershipLocally(me: string, them: string): void {
        this.participants.update((ps) =>
            ps.map((p) => {
                if (p.userId === them) {
                    return { ...p, role: "owner" };
                }
                if (p.userId === me) {
                    return { ...p, role: "admin" };
                }
                return p;
            })
        );
    }

    private undoTransferOwnershipLocally(
        me: string,
        them: string,
        theirRole: ParticipantRole
    ): void {
        this.participants.update((ps) =>
            ps.map((p) => {
                if (p.userId === them) {
                    return { ...p, role: theirRole };
                }
                if (p.userId === me) {
                    return { ...p, role: "owner" };
                }
                return p;
            })
        );
    }

    transferOwnership(me: string, them: FullParticipant): Promise<boolean> {
        this.transferOwnershipLocally(me, them.userId);
        return this.api
            .transferOwnership(this.chatId, them.userId)
            .then((resp) => {
                if (resp !== "success") {
                    rollbar.warn("Unable to transfer ownership", resp);
                    this.undoTransferOwnershipLocally(me, them.userId, them.role);
                    return false;
                }
                return true;
            })
            .catch((err) => {
                this.undoTransferOwnershipLocally(me, them.userId, them.role);
                rollbar.error("Unable to transfer ownership", err);
                return false;
            });
    }

    deleteGroup(): Promise<boolean> {
        return this.api
            .deleteGroup(this.chatId)
            .then((resp) => {
                if (resp !== "success") {
                    rollbar.warn("Unable to delete group", resp);
                    return false;
                }
                return true;
            })
            .catch((err) => {
                rollbar.error("Unable to delete group", err);
                return false;
            });
    }

    makeAdmin(userId: string): Promise<void> {
        this.participants.update((ps) =>
            ps.map((p) => (p.userId === userId ? { ...p, role: "admin" } : p))
        );
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

    private blockUserLocally(userId: string): void {
        this.blockedUsers.update((b) => b.add(userId));
        this.participants.update((p) => p.filter((p) => p.userId !== userId));
    }

    private unblockUserLocally(userId: string): void {
        this.blockedUsers.update((b) => {
            b.delete(userId);
            return b;
        });
        this.participants.update((p) => [
            ...p,
            {
                role: "participant",
                userId,
                username: get(userStore)[userId]?.username ?? "unknown",
            },
        ]);
    }

    blockUser(userId: string): Promise<void> {
        this.blockUserLocally(userId);
        return this.api
            .blockUserFromGroupChat(this.chatId, userId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("blockUserSucceeded");
                } else {
                    toastStore.showFailureToast("blockUserFailed");
                    this.unblockUserLocally(userId);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("blockUserFailed");
                rollbar.error("Error blocking user", err);
                this.unblockUserLocally(userId);
            });
    }

    private removeParticipantsLocally(
        viaUnblock: boolean,
        users: UserSummary[],
        resp: AddParticipantsResponse | { kind: "unknown" }
    ): void {
        if (resp.kind === "add_participants_success") return;

        let toRemove: string[] = [];
        if (resp.kind === "add_participants_partial_success") {
            toRemove = [
                ...resp.usersAlreadyInGroup,
                ...resp.usersBlockedFromGroup,
                ...resp.usersWhoBlockedRequest,
            ];
        } else {
            toRemove = users.map((u) => u.userId);
        }

        this.participants.update((ps) =>
            ps.filter((p) => {
                !toRemove.includes(p.userId);
            })
        );

        if (viaUnblock) {
            this.blockedUsers.update((b) => {
                return toRemove.reduce((blocked, u) => blocked.add(u), b);
            });
        }
    }

    private addParticipantsLocally(viaUnblock: boolean, users: UserSummary[]): void {
        if (viaUnblock) {
            this.blockedUsers.update((b) => {
                users.forEach((u) => b.delete(u.userId));
                return b;
            });
        }
        this.participants.update((ps) => [
            ...users.map((u) => ({
                userId: u.userId,
                role: "participant" as ParticipantRole,
            })),
            ...ps,
        ]);
    }

    addParticipants(viaUnblock: boolean, users: UserSummary[]): Promise<boolean> {
        this.addParticipantsLocally(viaUnblock, users);
        return this.api
            .addParticipants(
                this.chatId,
                users.map((u) => u.userId),
                this.user.username,
                viaUnblock
            )
            .then((resp) => {
                if (resp.kind === "add_participants_success") {
                    return true;
                } else {
                    this.removeParticipantsLocally(viaUnblock, users, resp);
                    rollbar.warn("AddParticipantsFailed", resp);
                    return false;
                }
            })
            .catch((err) => {
                this.removeParticipantsLocally(viaUnblock, users, { kind: "unknown" });
                rollbar.error("AddParticipantsFailed", err);
                return false;
            });
    }

    unblockUser(userId: string): Promise<void> {
        this.unblockUserLocally(userId);
        return this.api
            .unblockUserFromGroupChat(this.chatId, userId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("unblockUserSucceeded");
                } else {
                    toastStore.showFailureToast("unblockUserFailed");
                    this.blockUserLocally(userId);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("unblockUserFailed");
                rollbar.error("Error unblocking user", err);
                this.blockUserLocally(userId);
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
        if (resp === "avatar_too_big") return "avatagTooBig";
    }

    messageRead(messageIndex: number, messageId: bigint): void {
        this.markRead.markMessageRead(this.chatId, messageIndex, messageId);

        const rtc: WebRtcMessage = {
            kind: "remote_user_read_message",
            chatType: this.kind,
            messageId: messageId,
            chatId: this.chatId,
            userId: this.user.userId,
        };

        rtcConnectionsManager.sendMessage([...this.chatUserIds], rtc);
    }
}
