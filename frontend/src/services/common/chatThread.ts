import type {
    ChatEvent,
    ChatSummary,
    EventsResponse,
    EventsSuccessResult,
    EventWrapper,
    Message,
    SendMessageSuccess,
    TransferSuccess,
} from "../../domain/chat/chat";
import { missingUserIds } from "../../domain/user/user.utils";
import { rtcConnectionsManager } from "../../domain/webrtc/RtcConnectionsManager";
import type { ServiceContainer } from "../../services/serviceContainer";
import DRange from "drange";
import {
    currentChatBlockedUsers,
    currentChatMembers,
    currentChatDraftMessage,
    currentChatUserIds,
    confirmedEventIndexesLoaded,
    userGroupKeys,
    serverEventsStore,
    updateSummaryWithConfirmedMessage,
    groupDetails,
    currentChatPinnedMessages,
} from "../../stores/chat";
import { userStore } from "../../stores/user";
import { rollbar } from "../../utils/logging";
import { toastStore } from "../../stores/toast";
import { localMessageUpdates } from "../../stores/localMessageUpdates";
import {
    getStorageRequiredForMessage,
    indexRangeForChat,
    makeRtcConnections,
    mergeSendMessageResponse,
    replaceAffected,
    replaceLocal,
    serialiseMessageForRtc,
    upToDate,
    userIdsFromEvents,
} from "../../domain/chat/chat.utils";
import type { CreatedUser, User } from "../../domain/user/user";
import { get } from "svelte/store";
import { findLast } from "../../utils/list";
import { indexIsInRanges } from "../../utils/range";
import { unconfirmed } from "../../stores/unconfirmed";
import { messagesRead } from "../../stores/markRead";
import { remainingStorage } from "stores/storage";
import { trackEvent } from "utils/tracking";

export function selectReaction(
    api: ServiceContainer,
    chat: ChatSummary,
    userId: string,
    threadRootMessageIndex: number | undefined,
    messageId: bigint,
    reaction: string,
    username: string,
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
            ? api.toggleDirectChatReaction(chat.chatId, messageId, reaction, username, threadRootMessageIndex)
            : api.toggleGroupChatReaction(chat.chatId, messageId, reaction, username, threadRootMessageIndex)
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

export function deleteMessage(
    api: ServiceContainer,
    chat: ChatSummary,
    userId: string,
    threadRootMessageIndex: number | undefined,
    messageId: bigint
): Promise<boolean> {
    const messageIdString = messageId.toString();

    localMessageUpdates.markDeleted(messageIdString, userId);

    const recipients = [...currentChatUserIds.get(chat.chatId)];
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

export async function updateUserStore(
    api: ServiceContainer,
    chatId: string,
    userId: string,
    userIdsFromEvents: Set<string>
): Promise<void> {
    const allUserIds = new Set<string>();
    currentChatMembers.get(chatId).forEach((m) => allUserIds.add(m.userId));
    currentChatBlockedUsers.get(chatId).forEach((u) => allUserIds.add(u));
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

export async function loadEventWindow(
    api: ServiceContainer,
    user: CreatedUser,
    serverChat: ChatSummary,
    chat: ChatSummary,
    currentEvents: EventWrapper<ChatEvent>[],
    messageIndex: number
): Promise<number | undefined> {
    if (messageIndex >= 0) {
        const range = indexRangeForChat(serverChat);
        const eventsPromise: Promise<EventsResponse<ChatEvent>> =
            chat.kind === "direct_chat"
                ? api.directChatEventsWindow(range, chat.them, messageIndex, chat.latestEventIndex)
                : api.groupChatEventsWindow(
                      range,
                      chat.chatId,
                      messageIndex,
                      chat.latestEventIndex
                  );
        const eventsResponse = await eventsPromise;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return undefined;
        }

        await handleEventsResponse(api, user, chat, currentEvents, eventsResponse, false);

        return messageIndex;
    }
}

export async function handleEventsResponse(
    api: ServiceContainer,
    user: CreatedUser,
    chat: ChatSummary,
    currentEvents: EventWrapper<ChatEvent>[],
    resp: EventsResponse<ChatEvent>,
    keepCurrentEvents = true
): Promise<void> {
    if (resp === "events_failed") return;

    if (!keepCurrentEvents) {
        confirmedEventIndexesLoaded.clear(chat.chatId);
        userGroupKeys.clear(chat.chatId);
    } else if (!isContiguous(chat.chatId, resp)) {
        return;
    }

    const updated = replaceAffected(
        replaceLocal(
            user.userId,
            chat.chatId,
            chat.readByMe,
            keepCurrentEvents ? currentEvents : [],
            resp.events
        ),
        resp.affectedEvents
    );

    const userIds = userIdsFromEvents(updated);
    await updateUserStore(api, chat.chatId, user.userId, userIds);

    serverEventsStore.set(chat.chatId, updated);

    if (resp.events.length > 0) {
        confirmedEventIndexesLoaded.update(chat.chatId, (range) => {
            const r = range.clone();
            resp.events.forEach((e) => r.add(e.index));
            return r;
        });
    }

    makeRtcConnections(user.userId, chat, updated, get(userStore));
}

function isContiguous(chatId: string, response: EventsSuccessResult<ChatEvent>): boolean {
    const confirmedLoaded = confirmedEventIndexesLoaded.get(chatId);

    if (confirmedLoaded.length === 0 || response.events.length === 0) return true;

    const firstIndex = response.events[0].index;
    const lastIndex = response.events[response.events.length - 1].index;
    const contiguousCheck = new DRange(firstIndex - 1, lastIndex + 1);

    const isContiguous = confirmedLoaded.clone().intersect(contiguousCheck).length > 0;

    if (!isContiguous) {
        console.log(
            "Events in response are not contiguous with the loaded events",
            confirmedEventIndexesLoaded,
            firstIndex,
            lastIndex
        );
    }

    return isContiguous;
}

function loadEvents(
    api: ServiceContainer,
    serverChat: ChatSummary,
    clientChat: ChatSummary,
    startIndex: number,
    ascending: boolean
): Promise<EventsResponse<ChatEvent>> {
    return api.chatEvents(
        clientChat,
        indexRangeForChat(serverChat),
        startIndex,
        ascending,
        undefined,
        clientChat.latestEventIndex
    );
}

export async function loadPreviousMessages(
    api: ServiceContainer,
    user: CreatedUser,
    serverChat: ChatSummary,
    clientChat: ChatSummary,
    currentEvents: EventWrapper<ChatEvent>[]
): Promise<void> {
    const criteria = previousMessagesCriteria(serverChat, clientChat);

    const eventsResponse = criteria
        ? await loadEvents(api, serverChat, clientChat, criteria[0], criteria[1])
        : undefined;

    if (eventsResponse === undefined || eventsResponse === "events_failed") {
        return;
    }

    await handleEventsResponse(api, user, clientChat, currentEvents, eventsResponse);
    return;
}

function latestServerEventIndex(serverChat: ChatSummary): number {
    return serverChat.latestEventIndex;
}

function earliestAvailableEventIndex(clientChat: ChatSummary): number {
    return clientChat.kind === "group_chat" ? clientChat.minVisibleEventIndex : 0;
}

function previousMessagesCriteria(
    serverChat: ChatSummary,
    clientChat: ChatSummary
): [number, boolean] | undefined {
    const minLoadedEventIndex = earliestLoadedIndex(serverChat.chatId);
    if (minLoadedEventIndex === undefined) {
        return [latestServerEventIndex(serverChat), false];
    }
    const minVisibleEventIndex = earliestAvailableEventIndex(clientChat);
    return minLoadedEventIndex !== undefined && minLoadedEventIndex > minVisibleEventIndex
        ? [minLoadedEventIndex - 1, false]
        : undefined;
}

function earliestLoadedIndex(chatId: string): number | undefined {
    const confirmedLoaded = confirmedEventIndexesLoaded.get(chatId);
    return confirmedLoaded.length > 0 ? confirmedLoaded.index(0) : undefined;
}

export async function loadNewMessages(
    api: ServiceContainer,
    user: CreatedUser,
    serverChat: ChatSummary,
    clientChat: ChatSummary,
    currentEvents: EventWrapper<ChatEvent>[]
): Promise<boolean> {
    const criteria = newMessageCriteria(serverChat);

    const eventsResponse = criteria
        ? await loadEvents(api, serverChat, clientChat, criteria[0], criteria[1])
        : undefined;

    if (eventsResponse === undefined || eventsResponse === "events_failed") {
        return false;
    }

    await handleEventsResponse(api, user, clientChat, currentEvents, eventsResponse);

    // We may have loaded messages which are more recent than what the chat summary thinks is the latest message,
    // if so, we update the chat summary to show the correct latest message.
    const latestMessage = findLast(eventsResponse.events, (e) => e.event.kind === "message");
    const newLatestMessage =
        latestMessage !== undefined && latestMessage.index > latestServerEventIndex(serverChat);

    if (newLatestMessage) {
        updateSummaryWithConfirmedMessage(
            clientChat.chatId,
            latestMessage as EventWrapper<Message>
        );
    }

    return newLatestMessage;
}

function newMessageCriteria(serverChat: ChatSummary): [number, boolean] | undefined {
    const maxServerEventIndex = latestServerEventIndex(serverChat);
    const loadedUpTo = confirmedUpToEventIndex(serverChat.chatId);

    if (loadedUpTo === undefined) {
        return [maxServerEventIndex, false];
    }

    return loadedUpTo < maxServerEventIndex ? [loadedUpTo + 1, true] : undefined;
}

function confirmedUpToEventIndex(chatId: string): number | undefined {
    const ranges = confirmedEventIndexesLoaded.get(chatId).subranges();
    if (ranges.length > 0) {
        return ranges[0].high;
    }
    return undefined;
}

export function morePreviousMessagesAvailable(clientChat: ChatSummary): boolean {
    return (
        (earliestLoadedIndex(clientChat.chatId) ?? Number.MAX_VALUE) >
        earliestAvailableEventIndex(clientChat)
    );
}

export function moreNewMessagesAvailable(serverChat: ChatSummary): boolean {
    return (confirmedUpToEventIndex(serverChat.chatId) ?? -1) < latestServerEventIndex(serverChat);
}

export function refreshAffectedEvents(
    api: ServiceContainer,
    user: CreatedUser,
    clientChat: ChatSummary,
    currentEvents: EventWrapper<ChatEvent>[],
    affectedEventIndexes: number[]
): Promise<void> {
    const confirmedLoaded = confirmedEventIndexesLoaded.get(clientChat.chatId);
    const filtered = affectedEventIndexes.filter((e) => indexIsInRanges(e, confirmedLoaded));
    if (filtered.length === 0) {
        return Promise.resolve();
    }

    const eventsPromise =
        clientChat.kind === "direct_chat"
            ? api.directChatEventsByEventIndex(
                  clientChat.them,
                  filtered,
                  undefined,
                  clientChat.latestEventIndex
              )
            : api.groupChatEventsByEventIndex(
                  clientChat.chatId,
                  filtered,
                  undefined,
                  clientChat.latestEventIndex
              );

    return eventsPromise.then((resp) =>
        handleEventsResponse(api, user, clientChat, currentEvents, resp)
    );
}

export async function loadDetails(
    api: ServiceContainer,
    user: CreatedUser,
    clientChat: ChatSummary,
    currentEvents: EventWrapper<ChatEvent>[]
): Promise<void> {
    // currently this is only meaningful for group chats, but we'll set it up generically just in case
    if (clientChat.kind === "group_chat") {
        if (groupDetails.get(clientChat.chatId) === undefined) {
            const resp = await api.getGroupDetails(clientChat.chatId, clientChat.latestEventIndex);
            if (resp !== "caller_not_in_group") {
                groupDetails.set(clientChat.chatId, resp);
                currentChatMembers.set(clientChat.chatId, resp.members);
                currentChatBlockedUsers.set(clientChat.chatId, resp.blockedUsers);
                currentChatPinnedMessages.set(clientChat.chatId, resp.pinnedMessages);
            }
            await updateUserStore(
                api,
                clientChat.chatId,
                user.userId,
                userIdsFromEvents(currentEvents)
            );
        } else {
            await updateDetails(api, user, clientChat, currentEvents);
        }
    }
}

export async function updateDetails(
    api: ServiceContainer,
    user: CreatedUser,
    clientChat: ChatSummary,
    currentEvents: EventWrapper<ChatEvent>[]
): Promise<void> {
    if (clientChat.kind === "group_chat") {
        const details = groupDetails.get(clientChat.chatId);
        if (details !== undefined && details.latestEventIndex < clientChat.latestEventIndex) {
            const gd = await api.getGroupDetailsUpdates(clientChat.chatId, details);
            currentChatMembers.set(clientChat.chatId, gd.members);
            currentChatBlockedUsers.set(clientChat.chatId, gd.blockedUsers);
            currentChatPinnedMessages.set(clientChat.chatId, gd.pinnedMessages);
            groupDetails.set(clientChat.chatId, gd);
            await updateUserStore(
                api,
                clientChat.chatId,
                user.userId,
                userIdsFromEvents(currentEvents)
            );
        }
    }
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
    clientChat: ChatSummary,
    messageIndex: number
): void {
    if (clientChat.kind === "group_chat") {
        removePinnedMessage(clientChat.chatId, messageIndex);
        api.unpinMessage(clientChat.chatId, messageIndex)
            .then((resp) => {
                if (resp !== "success" && resp !== "no_change") {
                    toastStore.showFailureToast("unpinMessageFailed");
                    rollbar.error("Unpin message failed: ", resp);
                    addPinnedMessage(clientChat.chatId, messageIndex);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("unpinMessageFailed");
                rollbar.error("Unpin message failed: ", err);
                addPinnedMessage(clientChat.chatId, messageIndex);
            });
    }
}

export function pinMessage(
    api: ServiceContainer,
    clientChat: ChatSummary,
    messageIndex: number
): void {
    if (clientChat.kind === "group_chat") {
        addPinnedMessage(clientChat.chatId, messageIndex);
        api.pinMessage(clientChat.chatId, messageIndex)
            .then((resp) => {
                if (resp !== "success" && resp !== "no_change") {
                    toastStore.showFailureToast("pinMessageFailed");
                    rollbar.error("Pin message failed: ", resp);
                    removePinnedMessage(clientChat.chatId, messageIndex);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("pinMessageFailed");
                rollbar.error("Pin message failed: ", err);
                removePinnedMessage(clientChat.chatId, messageIndex);
            });
    }
}

export function removeMessage(
    currentUserId: string,
    clientChat: ChatSummary,
    messageId: bigint,
    userId: string
): void {
    if (userId === currentUserId) {
        const userIds = currentChatUserIds.get(clientChat.chatId);
        rtcConnectionsManager.sendMessage([...userIds], {
            kind: "remote_user_removed_message",
            chatType: clientChat.kind,
            chatId: clientChat.chatId,
            messageId: messageId,
            userId: userId,
        });
    }
    unconfirmed.delete(clientChat.chatId, messageId);
    messagesRead.removeUnconfirmedMessage(clientChat.chatId, messageId);
    serverEventsStore.update(clientChat.chatId, (events) =>
        events.filter((e) => e.event.kind === "message" && e.event.messageId !== messageId)
    );
}

export async function sendMessage(
    api: ServiceContainer,
    user: CreatedUser,
    serverChat: ChatSummary,
    clientChat: ChatSummary,
    currentEvents: EventWrapper<ChatEvent>[],
    messageEvent: EventWrapper<Message>
): Promise<number | undefined> {
    let jumpingTo: number | undefined = undefined;
    if (!upToDate(clientChat, currentEvents)) {
        jumpingTo = await loadEventWindow(
            api,
            user,
            serverChat,
            clientChat,
            currentEvents,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            clientChat.latestMessage!.event.messageIndex
        );
    }

    unconfirmed.add(clientChat.chatId, messageEvent);
    rtcConnectionsManager.sendMessage([...currentChatUserIds.get(clientChat.chatId)], {
        kind: "remote_user_sent_message",
        chatType: clientChat.kind,
        chatId: clientChat.chatId,
        messageEvent: serialiseMessageForRtc(messageEvent),
        userId: user.userId,
    });

    // mark our own messages as read manually since we will not be observing them
    messagesRead.markMessageRead(
        clientChat.chatId,
        messageEvent.event.messageIndex,
        messageEvent.event.messageId
    );
    appendMessage(clientChat.chatId, currentEvents, messageEvent);

    currentChatDraftMessage.clear(clientChat.chatId);

    return jumpingTo;
}

function appendMessage(
    chatId: string,
    currentEvents: EventWrapper<ChatEvent>[],
    message: EventWrapper<Message>
): boolean {
    const existing = currentEvents.find(
        (ev) => ev.event.kind === "message" && ev.event.messageId === message.event.messageId
    );

    if (existing !== undefined) return false;

    serverEventsStore.update(chatId, (events) => [...events, message]);
    return true;
}

export async function handleMessageSentByOther(
    api: ServiceContainer,
    user: CreatedUser,
    clientChat: ChatSummary,
    currentEvents: EventWrapper<ChatEvent>[],
    messageEvent: EventWrapper<Message>,
    confirmed: boolean
): Promise<void> {
    const confirmedLoaded = confirmedEventIndexesLoaded.get(clientChat.chatId);

    if (indexIsInRanges(messageEvent.index, confirmedLoaded)) {
        // We already have this confirmed message
        return;
    }

    if (confirmed) {
        const isAdjacentToAlreadyLoadedEvents =
            indexIsInRanges(messageEvent.index - 1, confirmedLoaded) ||
            indexIsInRanges(messageEvent.index + 1, confirmedLoaded);

        if (!isAdjacentToAlreadyLoadedEvents) {
            return;
        }

        await handleEventsResponse(api, user, clientChat, currentEvents, {
            events: [messageEvent],
            affectedEvents: [],
            latestEventIndex: undefined,
        });
    } else {
        if (!upToDate(clientChat, currentEvents)) {
            return;
        }

        // If it is unconfirmed then we simply append it
        if (appendMessage(clientChat.chatId, currentEvents, messageEvent)) {
            unconfirmed.add(clientChat.chatId, messageEvent);
        }
    }
}

export function forwardMessage(
    api: ServiceContainer,
    user: CreatedUser,
    serverChat: ChatSummary,
    clientChat: ChatSummary,
    currentEvents: EventWrapper<ChatEvent>[],
    evt: EventWrapper<Message>
): Promise<number | undefined> {
    api.sendMessage(clientChat, user, [], evt.event)
        .then(([resp, msg]) => {
            if (resp.kind === "success") {
                confirmMessage(clientChat.chatId, msg, resp);
                trackEvent("forward_message");
            } else {
                removeMessage(user.userId, clientChat, msg.messageId, user.userId);
                rollbar.warn("Error response forwarding message", resp);
                toastStore.showFailureToast("errorSendingMessage");
            }
        })
        .catch((err) => {
            removeMessage(user.userId, clientChat, evt.event.messageId, user.userId);
            console.log(err);
            toastStore.showFailureToast("errorSendingMessage");
            rollbar.error("Exception forwarding message", err);
        });

    return sendMessage(api, user, serverChat, clientChat, currentEvents, evt);
}

export function sendMessageWithAttachment(
    api: ServiceContainer,
    user: CreatedUser,
    serverChat: ChatSummary,
    clientChat: ChatSummary,
    currentEvents: EventWrapper<ChatEvent>[],
    evt: EventWrapper<Message>,
    mentioned: User[]
): Promise<number | undefined> {
    api.sendMessage(clientChat, user, mentioned, evt.event)
        .then(([resp, msg]) => {
            if (resp.kind === "success" || resp.kind === "transfer_success") {
                confirmMessage(clientChat.chatId, msg, resp);
                if (msg.kind === "message" && msg.content.kind === "crypto_content") {
                    api.refreshAccountBalance(msg.content.transfer.token, user.cryptoAccount);
                }
                if (clientChat.kind === "direct_chat") {
                    trackEvent("sent_direct_message");
                } else {
                    if (clientChat.public) {
                        trackEvent("sent_public_group_message");
                    } else {
                        trackEvent("sent_private_group_message");
                    }
                }
                if (msg.repliesTo !== undefined) {
                    // double counting here which I think is OK since we are limited to string events
                    trackEvent("replied_to_message");
                }
            } else {
                removeMessage(user.userId, clientChat, msg.messageId, user.userId);
                rollbar.warn("Error response sending message", resp);
                toastStore.showFailureToast("errorSendingMessage");
            }
        })
        .catch((err) => {
            removeMessage(user.userId, clientChat, evt.event.messageId, user.userId);
            console.log(err);
            toastStore.showFailureToast("errorSendingMessage");
            rollbar.error("Exception sending message", err);
        });

    return sendMessage(api, user, serverChat, clientChat, currentEvents, evt);
}

function confirmMessage(
    chatId: string,
    candidate: Message,
    resp: SendMessageSuccess | TransferSuccess
): void {
    if (unconfirmed.delete(chatId, candidate.messageId)) {
        messagesRead.confirmMessage(chatId, resp.messageIndex, candidate.messageId);
        const confirmed = {
            event: mergeSendMessageResponse(candidate, resp),
            index: resp.eventIndex,
            timestamp: resp.timestamp,
        };
        let found = false;
        serverEventsStore.update(chatId, (events) =>
            events.map((e) => {
                if (e.event === candidate) {
                    found = true;
                    return confirmed;
                }
                return e;
            })
        );

        if (found) {
            confirmedEventIndexesLoaded.update(chatId, (range) => {
                const r = range.clone();
                r.add(resp.eventIndex);
                return r;
            });
        }

        updateSummaryWithConfirmedMessage(chatId, confirmed);
    }
}
