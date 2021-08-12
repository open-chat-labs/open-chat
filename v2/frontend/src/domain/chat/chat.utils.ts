import type { UserLookup } from "../user/user";
import { compareUsersOnlineFirst, nullUser, userIsOnline } from "../user/user.utils";
import type {
    ChatSummary,
    DirectChatSummary,
    EventWrapper,
    GroupChatSummary,
    MediaContent,
    Message,
    MessageContent,
    Participant,
    ReplyContext,
    UpdatedChatSummary,
    UpdatedDirectChatSummary,
    UpdatedGroupChatSummary,
    UpdatesResponse,
} from "./chat";
import { groupWhile } from "../../utils/list";
import { areOnSameDay } from "../../utils/date";

const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute

export function getContentAsText(content: MessageContent): string {
    let text;
    if (content.kind === "text_content") {
        text = content.text;
    } else if (content.kind === "media_content") {
        text = buildTextForMediaContent(content);
    } else if (content.kind === "file_content") {
        text = content.name;
    } else if (content.kind === "cycles_content") {
        // todo - format cycles
        text = "cycles_content";
    } else {
        throw new Error(`Unrecognised content type - ${content}`);
    }
    return text.trim();
}

function buildTextForMediaContent({ caption, mimeType }: MediaContent): string {
    if (caption) return caption;

    // TODO - this should be language localised
    const mimeTypeLower = mimeType.toLowerCase();
    if (mimeTypeLower.startsWith("video/")) {
        return "video";
    } else if (mimeTypeLower.startsWith("image/")) {
        return "image";
    } else {
        return "file";
    }
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

export function getUnreadMessages({ latestMessage, latestReadByMe }: ChatSummary): number {
    return (latestMessage?.index ?? 0) - latestReadByMe;
}

export function latestMessageText({ latestMessage }: ChatSummary): string {
    if (latestMessage?.event.kind !== "message") return "";
    return getContentAsText(latestMessage.event.content);
}

export function compareByDate(a: ChatSummary, b: ChatSummary): number {
    const dateA = getDisplayDate(a);
    const dateB = getDisplayDate(b);
    return Number(dateB - dateA);
}

export function getParticipantsString(
    userLookup: UserLookup,
    { participants }: GroupChatSummary,
    unknownUser: string,
    you: string
): string {
    if (participants.length > 5) {
        const numberOnline = participants.filter((p) => userIsOnline(userLookup, p.userId)).length;
        return `${participants.length + 1} members (${numberOnline + 1} online)`;
    }
    return participants
        .map((p) => userLookup[p.userId] ?? nullUser(unknownUser))
        .sort(compareUsersOnlineFirst)
        .map((p) => p.username)
        .concat([you])
        .join(", ");
}

export function textMessage(
    userId: string,
    content: string,
    replyingTo: ReplyContext | undefined
): Message {
    return {
        kind: "message",
        content: {
            kind: "text_content",
            text: content,
        },
        sender: userId,
        repliesTo: replyingTo,
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
    updatedChat: UpdatedDirectChatSummary
): DirectChatSummary {
    chat.latestReadByMe = updatedChat.latestReadByMe ?? chat.latestReadByMe;
    chat.latestMessage = updatedChat.latestMessage ?? chat.latestMessage;
    chat.latestReadByThem = updatedChat.latestReadByThem ?? chat.latestReadByThem;
    chat.lastUpdated = updatedChat.lastUpdated;
    chat.latestEventIndex = updatedChat.latestEventIndex;
    return chat;
}

export function mergeUpdated(chat: ChatSummary, updatedChat: UpdatedChatSummary): ChatSummary {
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
    return mergeThings((c) => c.chatId, mergeUpdated, chatSummaries, {
        added: updateResponse.chatsAdded,
        updated: updateResponse.chatsUpdated,
        removed: updateResponse.chatsRemoved,
    });
}

function mergeParticipants(existing: Participant, updated: Participant) {
    existing.role = updated.role;
    return existing;
}

function mergeUpdatedGroupChat(
    chat: GroupChatSummary,
    updatedChat: UpdatedGroupChatSummary
): GroupChatSummary {
    chat.name = updatedChat.name ?? chat.name;
    chat.description = updatedChat.description ?? chat.description;
    chat.latestReadByMe = updatedChat.latestReadByMe ?? chat.latestReadByMe;
    chat.latestMessage = updatedChat.latestMessage ?? chat.latestMessage;
    chat.lastUpdated = updatedChat.lastUpdated;
    chat.latestEventIndex = updatedChat.latestEventIndex;
    chat.participants = mergeThings((p) => p.userId, mergeParticipants, chat.participants, {
        added: updatedChat.participantsAdded,
        updated: updatedChat.participantsUpdated,
        removed: updatedChat.participantsRemoved,
    });
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
    mergeFn: (existing: A, updated: U) => A,
    things: A[],
    updates: { added: A[]; updated: U[]; removed: Set<string> }
): A[] {
    const remaining = things.filter((t) => !updates.removed.has(keyFn(t)));
    const dict = toLookup(keyFn, remaining);
    const updated = updates.updated.reduce((dict, updated) => {
        const key = keyFn(updated);
        if (dict[key]) {
            dict[key] = mergeFn(dict[key], updated);
        }
        return dict;
    }, dict);
    return [...Object.values(updated), ...updates.added];
}

function sameUser(a: EventWrapper, b: EventWrapper): boolean {
    if (a.event.kind !== "message" || b.event.kind !== "message") {
        return false;
    }
    return (
        a.event.sender === b.event.sender &&
        b.timestamp - a.timestamp < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS
    );
}

function groupBySender(events: EventWrapper[]): EventWrapper[][] {
    return groupWhile(sameUser, events);
}

export function groupEvents(events: EventWrapper[]): EventWrapper[][][] {
    return groupWhile(sameDate, events).map(groupBySender);
}

export function earliestLoadedEventIndex(events: EventWrapper[]): number | undefined {
    return events[0]?.index;
}

export function latestLoadedEventIndex(events: EventWrapper[]): number | undefined {
    return events[events.length - 1]?.index;
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
