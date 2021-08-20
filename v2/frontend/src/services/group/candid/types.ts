import type { Principal } from '@dfinity/principal';
export interface AddParticipantsArgs { 'user_ids' : Array<UserId> }
export interface AddParticipantsFailedResult {
  'errors' : Array<UserId>,
  'users_blocked_from_group' : Array<UserId>,
  'users_who_blocked_request' : Array<UserId>,
  'users_already_in_group' : Array<UserId>,
}
export interface AddParticipantsPartialSuccessResult {
  'errors' : Array<UserId>,
  'users_blocked_from_group' : Array<UserId>,
  'users_added' : Array<UserId>,
  'users_who_blocked_request' : Array<UserId>,
  'users_already_in_group' : Array<UserId>,
}
export type AddParticipantsResponse = {
    'Failed' : AddParticipantsFailedResult
  } |
  { 'PartialSuccess' : AddParticipantsPartialSuccessResult } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'NotInGroup' : null };
export interface BlobReference {
  'blob_size' : number,
  'blob_id' : bigint,
  'canister_id' : CanisterId,
  'chunk_size' : number,
}
export type BlockUserArgs = {};
export type BlockUserResponse = { 'Success' : null };
export type CanisterCreationStatus = { 'InProgress' : null } |
  { 'Created' : null } |
  { 'Pending' : null };
export type CanisterId = Principal;
export type CanisterUpgradeStatus = { 'Required' : null } |
  { 'NotRequired' : null } |
  { 'InProgress' : null };
export interface CanisterWasm { 'version' : Version, 'module' : Array<number> }
export type ChatId = { 'Group' : GroupChatId } |
  { 'Direct' : DirectChatId };
export type ChatSummary = { 'Group' : GroupChatSummary } |
  { 'Direct' : DirectChatSummary };
export type ChatSummaryUpdates = { 'Group' : GroupChatSummaryUpdates } |
  { 'Direct' : DirectChatSummaryUpdates };
export interface ConfirmationCodeSms {
  'confirmation_code' : string,
  'phone_number' : string,
}
export interface CyclesContent { 'caption' : [] | [string], 'amount' : bigint }
export type DirectChatEvent = { 'Message' : DirectMessage };
export interface DirectChatEventWrapper {
  'event' : DirectChatEvent,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export type DirectChatId = Array<number>;
export interface DirectChatSummary {
  'date_created' : TimestampMillis,
  'them' : UserId,
  'latest_read_by_me' : MessageIndex,
  'latest_event_index' : EventIndex,
  'chat_id' : DirectChatId,
  'latest_read_by_them' : MessageIndex,
  'latest_message' : DirectMessageEventWrapper,
}
export interface DirectChatSummaryUpdates {
  'latest_read_by_me' : [] | [MessageIndex],
  'latest_event_index' : [] | [EventIndex],
  'chat_id' : DirectChatId,
  'latest_read_by_them' : [] | [MessageIndex],
  'latest_message' : [] | [DirectMessageEventWrapper],
}
export interface DirectMessage {
  'content' : MessageContent,
  'sent_by_me' : boolean,
  'message_id' : MessageId,
  'replies_to' : [] | [DirectReplyContext],
  'message_index' : MessageIndex,
}
export interface DirectMessageEventWrapper {
  'event' : DirectMessage,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export interface DirectMessageNotification {
  'recipient' : UserId,
  'sender' : UserId,
  'message' : DirectMessage,
  'sender_name' : string,
}
export type DirectReplyContext = { 'Private' : PrivateReplyContext } |
  { 'Standard' : StandardReplyContext };
export type EventIndex = number;
export interface EventsArgs {
  'to_index' : EventIndex,
  'from_index' : EventIndex,
}
export interface EventsByIndexArgs { 'events' : Array<GroupChatEventWrapper> }
export type EventsByIndexResponse = { 'ChatNotFound' : null } |
  { 'Success' : EventsSuccessResult };
export type EventsResponse = { 'ChatNotFound' : null } |
  { 'Success' : EventsSuccessResult };
export interface EventsSuccessResult {
  'events' : Array<GroupChatEventWrapper>,
  'latest_event_index' : EventIndex,
}
export interface FileContent {
  'name' : string,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
}
export interface GetChunkArgs { 'blob_id' : bigint, 'index' : number }
export type GetChunkResponse = { 'NotFound' : null } |
  { 'Success' : { 'bytes' : Array<number> } };
export interface GroupChatCreated {
  'name' : string,
  'description' : [] | [string],
  'created_by' : UserId,
}
export type GroupChatEvent = { 'ParticipantJoined' : ParticipantJoined } |
  { 'GroupDescriptionChanged' : GroupDescriptionChanged } |
  { 'GroupChatCreated' : GroupChatCreated } |
  { 'ParticipantsPromotedToAdmin' : ParticipantsPromotedToAdmin } |
  { 'ParticipantsRemoved' : ParticipantsRemoved } |
  { 'Message' : GroupMessage } |
  { 'ParticipantsDismissedAsAdmin' : ParticipantsPromotedToAdmin } |
  { 'ParticipantLeft' : ParticipantLeft } |
  { 'GroupNameChanged' : GroupNameChanged } |
  { 'ParticipantsAdded' : ParticipantsAdded };
export interface GroupChatEventWrapper {
  'event' : GroupChatEvent,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export type GroupChatId = Array<number>;
export interface GroupChatSummary {
  'is_public' : boolean,
  'participants' : Array<Participant>,
  'name' : string,
  'description' : string,
  'latest_read_by_me' : MessageIndex,
  'joined' : TimestampMillis,
  'latest_event_index' : EventIndex,
  'min_visible_message_index' : MessageIndex,
  'chat_id' : GroupChatId,
  'latest_message' : [] | [GroupMessageEventWrapper],
}
export interface GroupChatSummaryUpdates {
  'participants_added_or_updated' : Array<Participant>,
  'participants_removed' : Array<UserId>,
  'name' : [] | [string],
  'description' : [] | [string],
  'last_updated' : TimestampMillis,
  'latest_read_by_me' : [] | [MessageIndex],
  'latest_event_index' : [] | [EventIndex],
  'chat_id' : GroupChatId,
  'latest_message' : [] | [GroupMessageEventWrapper],
}
export interface GroupDescriptionChanged {
  'new_description' : [] | [string],
  'previous_description' : [] | [string],
  'changed_by' : UserId,
}
export interface GroupMessage {
  'content' : MessageContent,
  'sender' : UserId,
  'message_id' : MessageId,
  'replies_to' : [] | [GroupReplyContext],
  'message_index' : MessageIndex,
}
export interface GroupMessageEventWrapper {
  'event' : GroupMessage,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export interface GroupMessageNotification {
  'sender' : UserId,
  'recipients' : Array<UserId>,
  'message' : GroupMessage,
  'sender_name' : string,
  'chat_id' : GroupChatId,
  'group_name' : string,
}
export interface GroupNameChanged {
  'changed_by' : UserId,
  'new_name' : string,
  'previous_name' : string,
}
export interface GroupReplyContext {
  'content' : MessageContent,
  'user_id' : UserId,
  'event_index' : EventIndex,
}
export interface IndexedNotification {
  'value' : NotificationEnvelope,
  'index' : bigint,
}
export interface JoinGroupArgs { 'principal' : Principal }
export type JoinGroupResponse = { 'Blocked' : null } |
  { 'GroupNotPublic' : null } |
  { 'AlreadyInGroup' : null } |
  { 'Success' : {} };
export type LeaveGroupArgs = {};
export type LeaveGroupResponse = { 'Success' : null };
export type MakeAdminArgs = {};
export type MakeAdminResponse = { 'Success' : null };
export interface MarkReadArgs { 'up_to_message_index' : MessageIndex }
export type MarkReadResponse = { 'SuccessNoChange' : null } |
  { 'Success' : null } |
  { 'NotInGroup' : null };
export interface MediaContent {
  'height' : number,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'thumbnail_data' : string,
  'caption' : [] | [string],
  'width' : number,
}
export type MessageContent = { 'File' : FileContent } |
  { 'text' : TextContent } |
  { 'Media' : MediaContent } |
  { 'Cycles' : CyclesContent };
export type MessageId = bigint;
export type MessageIndex = number;
export type MetricsArgs = {};
export interface MetricsResponse {
  'blob_bytes_used' : bigint,
  'cycles_balance' : bigint,
  'image_message_count' : bigint,
  'caller_id' : Principal,
  'chunk_count' : number,
  'bytes_used' : bigint,
  'file_message_count' : bigint,
  'timestamp' : TimestampMillis,
  'text_message_count' : bigint,
  'wasm_memory_used' : bigint,
  'video_message_count' : bigint,
}
export type Notification = {
    'DirectMessageNotification' : DirectMessageNotification
  } |
  { 'GroupMessageNotification' : GroupMessageNotification } |
  { 'V1GroupMessageNotification' : V1GroupMessageNotification } |
  { 'V1DirectMessageNotification' : V1DirectMessageNotification };
export interface NotificationEnvelope {
  'notification' : Notification,
  'recipients' : Array<UserId>,
}
export interface PartialUserSummary {
  'username' : [] | [string],
  'user_id' : UserId,
  'seconds_since_last_online' : number,
}
export interface Participant {
  'role' : Role,
  'user_id' : UserId,
  'date_added' : TimestampMillis,
}
export interface ParticipantJoined { 'user_id' : UserId }
export interface ParticipantLeft { 'user_id' : UserId }
export interface ParticipantsAdded {
  'user_ids' : Array<UserId>,
  'added_by' : UserId,
}
export interface ParticipantsDismissedAsAdmin {
  'user_ids' : Array<UserId>,
  'dismissed_by' : UserId,
}
export interface ParticipantsPromotedToAdmin {
  'user_ids' : Array<UserId>,
  'promoted_by' : UserId,
}
export interface ParticipantsRemoved {
  'user_ids' : Array<UserId>,
  'removed_by' : UserId,
}
export interface PrivateReplyContext {
  'chat_id' : GroupChatId,
  'event_index' : EventIndex,
}
export interface PutChunkArgs {
  'blob_id' : bigint,
  'bytes' : Array<number>,
  'index' : number,
}
export type PutChunkResponse = { 'Full' : null } |
  { 'Success' : null };
export type RemoveAdminArgs = {};
export type RemoveAdminResponse = { 'Success' : null };
export type RemoveParticipantsArgs = {};
export type RemoveParticipantsResponse = { 'Success' : null };
export interface ReplyContextArgs { 'message_id' : MessageId }
export type Role = { 'Participant' : null } |
  { 'Admin' : null };
export interface SearchMessagesArgs {
  'max_results' : number,
  'search_term' : string,
}
export type SearchMessagesResponse = {
    'Success' : {
      'matches' : Array<{ 'score' : number, 'message' : GroupMessage }>,
    }
  } |
  { 'Failure' : null };
export interface SendMessageArgs {
  'content' : MessageContent,
  'message_id' : MessageId,
  'replies_to' : [] | [ReplyContextArgs],
}
export type SendMessageResponse = { 'BalanceExceeded' : null } |
  {
    'Success' : {
      'timestamp' : TimestampMillis,
      'chat_summary' : GroupChatSummary,
      'message_index' : MessageIndex,
    }
  } |
  { 'RecipientBlocked' : null } |
  { 'InvalidRequest' : null } |
  { 'SenderBlocked' : null } |
  { 'MessageTooLong' : number } |
  { 'RecipientNotFound' : null };
export interface SetAvatarArgs { 'mime_type' : string, 'bytes' : Array<number> }
export type SetAvatarResponse = { 'InvalidMimeType' : number } |
  { 'FileTooBig' : number } |
  { 'Success' : null };
export interface StandardReplyContext {
  'content' : MessageContent,
  'sent_by_me' : boolean,
  'event_index' : EventIndex,
}
export interface Subscription {
  'value' : SubscriptionInfo,
  'last_active' : TimestampMillis,
}
export interface SubscriptionInfo {
  'endpoint' : string,
  'keys' : SubscriptionKeys,
}
export interface SubscriptionKeys { 'auth' : string, 'p256dh' : string }
export type SummaryArgs = {};
export type SummaryResponse = { 'Success' : GroupChatSummary } |
  { 'SuccessNoUpdates' : null } |
  { 'NotInGroup' : null };
export interface SummaryUpdatesArgs { 'updates_since' : TimestampMillis }
export type SummaryUpdatesResponse = { 'Success' : SummaryUpdatesSuccess } |
  { 'SuccessNoUpdates' : null } |
  { 'NotInGroup' : null };
export interface SummaryUpdatesSuccess { 'updates' : GroupChatSummaryUpdates }
export interface TextContent { 'text' : string }
export type TimestampMillis = bigint;
export type UnblockUserArgs = {};
export type UnblockUserResponse = { 'Success' : null };
export type UserId = CanisterId;
export interface UserSummary {
  'username' : string,
  'user_id' : UserId,
  'seconds_since_last_online' : number,
}
export type V1ChatId = bigint;
export interface V1CyclesContent {
  'caption' : [] | [string],
  'amount' : bigint,
}
export interface V1DirectMessageNotification {
  'recipient' : UserId,
  'sender' : UserId,
  'message' : V1Message,
  'sender_name' : string,
}
export interface V1FileContent {
  'blob_size' : number,
  'blob_id' : string,
  'name' : string,
  'mime_type' : string,
  'caption' : [] | [string],
  'chunk_size' : number,
  'blob_deleted' : boolean,
}
export type V1GroupId = bigint;
export interface V1GroupMessageNotification {
  'sender' : UserId,
  'recipients' : Array<UserId>,
  'message' : V1Message,
  'sender_name' : string,
  'chat_id' : bigint,
  'group_name' : string,
}
export interface V1MediaContent {
  'height' : number,
  'blob_size' : number,
  'blob_id' : string,
  'mime_type' : string,
  'thumbnail_data' : string,
  'caption' : [] | [string],
  'width' : number,
  'chunk_size' : number,
  'blob_deleted' : boolean,
}
export interface V1Message {
  'id' : number,
  'content' : V1MessageContent,
  'sender' : UserId,
  'timestamp' : TimestampMillis,
  'replies_to' : [] | [V1ReplyContext],
  'client_message_id' : string,
}
export type V1MessageContent = { 'File' : V1FileContent } |
  { 'Text' : V1TextContent } |
  { 'Media' : V1MediaContent } |
  { 'Cycles' : V1CyclesContent };
export interface V1ReplyContext {
  'content' : V1MessageContent,
  'user_id' : UserId,
  'chat_id' : V1ChatId,
  'message_id' : number,
}
export interface V1TextContent { 'text' : string }
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface _SERVICE {
  'add_participants' : (arg_0: AddParticipantsArgs) => Promise<
      AddParticipantsResponse
    >,
  'block_user' : (arg_0: BlockUserArgs) => Promise<BlockUserResponse>,
  'events' : (arg_0: EventsArgs) => Promise<EventsResponse>,
  'events_by_index' : (arg_0: EventsByIndexArgs) => Promise<
      EventsByIndexResponse
    >,
  'get_chunk' : (arg_0: GetChunkArgs) => Promise<GetChunkResponse>,
  'join_group' : (arg_0: JoinGroupArgs) => Promise<JoinGroupResponse>,
  'leave_group' : (arg_0: LeaveGroupArgs) => Promise<LeaveGroupResponse>,
  'make_admin' : (arg_0: MakeAdminArgs) => Promise<MakeAdminResponse>,
  'mark_read' : (arg_0: MarkReadArgs) => Promise<MarkReadResponse>,
  'metrics' : (arg_0: MetricsArgs) => Promise<MetricsResponse>,
  'put_chunk' : (arg_0: PutChunkArgs) => Promise<PutChunkResponse>,
  'remove_admin' : (arg_0: RemoveAdminArgs) => Promise<RemoveAdminResponse>,
  'remove_participants' : (arg_0: RemoveParticipantsArgs) => Promise<
      RemoveParticipantsResponse
    >,
  'search_messages' : (arg_0: SearchMessagesArgs) => Promise<
      SearchMessagesResponse
    >,
  'send_message' : (arg_0: SendMessageArgs) => Promise<SendMessageResponse>,
  'set_avatar' : (arg_0: SetAvatarArgs) => Promise<SetAvatarResponse>,
  'summary' : (arg_0: SummaryArgs) => Promise<SummaryResponse>,
  'summary_updates' : (arg_0: SummaryUpdatesArgs) => Promise<
      SummaryUpdatesResponse
    >,
  'unblock_user' : (arg_0: UnblockUserArgs) => Promise<UnblockUserResponse>,
}
