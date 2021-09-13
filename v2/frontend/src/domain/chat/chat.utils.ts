import type { UserLookup, UserSummary } from "../user/user";
import { compareUsersOnlineFirst, nullUser, userIsOnline } from "../user/user.utils";
import type {
    ChatSummary,
    DirectChatSummary,
    EventWrapper,
    GroupChatSummary,
    MediaContent,
    MessageContent,
    Participant,
    TextContent,
    ChatSummaryUpdates,
    DirectChatSummaryUpdates,
    GroupChatSummaryUpdates,
    UpdatesResponse,
    ChatEvent,
    GroupMessage,
    DirectMessage,
    ReplyContext,
    UpdateArgs,
} from "./chat";
import { groupWhile } from "../../utils/list";
import { areOnSameDay } from "../../utils/date";
import { v1 as uuidv1 } from "uuid";
import { UnsupportedValueError } from "../../utils/error";

const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute

export function newMessageId(): bigint {
    return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
}

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
        throw new UnsupportedValueError("Unrecognised content type", content);
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

export function getUnreadMessages({ unreadByMe }: ChatSummary): number {
    return unreadByMe.reduce((agg, { from, to }) => {
        return agg + (to - from + 1);
    }, 0);
}

export function getFirstUnreadMessageIndex({ unreadByMe }: ChatSummary): number {
    return unreadByMe.reduce((agg, { from }) => {
        return from < agg ? from : agg;
    }, Number.MAX_VALUE);
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
    return content.kind !== "text_content" ? { ...content, caption } : content;
}

function getMessageContent(
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

export function createDirectMessage(
    messageIndex: number,
    content: string | undefined,
    replyingTo: ReplyContext | undefined,
    fileToAttach: MessageContent | undefined
): DirectMessage {
    // todo - this is awful but it is hopefully temporary
    if (
        replyingTo &&
        replyingTo.kind !== "direct_private_reply_context" &&
        replyingTo.kind !== "direct_standard_reply_context"
    ) {
        throw new Error("Trying to create a direct message with the wrong kind of reply context");
    }
    return {
        kind: "direct_message",
        content: getMessageContent(content, fileToAttach),
        sentByMe: true,
        repliesTo: replyingTo,
        messageId: newMessageId(),
        messageIndex,
    };
}

export function createGroupMessage(
    userId: string,
    messageIndex: number,
    content: string | undefined,
    replyingTo: ReplyContext | undefined,
    fileToAttach: MessageContent | undefined
): GroupMessage {
    // todo - this is awful but it is hopefully temporary
    if (replyingTo && replyingTo.kind !== "group_reply_context") {
        throw new Error("Trying to create a group message with the wrong kind of reply context");
    }
    return {
        kind: "group_message",
        content: getMessageContent(content, fileToAttach),
        sender: userId,
        repliesTo: replyingTo,
        messageId: newMessageId(),
        messageIndex,
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
    chat.unreadByMe = updatedChat.unreadByMe;
    chat.unreadByThem = updatedChat.unreadByThem;
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

function mergeUpdatedGroupChat(
    chat: GroupChatSummary,
    updatedChat: GroupChatSummaryUpdates
): GroupChatSummary {
    chat.name = updatedChat.name ?? chat.name;
    chat.description = updatedChat.description ?? chat.description;
    chat.unreadByMe = updatedChat.unreadByMe;
    chat.latestMessage = updatedChat.latestMessage ?? chat.latestMessage;
    chat.lastUpdated = updatedChat.lastUpdated;
    chat.latestEventIndex = updatedChat.latestEventIndex ?? chat.latestEventIndex;
    chat.participants = mergeThings((p) => p.userId, mergeParticipants, chat.participants, {
        added: [],
        updated: updatedChat.participantsAddedOrUpdated,
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
    if (a.event.kind === b.event.kind) {
        if (a.event.kind === "direct_message" && b.event.kind === "direct_message") {
            return (
                a.event.sentByMe === b.event.sentByMe &&
                b.timestamp - a.timestamp < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS
            );
        }
        if (a.event.kind === "group_message" && b.event.kind === "group_message") {
            return (
                a.event.sender === b.event.sender &&
                b.timestamp - a.timestamp < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS
            );
        }
    }
    return false;
}

function groupBySender(events: EventWrapper<ChatEvent>[]): EventWrapper<ChatEvent>[][] {
    return groupWhile(sameUser, events);
}

export function groupEvents(events: EventWrapper<ChatEvent>[]): EventWrapper<ChatEvent>[][][] {
    return groupWhile(sameDate, events).map(groupBySender);
}

export function earliestLoadedEventIndex(events: EventWrapper<ChatEvent>[]): number | undefined {
    return events[0]?.index;
}

export function latestLoadedEventIndex(events: EventWrapper<ChatEvent>[]): number | undefined {
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
