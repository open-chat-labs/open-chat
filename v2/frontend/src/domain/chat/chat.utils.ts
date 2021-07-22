import type { UserLookup } from "../user/user";
import { compareUsersOnlineFirst, nullUser, userIsOnline } from "../user/user.utils";
import type {
    ChatSummary,
    GroupChatSummary,
    MediaContent,
    Message,
    MessageContent,
    UpdatedChatSummary,
    UpdatesResponse,
} from "./chat";

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
    return latestMessage?.messageIndex ?? 0 - latestReadByMe;
}

export function latestMessageText({ latestMessage }: ChatSummary): string {
    return latestMessage ? getContentAsText(latestMessage.content) : "";
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

export function textMessage(userId: string, content: string): Message {
    return {
        messageId: BigInt(0),
        messageIndex: 0,
        content: {
            kind: "text_content",
            text: content,
        },
        sender: userId,
        timestamp: BigInt(+new Date()),
        repliesTo: undefined,
    };
}

export function getDisplayDate(chat: ChatSummary): bigint {
    if (chat.kind === "group_chat") {
        return chat.latestMessage?.timestamp ?? chat.joined;
    }
    return chat.latestMessage?.timestamp ?? BigInt(+new Date());
}

export function toLookup(chats: ChatSummary[]): Record<string, ChatSummary> {
    return chats.reduce<Record<string, ChatSummary>>((agg, chat) => {
        agg[chat.chatId] = chat;
        return agg;
    }, {});
}

export function mergeUpdated(chat: ChatSummary, updatedChat: UpdatedChatSummary): ChatSummary {
    if (chat.chatId !== updatedChat.chatId) {
        throw new Error("Cannot update chat from a chat with a different chat id");
    }

    if (chat.kind === "group_chat" && updatedChat.kind === "group_chat") {
        return {
            ...chat,
            ...updatedChat,
        };
    }

    if (chat.kind === "direct_chat" && updatedChat.kind === "direct_chat") {
        return {
            ...chat,
            ...updatedChat,
        };
    }

    throw new Error("Cannot update chat with a chat of a different kind");
}

export function mergeChatUpdates(
    chatSummaries: ChatSummary[],
    updateResponse: UpdatesResponse
): ChatSummary[] {
    const chatsDict = toLookup(
        chatSummaries.filter((c) => !updateResponse.chatsRemoved.has(c.chatId))
    );
    const updated = updateResponse.chatsUpdated.reduce((dict, updated) => {
        if (dict[updated.chatId]) {
            dict[updated.chatId] = mergeUpdated(dict[updated.chatId], updated);
        }
        return dict;
    }, chatsDict);
    return [...Object.values(updated), ...updateResponse.chatsAdded];
}
