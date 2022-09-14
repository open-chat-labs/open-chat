/* eslint-disable @typescript-eslint/no-non-null-assertion */
import DRange from "drange";
import { derived, get, Readable } from "svelte/store";
import type {
    AddMembersResponse,
    ChatEvent,
    ChatSummary,
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
} from "../domain/chat/chat.utils";
import type { UserSummary } from "../domain/user/user";
import { missingUserIds } from "../domain/user/user.utils";
import { rtcConnectionsManager } from "../domain/webrtc/RtcConnectionsManager";
import type { ServiceContainer } from "../services/serviceContainer";
import { blockedUsers } from "../stores/blockedUsers";
import {
    ChatState,
    chatSummariesStore,
    currentChatBlockedUsers,
    currentChatMembers,
    currentChatPinnedMessages,
    currentChatDraftMessage,
    serverEventsStore,
    currentChatReplyingTo,
    currentChatUserIds,
    nextMessageIndex,
} from "../stores/chat";
import { unconfirmed } from "../stores/unconfirmed";
import { userStore } from "../stores/user";
import { findLast } from "../utils/list";
import { rollbar } from "../utils/logging";
import { indexIsInRanges } from "../utils/range";
import { toastStore } from "../stores/toast";
import type { WebRtcMessage } from "../domain/webrtc/webrtc";
import { messagesRead } from "../stores/markRead";
import { isPreviewing } from "../domain/chat/chat.utils.shared";
import { eventsStore } from "../stores/chat";
import { localMessageUpdates } from "../stores/localMessageUpdates";

export class ChatController {
    public chat: Readable<ChatSummary>;
    public chatId: string;

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
        this.chat = derived(
            chatSummariesStore,
            (chatSummaries) => chatSummaries[get(serverChatSummary).chatId]
        );

        const chat = get(this.chat);

        this.chatId = chat.chatId;
        // If this is a group chat, chatUserIds will be populated when processing the chat events

        if (process.env.NODE_ENV !== "test") {
            if (_focusMessageIndex !== undefined) {
                this.loadEventWindow(_focusMessageIndex);
            } else {
                this.loadPreviousMessages();
            }
            this.loadDetails();
        }

        console.log("constructing chat controller");
    }

    destroy(): void {
        console.log("destroying chat controller");
    }

    get chatVal(): ChatSummary {
        return get(this.chat);
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
                    currentChatBlockedUsers.set(this.chatId, resp.blockedUsers);
                    currentChatPinnedMessages.set(this.chatId, resp.pinnedMessages);
                }
                await updateUserStore(
                    this.api,
                    this.chatId,
                    this.user.userId,
                    userIdsFromEvents(get(eventsStore))
                );
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
                currentChatBlockedUsers.set(this.chatId, this.groupDetails.blockedUsers);
                currentChatPinnedMessages.set(this.chatId, this.groupDetails.pinnedMessages);
                await updateUserStore(
                    this.api,
                    this.chatId,
                    this.user.userId,
                    userIdsFromEvents(get(eventsStore))
                );
            }
        }
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
        await updateUserStore(this.api, this.chatId, this.user.userId, userIds);

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
        rtcConnectionsManager.sendMessage([...get(currentChatUserIds)], {
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
        appendMessage(this.chatId, messageEvent);
        this.raiseEvent({
            chatId: this.chatId,
            event: {
                kind: "sending_message",
                scroll: jumping ? "auto" : "smooth",
            },
        });

        currentChatDraftMessage.clear(this.chatId);
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
            if (appendMessage(this.chatId, messageEvent)) {
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

    async goToMessageIndex(
        messageIndex: number,
        preserveFocus: boolean,
        focusThreadMessageIndex?: number
    ): Promise<void> {
        // FIXME - I don't remember what this is being used for
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

    getNextMessageIndex(): number {
        return getNextMessageIndex(
            get(this.serverChatSummary),
            unconfirmed.getMessages(this.chatId)
        );
    }

    getNextEventIndex(): number {
        return getNextEventIndex(get(this.serverChatSummary), unconfirmed.getMessages(this.chatId));
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

    earliestLoadedIndex(): number | undefined {
        return this.confirmedEventIndexesLoaded.length > 0
            ? this.confirmedEventIndexesLoaded.index(0)
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

    private latestServerEventIndex(): number {
        return get(this.serverChatSummary).latestEventIndex;
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

/**
 * Extract pure functions out of the chat controller and put them below here until there is no chat controller left
 */

export function selectReaction(
    api: ServiceContainer,
    chat: ChatSummary,
    userId: string,
    threadRootMessageIndex: number | undefined,
    messageId: bigint,
    reaction: string,
    kind: "add" | "remove"
): Promise<boolean> {
    localMessageUpdates.markReaction(messageId.toString(), {
        reaction,
        kind,
        userId,
    });

    function undoLocally() {
        localMessageUpdates.markReaction(messageId.toString(), {
            reaction,
            kind: kind === "add" ? "remove" : "add",
            userId,
        });
    }

    return (
        chat.kind === "direct_chat"
            ? api.toggleDirectChatReaction(chat.chatId, messageId, reaction, threadRootMessageIndex)
            : api.toggleGroupChatReaction(chat.chatId, messageId, reaction, threadRootMessageIndex)
    )
        .then((resp) => {
            if (resp !== "added" && resp !== "removed") {
                undoLocally();
                return false;
            }
            return true;
        })
        .catch((_) => {
            undoLocally();
            return false;
        });
}

export function appendMessage(chatId: string, message: EventWrapper<Message>): boolean {
    const existing = get(eventsStore).find(
        (ev) => ev.event.kind === "message" && ev.event.messageId === message.event.messageId
    );

    if (existing !== undefined) return false;

    serverEventsStore.update(chatId, (events) => [...events, message]);
    return true;
}

export function deleteMessage(
    api: ServiceContainer,
    chat: ChatSummary,
    userId: string,
    threadRootMessageIndex: number | undefined,
    messageId: bigint
): Promise<boolean> {
    const messageIdString = messageId.toString();

    localMessageUpdates.markDeleted(messageIdString, userId);

    const recipients = [...get(currentChatUserIds)];
    const chatType = chat.kind;
    const chatId = chat.chatId;

    rtcConnectionsManager.sendMessage(recipients, {
        kind: "remote_user_deleted_message",
        chatType,
        chatId,
        messageId,
        userId,
        threadRootMessageIndex,
    });

    function undelete() {
        rtcConnectionsManager.sendMessage(recipients, {
            kind: "remote_user_undeleted_message",
            chatType,
            chatId,
            messageId,
            userId,
            threadRootMessageIndex,
        });
        localMessageUpdates.markUndeleted(messageIdString);
    }

    return api
        .deleteMessage(chat, messageId, threadRootMessageIndex)
        .then((resp) => {
            const success = resp === "success";
            if (!success) {
                undelete();
            }
            return success;
        })
        .catch((_) => {
            undelete();
            return false;
        });
}

export function removeMessage(
    { kind, chatId }: ChatSummary,
    currentUserId: string,
    messageId: bigint,
    userId: string
): void {
    if (userId === currentUserId) {
        rtcConnectionsManager.sendMessage([...get(currentChatUserIds)], {
            kind: "remote_user_removed_message",
            chatType: kind,
            chatId: chatId,
            messageId: messageId,
            userId: userId,
        });
    }
    unconfirmed.delete(chatId, messageId);
    messagesRead.removeUnconfirmedMessage(chatId, messageId);
    serverEventsStore.update(chatId, (events) =>
        events.filter((e) => e.event.kind === "message" && e.event.messageId !== messageId)
    );
}

export function isDirectChatWith(chat: ChatSummary, userId: string): boolean {
    return chat.kind === "direct_chat" && chat.them === userId;
}

export function isBlockedUser(chat: ChatSummary): boolean {
    return chat.kind === "direct_chat" && get(blockedUsers).has(chat.them);
}

export async function updateUserStore(
    api: ServiceContainer,
    chatId: string,
    userId: string,
    userIdsFromEvents: Set<string>
): Promise<void> {
    const allUserIds = new Set<string>();
    get(currentChatMembers).forEach((m) => allUserIds.add(m.userId));
    get(currentChatBlockedUsers).forEach((u) => allUserIds.add(u));
    userIdsFromEvents.forEach((u) => allUserIds.add(u));

    currentChatUserIds.update(chatId, (userIds) => {
        allUserIds.forEach((u) => {
            if (u !== userId) {
                userIds.add(u);
            }
        });
        return userIds;
    });

    const resp = await api.getUsers(
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

export async function editMessage(
    api: ServiceContainer,
    chat: ChatSummary,
    msg: Message,
    threadRootMessageIndex: number | undefined
): Promise<void> {
    localMessageUpdates.markContentEdited(msg.messageId.toString(), msg.content);

    if (threadRootMessageIndex === undefined) {
        currentChatDraftMessage.clear(chat.chatId);
    }

    return api
        .editMessage(chat, msg, threadRootMessageIndex)
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

export function getUnreadMessageCount(chat: ChatSummary): number {
    if (isPreviewing(chat)) return 0;

    return messagesRead.unreadMessageCount(
        chat.chatId,
        getMinVisibleMessageIndex(chat),
        chat.latestMessage?.event.messageIndex
    );
}

export function messageRead(
    { chatId, kind }: ChatSummary,
    userId: string,
    messageIndex: number,
    messageId: bigint
): void {
    messagesRead.markMessageRead(chatId, messageIndex, messageId);

    if (kind === "direct_chat") {
        const rtc: WebRtcMessage = {
            kind: "remote_user_read_message",
            chatType: kind,
            messageId,
            chatId,
            userId,
        };

        rtcConnectionsManager.sendMessage([...get(currentChatUserIds)], rtc);
    }
}

export function stopTyping(
    { kind, chatId }: ChatSummary,
    userId: string,
    threadRootMessageIndex?: number
): void {
    rtcConnectionsManager.sendMessage([...get(currentChatUserIds)], {
        kind: "remote_user_stopped_typing",
        chatType: kind,
        chatId,
        userId,
        threadRootMessageIndex,
    });
}

export function startTyping(
    { kind, chatId }: ChatSummary,
    userId: string,
    threadRootMessageIndex?: number
): void {
    rtcConnectionsManager.sendMessage([...get(currentChatUserIds)], {
        kind: "remote_user_typing",
        chatType: kind,
        chatId,
        userId,
        threadRootMessageIndex,
    });
}

function transferOwnershipLocally(chatId: string, me: string, them: string): void {
    currentChatMembers.update(chatId, (ps) =>
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

function undoTransferOwnershipLocally(
    chatId: string,
    me: string,
    them: string,
    theirRole: MemberRole
): void {
    currentChatMembers.update(chatId, (ps) =>
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

export function transferOwnership(
    api: ServiceContainer,
    chatId: string,
    me: string,
    them: FullMember
): Promise<boolean> {
    transferOwnershipLocally(chatId, me, them.userId);
    return api
        .changeRole(chatId, them.userId, "owner")
        .then((resp) => {
            if (resp !== "success") {
                rollbar.warn("Unable to transfer ownership", resp);
                undoTransferOwnershipLocally(chatId, me, them.userId, them.role);
                return false;
            }
            return true;
        })
        .catch((err) => {
            undoTransferOwnershipLocally(chatId, me, them.userId, them.role);
            rollbar.error("Unable to transfer ownership", err);
            return false;
        });
}

export function registerPollVote(
    api: ServiceContainer,
    userId: string,
    chatId: string,
    threadRootMessageIndex: number | undefined,
    messageId: bigint,
    messageIndex: number,
    answerIndex: number,
    type: "register" | "delete"
): void {
    localMessageUpdates.markPollVote(messageId.toString(), {
        answerIndex,
        type,
        userId,
    });

    api.registerPollVote(chatId, messageIndex, answerIndex, type, threadRootMessageIndex)
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

export function dismissAsAdmin(
    api: ServiceContainer,
    chatId: string,
    userId: string
): Promise<void> {
    currentChatMembers.update(chatId, (ps) =>
        ps.map((p) => (p.userId === userId ? { ...p, role: "participant" } : p))
    );
    return api
        .changeRole(chatId, userId, "participant")
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

export function makeAdmin(api: ServiceContainer, chatId: string, userId: string): Promise<void> {
    currentChatMembers.update(chatId, (ps) =>
        ps.map((p) => (p.userId === userId ? { ...p, role: "admin" } : p))
    );
    return api
        .changeRole(chatId, userId, "admin")
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

export function removeMember(api: ServiceContainer, chatId: string, userId: string): Promise<void> {
    return api
        .removeMember(chatId, userId)
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

function removeMembersLocally(
    chatId: string,
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

    currentChatMembers.update(chatId, (ps) =>
        ps.filter((p) => {
            !toRemove.includes(p.userId);
        })
    );

    if (viaUnblock) {
        currentChatBlockedUsers.update(chatId, (b) => {
            return toRemove.reduce((blocked, u) => blocked.add(u), b);
        });
    }
}

function addMembersLocally(chatId: string, viaUnblock: boolean, users: UserSummary[]): void {
    if (viaUnblock) {
        currentChatBlockedUsers.update(chatId, (b) => {
            users.forEach((u) => b.delete(u.userId));
            return b;
        });
    }
    currentChatMembers.update(chatId, (ps) => [
        ...users.map((u) => ({
            userId: u.userId,
            role: "participant" as MemberRole,
        })),
        ...ps,
    ]);
}

export function addMembers(
    api: ServiceContainer,
    chatId: string,
    username: string,
    viaUnblock: boolean,
    users: UserSummary[]
): Promise<boolean> {
    addMembersLocally(chatId, viaUnblock, users);
    return api
        .addMembers(
            chatId,
            users.map((u) => u.userId),
            username,
            viaUnblock
        )
        .then((resp) => {
            if (resp.kind === "add_members_success") {
                return true;
            } else {
                removeMembersLocally(chatId, viaUnblock, users, resp);
                rollbar.warn("AddMembersFailed", resp);
                return false;
            }
        })
        .catch((err) => {
            removeMembersLocally(chatId, viaUnblock, users, { kind: "unknown" });
            rollbar.error("AddMembersFailed", err);
            return false;
        });
}

function blockUserLocally(chatId: string, userId: string): void {
    currentChatBlockedUsers.update(chatId, (b) => b.add(userId));
    currentChatMembers.update(chatId, (p) => p.filter((p) => p.userId !== userId));
}

function unblockUserLocally(chatId: string, userId: string): void {
    currentChatBlockedUsers.update(chatId, (b) => {
        b.delete(userId);
        return b;
    });
    currentChatMembers.update(chatId, (p) => [
        ...p,
        {
            role: "participant",
            userId,
            username: get(userStore)[userId]?.username ?? "unknown",
        },
    ]);
}

export function blockUser(api: ServiceContainer, chatId: string, userId: string): Promise<void> {
    blockUserLocally(chatId, userId);
    return api
        .blockUserFromGroupChat(chatId, userId)
        .then((resp) => {
            if (resp === "success") {
                toastStore.showSuccessToast("blockUserSucceeded");
            } else {
                toastStore.showFailureToast("blockUserFailed");
                unblockUserLocally(chatId, userId);
            }
        })
        .catch((err) => {
            toastStore.showFailureToast("blockUserFailed");
            rollbar.error("Error blocking user", err);
            unblockUserLocally(chatId, userId);
        });
}
export function unblockUser(api: ServiceContainer, chatId: string, userId: string): Promise<void> {
    unblockUserLocally(chatId, userId);
    return api
        .unblockUserFromGroupChat(chatId, userId)
        .then((resp) => {
            if (resp === "success") {
                toastStore.showSuccessToast("unblockUserSucceeded");
            } else {
                toastStore.showFailureToast("unblockUserFailed");
                blockUserLocally(chatId, userId);
            }
        })
        .catch((err) => {
            toastStore.showFailureToast("unblockUserFailed");
            rollbar.error("Error unblocking user", err);
            blockUserLocally(chatId, userId);
        });
}

export function findMessageEvent(
    events: EventWrapper<ChatEvent>[],
    index: number
): EventWrapper<Message> | undefined {
    return events.find((ev) => ev.event.kind === "message" && ev.event.messageIndex === index) as
        | EventWrapper<Message>
        | undefined;
}

function addPinnedMessage(chatId: string, messageIndex: number): void {
    currentChatPinnedMessages.update(chatId, (s) => {
        s.add(messageIndex);
        return new Set(s);
    });
}

function removePinnedMessage(chatId: string, messageIndex: number): void {
    currentChatPinnedMessages.update(chatId, (s) => {
        s.delete(messageIndex);
        return new Set(s);
    });
}

export function unpinMessage(
    api: ServiceContainer,
    { kind, chatId }: ChatSummary,
    messageIndex: number
): void {
    if (kind === "group_chat") {
        removePinnedMessage(chatId, messageIndex);
        api.unpinMessage(chatId, messageIndex)
            .then((resp) => {
                if (resp !== "success" && resp !== "no_change") {
                    toastStore.showFailureToast("unpinMessageFailed");
                    rollbar.error("Unpin message failed: ", resp);
                    addPinnedMessage(chatId, messageIndex);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("unpinMessageFailed");
                rollbar.error("Unpin message failed: ", err);
                addPinnedMessage(chatId, messageIndex);
            });
    }
}

export function pinMessage(
    api: ServiceContainer,
    { kind, chatId }: ChatSummary,
    messageIndex: number
): void {
    if (kind === "group_chat") {
        addPinnedMessage(chatId, messageIndex);
        api.pinMessage(chatId, messageIndex)
            .then((resp) => {
                if (resp !== "success" && resp !== "no_change") {
                    toastStore.showFailureToast("pinMessageFailed");
                    rollbar.error("Pin message failed: ", resp);
                    removePinnedMessage(chatId, messageIndex);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("pinMessageFailed");
                rollbar.error("Pin message failed: ", err);
                removePinnedMessage(chatId, messageIndex);
            });
    }
}

export function createNew(
    userId: string,
    textContent: string | undefined,
    fileToAttach: MessageContent | undefined
): Message {
    return createMessage(
        userId,
        get(nextMessageIndex),
        textContent,
        get(currentChatReplyingTo),
        fileToAttach
    );
}
