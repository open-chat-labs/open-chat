import type { Principal } from '@dfinity/principal';
export type AccountIdentifier = string;
export interface AddSuperAdminArgs { 'user_id' : UserId }
export type AddSuperAdminResponse = { 'Success' : null } |
  { 'InternalError' : string } |
  { 'AlreadySuperAdmin' : null };
export interface Alert {
  'id' : string,
  'details' : AlertDetails,
  'elapsed' : Milliseconds,
}
export type AlertDetails = { 'GroupDeleted' : GroupDeletedAlert } |
  { 'CryptocurrencyDepositReceived' : CryptocurrencyDeposit } |
  { 'RemovedFromGroup' : RemovedFromGroupAlert } |
  { 'BlockedFromGroup' : RemovedFromGroupAlert };
export type AlertId = { 'Internal' : number } |
  { 'GroupDeleted' : ChatId };
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
export type BlockHeight = bigint;
export type CanisterCreationStatus = { 'InProgress' : null } |
  { 'Created' : null } |
  { 'Pending' : null };
export type CanisterId = Principal;
export type CanisterUpgradeStatus = { 'Required' : null } |
  { 'NotRequired' : null } |
  { 'InProgress' : null };
export interface CanisterWasm {
  'compressed' : boolean,
  'version' : Version,
  'module' : Array<number>,
}
export type ChatId = CanisterId;
export type ChatSummary = { 'Group' : GroupChatSummary } |
  { 'Direct' : DirectChatSummary };
export type ChatSummaryUpdates = { 'Group' : GroupChatSummaryUpdates } |
  { 'Direct' : DirectChatSummaryUpdates };
export interface CompletedCyclesDeposit {
  'from' : CanisterId,
  'cycles' : Cycles,
}
export interface CompletedCyclesTransfer {
  'recipient' : UserId,
  'sender' : UserId,
  'cycles' : Cycles,
}
export interface CompletedCyclesWithdrawal {
  'to' : CanisterId,
  'cycles' : Cycles,
}
export interface CompletedICPDeposit {
  'memo' : bigint,
  'fee_e8s' : bigint,
  'amount_e8s' : bigint,
  'from_address' : string,
  'block_height' : BlockHeight,
}
export interface CompletedICPTransfer {
  'memo' : bigint,
  'recipient' : UserId,
  'fee_e8s' : bigint,
  'sender' : UserId,
  'amount_e8s' : bigint,
  'block_height' : BlockHeight,
}
export interface CompletedICPWithdrawal {
  'to' : string,
  'memo' : bigint,
  'fee_e8s' : bigint,
  'amount_e8s' : bigint,
  'block_height' : BlockHeight,
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
  { 'InternalError' : string } |
  { 'UserUnconfirmed' : null } |
  { 'UserNotFound' : null } |
  { 'CyclesBalanceTooLow' : null };
export type Cryptocurrency = { 'ICP' : null } |
  { 'Cycles' : null };
export interface CryptocurrencyAccount {
  'currency' : Cryptocurrency,
  'address' : string,
}
export interface CryptocurrencyContent {
  'caption' : [] | [string],
  'transfer' : CryptocurrencyTransfer,
}
export type CryptocurrencyDeposit = { 'ICP' : ICPDeposit } |
  { 'Cycles' : CyclesDeposit };
export type CryptocurrencyTransaction = { 'Deposit' : CryptocurrencyDeposit } |
  { 'Withdrawal' : CryptocurrencyWithdrawal } |
  { 'Transfer' : CryptocurrencyTransfer };
export type CryptocurrencyTransfer = { 'ICP' : ICPTransfer } |
  { 'Cycles' : CyclesTransfer };
export type CryptocurrencyWithdrawal = { 'ICP' : ICPWithdrawal } |
  { 'Cycles' : CyclesWithdrawal };
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
      'cryptocurrency_accounts' : Array<CryptocurrencyAccount>,
      'avatar_id' : [] | [bigint],
      'canister_upgrade_status' : CanisterUpgradeStatus,
    }
  } |
  { 'UserNotFound' : null };
export type Cycles = bigint;
export type CyclesDeposit = { 'Completed' : CompletedCyclesDeposit };
export type CyclesTransfer = { 'Failed' : FailedCyclesTransfer } |
  { 'Completed' : CompletedCyclesTransfer } |
  { 'Pending' : PendingCyclesTransfer };
export type CyclesWithdrawal = { 'Failed' : FailedCyclesWithdrawal } |
  { 'Completed' : CompletedCyclesWithdrawal } |
  { 'Pending' : PendingCyclesWithdrawal };
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
  'notifications_muted' : boolean,
  'read_by_me' : Array<MessageIndexRange>,
  'latest_event_index' : EventIndex,
  'read_by_them' : Array<MessageIndexRange>,
  'latest_message' : MessageEventWrapper,
}
export interface DirectChatSummaryUpdates {
  'notifications_muted' : [] | [boolean],
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
export interface FailedCyclesTransfer {
  'error_message' : string,
  'recipient' : UserId,
  'cycles' : Cycles,
}
export interface FailedCyclesWithdrawal {
  'to' : CanisterId,
  'error_message' : string,
  'cycles' : Cycles,
}
export interface FailedICPTransfer {
  'memo' : bigint,
  'error_message' : string,
  'recipient' : UserId,
  'fee_e8s' : bigint,
  'amount_e8s' : bigint,
}
export interface FailedICPWithdrawal {
  'to' : string,
  'memo' : bigint,
  'error_message' : string,
  'fee_e8s' : bigint,
  'amount_e8s' : bigint,
}
export type FallbackRole = { 'Participant' : null } |
  { 'Admin' : null };
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
  { 'ParticipantAssumesSuperAdmin' : ParticipantAssumesSuperAdmin } |
  { 'GroupDescriptionChanged' : GroupDescriptionChanged } |
  { 'GroupChatCreated' : GroupChatCreated } |
  { 'ParticipantsPromotedToAdmin' : ParticipantsPromotedToAdmin } |
  { 'UsersBlocked' : UsersBlocked } |
  { 'MessageReactionAdded' : UpdatedMessage } |
  { 'ParticipantsRemoved' : ParticipantsRemoved } |
  { 'ParticipantRelinquishesSuperAdmin' : ParticipantRelinquishesSuperAdmin } |
  { 'Message' : Message } |
  { 'ParticipantsDismissedAsAdmin' : ParticipantsDismissedAsAdmin } |
  { 'UsersUnblocked' : UsersUnblocked } |
  { 'ParticipantLeft' : ParticipantLeft } |
  { 'MessageDeleted' : UpdatedMessage } |
  { 'ParticipantDismissedAsSuperAdmin' : ParticipantDismissedAsSuperAdmin } |
  { 'GroupNameChanged' : GroupNameChanged } |
  { 'OwnershipTransferred' : OwnershipTransferred } |
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
  'min_visible_event_index' : EventIndex,
  'name' : string,
  'role' : Role,
  'wasm_version' : Version,
  'notifications_muted' : boolean,
  'description' : string,
  'last_updated' : TimestampMillis,
  'read_by_me' : Array<MessageIndexRange>,
  'joined' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'latest_event_index' : EventIndex,
  'min_visible_message_index' : MessageIndex,
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'participant_count' : number,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface GroupChatSummaryUpdates {
  'name' : [] | [string],
  'role' : [] | [Role],
  'wasm_version' : [] | [Version],
  'notifications_muted' : [] | [boolean],
  'description' : [] | [string],
  'last_updated' : TimestampMillis,
  'read_by_me' : [] | [Array<MessageIndexRange>],
  'avatar_id' : [] | [bigint],
  'latest_event_index' : [] | [EventIndex],
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'participant_count' : [] | [number],
  'latest_message' : [] | [MessageEventWrapper],
}
export interface GroupDeletedAlert { 'deleted_by' : UserId, 'chat_id' : ChatId }
export interface GroupDescriptionChanged {
  'new_description' : string,
  'previous_description' : string,
  'changed_by' : UserId,
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
export type ICPDeposit = { 'Completed' : CompletedICPDeposit };
export type ICPTransfer = { 'Failed' : FailedICPTransfer } |
  { 'Completed' : CompletedICPTransfer } |
  { 'Pending' : PendingICPTransfer };
export type ICPWithdrawal = { 'Failed' : FailedICPWithdrawal } |
  { 'Completed' : CompletedICPWithdrawal } |
  { 'Pending' : PendingICPWithdrawal };
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
export interface Mention { 'message_index' : MessageIndex }
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
  { 'Cryptocurrency' : CryptocurrencyContent } |
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
  'message_index' : MessageIndex,
}
export type Milliseconds = bigint;
export type NightMode = { 'On' : null } |
  { 'Off' : null } |
  { 'Auto' : null };
export type Notification = {
    'DirectMessageNotification' : DirectMessageNotification
  } |
  { 'GroupMessageNotification' : GroupMessageNotification };
export interface NotificationEnvelope {
  'notification' : Notification,
  'recipients' : Array<UserId>,
}
export interface OptionalUserPreferences {
  'large_emoji' : [] | [boolean],
  'notification_preferences' : [] | [
    {
      'private_group_chats' : [] | [boolean],
      'direct_chats' : [] | [boolean],
      'silent' : [] | [boolean],
      'public_group_chats' : [] | [boolean],
      'vibrate' : [] | [boolean],
    }
  ],
  'night_mode' : [] | [NightMode],
  'language' : [] | [string],
  'enter_key_sends' : [] | [boolean],
  'generate_link_previews' : [] | [boolean],
  'use_system_emoji' : [] | [boolean],
  'enable_animations' : [] | [boolean],
}
export interface OwnershipTransferred {
  'old_owner' : UserId,
  'new_owner' : UserId,
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
export interface ParticipantAssumesSuperAdmin { 'user_id' : UserId }
export interface ParticipantDismissedAsSuperAdmin { 'user_id' : UserId }
export interface ParticipantJoined {
  'user_id' : UserId,
  'as_super_admin' : boolean,
}
export interface ParticipantLeft { 'user_id' : UserId }
export interface ParticipantRelinquishesSuperAdmin { 'user_id' : UserId }
export interface ParticipantsAdded {
  'user_ids' : Array<UserId>,
  'unblocked' : Array<UserId>,
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
export interface PendingCyclesTransfer {
  'recipient' : UserId,
  'cycles' : Cycles,
}
export interface PendingCyclesWithdrawal {
  'to' : CanisterId,
  'cycles' : Cycles,
}
export interface PendingICPTransfer {
  'memo' : [] | [bigint],
  'recipient' : UserId,
  'fee_e8s' : [] | [bigint],
  'amount_e8s' : bigint,
}
export interface PendingICPWithdrawal {
  'to' : string,
  'memo' : [] | [bigint],
  'fee_e8s' : [] | [bigint],
  'amount_e8s' : bigint,
}
export interface PhoneNumber { 'country_code' : number, 'number' : string }
export interface RemoveSuperAdminArgs { 'user_id' : UserId }
export type RemoveSuperAdminResponse = { 'Success' : null } |
  { 'NotSuperAdmin' : null } |
  { 'InternalError' : string };
export interface RemovedFromGroupAlert {
  'chat_id' : ChatId,
  'removed_by' : UserId,
}
export interface ReplyContext {
  'chat_id_if_other' : [] | [ChatId],
  'event_index' : EventIndex,
}
export type ResendCodeArgs = {};
export type ResendCodeResponse = { 'AlreadyClaimed' : null } |
  { 'Success' : null } |
  { 'UserNotFound' : null };
export type Role = { 'Participant' : null } |
  { 'SuperAdmin' : FallbackRole } |
  { 'Admin' : null } |
  { 'Owner' : null };
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
export interface SubmitPhoneNumberArgs { 'phone_number' : PhoneNumber }
export type SubmitPhoneNumberResponse = { 'AlreadyRegistered' : null } |
  { 'UserLimitReached' : null } |
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
export type SuperAdminsArgs = {};
export type SuperAdminsResponse = { 'Success' : { 'users' : Array<UserId> } };
export interface TextContent { 'text' : string }
export type TimestampMillis = bigint;
export type TimestampNanos = bigint;
export type Transaction = { 'Cryptocurrency' : CryptocurrencyTransaction };
export type TransactionStatus = { 'Failed' : string } |
  { 'Complete' : null } |
  { 'Pending' : null };
export interface TransactionWrapper {
  'transaction' : Transaction,
  'timestamp' : TimestampMillis,
  'index' : number,
}
export interface TransferCyclesArgs {
  'recipient' : UserId,
  'sender' : UserId,
  'amount' : bigint,
}
export type TransferCyclesResponse = { 'BalanceExceeded' : null } |
  { 'Success' : { 'new_balance' : bigint } } |
  { 'UserNotFound' : null } |
  { 'RecipientNotFound' : null };
export interface UpdateUserCanisterWasmArgs {
  'user_canister_wasm' : CanisterWasm,
}
export type UpdateUserCanisterWasmResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'VersionNotHigher' : null };
export interface UpdatedMessage {
  'updated_by' : UserId,
  'message_id' : MessageId,
  'event_index' : EventIndex,
}
export type UpgradeCanisterArgs = {};
export type UpgradeCanisterResponse = { 'UpgradeInProgress' : null } |
  { 'UserNotCreated' : null } |
  { 'Success' : null } |
  { 'UpgradeNotRequired' : null } |
  { 'InternalError' : string } |
  { 'UserNotFound' : null };
export interface UserArgs {
  'username' : [] | [string],
  'user_id' : [] | [UserId],
}
export type UserId = CanisterId;
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
export interface UsersBlocked {
  'user_ids' : Array<UserId>,
  'blocked_by' : UserId,
}
export type UsersResponse = {
    'Success' : {
      'timestamp' : TimestampMillis,
      'users' : Array<PartialUserSummary>,
    }
  };
export interface UsersUnblocked {
  'user_ids' : Array<UserId>,
  'unblocked_by' : UserId,
}
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
  'add_super_admin' : (arg_0: AddSuperAdminArgs) => Promise<
      AddSuperAdminResponse
    >,
  'confirm_phone_number' : (arg_0: ConfirmPhoneNumberArgs) => Promise<
      ConfirmPhoneNumberResponse
    >,
  'create_canister' : (arg_0: CreateCanisterArgs) => Promise<
      CreateCanisterResponse
    >,
  'current_user' : (arg_0: CurrentUserArgs) => Promise<CurrentUserResponse>,
  'remove_super_admin' : (arg_0: RemoveSuperAdminArgs) => Promise<
      RemoveSuperAdminResponse
    >,
  'resend_code' : (arg_0: ResendCodeArgs) => Promise<ResendCodeResponse>,
  'search' : (arg_0: SearchArgs) => Promise<SearchResponse>,
  'set_username' : (arg_0: SetUsernameArgs) => Promise<SetUsernameResponse>,
  'submit_phone_number' : (arg_0: SubmitPhoneNumberArgs) => Promise<
      SubmitPhoneNumberResponse
    >,
  'super_admins' : (arg_0: SuperAdminsArgs) => Promise<SuperAdminsResponse>,
  'update_user_canister_wasm' : (arg_0: UpdateUserCanisterWasmArgs) => Promise<
      UpdateUserCanisterWasmResponse
    >,
  'upgrade_canister' : (arg_0: UpgradeCanisterArgs) => Promise<
      UpgradeCanisterResponse
    >,
  'user' : (arg_0: UserArgs) => Promise<UserResponse>,
  'users' : (arg_0: UsersArgs) => Promise<UsersResponse>,
}
