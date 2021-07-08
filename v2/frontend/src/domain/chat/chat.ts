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
    timestamp: bigint;
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
    participants: string[];
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
