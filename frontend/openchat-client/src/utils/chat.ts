import { compareUsername, nullUser } from "./user";
import type {
    ChatSummary,
    EventWrapper,
    GroupChatSummary,
    MessageContent,
    ChatEvent,
    ReplyContext,
    Reaction,
    Message,
    Mention,
    CandidateGroupChat,
    PollVotes,
    PollContent,
    MemberRole,
    CryptocurrencyContent,
    AggregateCommonEvents,
    Metrics,
    SendMessageSuccess,
    TransferSuccess,
    UserLookup,
    UserSummary,
    LocalChatSummaryUpdates,
    LocalMessageUpdates,
    LocalReaction,
    LocalPollVote,
    CryptocurrencyTransfer,
    Tally,
    AccessControlled,
    HasMembershipRole,
    MessageContext,
    MultiUserChatIdentifier,
    MultiUserChat,
    ChatListScope,
    CryptocurrencyDetails,
    TimelineItem,
    TipsReceived,
    ThreadSummary,
    MessagePermission,
    ChatPermissions,
    OptionalChatPermissions,
    MessagePermissions,
    OptionalMessagePermissions,
    OptionUpdate,
    GovernanceProposalsSubtype,
    CreatedUser,
    ChannelSummary,
    MessageFormatter,
} from "openchat-shared";
import {
    emptyChatMetrics,
    nullMembership,
    ChatMap,
    MessageMap,
    isAttachmentContent,
    applyOptionUpdate,
    updateFromOptions,
    defaultOptionalMessagePermissions,
    defaultOptionalChatPermissions,
    getContentAsFormattedText,
    getContentAsText,
    messageContextsEqual,
    random64,
    OPENCHAT_VIDEO_CALL_AVATAR_URL,
    OPENCHAT_VIDEO_CALL_USER_ID,
    OPENCHAT_BOT_USER_ID,
    OPENCHAT_BOT_AVATAR_URL,
} from "openchat-shared";
import { distinctBy, groupWhile, toRecordFiltered } from "../utils/list";
import { areOnSameDay } from "../utils/date";
import DRange from "drange";
import Identicon from "identicon.js";
import md5 from "md5";
import { rtcConnectionsManager } from "../utils/rtcConnectionsManager";
import type { UnconfirmedMessages } from "../stores/unconfirmed";
import { get } from "svelte/store";
import { formatTokens } from "./cryptoFormatter";
import { currentChatUserIds } from "../stores/chat";
import type { TypersByKey } from "../stores/typing";
import { tallyKey } from "../stores/proposalTallies";
import { hasOwnerRights, isPermitted } from "./permissions";
import { cryptoLookup } from "../stores/crypto";
import { bigIntMax, messagePermissionsList } from "openchat-shared";
import type { MessageFilter } from "../stores/messageFilters";

const MAX_RTC_CONNECTIONS_PER_CHAT = 10;
const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute

export function isPreviewing(chat: ChatSummary): boolean {
    return chat.membership.role === "none";
}

export function isLapsed(chat: ChatSummary): boolean {
    return chat.membership.lapsed;
}

export function isFrozen(thing: AccessControlled): boolean {
    return thing.frozen;
}

export function isUpToDate(chat: ChatSummary, events: EventWrapper<ChatEvent>[]): boolean {
    return (
        chat.latestMessage === undefined ||
        events[events.length - 1]?.index >= chat.latestEventIndex
    );
}

export function getRecentlyActiveUsers(
    chat: ChatSummary,
    events: EventWrapper<ChatEvent>[],
    maxUsers: number,
): Set<string> {
    const users = new Set<string>();
    if (isUpToDate(chat, events)) {
        const tenMinsAgo = Date.now() - 10 * 60 * 1000;

        for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i];
            if (event.timestamp < tenMinsAgo) break;

            const activeUser = activeUserIdFromEvent(event.event);
            if (activeUser !== undefined) {
                users.add(activeUser);
                if (users.size >= maxUsers) {
                    break;
                }
            }
        }
    }
    return users;
}

export function getUsersToMakeRtcConnectionsWith(
    myUserId: string,
    chat: ChatSummary,
    events: EventWrapper<ChatEvent>[],
): string[] {
    if (chat.kind === "direct_chat") {
        return [chat.id.userId];
    }

    const activeUsers = getRecentlyActiveUsers(chat, events, MAX_RTC_CONNECTIONS_PER_CHAT);
    return activeUsers.has(myUserId) ? Array.from(activeUsers).filter((u) => u !== myUserId) : [];
}

export function makeRtcConnections(
    myUserId: string,
    chat: ChatSummary,
    events: EventWrapper<ChatEvent>[],
    lookup: UserLookup,
    meteredApiKey: string,
): void {
    const userIds = getUsersToMakeRtcConnectionsWith(myUserId, chat, events);
    if (userIds.length === 0) return;

    userIds
        .reduce((ids, id) => {
            if (lookup.get(id)?.kind === "user") {
                ids.push(id);
            }
            return ids;
        }, [] as string[])
        .forEach((userId) => {
            rtcConnectionsManager.create(myUserId, userId, meteredApiKey);
        });
}

// Returns the userId of the user who triggered the event
export function activeUserIdFromEvent(event: ChatEvent): string | undefined {
    switch (event.kind) {
        case "message":
            return event.sender;
        case "member_joined":
            return event.userId;
        case "name_changed":
        case "desc_changed":
        case "rules_changed":
        case "avatar_changed":
        case "role_changed":
        case "permissions_changed":
        case "group_visibility_changed":
        case "group_invite_code_changed":
            return event.changedBy;
        case "group_chat_created":
            return event.created_by;
        case "members_added":
        case "bot_added":
            return event.addedBy;
        case "members_removed":
        case "bot_removed":
            return event.removedBy;
        case "users_blocked":
            return event.blockedBy;
        case "users_unblocked":
            return event.unblockedBy;
        case "message_pinned":
            return event.pinnedBy;
        case "message_unpinned":
            return event.unpinnedBy;
        case "events_ttl_updated":
        case "external_url_updated":
        case "gate_updated":
        case "bot_updated":
            return event.updatedBy;
        case "users_invited":
            return event.invitedBy;
        case "aggregate_common_events":
        case "chat_frozen":
        case "chat_unfrozen":
        case "direct_chat_created":
        case "empty":
        case "member_left": // We exclude participant_left events since the user is no longer in the group
        case "members_added_to_default_channel":
            return undefined;
        default:
            console.warn("Unexpected ChatEvent type received", event);
            return undefined;
    }
}

export function getMinVisibleMessageIndex(chat: ChatSummary): number {
    if (chat.kind === "direct_chat") return 0;
    return chat.minVisibleMessageIndex;
}

export function messageIsReadByThem(chat: ChatSummary, messageIndex: number): boolean {
    if (chat.kind !== "direct_chat") return true;
    return chat.readByThemUpTo !== undefined && chat.readByThemUpTo >= messageIndex;
}

export function getMembersString(
    user: UserSummary,
    userLookup: UserLookup,
    memberIds: string[],
    unknownUser: string,
    you: string,
    compareUsersFn?: (u1: UserSummary, u2: UserSummary) => number,
    truncate = true,
): string {
    if (truncate && memberIds.length > 5) {
        return `${memberIds.length} members`;
    }
    const sorted = memberIds
        .map((id) => userLookup.get(id) ?? nullUser(unknownUser))
        .sort(compareUsersFn ?? compareUsername)
        .map((p) => `**${p.userId === user.userId ? you : p.displayName ?? p.username}**`);

    // TODO Improve i18n, don't hardcode 'and'
    return sorted.length > 1
        ? `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`
        : sorted.join();
}

export function createMessage(
    userId: string,
    messageIndex: number,
    content: MessageContent,
    blockLevelMarkdown: boolean,
    replyingTo: ReplyContext | undefined,
    forwarded: boolean,
): Message {
    return {
        kind: "message",
        content,
        sender: userId,
        repliesTo: replyingTo,
        messageId: random64(),
        messageIndex,
        reactions: [],
        tips: {},
        edited: false,
        forwarded,
        deleted: false,
        blockLevelMarkdown,
    };
}

function messageMentionsUser(
    formatter: MessageFormatter,
    userId: string,
    msg: EventWrapper<Message>,
): boolean {
    if (msg.event.sender === userId) return false;
    const txt = getContentAsFormattedText(formatter, msg.event.content, get(cryptoLookup));
    return txt.indexOf(`@UserId(${userId})`) >= 0;
}

function mentionsFromMessages(
    formatter: MessageFormatter,
    userId: string,
    messages: EventWrapper<Message>[],
): Mention[] {
    return messages.reduce((mentions, msg) => {
        if (messageMentionsUser(formatter, userId, msg)) {
            mentions.push({
                messageId: msg.event.messageId,
                messageIndex: msg.event.messageIndex,
                eventIndex: msg.index,
            });
        }
        return mentions;
    }, [] as Mention[]);
}

export function mergeUnconfirmedThreadsIntoSummary<T extends GroupChatSummary | ChannelSummary>(
    chat: T,
    unconfirmed: UnconfirmedMessages,
): T {
    if (chat.membership === undefined) return chat;
    return {
        ...chat,
        membership: {
            ...chat.membership,
            latestThreads: chat.membership.latestThreads.map((t) => {
                const context = {
                    chatId: chat.id,
                    threadRootMessageIndex: t.threadRootMessageIndex,
                };
                const unconfirmedMsgs = unconfirmed.get(context)?.messages ?? [];
                if (unconfirmedMsgs.length > 0) {
                    let msgIdx = t.latestMessageIndex;
                    let evtIdx = t.latestEventIndex;
                    const latestUnconfirmedMessage = unconfirmedMsgs[unconfirmedMsgs.length - 1];
                    if (latestUnconfirmedMessage.event.messageIndex > msgIdx) {
                        msgIdx = latestUnconfirmedMessage.event.messageIndex;
                    }
                    if (latestUnconfirmedMessage.index > evtIdx) {
                        evtIdx = latestUnconfirmedMessage.index;
                    }
                    return {
                        ...t,
                        latestEventIndex: evtIdx,
                        latestMessageIndex: msgIdx,
                    };
                }
                return t;
            }),
        },
    };
}

function scopeMatchesChat(scope: ChatListScope, chat: ChatSummary): boolean {
    switch (scope.kind) {
        case "community":
            return chat.kind === "channel" && chat.id.communityId === scope.id.communityId;
        case "group_chat":
            return chat.kind === "group_chat";
        case "direct_chat":
            return chat.kind === "direct_chat";
        case "favourite":
            return false;
        default:
            return true;
    }
}

export function mergeLocalSummaryUpdates(
    scope: ChatListScope,
    server: ChatMap<ChatSummary>,
    localUpdates: ChatMap<LocalChatSummaryUpdates>,
): ChatMap<ChatSummary> {
    if (Object.keys(localUpdates).length === 0) return server;

    const merged = server.clone();

    for (const [chatId, localUpdate] of localUpdates.entries()) {
        if (localUpdate.added !== undefined && scopeMatchesChat(scope, localUpdate.added)) {
            const current = merged.get(chatId);
            if (
                current === undefined ||
                isLapsed(current) ||
                (current.kind === "group_chat" && isPreviewing(current))
            ) {
                merged.set(chatId, localUpdate.added);
            }
        }
        if (localUpdate.updated !== undefined) {
            const current = merged.get(chatId);
            const updated = localUpdate.updated;
            if (current !== undefined) {
                const latestMessage =
                    (updated.latestMessage?.timestamp ?? BigInt(-1)) >
                    (current.latestMessage?.timestamp ?? BigInt(-1))
                        ? updated.latestMessage
                        : current.latestMessage;
                const latestEventIndex = Math.max(
                    latestMessage?.index ?? 0,
                    current.latestEventIndex,
                );

                if (updated.kind === undefined) {
                    merged.set(chatId, {
                        ...current,
                        latestMessage,
                        latestMessageIndex: latestMessage?.event.messageIndex,
                        latestEventIndex,
                        membership: {
                            ...current.membership,
                            notificationsMuted:
                                updated.notificationsMuted ?? current.membership.notificationsMuted,
                            archived: updated.archived ?? current.membership.archived,
                            rulesAccepted:
                                updated.rulesAccepted ?? current.membership.rulesAccepted,
                        },
                    });
                } else if (current.kind === updated.kind) {
                    const mergedGate = { ...current.gateConfig.gate, ...updated.gateConfig?.gate };
                    merged.set(chatId, {
                        ...current,
                        latestMessage,
                        latestMessageIndex: latestMessage?.event.messageIndex,
                        latestEventIndex,
                        name: updated.name ?? current.name,
                        description: updated.description ?? current.description,
                        public: updated.public ?? current.public,
                        permissions: mergePermissions(current.permissions, updated.permissions),
                        gateConfig: {
                            gate: mergedGate,
                            expiry: updated.gateConfig?.expiry ?? current.gateConfig.expiry,
                        },
                        membership: {
                            ...current.membership,
                            notificationsMuted:
                                updated.notificationsMuted ?? current.membership.notificationsMuted,
                            archived: updated.archived ?? current.membership.archived,
                            rulesAccepted:
                                updated.rulesAccepted ?? current.membership.rulesAccepted,
                        },
                        eventsTTL: updated.eventsTTL
                            ? updated.eventsTTL === "set_to_none"
                                ? undefined
                                : updated.eventsTTL.value
                            : current.eventsTTL,
                    });
                }
            }
        }
        if (localUpdate.removedAtTimestamp) {
            const chat = merged.get(chatId);
            if (
                chat !== undefined &&
                ((chat.kind === "direct_chat" &&
                    chat.dateCreated < localUpdate.removedAtTimestamp) ||
                    ((chat.kind === "group_chat" || chat.kind === "channel") &&
                        (chat.membership?.joined ?? BigInt(0)) < localUpdate.removedAtTimestamp))
            ) {
                merged.delete(chatId);
            }
        }
    }

    return merged;
}

export function mergeUnconfirmedIntoSummary(
    formatter: MessageFormatter,
    userId: string,
    chatSummary: ChatSummary,
    unconfirmed: UnconfirmedMessages,
    localUpdates: MessageMap<LocalMessageUpdates>,
    translations: MessageMap<string>,
    blockedUsers: Set<string>,
    currentUserId: string,
    messageFilters: MessageFilter[],
): ChatSummary {
    if (chatSummary.membership === undefined) return chatSummary;

    const unconfirmedMessages = unconfirmed.get({ chatId: chatSummary.id })?.messages;

    let latestMessage = chatSummary.latestMessage;
    let latestEventIndex = chatSummary.latestEventIndex;
    let mentions = chatSummary.membership.mentions ?? [];
    if (unconfirmedMessages != undefined && unconfirmedMessages.length > 0) {
        const incomingMentions = mentionsFromMessages(formatter, userId, unconfirmedMessages);
        mentions = mergeMentions(mentions, incomingMentions);
        const latestUnconfirmedMessage = unconfirmedMessages[unconfirmedMessages.length - 1];
        if (
            latestMessage === undefined ||
            latestUnconfirmedMessage.timestamp > latestMessage.timestamp
        ) {
            latestMessage = latestUnconfirmedMessage;
        }
        if (latestUnconfirmedMessage.index > latestEventIndex) {
            latestEventIndex = latestUnconfirmedMessage.index;
        }
    }
    if (latestMessage !== undefined) {
        const updates = localUpdates.get(latestMessage.event.messageId);
        const translation = translations.get(latestMessage.event.messageId);
        const senderBlocked = blockedUsers.has(latestMessage.event.sender);

        // Don't hide the sender's own messages
        const failedMessageFilter =
            latestMessage.event.sender !== currentUserId
                ? doesMessageFailFilter(latestMessage.event, messageFilters) !== undefined
                : false;

        if (
            updates !== undefined ||
            translation !== undefined ||
            senderBlocked ||
            failedMessageFilter
        ) {
            latestMessage = {
                ...latestMessage,
                event: mergeLocalUpdates(
                    latestMessage.event,
                    updates,
                    undefined,
                    undefined,
                    translation,
                    undefined,
                    senderBlocked,
                    false,
                    failedMessageFilter,
                ),
            };
        }
    }

    if (chatSummary.kind !== "direct_chat") {
        if (unconfirmedMessages !== undefined) {
            chatSummary = mergeUnconfirmedThreadsIntoSummary(chatSummary, unconfirmed);
        }
        return {
            ...chatSummary,
            latestMessage,
            latestEventIndex,
            membership: {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                ...chatSummary.membership!,
                mentions,
            },
        };
    } else {
        return {
            ...chatSummary,
            latestMessage,
            latestEventIndex,
        };
    }
}

function mergePermissions(
    current: ChatPermissions,
    updated?: OptionalChatPermissions,
): ChatPermissions {
    if (updated === undefined) {
        return current;
    }

    return {
        changeRoles: updated.changeRoles ?? current.changeRoles,
        updateGroup: updated.updateGroup ?? current.updateGroup,
        inviteUsers: updated.inviteUsers ?? current.inviteUsers,
        addMembers: updated.addMembers ?? current.addMembers,
        removeMembers: updated.removeMembers ?? current.removeMembers,
        deleteMessages: updated.deleteMessages ?? current.deleteMessages,
        pinMessages: updated.pinMessages ?? current.pinMessages,
        reactToMessages: updated.reactToMessages ?? current.reactToMessages,
        mentionAllMembers: updated.mentionAllMembers ?? current.mentionAllMembers,
        startVideoCall: updated.startVideoCall ?? current.startVideoCall,
        messagePermissions: mergeMessagePermissions(
            current.messagePermissions,
            updated.messagePermissions,
        ),
        threadPermissions: mergeThreadPermissions(
            current.threadPermissions ?? { default: "member" },
            updated.threadPermissions,
        ),
    };
}

function mergeMessagePermissions(
    current: MessagePermissions,
    updated?: OptionalMessagePermissions,
): MessagePermissions {
    if (updated === undefined) {
        return current;
    }

    return {
        default: updated.default ?? current.default,
        text: applyOptionUpdate(current.text, updated.text),
        image: applyOptionUpdate(current.image, updated.image),
        video: applyOptionUpdate(current.video, updated.video),
        audio: applyOptionUpdate(current.audio, updated.audio),
        file: applyOptionUpdate(current.file, updated.file),
        poll: applyOptionUpdate(current.poll, updated.poll),
        crypto: applyOptionUpdate(current.crypto, updated.crypto),
        giphy: applyOptionUpdate(current.giphy, updated.giphy),
        prize: applyOptionUpdate(current.prize, updated.prize),
        memeFighter: applyOptionUpdate(current.memeFighter, updated.memeFighter),
        p2pSwap: applyOptionUpdate(current.p2pSwap, updated.p2pSwap),
    };
}

function mergeThreadPermissions(
    current: MessagePermissions,
    updated: OptionUpdate<OptionalMessagePermissions>,
): MessagePermissions | undefined {
    if (updated === undefined) {
        return current;
    }

    if (updated === "set_to_none") {
        return undefined;
    }

    return mergeMessagePermissions(current, updated.value);
}

function mergeMentions(existing: Mention[], incoming: Mention[]): Mention[] {
    return [
        ...existing,
        ...incoming.filter(
            (m1) => existing.find((m2) => m1.messageId === m2.messageId) === undefined,
        ),
    ];
}

export function sameUser(a: EventWrapper<ChatEvent>, b: EventWrapper<ChatEvent>): boolean {
    if (a.event.kind === "message" && b.event.kind === "message") {
        return (
            a.event.sender === b.event.sender &&
            Math.abs(Number(b.timestamp - a.timestamp)) <
                MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS
        );
    }
    return false;
}

export function groupBySender<T extends ChatEvent>(events: EventWrapper<T>[]): EventWrapper<T>[][] {
    return groupWhile(sameUser, events);
}

export function groupEvents(
    events: EventWrapper<ChatEvent>[],
    myUserId: string,
    expandedDeletedMessages: Set<number>,
    reverse: boolean,
    groupInner?: (events: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[][],
): TimelineItem<ChatEvent>[] {
    return flattenTimeline(
        groupWhile(
            sameDate,
            events.filter((e) => !isEventKindHidden(e.event.kind)),
        )
            .map((e) => reduceJoinedOrLeft(e, myUserId, expandedDeletedMessages))
            .map(groupInner ?? groupBySender),
        reverse,
    );
}

export function flattenTimeline(
    grouped: EventWrapper<ChatEvent>[][][],
    reverse: boolean,
): TimelineItem<ChatEvent>[] {
    const timeline: TimelineItem<ChatEvent>[] = [];
    grouped.forEach((dayGroup) => {
        const date: TimelineItem<ChatEvent> = {
            kind: "timeline_date",
            timestamp: dayGroup[0][0]?.timestamp ?? 0,
        };
        const group: TimelineItem<ChatEvent> = {
            kind: "timeline_event_group",
            group: dayGroup,
        };
        if (reverse) {
            timeline.push(group, date);
        } else {
            timeline.push(date, group);
        }
    });
    return timeline;
}

export function isEventKindHidden(kind: ChatEvent["kind"]): boolean {
    switch (kind) {
        case "empty":
        case "message_pinned":
        case "message_unpinned":
        case "member_left":
        case "members_added_to_default_channel":
            return true;

        default:
            return false;
    }
}

function reduceJoinedOrLeft(
    events: EventWrapper<ChatEvent>[],
    myUserId: string,
    expandedDeletedMessages: Set<number>,
): EventWrapper<ChatEvent>[] {
    function getLatestAggregateEventIfExists(
        events: EventWrapper<ChatEvent>[],
    ): AggregateCommonEvents | undefined {
        if (events.length === 0) return undefined;
        const latest = events[events.length - 1];
        return latest.event.kind === "aggregate_common_events" ? latest.event : undefined;
    }

    return events.reduce((previous: EventWrapper<ChatEvent>[], e: EventWrapper<ChatEvent>) => {
        let newEvent = e;

        if (
            isEventKindHidden(e.event.kind) ||
            e.event.kind === "member_joined" ||
            e.event.kind === "role_changed" ||
            (e.event.kind === "message" &&
                messageIsHidden(e.event, myUserId, expandedDeletedMessages))
        ) {
            let agg = getLatestAggregateEventIfExists(previous);
            if (agg === undefined) {
                agg = {
                    kind: "aggregate_common_events",
                    usersJoined: new Set(),
                    usersLeft: new Set(),
                    rolesChanged: new Map(),
                    messagesDeleted: [],
                };
            } else {
                previous.pop();
            }

            if (e.event.kind === "member_joined") {
                if (agg.usersLeft.has(e.event.userId)) {
                    agg.usersLeft.delete(e.event.userId);
                } else {
                    agg.usersJoined.add(e.event.userId);
                }
            } else if (e.event.kind === "member_left") {
                if (agg.usersJoined.has(e.event.userId)) {
                    agg.usersJoined.delete(e.event.userId);
                } else {
                    agg.usersLeft.add(e.event.userId);
                }
            } else if (e.event.kind === "message") {
                agg.messagesDeleted.push(e.event.messageIndex);
            } else if (e.event.kind === "role_changed") {
                let changedByMap = agg.rolesChanged.get(e.event.changedBy);

                if (changedByMap === undefined) {
                    changedByMap = new Map();
                    agg.rolesChanged.set(e.event.changedBy, changedByMap);
                }

                // Build the set of users that have already had their role changed
                const alreadyChanged = new Set(
                    [...changedByMap.values()].flatMap((users) => Array.from(users)),
                );

                // Only add users who have not already had their role changed
                const usersToAdd = e.event.userIds.filter((userId) => !alreadyChanged.has(userId));

                if (usersToAdd.length > 0) {
                    let newRoleSet = changedByMap.get(e.event.newRole);

                    if (newRoleSet === undefined) {
                        newRoleSet = new Set();
                        changedByMap.set(e.event.newRole, newRoleSet);
                    }

                    for (const userId of usersToAdd) {
                        newRoleSet.add(userId);
                    }
                }
            }

            newEvent = {
                event: agg,
                timestamp: e.timestamp,
                index: e.index,
            };
        }

        previous.push(newEvent);

        return previous;
    }, []);
}

function messageIsHidden(message: Message, myUserId: string, expandedDeletedMessages: Set<number>) {
    if (message.content.kind === "message_reminder_created_content" && message.content.hidden) {
        return true;
    }

    return (
        (message.content.kind === "deleted_content" ||
            message.content.kind === "blocked_content") &&
        message.sender !== myUserId &&
        !expandedDeletedMessages.has(message.messageIndex) &&
        message.thread === undefined
    );
}

export function groupMessagesByDate(events: EventWrapper<Message>[]): EventWrapper<Message>[][] {
    return groupWhile(
        sameDate,
        events.filter((e) => !isEventKindHidden(e.event.kind)),
    );
}

export function getNextEventAndMessageIndexes(
    chat: ChatSummary,
    localMessages: EventWrapper<Message>[],
): [number, number] {
    let eventIndex = chat.latestEventIndex;
    let messageIndex = chat.latestMessage?.event.messageIndex ?? -1;
    if (localMessages.length > 0) {
        const lastUnconfirmed = localMessages[localMessages.length - 1];
        if (lastUnconfirmed.index > eventIndex) {
            eventIndex = lastUnconfirmed.index;
        }
        if (lastUnconfirmed.event.messageIndex > messageIndex) {
            messageIndex = lastUnconfirmed.event.messageIndex;
        }
    }
    return [eventIndex + 1, messageIndex + 1];
}

export function latestLoadedMessageIndex(events: EventWrapper<ChatEvent>[]): number | undefined {
    let idx = undefined;
    for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i].event;
        if (e.kind === "message") {
            idx = e.messageIndex;
            break;
        }
    }
    return idx;
}

export function latestAvailableEventIndex(chatSummary: ChatSummary): number | undefined {
    return chatSummary.latestEventIndex;
}

function sameDate(a: { timestamp: bigint }, b: { timestamp: bigint }): boolean {
    return areOnSameDay(new Date(Number(a.timestamp)), new Date(Number(b.timestamp)));
}

export function containsReaction(userId: string, reaction: string, reactions: Reaction[]): boolean {
    const r = reactions.find((r) => r.reaction === reaction);
    return r ? r.userIds.has(userId) : false;
}

// The current events list must already be sorted by ascending event index
export function mergeServerEvents(
    events: EventWrapper<ChatEvent>[],
    newEvents: EventWrapper<ChatEvent>[],
    messageContext: MessageContext,
): EventWrapper<ChatEvent>[] {
    updateReplyContexts(events, newEvents, messageContext);

    const merged = distinctBy([...newEvents, ...events], (e) => e.index);
    merged.sort(sortByTimestampThenEventIndex);
    return merged;
}

function updateReplyContexts(
    events: EventWrapper<ChatEvent>[],
    newEvents: EventWrapper<ChatEvent>[],
    messageContext: MessageContext,
) {
    if (events.length == 0) return;

    const lookup = toRecordFiltered(
        newEvents,
        (e) => e.index,
        (e) => e,
        (e) => e.event.kind === "message",
    );

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        if (
            event.event.kind === "message" &&
            event.event.repliesTo?.kind === "rehydrated_reply_context" &&
            (event.event.repliesTo.sourceContext === undefined ||
                messageContextsEqual(event.event.repliesTo.sourceContext, messageContext))
        ) {
            const updated = lookup[event.event.repliesTo.eventIndex];
            if (updated?.event.kind === "message") {
                events[i] = {
                    ...event,
                    event: {
                        ...event.event,
                        repliesTo: {
                            ...event.event.repliesTo,
                            content: updated.event.content,
                            edited: updated.event.edited,
                        },
                    },
                };
            }
        }
    }
}

function createMessageSortFunction(
    unconfirmed: Set<bigint>,
    recentlySent: Map<bigint, bigint>,
): (a: EventWrapper<ChatEvent>, b: EventWrapper<ChatEvent>) => number {
    return (a: EventWrapper<ChatEvent>, b: EventWrapper<ChatEvent>): number => {
        // If either message is still unconfirmed, and both were sent recently, use both of their local timestamps,
        // otherwise we will be comparing the local timestamp of one with the server timestamp of the other
        if (a.event.kind === "message" && b.event.kind === "message") {
            if (unconfirmed.has(a.event.messageId) || unconfirmed.has(b.event.messageId)) {
                const aTimestampOverride = recentlySent.get(a.event.messageId);
                const bTimestampOverride = recentlySent.get(b.event.messageId);

                if (aTimestampOverride && bTimestampOverride) {
                    return aTimestampOverride > bTimestampOverride ? 1 : -1;
                }
            }
        }

        return sortByTimestampThenEventIndex(a, b);
    };
}

function sortByTimestampThenEventIndex(
    a: EventWrapper<ChatEvent>,
    b: EventWrapper<ChatEvent>,
): number {
    if (a.timestamp === b.timestamp) return a.index - b.index;
    return Number(a.timestamp - b.timestamp);
}

export function serialiseMessageForRtc(messageEvent: EventWrapper<Message>): EventWrapper<Message> {
    if (isAttachmentContent(messageEvent.event.content)) {
        return {
            ...messageEvent,
            event: {
                ...messageEvent.event,
                content: {
                    kind: "placeholder_content",
                },
            },
        };
    }
    return messageEvent;
}

export function groupChatFromCandidate(
    chatId: MultiUserChatIdentifier,
    candidate: CandidateGroupChat,
): MultiUserChat {
    const chat = {
        kind: chatId.kind,
        id: chatId,
        latestEventIndex: 0,
        latestMessage: undefined,
        name: candidate.name,
        description: candidate.description,
        public: candidate.public,
        historyVisible: candidate.historyVisible,
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        lastUpdated: BigInt(0),
        memberCount: candidate.members.length + 1, // +1 to include us
        ...candidate.avatar,
        permissions: candidate.permissions,
        metrics: emptyChatMetrics(),
        subtype: undefined,
        previewed: false,
        frozen: false,
        dateLastPinned: undefined,
        dateReadPinned: undefined,
        gateConfig: candidate.gateConfig,
        level: "group",
        membership: {
            ...nullMembership(),
            joined: BigInt(Date.now()),
            role: "owner",
        },
        eventsTTL: candidate.eventsTTL,
    } as MultiUserChat;

    if (chat.kind === "channel") {
        chat.externalUrl = candidate.externalUrl;
    }

    return chat;
}

function updatePollContent(content: PollContent, votes: LocalPollVote[]): PollContent {
    for (const vote of votes) {
        content = {
            ...content,
            votes: updatePollVotes(vote.userId, content, vote.answerIndex, vote.type),
        };
    }
    return content;
}

export function updatePollVotes(
    userId: string,
    poll: PollContent,
    answerIdx: number,
    type: "register" | "delete",
): PollVotes {
    return type === "delete"
        ? removeVoteFromPoll(userId, answerIdx, poll.votes)
        : addVoteToPoll(userId, answerIdx, poll);
}

export function addVoteToPoll(
    userId: string,
    answerIdx: number,
    { votes, config }: PollContent,
): PollVotes {
    if (votes.user.includes(answerIdx)) {
        // can't vote for the same thing twice
        return votes;
    }

    let updatedVotes = JSON.parse(JSON.stringify(votes));

    // update the total votes
    if (updatedVotes.total.kind === "anonymous_poll_votes") {
        if (updatedVotes.total.votes[answerIdx] === undefined) {
            updatedVotes.total.votes[answerIdx] = 0;
        }
        updatedVotes.total.votes[answerIdx] = updatedVotes.total.votes[answerIdx] + 1;
    }

    if (updatedVotes.total.kind === "hidden_poll_votes") {
        updatedVotes.total.votes = updatedVotes.total.votes + 1;
    }

    if (updatedVotes.total.kind === "visible_poll_votes") {
        if (updatedVotes.total.votes[answerIdx] === undefined) {
            updatedVotes.total.votes[answerIdx] = [];
        }
        updatedVotes.total.votes[answerIdx].push(userId);
    }

    if (!config.allowMultipleVotesPerUser) {
        // if we are only allowed a single vote then we also need
        // to remove anything we may previously have voted for
        const previousVote = updatedVotes.user[0];
        if (previousVote !== undefined) {
            updatedVotes = removeVoteFromPoll(userId, previousVote, updatedVotes);
        }
    }

    updatedVotes.user.push(answerIdx);

    return updatedVotes;
}

export function removeVoteFromPoll(userId: string, answerIdx: number, votes: PollVotes): PollVotes {
    votes.user = votes.user.filter((i) => i !== answerIdx);
    if (votes.total.kind === "anonymous_poll_votes") {
        votes.total.votes[answerIdx] = votes.total.votes[answerIdx] - 1;
    }
    if (votes.total.kind === "hidden_poll_votes") {
        votes.total.votes = votes.total.votes - 1;
    }
    if (votes.total.kind === "visible_poll_votes") {
        votes.total.votes[answerIdx] = votes.total.votes[answerIdx].filter((u) => u !== userId);
    }
    votes.user = votes.user.filter((a) => a !== answerIdx);
    return votes;
}

export function canImportToCommunity(chat: ChatSummary): boolean {
    return chat.kind === "group_chat" && !chat.frozen && hasOwnerRights(chat.membership.role);
}

export function canChangePermissions(chat: ChatSummary): boolean {
    return (
        (chat.kind === "group_chat" || chat.kind === "channel") &&
        chat.membership !== undefined &&
        !chat.frozen &&
        hasOwnerRights(chat.membership.role)
    );
}

export function canChangeRoles(
    chat: ChatSummary,
    currRole: MemberRole,
    newRole: MemberRole,
): boolean {
    if (chat.kind === "direct_chat" || currRole === newRole || chat.frozen) {
        return false;
    }

    switch (newRole) {
        case "owner":
            return hasOwnerRights(chat.membership.role);
        default:
            return isPermitted(chat.membership.role, chat.permissions.changeRoles);
    }
}

export function canRemoveMembers(chat: ChatSummary): boolean {
    if (chat.kind !== "direct_chat") {
        return !chat.frozen && isPermitted(chat.membership.role, chat.permissions.removeMembers);
    } else {
        return false;
    }
}

export function canBlockUsers(chat: ChatSummary): boolean {
    if (chat.kind !== "direct_chat") {
        return (
            chat.public &&
            !chat.frozen &&
            isPermitted(chat.membership.role, chat.permissions.removeMembers)
        );
    } else {
        return true;
    }
}

export function canUnblockUsers(chat: ChatSummary): boolean {
    if (chat.kind !== "direct_chat") {
        return (
            chat.public &&
            !chat.frozen &&
            isPermitted(chat.membership.role, chat.permissions.removeMembers)
        );
    } else {
        return true;
    }
}

export function canDeleteOtherUsersMessages(chat: ChatSummary): boolean {
    if (chat.kind !== "direct_chat") {
        return !chat.frozen && isPermitted(chat.membership.role, chat.permissions.deleteMessages);
    } else {
        return true;
    }
}

export function canEditGroupDetails(chat: ChatSummary): boolean {
    if (chat.kind !== "direct_chat" && !chat.frozen) {
        return isPermitted(chat.membership.role, chat.permissions.updateGroup);
    } else {
        return false;
    }
}

export function canStartVideoCalls(chat: ChatSummary, userLookup: UserLookup): boolean {
    if (chat.kind === "direct_chat") {
        const user = userLookup.get(chat.them.userId);
        return user !== undefined && user.kind === "user";
    } else {
        return !chat.frozen && isPermitted(chat.membership.role, chat.permissions.startVideoCall);
    }
}

export function canPinMessages(chat: ChatSummary): boolean {
    if (chat.kind !== "direct_chat" && !chat.frozen) {
        return isPermitted(chat.membership.role, chat.permissions.pinMessages);
    } else {
        return false;
    }
}

export function canInviteUsers(chat: ChatSummary): boolean {
    return (
        chat.kind !== "direct_chat" &&
        !chat.frozen &&
        isPermitted(chat.membership.role, chat.permissions.inviteUsers)
    );
}

export function canAddMembers(chat: ChatSummary): boolean {
    return (
        chat.kind === "channel" &&
        !chat.frozen &&
        isPermitted(chat.membership.role, chat.permissions.addMembers)
    );
}

export function permittedMessagesInGroup(
    user: CreatedUser,
    chat: MultiUserChat,
    mode: "message" | "thread",
): Map<MessagePermission, boolean> {
    return new Map(
        messagePermissionsList.map((m: MessagePermission) => [
            m,
            canSendGroupMessage(user, chat, mode, m),
        ]),
    );
}

const PERMISSIONS_BLOCKED_FOR_NEW_USERS: MessagePermission[] = [
    "audio",
    "file",
    "giphy",
    "image",
    "video",
];

export function canSendGroupMessage(
    user: CreatedUser,
    chat: MultiUserChat,
    mode: "message" | "thread" | "any",
    permission?: MessagePermission,
): boolean {
    if (mode === "any") {
        return (
            canSendGroupMessage(user, chat, "message", permission) ||
            canSendGroupMessage(user, chat, "thread", permission)
        );
    }

    if (permission === undefined) {
        return messagePermissionsList.some((mp: MessagePermission) =>
            canSendGroupMessage(user, chat, mode, mp as MessagePermission),
        );
    }

    const messagePermissions =
        mode === "thread"
            ? chat.permissions.threadPermissions ?? chat.permissions.messagePermissions
            : chat.permissions.messagePermissions;

    if (permission === "prize" && mode === "thread") {
        return false;
    }

    if (
        chat.public &&
        user.diamondStatus.kind === "inactive" &&
        PERMISSIONS_BLOCKED_FOR_NEW_USERS.includes(permission)
    ) {
        const isNewUser = Date.now() - Number(user.dateCreated) < 24 * 60 * 60 * 1000; // 1 day
        if (isNewUser) {
            return false;
        }
    }

    return (
        !chat.frozen &&
        isPermitted(
            chat.membership.role,
            messagePermissions[permission] ?? messagePermissions.default,
        )
    );
}

export function permittedMessagesInDirectChat(
    recipient: UserSummary,
    mode: "message" | "thread",
    proposalsBotUserId: string,
): Map<MessagePermission, boolean> {
    return new Map(
        messagePermissionsList.map((m: MessagePermission) => [
            m,
            canSendDirectMessage(recipient, mode, proposalsBotUserId, m),
        ]),
    );
}

export function canSendDirectMessage(
    recipient: UserSummary,
    mode: "message" | "thread" | "any",
    proposalsBotUserId: string,
    permission?: MessagePermission,
): boolean {
    if (mode === "thread") {
        return false;
    }

    if (recipient.suspended) {
        return false;
    }

    if (
        (recipient.kind === "bot" && recipient.userId === OPENCHAT_BOT_USER_ID) ||
        recipient.userId === proposalsBotUserId
    ) {
        return false;
    }

    return permission !== "poll" && permission !== "prize";
}

export function canReactToMessages(chat: ChatSummary): boolean {
    if (chat.kind !== "direct_chat") {
        return !chat.frozen && isPermitted(chat.membership.role, chat.permissions.reactToMessages);
    } else {
        return true;
    }
}

export function canMentionAllMembers(chat: ChatSummary): boolean {
    if (chat.kind !== "direct_chat" && !chat.frozen) {
        return isPermitted(chat.membership.role, chat.permissions.mentionAllMembers);
    } else {
        return false;
    }
}

export function canLeaveGroup(thing: AccessControlled & HasMembershipRole): boolean {
    if (!thing.frozen) {
        // TODO - this is not really correct - you should be able to leave if you are not the *only* owner
        return thing.membership.role !== "owner";
    } else {
        return false;
    }
}

export function canDeleteGroup(thing: AccessControlled & HasMembershipRole): boolean {
    return !thing.frozen && hasOwnerRights(thing.membership.role);
}

export function canConvertToCommunity(thing: AccessControlled & HasMembershipRole): boolean {
    return !thing.frozen && hasOwnerRights(thing.membership.role);
}

export function canChangeVisibility(thing: AccessControlled & HasMembershipRole): boolean {
    return !thing.frozen && hasOwnerRights(thing.membership.role);
}

export function mergeChatMetrics(a: Metrics, b: Metrics): Metrics {
    return {
        audioMessages: a.audioMessages + b.audioMessages,
        edits: a.edits + b.edits,
        icpMessages: a.icpMessages + b.icpMessages,
        sns1Messages: a.sns1Messages + b.sns1Messages,
        ckbtcMessages: a.ckbtcMessages + b.ckbtcMessages,
        giphyMessages: a.giphyMessages + b.giphyMessages,
        deletedMessages: a.deletedMessages + b.deletedMessages,
        reportedMessages: a.reportedMessages + b.reportedMessages,
        fileMessages: a.fileMessages + b.fileMessages,
        pollVotes: a.pollVotes + b.pollVotes,
        textMessages: a.textMessages + b.textMessages,
        imageMessages: a.imageMessages + b.imageMessages,
        replies: a.replies + b.replies,
        videoMessages: a.videoMessages + b.videoMessages,
        polls: a.polls + b.polls,
        reactions: a.reactions + b.reactions,
    };
}

export function metricsEqual(a: Metrics, b: Metrics): boolean {
    return Object.keys(a).reduce<boolean>(
        (same, k) => same && a[k as keyof Metrics] === b[k as keyof Metrics],
        true,
    );
}

export function canForward(content: MessageContent): boolean {
    return (
        content.kind !== "bot_placeholder_content" &&
        content.kind !== "crypto_content" &&
        content.kind !== "deleted_content" &&
        content.kind !== "poll_content" &&
        content.kind !== "placeholder_content" &&
        content.kind !== "prize_content" &&
        content.kind !== "proposal_content" &&
        content.kind !== "video_call_content"
    );
}

export function buildUserAvatarUrl(pattern: string, userId: string, avatarId?: bigint): string {
    return avatarId !== undefined
        ? buildBlobUrl(pattern, userId, avatarId, "avatar")
        : userId === OPENCHAT_BOT_USER_ID
          ? OPENCHAT_BOT_AVATAR_URL
          : userId === OPENCHAT_VIDEO_CALL_USER_ID
            ? OPENCHAT_VIDEO_CALL_AVATAR_URL
            : buildIdenticonUrl(userId);
}

export function buildBlobUrl(
    pattern: string,
    canisterId: string,
    blobId: bigint,
    blobType: "blobs" | "avatar",
): string {
    return `${pattern
        .replace("{canisterId}", canisterId)
        .replace("{blobType}", blobType)}/${blobId}`;
}

export function buildIdenticonUrl(id: string): string {
    if (!id) return "";
    const identicon = new Identicon(md5(id), {
        margin: 0,
        format: "svg",
    });
    return `data:image/svg+xml;base64,${identicon}`;
}

export function mergeSendMessageResponse(
    msg: Message,
    resp: SendMessageSuccess | TransferSuccess,
): EventWrapper<Message> {
    const content = resp.kind === "transfer_success" && msg.content.kind === "crypto_content"
        ? {
            ...msg.content,
            transfer: resp.transfer,
        }
        : msg.content;

    return {
        index: resp.eventIndex,
        timestamp: resp.timestamp,
        expiresAt: resp.expiresAt,
        event: {
            ...msg,
            content,
            messageIndex: resp.messageIndex,
        },
    };
}

export function mergeEventsAndLocalUpdates(
    events: EventWrapper<ChatEvent>[],
    unconfirmed: EventWrapper<Message>[],
    localUpdates: MessageMap<LocalMessageUpdates>,
    expiredEventRanges: DRange,
    proposalTallies: Record<string, Tally>,
    translations: MessageMap<string>,
    blockedUsers: Set<string>,
    currentUserId: string,
    messageFilters: MessageFilter[],
    recentlySentMessages: Map<bigint, bigint>,
): EventWrapper<ChatEvent>[] {
    const eventIndexes = new DRange();
    eventIndexes.add(expiredEventRanges);
    const confirmedMessageIds = new Set<bigint>();

    function processEvent(e: EventWrapper<ChatEvent>): EventWrapper<ChatEvent> {
        eventIndexes.add(e.index);

        if (e.event.kind === "message") {
            confirmedMessageIds.add(e.event.messageId);
            const updates = localUpdates.get(e.event.messageId);
            const translation = translations.get(e.event.messageId);

            const repliesTo =
                e.event.repliesTo?.kind === "rehydrated_reply_context"
                    ? e.event.repliesTo.messageId
                    : undefined;

            const [replyContextUpdates, replyTranslation] =
                repliesTo !== undefined
                    ? [localUpdates.get(repliesTo), translations.get(repliesTo)]
                    : [undefined, undefined];

            const tallyUpdate =
                e.event.content.kind === "proposal_content"
                    ? proposalTallies[
                          tallyKey(
                              e.event.content.governanceCanisterId,
                              e.event.content.proposal.id,
                          )
                      ]
                    : undefined;

            const senderBlocked = blockedUsers.has(e.event.sender);
            const repliesToSenderBlocked =
                e.event.repliesTo?.kind === "rehydrated_reply_context" &&
                blockedUsers.has(e.event.repliesTo.senderId);

            // Don't hide the sender's own messages
            const failedMessageFilter =
                e.event.sender !== currentUserId
                    ? doesMessageFailFilter(e.event, messageFilters) !== undefined
                    : false;

            if (
                updates !== undefined ||
                replyContextUpdates !== undefined ||
                tallyUpdate !== undefined ||
                translation !== undefined ||
                replyTranslation !== undefined ||
                senderBlocked ||
                repliesToSenderBlocked ||
                failedMessageFilter
            ) {
                return {
                    ...e,
                    event: mergeLocalUpdates(
                        e.event,
                        updates,
                        replyContextUpdates,
                        tallyUpdate,
                        translation,
                        replyTranslation,
                        senderBlocked,
                        repliesToSenderBlocked,
                        failedMessageFilter,
                    ),
                };
            }
        }
        return e;
    }
    const merged = events.map((e) => processEvent(e));

    if (unconfirmed.length > 0) {
        unconfirmed.sort(sortByTimestampThenEventIndex);

        const unconfirmedAdded = new Set<bigint>();
        for (const message of unconfirmed) {
            // Only include unconfirmed events that are either contiguous with the loaded confirmed events, or are the
            // first events in a new chat
            if (
                !confirmedMessageIds.has(message.event.messageId) &&
                ((eventIndexes.length === 0 && message.index <= 1) ||
                    eventIndexes
                        .subranges()
                        .some((s) => s.low - 1 <= message.index && message.index <= s.high + 1))
            ) {
                merged.push(processEvent(message));
                unconfirmedAdded.add(message.event.messageId);
            }
        }
        if (unconfirmedAdded.size > 0) {
            const sortFn = createMessageSortFunction(unconfirmedAdded, recentlySentMessages);
            merged.sort(sortFn);
        }
    }

    return merged;
}

export function doesMessageFailFilter(
    message: Message,
    filters: MessageFilter[],
): bigint | undefined {
    const text = getContentAsText(message.content);

    if (text !== undefined) {
        for (const f of filters) {
            if (f.regex.test(text)) {
                return f.id;
            }
        }
    }
}

function mergeLocalUpdates(
    message: Message,
    localUpdates: LocalMessageUpdates | undefined,
    replyContextLocalUpdates: LocalMessageUpdates | undefined,
    tallyUpdate: Tally | undefined,
    translation: string | undefined,
    replyTranslation: string | undefined,
    senderBlocked: boolean,
    repliesToSenderBlocked: boolean,
    failedMessageFilter: boolean,
): Message {
    if (localUpdates?.deleted !== undefined) {
        return {
            ...message,
            deleted: true,
            content: {
                kind: "deleted_content",
                deletedBy: localUpdates.deleted.deletedBy,
                timestamp: localUpdates.deleted.timestamp,
            },
        };
    }

    if (
        localUpdates?.hiddenMessageRevealed !== true &&
        message.content.kind !== "deleted_content" &&
        (senderBlocked || failedMessageFilter)
    ) {
        return {
            ...message,
            content: {
                kind: "blocked_content",
            },
        };
    }

    message = { ...message };

    if (localUpdates?.cancelledReminder !== undefined) {
        message.content = localUpdates.cancelledReminder;
    }

    if (localUpdates?.editedContent !== undefined) {
        message.content = localUpdates.editedContent;
        if (!localUpdates.linkRemoved) {
            message.edited = true;
        }
    }

    if (localUpdates?.undeletedContent !== undefined) {
        message.content = localUpdates.undeletedContent;
        message.deleted = false;
    }

    if (localUpdates?.revealedContent !== undefined) {
        message.content = localUpdates.revealedContent;
        message.deleted = true;
    }

    if (localUpdates?.prizeClaimed !== undefined) {
        if (message.content.kind === "prize_content") {
            if (!message.content.winners.includes(localUpdates.prizeClaimed)) {
                message.content = { ...message.content };
                message.content.winners.push(localUpdates.prizeClaimed);
                message.content.prizesRemaining -= 1;
                message.content.prizesPending += 1;
            }
        }
    }

    if (localUpdates?.blockLevelMarkdown !== undefined) {
        message.blockLevelMarkdown = localUpdates.blockLevelMarkdown;
    }

    if (localUpdates?.p2pSwapStatus !== undefined && message.content.kind === "p2p_swap_content") {
        message.content = {
            ...message.content,
            status: localUpdates.p2pSwapStatus,
        };
    }

    if (localUpdates?.reactions !== undefined) {
        let reactions = [...message.reactions];
        for (const localReaction of localUpdates.reactions) {
            reactions = applyLocalReaction(localReaction, reactions);
        }
        message.reactions = reactions;
    }

    if (localUpdates?.tips !== undefined) {
        message.tips = mergeLocalTips(message.tips, localUpdates.tips);
    }

    if (localUpdates?.pollVotes !== undefined && message.content.kind === "poll_content") {
        message.content = updatePollContent(message.content, localUpdates.pollVotes);
    }

    if (localUpdates?.threadSummary !== undefined) {
        const current = message.thread ?? defaultThreadSummary();
        const participantIds = new Set<string>([
            ...current.participantIds,
            ...(localUpdates.threadSummary.participantIds ?? []),
        ]);

        message.thread = {
            participantIds,
            followedByMe: localUpdates.threadSummary.followedByMe ?? current.followedByMe,
            numberOfReplies: Math.max(
                localUpdates.threadSummary.numberOfReplies ?? 0,
                current.numberOfReplies,
            ),
            latestEventIndex: Math.max(
                localUpdates.threadSummary.latestEventIndex ?? 0,
                current.latestEventIndex,
            ),
            latestEventTimestamp: bigIntMax(
                localUpdates.threadSummary.latestEventTimestamp ?? BigInt(0),
                current.latestEventTimestamp,
            ),
        };
    }

    if (
        message.repliesTo?.kind === "rehydrated_reply_context" &&
        (replyContextLocalUpdates !== undefined ||
            replyTranslation !== undefined ||
            repliesToSenderBlocked)
    ) {
        if (replyContextLocalUpdates?.deleted !== undefined) {
            message.repliesTo = {
                ...message.repliesTo,
                content: {
                    kind: "deleted_content",
                    deletedBy: replyContextLocalUpdates.deleted.deletedBy,
                    timestamp: replyContextLocalUpdates.deleted.timestamp,
                },
            };
        } else if (
            repliesToSenderBlocked &&
            replyContextLocalUpdates?.hiddenMessageRevealed !== true
        ) {
            message.repliesTo = {
                ...message.repliesTo,
                content: {
                    kind: "blocked_content",
                },
            };
        } else {
            message.repliesTo = { ...message.repliesTo };

            if (replyContextLocalUpdates?.editedContent !== undefined) {
                message.repliesTo.content = replyContextLocalUpdates.editedContent;
            }
            if (replyContextLocalUpdates?.revealedContent !== undefined) {
                message.repliesTo.content = replyContextLocalUpdates.revealedContent;
            }
            if (
                replyContextLocalUpdates?.pollVotes !== undefined &&
                message.repliesTo.content.kind === "poll_content"
            ) {
                message.repliesTo.content = updatePollContent(
                    message.repliesTo.content,
                    replyContextLocalUpdates.pollVotes,
                );
            }
            if (replyTranslation !== undefined) {
                message.repliesTo.content = applyTranslation(
                    message.repliesTo.content,
                    replyTranslation,
                );
            }
        }
    }

    if (
        tallyUpdate !== undefined &&
        message.content.kind === "proposal_content" &&
        tallyUpdate.timestamp > message.content.proposal.tally.timestamp
    ) {
        message.content = {
            ...message.content,
            proposal: {
                ...message.content.proposal,
                tally: tallyUpdate,
            },
        };
    }

    if (translation !== undefined) {
        message.content = applyTranslation(message.content, translation);
    }
    return message;
}

export function mergeLocalTips(existing?: TipsReceived, local?: TipsReceived): TipsReceived {
    const merged: TipsReceived = {};
    for (const ledger in existing) {
        merged[ledger] = { ...existing[ledger] };
    }
    for (const ledger in local) {
        if (!merged[ledger]) {
            merged[ledger] = {};
        }
        for (const userId in local[ledger]) {
            merged[ledger][userId] = local[ledger][userId];
        }
    }
    return merged;
}

function defaultThreadSummary(): ThreadSummary {
    return {
        participantIds: new Set<string>(),
        followedByMe: false,
        numberOfReplies: 0,
        latestEventIndex: 0,
        latestEventTimestamp: BigInt(0),
    };
}

function applyTranslation(content: MessageContent, translation: string): MessageContent {
    switch (content.kind) {
        case "text_content": {
            return {
                ...content,
                text: translation,
            };
        }
        case "audio_content":
        case "image_content":
        case "video_content":
        case "file_content":
        case "crypto_content": {
            return {
                ...content,
                caption: translation,
            };
        }

        case "poll_content": {
            return {
                ...content,
                config: {
                    ...content.config,
                    text: translation,
                },
            };
        }

        case "proposal_content": {
            return {
                ...content,
                proposal: {
                    ...content.proposal,
                    summary: translation,
                },
            };
        }

        default:
            return content;
    }
}

export function applyLocalReaction(local: LocalReaction, reactions: Reaction[]): Reaction[] {
    const r = reactions.find((r) => r.reaction === local.reaction);
    if (r === undefined) {
        if (local.kind === "add") {
            reactions.push({ reaction: local.reaction, userIds: new Set([local.userId]) });
        }
    } else {
        if (local.kind === "add") {
            r.userIds.add(local.userId);
        } else {
            r.userIds.delete(local.userId);
            if (r.userIds.size === 0) {
                reactions = reactions.filter((r) => r.reaction !== local.reaction);
            }
        }
    }
    return reactions;
}

export function findMessageById(
    messageId: bigint,
    events: EventWrapper<ChatEvent>[],
): EventWrapper<Message> | undefined {
    for (const event of events) {
        if (event.event.kind === "message" && event.event.messageId === messageId) {
            return event as EventWrapper<Message>;
        }
    }
    return undefined;
}

export function buildTransactionLink(
    formatter: MessageFormatter,
    transfer: CryptocurrencyTransfer,
    cryptoLookup: Record<string, CryptocurrencyDetails>,
): string | undefined {
    const url = buildTransactionUrl(transfer, cryptoLookup);
    return url !== undefined
        ? formatter("tokenTransfer.viewTransaction", { values: { url } })
        : undefined;
}

export function buildTransactionUrl(
    transfer: CryptocurrencyTransfer,
    cryptoLookup: Record<string, CryptocurrencyDetails>,
): string | undefined {
    if (transfer.kind === "completed") {
        return buildTransactionUrlByIndex(transfer.blockIndex, transfer.ledger, cryptoLookup);
    }
}

export function buildTransactionUrlByIndex(
    transactionIndex: bigint,
    ledger: string,
    cryptoLookup: Record<string, CryptocurrencyDetails>,
): string | undefined {
    return cryptoLookup[ledger].transactionUrlFormat.replace(
        "{transaction_index}",
        transactionIndex.toString(),
    );
}

export function buildCryptoTransferText(
    formatter: MessageFormatter,
    myUserId: string,
    senderId: string,
    content: CryptocurrencyContent,
    me: boolean,
    cryptoLookup: Record<string, CryptocurrencyDetails>,
): string | undefined {
    if (content.transfer.kind !== "completed" && content.transfer.kind !== "pending") {
        return undefined;
    }

    function username(userId: string): string {
        return userId === myUserId ? formatter("you") : `@UserId(${userId})`;
    }

    const tokenDetails = cryptoLookup[content.transfer.ledger];

    const values = {
        amount: formatTokens(content.transfer.amountE8s, tokenDetails.decimals),
        receiver: username(content.transfer.recipient),
        sender: username(senderId),
        token: tokenDetails.symbol,
    };

    const key =
        content.transfer.kind === "completed"
            ? "confirmedSent"
            : me
              ? "pendingSentByYou"
              : "pendingSent";

    return formatter(`tokenTransfer.${key}`, { values });
}

export function stopTyping(
    { id }: ChatSummary,
    userId: string,
    threadRootMessageIndex?: number,
): void {
    rtcConnectionsManager.sendMessage([...get(currentChatUserIds)], {
        kind: "remote_user_stopped_typing",
        id,
        userId,
        threadRootMessageIndex,
    });
}

export function startTyping(
    { id }: ChatSummary,
    userId: string,
    threadRootMessageIndex?: number,
): void {
    rtcConnectionsManager.sendMessage([...get(currentChatUserIds)], {
        kind: "remote_user_typing",
        id,
        userId,
        threadRootMessageIndex,
    });
}

export function getTypingString(
    formatter: MessageFormatter,
    users: UserLookup,
    key: MessageContext,
    typing: TypersByKey,
): string | undefined {
    const typers = typing.get(key);
    if (typers === undefined || typers.size === 0) return undefined;

    if (typers.size > 1) {
        return formatter("membersAreTyping", { values: { number: typers.size } });
    } else {
        const userIds = [...typers];
        const username = users.get(userIds[0])?.username ?? formatter("unknown");
        return formatter("memberIsTyping", { values: { username } });
    }
}

export function getMessageText(content: MessageContent): string | undefined {
    switch (content.kind) {
        case "text_content":
            return content.text;

        case "audio_content":
        case "image_content":
        case "video_content":
        case "file_content":
        case "crypto_content":
            return content.caption;

        case "poll_content":
            return content.config.text;

        case "proposal_content":
            return content.proposal.summary;

        default:
            return undefined;
    }
}

export function diffGroupPermissions(
    original: ChatPermissions,
    updated: ChatPermissions,
): OptionalChatPermissions | undefined {
    if (JSON.stringify(original) === JSON.stringify(updated)) {
        return undefined;
    }

    const diff: OptionalChatPermissions = defaultOptionalChatPermissions();

    if (original.changeRoles !== updated.changeRoles) {
        diff.changeRoles = updated.changeRoles;
    }
    if (original.updateGroup !== updated.updateGroup) {
        diff.updateGroup = updated.updateGroup;
    }
    if (original.inviteUsers !== updated.inviteUsers) {
        diff.inviteUsers = updated.inviteUsers;
    }
    if (original.addMembers !== updated.addMembers) {
        diff.addMembers = updated.addMembers;
    }
    if (original.removeMembers !== updated.removeMembers) {
        diff.removeMembers = updated.removeMembers;
    }
    if (original.deleteMessages !== updated.deleteMessages) {
        diff.deleteMessages = updated.deleteMessages;
    }
    if (original.startVideoCall !== updated.startVideoCall) {
        diff.startVideoCall = updated.startVideoCall;
    }
    if (original.pinMessages !== updated.pinMessages) {
        diff.pinMessages = updated.pinMessages;
    }
    if (original.reactToMessages !== updated.reactToMessages) {
        diff.reactToMessages = updated.reactToMessages;
    }
    if (original.mentionAllMembers !== updated.mentionAllMembers) {
        diff.mentionAllMembers = updated.mentionAllMembers;
    }

    diff.messagePermissions = diffMessagePermissions(
        original.messagePermissions,
        updated.messagePermissions,
    );

    if (original.threadPermissions === undefined && updated.threadPermissions === undefined) {
        diff.threadPermissions = undefined;
    } else if (updated.threadPermissions === undefined) {
        diff.threadPermissions = "set_to_none";
    } else {
        const threadPermissionsDiff = diffMessagePermissions(
            original.threadPermissions ?? { default: "member" },
            updated.threadPermissions,
        );
        diff.threadPermissions =
            threadPermissionsDiff === undefined ? undefined : { value: threadPermissionsDiff };
    }

    return diff;
}

function diffMessagePermissions(
    original: MessagePermissions,
    updated: MessagePermissions,
): OptionalMessagePermissions | undefined {
    if (JSON.stringify(original) === JSON.stringify(updated)) {
        return undefined;
    }

    const diff: OptionalMessagePermissions = defaultOptionalMessagePermissions();

    diff.default = original.default !== updated.default ? updated.default : undefined;
    diff.text = updateFromOptions(original.text, updated.text);
    diff.image = updateFromOptions(original.image, updated.image);
    diff.video = updateFromOptions(original.video, updated.video);
    diff.audio = updateFromOptions(original.audio, updated.audio);
    diff.file = updateFromOptions(original.file, updated.file);
    diff.poll = updateFromOptions(original.poll, updated.poll);
    diff.crypto = updateFromOptions(original.crypto, updated.crypto);
    diff.giphy = updateFromOptions(original.giphy, updated.giphy);
    diff.prize = updateFromOptions(original.prize, updated.prize);
    diff.memeFighter = updateFromOptions(original.memeFighter, updated.memeFighter);
    diff.p2pSwap = updateFromOptions(original.p2pSwap, updated.p2pSwap);

    return diff;
}

export function isProposalsChat(chat: ChatSummary): chat is ChatSummary & {
    subtype: GovernanceProposalsSubtype;
} {
    return chat.kind !== "direct_chat" && chat.subtype?.kind === "governance_proposals";
}
