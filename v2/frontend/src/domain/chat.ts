import type { Principal } from "@dfinity/principal";

export type MessageContent = FileContent | TextContent | MediaContent | CyclesContent;

export interface CyclesContent {
    kind: "cycles_content";
    caption?: string;
    amount: bigint;
}

export interface MediaContent {
    kind: "media_content";
    height: number;
    mimeType: string;
    blobReference?: BlobReference;
    thumbnailData: string;
    caption?: string;
    width: number;
}

export interface TextContent {
    kind: "text_content";
    text: string;
}

export interface FileContent {
    kind: "file_content";
    name: string;
    mimeType: string;
    blobReference?: BlobReference;
    caption?: string;
}

export interface BlobReference {
    blobSize: number;
    blobId: string;
    canisterId: Principal;
    chunkSize: number;
}

export interface ReplyContext {
    content: MessageContent;
    userId: Principal;
    messageId: number;
}

export interface Message {
    id: number;
    content: MessageContent;
    sender: string;
    timestamp: bigint;
    repliesTo?: ReplyContext;
    clientMessageId: string;
}

export type GetChatsResponse = {
    chats: ChatSummary[];
};

export type ChatSummary = DirectChatSummary | GroupChatSummary;

type ChatSummaryCommon = {
    chatId: bigint;
    lastUpdated: bigint;
    displayDate: bigint;
    lastReadByUs: number;
    lastReadByThem: number;
    lastestMessageId: number;
    latestMessage?: Message;
};

export type DirectChatSummary = ChatSummaryCommon & {
    kind: "direct_chat";
    them: string;
};

export type GroupChatSummary = ChatSummaryCommon & {
    kind: "group_chat";
    subject: string;
};

// ================================================================
// below here is the chat detail stuff which we may or may not need
// ================================================================
type ChatCommon = {
    chatId: bigint;
    scrollTop?: number;
    scrollBottom?: number;
    draftMessage: string;
    replyContext?: ReplyContext;
};

type ConfirmedChatCommon = ChatCommon & {
    displayDate: Date;
    lastUpdated: Date;
    messages: Message[];
    messagesToDownload: number[];
    messagesDownloading: number[];
    minLocalMessageId?: number;
    maxLocalMessageId?: number;
    minimumUnconfirmedMessageIndex: number;

    // If the messageId is known, add to unreadMessageIds, otherwise add to unreadClientMessageIds, never add to both
    unreadMessageIds: number[];
    unreadClientMessageIds: string[];

    // If the messageId is known, add to markAsReadPending, otherwise add to markAsReadByClientIdPending, never add to both
    markAsReadPending: number[];
    markAsReadByClientIdPending: string[];

    messageToSelect?: number;
};

export type ConfirmedDirectChat = ConfirmedChatCommon & {
    kind: "confirmed_direct_chat";
    them: Principal;
    themTyping: boolean;
    unreadByThemMessageIds: number[];
    markAsReadByThemPendingSync: number[];
    markAsReadByThemByClientIdPendingSync: string[];
};

export type ConfirmedGroupChat = ConfirmedChatCommon & {
    kind: "confirmed_group_chat";
    subject: string;
    minMessageIdOnServer: number;
    participants: Principal[];
    participantsTyping: Principal[];
    unreadByAnyMessageIds: number[];
};

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

export function userIdsFromChatSummaries(chats: ChatSummary[]): string[] {
    return chats.reduce<string[]>((userIds, chat) => {
        // todo - for now we are only interested in direct chats
        if (chat.kind === "direct_chat") {
            userIds.push(chat.them.toString());
        }
        return userIds;
    }, []);
}

export function getUnreadMessages({ lastestMessageId, lastReadByUs }: ChatSummary): number {
    return lastestMessageId - lastReadByUs;
}

export function latestMessageText({ latestMessage }: ChatSummary): string {
    return latestMessage ? getContentAsText(latestMessage.content) : "";
}
