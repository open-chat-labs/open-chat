import type { Principal } from '@dfinity/principal';
export interface BlobReference {
  'blob_size' : number,
  'blob_id' : bigint,
  'canister_id' : CanisterId,
  'chunk_size' : number,
}
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
export interface CreateArgs { 'is_public' : boolean, 'name' : string }
export type CreateResponse = { 'PublicGroupAlreadyExists' : null } |
  { 'UnknownError' : null } |
  { 'Success' : { 'canister_id' : CanisterId } } |
  { 'InvalidName' : null } |
  { 'NameTooLong' : number } |
  { 'GroupLimitExceeded' : null };
export interface CyclesContent { 'caption' : [] | [string], 'amount' : bigint }
export interface DeleteArgs { 'chat_id' : GroupChatId }
export type DeleteResponse = { 'NotFound' : null } |
  { 'Success' : null } |
  { 'NotAdmin' : null };
export type DirectChatCreated = {};
export type DirectChatEvent = { 'Message' : DirectMessage } |
  { 'DirectChatCreated' : DirectChatCreated };
export interface DirectChatEventWrapper {
  'event' : DirectChatEvent,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export type DirectChatId = Principal;
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
export interface FileContent {
  'name' : string,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
}
export interface GroupChatCreated {
  'name' : string,
  'description' : string,
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
export type GroupChatId = Principal;
export interface GroupChatSummary {
  'is_public' : boolean,
  'participants' : Array<Participant>,
  'min_visible_event_index' : EventIndex,
  'name' : string,
  'description' : string,
  'last_updated' : TimestampMillis,
  'latest_read_by_me' : MessageIndex,
  'joined' : TimestampMillis,
  'latest_event_index' : EventIndex,
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
export interface MediaContent {
  'height' : number,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'thumbnail_data' : string,
  'caption' : [] | [string],
  'width' : number,
}
export type MessageContent = { 'File' : FileContent } |
  { 'Text' : TextContent } |
  { 'Media' : MediaContent } |
  { 'Cycles' : CyclesContent };
export type MessageId = bigint;
export type MessageIndex = number;
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
export interface NotifyBalanceArgs { 'balance' : bigint }
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
export type Role = { 'Participant' : null } |
  { 'Admin' : null };
export interface SearchArgs { 'max_results' : number, 'search_term' : string }
export type SearchResponse = { 'TermTooShort' : number } |
  {
    'Success' : {
      'groups' : Array<
        { 'name' : string, 'score' : number, 'chat_id' : GroupChatId }
      >,
    }
  } |
  { 'TermTooLong' : number } |
  { 'InvalidTerm' : null };
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
export interface TextContent { 'text' : string }
export type TimestampMillis = bigint;
export interface UpgradeArgs { 'wasm' : Array<number>, 'version' : string }
export type UpgradeResponse = { 'Success' : { 'canister_id' : CanisterId } } |
  { 'Failure' : null };
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
  'create' : (arg_0: CreateArgs) => Promise<CreateResponse>,
  'delete' : (arg_0: DeleteArgs) => Promise<DeleteResponse>,
  'metrics' : (arg_0: MetricsArgs) => Promise<MetricsResponse>,
  'notify_balance' : (arg_0: NotifyBalanceArgs) => Promise<undefined>,
  'search' : (arg_0: SearchArgs) => Promise<SearchResponse>,
  'upgrade' : (arg_0: UpgradeArgs) => Promise<UpgradeResponse>,
}
