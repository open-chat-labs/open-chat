import type { UserLookup, UserSummary } from "../user/user";
import { compareUsersOnlineFirst, nullUser, userIsOnline } from "../user/user.utils";
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
    MessageIndexRange,
    Reaction,
    Message,
    IndexRange,
    LocalReaction,
    GroupChatDetails,
    GroupChatDetailsUpdates,
} from "./chat";
import { dedupe, groupWhile, zip } from "../../utils/list";
import { areOnSameDay } from "../../utils/date";
import { v1 as uuidv1 } from "uuid";
import { UnsupportedValueError } from "../../utils/error";
import { overwriteCachedEvents } from "../../utils/caching";
import { unconfirmed } from "../../stores/unconfirmed";
import type { IMessageReadTracker } from "../../stores/markRead";

const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute
const EVENT_PAGE_SIZE = 20;

export function newMessageId(): bigint {
    return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
}

export function getContentAsText(content: MessageContent): string {
    let text;
    if (content.kind === "text_content") {
        text = content.text;
    } else if (content.kind === "image_content") {
        text = "image";
    } else if (content.kind === "video_content") {
        text = "video";
    } else if (content.kind === "audio_content") {
        text = "audio";
    } else if (content.kind === "file_content") {
        text = content.name;
    } else if (content.kind === "crypto_content") {
        // todo - format crypto
        text = "crypto_content";
    } else if (content.kind === "deleted_content") {
        text = "deleted message";
    } else if (content.kind === "placeholder_content") {
        text = "placeholder content";
    } else {
        throw new UnsupportedValueError("Unrecognised content type", content);
    }
    return text.trim();
}

export function userIdsFromEvents(events: EventWrapper<ChatEvent>[]): Set<string> {
    return events.reduce<Set<string>>((userIds, e) => {
        if ("userIds" in e.event) {
            e.event.userIds.forEach((u) => userIds.add(u));
        }
        if (e.event.kind === "message") {
            userIds.add(e.event.sender);
        }
        if (e.event.kind === "group_chat_created") {
            userIds.add(e.event.created_by);
        }
        if (e.event.kind === "participants_added") {
            userIds.add(e.event.addedBy);
        }
        if (e.event.kind === "participant_joined") {
            userIds.add(e.event.userId);
        }
        if (e.event.kind === "participants_promoted_to_admin") {
            userIds.add(e.event.promotedBy);
        }
        if (e.event.kind === "participants_dismissed_as_admin") {
            userIds.add(e.event.dismissedBy);
        }
        if (e.event.kind === "participants_removed") {
            userIds.add(e.event.removedBy);
        }
        if (e.event.kind === "participant_left") {
            userIds.add(e.event.userId);
        }
        if (e.event.kind === "name_changed") {
            userIds.add(e.event.changedBy);
        }
        if (e.event.kind === "avatar_changed") {
            userIds.add(e.event.changedBy);
        }
        if (e.event.kind === "desc_changed") {
            userIds.add(e.event.changedBy);
        }
        if (e.event.kind === "users_blocked") {
            userIds.add(e.event.blockedBy);
        }
        if (e.event.kind === "users_unblocked") {
            userIds.add(e.event.unblockedBy);
        }
        return userIds;
    }, new Set<string>());
}

export function getMinVisibleMessageIndex(chat: ChatSummary): number {
    if (chat.kind === "direct_chat") return 0;
    return chat.minVisibleMessageIndex;
}

export function getMinVisibleEventIndex(chat: ChatSummary): number {
    if (chat.kind === "direct_chat") return 0;
    return chat.minVisibleEventIndex;
}

export function indexIsInRanges(index: number, ranges: MessageIndexRange[]): boolean {
    return ranges.reduce<boolean>((agg, { from, to }) => {
        if (!agg && index >= from && index <= to) return true;
        return agg;
    }, false);
}

export function insertIndexIntoRanges(
    index: number,
    ranges: MessageIndexRange[]
): MessageIndexRange[] {
    // todo this could be simpler actually. We know will be either creating a new range or
    // extending an existing one, so we could just iterate through all the ranges and
    // see if we find one to extend. If not, add a new one.
    return mergeMessageIndexRanges(ranges, [{ from: index, to: index }]);
}

export function messageIsReadByThem(chat: ChatSummary, { messageIndex }: Message): boolean {
    if (chat.kind === "group_chat") return true;
    return indexIsInRanges(messageIndex, chat.readByThem);
}

export function messageIsReadByMe(chat: ChatSummary, { messageIndex }: Message): boolean {
    return indexIsInRanges(messageIndex, chat.readByMe);
}

export function getFirstUnreadMessageIndex(chat: ChatSummary): number {
    const latestMessageIndex = chat.latestMessage?.event.messageIndex;
    const min = getMinVisibleMessageIndex(chat);

    if (latestMessageIndex === undefined) {
        return Number.MAX_VALUE;
    }

    if (chat.readByMe.length === 0) {
        return min;
    }

    const [unreadIndex, finalRange] = chat.readByMe.reduce(
        ([index, prev], range) => {
            return range.from > min
                ? prev === undefined
                    ? [min, range]
                    : [Math.min(index, prev.to + 1), range]
                : [index, range];
        },
        [Number.MAX_VALUE, undefined as MessageIndexRange | undefined]
    );

    return Math.min(unreadIndex, finalRange ? finalRange.to + 1 : Number.MAX_VALUE);
}

export function latestMessageText({ latestMessage }: ChatSummary): string {
    return latestMessage?.event ? getContentAsText(latestMessage.event.content) : "";
}

export function compareByDate(a: ChatSummary, b: ChatSummary): number {
    const dateA = getDisplayDate(a);
    const dateB = getDisplayDate(b);
    return Number(dateB - dateA);
}

export function getParticipantsString(
    user: UserSummary,
    userLookup: UserLookup,
    participantIds: string[],
    unknownUser: string,
    you: string
): string {
    if (participantIds.length > 5) {
        const numberOnline = participantIds.map((id) => userIsOnline(userLookup, id)).length;
        return `${participantIds.length} members (${numberOnline} online)`;
    }
    return participantIds
        .map((id) => userLookup[id] ?? nullUser(unknownUser))
        .sort(compareUsersOnlineFirst)
        .map((p) => (p.userId === user.userId ? you : p.username))
        .join(", ");
}

function addCaption(caption: string | undefined, content: MessageContent): MessageContent {
    return content.kind !== "text_content" &&
        content.kind !== "deleted_content" &&
        content.kind !== "placeholder_content"
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
    return (
        chat.latestMessage?.timestamp ??
        (chat.kind === "group_chat" ? chat.joined : BigInt(Date.now()))
    );
}

function mergeUpdatedDirectChat(
    chat: DirectChatSummary,
    updatedChat: DirectChatSummaryUpdates
): DirectChatSummary {
    chat.readByMe = updatedChat.readByMe
        ? mergeMessageIndexRanges(chat.readByMe, updatedChat.readByMe)
        : chat.readByMe;
    chat.readByThem = updatedChat.readByThem ?? chat.readByThem;
    chat.latestMessage = updatedChat.latestMessage ?? chat.latestMessage;
    chat.latestEventIndex = updatedChat.latestEventIndex ?? chat.latestEventIndex;
    chat.notificationsMuted = updatedChat.notificationsMuted ?? chat.notificationsMuted;
    return chat;
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
    };
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

export function compareMessageRange(a: MessageIndexRange, b: MessageIndexRange): number {
    if (a.from === b.from) {
        return a.to - b.to;
    }
    return a.from - b.from;
}

// Note that this function assumes that the ranges have already been optimally collapsed to the
// minimun number of ranges
export function messageIndexRangesAreEqual(
    a: MessageIndexRange[],
    b: MessageIndexRange[]
): boolean {
    if (a.length !== b.length) return false;

    a.sort(compareMessageRange);
    b.sort(compareMessageRange);

    return zip(a, b).reduce<boolean>((same, [rangeA, rangeB]) => {
        return same && compareMessageRange(rangeA, rangeB) === 0;
    }, true);
}

export function mergeMessageIndexRanges(
    current: MessageIndexRange[],
    inbound: MessageIndexRange[]
): MessageIndexRange[] {
    const merged = [...current, ...inbound];
    merged.sort(compareMessageRange);

    if (merged.length === 0) return merged;

    const stack = [merged[0]];

    for (let i = 1; i < merged.length; i++) {
        const top = stack[0];

        if (top.to < merged[i].from) {
            stack.push(merged[i]);
        } else if (top.to < merged[i].to) {
            top.to = merged[i].to;
            stack.pop();
            stack.push(top);
        }
    }

    // we may still need to collapse any contiguous ranges
    const reduced = stack.reduce<MessageIndexRange[]>((agg, range) => {
        const prev = agg[agg.length - 1];
        if (prev !== undefined && range.from === prev.to + 1) {
            prev.to = range.to;
        } else {
            agg.push(range);
        }
        return agg;
    }, []);

    return reduced;
}

function mergeUpdatedGroupChat(
    chat: GroupChatSummary,
    updatedChat: GroupChatSummaryUpdates
): GroupChatSummary {
    chat.name = updatedChat.name ?? chat.name;
    chat.description = updatedChat.description ?? chat.description;
    chat.readByMe = updatedChat.readByMe
        ? mergeMessageIndexRanges(chat.readByMe, updatedChat.readByMe)
        : chat.readByMe;
    chat.latestMessage = updatedChat.latestMessage ?? chat.latestMessage;
    chat.lastUpdated = updatedChat.lastUpdated;
    chat.latestEventIndex = updatedChat.latestEventIndex ?? chat.latestEventIndex;
    chat.blobReference = updatedChat.avatarBlobReference ?? chat.blobReference;
    chat.notificationsMuted = updatedChat.notificationsMuted ?? chat.notificationsMuted;
    chat.participantCount = updatedChat.participantCount ?? chat.participantCount;
    chat.myRole = updatedChat.myRole ?? chat.myRole;
    return chat;
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
    return groupWhile(sameDate, events.filter(eventIsVisible)).map(groupBySender);
}

export function earliestLoadedEventIndex(events: EventWrapper<ChatEvent>[]): number | undefined {
    return events[0]?.index;
}

export function getNextMessageIndex(chat: ChatSummary, events: EventWrapper<ChatEvent>[]): number {
    // first get the next index according to the chat
    const chatIdx = (chat.latestMessage?.event.messageIndex ?? 0) + 1;

    // then get the next index according to the loaded events
    const loadedIdx = (latestLoadedMessageIndex(events) ?? 0) + 1;

    // pick the max
    return Math.max(chatIdx, loadedIdx);
}

export function getNextEventIndex(chat: ChatSummary, events: EventWrapper<ChatEvent>[]): number {
    // first get the next index according to the chat
    const chatIdx = chat.latestEventIndex + 1;

    // then get the next index according to the loaded events
    const loadedIdx = (latestLoadedEventIndex(events) ?? 0) + 1;

    // pick the max
    return Math.max(chatIdx, loadedIdx);
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

// todo - this needs to return the last idx that we actually loaded from the server
// at the moment it will return the latest confirmed idx which may be later than messages
// other people have added - that's why we are missing messages
// to solution is to only remove things from the unconfirmed set when we load them from the
// server - easy
export function latestLoadedEventIndex(
    events: EventWrapper<ChatEvent>[],
    unconfirmed?: Set<bigint>
): number | undefined {
    if (unconfirmed === undefined) {
        return events[events.length - 1]?.index;
    }
    let idx = undefined;
    for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i].event;
        if (e.kind !== "message" || (e.kind === "message" && !unconfirmed.has(e.messageId))) {
            idx = events[i].index;
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

export function setLastMessageOnChat(chat: ChatSummary, ev: EventWrapper<Message>): ChatSummary {
    // we cannot update this index when we send a message because it will cause us to attempt to
    // load messages from the server before they have even been committed to the server
    // chat.latestEventIndex = ev.index;
    chat.latestMessage = ev;
    chat.readByMe = insertIndexIntoRanges(ev.event.messageIndex, chat.readByMe);
    return chat;
}

function sameDate(a: { timestamp: bigint }, b: { timestamp: bigint }): boolean {
    return areOnSameDay(new Date(Number(a.timestamp)), new Date(Number(b.timestamp)));
}

export function compareChats(a: ChatSummary, b: ChatSummary): number {
    return latestActivity(b) - latestActivity(a);
}

function latestActivity(chat: ChatSummary): number {
    if (chat.latestMessage) {
        return Number(chat.latestMessage.timestamp);
    } else {
        return Number(chat.kind === "direct_chat" ? chat.dateCreated : chat.joined);
    }
}

export function updateArgsFromChats(timestamp: bigint, chatSummaries: ChatSummary[]): UpdateArgs {
    return {
        updatesSince: {
            timestamp,
            groupChats: chatSummaries
                .filter((c) => c.kind === "group_chat")
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
    const r = reactions.find((r) => r.reaction === reaction);
    if (r === undefined) {
        reactions.push({ reaction, userIds: new Set([userId]) });
    } else {
        if (r.userIds.has(userId)) {
            r.userIds.delete(userId);
            if (r.userIds.size === 0) {
                return reactions.filter((r) => r.reaction !== reaction);
            }
        } else {
            r.userIds.add(userId);
        }
    }
    return reactions;
}

export function eventIsVisible(ew: EventWrapper<ChatEvent>): boolean {
    return (
        ew.event.kind !== "reaction_added" &&
        ew.event.kind !== "message_deleted" &&
        ew.event.kind !== "message_edited" &&
        ew.event.kind !== "reaction_removed"
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
        return events[events.length - 1].index === maxIndex;
    } else {
        // if there are no previous events then we have enough by definition
        return events[0].index <= minIndex;
    }
}

export function nextIndex(ascending: boolean, events: EventWrapper<ChatEvent>[]): number {
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
            existing.event.reactions = merged;
            return existing;
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
    onClient: EventWrapper<ChatEvent>[],
    fromServer: EventWrapper<ChatEvent>[]
): EventWrapper<ChatEvent>[] {
    // partition client events into msgs and other events
    const [clientMsgs, clientEvts] = partitionEvents(onClient);

    // partition inbound events into msgs and other events
    const [serverMsgs, serverEvts] = partitionEvents(fromServer);

    // overwrite any local msgs with their server counterpart to correct any index errors
    Object.entries(serverMsgs).forEach(([id, e]) => {
        // only now do we consider this message confirmed
        const idNum = BigInt(id);
        unconfirmed.delete(idNum);
        if (e.event.kind === "message") {
            const confirmed = messageReadTracker.confirmMessage(
                chatId,
                e.event.messageIndex,
                idNum
            );
            if (e.event.sender === userId && !confirmed) {
                // make double sure that our own messages are marked read
                messageReadTracker.markMessageRead(chatId, e.event.messageIndex, e.event.messageId);
            }
        }
        revokeObjectUrls(clientMsgs[id]);
        clientMsgs[id] = e;
    });

    // concat and dedupe the two lists of non-message events
    const uniqEvts = dedupe((a, b) => a.index === b.index, [...clientEvts, ...serverEvts]);

    // create a list from the merged map of messages
    const msgEvts = Object.values(clientMsgs);

    // concat it with the merged non-message event list
    return [...uniqEvts, ...msgEvts].sort((a, b) => a.index - b.index);
}

function revokeObjectUrls(event?: EventWrapper<ChatEvent>): void {
    if (event?.event.kind === "message") {
        if ("blobUrl" in event.event.content && event.event.content.blobUrl !== undefined) {
            URL.revokeObjectURL(event.event.content.blobUrl);
        }
    }
}

// todo - this is not very efficient at the moment
export function replaceAffected(
    chatId: string,
    events: EventWrapper<ChatEvent>[],
    affectedEvents: EventWrapper<ChatEvent>[],
    localReactions: Record<string, LocalReaction[]>
): EventWrapper<ChatEvent>[] {
    const toCacheBust: EventWrapper<ChatEvent>[] = [];
    const updated = events.map((ev) => {
        const aff = affectedEvents.find((a) => a.index === ev.index);
        if (aff !== undefined) {
            const merged = mergeMessageEvents(ev, aff, localReactions);
            toCacheBust.push(merged);
            return merged;
        }
        return ev;
    });
    if (toCacheBust.length > 0) {
        // Note - this is fire and forget which is a tiny bit dodgy
        overwriteCachedEvents(chatId, toCacheBust);
    }
    return updated;
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
