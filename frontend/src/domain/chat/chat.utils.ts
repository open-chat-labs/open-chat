import type { PartialUserSummary, UserLookup, UserSummary } from "../user/user";
import { compareUsersOnlineFirst, extractUserIdsFromMentions, nullUser } from "../user/user.utils";
import DRange from "drange";
import type {
    ChatSummary,
    DirectChatSummary,
    EventWrapper,
    GroupChatSummary,
    MessageContent,
    Participant,
    TextContent,
    ChatSummaryUpdates,
    DirectChatSummaryUpdates,
    GroupChatSummaryUpdates,
    UpdatesResponse,
    ChatEvent,
    ReplyContext,
    UpdateArgs,
    Reaction,
    Message,
    IndexRange,
    LocalReaction,
    GroupChatDetails,
    GroupChatDetailsUpdates,
    Mention,
    CandidateGroupChat,
    PollVotes,
    PollContent,
    MemberRole,
    PermissionRole,
    CryptocurrencyContent,
    AggregateParticipantsJoinedOrLeft,
    ChatMetrics,
} from "./chat";
import { dedupe, groupWhile } from "../../utils/list";
import { areOnSameDay } from "../../utils/date";
import { v1 as uuidv1 } from "uuid";
import { UnsupportedValueError } from "../../utils/error";
import { _ } from "svelte-i18n";
import { unconfirmed } from "../../stores/unconfirmed";
import type { IMessageReadTracker } from "../../stores/markRead";
import { applyOptionUpdate } from "../../utils/mapping";
import { get } from "svelte/store";
import { formatICP } from "../../utils/cryptoFormatter";
import { userStore } from "../../stores/user";
import type { TypersByChat } from "../../stores/typing";

const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute
export const EVENT_PAGE_SIZE = 50;
export const MAX_MESSAGES = 60;
export const MAX_MISSING = 30;
export const MAX_EVENTS = 200;

export function newMessageId(): bigint {
    return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
}

export function getContentAsText(content: MessageContent): string {
    let text;
    if (content.kind === "text_content") {
        text = content.text;
    } else if (content.kind === "image_content") {
        text = captionedContent("image", content.caption);
    } else if (content.kind === "video_content") {
        text = captionedContent("video", content.caption);
    } else if (content.kind === "audio_content") {
        text = captionedContent("audio", content.caption);
    } else if (content.kind === "file_content") {
        text = captionedContent(content.name, content.caption);
    } else if (content.kind === "crypto_content") {
        text = captionedContent(get(_)("icpTransfer.transfer"), content.caption);
    } else if (content.kind === "deleted_content") {
        text = "deleted message";
    } else if (content.kind === "placeholder_content") {
        text = "placeholder content";
    } else if (content.kind === "poll_content") {
        text = "poll";
    } else if (content.kind === "giphy_content") {
        text = captionedContent(get(_)("giphyMessage"), content.caption);
    } else {
        throw new UnsupportedValueError("Unrecognised content type", content);
    }
    return text.trim();
}

function captionedContent(type: string, caption?: string): string {
    if (caption) {
        return type + " - " + caption;
    } else {
        return type;
    }
}

export function userIdsFromEvents(events: EventWrapper<ChatEvent>[]): Set<string> {
    return events.reduce<Set<string>>((userIds, e) => {
        if ("userIds" in e.event) {
            e.event.userIds.forEach((u) => userIds.add(u));
        }
        switch (e.event.kind) {
            case "message":
                userIds.add(e.event.sender);
                if (
                    e.event.repliesTo !== undefined &&
                    e.event.repliesTo.kind === "rehydrated_reply_context"
                ) {
                    userIds.add(e.event.repliesTo.senderId);
                    extractUserIdsFromMentions(getContentAsText(e.event.repliesTo.content)).forEach(
                        (id) => userIds.add(id)
                    );
                }
                extractUserIdsFromMentions(getContentAsText(e.event.content)).forEach((id) =>
                    userIds.add(id)
                );
                break;
            case "participant_joined":
            case "participant_left":
            case "participant_assumes_super_admin":
            case "participant_relinquishes_super_admin":
            case "participant_dismissed_as_super_admin":
                userIds.add(e.event.userId);
                break;
            case "name_changed":
            case "desc_changed":
            case "avatar_changed":
            case "role_changed":
            case "permissions_changed":
            case "group_visibility_changed":
            case "group_invite_code_changed":
                userIds.add(e.event.changedBy);
                break;
            case "group_chat_created":
                userIds.add(e.event.created_by);
                break;
            case "participants_added":
                userIds.add(e.event.addedBy);
                break;
            case "participants_removed":
                userIds.add(e.event.removedBy);
                break;
            case "users_blocked":
                userIds.add(e.event.blockedBy);
                break;
            case "users_unblocked":
                userIds.add(e.event.unblockedBy);
                break;
            case "ownership_transferred":
                userIds.add(e.event.oldOwner);
                break;
            case "message_pinned":
                userIds.add(e.event.pinnedBy);
                break;
            case "message_unpinned":
                userIds.add(e.event.unpinnedBy);
                break;
            case "message_deleted":
            case "message_edited":
            case "reaction_added":
            case "reaction_removed":
            case "poll_vote_registered":
            case "poll_vote_deleted":
                userIds.add(e.event.message.updatedBy);
                break;
            case "direct_chat_created":
            case "poll_ended":
            case "aggregate_participants_joined_left":
                break;
            default:
                throw new UnsupportedValueError("Unexpected ChatEvent type received", e.event);
        }
        return userIds;
    }, new Set<string>());
}

// Returns the userId of the user who triggered the event
export function activeUserIdFromEvent(event: ChatEvent): string | undefined {
    switch (event.kind) {
        case "message":
            return event.sender;
        case "participant_joined":
        case "participant_assumes_super_admin":
        case "participant_relinquishes_super_admin":
            return event.userId;
        case "name_changed":
        case "desc_changed":
        case "avatar_changed":
        case "role_changed":
        case "permissions_changed":
        case "group_visibility_changed":
        case "group_invite_code_changed":
            return event.changedBy;
        case "group_chat_created":
            return event.created_by;
        case "participants_added":
            return event.addedBy;
        case "participants_removed":
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
        case "message_deleted":
        case "message_edited":
        case "reaction_added":
        case "reaction_removed":
        case "poll_vote_registered":
        case "poll_vote_deleted":
            return event.message.updatedBy;
        case "direct_chat_created":
        case "aggregate_participants_joined_left":
        case "poll_ended":
        case "participant_dismissed_as_super_admin":
        case "participant_left": // We exclude participant_left events since the user is no longer in the group
            return undefined;
        default:
            throw new UnsupportedValueError("Unexpected ChatEvent type received", event);
    }
}

export function getMinVisibleMessageIndex(chat: ChatSummary): number {
    if (chat.kind === "direct_chat") return 0;
    return chat.minVisibleMessageIndex;
}

export function getMinVisibleEventIndex(chat: ChatSummary): number {
    if (chat.kind === "direct_chat") return 0;
    return chat.minVisibleEventIndex;
}

export function indexIsInRanges(index: number, ranges: DRange): boolean {
    for (const range of ranges.subranges()) {
        if (range.low <= index && index <= range.high) return true;
        if (range.low > index) break;
    }
    return false;
}

export function messageIsReadByThem(chat: ChatSummary, { messageIndex }: Message): boolean {
    if (chat.kind === "group_chat") return true;
    return indexIsInRanges(messageIndex, chat.readByThem);
}

export function getTypingString(
    users: UserLookup,
    chatSummary: ChatSummary,
    typing: TypersByChat
): string | undefined {
    const typers = typing[chatSummary.chatId];
    if (typers === undefined || typers.size === 0) return undefined;

    const format = get(_);
    if (typers.size > 1) {
        return format("membersAreTyping", { values: { number: typers.size } });
    } else {
        const userIds = [...typers];
        const username = users[userIds[0]]?.username ?? format("unknown");
        return format("memberIsTyping", { values: { username } });
    }
}

export function getParticipantsString(
    user: UserSummary,
    userLookup: UserLookup,
    participantIds: string[],
    unknownUser: string,
    you: string,
    compareUsersFn?: (u1: PartialUserSummary, u2: PartialUserSummary) => number,
    truncate = true
): string {
    if (truncate && participantIds.length > 5) {
        return `${participantIds.length} members`;
    }
    const sorted = participantIds
        .map((id) => userLookup[id] ?? nullUser(unknownUser))
        .sort(compareUsersFn ?? compareUsersOnlineFirst)
        .map((p) => (p.userId === user.userId ? you : p.username));

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
    };
}

export function getDisplayDate(chat: ChatSummary): bigint {
    const started = chat.kind === "direct_chat" ? chat.dateCreated : chat.joined;

    return chat.latestMessage && chat.latestMessage.timestamp > started
        ? chat.latestMessage.timestamp
        : started;
}

function mergeRange(a: DRange, b: DRange) {
    const merged = new DRange();
    merged.add(a);
    merged.add(b);
    return merged;
}

function mergeUpdatedDirectChat(
    chat: DirectChatSummary,
    updatedChat: DirectChatSummaryUpdates
): DirectChatSummary {
    return {
        ...chat,
        readByMe: updatedChat.readByMe
            ? mergeRange(chat.readByMe, updatedChat.readByMe)
            : chat.readByMe,
        readByThem: updatedChat.readByThem
            ? mergeRange(chat.readByThem, updatedChat.readByThem)
            : chat.readByThem,
        latestEventIndex: getLatestEventIndex(chat, updatedChat),
        latestMessage: getLatestMessage(chat, updatedChat),
        notificationsMuted: updatedChat.notificationsMuted ?? chat.notificationsMuted,
        metrics: updatedChat.metrics ?? chat.metrics,
        myMetrics: updatedChat.myMetrics ?? chat.myMetrics,
    };
}

export function mergeUpdates(
    chat: ChatSummary | undefined,
    updatedChat: ChatSummaryUpdates
): ChatSummary | undefined {
    if (!chat) return undefined;

    if (chat.chatId !== updatedChat.chatId) {
        throw new Error("Cannot update chat from a chat with a different chat id");
    }

    if (chat.kind === "group_chat" && updatedChat.kind === "group_chat") {
        return mergeUpdatedGroupChat(chat, updatedChat);
    }

    if (chat.kind === "direct_chat" && updatedChat.kind === "direct_chat") {
        return mergeUpdatedDirectChat(chat, updatedChat);
    }

    throw new Error("Cannot update chat with a chat of a different kind");
}

export function mergeGroupChatDetails(
    previous: GroupChatDetails,
    updates: GroupChatDetailsUpdates
): GroupChatDetails {
    return {
        latestEventIndex: updates.latestEventIndex,
        participants: mergeThings((p) => p.userId, mergeParticipants, previous.participants, {
            added: [],
            updated: updates.participantsAddedOrUpdated,
            removed: updates.participantsRemoved,
        }),
        blockedUsers: new Set<string>(
            mergeThings(identity, identity, [...previous.blockedUsers], {
                added: [...updates.blockedUsersAdded],
                updated: [],
                removed: updates.blockedUsersRemoved,
            })
        ),
        pinnedMessages: mergePinnedMessages(
            previous.pinnedMessages,
            updates.pinnedMessagesAdded,
            updates.pinnedMessagesRemoved
        ),
    };
}

function mergePinnedMessages(
    current: Set<number>,
    added: Set<number>,
    removed: Set<number>
): Set<number> {
    removed.forEach((m) => current.delete(m));
    added.forEach((m) => current.add(m));
    return current;
}

export function mergeChatUpdates(
    chatSummaries: ChatSummary[],
    updateResponse: UpdatesResponse
): ChatSummary[] {
    return mergeThings((c) => c.chatId, mergeUpdates, chatSummaries, {
        added: updateResponse.chatsAdded,
        updated: updateResponse.chatsUpdated,
        removed: updateResponse.chatsRemoved,
    }).sort(compareChats);
}

function mergeParticipants(_: Participant | undefined, updated: Participant) {
    return updated;
}

export function rangesAreEqual(a: DRange, b: DRange): boolean {
    if (a.length !== b.length) return false;

    const rangesA = a.subranges();
    const rangesB = b.subranges();
    if (rangesA.length !== rangesB.length) return false;

    for (let i = 0; i < rangesA.length; i++) {
        const rangeA = rangesA[i];
        const rangeB = rangesB[i];
        if (rangeA.low !== rangeB.low || rangeA.high !== rangeB.high) return false;
    }

    return true;
}

function mergeUpdatedGroupChat(
    chat: GroupChatSummary,
    updatedChat: GroupChatSummaryUpdates
): GroupChatSummary {
    return {
        ...chat,
        name: updatedChat.name ?? chat.name,
        description: updatedChat.description ?? chat.description,
        readByMe: updatedChat.readByMe
            ? mergeRange(chat.readByMe, updatedChat.readByMe)
            : chat.readByMe,
        lastUpdated: updatedChat.lastUpdated,
        latestEventIndex: getLatestEventIndex(chat, updatedChat),
        latestMessage: getLatestMessage(chat, updatedChat),
        blobReference: applyOptionUpdate(chat.blobReference, updatedChat.avatarBlobReferenceUpdate),
        notificationsMuted: updatedChat.notificationsMuted ?? chat.notificationsMuted,
        participantCount: updatedChat.participantCount ?? chat.participantCount,
        myRole: updatedChat.myRole ?? (chat.myRole === "previewer" ? "participant" : chat.myRole),
        mentions: mergeMentions(chat.mentions, updatedChat.mentions),
        ownerId: updatedChat.ownerId ?? chat.ownerId,
        permissions: updatedChat.permissions ?? chat.permissions,
        metrics: updatedChat.metrics ?? chat.metrics,
        myMetrics: updatedChat.myMetrics ?? chat.myMetrics,
        public: updatedChat.public ?? chat.public,
    };
}

function mergeMentions(existing: Mention[], incoming: Mention[]): Mention[] {
    return [
        ...existing,
        ...incoming.filter(
            (m1) => existing.find((m2) => m1.messageId === m2.messageId) === undefined
        ),
    ];
}

function messageMentionsUser(userId: string, msg: EventWrapper<Message>): boolean {
    const txt = getContentAsText(msg.event.content);
    return txt.indexOf(`@UserId(${userId})`) >= 0;
}

function mentionsFromMessages(userId: string, messages: EventWrapper<Message>[]): Mention[] {
    return messages.reduce((mentions, msg) => {
        if (messageMentionsUser(userId, msg)) {
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

export function mergeUnconfirmedIntoSummary(
    userId: string,
    chatSummary: ChatSummary,
    unconfirmedMessages?: EventWrapper<Message>[]
): ChatSummary {
    if (unconfirmedMessages === undefined) return chatSummary;

    let latestMessage = chatSummary.latestMessage;
    let latestEventIndex = chatSummary.latestEventIndex;
    let mentions = chatSummary.kind === "group_chat" ? chatSummary.mentions : [];
    if (unconfirmedMessages.length > 0) {
        const incomingMentions = mentionsFromMessages(userId, unconfirmedMessages);
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

    return chatSummary.kind === "group_chat"
        ? {
              ...chatSummary,
              latestMessage,
              latestEventIndex,
              mentions,
          }
        : {
              ...chatSummary,
              latestMessage,
              latestEventIndex,
          };
}

function toLookup<T>(keyFn: (t: T) => string, things: T[]): Record<string, T> {
    return things.reduce<Record<string, T>>((agg, thing) => {
        agg[keyFn(thing)] = thing;
        return agg;
    }, {});
}

// this is used to merge both the overall list of chats with updates and also the list of participants
// within a group chat
function mergeThings<A, U>(
    keyFn: (a: A | U) => string,
    mergeFn: (existing: A | undefined, updated: U) => A | undefined,
    things: A[],
    updates: { added: A[]; updated: U[]; removed: Set<string> }
): A[] {
    const remaining = things.filter((t) => !updates.removed.has(keyFn(t)));
    const dict = toLookup(keyFn, remaining);
    const updated = updates.updated.reduce((dict, updated) => {
        const key = keyFn(updated);
        const merged = mergeFn(dict[key], updated);
        if (merged) {
            dict[key] = merged;
        }
        return dict;
    }, dict);

    // concat the updated and the added and then merge the result so we are sure
    // there are no duplicates (according to the provided keyFn)
    return Object.values(
        [...Object.values(updated), ...updates.added].reduce((merged, thing) => {
            merged[keyFn(thing)] = thing;
            return merged;
        }, {} as Record<string, A>)
    );
}

function sameUser(a: EventWrapper<ChatEvent>, b: EventWrapper<ChatEvent>): boolean {
    if (a.event.kind === "message" && b.event.kind === "message") {
        return (
            a.event.sender === b.event.sender &&
            b.timestamp - a.timestamp < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS
        );
    }
    return false;
}

function groupBySender(events: EventWrapper<ChatEvent>[]): EventWrapper<ChatEvent>[][] {
    return groupWhile(sameUser, events);
}

export function groupEvents(events: EventWrapper<ChatEvent>[]): EventWrapper<ChatEvent>[][][] {
    return groupWhile(sameDate, events.filter(eventIsVisible))
        .map(reduceJoinedOrLeft)
        .map(groupBySender);
}

function reduceJoinedOrLeft(events: EventWrapper<ChatEvent>[]): EventWrapper<ChatEvent>[] {
    function getLatestAggregateEventIfExists(
        events: EventWrapper<ChatEvent>[]
    ): AggregateParticipantsJoinedOrLeft | undefined {
        if (events.length === 0) return undefined;
        const latest = events[events.length - 1];
        return latest.event.kind === "aggregate_participants_joined_left"
            ? latest.event
            : undefined;
    }

    return events.reduce((previous: EventWrapper<ChatEvent>[], e: EventWrapper<ChatEvent>) => {
        if (e.event.kind === "participant_joined" || e.event.kind === "participant_left") {
            let agg = getLatestAggregateEventIfExists(previous);
            if (agg === undefined) {
                agg = {
                    kind: "aggregate_participants_joined_left",
                    users_joined: new Set(),
                    users_left: new Set(),
                };
            } else {
                previous.pop();
            }

            if (e.event.kind === "participant_joined") {
                if (agg.users_left.has(e.event.userId)) {
                    agg.users_left.delete(e.event.userId);
                } else {
                    agg.users_joined.add(e.event.userId);
                }
            } else {
                if (agg.users_joined.has(e.event.userId)) {
                    agg.users_joined.delete(e.event.userId);
                } else {
                    agg.users_left.add(e.event.userId);
                }
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

export function groupMessagesByDate(events: EventWrapper<Message>[]): EventWrapper<Message>[][] {
    return groupWhile(sameDate, events.filter(eventIsVisible));
}

export function getNextMessageIndex(
    chat: ChatSummary,
    unconfirmedMessages: EventWrapper<Message>[]
): number {
    let current = chat.latestMessage?.event.messageIndex ?? -1;
    if (unconfirmedMessages.length > 0) {
        const messageIndex = unconfirmedMessages[unconfirmedMessages.length - 1].event.messageIndex;
        if (messageIndex > current) {
            current = messageIndex;
        }
    }
    return current + 1;
}

export function getNextEventIndex(
    chat: ChatSummary,
    unconfirmedMessages: EventWrapper<Message>[]
): number {
    let current = chat.latestEventIndex;
    if (unconfirmedMessages.length > 0) {
        const eventIndex = unconfirmedMessages[unconfirmedMessages.length - 1].index;
        if (eventIndex > current) {
            current = eventIndex;
        }
    }
    return current + 1;
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

export function identity<T>(x: T): T {
    return x;
}

function sameDate(a: { timestamp: bigint }, b: { timestamp: bigint }): boolean {
    return areOnSameDay(new Date(Number(a.timestamp)), new Date(Number(b.timestamp)));
}

export function compareChats(a: ChatSummary, b: ChatSummary): number {
    return Number(getDisplayDate(b) - getDisplayDate(a));
}

export function updateArgsFromChats(timestamp: bigint, chatSummaries: ChatSummary[]): UpdateArgs {
    return {
        updatesSince: {
            timestamp,
            groupChats: chatSummaries
                .filter((c) => c.kind === "group_chat" && c.myRole !== "previewer")
                .map((g) => ({
                    chatId: g.chatId,
                    lastUpdated: (g as GroupChatSummary).lastUpdated,
                })),
        },
    };
}

export function toggleReaction(
    userId: string,
    reactions: Reaction[],
    reaction: string
): Reaction[] {
    const result: Reaction[] = [];
    let found = false;

    reactions.forEach((r) => {
        if (r.reaction === reaction) {
            const userIds = new Set(r.userIds);
            if (userIds.delete(userId)) {
                if (userIds.size > 0) {
                    result.push({
                        ...r,
                        userIds,
                    });
                }
            } else {
                userIds.add(userId);
                result.push({
                    ...r,
                    userIds,
                });
            }
            found = true;
        } else {
            result.push(r);
        }
    });

    if (!found) {
        result.push({ reaction, userIds: new Set([userId]) });
    }

    return result;
}

export function eventIsVisible(ew: EventWrapper<ChatEvent>): boolean {
    return (
        ew.event.kind !== "reaction_added" &&
        ew.event.kind !== "message_deleted" &&
        ew.event.kind !== "message_edited" &&
        ew.event.kind !== "reaction_removed" &&
        ew.event.kind !== "message_pinned" &&
        ew.event.kind !== "message_unpinned" &&
        ew.event.kind !== "poll_vote_registered" &&
        ew.event.kind !== "poll_vote_deleted" &&
        ew.event.kind !== "poll_ended"
    );
}

export function enoughVisibleMessages(
    ascending: boolean,
    [minIndex, maxIndex]: IndexRange,
    events: EventWrapper<ChatEvent>[]
): boolean {
    const filtered = events.filter(eventIsVisible);
    if (filtered.length >= EVENT_PAGE_SIZE) {
        return true;
    } else if (ascending) {
        // if there are no more events then we have enough by definition
        return events[events.length - 1]?.index >= maxIndex;
    } else {
        // if there are no previous events then we have enough by definition
        return events[0].index <= minIndex;
    }
}

export function nextIndex(
    ascending: boolean,
    events: EventWrapper<ChatEvent>[]
): number | undefined {
    if (events.length === 0) return undefined;
    return ascending ? events[events.length - 1].index + 1 : events[0].index - 1;
}

export function indexRangeForChat(chat: ChatSummary): IndexRange {
    return [getMinVisibleEventIndex(chat), chat.latestEventIndex];
}

export function mergeReactions(incoming: Reaction[], localReactions: LocalReaction[]): Reaction[] {
    const merged = localReactions.reduce<Reaction[]>((result, local) => {
        return applyLocalReaction(local, result);
    }, incoming);
    return merged;
}

// todo - this needs tweaking because local reactions may have come via rtc and therefore not might not be mine
function applyLocalReaction(local: LocalReaction, reactions: Reaction[]): Reaction[] {
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

export function containsReaction(userId: string, reaction: string, reactions: Reaction[]): boolean {
    const r = reactions.find((r) => r.reaction === reaction);
    return r ? r.userIds.has(userId) : false;
}

function mergeMessageEvents(
    existing: EventWrapper<ChatEvent>,
    incoming: EventWrapper<ChatEvent>,
    localReactions: Record<string, LocalReaction[]>
): EventWrapper<ChatEvent> {
    if (existing.event.kind === "message") {
        if (incoming.event.kind === "message") {
            const key = existing.event.messageId.toString();
            const merged = mergeReactions(incoming.event.reactions, localReactions[key] ?? []);
            return {
                ...existing,
                event: {
                    ...existing.event,
                    content: incoming.event.content,
                    reactions: merged,
                },
            };
        }
    }
    return existing;
}

function partitionEvents(
    events: EventWrapper<ChatEvent>[]
): [Record<string, EventWrapper<ChatEvent>>, EventWrapper<ChatEvent>[]] {
    return events.reduce(
        ([msgs, evts], e) => {
            if (e.event.kind === "message") {
                msgs[e.event.messageId.toString()] = e;
            } else {
                evts.push(e);
            }
            return [msgs, evts];
        },
        [{} as Record<string, EventWrapper<ChatEvent>>, [] as EventWrapper<ChatEvent>[]]
    );
}

export function replaceLocal(
    userId: string,
    chatId: string,
    messageReadTracker: IMessageReadTracker,
    readByMe: DRange,
    onClient: EventWrapper<ChatEvent>[],
    fromServer: EventWrapper<ChatEvent>[]
): EventWrapper<ChatEvent>[] {
    // partition client events into msgs and other events
    const [clientMsgs, clientEvts] = partitionEvents(onClient);

    // partition inbound events into msgs and other events
    const [serverMsgs, serverEvts] = partitionEvents(fromServer);

    // overwrite any local msgs with their server counterpart to correct any index errors
    Object.entries(serverMsgs).forEach(([id, e]) => {
        if (e.event.kind === "message") {
            // only now do we consider this message confirmed
            const idNum = BigInt(id);
            if (unconfirmed.delete(chatId, idNum)) {
                messageReadTracker.confirmMessage(chatId, e.event.messageIndex, idNum);
            } else if (
                e.event.sender === userId &&
                !indexIsInRanges(e.event.messageIndex, readByMe)
            ) {
                // If this message was sent by us and is not currently marked as read, mark it as read
                messageReadTracker.markMessageRead(chatId, e.event.messageIndex, e.event.messageId);
            }
            revokeObjectUrls(clientMsgs[id]);
            clientMsgs[id] = e;
        }
    });

    // concat and dedupe the two lists of non-message events
    const uniqEvts = dedupe(
        (a, b) => a.index === b.index,
        [...clientEvts, ...serverEvts].sort(sortByIndex)
    );

    // create a list from the merged map of messages
    const msgEvts = Object.values(clientMsgs);

    // concat it with the merged non-message event list
    return [...uniqEvts, ...msgEvts].sort(sortByIndex);
}

function sortByIndex(a: EventWrapper<ChatEvent>, b: EventWrapper<ChatEvent>): number {
    return a.index - b.index;
}

function revokeObjectUrls(event?: EventWrapper<ChatEvent>): void {
    if (event?.event.kind === "message") {
        if ("blobUrl" in event.event.content && event.event.content.blobUrl !== undefined) {
            URL.revokeObjectURL(event.event.content.blobUrl);
        }
    }
}

export function replaceAffected(
    chatId: string,
    events: EventWrapper<ChatEvent>[],
    affectedEvents: EventWrapper<ChatEvent>[],
    localReactions: Record<string, LocalReaction[]>
): EventWrapper<ChatEvent>[] {
    if (affectedEvents.length === 0) {
        return events;
    }
    const affectedEventsLookup = affectedEvents.reduce((lookup, event) => {
        lookup[event.index] = event;
        return lookup;
    }, {} as Record<number, EventWrapper<ChatEvent>>);

    return events.map((event) => {
        const affectedEvent = affectedEventsLookup[event.index];
        if (affectedEvent !== undefined) {
            return mergeMessageEvents(event, affectedEvent, localReactions);
        } else if (event.event.kind === "message" && event.event.repliesTo !== undefined) {
            const repliesTo = event.event.repliesTo.eventIndex;
            const affectedReplyContent = affectedEventsLookup[repliesTo];
            if (
                affectedReplyContent !== undefined &&
                affectedReplyContent.event.kind === "message"
            ) {
                return {
                    ...event,
                    event: {
                        ...event.event,
                        repliesTo: {
                            ...event.event.repliesTo,
                            content: affectedReplyContent.event.content,
                        },
                    },
                };
            }
        }
        return event;
    });
}

export function pruneLocalReactions(
    reactions: Record<string, LocalReaction[]>
): Record<string, LocalReaction[]> {
    const limit = Date.now() - 10000;
    return Object.entries(reactions).reduce((pruned, [k, v]) => {
        const filtered = v.filter((r) => r.timestamp > limit);
        if (filtered.length > 0) {
            pruned[k] = filtered;
        }
        return pruned;
    }, {} as Record<string, LocalReaction[]>);
}

export function replaceMessageContent(
    events: EventWrapper<ChatEvent>[],
    messageId: bigint,
    content: MessageContent
): EventWrapper<ChatEvent>[] {
    return events.map((e) => {
        if (e.event.kind === "message" && e.event.messageId === messageId) {
            return {
                ...e,
                event: {
                    ...e.event,
                    content: content,
                },
            };
        }
        return e;
    });
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

function getLatestEventIndex(chat: ChatSummary, updatedChat: ChatSummaryUpdates): number {
    return Math.max(updatedChat.latestEventIndex ?? 0, chat.latestEventIndex);
}

function getLatestMessage(
    chat: ChatSummary,
    updatedChat: ChatSummaryUpdates
): EventWrapper<Message> | undefined {
    if (chat.latestMessage === undefined) return updatedChat.latestMessage;
    if (updatedChat.latestMessage === undefined) return chat.latestMessage;

    // If the local message is unconfirmed, treat that as the latest
    const isLocalLatestUnconfirmed = unconfirmed.contains(
        chat.chatId,
        chat.latestMessage.event.messageId
    );
    if (isLocalLatestUnconfirmed) return chat.latestMessage;

    // Otherwise take the one with the highest event index, if they match, take the server version since it may have had
    // subsequent updates (eg. deleted)
    return updatedChat.latestMessage.index >= chat.latestMessage.index
        ? updatedChat.latestMessage
        : chat.latestMessage;
}

export function isPreviewing(chat: ChatSummary): boolean {
    return chat.kind === "group_chat" && chat.myRole === "previewer";
}

export function groupChatFromCandidate(
    userId: string,
    chatId: string,
    candidate: CandidateGroupChat
): GroupChatSummary {
    return {
        kind: "group_chat",
        chatId,
        readByMe: new DRange(),
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
        participantCount: candidate.participants.length + 1, // +1 to include us
        myRole: "owner",
        mentions: [],
        ...candidate.avatar,
        ownerId: userId,
        permissions: candidate.permissions,
        metrics: emptyChatMetrics(),
        myMetrics: emptyChatMetrics(),
    };
}

export function getStorageRequiredForMessage(content: MessageContent | undefined): number {
    if (content === undefined) return 0;

    switch (content.kind) {
        case "audio_content":
        case "file_content":
        case "image_content":
            return content.blobData?.length ?? 0;
        case "video_content":
            return (
                (content.videoData.blobData?.length ?? 0) +
                (content.imageData.blobData?.length ?? 0)
            );

        default:
            return 0;
    }
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

export function canChangePermissions(group: GroupChatSummary): boolean {
    return isPermitted(group.myRole, group.permissions.changePermissions);
}

export function canChangeRoles(
    group: GroupChatSummary,
    currRole: MemberRole,
    newRole: MemberRole
): boolean {
    if (currRole === newRole) {
        return false;
    }

    switch (newRole) {
        case "super_admin":
            return false;
        case "owner":
            return hasOwnerRights(group.myRole);
        default:
            return isPermitted(group.myRole, group.permissions.changeRoles);
    }
}

export function canAddMembers(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return !chat.public && isPermitted(chat.myRole, chat.permissions.addMembers);
    } else {
        return false;
    }
}

export function canRemoveMembers(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return !chat.public && isPermitted(chat.myRole, chat.permissions.removeMembers);
    } else {
        return false;
    }
}

export function canBlockUsers(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return chat.public && isPermitted(chat.myRole, chat.permissions.blockUsers);
    } else {
        return true;
    }
}

export function canUnblockUsers(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return chat.public && isPermitted(chat.myRole, chat.permissions.blockUsers);
    } else {
        return true;
    }
}

export function canDeleteOtherUsersMessages(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return isPermitted(chat.myRole, chat.permissions.deleteMessages);
    } else {
        return false;
    }
}

export function canEditGroupDetails(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return isPermitted(chat.myRole, chat.permissions.updateGroup);
    } else {
        return false;
    }
}

export function canPinMessages(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return isPermitted(chat.myRole, chat.permissions.pinMessages);
    } else {
        return false;
    }
}

export function canInviteUsers(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return chat.public || isPermitted(chat.myRole, chat.permissions.inviteUsers);
    } else {
        return false;
    }
}

export function canCreatePolls(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return isPermitted(chat.myRole, chat.permissions.createPolls);
    } else {
        return true;
    }
}

export function canSendMessages(chat: ChatSummary, userLookup: UserLookup): boolean {
    if (chat.kind === "group_chat") {
        return isPermitted(chat.myRole, chat.permissions.sendMessages);
    } else if (userLookup[chat.them]?.kind === "bot") {
        return false;
    } else {
        return true;
    }
}

export function canReactToMessages(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return isPermitted(chat.myRole, chat.permissions.reactToMessages);
    } else {
        return true;
    }
}

export function canBeRemoved(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return !hasOwnerRights(chat.myRole);
    } else {
        return false;
    }
}

export function canLeaveGroup(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return chat.myRole !== "owner";
    } else {
        return false;
    }
}

export function canDeleteGroup(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return hasOwnerRights(chat.myRole);
    } else {
        return false;
    }
}

export function canMakeGroupPrivate(chat: ChatSummary): boolean {
    if (chat.kind === "group_chat") {
        return chat.public && hasOwnerRights(chat.myRole);
    } else {
        return false;
    }
}

function hasOwnerRights(role: MemberRole): boolean {
    return role === "owner" || role === "super_admin";
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

export function buildCryptoTransferText(
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
            ? get(_)("you")
            : `${lookup[userId]?.username ?? get(_)("unknown")}`;
    }

    const values = {
        amount: formatICP(content.transfer.amountE8s, 0),
        receiver: username(content.transfer.recipient),
        sender: username(senderId),
    };

    const key =
        content.transfer.kind === "completed"
            ? "confirmedSent"
            : me
            ? "pendingSentByYou"
            : "pendingSent";

    return get(_)(`icpTransfer.${key}`, { values });
}

export function buildTransactionLink(content: CryptocurrencyContent): string | undefined {
    const url = buildTransactionUrl(content);
    return url !== undefined
        ? get(_)("icpTransfer.viewTransaction", { values: { url } })
        : undefined;
}

export function buildTransactionUrl(content: CryptocurrencyContent): string | undefined {
    if (content.transfer.kind !== "completed") {
        return undefined;
    }

    return `https://dashboard.internetcomputer.org/transaction/${content.transfer.transactionHash}`;
}

export function emptyChatMetrics(): ChatMetrics {
    return {
        audioMessages: 0,
        cyclesMessages: 0,
        edits: 0,
        icpMessages: 0,
        giphyMessages: 0,
        deletedMessages: 0,
        fileMessages: 0,
        pollVotes: 0,
        textMessages: 0,
        imageMessages: 0,
        replies: 0,
        videoMessages: 0,
        polls: 0,
        reactions: 0,
    };
}

export function mergeChatMetrics(a: ChatMetrics, b: ChatMetrics): ChatMetrics {
    return {
        audioMessages: a.audioMessages + b.audioMessages,
        cyclesMessages: a.cyclesMessages + b.cyclesMessages,
        edits: a.edits + b.edits,
        icpMessages: a.icpMessages + b.icpMessages,
        giphyMessages: a.giphyMessages + b.giphyMessages,
        deletedMessages: a.deletedMessages + b.deletedMessages,
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

export function getFirstUnreadMention(
    messagesRead: IMessageReadTracker,
    chat: ChatSummary
): Mention | undefined {
    if (chat.kind === "direct_chat") return undefined;
    return chat.mentions.find(
        (m) => !messagesRead.isRead(chat.chatId, m.messageIndex, m.messageId)
    );
}

export function getFirstUnreadMessageIndex(
    messagesRead: IMessageReadTracker,
    chat: ChatSummary
): number | undefined {
    if (chat.kind === "group_chat" && chat.myRole === "previewer") return undefined;

    return messagesRead.getFirstUnreadMessageIndex(
        chat.chatId,
        getMinVisibleMessageIndex(chat),
        chat.latestMessage?.event.messageIndex
    );
}

export function addEditedSuffix(txt: string | undefined, edited: boolean): string {
    if (txt === undefined || txt === "") return "";
    return edited ? `${txt} <span class="edited-msg">(${get(_)("edited")})</span>` : txt;
}
