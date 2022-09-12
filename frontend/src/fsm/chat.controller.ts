/* eslint-disable @typescript-eslint/no-non-null-assertion */
import DRange from "drange";
import { derived, get, readable, Readable, Writable } from "svelte/store";
import type {
    AddMembersResponse,
    ChatEvent,
    ChatSummary,
    EnhancedReplyContext,
    EventsResponse,
    EventsSuccessResult,
    EventWrapper,
    FullMember,
    GroupChatDetails,
    Message,
    MessageContent,
    MemberRole,
    SendMessageSuccess,
    TransferSuccess,
} from "../domain/chat/chat";
import {
    createMessage,
    getMinVisibleMessageIndex,
    getNextEventIndex,
    getNextMessageIndex,
    indexRangeForChat,
    replaceAffected,
    replaceLocal,
    serialiseMessageForRtc,
    userIdsFromEvents,
    mergeSendMessageResponse,
    makeRtcConnections,
    upToDate,
    markAllRead,
} from "../domain/chat/chat.utils";
import type { UserSummary } from "../domain/user/user";
import { missingUserIds } from "../domain/user/user.utils";
import { rtcConnectionsManager } from "../domain/webrtc/RtcConnectionsManager";
import type { ServiceContainer } from "../services/serviceContainer";
import { blockedUsers } from "../stores/blockedUsers";
import { ChatState, chatSummariesStore, currentChatMembers, serverEventsStore } from "../stores/chat";
import { draftMessages } from "../stores/draftMessages";
import { unconfirmed } from "../stores/unconfirmed";
import { userStore } from "../stores/user";
import { findLast } from "../utils/list";
import { rollbar } from "../utils/logging";
import { indexIsInRanges } from "../utils/range";
import { toastStore } from "../stores/toast";
import type { WebRtcMessage } from "../domain/webrtc/webrtc";
import { immutableStore } from "../stores/immutable";
import { messagesRead } from "../stores/markRead";
import { isPreviewing } from "../domain/chat/chat.utils.shared";
import { eventsStore, focusMessageIndex } from "../stores/chat";
import { localMessageUpdates } from "../stores/localMessageUpdates";

export class ChatController {
    public chat: Readable<ChatSummary>;
    public textContent: Readable<string | undefined>;
    public replyingTo: Readable<EnhancedReplyContext | undefined>;
    public fileToAttach: Readable<MessageContent | undefined>;
    public editingEvent: Readable<EventWrapper<Message> | undefined>;
    public chatId: string;
    public blockedUsers: Writable<Set<string>>;
    public pinnedMessages: Writable<Set<number>>;
    public chatUserIds: Set<string>;

    private initialised = false;
    private groupDetails: GroupChatDetails | undefined;
    private onEvent?: (evt: ChatState) => void;
    private confirmedEventIndexesLoaded = new DRange();

    // This set will contain 1 key for each rendered user event group which is used as that group's key
    private userGroupKeys = new Set<string>();

    constructor(
        public api: ServiceContainer,
        public user: UserSummary,
        private serverChatSummary: Readable<ChatSummary>,
        private _focusMessageIndex: number | undefined,
        private _focusThreadMessageIndex: number | undefined,
        private _updateSummaryWithConfirmedMessage: (message: EventWrapper<Message>) => void
    ) {
        this.chat = derived(chatSummariesStore, (chatSummaries) => chatSummaries[get(serverChatSummary).chatId]);

        const chat = get(this.chat);
        serverEventsStore.set(chat.chatId, unconfirmed.getMessages(chat.chatId));
        focusMessageIndex.set(chat.chatId, _focusMessageIndex);
        currentChatMembers.set(chat.chatId, []);
        this.blockedUsers = immutableStore(new Set<string>());
        this.pinnedMessages = immutableStore(new Set<number>());
        this.chatId = chat.chatId;
        // If this is a group chat, chatUserIds will be populated when processing the chat events
        this.chatUserIds = new Set<string>(chat.kind === "direct_chat" ? [chat.chatId] : []);
        const draftMessage = readable(draftMessages.get(chat.chatId), (set) =>
            draftMessages.subscribe((d) => set(d[chat.chatId] ?? {}))
        );
        this.textContent = derived(draftMessage, (d) => d.textContent);
        this.replyingTo = derived(draftMessage, (d) => d.replyingTo);
        this.fileToAttach = derived(draftMessage, (d) => d.attachment);
        this.editingEvent = derived(draftMessage, (d) => d.editingEvent);

        if (process.env.NODE_ENV !== "test") {
            if (_focusMessageIndex !== undefined) {
                this.loadEventWindow(_focusMessageIndex);
            } else {
                this.loadPreviousMessages();
            }
            this.loadDetails();
        }
    }

    destroy(): void {
        serverEventsStore.clear(this.chatId);
        focusMessageIndex.clear(this.chatId);
        currentChatMembers.clear(this.chatId);
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
        if (isPreviewing(this.chatVal)) return 0;

        return messagesRead.unreadMessageCount(
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

    private async loadDetails(): Promise<void> {
        // currently this is only meaningful for group chats, but we'll set it up generically just in case
        if (this.chatVal.kind === "group_chat") {
            if (this.groupDetails === undefined) {
                const resp = await this.api.getGroupDetails(
                    this.chatId,
                    this.chatVal.latestEventIndex
                );
                if (resp !== "caller_not_in_group") {
                    this.groupDetails = resp;
                    currentChatMembers.set(this.chatId, resp.members);
                    this.blockedUsers.set(resp.blockedUsers);
                    this.pinnedMessages.set(resp.pinnedMessages);
                }
                await this.updateUserStore(userIdsFromEvents(get(eventsStore)));
            } else {
                await this.updateDetails();
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
                currentChatMembers.set(this.chatId, this.groupDetails.members);
                this.blockedUsers.set(this.groupDetails.blockedUsers);
                this.pinnedMessages.set(this.groupDetails.pinnedMessages);
                await this.updateUserStore(userIdsFromEvents(get(eventsStore)));
            }
        }
    }

    private addPinnedMessage(messageIndex: number): void {
        this.pinnedMessages.update((s) => {
            s.add(messageIndex);
            return new Set(s);
        });
    }

    private removePinnedMessage(messageIndex: number): void {
        this.pinnedMessages.update((s) => {
            s.delete(messageIndex);
            return new Set(s);
        });
    }

    registerPollVote(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        messageIndex: number,
        answerIndex: number,
        type: "register" | "delete"
    ): void {
        localMessageUpdates.markPollVote(messageId.toString(), {
            answerIndex,
            type,
            userId: this.user.userId
        });

        this.api
            .registerPollVote(this.chatVal.chatId, messageIndex, answerIndex, type, threadRootMessageIndex)
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast("poll.voteFailed");
                    rollbar.error("Poll vote failed: ", resp);
                    console.log("poll vote failed: ", resp);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("poll.voteFailed");
                rollbar.error("Poll vote failed: ", err);
                console.log("poll vote failed: ", err);
            });
    }

    unpinMessage(messageIndex: number): void {
        if (this.chatVal.kind === "group_chat") {
            this.removePinnedMessage(messageIndex);
            this.api
                .unpinMessage(this.chatId, messageIndex)
                .then((resp) => {
                    if (resp !== "success" && resp !== "no_change") {
                        toastStore.showFailureToast("unpinMessageFailed");
                        rollbar.error("Unpin message failed: ", resp);
                        this.addPinnedMessage(messageIndex);
                    }
                })
                .catch((err) => {
                    toastStore.showFailureToast("unpinMessageFailed");
                    rollbar.error("Unpin message failed: ", err);
                    this.addPinnedMessage(messageIndex);
                });
        }
    }

    pinMessage(messageIndex: number): void {
        if (this.chatVal.kind === "group_chat") {
            this.addPinnedMessage(messageIndex);
            this.api
                .pinMessage(this.chatId, messageIndex)
                .then((resp) => {
                    if (resp !== "success" && resp !== "no_change") {
                        toastStore.showFailureToast("pinMessageFailed");
                        rollbar.error("Pin message failed: ", resp);
                        this.removePinnedMessage(messageIndex);
                    }
                })
                .catch((err) => {
                    toastStore.showFailureToast("pinMessageFailed");
                    rollbar.error("Pin message failed: ", err);
                    this.removePinnedMessage(messageIndex);
                });
        }
    }

    async updateUserStore(userIdsFromEvents: Set<string>): Promise<void> {
        const members = get(currentChatMembers);
        console.log("members: ", members);
        const memberIds = members.map((p) => p.userId);
        const blockedIds = [...get(this.blockedUsers)];
        const allUserIds = [...memberIds, ...blockedIds, ...userIdsFromEvents];
        allUserIds.forEach((u) => {
            if (u !== this.user.userId) {
                this.chatUserIds.add(u);
            }
        });

        const resp = await this.api.getUsers(
            {
                userGroups: [
                    {
                        users: missingUserIds(get(userStore), new Set<string>(allUserIds)),
                        updatedSince: BigInt(0),
                    },
                ],
            },
            true
        );

        userStore.addMany(resp.users);
    }

    private async handleEventsResponse(
        resp: EventsResponse<ChatEvent>,
        keepCurrentEvents = true
    ): Promise<void> {
        if (resp === "events_failed") return;

        this.initialised = true;
        const events = get(eventsStore);
        const chat = get(this.chat);
        if (!keepCurrentEvents) {
            this.confirmedEventIndexesLoaded = new DRange();
            this.userGroupKeys.clear();
        } else if (!this.isContiguous(resp)) {
            return;
        }

        const updated = replaceAffected(
            replaceLocal(
                this.user.userId,
                this.chatId,
                chat.readByMe,
                keepCurrentEvents ? events : [],
                resp.events
            ),
            resp.affectedEvents
        );

        const userIds = userIdsFromEvents(updated);
        await this.updateUserStore(userIds);

        serverEventsStore.set(this.chatId, updated);

        if (resp.events.length > 0) {
            resp.events.forEach((e) => this.confirmedEventIndexesLoaded.add(e.index));
        }

        makeRtcConnections(this.user.userId, this.chatVal, updated, get(userStore));
    }

    private async loadEventWindow(messageIndex: number, preserveFocus = false) {
        if (messageIndex >= 0) {
            const range = indexRangeForChat(get(this.serverChatSummary));
            const chat = this.chatVal;
            const eventsPromise: Promise<EventsResponse<ChatEvent>> =
                chat.kind === "direct_chat"
                    ? this.api.directChatEventsWindow(
                          range,
                          chat.them,
                          messageIndex,
                          chat.latestEventIndex
                      )
                    : this.api.groupChatEventsWindow(
                          range,
                          this.chatId,
                          messageIndex,
                          chat.latestEventIndex
                      );
            const eventsResponse = await eventsPromise;

            if (eventsResponse === undefined || eventsResponse === "events_failed") {
                return undefined;
            }

            await this.handleEventsResponse(eventsResponse, false);
        }

        this.raiseEvent({
            chatId: this.chatId,
            event: {
                kind: "loaded_event_window",
                focusThreadMessageIndex: this._focusThreadMessageIndex,
                messageIndex: messageIndex,
                preserveFocus,
                allowRecursion: false,
            },
        });
    }

    newMessageCriteria(): [number, boolean] | undefined {
        const maxServerEventIndex = this.latestServerEventIndex();
        const loadedUpTo = this.confirmedUpToEventIndex();

        return loadedUpTo < maxServerEventIndex ? [loadedUpTo + 1, true] : undefined;
    }

    previousMessagesCriteria(): [number, boolean] | undefined {
        const minLoadedEventIndex = this.earliestLoadedIndex();
        if (minLoadedEventIndex === undefined) {
            return [this.latestServerEventIndex(), false];
        }
        const minVisibleEventIndex = this.earliestAvailableEventIndex();
        return minLoadedEventIndex !== undefined && minLoadedEventIndex > minVisibleEventIndex
            ? [minLoadedEventIndex - 1, false]
            : undefined;
    }

    loadEvents(startIndex: number, ascending: boolean): Promise<EventsResponse<ChatEvent>> {
        const chat = this.chatVal;
        return this.api.chatEvents(
            chat,
            indexRangeForChat(get(this.serverChatSummary)),
            startIndex,
            ascending,
            undefined,
            chat.latestEventIndex
        );
    }

    private raiseEvent(evt: ChatState): void {
        if (this.onEvent) {
            this.onEvent(evt);
        }
    }

    public async loadNewMessages(): Promise<void> {
        const criteria = this.newMessageCriteria();

        const eventsResponse = criteria
            ? await this.loadEvents(criteria[0], criteria[1])
            : undefined;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return undefined;
        }

        await this.handleEventsResponse(eventsResponse);

        // We may have loaded messages which are more recent than what the chat summary thinks is the latest message,
        // if so, we update the chat summary to show the correct latest message.
        const latestMessage = findLast(eventsResponse.events, (e) => e.event.kind === "message");
        const newLatestMessage =
            latestMessage !== undefined && latestMessage.index > this.latestServerEventIndex();

        if (newLatestMessage) {
            this._updateSummaryWithConfirmedMessage(latestMessage as EventWrapper<Message>);
        }

        this.raiseEvent({
            chatId: this.chatId,
            event: { kind: "loaded_new_events", newLatestMessage },
        });
    }

    public async loadPreviousMessages(): Promise<void> {
        const criteria = this.previousMessagesCriteria();

        const eventsResponse = criteria
            ? await this.loadEvents(criteria[0], criteria[1])
            : undefined;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return;
        }

        await this.handleEventsResponse(eventsResponse);

        this.raiseEvent({
            chatId: this.chatId,
            event: { kind: "loaded_previous_events" },
        });

        return;
    }

    async sendMessage(messageEvent: EventWrapper<Message>): Promise<void> {
        let jumping = false;
        if (!upToDate(this.chatVal, get(eventsStore))) {
            jumping = true;
            await this.loadEventWindow(this.chatVal.latestMessage!.event.messageIndex);
        }

        unconfirmed.add(this.chatId, messageEvent);
        rtcConnectionsManager.sendMessage([...this.chatUserIds], {
            kind: "remote_user_sent_message",
            chatType: this.chatVal.kind,
            chatId: this.chatId,
            messageEvent: serialiseMessageForRtc(messageEvent),
            userId: this.user.userId,
        });

        // mark our own messages as read manually since we will not be observing them
        messagesRead.markMessageRead(
            this.chatId,
            messageEvent.event.messageIndex,
            messageEvent.event.messageId
        );
        this.appendMessage(messageEvent);
        this.raiseEvent({
            chatId: this.chatId,
            event: {
                kind: "sending_message",
                scroll: jumping ? "auto" : "smooth",
            },
        });

        draftMessages.delete(this.chatId);
    }

    async editMessage(msg: Message, threadRootMessageIndex: number | undefined): Promise<void> {
        localMessageUpdates.markContentEdited(msg.messageId.toString(), msg.content);

        if (threadRootMessageIndex === undefined) {
            draftMessages.delete(this.chatId);
        }

        return this.api.editMessage(this.chatVal, msg, threadRootMessageIndex)
            .then((resp) => {
                if (resp !== "success") {
                    rollbar.warn("Error response editing", resp);
                    toastStore.showFailureToast("errorEditingMessage");
                    localMessageUpdates.revertEditedContent(msg.messageId.toString());
                }
            })
            .catch((err) => {
                rollbar.error("Exception sending message", err);
                toastStore.showFailureToast("errorEditingMessage");
                localMessageUpdates.revertEditedContent(msg.messageId.toString());
            });
    }

    public selectReaction(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        reaction: string,
        kind: "add" | "remove"
    ): Promise<boolean> {
        const userId = this.user.userId;

        localMessageUpdates.markReaction(messageId.toString(), {
            reaction,
            kind,
            userId
        });

        function undoLocally() {
            localMessageUpdates.markReaction(messageId.toString(), {
                reaction,
                kind: kind === "add" ? "remove" : "add",
                userId
            });
        }

        return (this.chatVal.kind === "direct_chat"
            ? this.api.toggleDirectChatReaction(this.chatId, messageId, reaction, threadRootMessageIndex)
            : this.api.toggleGroupChatReaction(this.chatId, messageId, reaction, threadRootMessageIndex))
            .then((resp) => {
                if (resp !== "added" && resp !== "removed") {
                    undoLocally();
                    return false;
                }
                return true;
            })
            .catch(_ => {
                undoLocally();
                return false;
            });
    }

    // This could be a message received in an `updates` response, from a notification, or via WebRTC.
    handleMessageSentByOther(messageEvent: EventWrapper<Message>, confirmed: boolean): void {
        if (indexIsInRanges(messageEvent.index, this.confirmedEventIndexesLoaded)) {
            // We already have this confirmed message
            return;
        }

        if (confirmed) {
            const isAdjacentToAlreadyLoadedEvents =
                indexIsInRanges(messageEvent.index - 1, this.confirmedEventIndexesLoaded) ||
                indexIsInRanges(messageEvent.index + 1, this.confirmedEventIndexesLoaded);

            if (!isAdjacentToAlreadyLoadedEvents) {
                return;
            }

            this.handleEventsResponse({
                events: [messageEvent],
                affectedEvents: [],
                latestEventIndex: undefined,
            });
        } else {
            if (!upToDate(this.chatVal, get(eventsStore))) {
                return;
            }

            // If it is unconfirmed then we simply append it
            if (this.appendMessage(messageEvent)) {
                unconfirmed.add(this.chatId, messageEvent);
            }
        }

        this.raiseEvent({
            chatId: this.chatId,
            event: {
                kind: "loaded_new_events",
                newLatestMessage: true,
            },
        });
    }

    appendMessage(message: EventWrapper<Message>): boolean {
        const existing = get(eventsStore)
            .find(
                (ev) =>
                    ev.event.kind === "message" && ev.event.messageId === message.event.messageId
            );

        if (existing !== undefined) return false;

        serverEventsStore.update(this.chatId, (events) => [...events, message]);
        return true;
    }

    deleteMessage(threadRootMessageIndex: number | undefined, messageId: bigint): Promise<boolean> {
        const messageIdString = messageId.toString();
        const userId = this.user.userId;

        localMessageUpdates.markDeleted(messageIdString, userId);

        const recipients = [...this.chatUserIds];
        const chat = this.chatVal;
        const chatType = chat.kind;
        const chatId = chat.chatId;

        rtcConnectionsManager.sendMessage(recipients, {
            kind: "remote_user_deleted_message",
            chatType,
            chatId,
            messageId,
            userId,
            threadRootMessageIndex
        });

        function undelete() {
            rtcConnectionsManager.sendMessage(recipients, {
                kind: "remote_user_undeleted_message",
                chatType,
                chatId,
                messageId,
                userId,
                threadRootMessageIndex
            });
            localMessageUpdates.markUndeleted(messageIdString);
        }

        return this.api.deleteMessage(chat, messageId, threadRootMessageIndex)
            .then((resp) => {
                const success = resp === "success";
                if (!success) {
                    undelete();
                }
                return success;
            })
            .catch(_ => {
                undelete();
                return false;
            });
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
        unconfirmed.delete(this.chatId, messageId);
        messagesRead.removeUnconfirmedMessage(this.chatId, messageId);
        serverEventsStore.update(this.chatId, (events) =>
            events.filter((e) => e.event.kind === "message" && e.event.messageId !== messageId)
        );
    }

    isDirectChatWith(userId: string): boolean {
        return this.chatVal.kind === "direct_chat" && this.chatVal.them === userId;
    }

    isBlockedUser(): boolean {
        return this.chatVal.kind === "direct_chat" && get(blockedUsers).has(this.chatVal.them);
    }

    async goToMessageIndex(
        messageIndex: number,
        preserveFocus: boolean,
        focusThreadMessageIndex?: number
    ): Promise<void> {
        this._focusThreadMessageIndex = focusThreadMessageIndex;
        return this.loadEventWindow(messageIndex, preserveFocus);
    }

    async externalGoToMessage(messageIndex: number): Promise<void> {
        // we just want to raise the event which will trigger the data load
        // *only* if it is actually necessary
        this.raiseEvent({
            chatId: this.chatId,
            event: {
                kind: "loaded_event_window",
                focusThreadMessageIndex: undefined,
                messageIndex: messageIndex,
                preserveFocus: false,
                allowRecursion: true,
            },
        });
    }

    chatUpdated(affectedEvents: number[]): void {
        // The chat summary has been updated which means the latest message may be new
        const latestMessage = this.chatVal.latestMessage;
        if (latestMessage !== undefined && latestMessage.event.sender !== this.user.userId) {
            this.handleMessageSentByOther(latestMessage, true);
        }

        this.refreshAffectedEvents(affectedEvents);
        this.updateDetails();

        this.raiseEvent({
            chatId: this.chatId,
            event: { kind: "chat_updated" },
        });
    }

    // This will refresh any affected events which are currently loaded
    private refreshAffectedEvents(affectedEventIndexes: number[]): Promise<void> {
        const filtered = affectedEventIndexes.filter((e) =>
            indexIsInRanges(e, this.confirmedEventIndexesLoaded)
        );
        if (filtered.length === 0) {
            return Promise.resolve();
        }

        const chat = this.chatVal;
        const eventsPromise =
            chat.kind === "direct_chat"
                ? this.api.directChatEventsByEventIndex(
                      chat.them,
                      filtered,
                      undefined,
                      chat.latestEventIndex
                  )
                : this.api.groupChatEventsByEventIndex(
                      chat.chatId,
                      filtered,
                      undefined,
                      chat.latestEventIndex
                  );

        return eventsPromise.then((resp) => this.handleEventsResponse(resp));
    }

    markAllRead(): void {
        markAllRead(this.chatVal);
    }

    setTextContent(text: string | undefined): void {
        draftMessages.setTextContent(this.chatId, text);
    }

    cancelReply(): void {
        draftMessages.setReplyingTo(this.chatId, undefined);
    }

    getNextMessageIndex(): number {
        return getNextMessageIndex(
            get(this.serverChatSummary),
            unconfirmed.getMessages(this.chatId)
        );
    }

    getNextEventIndex(): number {
        return getNextEventIndex(get(this.serverChatSummary), unconfirmed.getMessages(this.chatId));
    }

    createMessage(
        textContent: string | undefined,
        fileToAttach: MessageContent | undefined
    ): Message {
        const nextMessageIndex = this.getNextMessageIndex();

        return createMessage(
            this.user.userId,
            nextMessageIndex,
            textContent,
            get(this.replyingTo),
            fileToAttach
        );
    }

    confirmMessage(candidate: Message, resp: SendMessageSuccess | TransferSuccess): void {
        if (unconfirmed.delete(this.chatId, candidate.messageId)) {
            messagesRead.confirmMessage(this.chatId, resp.messageIndex, candidate.messageId);
            const confirmed = {
                event: mergeSendMessageResponse(candidate, resp),
                index: resp.eventIndex,
                timestamp: resp.timestamp,
            };
            serverEventsStore.update(this.chatId, (events) =>
                events.map((e) => {
                    if (e.event === candidate) {
                        return confirmed;
                    }
                    return e;
                })
            );
            this.confirmedEventIndexesLoaded.add(resp.eventIndex);
            this._updateSummaryWithConfirmedMessage(confirmed);
        }
    }

    attachFile(content: MessageContent): void {
        draftMessages.setAttachment(this.chatId, content);
    }

    startTyping(threadRootMessageIndex?: number): void {
        rtcConnectionsManager.sendMessage([...this.chatUserIds], {
            kind: "remote_user_typing",
            chatType: this.kind,
            chatId: this.chatId,
            userId: this.user.userId,
            threadRootMessageIndex,
        });
    }

    stopTyping(threadRootMessageIndex?: number): void {
        rtcConnectionsManager.sendMessage([...this.chatUserIds], {
            kind: "remote_user_stopped_typing",
            chatType: this.kind,
            chatId: this.chatId,
            userId: this.user.userId,
            threadRootMessageIndex,
        });
    }

    clearAttachment(): void {
        draftMessages.setAttachment(this.chatId, undefined);
    }

    isRead(messageIndex: number, messageId: bigint): boolean {
        return messagesRead.isRead(this.chatId, messageIndex, messageId);
    }

    earliestLoadedIndex(): number | undefined {
        return this.confirmedEventIndexesLoaded.length > 0
            ? this.confirmedEventIndexesLoaded.index(0)
            : undefined;
    }

    latestLoadedIndex(): number | undefined {
        return this.confirmedEventIndexesLoaded.length > 0
            ? this.confirmedEventIndexesLoaded.index(this.confirmedEventIndexesLoaded.length - 1)
            : undefined;
    }

    confirmedUpToEventIndex(): number {
        const ranges = this.confirmedEventIndexesLoaded.subranges();
        if (ranges.length > 0) {
            return ranges[0].high;
        }
        return -1;
    }

    morePreviousMessagesAvailable(): boolean {
        return (
            (this.earliestLoadedIndex() ?? Number.MAX_VALUE) > this.earliestAvailableEventIndex()
        );
    }

    earliestAvailableEventIndex(): number {
        return this.chatVal.kind === "group_chat" ? this.chatVal.minVisibleEventIndex : 0;
    }

    moreNewMessagesAvailable(): boolean {
        return this.confirmedUpToEventIndex() < this.latestServerEventIndex();
    }

    latestServerEventIndex(): number {
        return get(this.serverChatSummary).latestEventIndex;
    }

    replyTo(context: EnhancedReplyContext): void {
        draftMessages.setReplyingTo(this.chatId, context);
    }

    cancelEditEvent(): void {
        draftMessages.delete(this.chatId);
    }

    editEvent(event: EventWrapper<Message>): void {
        draftMessages.setEditing(this.chatId, event);
    }

    dismissAsAdmin(userId: string): Promise<void> {
        currentChatMembers.update(this.chatId, (ps) =>
            ps.map((p) => (p.userId === userId ? { ...p, role: "participant" } : p))
        );
        return this.api
            .changeRole(this.chatId, userId, "participant")
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
        currentChatMembers.update(this.chatId, (ps) =>
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

    private undoTransferOwnershipLocally(me: string, them: string, theirRole: MemberRole): void {
        currentChatMembers.update(this.chatId, (ps) =>
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

    transferOwnership(me: string, them: FullMember): Promise<boolean> {
        this.transferOwnershipLocally(me, them.userId);
        return this.api
            .changeRole(this.chatId, them.userId, "owner")
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

    makeAdmin(userId: string): Promise<void> {
        currentChatMembers.update(this.chatId, (ps) =>
            ps.map((p) => (p.userId === userId ? { ...p, role: "admin" } : p))
        );
        return this.api
            .changeRole(this.chatId, userId, "admin")
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

    removeMember(userId: string): Promise<void> {
        return this.api
            .removeMember(this.chatId, userId)
            .then((resp) => {
                if (resp !== "success") {
                    rollbar.warn("Unable to remove member", resp);
                    toastStore.showFailureToast("removeMemberFailed");
                }
            })
            .catch((err) => {
                rollbar.error("Unable to remove member", err);
                toastStore.showFailureToast("removeMemberFailed");
            });
    }

    private blockUserLocally(userId: string): void {
        this.blockedUsers.update((b) => b.add(userId));
        currentChatMembers.update(this.chatId, (p) => p.filter((p) => p.userId !== userId));
    }

    private unblockUserLocally(userId: string): void {
        this.blockedUsers.update((b) => {
            b.delete(userId);
            return b;
        });
        currentChatMembers.update(this.chatId, (p) => [
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

    private removeMembersLocally(
        viaUnblock: boolean,
        users: UserSummary[],
        resp: AddMembersResponse | { kind: "unknown" }
    ): void {
        if (resp.kind === "add_members_success") return;

        let toRemove: string[] = [];
        if (resp.kind === "add_members_partial_success") {
            toRemove = [
                ...resp.usersAlreadyInGroup,
                ...resp.usersBlockedFromGroup,
                ...resp.usersWhoBlockedRequest,
            ];
        } else {
            toRemove = users.map((u) => u.userId);
        }

        currentChatMembers.update(this.chatId, (ps) =>
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

    private addMembersLocally(viaUnblock: boolean, users: UserSummary[]): void {
        if (viaUnblock) {
            this.blockedUsers.update((b) => {
                users.forEach((u) => b.delete(u.userId));
                return b;
            });
        }
        currentChatMembers.update(this.chatId, (ps) => [
            ...users.map((u) => ({
                userId: u.userId,
                role: "participant" as MemberRole,
            })),
            ...ps,
        ]);
    }

    addMembers(viaUnblock: boolean, users: UserSummary[]): Promise<boolean> {
        this.addMembersLocally(viaUnblock, users);
        return this.api
            .addMembers(
                this.chatId,
                users.map((u) => u.userId),
                this.user.username,
                viaUnblock
            )
            .then((resp) => {
                if (resp.kind === "add_members_success") {
                    return true;
                } else {
                    this.removeMembersLocally(viaUnblock, users, resp);
                    rollbar.warn("AddMembersFailed", resp);
                    return false;
                }
            })
            .catch((err) => {
                this.removeMembersLocally(viaUnblock, users, { kind: "unknown" });
                rollbar.error("AddMembersFailed", err);
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

    messageRead(messageIndex: number, messageId: bigint): void {
        messagesRead.markMessageRead(this.chatId, messageIndex, messageId);

        if (this.chatVal.kind === "direct_chat") {
            const rtc: WebRtcMessage = {
                kind: "remote_user_read_message",
                chatType: this.kind,
                messageId,
                chatId: this.chatId,
                userId: this.user.userId,
            };

            rtcConnectionsManager.sendMessage([...this.chatUserIds], rtc);
        }
    }

    // Checks if a key already exists for this group, if so, that key will be reused so that Svelte is able to match the
    // new version with the old version, if not, a new key will be created for the group.
    userGroupKey(group: EventWrapper<ChatEvent>[]): string {
        const first = group[0];
        let prefix = "";
        if (first.event.kind === "message") {
            const sender = first.event.sender;
            prefix = sender + "_";
        }
        for (const { index } of group) {
            const key = prefix + index;
            if (this.userGroupKeys.has(key)) {
                return key;
            }
        }
        const firstKey = prefix + first.index;
        this.userGroupKeys.add(firstKey);
        return firstKey;
    }

    // Returns the most recently active users, only considering users who have been active within the last 10 minutes
    findMessageEvent(
        events: EventWrapper<ChatEvent>[],
        index: number
    ): EventWrapper<Message> | undefined {
        return events.find(
            (ev) => ev.event.kind === "message" && ev.event.messageIndex === index
        ) as EventWrapper<Message> | undefined;
    }

    isContiguous(response: EventsSuccessResult<ChatEvent>): boolean {
        if (this.confirmedEventIndexesLoaded.length === 0 || response.events.length === 0)
            return true;

        const firstIndex = response.events[0].index;
        const lastIndex = response.events[response.events.length - 1].index;
        const contiguousCheck = new DRange(firstIndex - 1, lastIndex + 1);

        const isContiguous =
            this.confirmedEventIndexesLoaded.clone().intersect(contiguousCheck).length > 0;

        if (!isContiguous) {
            console.log(
                "Events in response are not contiguous with the loaded events",
                this.confirmedEventIndexesLoaded,
                firstIndex,
                lastIndex
            );
        }

        return isContiguous;
    }
}
