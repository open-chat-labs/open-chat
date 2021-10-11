import type { Principal } from '@dfinity/principal';
export interface ActiveGroupsArgs {
  'active_in_last' : Milliseconds,
  'chat_ids' : Array<ChatId>,
}
export type ActiveGroupsResponse = { 'Success' : ActiveGroupsSuccessResult };
export interface ActiveGroupsSuccessResult { 'active_groups' : Array<ChatId> }
export interface AudioContent {
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
}
export interface Avatar {
  'id' : bigint,
  'data' : Array<number>,
  'mime_type' : string,
}
export interface AvatarChanged {
  'changed_by' : UserId,
  'previous_avatar' : [] | [bigint],
  'new_avatar' : bigint,
}
export interface BlobReference {
  'blob_id' : bigint,
  'canister_id' : CanisterId,
}
export type CanisterCreationStatus = { 'InProgress' : null } |
  { 'Created' : null } |
  { 'Pending' : null };
export type CanisterId = Principal;
export type CanisterUpgradeStatus = { 'Required' : null } |
  { 'NotRequired' : null } |
  { 'InProgress' : null };
export interface CanisterWasm { 'version' : Version, 'module' : Array<number> }
export type ChatId = CanisterId;
export type ChatSummary = { 'Group' : GroupChatSummary } |
  { 'Direct' : DirectChatSummary };
export type ChatSummaryUpdates = { 'Group' : GroupChatSummaryUpdates } |
  { 'Direct' : DirectChatSummaryUpdates };
export interface ConfirmationCodeSms {
  'confirmation_code' : string,
  'phone_number' : string,
}
export interface CyclesContent { 'caption' : [] | [string], 'amount' : bigint }
export interface DeletedContent {
  'timestamp' : TimestampMillis,
  'deleted_by' : UserId,
}
export type DirectChatCreated = {};
export type DirectChatEvent = { 'MessageReactionRemoved' : UpdatedMessage } |
  { 'MessageReactionAdded' : UpdatedMessage } |
  { 'Message' : Message } |
  { 'MessageDeleted' : UpdatedMessage } |
  { 'DirectChatCreated' : DirectChatCreated } |
  { 'MessageEdited' : UpdatedMessage };
export interface DirectChatEventWrapper {
  'event' : DirectChatEvent,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export interface DirectChatSummary {
  'date_created' : TimestampMillis,
  'them' : UserId,
  'read_by_me' : Array<MessageIndexRange>,
  'latest_event_index' : EventIndex,
  'read_by_them' : Array<MessageIndexRange>,
  'latest_message' : MessageEventWrapper,
}
export interface DirectChatSummaryUpdates {
  'read_by_me' : [] | [Array<MessageIndexRange>],
  'latest_event_index' : [] | [EventIndex],
  'chat_id' : ChatId,
  'read_by_them' : [] | [Array<MessageIndexRange>],
  'latest_message' : [] | [MessageEventWrapper],
}
export interface DirectMessageNotification {
  'sender' : UserId,
  'message' : Message,
  'sender_name' : string,
}
export type EventIndex = number;
export interface FieldTooLongResult {
  'length_provided' : number,
  'max_length' : number,
}
export interface FileContent {
  'name' : string,
  'mime_type' : string,
  'file_size' : number,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
}
export interface GroupChatCreated {
  'name' : string,
  'description' : string,
  'created_by' : UserId,
}
export type GroupChatEvent = { 'MessageReactionRemoved' : UpdatedMessage } |
  { 'ParticipantJoined' : ParticipantJoined } |
  { 'GroupDescriptionChanged' : GroupDescriptionChanged } |
  { 'GroupChatCreated' : GroupChatCreated } |
  { 'ParticipantsPromotedToAdmin' : ParticipantsPromotedToAdmin } |
  { 'MessageReactionAdded' : UpdatedMessage } |
  { 'ParticipantsRemoved' : ParticipantsRemoved } |
  { 'Message' : Message } |
  { 'ParticipantsDismissedAsAdmin' : ParticipantsDismissedAsAdmin } |
  { 'ParticipantLeft' : ParticipantLeft } |
  { 'MessageDeleted' : UpdatedMessage } |
  { 'GroupNameChanged' : GroupNameChanged } |
  { 'MessageEdited' : UpdatedMessage } |
  { 'AvatarChanged' : AvatarChanged } |
  { 'ParticipantsAdded' : ParticipantsAdded };
export interface GroupChatEventWrapper {
  'event' : GroupChatEvent,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export interface GroupChatSummary {
  'is_public' : boolean,
  'participants' : Array<Participant>,
  'min_visible_event_index' : EventIndex,
  'name' : string,
  'description' : string,
  'last_updated' : TimestampMillis,
  'read_by_me' : Array<MessageIndexRange>,
  'joined' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'latest_event_index' : EventIndex,
  'min_visible_message_index' : MessageIndex,
  'chat_id' : ChatId,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface GroupChatSummaryUpdates {
  'participants_added_or_updated' : Array<Participant>,
  'participants_removed' : Array<UserId>,
  'name' : [] | [string],
  'description' : [] | [string],
  'last_updated' : TimestampMillis,
  'read_by_me' : [] | [Array<MessageIndexRange>],
  'avatar_id' : [] | [bigint],
  'latest_event_index' : [] | [EventIndex],
  'chat_id' : ChatId,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface GroupDescriptionChanged {
  'new_description' : string,
  'previous_description' : string,
  'changed_by' : UserId,
}
export interface GroupMatch {
  'name' : string,
  'description' : string,
  'avatar_id' : [] | [bigint],
  'chat_id' : ChatId,
}
export interface GroupMessageNotification {
  'sender' : UserId,
  'message' : Message,
  'sender_name' : string,
  'chat_id' : ChatId,
  'group_name' : string,
}
export interface GroupNameChanged {
  'changed_by' : UserId,
  'new_name' : string,
  'previous_name' : string,
}
export interface ImageContent {
  'height' : number,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'thumbnail_data' : string,
  'caption' : [] | [string],
  'width' : number,
}
export interface IndexedNotification {
  'value' : NotificationEnvelope,
  'index' : bigint,
}
export interface InitArgs {
  'service_principals' : Array<Principal>,
  'notifications_canister_id' : CanisterId,
  'group_wasm_module' : Array<number>,
}
export interface Message {
  'content' : MessageContent,
  'edited' : boolean,
  'sender' : UserId,
  'message_id' : MessageId,
  'replies_to' : [] | [ReplyContext],
  'reactions' : Array<[string, Array<UserId>]>,
  'message_index' : MessageIndex,
}
export type MessageContent = { 'File' : FileContent } |
  { 'Text' : TextContent } |
  { 'Image' : ImageContent } |
  { 'Cycles' : CyclesContent } |
  { 'Audio' : AudioContent } |
  { 'Video' : VideoContent } |
  { 'Deleted' : DeletedContent };
export interface MessageEventWrapper {
  'event' : Message,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export type MessageId = bigint;
export type MessageIndex = number;
export interface MessageIndexRange {
  'to' : MessageIndex,
  'from' : MessageIndex,
}
export interface MessageMatch {
  'content' : MessageContent,
  'sender' : UserId,
  'score' : number,
  'chat_id' : ChatId,
  'event_index' : EventIndex,
}
export type MetricsArgs = {};
export interface MetricsResponse {
  'cycles_balance' : bigint,
  'private_group_count' : bigint,
  'active_public_group_count' : bigint,
  'active_private_group_count' : bigint,
  'caller_id' : Principal,
  'deleted_public_group_count' : bigint,
  'bytes_used' : bigint,
  'timestamp' : TimestampMillis,
  'deleted_private_group_count' : bigint,
  'public_group_count' : bigint,
  'wasm_memory_used' : bigint,
}
export type Milliseconds = bigint;
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
  'avatar_id' : [] | [bigint],
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
export interface ReplyContext {
  'chat_id_if_other' : [] | [ChatId],
  'event_index' : EventIndex,
}
export type Role = { 'Participant' : null } |
  { 'Admin' : null };
export interface SearchArgs { 'max_results' : number, 'search_term' : string }
export type SearchResponse = { 'TermTooShort' : number } |
  { 'Success' : SearchSuccessResult } |
  { 'TermTooLong' : number } |
  { 'InvalidTerm' : null };
export interface SearchSuccessResult { 'matches' : Array<GroupMatch> }
export interface Subscription {
  'value' : SubscriptionInfo,
  'last_active' : TimestampMillis,
}
export interface SubscriptionInfo {
  'endpoint' : string,
  'keys' : SubscriptionKeys,
}
export interface SubscriptionKeys { 'auth' : string, 'p256dh' : string }
export interface TextContent { 'text' : string }
export type TimestampMillis = bigint;
export type TimestampNanos = bigint;
export interface UpdateGroupCanisterWasmArgs {
  'group_canister_wasm' : CanisterWasm,
}
export type UpdateGroupCanisterWasmResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'VersionNotHigher' : null } |
  { 'InvalidVersion' : null };
export interface UpdatedMessage {
  'message_id' : MessageId,
  'event_index' : EventIndex,
}
export type UserId = CanisterId;
export interface UserSummary {
  'username' : string,
  'user_id' : UserId,
  'avatar_id' : [] | [bigint],
  'seconds_since_last_online' : number,
}
export type V1ChatId = bigint;
export interface V1CyclesContent {
  'caption' : [] | [string],
  'amount' : bigint,
}
export interface V1DirectMessageNotification {
  'sender' : UserId,
  'message' : V1Message,
  'sender_name' : string,
  'chat_id' : string,
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
  'message' : V1Message,
  'sender_name' : string,
  'chat_id' : string,
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
export interface VideoContent {
  'height' : number,
  'image_blob_reference' : [] | [BlobReference],
  'video_blob_reference' : [] | [BlobReference],
  'mime_type' : string,
  'thumbnail_data' : string,
  'caption' : [] | [string],
  'width' : number,
}
export interface _SERVICE {
  'active_groups' : (arg_0: ActiveGroupsArgs) => Promise<ActiveGroupsResponse>,
  'metrics' : (arg_0: MetricsArgs) => Promise<MetricsResponse>,
  'search' : (arg_0: SearchArgs) => Promise<SearchResponse>,
  'update_group_canister_wasm' : (
      arg_0: UpdateGroupCanisterWasmArgs,
    ) => Promise<UpdateGroupCanisterWasmResponse>,
}
