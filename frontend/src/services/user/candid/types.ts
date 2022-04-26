import type { Principal } from '@dfinity/principal';
export type AccountIdentifier = Array<number>;
export interface AddRecommendedGroupExclusionsArgs {
  'duration' : [] | [Milliseconds],
  'groups' : Array<ChatId>,
}
export type AddRecommendedGroupExclusionsResponse = { 'Success' : null };
export interface AddedToGroupNotification {
  'added_by_name' : string,
  'added_by' : UserId,
  'chat_id' : ChatId,
  'group_name' : string,
}
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
export interface AssumeGroupSuperAdminArgs { 'chat_id' : ChatId }
export type AssumeGroupSuperAdminResponse = { 'AlreadyOwner' : null } |
  { 'CallerNotInGroup' : null } |
  { 'Success' : null } |
  { 'NotSuperAdmin' : null } |
  { 'InternalError' : string } |
  { 'AlreadySuperAdmin' : null };
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
  'new_avatar' : [] | [bigint],
}
export type AvatarIdUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : bigint };
export type AvatarUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : Avatar };
export type BioArgs = {};
export type BioResponse = { 'Success' : string };
export interface BlobReference {
  'blob_id' : bigint,
  'canister_id' : CanisterId,
}
export type BlockIndex = bigint;
export interface BlockUserArgs { 'user_id' : UserId }
export type BlockUserResponse = { 'Success' : null };
export type CanisterId = Principal;
export type CanisterUpgradeStatus = { 'NotRequired' : null } |
  { 'InProgress' : null };
export interface CanisterWasm {
  'compressed' : boolean,
  'version' : Version,
  'module' : Array<number>,
}
export type ChatId = CanisterId;
export interface ChatMessagesRead {
  'message_ranges' : Array<MessageIndexRange>,
  'chat_id' : ChatId,
}
export interface ChatMetrics {
  'audio_messages' : bigint,
  'cycles_messages' : bigint,
  'edits' : bigint,
  'icp_messages' : bigint,
  'last_active' : TimestampMillis,
  'giphy_messages' : bigint,
  'deleted_messages' : bigint,
  'file_messages' : bigint,
  'poll_votes' : bigint,
  'text_messages' : bigint,
  'image_messages' : bigint,
  'replies' : bigint,
  'video_messages' : bigint,
  'polls' : bigint,
  'reactions' : bigint,
}
export type ChatSummary = { 'Group' : GroupChatSummary } |
  { 'Direct' : DirectChatSummary };
export type ChatSummaryUpdates = { 'Group' : GroupChatSummaryUpdates } |
  { 'Direct' : DirectChatSummaryUpdates };
export interface CompletedCryptocurrencyDepositV2 {
  'fee' : Tokens,
  'token' : CryptocurrencyV2,
  'block_index' : BlockIndex,
  'memo' : Memo,
  'from_address' : AccountIdentifier,
  'amount' : Tokens,
}
export type CompletedCryptocurrencyTransfer = { 'ICP' : CompletedICPTransfer } |
  { 'Cycles' : CompletedCyclesTransfer };
export interface CompletedCryptocurrencyTransferV2 {
  'fee' : Tokens,
  'token' : CryptocurrencyV2,
  'transaction_hash' : TransactionHash,
  'block_index' : BlockIndex,
  'memo' : Memo,
  'recipient' : UserId,
  'sender' : UserId,
  'amount' : Tokens,
}
export type CompletedCryptocurrencyWithdrawal = {
    'ICP' : CompletedICPWithdrawal
  } |
  { 'Cycles' : CompletedCyclesWithdrawal };
export interface CompletedCryptocurrencyWithdrawalV2 {
  'to' : AccountIdentifier,
  'fee' : Tokens,
  'token' : CryptocurrencyV2,
  'transaction_hash' : TransactionHash,
  'block_index' : BlockIndex,
  'memo' : Memo,
  'amount' : Tokens,
}
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
  'fee' : ICP,
  'block_index' : BlockIndex,
  'memo' : Memo,
  'from_address' : AccountIdentifier,
  'amount' : ICP,
}
export interface CompletedICPTransfer {
  'fee' : ICP,
  'transaction_hash' : TransactionHash,
  'block_index' : BlockIndex,
  'memo' : Memo,
  'recipient' : UserId,
  'sender' : UserId,
  'amount' : ICP,
}
export interface CompletedICPWithdrawal {
  'to' : AccountIdentifier,
  'fee' : ICP,
  'transaction_hash' : TransactionHash,
  'block_index' : BlockIndex,
  'memo' : Memo,
  'amount' : ICP,
}
export interface ConfirmationCodeSms {
  'confirmation_code' : string,
  'phone_number' : string,
}
export interface CreateGroupArgs {
  'is_public' : boolean,
  'permissions' : [] | [GroupPermissions],
  'name' : string,
  'description' : string,
  'history_visible_to_new_joiners' : boolean,
  'avatar' : [] | [Avatar],
}
export type CreateGroupResponse = {
    'DescriptionTooLong' : FieldTooLongResult
  } |
  { 'NameTooShort' : FieldTooShortResult } |
  { 'Throttled' : null } |
  { 'AvatarTooBig' : FieldTooLongResult } |
  { 'Success' : CreateGroupSuccessResult } |
  { 'NameTooLong' : FieldTooLongResult } |
  { 'NameTaken' : null } |
  { 'MaxGroupsCreated' : number } |
  { 'InternalError' : null };
export interface CreateGroupSuccessResult { 'chat_id' : ChatId }
export type Cryptocurrency = { 'ICP' : null } |
  { 'Cycles' : null };
export type CryptocurrencyAccount = { 'ICP' : AccountIdentifier } |
  { 'Cycles' : CanisterId };
export interface CryptocurrencyContent {
  'caption' : [] | [string],
  'transfer' : CryptocurrencyTransfer,
}
export interface CryptocurrencyContentV2 {
  'caption' : [] | [string],
  'transfer' : CryptocurrencyTransferV2,
}
export type CryptocurrencyDeposit = { 'ICP' : ICPDeposit } |
  { 'Cycles' : CyclesDeposit };
export type CryptocurrencyDepositV2 = {
    'Completed' : CompletedCryptocurrencyDepositV2
  };
export type CryptocurrencyTransaction = {
    'Deposit' : CryptocurrencyDepositV2
  } |
  { 'Withdrawal' : CryptocurrencyWithdrawalV2 } |
  { 'Transfer' : CryptocurrencyTransferV2 };
export type CryptocurrencyTransfer = { 'ICP' : ICPTransfer } |
  { 'Cycles' : CyclesTransfer };
export type CryptocurrencyTransferV2 = {
    'Failed' : FailedCryptocurrencyTransferV2
  } |
  { 'Completed' : CompletedCryptocurrencyTransferV2 } |
  { 'Pending' : PendingCryptocurrencyTransferV2 };
export type CryptocurrencyV2 = { 'InternetComputer' : null };
export type CryptocurrencyWithdrawal = { 'ICP' : ICPWithdrawal } |
  { 'Cycles' : CyclesWithdrawal };
export type CryptocurrencyWithdrawalV2 = {
    'Failed' : FailedCryptocurrencyWithdrawalV2
  } |
  { 'Completed' : CompletedCryptocurrencyWithdrawalV2 } |
  { 'Pending' : PendingCryptocurrencyWithdrawalV2 };
export type Cycles = bigint;
export type CyclesDeposit = { 'Completed' : CompletedCyclesDeposit };
export interface CyclesRegistrationFee {
  'recipient' : Principal,
  'valid_until' : TimestampMillis,
  'amount' : Cycles,
}
export type CyclesTransfer = { 'Failed' : FailedCyclesTransfer } |
  { 'Completed' : CompletedCyclesTransfer } |
  { 'Pending' : PendingCyclesTransfer };
export type CyclesWithdrawal = { 'Failed' : FailedCyclesWithdrawal } |
  { 'Completed' : CompletedCyclesWithdrawal } |
  { 'Pending' : PendingCyclesWithdrawal };
export interface DeleteMessagesArgs {
  'user_id' : UserId,
  'message_ids' : Array<MessageId>,
}
export type DeleteMessagesResponse = { 'ChatNotFound' : null } |
  { 'Success' : null };
export interface DeletedContent {
  'timestamp' : TimestampMillis,
  'deleted_by' : UserId,
}
export type DirectChatCreated = {};
export type DirectChatEvent = { 'MessageReactionRemoved' : UpdatedMessage } |
  { 'MessageReactionAdded' : UpdatedMessage } |
  { 'Message' : Message } |
  { 'PollEnded' : PollEnded } |
  { 'PollVoteRegistered' : UpdatedMessage } |
  { 'MessageDeleted' : UpdatedMessage } |
  { 'PollVoteDeleted' : UpdatedMessage } |
  { 'DirectChatCreated' : DirectChatCreated } |
  { 'MessageEdited' : UpdatedMessage };
export interface DirectChatEventWrapper {
  'event' : DirectChatEvent,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export interface DirectChatSummary {
  'date_created' : TimestampMillis,
  'metrics' : ChatMetrics,
  'them' : UserId,
  'notifications_muted' : boolean,
  'read_by_me' : Array<MessageIndexRange>,
  'latest_event_index' : EventIndex,
  'read_by_them' : Array<MessageIndexRange>,
  'my_metrics' : ChatMetrics,
  'latest_message' : MessageEventWrapper,
}
export interface DirectChatSummaryUpdates {
  'metrics' : [] | [ChatMetrics],
  'affected_events' : Array<EventIndex>,
  'notifications_muted' : [] | [boolean],
  'read_by_me' : [] | [Array<MessageIndexRange>],
  'latest_event_index' : [] | [EventIndex],
  'chat_id' : ChatId,
  'read_by_them' : [] | [Array<MessageIndexRange>],
  'my_metrics' : [] | [ChatMetrics],
  'latest_message' : [] | [MessageEventWrapper],
}
export interface DirectMessageNotification {
  'sender' : UserId,
  'message' : MessageEventWrapper,
  'sender_name' : string,
}
export interface DismissAlertsArgs { 'alert_ids' : Array<string> }
export type DismissAlertsResponse = { 'PartialSuccess' : Array<string> } |
  { 'Success' : null };
export interface EditMessageArgs {
  'content' : MessageContent,
  'user_id' : UserId,
  'message_id' : MessageId,
}
export type EditMessageResponse = { 'MessageNotFound' : null } |
  { 'ChatNotFound' : null } |
  { 'Success' : null } |
  { 'UserBlocked' : null };
export type EventIndex = number;
export interface EventsArgs {
  'user_id' : UserId,
  'max_messages' : number,
  'max_events' : number,
  'ascending' : boolean,
  'start_index' : EventIndex,
}
export interface EventsByIndexArgs {
  'user_id' : UserId,
  'events' : Array<EventIndex>,
}
export interface EventsRangeArgs {
  'user_id' : UserId,
  'to_index' : EventIndex,
  'from_index' : EventIndex,
}
export type EventsResponse = { 'ChatNotFound' : null } |
  { 'Success' : EventsSuccessResult };
export interface EventsSuccessResult {
  'affected_events' : Array<DirectChatEventWrapper>,
  'events' : Array<DirectChatEventWrapper>,
}
export interface EventsWindowArgs {
  'mid_point' : MessageIndex,
  'user_id' : UserId,
  'max_messages' : number,
  'max_events' : number,
}
export interface FailedCryptocurrencyTransferV2 {
  'fee' : Tokens,
  'token' : CryptocurrencyV2,
  'memo' : Memo,
  'error_message' : string,
  'recipient' : UserId,
  'amount' : Tokens,
}
export type FailedCryptocurrencyWithdrawal = { 'ICP' : FailedICPWithdrawal } |
  { 'Cycles' : FailedCyclesWithdrawal };
export interface FailedCryptocurrencyWithdrawalV2 {
  'to' : AccountIdentifier,
  'fee' : Tokens,
  'token' : CryptocurrencyV2,
  'memo' : Memo,
  'error_message' : string,
  'amount' : Tokens,
}
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
  'fee' : ICP,
  'memo' : Memo,
  'error_message' : string,
  'recipient' : UserId,
  'amount' : ICP,
}
export interface FailedICPWithdrawal {
  'to' : AccountIdentifier,
  'fee' : ICP,
  'memo' : Memo,
  'error_message' : string,
  'amount' : ICP,
}
export type FallbackRole = { 'Participant' : null } |
  { 'Admin' : null };
export interface FieldTooLongResult {
  'length_provided' : number,
  'max_length' : number,
}
export interface FieldTooShortResult {
  'length_provided' : number,
  'min_length' : number,
}
export interface FileContent {
  'name' : string,
  'mime_type' : string,
  'file_size' : number,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
}
export interface GiphyContent {
  'title' : string,
  'desktop' : GiphyImageVariant,
  'caption' : [] | [string],
  'mobile' : GiphyImageVariant,
}
export interface GiphyImageVariant {
  'url' : string,
  'height' : number,
  'mime_type' : string,
  'width' : number,
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
  { 'MessagePinned' : MessagePinned } |
  { 'UsersBlocked' : UsersBlocked } |
  { 'MessageUnpinned' : MessageUnpinned } |
  { 'MessageReactionAdded' : UpdatedMessage } |
  { 'ParticipantsRemoved' : ParticipantsRemoved } |
  { 'ParticipantRelinquishesSuperAdmin' : ParticipantRelinquishesSuperAdmin } |
  { 'Message' : Message } |
  { 'PermissionsChanged' : PermissionsChanged } |
  { 'PollEnded' : PollEnded } |
  { 'UsersUnblocked' : UsersUnblocked } |
  { 'PollVoteRegistered' : UpdatedMessage } |
  { 'ParticipantLeft' : ParticipantLeft } |
  { 'MessageDeleted' : UpdatedMessage } |
  { 'ParticipantDismissedAsSuperAdmin' : ParticipantDismissedAsSuperAdmin } |
  { 'GroupNameChanged' : GroupNameChanged } |
  { 'RoleChanged' : RoleChanged } |
  { 'PollVoteDeleted' : UpdatedMessage } |
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
  'permissions' : GroupPermissions,
  'metrics' : ChatMetrics,
  'min_visible_event_index' : EventIndex,
  'name' : string,
  'role' : Role,
  'wasm_version' : Version,
  'notifications_muted' : boolean,
  'description' : string,
  'last_updated' : TimestampMillis,
  'read_by_me' : Array<MessageIndexRange>,
  'pinned_message' : [] | [MessageIndex],
  'owner_id' : UserId,
  'joined' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'latest_event_index' : EventIndex,
  'min_visible_message_index' : MessageIndex,
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'participant_count' : number,
  'my_metrics' : ChatMetrics,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface GroupChatSummaryUpdates {
  'permissions' : [] | [GroupPermissions],
  'metrics' : [] | [ChatMetrics],
  'name' : [] | [string],
  'role' : [] | [Role],
  'wasm_version' : [] | [Version],
  'affected_events' : Array<EventIndex>,
  'notifications_muted' : [] | [boolean],
  'description' : [] | [string],
  'last_updated' : TimestampMillis,
  'read_by_me' : [] | [Array<MessageIndexRange>],
  'pinned_message' : PinnedMessageUpdate,
  'owner_id' : [] | [UserId],
  'avatar_id' : AvatarIdUpdate,
  'latest_event_index' : [] | [EventIndex],
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'participant_count' : [] | [number],
  'my_metrics' : [] | [ChatMetrics],
  'latest_message' : [] | [MessageEventWrapper],
}
export interface GroupChatUpdatesSince {
  'updates_since' : TimestampMillis,
  'chat_id' : ChatId,
}
export interface GroupDeletedAlert { 'deleted_by' : UserId, 'chat_id' : ChatId }
export interface GroupDescriptionChanged {
  'new_description' : string,
  'previous_description' : string,
  'changed_by' : UserId,
}
export interface GroupMessageNotification {
  'hide' : boolean,
  'mentioned' : Array<User>,
  'sender' : UserId,
  'message' : MessageEventWrapper,
  'sender_name' : string,
  'chat_id' : ChatId,
  'group_name' : string,
}
export interface GroupNameChanged {
  'changed_by' : UserId,
  'new_name' : string,
  'previous_name' : string,
}
export interface GroupPermissions {
  'block_users' : PermissionRole,
  'change_permissions' : PermissionRole,
  'delete_messages' : PermissionRole,
  'send_messages' : PermissionRole,
  'remove_members' : PermissionRole,
  'update_group' : PermissionRole,
  'change_roles' : PermissionRole,
  'add_members' : PermissionRole,
  'create_polls' : PermissionRole,
  'pin_messages' : PermissionRole,
  'react_to_messages' : PermissionRole,
}
export interface GroupReplyContext { 'event_index' : EventIndex }
export type ICP = Tokens;
export type ICPDeposit = { 'Completed' : CompletedICPDeposit };
export interface ICPRegistrationFee {
  'recipient' : AccountIdentifier,
  'valid_until' : TimestampMillis,
  'amount' : ICP,
}
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
export type InitialStateArgs = {};
export type InitialStateResponse = {
    'Success' : {
      'cycles_balance' : Cycles,
      'user_canister_wasm_version' : Version,
      'upgrades_in_progress' : Array<ChatId>,
      'chats' : Array<ChatSummary>,
      'blocked_users' : Array<UserId>,
      'timestamp' : TimestampMillis,
    }
  } |
  { 'InternalError' : string };
export type InvalidPollReason = { 'DuplicateOptions' : null } |
  { 'TooFewOptions' : number } |
  { 'TooManyOptions' : number } |
  { 'OptionTooLong' : number } |
  { 'EndDateInThePast' : null };
export interface JoinGroupArgs {
  'as_super_admin' : boolean,
  'chat_id' : ChatId,
}
export type JoinGroupResponse = { 'Blocked' : null } |
  { 'GroupNotFound' : null } |
  { 'GroupNotPublic' : null } |
  { 'AlreadyInGroup' : null } |
  { 'Success' : GroupChatSummary } |
  { 'NotSuperAdmin' : null } |
  { 'ParticipantLimitReached' : number } |
  { 'InternalError' : string };
export interface LeaveGroupArgs { 'chat_id' : ChatId }
export type LeaveGroupResponse = { 'GroupNotFound' : null } |
  { 'GroupNotPublic' : null } |
  { 'OwnerCannotLeave' : null } |
  { 'CallerNotInGroup' : null } |
  { 'Success' : null } |
  { 'InternalError' : string };
export interface MarkReadArgs { 'messages_read' : Array<ChatMessagesRead> }
export type MarkReadResponse = { 'Success' : null };
export type Memo = bigint;
export interface Mention {
  'message_id' : MessageId,
  'event_index' : EventIndex,
  'mentioned_by' : UserId,
  'message_index' : MessageIndex,
}
export interface Message {
  'forwarded' : boolean,
  'content' : MessageContent,
  'edited' : boolean,
  'sender' : UserId,
  'message_id' : MessageId,
  'replies_to' : [] | [ReplyContext],
  'reactions' : Array<[string, Array<UserId>]>,
  'message_index' : MessageIndex,
}
export type MessageContent = { 'Giphy' : GiphyContent } |
  { 'File' : FileContent } |
  { 'Poll' : PollContent } |
  { 'Text' : TextContent } |
  { 'Image' : ImageContent } |
  { 'CryptocurrencyV2' : CryptocurrencyContentV2 } |
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
export interface MessagePinned {
  'pinned_by' : UserId,
  'message_index' : MessageIndex,
}
export interface MessageUnpinned {
  'due_to_message_deleted' : boolean,
  'unpinned_by' : UserId,
  'message_index' : MessageIndex,
}
export interface MessagesByMessageIndexArgs {
  'messages' : Array<MessageIndex>,
  'user_id' : UserId,
}
export type MessagesByMessageIndexResponse = { 'ChatNotFound' : null } |
  {
    'Success' : {
      'messages' : Array<MessageEventWrapper>,
      'latest_event_index' : EventIndex,
    }
  };
export type Milliseconds = bigint;
export interface MuteNotificationsArgs { 'chat_id' : ChatId }
export type MuteNotificationsResponse = { 'ChatNotFound' : null } |
  { 'Success' : null };
export type NightMode = { 'On' : null } |
  { 'Off' : null } |
  { 'Auto' : null };
export type Notification = {
    'DirectMessageNotification' : DirectMessageNotification
  } |
  { 'GroupMessageNotification' : GroupMessageNotification } |
  { 'AddedToGroupNotification' : AddedToGroupNotification };
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
export interface ParticipantsRemoved {
  'user_ids' : Array<UserId>,
  'removed_by' : UserId,
}
export interface PendingCryptocurrencyTransferV2 {
  'fee' : [] | [Tokens],
  'token' : CryptocurrencyV2,
  'memo' : [] | [Memo],
  'recipient' : UserId,
  'amount' : Tokens,
}
export type PendingCryptocurrencyWithdrawal = { 'ICP' : PendingICPWithdrawal } |
  { 'Cycles' : PendingCyclesWithdrawal };
export interface PendingCryptocurrencyWithdrawalV2 {
  'to' : AccountIdentifier,
  'fee' : [] | [Tokens],
  'token' : CryptocurrencyV2,
  'memo' : [] | [Memo],
  'amount' : Tokens,
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
  'fee' : [] | [ICP],
  'memo' : [] | [Memo],
  'recipient' : UserId,
  'amount' : ICP,
}
export interface PendingICPWithdrawal {
  'to' : AccountIdentifier,
  'fee' : [] | [ICP],
  'memo' : [] | [Memo],
  'amount' : ICP,
}
export type PermissionRole = { 'Owner' : null } |
  { 'Admins' : null } |
  { 'Members' : null };
export interface PermissionsChanged {
  'changed_by' : UserId,
  'old_permissions' : GroupPermissions,
  'new_permissions' : GroupPermissions,
}
export type PinnedMessageUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : MessageIndex };
export interface PollConfig {
  'allow_multiple_votes_per_user' : boolean,
  'text' : [] | [string],
  'show_votes_before_end_date' : boolean,
  'end_date' : [] | [TimestampMillis],
  'anonymous' : boolean,
  'options' : Array<string>,
}
export interface PollContent {
  'votes' : PollVotes,
  'ended' : boolean,
  'config' : PollConfig,
}
export interface PollEnded {
  'event_index' : EventIndex,
  'message_index' : MessageIndex,
}
export interface PollVotes { 'total' : TotalPollVotes, 'user' : Array<number> }
export interface PublicGroupSummary {
  'name' : string,
  'wasm_version' : Version,
  'description' : string,
  'last_updated' : TimestampMillis,
  'pinned_message' : [] | [MessageIndex],
  'owner_id' : UserId,
  'avatar_id' : [] | [bigint],
  'latest_event_index' : EventIndex,
  'chat_id' : ChatId,
  'participant_count' : number,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface RecommendedGroupsArgs { 'count' : number }
export type RecommendedGroupsResponse = {
    'Success' : RecommendedGroupsSuccessResult
  } |
  { 'InternalError' : string };
export interface RecommendedGroupsSuccessResult {
  'groups' : Array<PublicGroupSummary>,
}
export interface RegisterPollVoteArgs {
  'user_id' : UserId,
  'poll_option' : number,
  'operation' : VoteOperation,
  'message_index' : MessageIndex,
}
export type RegisterPollVoteResponse = { 'ChatNotFound' : null } |
  { 'PollEnded' : null } |
  { 'Success' : PollVotes } |
  { 'OptionIndexOutOfRange' : null } |
  { 'PollNotFound' : null };
export type RegistrationFee = { 'ICP' : ICPRegistrationFee } |
  { 'Cycles' : CyclesRegistrationFee };
export interface RelinquishGroupSuperAdminArgs { 'chat_id' : ChatId }
export type RelinquishGroupSuperAdminResponse = { 'CallerNotInGroup' : null } |
  { 'Success' : null } |
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
export type Role = { 'Participant' : null } |
  { 'SuperAdmin' : FallbackRole } |
  { 'Admin' : null } |
  { 'Owner' : null };
export interface RoleChanged {
  'user_ids' : Array<UserId>,
  'changed_by' : UserId,
  'old_role' : Role,
  'new_role' : Role,
}
export interface SearchAllMessagesArgs {
  'max_results' : number,
  'search_term' : string,
}
export type SearchAllMessagesResponse = { 'TermTooShort' : number } |
  { 'Success' : SearchMessagesSuccessResult } |
  { 'TermTooLong' : number } |
  { 'InvalidTerm' : null };
export interface SearchMessagesArgs {
  'max_results' : number,
  'user_id' : UserId,
  'search_term' : string,
}
export type SearchMessagesResponse = { 'TermTooShort' : number } |
  { 'ChatNotFound' : null } |
  { 'Success' : SearchMessagesSuccessResult } |
  { 'TermTooLong' : number } |
  { 'InvalidTerm' : null };
export interface SearchMessagesSuccessResult { 'matches' : Array<MessageMatch> }
export interface SendMessageArgs {
  'content' : MessageContent,
  'recipient' : UserId,
  'sender_name' : string,
  'message_id' : MessageId,
  'replies_to' : [] | [ReplyContext],
}
export type SendMessageResponse = { 'TextTooLong' : number } |
  { 'TransferLimitExceeded' : bigint } |
  {
    'TransferSuccessV2' : {
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptocurrencyTransferV2,
      'message_index' : MessageIndex,
    }
  } |
  { 'TransferCannotBeZero' : null } |
  {
    'Success' : {
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'message_index' : MessageIndex,
    }
  } |
  { 'MessageEmpty' : null } |
  { 'InvalidPoll' : InvalidPollReason } |
  { 'RecipientBlocked' : null } |
  { 'InvalidRequest' : string } |
  { 'TransferFailed' : string } |
  {
    'TransferSuccess' : {
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptocurrencyTransfer,
      'message_index' : MessageIndex,
    }
  };
export interface SetAvatarArgs { 'avatar' : [] | [Avatar] }
export type SetAvatarResponse = { 'AvatarTooBig' : FieldTooLongResult } |
  { 'Success' : null };
export interface SetBioArgs { 'text' : string }
export type SetBioResponse = { 'TooLong' : FieldTooLongResult } |
  { 'Success' : null };
export interface SetPreferencesArgs { 'preferences' : OptionalUserPreferences }
export type SetPreferencesResponse = { 'Success' : null };
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
export interface ToggleReactionArgs {
  'user_id' : UserId,
  'message_id' : MessageId,
  'reaction' : string,
}
export type ToggleReactionResponse = { 'MessageNotFound' : null } |
  { 'ChatNotFound' : null } |
  { 'InvalidReaction' : null } |
  { 'Added' : EventIndex } |
  { 'Removed' : EventIndex };
export interface Tokens { 'e8s' : bigint }
export type TotalPollVotes = { 'Anonymous' : Array<[number, number]> } |
  { 'Visible' : Array<[number, Array<UserId>]> } |
  { 'Hidden' : number };
export type Transaction = { 'Cryptocurrency' : CryptocurrencyTransaction };
export type TransactionHash = Array<number>;
export type TransactionStatus = { 'Failed' : string } |
  { 'Complete' : null } |
  { 'Pending' : null };
export interface TransactionWrapper {
  'transaction' : Transaction,
  'timestamp' : TimestampMillis,
  'index' : number,
}
export interface TransactionsArgs {
  'max_transactions' : number,
  'ascending' : boolean,
  'start_index' : number,
}
export type TransactionsResponse = { 'Success' : TransactionsSuccessResult };
export interface TransactionsSuccessResult {
  'latest_transaction_index' : [] | [number],
  'transactions' : Array<TransactionWrapper>,
}
export interface TransferCryptocurrencyWithinGroupArgs {
  'content' : CryptocurrencyContentV2,
  'recipient' : UserId,
  'mentioned' : Array<User>,
  'group_id' : ChatId,
  'sender_name' : string,
  'message_id' : MessageId,
  'replies_to' : [] | [GroupReplyContext],
}
export type TransferCryptocurrencyWithinGroupResponse = {
    'TextTooLong' : number
  } |
  { 'TransferLimitExceeded' : bigint } |
  { 'CallerNotInGroup' : [] | [CompletedCryptocurrencyTransferV2] } |
  { 'TransferCannotBeZero' : null } |
  {
    'Success' : {
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptocurrencyTransferV2,
      'message_index' : MessageIndex,
    }
  } |
  { 'RecipientBlocked' : null } |
  { 'InvalidRequest' : string } |
  { 'TransferFailed' : string } |
  { 'InternalError' : [string, CompletedCryptocurrencyTransferV2] } |
  { 'CryptocurrencyNotSupported' : Cryptocurrency };
export interface UnblockUserArgs { 'user_id' : UserId }
export type UnblockUserResponse = { 'Success' : null };
export interface UnmuteNotificationsArgs { 'chat_id' : ChatId }
export type UnmuteNotificationsResponse = { 'ChatNotFound' : null } |
  { 'Success' : null };
export interface UpdatedMessage {
  'updated_by' : UserId,
  'message_id' : MessageId,
  'event_index' : EventIndex,
}
export interface UpdatesArgs { 'updates_since' : UpdatesSince }
export type UpdatesResponse = {
    'Success' : {
      'cycles_balance' : [] | [Cycles],
      'user_canister_wasm_version' : [] | [Version],
      'upgrades_in_progress' : Array<ChatId>,
      'alerts' : Array<Alert>,
      'chats_updated' : Array<ChatSummaryUpdates>,
      'blocked_users' : Array<UserId>,
      'chats_added' : Array<ChatSummary>,
      'avatar_id' : AvatarIdUpdate,
      'chats_removed' : Array<ChatId>,
      'timestamp' : TimestampMillis,
    }
  } |
  { 'InternalError' : string };
export interface UpdatesSince {
  'group_chats' : Array<GroupChatUpdatesSince>,
  'timestamp' : TimestampMillis,
}
export interface User { 'username' : string, 'user_id' : UserId }
export type UserId = CanisterId;
export interface UserSummary {
  'username' : string,
  'user_id' : UserId,
  'avatar_id' : [] | [bigint],
  'seconds_since_last_online' : number,
}
export interface UsersBlocked {
  'user_ids' : Array<UserId>,
  'blocked_by' : UserId,
}
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
export type VoteOperation = { 'RegisterVote' : null } |
  { 'DeleteVote' : null };
export interface WithdrawCryptocurrencyRequest {
  'withdrawal' : PendingCryptocurrencyWithdrawalV2,
}
export type WithdrawCryptocurrencyResponse = { 'CurrencyNotSupported' : null } |
  { 'TransactionFailed' : FailedCryptocurrencyWithdrawalV2 } |
  { 'Success' : CompletedCryptocurrencyWithdrawalV2 };
export interface _SERVICE {
  'add_recommended_group_exclusions' : (
      arg_0: AddRecommendedGroupExclusionsArgs,
    ) => Promise<AddRecommendedGroupExclusionsResponse>,
  'assume_group_super_admin' : (arg_0: AssumeGroupSuperAdminArgs) => Promise<
      AssumeGroupSuperAdminResponse
    >,
  'bio' : (arg_0: BioArgs) => Promise<BioResponse>,
  'block_user' : (arg_0: BlockUserArgs) => Promise<BlockUserResponse>,
  'create_group' : (arg_0: CreateGroupArgs) => Promise<CreateGroupResponse>,
  'delete_messages' : (arg_0: DeleteMessagesArgs) => Promise<
      DeleteMessagesResponse
    >,
  'dismiss_alerts' : (arg_0: DismissAlertsArgs) => Promise<
      DismissAlertsResponse
    >,
  'edit_message' : (arg_0: EditMessageArgs) => Promise<EditMessageResponse>,
  'events' : (arg_0: EventsArgs) => Promise<EventsResponse>,
  'events_by_index' : (arg_0: EventsByIndexArgs) => Promise<EventsResponse>,
  'events_range' : (arg_0: EventsRangeArgs) => Promise<EventsResponse>,
  'events_window' : (arg_0: EventsWindowArgs) => Promise<EventsResponse>,
  'initial_state' : (arg_0: InitialStateArgs) => Promise<InitialStateResponse>,
  'join_group_v2' : (arg_0: JoinGroupArgs) => Promise<JoinGroupResponse>,
  'leave_group' : (arg_0: LeaveGroupArgs) => Promise<LeaveGroupResponse>,
  'mark_read' : (arg_0: MarkReadArgs) => Promise<MarkReadResponse>,
  'messages_by_message_index' : (arg_0: MessagesByMessageIndexArgs) => Promise<
      MessagesByMessageIndexResponse
    >,
  'mute_notifications' : (arg_0: MuteNotificationsArgs) => Promise<
      MuteNotificationsResponse
    >,
  'recommended_groups' : (arg_0: RecommendedGroupsArgs) => Promise<
      RecommendedGroupsResponse
    >,
  'register_poll_vote' : (arg_0: RegisterPollVoteArgs) => Promise<
      RegisterPollVoteResponse
    >,
  'relinquish_group_super_admin' : (
      arg_0: RelinquishGroupSuperAdminArgs,
    ) => Promise<RelinquishGroupSuperAdminResponse>,
  'search_all_messages' : (arg_0: SearchAllMessagesArgs) => Promise<
      SearchAllMessagesResponse
    >,
  'search_messages' : (arg_0: SearchMessagesArgs) => Promise<
      SearchMessagesResponse
    >,
  'send_message' : (arg_0: SendMessageArgs) => Promise<SendMessageResponse>,
  'set_avatar' : (arg_0: SetAvatarArgs) => Promise<SetAvatarResponse>,
  'set_bio' : (arg_0: SetBioArgs) => Promise<SetBioResponse>,
  'set_preferences' : (arg_0: SetPreferencesArgs) => Promise<
      SetPreferencesResponse
    >,
  'toggle_reaction' : (arg_0: ToggleReactionArgs) => Promise<
      ToggleReactionResponse
    >,
  'transactions' : (arg_0: TransactionsArgs) => Promise<TransactionsResponse>,
  'transfer_cryptocurrency_within_group' : (
      arg_0: TransferCryptocurrencyWithinGroupArgs,
    ) => Promise<TransferCryptocurrencyWithinGroupResponse>,
  'unblock_user' : (arg_0: UnblockUserArgs) => Promise<UnblockUserResponse>,
  'unmute_notifications' : (arg_0: UnmuteNotificationsArgs) => Promise<
      UnmuteNotificationsResponse
    >,
  'updates' : (arg_0: UpdatesArgs) => Promise<UpdatesResponse>,
  'withdraw_cryptocurrency' : (arg_0: WithdrawCryptocurrencyRequest) => Promise<
      WithdrawCryptocurrencyResponse
    >,
}
