import type { BlobReference, DataContent } from "../data/data";
import type { PartialUserSummary, UserSummary } from "../user/user";

export type MessageContent =
    | FileContent
    | TextContent
    | ImageContent
    | VideoContent
    | AudioContent
    | CyclesContent;

export type IndexRange = [number, number];

export interface CyclesContent {
    kind: "cycles_content";
    caption?: string;
    amount: bigint;
}

export interface ImageContent extends DataContent {
    kind: "image_content";
    height: number;
    width: number;
    thumbnailData: string;
    caption?: string;
    mimeType: string;
}

export interface VideoContent {
    kind: "video_content";
    height: number;
    width: number;
    thumbnailData: string;
    caption?: string;
    mimeType: string;
    imageData: DataContent;
    videoData: DataContent;
}

export interface AudioContent extends DataContent {
    kind: "audio_content";
    caption?: string;
    mimeType: string;
}

export interface TextContent {
    kind: "text_content";
    text: string;
}

export interface FileContent extends DataContent {
    kind: "file_content";
    name: string;
    caption?: string;
    mimeType: string;
    fileSize: number;
}

export type ReplyContext = {
    content?: MessageContent;
    userId: string;
    messageId: bigint;
    eventIndex: number;
    chatId: string;
};

export type EnhancedReplyContext<T extends ReplyContext> = T & {
    sender?: PartialUserSummary;
    content: MessageContent;
};

export type Message = {
    kind: "message";
    messageId: bigint;
    messageIndex: number;
    sender: string;
    content: MessageContent;
    repliesTo?: ReplyContext;
    reactions: Reaction[];
};

export type Reaction = {
    reaction: string;
    userIds: Set<string>;
};

export type EventsResponse<T extends ChatEvent> = "chat_not_found" | EventsSuccessResult<T>;

export type DirectChatEvent = Message | ReactionAdded | ReactionRemoved | DirectChatCreated;

export type GroupChatEvent =
    | Message
    | GroupChatCreated
    | ParticipantsAdded
    | ParticipantsPromotedToAdmin
    | ParticipantsRemoved
    | ParticipantLeft
    | GroupNameChanged
    | AvatarChanged
    | ReactionAdded
    | ReactionRemoved
    | GroupDescChanged
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

export type ParticipantLeft = {
    kind: "participant_left";
    userId: string;
};

export type GroupNameChanged = {
    kind: "name_changed";
    changedBy: string;
};

export type GroupDescChanged = {
    kind: "desc_changed";
    changedBy: string;
};

export type AvatarChanged = {
    kind: "avatar_changed";
    changedBy: string;
};

export type ReactionAdded = {
    kind: "reaction_added";
    message: StaleMessage;
};

export type ReactionRemoved = {
    kind: "reaction_removed";
    message: StaleMessage;
};

export type StaleMessage = {
    eventIndex: number;
    messageId: bigint;
};

export type ParticipantsRemoved = {
    kind: "participants_removed";
    userIds: string[];
    removedBy: string;
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
    blockedUsers: Set<string>;
    timestamp: bigint;
};

export type UpdatesResponse = {
    blockedUsers: Set<string>;
    chatsUpdated: ChatSummaryUpdates[];
    chatsAdded: ChatSummary[];
    chatsRemoved: Set<string>;
    timestamp: bigint;
};

export type ChatSummaryUpdates = DirectChatSummaryUpdates | GroupChatSummaryUpdates;

type ChatSummaryUpdatesCommon = {
    chatId: string;
    readByMe?: MessageIndexRange[];
    latestEventIndex?: number;
};

export type DirectChatSummaryUpdates = ChatSummaryUpdatesCommon & {
    kind: "direct_chat";
    latestMessage?: EventWrapper<Message>;
    readByThem?: MessageIndexRange[];
};

export type GroupChatSummaryUpdates = ChatSummaryUpdatesCommon & {
    kind: "group_chat";
    participantsAddedOrUpdated: Participant[];
    participantsRemoved: Set<string>;
    lastUpdated: bigint;
    name?: string;
    description?: string;
    latestMessage?: EventWrapper<Message>;
    avatarBlobReference?: BlobReference;
};

export type ParticipantRole = "admin" | "standard";

export type Participant = {
    role: ParticipantRole;
    userId: string;
};

export type FullParticipant = Participant & PartialUserSummary;

export type ChatSummary = DirectChatSummary | GroupChatSummary;

export type MessageIndexRange = {
    from: number;
    to: number;
};

type ChatSummaryCommon = {
    chatId: string; // this represents a Principal
    readByMe: MessageIndexRange[];
    latestEventIndex: number;
};

export type DirectChatSummary = ChatSummaryCommon & {
    kind: "direct_chat";
    them: string;
    readByThem: MessageIndexRange[];
    dateCreated: bigint;
    latestMessage?: EventWrapper<Message>;
};

export type GroupChatSummary = DataContent &
    ChatSummaryCommon & {
        kind: "group_chat";
        name: string;
        description: string;
        participants: Participant[];
        public: boolean;
        joined: bigint;
        minVisibleEventIndex: number;
        minVisibleMessageIndex: number;
        lastUpdated: bigint;
        latestMessage?: EventWrapper<Message>;
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
    avatar?: DataContent;
};

// todo - there are all sorts of error conditions here that we need to deal with but - later
export type CreateGroupResponse =
    | CreateGroupSuccess
    | CreateGroupInternalError
    | CreateGroupInvalidName
    | CreateGroupNameTooLong
    | CreateGroupDescriptionTooLong
    | GroupNameTaken
    | AvatarTooBig
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

export type GroupNameTaken = {
    kind: "group_name_taken";
};

export type AvatarTooBig = {
    kind: "avatar_too_big";
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

export type PutChunkResponse =
    | "put_chunk_success"
    | "put_chunk_full"
    | "put_chunk_too_big"
    | "chunk_already_exists"
    | "caller_not_in_group"
    | "blob_too_big"
    | "blob_already_exists";

export type SetAvatarResponse = "avatar_too_big" | "success" | "internal_error";

export type ChangeAdminResponse =
    | "user_not_in_group"
    | "caller_not_in_group"
    | "not_authorised"
    | "success";

export type RemoveParticipantResponse =
    | "user_not_in_group"
    | "caller_not_in_group"
    | "not_authorised"
    | "success"
    | "cannot_remove_self"
    | "internal_error";

export type BlockUserResponse = "success";

export type UnblockUserResponse = "success";

export type LeaveGroupResponse = "success" | "group_not_found" | "internal_error" | "not_in_group";

export type MarkReadResponse = "success" | "success_no_change" | "chat_not_found" | "not_in_group";

export type UpdateGroupResponse =
    | "success"
    | "not_authorised"
    | "name_too_long"
    | "desc_too_long"
    | "unchanged"
    | "name_taken"
    | "internal_error";

export type ToggleReactionResponse =
    | "added"
    | "removed"
    | "invalid"
    | "message_not_found"
    | "chat_not_found";
