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
} from "./chat";
import { dedupe, groupWhile } from "../../utils/list";
import { areOnSameDay } from "../../utils/date";
import { v1 as uuidv1 } from "uuid";
import { UnsupportedValueError } from "../../utils/error";
import { overwriteCachedEvents } from "../../utils/caching";

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
    } else if (content.kind === "cycles_content") {
        // todo - format cycles
        text = "cycles_content";
    } else if (content.kind === "deleted_content") {
        text = "deleted message";
    } else {
        throw new UnsupportedValueError("Unrecognised content type", content);
    }
    return text.trim();
}

export function userIdsFromChatSummary(chat: ChatSummary): string[] {
    if (chat.kind === "direct_chat") {
        return [chat.them];
    }
    if (chat.kind === "group_chat") {
        return chat.participants.map((p) => p.userId);
    }
    return [];
}

export function userIdsFromChatSummaries(
    chats: ChatSummary[],
    includeGroupChats = false
): Set<string> {
    return chats.reduce<Set<string>>((userIds, chat) => {
        if (chat.kind === "direct_chat") {
            userIds.add(chat.them);
        }
        if (chat.kind === "group_chat" && includeGroupChats) {
            chat.participants.forEach((p) => userIds.add(p.userId));
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

export function getUnreadMessages(chat: ChatSummary): number {
    const latestMessageIndex = chat.latestMessage?.event.messageIndex;
    if (latestMessageIndex === undefined) {
        // if we have no latestMessage then we cannot have any unread messages
        return 0;
    }

    const firstMessageIndex = getMinVisibleMessageIndex(chat);

    if (chat.readByMe.length === 0) {
        return latestMessageIndex - firstMessageIndex + 1;
    }

    const [, unread, lastRead] = chat.readByMe.reduce(
        ([first, unread], { from, to }) => {
            return [to + 1, unread + Math.max(from, first) - first, to];
        },
        [firstMessageIndex, 0, 0] // [firstIndex, unreadCount, lastReadIndex]
    );

    return latestMessageIndex - lastRead + unread;
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

export function setMessageRead(chat: ChatSummary, messageIndex: number): ChatSummary {
    chat.readByMe = insertIndexIntoRanges(messageIndex, chat.readByMe);
    return chat;
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
    return content.kind !== "text_content" && content.kind !== "deleted_content"
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

export const blobbyContentTypes = [
    "file_content",
    "image_content",
    "video_content",
    "audio_content",
];

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
        (chat.kind === "group_chat" ? chat.joined : BigInt(+new Date()))
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
    chat.participants = mergeThings((p) => p.userId, mergeParticipants, chat.participants, {
        added: [],
        updated: updatedChat.participantsAddedOrUpdated,
        removed: updatedChat.participantsRemoved,
    });
    chat.blobReference = updatedChat.avatarBlobReference ?? chat.blobReference;
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
    return [...Object.values(updated), ...updates.added];
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
    chat.latestEventIndex = ev.index;
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

export function updateParticipant(
    chat: GroupChatSummary,
    id: string,
    updater: (p: Participant) => Participant
): GroupChatSummary {
    // note that this mutates the chat rather than cloning. Quite significant as it means the
    // parent machine's chat is the same object
    chat.participants = chat.participants.map((p) => (p.userId === id ? updater(p) : p));
    return chat;
}

export function removeParticipant(chat: GroupChatSummary, id: string): GroupChatSummary {
    chat.participants = chat.participants.filter((p) => p.userId !== id);
    return chat;
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
            incoming.event.reactions = merged;
            return incoming;
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
    onClient: EventWrapper<ChatEvent>[],
    fromServer: EventWrapper<ChatEvent>[],
    unconfirmed: Set<bigint>
): EventWrapper<ChatEvent>[] {
    // partition client events into msgs and other events
    const [clientMsgs, clientEvts] = partitionEvents(onClient);

    // partition inbound events into msgs and other events
    const [serverMsgs, serverEvts] = partitionEvents(fromServer);

    // overwrite any local msgs with their server counterpart to correct any index errors
    Object.entries(serverMsgs).forEach(([id, e]) => {
        // only now do we consider this message confirmed
        unconfirmed.delete(BigInt(id));
        clientMsgs[id] = e;
    });

    // concat and dedupe the two lists of non-message events
    const uniqEvts = dedupe((a, b) => a.index === b.index, [...clientEvts, ...serverEvts]);

    // create a list from the merged map of messages
    const msgEvts = Object.values(clientMsgs);

    // concat it with the merged non-message event list
    return [...uniqEvts, ...msgEvts].sort((a, b) => a.index - b.index);
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
    const limit = +new Date() - 10000;
    return Object.entries(reactions).reduce((pruned, [k, v]) => {
        const filtered = v.filter((r) => r.timestamp > limit);
        if (filtered.length > 0) {
            pruned[k] = filtered;
        }
        return pruned;
    }, {} as Record<string, LocalReaction[]>);
}
