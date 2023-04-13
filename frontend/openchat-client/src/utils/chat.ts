import { compareUsername, nullUser } from "./user";
import {
    ChatSummary,
    EventWrapper,
    GroupChatSummary,
    MessageContent,
    TextContent,
    ChatEvent,
    ReplyContext,
    Reaction,
    Message,
    Mention,
    CandidateGroupChat,
    PollVotes,
    PollContent,
    MemberRole,
    PermissionRole,
    CryptocurrencyContent,
    AggregateCommonEvents,
    ChatMetrics,
    SendMessageSuccess,
    TransferSuccess,
    ThreadSummary,
    PartialUserSummary,
    UserLookup,
    UserSummary,
    LocalChatSummaryUpdates,
    LocalMessageUpdates,
    LocalReaction,
    emptyChatMetrics,
    Cryptocurrency,
    cryptoLookup,
    LocalPollVote,
    CryptocurrencyTransfer,
    Tally,
    UnsupportedValueError,
    getContentAsText,
    eventIsVisible,
    EmptyEvent,
} from "openchat-shared";
import { distinctBy, groupWhile } from "../utils/list";
import { areOnSameDay } from "../utils/date";
import { v1 as uuidv1 } from "uuid";
import { messagesRead } from "../stores/markRead";
import { OPENCHAT_BOT_AVATAR_URL, OPENCHAT_BOT_USER_ID, userStore } from "../stores/user";
import Identicon from "identicon.js";
import md5 from "md5";
import { rtcConnectionsManager } from "../utils/rtcConnectionsManager";
import type { UnconfirmedMessages } from "../stores/unconfirmed";
import type { MessageFormatter } from "./i18n";
import { get } from "svelte/store";
import { formatTokens } from "./cryptoFormatter";
import { currentChatUserIds } from "../stores/chat";
import type { TypersByKey } from "../stores/typing";
import { tallyKey } from "../stores/proposalTallies";

const MAX_RTC_CONNECTIONS_PER_CHAT = 10;
const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute

export function isPreviewing(chat: ChatSummary): boolean {
    return chat.kind === "group_chat" && chat.myRole === "previewer";
}

export function isFrozen(chat: ChatSummary): boolean {
    return chat.kind === "group_chat" && chat.frozen;
}

export function newMessageId(): bigint {
    return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
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
    maxUsers: number
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
    events: EventWrapper<ChatEvent>[]
): string[] {
    if (chat.kind === "direct_chat") {
        return [chat.chatId];
    }

    const activeUsers = getRecentlyActiveUsers(chat, events, MAX_RTC_CONNECTIONS_PER_CHAT);
    return activeUsers.has(myUserId) ? Array.from(activeUsers).filter((u) => u !== myUserId) : [];
}

export function makeRtcConnections(
    myUserId: string,
    chat: ChatSummary,
    events: EventWrapper<ChatEvent>[],
    lookup: UserLookup
): void {
    const userIds = getUsersToMakeRtcConnectionsWith(myUserId, chat, events);
    if (userIds.length === 0) return;

    userIds
        .map((u) => lookup[u])
        .filter((user) => user.kind === "user" && !rtcConnectionsManager.exists(user.userId))
        .map((user) => user.userId)
        .forEach((userId) => {
            rtcConnectionsManager.create(myUserId, userId);
        });
}

// Returns the userId of the user who triggered the event
export function activeUserIdFromEvent(event: ChatEvent): string | undefined {
    switch (event.kind) {
        case "message":
            return event.sender;
        case "member_joined":
        case "member_assumes_super_admin":
        case "member_relinquishes_super_admin":
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
            return event.addedBy;
        case "members_removed":
            return event.removedBy;
        case "users_blocked":
            return event.blockedBy;
        case "users_unblocked":
            return event.unblockedBy;
        case "ownership_transferred":
            return event.oldOwner;
        case "message_pinned":
            return event.pinnedBy;
        case "message_unpinned":
            return event.unpinnedBy;
        case "events_ttl_updated":
            return event.updatedBy;
        case "gate_updated":
            return event.updatedBy;
        case "message_deleted":
        case "message_undeleted":
        case "message_edited":
        case "reaction_added":
        case "reaction_removed":
        case "poll_vote_registered":
        case "poll_vote_deleted":
            return event.message.updatedBy;
        case "direct_chat_created":
        case "aggregate_common_events":
        case "poll_ended":
        case "thread_updated":
        case "proposals_updated":
        case "member_dismissed_as_super_admin":
        case "member_left": // We exclude participant_left events since the user is no longer in the group
        case "chat_frozen":
        case "chat_unfrozen":
        case "empty":
            return undefined;
        default:
            throw new UnsupportedValueError("Unexpected ChatEvent type received", event);
    }
}

export function getMinVisibleMessageIndex(chat: ChatSummary): number {
    if (chat.kind === "direct_chat") return 0;
    return chat.minVisibleMessageIndex;
}

export function messageIsReadByThem(chat: ChatSummary, messageIndex: number): boolean {
    if (chat.kind === "group_chat") return true;
    return chat.readByThemUpTo !== undefined && chat.readByThemUpTo >= messageIndex;
}

export function getMembersString(
    user: UserSummary,
    userLookup: UserLookup,
    memberIds: string[],
    unknownUser: string,
    you: string,
    compareUsersFn?: (u1: PartialUserSummary, u2: PartialUserSummary) => number,
    truncate = true
): string {
    if (truncate && memberIds.length > 5) {
        return `${memberIds.length} members`;
    }
    const sorted = memberIds
        .map((id) => userLookup[id] ?? nullUser(unknownUser))
        .sort(compareUsersFn ?? compareUsername)
        .map((p) => `**${p.userId === user.userId ? you : p.username}**`);

    // TODO Improve i18n, don't hardcode 'and'
    return sorted.length > 1
        ? `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`
        : sorted.join();
}

function addCaption(caption: string | undefined, content: MessageContent): MessageContent {
    return content.kind !== "text_content" &&
        content.kind !== "deleted_content" &&
        content.kind !== "placeholder_content" &&
        content.kind !== "poll_content" &&
        content.kind !== "proposal_content" &&
        content.kind !== "prize_winner_content" &&
        content.kind !== "message_reminder_content" &&
        content.kind !== "message_reminder_created_content" &&
        content.kind !== "crypto_content"
        ? { ...content, caption }
        : content;
}

export function getMessageContent(
    content: string | undefined,
    fileToAttach: MessageContent | undefined
): MessageContent {
    return fileToAttach
        ? addCaption(content, fileToAttach)
        : ({
              kind: "text_content",
              text: content ?? "",
          } as TextContent);
}

const blobbyContentTypes = ["file_content", "image_content", "video_content", "audio_content"];

export function createMessage(
    userId: string,
    messageIndex: number,
    content: string | undefined,
    replyingTo: ReplyContext | undefined,
    fileToAttach: MessageContent | undefined
): Message {
    return {
        kind: "message",
        content: getMessageContent(content, fileToAttach),
        sender: userId,
        repliesTo: replyingTo,
        messageId: newMessageId(),
        messageIndex,
        reactions: [],
        edited: false,
        forwarded: false,
        deleted: false,
        cancelled: false,
    };
}

function messageMentionsUser(
    formatter: MessageFormatter,
    userId: string,
    msg: EventWrapper<Message>
): boolean {
    const txt = getContentAsText(formatter, msg.event.content);
    return txt.indexOf(`@UserId(${userId})`) >= 0;
}

function mentionsFromMessages(
    formatter: MessageFormatter,
    userId: string,
    messages: EventWrapper<Message>[]
): Mention[] {
    return messages.reduce((mentions, msg) => {
        if (messageMentionsUser(formatter, userId, msg)) {
            mentions.push({
                messageId: msg.event.messageId,
                messageIndex: msg.event.messageIndex,
                eventIndex: msg.index,
                mentionedBy: msg.event.sender,
            });
        }
        return mentions;
    }, [] as Mention[]);
}

export function mergeUnconfirmedThreadsIntoSummary(
    chat: GroupChatSummary,
    unconfirmed: UnconfirmedMessages
): GroupChatSummary {
    return {
        ...chat,
        latestThreads: chat.latestThreads.map((t) => {
            const unconfirmedMsgs =
                unconfirmed[`${chat.chatId}_${t.threadRootMessageIndex}`]?.messages ?? [];
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
    };
}

export function mergeLocalSummaryUpdates(
    server: Record<string, ChatSummary>,
    localUpdates: Record<string, LocalChatSummaryUpdates>
): Record<string, ChatSummary> {
    if (Object.keys(localUpdates).length === 0) return server;

    const merged = { ...server };

    for (const [chatId, localUpdate] of Object.entries(localUpdates)) {
        if (localUpdate.added !== undefined) {
            const current = merged[chatId];
            if (current === undefined || isPreviewing(current)) {
                merged[chatId] = localUpdate.added;
            }
        }
        if (localUpdate.updated !== undefined) {
            const current = merged[chatId];
            const updated = localUpdate.updated;
            if (current !== undefined) {
                if (updated.kind === undefined) {
                    merged[chatId] = {
                        ...current,
                        notificationsMuted:
                            updated.notificationsMuted ?? current.notificationsMuted,
                        archived: updated.archived ?? current.archived,
                    };
                } else if (current.kind === "group_chat" && updated.kind === "group_chat") {
                    merged[chatId] = {
                        ...current,
                        name: updated.name ?? current.name,
                        description: updated.description ?? current.description,
                        public: updated.public ?? current.public,
                        myRole: updated.myRole ?? current.myRole,
                        notificationsMuted:
                            updated.notificationsMuted ?? current.notificationsMuted,
                        archived: updated.archived ?? current.archived,
                        permissions: {
                            ...current.permissions,
                            ...updated.permissions,
                        },
                        gate: {
                            ...current.gate,
                            ...updated.gate,
                        },
                    };
                }
            }
        }
        if (localUpdate.removedAtTimestamp) {
            const chat = merged[chatId];
            if (
                chat !== undefined &&
                ((chat.kind === "direct_chat" &&
                    chat.dateCreated < localUpdate.removedAtTimestamp) ||
                    (chat.kind === "group_chat" && chat.joined < localUpdate.removedAtTimestamp))
            ) {
                delete merged[chatId];
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
    localUpdates: Record<string, LocalMessageUpdates>
): ChatSummary {
    const unconfirmedMessages = unconfirmed[chatSummary.chatId]?.messages;

    let latestMessage = chatSummary.latestMessage;
    let latestEventIndex = chatSummary.latestEventIndex;
    let mentions = chatSummary.kind === "group_chat" ? chatSummary.mentions : [];
    if (unconfirmedMessages != undefined && unconfirmedMessages.length > 0) {
        const incomingMentions = mentionsFromMessages(formatter, userId, unconfirmedMessages);
        mentions = mergeMentions(mentions, incomingMentions);
        const latestUnconfirmedMessage = unconfirmedMessages[unconfirmedMessages.length - 1];
        if (
            latestMessage === undefined ||
            latestUnconfirmedMessage.event.messageIndex > latestMessage.event.messageIndex
        ) {
            latestMessage = latestUnconfirmedMessage;
        }
        if (latestUnconfirmedMessage.index > latestEventIndex) {
            latestEventIndex = latestUnconfirmedMessage.index;
        }
    }
    if (latestMessage !== undefined) {
        const updates = localUpdates[latestMessage.event.messageId.toString()];
        if (updates !== undefined) {
            latestMessage = {
                ...latestMessage,
                event: mergeLocalUpdates(latestMessage.event, updates, undefined, undefined),
            };
        }
    }

    if (chatSummary.kind === "group_chat") {
        if (unconfirmedMessages !== undefined) {
            chatSummary = mergeUnconfirmedThreadsIntoSummary(chatSummary, unconfirmed);
        }
        return {
            ...chatSummary,
            latestMessage,
            latestEventIndex,
            mentions,
        };
    } else {
        return {
            ...chatSummary,
            latestMessage,
            latestEventIndex,
        };
    }
}

function mergeMentions(existing: Mention[], incoming: Mention[]): Mention[] {
    return [
        ...existing,
        ...incoming.filter(
            (m1) => existing.find((m2) => m1.messageId === m2.messageId) === undefined
        ),
    ];
}

export function sameUser(a: EventWrapper<ChatEvent>, b: EventWrapper<ChatEvent>): boolean {
    if (a.event.kind === "message" && b.event.kind === "message") {
        return (
            a.event.sender === b.event.sender &&
            b.timestamp - a.timestamp < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS
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
    groupInner?: (events: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[][]
): EventWrapper<ChatEvent>[][][] {
    return groupWhile(sameDate, events.filter(eventIsVisible))
        .map((e) => reduceJoinedOrLeft(e, myUserId, expandedDeletedMessages))
        .map(groupInner ?? groupBySender);
}

function reduceJoinedOrLeft(
    events: EventWrapper<ChatEvent>[],
    myUserId: string,
    expandedDeletedMessages: Set<number>
): EventWrapper<ChatEvent>[] {
    function getLatestAggregateEventIfExists(
        events: EventWrapper<ChatEvent>[]
    ): AggregateCommonEvents | undefined {
        if (events.length === 0) return undefined;
        const latest = events[events.length - 1];
        return latest.event.kind === "aggregate_common_events" ? latest.event : undefined;
    }

    return events.reduce((previous: EventWrapper<ChatEvent>[], e: EventWrapper<ChatEvent>) => {
        if (
            e.event.kind === "member_joined" ||
            e.event.kind === "member_left" ||
            (e.event.kind === "message" &&
                messageIsHidden(e.event, myUserId, expandedDeletedMessages))
        ) {
            let agg = getLatestAggregateEventIfExists(previous);
            if (agg === undefined) {
                agg = {
                    kind: "aggregate_common_events",
                    usersJoined: new Set(),
                    usersLeft: new Set(),
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
            } else {
                agg.messagesDeleted.push(e.event.messageIndex);
            }

            previous.push({
                event: agg,
                timestamp: e.timestamp,
                index: e.index,
            });
        } else {
            previous.push(e);
        }

        return previous;
    }, []);
}

function messageIsHidden(message: Message, myUserId: string, expandedDeletedMessages: Set<number>) {
    return (
        message.content.kind === "deleted_content" &&
        message.sender !== myUserId &&
        !expandedDeletedMessages.has(message.messageIndex) &&
        message.thread === undefined
    );
}

export function groupMessagesByDate(events: EventWrapper<Message>[]): EventWrapper<Message>[][] {
    return groupWhile(sameDate, events.filter(eventIsVisible));
}

export function getNextEventAndMessageIndexes(
    chat: ChatSummary,
    localMessages: EventWrapper<Message>[]
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
    newEvents: EventWrapper<ChatEvent>[]
): EventWrapper<ChatEvent>[] {
    const merged = distinctBy([...newEvents, ...events], (e) => e.index);
    merged.sort(sortByTimestampThenEventIndex);
    return merged;
}

function sortByTimestampThenEventIndex(
    a: EventWrapper<ChatEvent>,
    b: EventWrapper<ChatEvent>
): number {
    if (a.timestamp === b.timestamp) return a.index - b.index;
    return Number(a.timestamp - b.timestamp);
}

export function revokeObjectUrls(event?: EventWrapper<ChatEvent>): void {
    if (event?.event.kind === "message") {
        if ("blobUrl" in event.event.content && event.event.content.blobUrl !== undefined) {
            URL.revokeObjectURL(event.event.content.blobUrl);
        }
    }
}

export function serialiseMessageForRtc(messageEvent: EventWrapper<Message>): EventWrapper<Message> {
    if (blobbyContentTypes.includes(messageEvent.event.content.kind)) {
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
    chatId: string,
    candidate: CandidateGroupChat
): GroupChatSummary {
    return {
        kind: "group_chat",
        chatId,
        readByMeUpTo: undefined,
        latestEventIndex: 0,
        latestMessage: undefined,
        notificationsMuted: false,
        name: candidate.name,
        description: candidate.description,
        public: candidate.isPublic,
        historyVisibleToNewJoiners: candidate.historyVisible,
        joined: BigInt(Date.now()),
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        lastUpdated: BigInt(0),
        memberCount: candidate.members.length + 1, // +1 to include us
        myRole: "owner",
        mentions: [],
        ...candidate.avatar,
        permissions: candidate.permissions,
        metrics: emptyChatMetrics(),
        myMetrics: emptyChatMetrics(),
        latestThreads: [],
        subtype: undefined,
        archived: false,
        previewed: false,
        frozen: false,
        dateLastPinned: undefined,
        dateReadPinned: undefined,
        gate: candidate.gate,
    };
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
    type: "register" | "delete"
): PollVotes {
    return type === "delete"
        ? removeVoteFromPoll(userId, answerIdx, poll.votes)
        : addVoteToPoll(userId, answerIdx, poll);
}

export function addVoteToPoll(
    userId: string,
    answerIdx: number,
    { votes, config }: PollContent
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

export function canChangePermissions(chat: ChatSummary): boolean {
    return (
        chat.kind === "group_chat" &&
        !chat.frozen &&
        isPermitted(chat.myRole, chat.permissions.changePermissions)
    );
}

export function canChangeRoles(
    chat: ChatSummary,
    currRole: MemberRole,
    newRole: MemberRole
): boolean {
    if (chat.kind !== "group_chat" || currRole === newRole || chat.frozen) {
        return false;
    }

    switch (newRole) {
        case "owner":
            return hasOwnerRights(chat.myRole);
        default:
            return isPermitted(chat.myRole, chat.permissions.changeRoles);
    }
}

export function canAddMembers(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return (
            !chat.public && !chat.frozen && isPermitted(chat.myRole, chat.permissions.addMembers)
        );
    } else {
        return false;
    }
}

export function canRemoveMembers(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return (
            !chat.public && !chat.frozen && isPermitted(chat.myRole, chat.permissions.removeMembers)
        );
    } else {
        return false;
    }
}

export function canBlockUsers(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return chat.public && !chat.frozen && isPermitted(chat.myRole, chat.permissions.blockUsers);
    } else {
        return true;
    }
}

export function canUnblockUsers(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return chat.public && !chat.frozen && isPermitted(chat.myRole, chat.permissions.blockUsers);
    } else {
        return true;
    }
}

export function canDeleteOtherUsersMessages(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat" && !chat.frozen) {
        return isPermitted(chat.myRole, chat.permissions.deleteMessages);
    } else {
        return false;
    }
}

export function canEditGroupDetails(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat" && !chat.frozen) {
        return isPermitted(chat.myRole, chat.permissions.updateGroup);
    } else {
        return false;
    }
}

export function canPinMessages(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat" && !chat.frozen) {
        return isPermitted(chat.myRole, chat.permissions.pinMessages);
    } else {
        return false;
    }
}

export function canInviteUsers(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat" && !chat.frozen) {
        return chat.public || isPermitted(chat.myRole, chat.permissions.inviteUsers);
    } else {
        return false;
    }
}

export function canCreatePolls(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return !chat.frozen && isPermitted(chat.myRole, chat.permissions.createPolls);
    } else {
        return true;
    }
}

export function canSendMessages(
    chat: ChatSummary,
    userLookup: UserLookup,
    proposalsBotUserId: string
): boolean {
    if (chat.kind === "group_chat") {
        return !chat.frozen && isPermitted(chat.myRole, chat.permissions.sendMessages);
    }

    const user = userLookup[chat.them];
    if (user === undefined || user.suspended) {
        return false;
    }
    if (user.kind === "user") {
        return true;
    }
    if (user.userId === OPENCHAT_BOT_USER_ID || user.userId === proposalsBotUserId) {
        return false;
    }
    return true;
}

export function canReactToMessages(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return !chat.frozen && isPermitted(chat.myRole, chat.permissions.reactToMessages);
    } else {
        return true;
    }
}

export function canReplyInThread(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat" && !chat.frozen) {
        return isPermitted(chat.myRole, chat.permissions.replyInThread);
    } else {
        return false;
    }
}

export function canLeaveGroup(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat" && !chat.frozen) {
        return chat.myRole !== "owner";
    } else {
        return false;
    }
}

export function canDeleteGroup(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat" && !chat.frozen) {
        return hasOwnerRights(chat.myRole);
    } else {
        return false;
    }
}

export function canMakeGroupPrivate(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat" && !chat.frozen) {
        return chat.public && hasOwnerRights(chat.myRole);
    } else {
        return false;
    }
}

function hasOwnerRights(role: MemberRole): boolean {
    return role === "owner";
}

function isPermitted(role: MemberRole, permissionRole: PermissionRole): boolean {
    if (role === "previewer") {
        return false;
    }

    switch (permissionRole) {
        case "owner":
            return hasOwnerRights(role);
        case "admins":
            return role !== "participant";
        case "members":
            return true;
    }
}

export function mergeChatMetrics(a: ChatMetrics, b: ChatMetrics): ChatMetrics {
    return {
        audioMessages: a.audioMessages + b.audioMessages,
        cyclesMessages: a.cyclesMessages + b.cyclesMessages,
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

export function metricsEqual(a: ChatMetrics, b: ChatMetrics): boolean {
    return Object.keys(a).reduce<boolean>(
        (same, k) => same && a[k as keyof ChatMetrics] === b[k as keyof ChatMetrics],
        true
    );
}

export function getFirstUnreadMention(chat: ChatSummary): Mention | undefined {
    if (chat.kind === "direct_chat") return undefined;
    return chat.mentions.find(
        (m) => !messagesRead.isRead(chat.chatId, m.messageIndex, m.messageId)
    );
}

export function canForward(content: MessageContent): boolean {
    return (
        content.kind !== "crypto_content" &&
        content.kind !== "poll_content" &&
        content.kind !== "deleted_content" &&
        content.kind !== "proposal_content" &&
        content.kind !== "placeholder_content"
    );
}

export function buildUserAvatarUrl(pattern: string, userId: string, avatarId?: bigint): string {
    return avatarId !== undefined
        ? buildBlobUrl(pattern, userId, avatarId, "avatar")
        : userId === OPENCHAT_BOT_USER_ID
        ? OPENCHAT_BOT_AVATAR_URL
        : buildIdenticonUrl(userId);
}

export function buildBlobUrl(
    pattern: string,
    canisterId: string,
    blobId: bigint,
    blobType: "blobs" | "avatar"
): string {
    return `${pattern
        .replace("{canisterId}", canisterId)
        .replace("{blobType}", blobType)}${blobId}`;
}

function buildIdenticonUrl(userId: string): string {
    const identicon = new Identicon(md5(userId), {
        margin: 0,
        format: "svg",
    });
    return `data:image/svg+xml;base64,${identicon}`;
}

export function mergeSendMessageResponse(
    msg: Message,
    resp: SendMessageSuccess | TransferSuccess
): EventWrapper<Message> {
    return {
        index: resp.eventIndex,
        timestamp: resp.timestamp,
        event: {
            ...msg,
            messageIndex: resp.messageIndex,
            content:
                resp.kind === "transfer_success"
                    ? ({ ...msg.content, transfer: resp.transfer } as CryptocurrencyContent)
                    : msg.content,
        },
    };
}

export function markAllRead(chat: ChatSummary): void {
    const latestMessageIndex = chat.latestMessage?.event.messageIndex;
    if (latestMessageIndex !== undefined) {
        messagesRead.markReadUpTo(chat.chatId, latestMessageIndex);
    }
}

export function mergeEventsAndLocalUpdates(
    events: EventWrapper<ChatEvent>[],
    unconfirmed: EventWrapper<Message>[],
    localUpdates: Record<string, LocalMessageUpdates>,
    proposalTallies: Record<string, Tally>
): EventWrapper<ChatEvent>[] {
    const eventIndexes = new Set<number>();

    function processEvent(e: EventWrapper<ChatEvent>) {
        eventIndexes.add(e.index);

        if (e.event.kind === "message") {
            const updates = localUpdates[e.event.messageId.toString()];
            const replyContextUpdates =
                e.event.repliesTo?.kind === "rehydrated_reply_context"
                    ? localUpdates[e.event.repliesTo.messageId.toString()]
                    : undefined;

            const tallyUpdate =
                e.event.content.kind === "proposal_content"
                    ? proposalTallies[
                          tallyKey(
                              e.event.content.governanceCanisterId,
                              e.event.content.proposal.id
                          )
                      ]
                    : undefined;

            if (
                updates !== undefined ||
                replyContextUpdates !== undefined ||
                tallyUpdate !== undefined
            ) {
                return {
                    ...e,
                    event: mergeLocalUpdates(e.event, updates, replyContextUpdates, tallyUpdate),
                };
            }
        }
        return e;
    }
    const merged = events.map((e) => processEvent(e));

    if (unconfirmed.length > 0) {
        unconfirmed.sort(sortByTimestampThenEventIndex);

        let anyAdded = false;
        for (const message of unconfirmed) {
            // Only include unconfirmed events that are either contiguous with the loaded confirmed events, or are the
            // first events in a new chat
            if (
                (eventIndexes.size === 0 && message.index <= 1) ||
                eventIndexes.has(message.index - 1) ||
                eventIndexes.has(message.index) ||
                eventIndexes.has(message.index + 1)
            ) {
                merged.push(processEvent(message));
                anyAdded = true;
            }
        }
        if (anyAdded) {
            merged.sort(sortByTimestampThenEventIndex);
        }
    }

    return merged;
}

function mergeLocalUpdates(
    message: Message,
    localUpdates: LocalMessageUpdates | undefined,
    replyContextLocalUpdates: LocalMessageUpdates | undefined,
    tallyUpdate: Tally | undefined
): Message {
    if (
        localUpdates === undefined &&
        replyContextLocalUpdates === undefined &&
        tallyUpdate === undefined
    )
        return message;

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

    if (localUpdates?.cancelled !== undefined) {
        return {
            ...message,
            cancelled: true,
        };
    }

    message = { ...message };

    if (localUpdates?.editedContent !== undefined) {
        message.content = localUpdates.editedContent;
        message.edited = true;
    }

    if (localUpdates?.undeletedContent !== undefined) {
        message.content = localUpdates.undeletedContent;
        message.deleted = false;
    }

    if (localUpdates?.revealedContent !== undefined) {
        message.content = localUpdates.revealedContent;
    }

    if (localUpdates?.prizeClaimed !== undefined) {
        if (message.content.kind === "prize_content") {
            if (!message.content.winners.includes(localUpdates.prizeClaimed)) {
                message.content.winners.push(localUpdates.prizeClaimed);
                message.content.prizesRemaining -= 1;
                message.content.prizesPending += 1;
            }
        }
    }

    if (localUpdates?.reactions !== undefined) {
        let reactions = [...message.reactions];
        for (const localReaction of localUpdates.reactions) {
            reactions = applyLocalReaction(localReaction, reactions);
        }
        message.reactions = reactions;
    }

    if (localUpdates?.pollVotes !== undefined && message.content.kind === "poll_content") {
        message.content = updatePollContent(message.content, localUpdates.pollVotes);
    }

    if (localUpdates?.threadSummary !== undefined) {
        message.thread =
            message.thread === undefined
                ? localUpdates.threadSummary
                : mergeThreadSummaries(message.thread, localUpdates.threadSummary);
    }

    if (
        message.repliesTo?.kind === "rehydrated_reply_context" &&
        replyContextLocalUpdates !== undefined
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
        } else {
            message.repliesTo = { ...message.repliesTo };

            if (replyContextLocalUpdates.editedContent !== undefined) {
                message.repliesTo.content = replyContextLocalUpdates.editedContent;
            }
            if (replyContextLocalUpdates.revealedContent !== undefined) {
                message.repliesTo.content = replyContextLocalUpdates.revealedContent;
            }
            if (
                replyContextLocalUpdates.pollVotes !== undefined &&
                message.repliesTo.content.kind === "poll_content"
            ) {
                message.repliesTo.content = updatePollContent(
                    message.repliesTo.content,
                    replyContextLocalUpdates.pollVotes
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
    return message;
}

export function mergeThreadSummaries(a: ThreadSummary, b: ThreadSummary): ThreadSummary {
    return {
        participantIds: new Set<string>([...a.participantIds, ...b.participantIds]),
        numberOfReplies: Math.max(a.numberOfReplies, b.numberOfReplies),
        latestEventIndex: Math.max(a.latestEventIndex, b.latestEventIndex),
        latestEventTimestamp:
            a.latestEventTimestamp > b.latestEventTimestamp
                ? a.latestEventTimestamp
                : b.latestEventTimestamp,
    };
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
    events: EventWrapper<ChatEvent>[]
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
    transfer: CryptocurrencyTransfer
): string | undefined {
    const url = buildTransactionUrl(transfer);
    return url !== undefined
        ? formatter("tokenTransfer.viewTransaction", { values: { url } })
        : undefined;
}

export function buildTransactionUrl(transfer: CryptocurrencyTransfer): string | undefined {
    if (transfer.kind !== "completed") {
        return undefined;
    }

    const rootCanister = cryptoLookup[transfer.token].rootCanister;

    switch (transfer.token) {
        case "icp":
            return `https://dashboard.internetcomputer.org/transaction/${transfer.transactionHash}`;
        case "ckbtc":
            return `https://dashboard.internetcomputer.org/bitcoin/transaction/${transfer.blockIndex}`;
        default:
            return `https://dashboard.internetcomputer.org/sns/${rootCanister}/transaction/${transfer.blockIndex}`;
    }
}

export function buildCryptoTransferText(
    formatter: MessageFormatter,
    myUserId: string,
    senderId: string,
    content: CryptocurrencyContent,
    me: boolean
): string | undefined {
    if (content.transfer.kind !== "completed" && content.transfer.kind !== "pending") {
        return undefined;
    }

    function username(userId: string): string {
        const lookup = get(userStore);

        return userId === myUserId
            ? formatter("you")
            : `${lookup[userId]?.username ?? formatter("unknown")}`;
    }

    const values = {
        amount: formatTokens(content.transfer.amountE8s, 0),
        receiver: username(content.transfer.recipient),
        sender: username(senderId),
        token: toSymbol(content.transfer.token),
    };

    const key =
        content.transfer.kind === "completed"
            ? "confirmedSent"
            : me
            ? "pendingSentByYou"
            : "pendingSent";

    return formatter(`tokenTransfer.${key}`, { values });
}

function toSymbol(token: Cryptocurrency): string {
    return cryptoLookup[token].symbol;
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

export function getTypingString(
    formatter: MessageFormatter,
    users: UserLookup,
    key: string,
    typing: TypersByKey
): string | undefined {
    const typers = typing[key];
    if (typers === undefined || typers.size === 0) return undefined;

    if (typers.size > 1) {
        return formatter("membersAreTyping", { values: { number: typers.size } });
    } else {
        const userIds = [...typers];
        const username = users[userIds[0]]?.username ?? formatter("unknown");
        return formatter("memberIsTyping", { values: { username } });
    }
}

export function getFirstUnreadMessageIndex(chat: ChatSummary): number | undefined {
    if (chat.kind === "group_chat" && chat.myRole === "previewer") return undefined;

    return messagesRead.getFirstUnreadMessageIndex(
        chat.chatId,
        chat.latestMessage?.event.messageIndex
    );
}
