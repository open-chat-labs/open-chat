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
    sender: Principal;
    timestamp: bigint;
    repliesTo?: ReplyContext;
    clientMessageId: string;
}

export interface ChatSummary {
    them: Principal;
    lastUpdated: bigint;
    displayDate: bigint;
    unreadByThemMessageIdRanges: number[][];
    latestMessages: Message[];
    unreadByMeMessageIdRanges: number[][];
}
