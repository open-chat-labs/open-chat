import type { Principal } from '@dfinity/principal';
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
export interface CombinedMessageMatch {
  'content' : MessageContent,
  'sender' : UserId,
  'score' : number,
  'chat_id' : ChatId,
  'event_index' : EventIndex,
}
export interface ConfirmPhoneNumberArgs { 'confirmation_code' : string }
export type ConfirmPhoneNumberResponse = { 'AlreadyClaimed' : null } |
  { 'Success' : null } |
  { 'ConfirmationCodeExpired' : null } |
  { 'ConfirmationCodeIncorrect' : null } |
  { 'UserNotFound' : null };
export interface ConfirmationCodeSms {
  'confirmation_code' : string,
  'phone_number' : string,
}
export type CreateCanisterArgs = {};
export type CreateCanisterResponse = { 'UserAlreadyCreated' : null } |
  { 'Success' : CanisterId } |
  { 'CreationInProgress' : null } |
  { 'InternalError' : null } |
  { 'UserUnconfirmed' : null } |
  { 'UserNotFound' : null };
export type CurrentUserArgs = {};
export type CurrentUserResponse = {
    'Unconfirmed' : { 'phone_number' : PhoneNumber }
  } |
  {
    'Confirmed' : {
      'username' : string,
      'canister_creation_status' : CanisterCreationStatus,
    }
  } |
  {
    'ConfirmedPendingUsername' : {
      'canister_creation_status' : CanisterCreationStatus,
    }
  } |
  {
    'Created' : {
      'username' : string,
      'user_id' : UserId,
      'avatar_id' : [] | [bigint],
      'canister_upgrade_status' : CanisterUpgradeStatus,
      'account_balance' : bigint,
    }
  } |
  { 'UserNotFound' : null };
export interface CyclesContent { 'caption' : [] | [string], 'amount' : bigint }
export interface DeletedDirectMessage {
  'sent_by_me' : boolean,
  'message_id' : MessageId,
  'message_index' : MessageIndex,
}
export interface DeletedGroupMessage {
  'sender' : UserId,
  'message_id' : MessageId,
  'message_index' : MessageIndex,
}
export type DirectChatCreated = {};
export type DirectChatEvent = { 'Message' : DirectMessage } |
  { 'MessageDeleted' : MessageDeleted } |
  { 'DeletedMessage' : DeletedDirectMessage } |
  { 'DirectChatCreated' : DirectChatCreated };
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
  'latest_message' : DirectMessageEventWrapper,
}
export interface DirectChatSummaryUpdates {
  'read_by_me' : [] | [Array<MessageIndexRange>],
  'latest_event_index' : [] | [EventIndex],
  'chat_id' : ChatId,
  'read_by_them' : [] | [Array<MessageIndexRange>],
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
export type GroupChatEvent = { 'ParticipantJoined' : ParticipantJoined } |
  { 'GroupDescriptionChanged' : GroupDescriptionChanged } |
  { 'GroupChatCreated' : GroupChatCreated } |
  { 'ParticipantsPromotedToAdmin' : ParticipantsPromotedToAdmin } |
  { 'ParticipantsRemoved' : ParticipantsRemoved } |
  { 'Message' : GroupMessage } |
  { 'ParticipantsDismissedAsAdmin' : ParticipantsDismissedAsAdmin } |
  { 'ParticipantLeft' : ParticipantLeft } |
  { 'MessageDeleted' : MessageDeleted } |
  { 'GroupNameChanged' : GroupNameChanged } |
  { 'DeletedMessage' : DeletedGroupMessage } |
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
  'latest_message' : [] | [GroupMessageEventWrapper],
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
  'latest_message' : [] | [GroupMessageEventWrapper],
}
export interface GroupDescriptionChanged {
  'new_description' : string,
  'previous_description' : string,
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
export interface GroupMessageMatch {
  'content' : MessageContent,
  'sender' : UserId,
  'score' : number,
  'event_index' : EventIndex,
}
export interface GroupMessageNotification {
  'sender' : UserId,
  'recipients' : Array<UserId>,
  'message' : GroupMessage,
  'sender_name' : string,
  'chat_id' : ChatId,
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
  'message_id' : MessageId,
  'event_index' : EventIndex,
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
  'test_mode' : boolean,
  'user_wasm_module' : Array<number>,
  'sms_service_principals' : Array<Principal>,
  'service_principals' : Array<Principal>,
}
export type MarkAsOnlineArgs = {};
export type MarkAsOnlineResponse = { 'Success' : null } |
  { 'UserNotFound' : null };
export type MessageContent = { 'File' : FileContent } |
  { 'Text' : TextContent } |
  { 'Image' : ImageContent } |
  { 'Cycles' : CyclesContent } |
  { 'Audio' : AudioContent } |
  { 'Video' : VideoContent };
export interface MessageDeleted {
  'message_id' : MessageId,
  'event_index' : EventIndex,
}
export type MessageId = bigint;
export type MessageIndex = number;
export interface MessageIndexRange {
  'to' : MessageIndex,
  'from' : MessageIndex,
}
export type MetricsArgs = {};
export interface MetricsResponse {
  'cycles_balance' : bigint,
  'unconfirmed_user_count' : bigint,
  'caller_id' : Principal,
  'bytes_used' : bigint,
  'timestamp' : TimestampMillis,
  'created_user_count' : bigint,
  'online_user_count' : bigint,
  'confirmed_user_count' : bigint,
  'wasm_memory_used' : bigint,
  'cycles_transferred' : bigint,
  'active_user_count' : bigint,
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
export interface NotifyBalanceArgs { 'balance' : bigint }
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
export interface PhoneNumber { 'country_code' : number, 'number' : string }
export interface PrivateReplyContext {
  'chat_id' : ChatId,
  'message_id' : MessageId,
  'event_index' : EventIndex,
}
export interface RemoveSmsMessagesArgs { 'up_to_sms_index' : bigint }
export type RemoveSmsMessagesResponse = { 'NotAuthorized' : null } |
  { 'Success' : null };
export type ResendCodeArgs = {};
export type ResendCodeResponse = { 'AlreadyClaimed' : null } |
  { 'Success' : null } |
  { 'UserNotFound' : null };
export type Role = { 'Participant' : null } |
  { 'Admin' : null };
export interface SearchArgs { 'max_results' : number, 'search_term' : string }
export type SearchResponse = { 'Success' : { 'users' : Array<UserSummary> } };
export interface SetUsernameArgs { 'username' : string }
export type SetUsernameResponse = { 'UsernameTaken' : null } |
  { 'UsernameTooShort' : number } |
  { 'UsernameInvalid' : null } |
  { 'UsernameTooLong' : number } |
  { 'Success' : null } |
  { 'UserUnconfirmed' : null } |
  { 'UserNotFound' : null };
export interface SmsMessagesArgs {
  'max_results' : bigint,
  'from_index' : bigint,
}
export type SmsMessagesResponse = {
    'Success' : {
      'notifications' : Array<ConfirmationCodeSms>,
      'latest_index' : bigint,
    }
  };
export interface StandardReplyContext {
  'content' : MessageContent,
  'sent_by_me' : boolean,
  'message_id' : MessageId,
  'event_index' : EventIndex,
}
export interface SubmitPhoneNumberArgs { 'phone_number' : PhoneNumber }
export type SubmitPhoneNumberResponse = { 'AlreadyRegistered' : null } |
  { 'Success' : null } |
  { 'AlreadyRegisteredByOther' : null } |
  { 'InvalidPhoneNumber' : null };
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
export interface TransferCyclesArgs {
  'recipient' : UserId,
  'sender' : UserId,
  'amount' : bigint,
}
export type TransferCyclesResponse = { 'BalanceExceeded' : null } |
  { 'Success' : { 'new_balance' : bigint } } |
  { 'UserNotFound' : null } |
  { 'RecipientNotFound' : null };
export interface UpdateWasmArgs {
  'user_wasm_module' : Array<number>,
  'version' : string,
}
export type UpdateWasmResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'VersionNotHigher' : null } |
  { 'InvalidVersion' : null };
export type UpgradeCanisterArgs = {};
export type UpgradeCanisterResponse = { 'UpgradeInProgress' : null } |
  { 'UserNotCreated' : null } |
  { 'Success' : null } |
  { 'UpgradeNotRequired' : null } |
  { 'InternalError' : null } |
  { 'UserNotFound' : null };
export interface UserArgs {
  'username' : [] | [string],
  'user_id' : [] | [UserId],
}
export type UserId = CanisterId;
export interface UserMessageMatch {
  'content' : MessageContent,
  'score' : number,
  'sent_by_me' : boolean,
  'event_index' : EventIndex,
}
export type UserResponse = { 'Success' : UserSummary } |
  { 'UserNotFound' : null };
export interface UserSummary {
  'username' : string,
  'user_id' : UserId,
  'avatar_id' : [] | [bigint],
  'seconds_since_last_online' : number,
}
export interface UsersArgs {
  'users' : Array<UserId>,
  'updated_since' : [] | [TimestampMillis],
}
export type UsersResponse = {
    'Success' : {
      'timestamp' : TimestampMillis,
      'users' : Array<PartialUserSummary>,
    }
  };
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
  'confirm_phone_number' : (arg_0: ConfirmPhoneNumberArgs) => Promise<
      ConfirmPhoneNumberResponse
    >,
  'create_canister' : (arg_0: CreateCanisterArgs) => Promise<
      CreateCanisterResponse
    >,
  'current_user' : (arg_0: CurrentUserArgs) => Promise<CurrentUserResponse>,
  'mark_as_online' : (arg_0: MarkAsOnlineArgs) => Promise<MarkAsOnlineResponse>,
  'metrics' : (arg_0: MetricsArgs) => Promise<MetricsResponse>,
  'notify_balance' : (arg_0: NotifyBalanceArgs) => Promise<undefined>,
  'remove_sms_messages' : (arg_0: RemoveSmsMessagesArgs) => Promise<
      RemoveSmsMessagesResponse
    >,
  'resend_code' : (arg_0: ResendCodeArgs) => Promise<ResendCodeResponse>,
  'search' : (arg_0: SearchArgs) => Promise<SearchResponse>,
  'set_username' : (arg_0: SetUsernameArgs) => Promise<SetUsernameResponse>,
  'sms_messages' : (arg_0: SmsMessagesArgs) => Promise<SmsMessagesResponse>,
  'submit_phone_number' : (arg_0: SubmitPhoneNumberArgs) => Promise<
      SubmitPhoneNumberResponse
    >,
  'transfer_cycles' : (arg_0: TransferCyclesArgs) => Promise<
      TransferCyclesResponse
    >,
  'update_wasm' : (arg_0: UpdateWasmArgs) => Promise<UpdateWasmResponse>,
  'upgrade_canister' : (arg_0: UpgradeCanisterArgs) => Promise<
      UpgradeCanisterResponse
    >,
  'user' : (arg_0: UserArgs) => Promise<UserResponse>,
  'users' : (arg_0: UsersArgs) => Promise<UsersResponse>,
}
