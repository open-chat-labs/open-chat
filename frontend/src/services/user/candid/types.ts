import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type AccountIdentifier = Uint8Array;
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
  'data' : Uint8Array,
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
  'module' : Uint8Array,
}
export type ChatEvent = { 'MessageReactionRemoved' : UpdatedMessage } |
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
  { 'GroupVisibilityChanged' : GroupVisibilityChanged } |
  { 'Message' : Message } |
  { 'PermissionsChanged' : PermissionsChanged } |
  { 'PollEnded' : PollEnded } |
  { 'GroupInviteCodeChanged' : GroupInviteCodeChanged } |
  { 'ThreadUpdated' : ThreadUpdated } |
  { 'UsersUnblocked' : UsersUnblocked } |
  { 'PollVoteRegistered' : UpdatedMessage } |
  { 'ParticipantLeft' : ParticipantLeft } |
  { 'MessageDeleted' : UpdatedMessage } |
  { 'ParticipantDismissedAsSuperAdmin' : ParticipantDismissedAsSuperAdmin } |
  { 'GroupNameChanged' : GroupNameChanged } |
  { 'RoleChanged' : RoleChanged } |
  { 'PollVoteDeleted' : UpdatedMessage } |
  { 'ProposalsUpdated' : ProposalsUpdated } |
  { 'OwnershipTransferred' : OwnershipTransferred } |
  { 'DirectChatCreated' : DirectChatCreated } |
  { 'MessageEdited' : UpdatedMessage } |
  { 'AvatarChanged' : AvatarChanged } |
  { 'ParticipantsAdded' : ParticipantsAdded };
export interface ChatEventWrapper {
  'event' : ChatEvent,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export type ChatId = CanisterId;
export interface ChatMessagesRead {
  'message_ranges' : Array<MessageIndexRange>,
  'threads' : Array<ThreadRead>,
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
  'proposals' : bigint,
  'reactions' : bigint,
}
export type ChatSummary = { 'Group' : GroupChatSummary } |
  { 'Direct' : DirectChatSummary };
export type ChatSummaryUpdates = { 'Group' : GroupChatSummaryUpdates } |
  { 'Direct' : DirectChatSummaryUpdates };
export interface CompletedCryptoTransaction {
  'to' : CryptoAccountFull,
  'fee' : Tokens,
  'created' : TimestampMillis,
  'token' : Cryptocurrency,
  'transaction_hash' : TransactionHash,
  'block_index' : BlockIndex,
  'from' : CryptoAccountFull,
  'memo' : Memo,
  'amount' : Tokens,
}
export type CompletedCryptoTransactionV2 = {
    'NNS' : NnsCompletedCryptoTransaction
  };
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
export type CreateGroupResponse = { 'NameReserved' : null } |
  { 'DescriptionTooLong' : FieldTooLongResult } |
  { 'NameTooShort' : FieldTooShortResult } |
  { 'Throttled' : null } |
  { 'AvatarTooBig' : FieldTooLongResult } |
  { 'Success' : CreateGroupSuccessResult } |
  { 'NameTooLong' : FieldTooLongResult } |
  { 'NameTaken' : null } |
  { 'MaxGroupsCreated' : number } |
  { 'InternalError' : null };
export interface CreateGroupSuccessResult { 'chat_id' : ChatId }
export type CryptoAccount = { 'Mint' : null } |
  { 'User' : UserId } |
  { 'Account' : AccountIdentifier };
export type CryptoAccountFull = { 'UserIndex' : AccountIdentifier } |
  { 'Mint' : null } |
  { 'User' : [UserId, AccountIdentifier] } |
  { 'Unknown' : AccountIdentifier };
export interface CryptoContent {
  'recipient' : UserId,
  'caption' : [] | [string],
  'transfer' : CryptoTransactionV2,
}
export type CryptoTransaction = { 'Failed' : FailedCryptoTransaction } |
  { 'Completed' : CompletedCryptoTransaction } |
  { 'Pending' : PendingCryptoTransaction };
export type CryptoTransactionV2 = { 'Failed' : FailedCryptoTransactionV2 } |
  { 'Completed' : CompletedCryptoTransactionV2 } |
  { 'Pending' : PendingCryptoTransactionV2 };
export type Cryptocurrency = { 'InternetComputer' : null };
export interface CryptocurrencyContent {
  'caption' : [] | [string],
  'transfer' : CryptoTransaction,
}
export type Cycles = bigint;
export interface CyclesRegistrationFee {
  'recipient' : Principal,
  'valid_until' : TimestampMillis,
  'amount' : Cycles,
}
export interface DeleteGroupArgs { 'chat_id' : ChatId }
export type DeleteGroupResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'InternalError' : string };
export interface DeleteMessagesArgs {
  'user_id' : UserId,
  'message_ids' : Array<MessageId>,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type DeleteMessagesResponse = { 'ChatNotFound' : null } |
  { 'Success' : null };
export interface DeletedContent {
  'timestamp' : TimestampMillis,
  'deleted_by' : UserId,
}
export type DirectChatCreated = {};
export interface DirectChatEventWrapper {
  'event' : ChatEvent,
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
  'affected_events' : Uint32Array,
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
  'thread_root_message_index' : [] | [MessageIndex],
}
export interface EditMessageArgs {
  'content' : MessageContent,
  'user_id' : UserId,
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type EditMessageResponse = { 'MessageNotFound' : null } |
  { 'ChatNotFound' : null } |
  { 'Success' : null } |
  { 'UserBlocked' : null };
export type EventIndex = number;
export interface EventsArgs {
  'user_id' : UserId,
  'max_events' : number,
  'ascending' : boolean,
  'thread_root_message_index' : [] | [MessageIndex],
  'start_index' : EventIndex,
}
export interface EventsByIndexArgs {
  'user_id' : UserId,
  'events' : Uint32Array,
  'thread_root_message_index' : [] | [MessageIndex],
}
export interface EventsRangeArgs {
  'user_id' : UserId,
  'to_index' : EventIndex,
  'from_index' : EventIndex,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type EventsResponse = { 'ChatNotFound' : null } |
  { 'Success' : EventsSuccessResult };
export interface EventsSuccessResult {
  'affected_events' : Array<ChatEventWrapper>,
  'events' : Array<ChatEventWrapper>,
}
export interface EventsWindowArgs {
  'mid_point' : MessageIndex,
  'user_id' : UserId,
  'max_events' : number,
  'thread_root_message_index' : [] | [MessageIndex],
}
export interface FailedCryptoTransaction {
  'to' : CryptoAccountFull,
  'fee' : Tokens,
  'created' : TimestampMillis,
  'token' : Cryptocurrency,
  'transaction_hash' : TransactionHash,
  'from' : CryptoAccountFull,
  'memo' : Memo,
  'error_message' : string,
  'amount' : Tokens,
}
export type FailedCryptoTransactionV2 = { 'NNS' : NnsFailedCryptoTransaction };
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
export interface GovernanceProposalsSubtype {
  'is_nns' : boolean,
  'governance_canister_id' : CanisterId,
}
export interface GroupChatCreated {
  'name' : string,
  'description' : string,
  'created_by' : UserId,
}
export interface GroupChatSummary {
  'is_public' : boolean,
  'permissions' : GroupPermissions,
  'metrics' : ChatMetrics,
  'subtype' : [] | [GroupSubtype],
  'min_visible_event_index' : EventIndex,
  'name' : string,
  'role' : Role,
  'wasm_version' : Version,
  'notifications_muted' : boolean,
  'description' : string,
  'last_updated' : TimestampMillis,
  'read_by_me' : Array<MessageIndexRange>,
  'owner_id' : UserId,
  'joined' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'latest_threads' : Array<ThreadSyncDetails>,
  'latest_event_index' : EventIndex,
  'history_visible_to_new_joiners' : boolean,
  'min_visible_message_index' : MessageIndex,
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'participant_count' : number,
  'my_metrics' : ChatMetrics,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface GroupChatSummaryUpdates {
  'is_public' : [] | [boolean],
  'permissions' : [] | [GroupPermissions],
  'metrics' : [] | [ChatMetrics],
  'subtype' : GroupSubtypeUpdate,
  'name' : [] | [string],
  'role' : [] | [Role],
  'wasm_version' : [] | [Version],
  'affected_events' : Uint32Array,
  'notifications_muted' : [] | [boolean],
  'description' : [] | [string],
  'last_updated' : TimestampMillis,
  'read_by_me' : [] | [Array<MessageIndexRange>],
  'owner_id' : [] | [UserId],
  'avatar_id' : AvatarIdUpdate,
  'latest_threads' : Array<ThreadSyncDetails>,
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
export interface GroupDescriptionChanged {
  'new_description' : string,
  'previous_description' : string,
  'changed_by' : UserId,
}
export type GroupInviteCodeChange = { 'Enabled' : null } |
  { 'Disabled' : null } |
  { 'Reset' : null };
export interface GroupInviteCodeChanged {
  'changed_by' : UserId,
  'change' : GroupInviteCodeChange,
}
export interface GroupMessageNotification {
  'hide' : boolean,
  'mentioned' : Array<User>,
  'sender' : UserId,
  'message' : MessageEventWrapper,
  'sender_name' : string,
  'chat_id' : ChatId,
  'thread_root_message_index' : [] | [MessageIndex],
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
  'invite_users' : PermissionRole,
  'change_roles' : PermissionRole,
  'add_members' : PermissionRole,
  'create_polls' : PermissionRole,
  'pin_messages' : PermissionRole,
  'reply_in_thread' : PermissionRole,
  'react_to_messages' : PermissionRole,
}
export interface GroupReplyContext { 'event_index' : EventIndex }
export type GroupSubtype = {
    'GovernanceProposals' : GovernanceProposalsSubtype
  };
export type GroupSubtypeUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : GroupSubtype };
export interface GroupVisibilityChanged {
  'changed_by' : UserId,
  'now_public' : boolean,
}
export type ICP = Tokens;
export interface ICPRegistrationFee {
  'recipient' : AccountIdentifier,
  'valid_until' : TimestampMillis,
  'amount' : ICP,
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
export interface InitUserPrincipalMigrationArgs { 'new_principal' : Principal }
export type InitUserPrincipalMigrationResponse = { 'Success' : null };
export type InitialStateArgs = {};
export type InitialStateResponse = {
    'Success' : {
      'cycles_balance' : Cycles,
      'user_canister_wasm_version' : Version,
      'upgrades_in_progress' : Array<ChatId>,
      'chats' : Array<ChatSummary>,
      'blocked_users' : Array<UserId>,
      'timestamp' : TimestampMillis,
      'pinned_chats' : Array<ChatId>,
    }
  } |
  { 'InternalError' : string };
export type InvalidPollReason = { 'DuplicateOptions' : null } |
  { 'TooFewOptions' : number } |
  { 'TooManyOptions' : number } |
  { 'OptionTooLong' : number } |
  { 'EndDateInThePast' : null } |
  { 'PollsNotValidForDirectChats' : null };
export interface JoinGroupArgs {
  'invite_code' : [] | [bigint],
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
  'thread_root_message_index' : [] | [MessageIndex],
  'mentioned_by' : UserId,
  'message_index' : MessageIndex,
}
export interface Message {
  'forwarded' : boolean,
  'content' : MessageContent,
  'edited' : boolean,
  'sender' : UserId,
  'thread_summary' : [] | [ThreadSummary],
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
  { 'GovernanceProposal' : ProposalContent } |
  { 'Cryptocurrency' : CryptocurrencyContent } |
  { 'Audio' : AudioContent } |
  { 'Crypto' : CryptoContent } |
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
  'messages' : Uint32Array,
  'user_id' : UserId,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type MessagesByMessageIndexResponse = { 'ChatNotFound' : null } |
  {
    'Success' : {
      'messages' : Array<MessageEventWrapper>,
      'latest_event_index' : EventIndex,
    }
  };
export type MigrateUserPrincipalArgs = {};
export type MigrateUserPrincipalResponse = { 'PrincipalAlreadyInUse' : null } |
  { 'MigrationAlreadyInProgress' : null } |
  { 'Success' : null } |
  { 'InternalError' : string } |
  { 'MigrationNotInitialized' : null };
export type Milliseconds = bigint;
export interface MuteNotificationsArgs { 'chat_id' : ChatId }
export type MuteNotificationsResponse = { 'ChatNotFound' : null } |
  { 'Success' : null } |
  { 'InternalError' : string };
export interface NnsCompletedCryptoTransaction {
  'to' : NnsCryptoAccount,
  'fee' : Tokens,
  'created' : TimestampMillis,
  'token' : Cryptocurrency,
  'transaction_hash' : TransactionHash,
  'block_index' : BlockIndex,
  'from' : NnsCryptoAccount,
  'memo' : Memo,
  'amount' : Tokens,
}
export type NnsCryptoAccount = { 'Mint' : null } |
  { 'Account' : AccountIdentifier };
export interface NnsFailedCryptoTransaction {
  'to' : NnsCryptoAccount,
  'fee' : Tokens,
  'created' : TimestampMillis,
  'token' : Cryptocurrency,
  'transaction_hash' : TransactionHash,
  'from' : NnsCryptoAccount,
  'memo' : Memo,
  'error_message' : string,
  'amount' : Tokens,
}
export type NnsNeuronId = bigint;
export interface NnsPendingCryptoTransaction {
  'to' : NnsCryptoAccount,
  'fee' : [] | [Tokens],
  'token' : Cryptocurrency,
  'memo' : [] | [Memo],
  'amount' : Tokens,
}
export interface NnsProposal {
  'id' : ProposalId,
  'url' : string,
  'status' : ProposalDecisionStatus,
  'tally' : Tally,
  'title' : string,
  'created' : TimestampMillis,
  'topic' : number,
  'last_updated' : TimestampMillis,
  'deadline' : TimestampMillis,
  'reward_status' : ProposalRewardStatus,
  'summary' : string,
  'proposer' : NnsNeuronId,
}
export type Notification = {
    'DirectMessageNotification' : DirectMessageNotification
  } |
  { 'GroupMessageNotification' : GroupMessageNotification } |
  { 'AddedToGroupNotification' : AddedToGroupNotification };
export interface NotificationEnvelope {
  'notification' : Notification,
  'recipients' : Array<UserId>,
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
export interface PendingCryptoTransaction {
  'to' : CryptoAccount,
  'fee' : [] | [Tokens],
  'token' : Cryptocurrency,
  'memo' : [] | [Memo],
  'amount' : Tokens,
}
export type PendingCryptoTransactionV2 = {
    'NNS' : NnsPendingCryptoTransaction
  };
export interface PendingCryptoTransfer {
  'to' : UserId,
  'fee' : [] | [Tokens],
  'token' : Cryptocurrency,
  'memo' : [] | [Memo],
  'amount' : Tokens,
}
export type PermissionRole = { 'Owner' : null } |
  { 'Admins' : null } |
  { 'Members' : null };
export interface PermissionsChanged {
  'changed_by' : UserId,
  'old_permissions' : GroupPermissions,
  'new_permissions' : GroupPermissions,
}
export interface PinChatRequest { 'chat_id' : ChatId }
export type PinChatResponse = { 'Success' : null } |
  { 'PinnedLimitReached' : number };
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
export interface PollVotes { 'total' : TotalPollVotes, 'user' : Uint32Array }
export type Proposal = { 'NNS' : NnsProposal } |
  { 'SNS' : SnsProposal };
export interface ProposalContent {
  'my_vote' : [] | [boolean],
  'governance_canister_id' : CanisterId,
  'proposal' : Proposal,
}
export type ProposalDecisionStatus = { 'Failed' : null } |
  { 'Open' : null } |
  { 'Rejected' : null } |
  { 'Executed' : null } |
  { 'Adopted' : null } |
  { 'Unspecified' : null };
export type ProposalId = bigint;
export type ProposalRewardStatus = { 'ReadyToSettle' : null } |
  { 'AcceptVotes' : null } |
  { 'Unspecified' : null } |
  { 'Settled' : null };
export interface ProposalUpdated {
  'event_index' : EventIndex,
  'message_index' : MessageIndex,
}
export interface ProposalsUpdated { 'proposals' : Array<ProposalUpdated> }
export interface PublicGroupSummary {
  'is_public' : boolean,
  'subtype' : [] | [GroupSubtype],
  'name' : string,
  'wasm_version' : Version,
  'description' : string,
  'last_updated' : TimestampMillis,
  'owner_id' : UserId,
  'avatar_id' : [] | [bigint],
  'latest_event_index' : EventIndex,
  'chat_id' : ChatId,
  'participant_count' : number,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface PublicProfile {
  'bio' : string,
  'is_premium' : boolean,
  'created' : TimestampMillis,
  'username' : string,
  'avatar_id' : [] | [bigint],
  'phone_is_verified' : boolean,
}
export type PublicProfileArgs = {};
export type PublicProfileResponse = { 'Success' : PublicProfile };
export interface RecommendedGroupsArgs { 'count' : number }
export type RecommendedGroupsResponse = {
    'Success' : RecommendedGroupsSuccessResult
  } |
  { 'InternalError' : string };
export interface RecommendedGroupsSuccessResult {
  'groups' : Array<PublicGroupSummary>,
}
export type RegistrationFee = { 'ICP' : ICPRegistrationFee } |
  { 'Cycles' : CyclesRegistrationFee };
export interface RelinquishGroupSuperAdminArgs { 'chat_id' : ChatId }
export type RelinquishGroupSuperAdminResponse = { 'CallerNotInGroup' : null } |
  { 'Success' : null } |
  { 'NotSuperAdmin' : null } |
  { 'InternalError' : string };
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
  'forwarding' : boolean,
  'sender_name' : string,
  'message_id' : MessageId,
  'replies_to' : [] | [ReplyContext],
  'thread_root_message_index' : [] | [MessageIndex],
}
export type SendMessageResponse = { 'TextTooLong' : number } |
  { 'TransferLimitExceeded' : bigint } |
  {
    'TransferSuccessV2' : {
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptoTransactionV2,
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
      'transfer' : CompletedCryptoTransaction,
      'message_index' : MessageIndex,
    }
  };
export interface SetAvatarArgs { 'avatar' : [] | [Avatar] }
export type SetAvatarResponse = { 'AvatarTooBig' : FieldTooLongResult } |
  { 'Success' : null };
export interface SetBioArgs { 'text' : string }
export type SetBioResponse = { 'TooLong' : FieldTooLongResult } |
  { 'Success' : null };
export type SnsNeuronId = Uint8Array;
export interface SnsProposal {
  'id' : ProposalId,
  'url' : string,
  'status' : ProposalDecisionStatus,
  'tally' : Tally,
  'title' : string,
  'created' : TimestampMillis,
  'action' : bigint,
  'last_updated' : TimestampMillis,
  'deadline' : TimestampMillis,
  'reward_status' : ProposalRewardStatus,
  'summary' : string,
  'proposer' : SnsNeuronId,
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
export interface Tally { 'no' : bigint, 'yes' : bigint, 'total' : bigint }
export interface TextContent { 'text' : string }
export interface ThreadRead {
  'root_message_index' : MessageIndex,
  'read_up_to' : MessageIndex,
}
export interface ThreadSummary {
  'latest_event_timestamp' : TimestampMillis,
  'participant_ids' : Array<UserId>,
  'reply_count' : number,
  'latest_event_index' : EventIndex,
}
export interface ThreadSyncDetails {
  'root_message_index' : MessageIndex,
  'last_updated' : TimestampMillis,
  'read_up_to' : [] | [MessageIndex],
  'latest_event' : [] | [EventIndex],
  'latest_message' : [] | [MessageIndex],
}
export interface ThreadUpdated {
  'latest_thread_message_index_if_updated' : [] | [MessageIndex],
  'event_index' : EventIndex,
  'message_index' : MessageIndex,
}
export type TimestampMillis = bigint;
export type TimestampNanos = bigint;
export interface ToggleReactionArgs {
  'user_id' : UserId,
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
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
export type TransactionHash = Uint8Array;
export interface TransferCryptoWithinGroupArgs {
  'content' : CryptoContent,
  'recipient' : UserId,
  'mentioned' : Array<User>,
  'group_id' : ChatId,
  'sender_name' : string,
  'message_id' : MessageId,
  'replies_to' : [] | [GroupReplyContext],
}
export type TransferCryptoWithinGroupResponse = { 'TextTooLong' : number } |
  { 'TransferLimitExceeded' : Tokens } |
  { 'CallerNotInGroup' : [] | [CompletedCryptoTransactionV2] } |
  { 'TransferCannotBeZero' : null } |
  {
    'Success' : {
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptoTransactionV2,
      'message_index' : MessageIndex,
    }
  } |
  { 'RecipientBlocked' : null } |
  { 'InvalidRequest' : string } |
  { 'TransferFailed' : string } |
  { 'InternalError' : [string, CompletedCryptoTransactionV2] } |
  { 'CryptocurrencyNotSupported' : Cryptocurrency };
export interface UnblockUserArgs { 'user_id' : UserId }
export type UnblockUserResponse = { 'Success' : null };
export interface UnmuteNotificationsArgs { 'chat_id' : ChatId }
export type UnmuteNotificationsResponse = { 'ChatNotFound' : null } |
  { 'Success' : null } |
  { 'InternalError' : string };
export interface UnpinChatRequest { 'chat_id' : ChatId }
export type UnpinChatResponse = { 'Success' : null };
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
      'chats_updated' : Array<ChatSummaryUpdates>,
      'blocked_users' : Array<UserId>,
      'blocked_users_v2' : [] | [Array<UserId>],
      'chats_added' : Array<ChatSummary>,
      'avatar_id' : AvatarIdUpdate,
      'chats_removed' : Array<ChatId>,
      'timestamp' : TimestampMillis,
      'pinned_chats' : [] | [Array<ChatId>],
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
export interface WithdrawCryptoArgs {
  'withdrawal' : PendingCryptoTransactionV2,
}
export type WithdrawCryptoResponse = { 'CurrencyNotSupported' : null } |
  { 'TransactionFailed' : FailedCryptoTransactionV2 } |
  { 'Success' : CompletedCryptoTransactionV2 };
export interface _SERVICE {
  'add_recommended_group_exclusions' : ActorMethod<
    [AddRecommendedGroupExclusionsArgs],
    AddRecommendedGroupExclusionsResponse,
  >,
  'assume_group_super_admin' : ActorMethod<
    [AssumeGroupSuperAdminArgs],
    AssumeGroupSuperAdminResponse,
  >,
  'bio' : ActorMethod<[BioArgs], BioResponse>,
  'block_user' : ActorMethod<[BlockUserArgs], BlockUserResponse>,
  'create_group' : ActorMethod<[CreateGroupArgs], CreateGroupResponse>,
  'delete_group' : ActorMethod<[DeleteGroupArgs], DeleteGroupResponse>,
  'delete_messages' : ActorMethod<[DeleteMessagesArgs], DeleteMessagesResponse>,
  'edit_message' : ActorMethod<[EditMessageArgs], EditMessageResponse>,
  'events' : ActorMethod<[EventsArgs], EventsResponse>,
  'events_by_index' : ActorMethod<[EventsByIndexArgs], EventsResponse>,
  'events_range' : ActorMethod<[EventsRangeArgs], EventsResponse>,
  'events_window' : ActorMethod<[EventsWindowArgs], EventsResponse>,
  'init_user_principal_migration' : ActorMethod<
    [InitUserPrincipalMigrationArgs],
    InitUserPrincipalMigrationResponse,
  >,
  'initial_state' : ActorMethod<[InitialStateArgs], InitialStateResponse>,
  'join_group_v2' : ActorMethod<[JoinGroupArgs], JoinGroupResponse>,
  'leave_group' : ActorMethod<[LeaveGroupArgs], LeaveGroupResponse>,
  'mark_read' : ActorMethod<[MarkReadArgs], MarkReadResponse>,
  'messages_by_message_index' : ActorMethod<
    [MessagesByMessageIndexArgs],
    MessagesByMessageIndexResponse,
  >,
  'migrate_user_principal' : ActorMethod<
    [MigrateUserPrincipalArgs],
    MigrateUserPrincipalResponse,
  >,
  'mute_notifications' : ActorMethod<
    [MuteNotificationsArgs],
    MuteNotificationsResponse,
  >,
  'pin_chat' : ActorMethod<[PinChatRequest], PinChatResponse>,
  'public_profile' : ActorMethod<[PublicProfileArgs], PublicProfileResponse>,
  'recommended_groups' : ActorMethod<
    [RecommendedGroupsArgs],
    RecommendedGroupsResponse,
  >,
  'relinquish_group_super_admin' : ActorMethod<
    [RelinquishGroupSuperAdminArgs],
    RelinquishGroupSuperAdminResponse,
  >,
  'search_all_messages' : ActorMethod<
    [SearchAllMessagesArgs],
    SearchAllMessagesResponse,
  >,
  'search_messages' : ActorMethod<[SearchMessagesArgs], SearchMessagesResponse>,
  'send_message' : ActorMethod<[SendMessageArgs], SendMessageResponse>,
  'set_avatar' : ActorMethod<[SetAvatarArgs], SetAvatarResponse>,
  'set_bio' : ActorMethod<[SetBioArgs], SetBioResponse>,
  'toggle_reaction' : ActorMethod<[ToggleReactionArgs], ToggleReactionResponse>,
  'transfer_crypto_within_group_v2' : ActorMethod<
    [TransferCryptoWithinGroupArgs],
    TransferCryptoWithinGroupResponse,
  >,
  'unblock_user' : ActorMethod<[UnblockUserArgs], UnblockUserResponse>,
  'unmute_notifications' : ActorMethod<
    [UnmuteNotificationsArgs],
    UnmuteNotificationsResponse,
  >,
  'unpin_chat' : ActorMethod<[UnpinChatRequest], UnpinChatResponse>,
  'updates' : ActorMethod<[UpdatesArgs], UpdatesResponse>,
  'withdraw_crypto_v2' : ActorMethod<
    [WithdrawCryptoArgs],
    WithdrawCryptoResponse,
  >,
}
