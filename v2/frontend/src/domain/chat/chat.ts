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
    blobData?: Promise<Uint8Array | undefined>;
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

export type ReplyContext = GroupChatReplyContext | DirectChatReplyContext;

export type GroupChatReplyContext = {
    kind: "group_reply_context";
    content: MessageContent;
    userId: string;
    eventIndex: number;
};

export type DirectChatReplyContext = StandardReplyContext | PrivateReplyContext;

export type EnhancedReplyContext<T extends ReplyContext> = T & {
    sender?: PartialUserSummary;
    content: MessageContent;
};

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

export type MessageCommon = {
    messageId: bigint;
    messageIndex: number;
    content: MessageContent;
};

export type DirectMessage = MessageCommon & {
    kind: "direct_message";
    sentByMe: boolean;
    repliesTo?: DirectChatReplyContext;
};

export type GroupMessage = MessageCommon & {
    kind: "group_message";
    sender: string;
    repliesTo?: GroupChatReplyContext;
};

export type EventsResponse<T extends ChatEvent> = "chat_not_found" | EventsSuccessResult<T>;

export type DirectChatEvent = DirectMessage | DirectChatCreated;

export type GroupChatEvent =
    | GroupMessage
    | GroupChatCreated
    | ParticipantsAdded
    | ParticipantsPromotedToAdmin
    | ParticipantsDismissedAsAdmin;

export type ChatEvent = GroupChatEvent | DirectChatEvent;

export type DirectChatCreated = {
    kind: "direct_chat_created";
};

export type ParticipantsAdded = {
    kind: "participants_added";
    userIds: string[];
    addedBy: string;
};

export type ParticipantsDismissedAsAdmin = {
    kind: "participants_dismissed_as_admin";
    userIds: string[];
    dismissedBy: string;
};

export type ParticipantsPromotedToAdmin = {
    kind: "participants_promoted_to_admin";
    userIds: string[];
    promotedBy: string;
};

export type GroupChatCreated = {
    kind: "group_chat_created";
    name: string;
    description: string;
    created_by: string;
};

export type EventWrapper<T extends ChatEvent> = {
    event: T;
    timestamp: bigint;
    index: number;
};

export type EventsSuccessResult<T extends ChatEvent> = {
    events: EventWrapper<T>[];
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

export type MergedUpdatesResponse = {
    chatSummaries: ChatSummary[];
    timestamp: bigint;
};

export type UpdatesResponse = {
    blockedUsers: string[];
    chatsUpdated: ChatSummaryUpdates[];
    chatsAdded: ChatSummary[];
    chatsRemoved: Set<string>;
    timestamp: bigint;
};

export type ChatSummaryUpdates = DirectChatSummaryUpdates | GroupChatSummaryUpdates;

type ChatSummaryUpdatesCommon = {
    chatId: string;
    latestReadByMe?: number;
    latestEventIndex?: number;
};

export type DirectChatSummaryUpdates = ChatSummaryUpdatesCommon & {
    kind: "direct_chat";
    latestReadByThem?: number;
    latestMessage?: EventWrapper<DirectMessage>;
};

export type GroupChatSummaryUpdates = ChatSummaryUpdatesCommon & {
    kind: "group_chat";
    participantsAddedOrUpdated: Participant[];
    participantsRemoved: Set<string>;
    lastUpdated: bigint;
    name?: string;
    description?: string;
    latestMessage?: EventWrapper<GroupMessage>;
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
    latestEventIndex: number;
};

export type DirectChatSummary = ChatSummaryCommon & {
    kind: "direct_chat";
    them: string;
    latestReadByThem: number;
    dateCreated: bigint;
    latestMessage?: EventWrapper<DirectMessage>;
};

export type GroupChatSummary = ChatSummaryCommon & {
    kind: "group_chat";
    name: string;
    description: string;
    participants: Participant[];
    public: boolean;
    joined: bigint;
    minVisibleEventIndex: number;
    lastUpdated: bigint;
    latestMessage?: EventWrapper<GroupMessage>;
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
    | CreateGroupInternalError
    | CreateGroupInvalidName
    | CreateGroupNameTooLong
    | CreateGroupDescriptionTooLong
    | CreateGroupPublicGroupAlreadyExists
    | CreateGroupThrottled;

export type CreateGroupSuccess = {
    kind: "success";
    canisterId: string;
};

export type CreateGroupInternalError = {
    kind: "internal_error";
};

export type CreateGroupInvalidName = {
    kind: "invalid_name";
};

export type CreateGroupNameTooLong = {
    kind: "name_too_long";
};

export type CreateGroupDescriptionTooLong = {
    kind: "description_too_long";
};

export type CreateGroupPublicGroupAlreadyExists = {
    kind: "public_group_already_exists";
};

export type CreateGroupThrottled = {
    kind: "throttled";
};

export type AddParticipantsResponse =
    | AddParticipantsSuccess
    | AddParticipantsNotAuthorised
    | AddParticipantsPartialSuccess
    | AddParticipantsFailed
    | AddParticipantsNotInGroup;

export type AddParticipantsSuccess = {
    kind: "add_participants_success";
};

export type AddParticipantsNotInGroup = {
    kind: "add_participants_not_in_group";
};

export type AddParticipantsNotAuthorised = {
    kind: "add_participants_not_authorised";
};

export type AddParticipantsPartialSuccess = {
    kind: "add_participants_partial_success";
    usersAdded: string[];
    usersAlreadyInGroup: string[];
    usersBlockedFromGroup: string[];
    usersWhoBlockedRequest: string[];
    errors: string[];
};

export type AddParticipantsFailed = {
    kind: "add_participants_failed";
    usersAlreadyInGroup: string[];
    usersBlockedFromGroup: string[];
    usersWhoBlockedRequest: string[];
    errors: string[];
};

export type SendMessageResponse =
    | SendMessageSuccess
    | SendMessageRecipientBlocked
    | SendMessageInvalidRequest
    | SendMessageTooLong
    | SendMessageBalanceExceeded
    | SendMessageRecipientNotFound
    | SendMessageNotInGroup;

export type SendMessageSuccess = {
    kind: "send_message_success";
    timestamp: bigint;
    messageIndex: number;
    eventIndex: number;
};

export type SendMessageRecipientBlocked = {
    kind: "send_message_recipient_blocked";
};

export type SendMessageInvalidRequest = {
    kind: "send_message_invalid_request";
};

export type SendMessageTooLong = {
    kind: "send_message_too_long";
};

export type SendMessageRecipientNotFound = {
    kind: "send_message_recipient_not_found";
};

export type SendMessageBalanceExceeded = {
    kind: "send_message_balance_exceeded";
};

export type SendMessageNotInGroup = {
    kind: "send_message_not_in_group";
};

export type PutChunkResponse = "put_chunk_success" | "put_chunk_full" | "put_chunk_too_big";

export type ChangeAdminResponse =
    | "user_not_in_group"
    | "caller_not_in_group"
    | "not_authorised"
    | "success";
