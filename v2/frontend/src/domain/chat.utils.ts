import type { ChatSummary, MediaContent, MessageContent } from "./chat";

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
            for (const p in chat.participants) {
                userIds.add(p);
            }
        }
        return userIds;
    }, new Set<string>());
}

export function getUnreadMessages({ lastestMessageId, lastReadByUs }: ChatSummary): number {
    return lastestMessageId - lastReadByUs;
}

export function latestMessageText({ latestMessage }: ChatSummary): string {
    return latestMessage ? getContentAsText(latestMessage.content) : "";
}

export function compareByDate(a: ChatSummary, b: ChatSummary): number {
    return Number(b.displayDate - a.displayDate);
}

export function mergeChats(
    existingChats: ChatSummary[],
    incomingChats: ChatSummary[]
): ChatSummary[] {
    const dict = [...existingChats, ...incomingChats].reduce<Record<string, ChatSummary>>(
        (chats, chat) => {
            chats[chat.chatId.toString()] = chat;
            return chats;
        },
        {}
    );
    return Object.values(dict).sort(compareByDate);
}
