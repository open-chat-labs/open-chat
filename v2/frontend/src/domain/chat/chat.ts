import type { Principal } from "@dfinity/principal";
import type { PartialUserSummary } from "../user/user";

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

export type GroupChatReplyContext = {
    kind: "group_reply_context";
    content: MessageContent;
    userId: string;
    messageId: bigint;
    messageIndex: number;
};

export type DirectChatReplyContext = StandardReplyContext | PrivateReplyContext;

export type ReplyContext = GroupChatReplyContext | DirectChatReplyContext;

export interface PrivateReplyContext {
    kind: "direct_private_reply_context";
    chatId: string;
    messageIndex: number;
}

export interface StandardReplyContext {
    kind: "direct_standard_reply_context";
    content: MessageContent;
    sentByMe: boolean;
    messageIndex: number;
}

export interface Message {
    messageId: bigint;
    messageIndex: number;
    content: MessageContent;
    sender: string;
    timestamp: bigint;
    repliesTo?: ReplyContext;
}

export type MessagesResponse = "chat_not_found" | GetMessagesSuccess;

export type GetMessagesSuccess = {
    messages: Message[];
};

export type UpdateArgs = {
    groups: { lastUpdated: bigint; chatId: string }[];
    lastUpdated?: bigint;
};

export type UpdatesResponse = {
    chatsUpdated: UpdatedChatSummary[];
    chatsAdded: ChatSummary[];
    chatsRemoved: Set<string>;
    timestamp: bigint;
};

export type UpdatedChatSummary = UpdatedDirectChatSummary | UpdatedGroupChatSummary;

type UpdatedChatSummaryCommon = {
    chatId: string;
    lastUpdated: bigint;
    latestReadByMe?: number;
    latestMessage?: Message;
};

export type UpdatedDirectChatSummary = UpdatedChatSummaryCommon & {
    kind: "direct_chat";
    latestReadByThem?: number;
};

export type UpdatedGroupChatSummary = UpdatedChatSummaryCommon & {
    kind: "group_chat";
    participantsAdded: Participant[];
    participantsRemoved: Set<string>;
    participantsUpdated: Participant[];
    name?: string;
    description?: string;
};

export type ParticipantRole = "admin" | "standard";

export type Participant = {
    role: ParticipantRole;
    userId: string;
};

export type FullParticipant = Participant & PartialUserSummary;

export type ChatSummary = DirectChatSummary | GroupChatSummary;

type ChatSummaryCommon = {
    chatId: string; // this represents a Principal
    lastUpdated: bigint;
    latestReadByMe: number;
    latestMessage?: Message;
};

export type DirectChatSummary = ChatSummaryCommon & {
    kind: "direct_chat";
    them: string;
    latestReadByThem: number;
};

export type GroupChatSummary = ChatSummaryCommon & {
    kind: "group_chat";
    name: string;
    description: string;
    participants: Participant[];
    public: boolean;
    joined: bigint;
    minVisibleMessageIndex: number;
};
