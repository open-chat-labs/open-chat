import type { PartialUserSummary, UserSummary } from "../user/user";

export type MessageContent = FileContent | TextContent | MediaContent | CyclesContent;

export interface CyclesContent {
    kind: "cycles_content";
    caption?: string;
    amount: bigint;
}

export interface DataContent {
    caption?: string;
    blobReference?: BlobReference;
    blobData: Promise<Uint8Array | undefined>;
    mimeType: string;
}

export interface MediaContent extends DataContent {
    kind: "media_content";
    height: number;
    width: number;
    thumbnailData: string;
}

export interface TextContent {
    kind: "text_content";
    text: string;
}

export interface FileContent extends DataContent {
    kind: "file_content";
    name: string;
}

export interface BlobReference {
    blobSize: number;
    blobId: bigint;
    canisterId: string;
    chunkSize: number;
}

export type GroupChatReplyContext = {
    kind: "group_reply_context";
    content: MessageContent;
    userId: string;
    eventIndex: number;
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
    eventIndex: number;
}

export interface StandardReplyContext {
    kind: "direct_standard_reply_context";
    content: MessageContent;
    sentByMe: boolean;
    eventIndex: number;
}

export interface Message {
    messageId: bigint;
    messageIndex: number;
    kind: "message";
    content: MessageContent;
    sender: string;
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

export type GroupChatUpdatesSince = {
    updatesSince: bigint;
    chatId: string;
};

export type UpdatesSince = {
    groupChats: { lastUpdated: bigint; chatId: string }[];
    timestamp: bigint;
};

export type UpdateArgs = {
    updatesSince?: UpdatesSince;
};

export type UpdatesResponse = {
    chatsUpdated: ChatSummaryUpdates[];
    chatsAdded: ChatSummary[];
    chatsRemoved: Set<string>;
    timestamp: bigint;
};

export type ChatSummaryUpdates = DirectChatSummaryUpdates | GroupChatSummaryUpdates;

type ChatSummaryUpdatesCommon = {
    chatId: string;
    latestReadByMe?: number;
    latestMessage?: EventWrapper;
    latestEventIndex?: number;
};

export type DirectChatSummaryUpdates = ChatSummaryUpdatesCommon & {
    kind: "direct_chat";
    latestReadByThem?: number;
};

export type GroupChatSummaryUpdates = ChatSummaryUpdatesCommon & {
    kind: "group_chat";
    participantsAddedOrUpdated: Participant[];
    participantsRemoved: Set<string>;
    lastUpdated: bigint;
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
    lastUpdated: bigint;
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
