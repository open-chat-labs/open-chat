import type { Principal } from "@dfinity/principal";
import type { PartialUserSummary, UserSummary } from "../user/user";

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

export type EnhancedReplyContext = ReplyContext & {
    sender?: PartialUserSummary;
    content: MessageContent;
};

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

// todo - removing some stuff from this interface until we can see clearly that we need it
export interface Message {
    // messageId: bigint;
    // messageIndex: number;
    kind: "message";
    content: MessageContent;
    sender: string;
    // timestamp: bigint;
    repliesTo?: ReplyContext;
}

export type ChatEvent = DirectChatEvent | GroupChatEvent | Message;

export type EventsResponse = "chat_not_found" | "not_authorised" | EventsSuccessResult;

export type DirectChatEvent = Message;

export type GroupChatEvent = Message | GroupChatCreated;

export type GroupChatCreated = {
    kind: "group_chat_created";
    name: string;
    description?: string;
    created_by: string;
};

export type EventWrapper = {
    event: ChatEvent;
    timestamp: bigint;
    index: number;
};

export type EventsSuccessResult = {
    events: EventWrapper[];
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
    latestMessage?: EventWrapper;
    latestEventIndex: number;
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
    latestReadByMe: number;
    latestMessage?: EventWrapper;
    latestEventIndex: number;
    lastUpdated: bigint;
};

export type DirectChatSummary = ChatSummaryCommon & {
    kind: "direct_chat";
    them: string;
    latestReadByThem: number;
    dateCreated: bigint;
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

export type CandidateParticipant = {
    role: ParticipantRole;
    user: UserSummary;
};

export type CandidateGroupChat = {
    name: string;
    description: string;
    historyVisible: boolean;
    isPublic: boolean;
    participants: CandidateParticipant[];
    avatar?: string;
};

// todo - there are all sorts of error conditions here that we need to deal with but - later
export type CreateGroupResponse =
    | CreateGroupSuccess
    | CreateGroupUnknownError
    | CreateGroupInvalidName
    | CreateGroupNameTooLong
    | CreateGroupPublicGroupAlreadyExists
    | CreateGroupLimitExceeded;

export type CreateGroupSuccess = {
    kind: "success";
    canisterId: string;
};

export type CreateGroupUnknownError = {
    kind: "unknown_error";
};

export type CreateGroupInvalidName = {
    kind: "invalid_name";
};

export type CreateGroupNameTooLong = {
    kind: "name_too_long";
};

export type CreateGroupPublicGroupAlreadyExists = {
    kind: "public_group_already_exists";
};

export type CreateGroupLimitExceeded = {
    kind: "group_limit_exceeded";
};
