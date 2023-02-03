import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type AccountIdentifier = Uint8Array | number[];
export interface AddSuperAdminArgs { 'user_id' : UserId }
export type AddSuperAdminResponse = { 'Success' : null } |
  { 'InternalError' : string } |
  { 'AlreadySuperAdmin' : null };
export interface AddedToGroupNotification {
  'added_by_name' : string,
  'added_by' : UserId,
  'timestamp' : TimestampMillis,
  'chat_id' : ChatId,
  'group_name' : string,
}
export interface AudioContent {
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
}
export interface Avatar {
  'id' : bigint,
  'data' : Uint8Array | number[],
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
export interface BlobReference {
  'blob_id' : bigint,
  'canister_id' : CanisterId,
}
export type BlockIndex = bigint;
export type CanisterId = Principal;
export type CanisterUpgradeStatus = { 'NotRequired' : null } |
  { 'InProgress' : null };
export interface CanisterWasm {
  'compressed' : boolean,
  'version' : Version,
  'module' : Uint8Array | number[],
}
export interface Challenge { 'key' : ChallengeKey, 'png_base64' : string }
export interface ChallengeAttempt { 'key' : ChallengeKey, 'chars' : string }
export type ChallengeKey = number;
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
  { 'ChatFrozen' : ChatFrozen } |
  { 'PollEnded' : PollEnded } |
  { 'GroupInviteCodeChanged' : GroupInviteCodeChanged } |
  { 'ThreadUpdated' : ThreadUpdated } |
  { 'UsersUnblocked' : UsersUnblocked } |
  { 'ChatUnfrozen' : ChatUnfrozen } |
  { 'PollVoteRegistered' : UpdatedMessage } |
  { 'ParticipantLeft' : ParticipantLeft } |
  { 'MessageDeleted' : UpdatedMessage } |
  { 'GroupRulesChanged' : GroupRulesChanged } |
  { 'ParticipantDismissedAsSuperAdmin' : ParticipantDismissedAsSuperAdmin } |
  { 'GroupNameChanged' : GroupNameChanged } |
  { 'MessageUndeleted' : UpdatedMessage } |
  { 'RoleChanged' : RoleChanged } |
  { 'PollVoteDeleted' : UpdatedMessage } |
  { 'EventsTimeToLiveUpdated' : EventsTimeToLiveUpdated } |
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
  'correlation_id' : bigint,
  'expires_at' : [] | [TimestampMillis],
}
export interface ChatFrozen { 'frozen_by' : UserId, 'reason' : [] | [string] }
export type ChatId = CanisterId;
export interface ChatMetrics {
  'prize_winner_messages' : bigint,
  'audio_messages' : bigint,
  'cycles_messages' : bigint,
  'chat_messages' : bigint,
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
  'sns1_messages' : bigint,
  'polls' : bigint,
  'proposals' : bigint,
  'reported_messages' : bigint,
  'ckbtc_messages' : bigint,
  'reactions' : bigint,
  'prize_messages' : bigint,
}
export type ChatSummary = { 'Group' : GroupChatSummary } |
  { 'Direct' : DirectChatSummary };
export type ChatSummaryUpdates = { 'Group' : GroupChatSummaryUpdates } |
  { 'Direct' : DirectChatSummaryUpdates };
export interface ChatUnfrozen { 'unfrozen_by' : UserId }
export interface CheckUsernameArgs { 'username' : string }
export type CheckUsernameResponse = { 'UsernameTaken' : null } |
  { 'UsernameTooShort' : number } |
  { 'UsernameInvalid' : null } |
  { 'UsernameTooLong' : number } |
  { 'Success' : null };
export type CompletedCryptoTransaction = {
    'NNS' : NnsCompletedCryptoTransaction
  } |
  { 'SNS' : SnsCompletedCryptoTransaction };
export interface ConfirmPhoneNumberArgs { 'confirmation_code' : string }
export type ConfirmPhoneNumberResponse = { 'AlreadyClaimed' : null } |
  { 'Success' : SuccessResult } |
  { 'ConfirmationCodeExpired' : null } |
  { 'ConfirmationCodeIncorrect' : null } |
  { 'UserNotFound' : null };
export interface ConfirmationCodeSms {
  'confirmation_code' : string,
  'phone_number' : string,
}
export type CreateChallengeArgs = {};
export type CreateChallengeResponse = { 'Throttled' : null } |
  { 'Success' : Challenge };
export interface CryptoContent {
  'recipient' : UserId,
  'caption' : [] | [string],
  'transfer' : CryptoTransaction,
}
export type CryptoTransaction = { 'Failed' : FailedCryptoTransaction } |
  { 'Completed' : CompletedCryptoTransaction } |
  { 'Pending' : PendingCryptoTransaction };
export type Cryptocurrency = { 'InternetComputer' : null } |
  { 'CHAT' : null } |
  { 'SNS1' : null } |
  { 'CKBTC' : null };
export type CurrentUserArgs = {};
export type CurrentUserResponse = {
    'Success' : {
      'username' : string,
      'phone_status' : PhoneStatus,
      'wasm_version' : Version,
      'icp_account' : AccountIdentifier,
      'referrals' : Array<UserId>,
      'user_id' : UserId,
      'avatar_id' : [] | [bigint],
      'is_suspected_bot' : boolean,
      'canister_upgrade_status' : CanisterUpgradeStatus,
      'is_super_admin' : boolean,
      'suspension_details' : [] | [SuspensionDetails],
      'open_storage_limit_bytes' : bigint,
    }
  } |
  { 'UserNotFound' : null };
export type Cycles = bigint;
export interface CyclesRegistrationFee {
  'recipient' : Principal,
  'valid_until' : TimestampMillis,
  'amount' : Cycles,
}
export interface DeletedContent {
  'timestamp' : TimestampMillis,
  'deleted_by' : UserId,
}
export type DirectChatCreated = {};
export interface DirectChatEventWrapper {
  'event' : ChatEvent,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
  'correlation_id' : bigint,
  'expires_at' : [] | [TimestampMillis],
}
export interface DirectChatSummary {
  'read_by_them_up_to' : [] | [MessageIndex],
  'date_created' : TimestampMillis,
  'metrics' : ChatMetrics,
  'them' : UserId,
  'notifications_muted' : boolean,
  'events_ttl' : [] | [Milliseconds],
  'latest_event_index' : EventIndex,
  'read_by_me_up_to' : [] | [MessageIndex],
  'expired_messages' : Array<MessageIndexRange>,
  'archived' : boolean,
  'my_metrics' : ChatMetrics,
  'latest_message' : MessageEventWrapper,
}
export interface DirectChatSummaryUpdates {
  'read_by_them_up_to' : [] | [MessageIndex],
  'metrics' : [] | [ChatMetrics],
  'affected_events' : Uint32Array | number[],
  'notifications_muted' : [] | [boolean],
  'events_ttl' : EventsTimeToLiveUpdate,
  'latest_event_index' : [] | [EventIndex],
  'read_by_me_up_to' : [] | [MessageIndex],
  'chat_id' : ChatId,
  'newly_expired_messages' : Array<MessageIndexRange>,
  'archived' : [] | [boolean],
  'my_metrics' : [] | [ChatMetrics],
  'latest_message' : [] | [MessageEventWrapper],
}
export interface DirectMessageNotification {
  'sender' : UserId,
  'message' : MessageEventWrapper,
  'sender_name' : string,
  'thread_root_message_index' : [] | [MessageIndex],
}
export interface DirectReactionAddedNotification {
  'username' : string,
  'them' : UserId,
  'message' : MessageEventWrapper,
  'timestamp' : TimestampMillis,
  'reaction' : string,
}
export type EventIndex = number;
export type EventsTimeToLiveUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : Milliseconds };
export interface EventsTimeToLiveUpdated {
  'new_ttl' : [] | [Milliseconds],
  'updated_by' : UserId,
}
export type FailedCryptoTransaction = { 'NNS' : NnsFailedCryptoTransaction } |
  { 'SNS' : SnsFailedCryptoTransaction };
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
export interface FrozenGroupInfo {
  'timestamp' : TimestampMillis,
  'frozen_by' : UserId,
  'reason' : [] | [string],
}
export type FrozenGroupUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : FrozenGroupInfo };
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
export interface GroupCanisterGroupChatSummary {
  'is_public' : boolean,
  'permissions' : GroupPermissions,
  'metrics' : ChatMetrics,
  'subtype' : [] | [GroupSubtype],
  'date_last_pinned' : [] | [TimestampMillis],
  'min_visible_event_index' : EventIndex,
  'name' : string,
  'role' : Role,
  'wasm_version' : Version,
  'notifications_muted' : boolean,
  'description' : string,
  'events_ttl' : [] | [Milliseconds],
  'last_updated' : TimestampMillis,
  'owner_id' : UserId,
  'joined' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'next_message_expiry' : [] | [TimestampMillis],
  'latest_threads' : Array<GroupCanisterThreadDetails>,
  'frozen' : [] | [FrozenGroupInfo],
  'latest_event_index' : EventIndex,
  'history_visible_to_new_joiners' : boolean,
  'min_visible_message_index' : MessageIndex,
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'expired_messages' : Array<MessageIndexRange>,
  'participant_count' : number,
  'my_metrics' : ChatMetrics,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface GroupCanisterGroupChatSummaryUpdates {
  'is_public' : [] | [boolean],
  'permissions' : [] | [GroupPermissions],
  'metrics' : [] | [ChatMetrics],
  'subtype' : GroupSubtypeUpdate,
  'date_last_pinned' : [] | [TimestampMillis],
  'name' : [] | [string],
  'role' : [] | [Role],
  'wasm_version' : [] | [Version],
  'affected_events' : Uint32Array | number[],
  'notifications_muted' : [] | [boolean],
  'description' : [] | [string],
  'events_ttl' : EventsTimeToLiveUpdate,
  'last_updated' : TimestampMillis,
  'owner_id' : [] | [UserId],
  'avatar_id' : AvatarIdUpdate,
  'next_message_expiry' : TimestampUpdate,
  'latest_threads' : Array<GroupCanisterThreadDetails>,
  'frozen' : FrozenGroupUpdate,
  'latest_event_index' : [] | [EventIndex],
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'affected_events_v2' : Array<[EventIndex, TimestampMillis]>,
  'newly_expired_messages' : Array<MessageIndexRange>,
  'participant_count' : [] | [number],
  'my_metrics' : [] | [ChatMetrics],
  'latest_message' : [] | [MessageEventWrapper],
}
export interface GroupCanisterThreadDetails {
  'root_message_index' : MessageIndex,
  'last_updated' : TimestampMillis,
  'latest_event' : EventIndex,
  'latest_message' : MessageIndex,
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
  'date_last_pinned' : [] | [TimestampMillis],
  'min_visible_event_index' : EventIndex,
  'name' : string,
  'role' : Role,
  'wasm_version' : Version,
  'notifications_muted' : boolean,
  'description' : string,
  'events_ttl' : [] | [Milliseconds],
  'last_updated' : TimestampMillis,
  'owner_id' : UserId,
  'joined' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'next_message_expiry' : [] | [TimestampMillis],
  'latest_threads' : Array<ThreadSyncDetails>,
  'frozen' : [] | [FrozenGroupInfo],
  'latest_event_index' : EventIndex,
  'history_visible_to_new_joiners' : boolean,
  'read_by_me_up_to' : [] | [MessageIndex],
  'min_visible_message_index' : MessageIndex,
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'date_read_pinned' : [] | [TimestampMillis],
  'expired_messages' : Array<MessageIndexRange>,
  'archived' : boolean,
  'participant_count' : number,
  'my_metrics' : ChatMetrics,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface GroupChatSummaryUpdates {
  'is_public' : [] | [boolean],
  'permissions' : [] | [GroupPermissions],
  'metrics' : [] | [ChatMetrics],
  'subtype' : GroupSubtypeUpdate,
  'date_last_pinned' : [] | [TimestampMillis],
  'name' : [] | [string],
  'role' : [] | [Role],
  'wasm_version' : [] | [Version],
  'affected_events' : Uint32Array | number[],
  'notifications_muted' : [] | [boolean],
  'description' : [] | [string],
  'events_ttl' : [] | [Milliseconds],
  'last_updated' : TimestampMillis,
  'owner_id' : [] | [UserId],
  'avatar_id' : AvatarIdUpdate,
  'next_message_expiry' : TimestampUpdate,
  'latest_threads' : Array<ThreadSyncDetails>,
  'frozen' : FrozenGroupUpdate,
  'latest_event_index' : [] | [EventIndex],
  'read_by_me_up_to' : [] | [MessageIndex],
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'date_read_pinned' : [] | [TimestampMillis],
  'expired_messages' : Array<MessageIndexRange>,
  'archived' : [] | [boolean],
  'participant_count' : [] | [number],
  'my_metrics' : [] | [ChatMetrics],
  'latest_message' : [] | [MessageEventWrapper],
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
export interface GroupReactionAddedNotification {
  'added_by_name' : string,
  'added_by' : UserId,
  'message' : MessageEventWrapper,
  'timestamp' : TimestampMillis,
  'chat_id' : ChatId,
  'thread_root_message_index' : [] | [MessageIndex],
  'group_name' : string,
  'reaction' : string,
}
export interface GroupReplyContext { 'event_index' : EventIndex }
export interface GroupRules { 'text' : string, 'enabled' : boolean }
export interface GroupRulesChanged {
  'changed_by' : UserId,
  'enabled' : boolean,
  'prev_enabled' : boolean,
}
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
export interface Icrc1Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
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
export type InvalidPollReason = { 'DuplicateOptions' : null } |
  { 'TooFewOptions' : number } |
  { 'TooManyOptions' : number } |
  { 'OptionTooLong' : number } |
  { 'EndDateInThePast' : null } |
  { 'PollsNotValidForDirectChats' : null };
export type MarkSuspectedBotArgs = {};
export type MarkSuspectedBotResponse = { 'Success' : null };
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
  'last_updated' : [] | [TimestampMillis],
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
  { 'Prize' : PrizeContent } |
  { 'GovernanceProposal' : ProposalContent } |
  { 'PrizeWinner' : PrizeWinnerContent } |
  { 'Audio' : AudioContent } |
  { 'Crypto' : CryptoContent } |
  { 'Video' : VideoContent } |
  { 'Deleted' : DeletedContent };
export type MessageContentInitial = { 'Giphy' : GiphyContent } |
  { 'File' : FileContent } |
  { 'Poll' : PollContent } |
  { 'Text' : TextContent } |
  { 'Image' : ImageContent } |
  { 'Prize' : PrizeContentInitial } |
  { 'GovernanceProposal' : ProposalContent } |
  { 'Audio' : AudioContent } |
  { 'Crypto' : CryptoContent } |
  { 'Video' : VideoContent } |
  { 'Deleted' : DeletedContent };
export interface MessageEventWrapper {
  'event' : Message,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
  'correlation_id' : bigint,
  'expires_at' : [] | [TimestampMillis],
}
export type MessageId = bigint;
export type MessageIndex = number;
export interface MessageIndexRange {
  'end' : MessageIndex,
  'start' : MessageIndex,
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
export type Milliseconds = bigint;
export interface NnsCompletedCryptoTransaction {
  'to' : NnsCryptoAccount,
  'fee' : Tokens,
  'created' : TimestampNanos,
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
  'created' : TimestampNanos,
  'token' : Cryptocurrency,
  'transaction_hash' : TransactionHash,
  'from' : NnsCryptoAccount,
  'memo' : Memo,
  'error_message' : string,
  'amount' : Tokens,
}
export type NnsNeuronId = bigint;
export interface NnsPendingCryptoTransaction {
  'to' : NnsUserOrAccount,
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
export type NnsUserOrAccount = { 'User' : UserId } |
  { 'Account' : AccountIdentifier };
export type Notification = {
    'DirectReactionAddedNotification' : DirectReactionAddedNotification
  } |
  { 'DirectMessageNotification' : DirectMessageNotification } |
  { 'GroupMessageNotification' : GroupMessageNotification } |
  { 'GroupReactionAddedNotification' : GroupReactionAddedNotification } |
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
  'is_bot' : boolean,
  'avatar_id' : [] | [bigint],
  'suspended' : boolean,
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
export type PendingCryptoTransaction = { 'NNS' : NnsPendingCryptoTransaction } |
  { 'SNS' : SnsPendingCryptoTransaction };
export type PermissionRole = { 'Owner' : null } |
  { 'Admins' : null } |
  { 'Members' : null };
export interface PermissionsChanged {
  'changed_by' : UserId,
  'old_permissions' : GroupPermissions,
  'new_permissions' : GroupPermissions,
}
export interface PhoneNumber { 'country_code' : number, 'number' : string }
export type PhoneStatus = { 'Unconfirmed' : UnconfirmedPhoneNumberState } |
  { 'None' : null } |
  { 'Confirmed' : null };
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
export interface PollVotes {
  'total' : TotalPollVotes,
  'user' : Uint32Array | number[],
}
export interface PrizeContent {
  'token' : Cryptocurrency,
  'end_date' : TimestampMillis,
  'prizes_remaining' : number,
  'prizes_pending' : number,
  'caption' : [] | [string],
  'winners' : Array<UserId>,
}
export interface PrizeContentInitial {
  'end_date' : TimestampMillis,
  'caption' : [] | [string],
  'prizes' : Array<Tokens>,
  'transfer' : CryptoTransaction,
}
export interface PrizeWinnerContent {
  'token' : Cryptocurrency,
  'winner' : UserId,
  'prize_message' : MessageIndex,
  'amount' : Tokens,
}
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
  'frozen' : [] | [FrozenGroupInfo],
  'latest_event_index' : EventIndex,
  'chat_id' : ChatId,
  'participant_count' : number,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface PushEventResult {
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
  'expires_at' : [] | [TimestampMillis],
}
export interface RegisterUserArgs {
  'username' : string,
  'referred_by' : [] | [UserId],
  'challenge_attempt' : ChallengeAttempt,
}
export type RegisterUserResponse = { 'UsernameTaken' : null } |
  { 'UsernameTooShort' : number } |
  { 'UsernameInvalid' : null } |
  { 'AlreadyRegistered' : null } |
  { 'UserLimitReached' : null } |
  { 'UsernameTooLong' : number } |
  { 'Success' : UserId } |
  { 'ChallengeFailed' : null } |
  { 'InternalError' : string } |
  { 'CyclesBalanceTooLow' : null };
export type RegistrationFee = { 'ICP' : ICPRegistrationFee } |
  { 'Cycles' : CyclesRegistrationFee };
export interface RemoveSuperAdminArgs { 'user_id' : UserId }
export type RemoveSuperAdminResponse = { 'Success' : null } |
  { 'NotSuperAdmin' : null } |
  { 'InternalError' : string };
export interface ReplyContext {
  'chat_id_if_other' : [] | [ChatId],
  'event_index' : EventIndex,
}
export type ResendCodeArgs = {};
export type ResendCodeResponse = { 'PhoneNumberNotSubmitted' : null } |
  { 'Success' : null } |
  { 'PhoneNumberAlreadyConfirmed' : null } |
  { 'UserNotFound' : null };
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
export interface SearchArgs { 'max_results' : number, 'search_term' : string }
export type SearchResponse = {
    'Success' : { 'timestamp' : TimestampMillis, 'users' : Array<UserSummary> }
  };
export interface SetUsernameArgs { 'username' : string }
export type SetUsernameResponse = { 'UsernameTaken' : null } |
  { 'UsernameTooShort' : number } |
  { 'UsernameInvalid' : null } |
  { 'UsernameTooLong' : number } |
  { 'Success' : null } |
  { 'UserNotFound' : null };
export type SnsAccount = { 'Mint' : null } |
  { 'Account' : Icrc1Account };
export interface SnsCompletedCryptoTransaction {
  'to' : SnsAccount,
  'fee' : Tokens,
  'created' : TimestampNanos,
  'token' : Cryptocurrency,
  'transaction_hash' : TransactionHash,
  'block_index' : BlockIndex,
  'from' : SnsAccount,
  'memo' : [] | [Memo],
  'amount' : Tokens,
}
export interface SnsFailedCryptoTransaction {
  'to' : SnsAccount,
  'fee' : Tokens,
  'created' : TimestampNanos,
  'token' : Cryptocurrency,
  'transaction_hash' : TransactionHash,
  'from' : SnsAccount,
  'memo' : [] | [Memo],
  'error_message' : string,
  'amount' : Tokens,
}
export type SnsNeuronId = Uint8Array | number[];
export interface SnsPendingCryptoTransaction {
  'to' : Icrc1Account,
  'fee' : Tokens,
  'token' : Cryptocurrency,
  'memo' : [] | [Memo],
  'amount' : Tokens,
}
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
export interface SubmitPhoneNumberArgs { 'phone_number' : PhoneNumber }
export type SubmitPhoneNumberResponse = { 'AlreadyRegistered' : null } |
  { 'Success' : null } |
  { 'AlreadyRegisteredByOther' : null } |
  { 'InvalidPhoneNumber' : null } |
  { 'UserNotFound' : null };
export interface Subscription {
  'value' : SubscriptionInfo,
  'last_active' : TimestampMillis,
}
export interface SubscriptionInfo {
  'endpoint' : string,
  'keys' : SubscriptionKeys,
}
export interface SubscriptionKeys { 'auth' : string, 'p256dh' : string }
export interface SuccessResult { 'open_storage_limit_bytes' : bigint }
export type SuperAdminsArgs = {};
export type SuperAdminsResponse = { 'Success' : { 'users' : Array<UserId> } };
export interface SuspectedBotsArgs { 'after' : [] | [UserId], 'count' : number }
export type SuspectedBotsResponse = { 'Success' : { 'users' : Array<UserId> } };
export interface SuspendUserArgs {
  'duration' : [] | [Milliseconds],
  'user_id' : UserId,
  'reason' : string,
}
export type SuspendUserResponse = { 'UserAlreadySuspended' : null } |
  { 'Success' : null } |
  { 'InternalError' : string } |
  { 'UserNotFound' : null };
export type SuspensionAction = { 'Unsuspend' : TimestampMillis } |
  { 'Delete' : TimestampMillis };
export interface SuspensionDetails {
  'action' : SuspensionAction,
  'suspended_by' : UserId,
  'reason' : string,
}
export interface Tally {
  'no' : bigint,
  'yes' : bigint,
  'total' : bigint,
  'timestamp' : TimestampMillis,
}
export interface TextContent { 'text' : string }
export type TextUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : string };
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
export type TimestampUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : TimestampMillis };
export interface Tokens { 'e8s' : bigint }
export type TotalPollVotes = { 'Anonymous' : Array<[number, number]> } |
  { 'Visible' : Array<[number, Array<UserId>]> } |
  { 'Hidden' : number };
export type TransactionHash = Uint8Array | number[];
export interface TransferCyclesArgs {
  'recipient' : UserId,
  'sender' : UserId,
  'amount' : bigint,
}
export type TransferCyclesResponse = { 'BalanceExceeded' : null } |
  { 'Success' : { 'new_balance' : bigint } } |
  { 'UserNotFound' : null } |
  { 'RecipientNotFound' : null };
export interface UnconfirmedPhoneNumberState {
  'valid_until' : TimestampMillis,
  'phone_number' : PhoneNumber,
}
export interface UnsuspendUserArgs { 'user_id' : UserId }
export type UnsuspendUserResponse = { 'UserNotSuspended' : null } |
  { 'Success' : null } |
  { 'InternalError' : string } |
  { 'UserNotFound' : null };
export interface UpdatedMessage {
  'updated_by' : UserId,
  'message_id' : MessageId,
  'event_index' : EventIndex,
}
export interface UpgradeStorageArgs { 'new_storage_limit_bytes' : bigint }
export type UpgradeStorageResponse = { 'SuccessNoChange' : null } |
  { 'Success' : null } |
  { 'PaymentNotFound' : null } |
  {
    'PaymentInsufficient' : { 'amount_required' : ICP, 'account_balance' : ICP }
  } |
  { 'InternalError' : string } |
  { 'StorageLimitExceeded' : bigint } |
  { 'UserNotFound' : null };
export interface User { 'username' : string, 'user_id' : UserId }
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
  'is_bot' : boolean,
  'avatar_id' : [] | [bigint],
  'seconds_since_last_online' : number,
  'suspended' : boolean,
}
export interface UsersArgs {
  'user_groups' : Array<
    { 'users' : Array<UserId>, 'updated_since' : TimestampMillis }
  >,
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
export type VoteOperation = { 'RegisterVote' : null } |
  { 'DeleteVote' : null };
export interface _SERVICE {
  'add_super_admin' : ActorMethod<[AddSuperAdminArgs], AddSuperAdminResponse>,
  'check_username' : ActorMethod<[CheckUsernameArgs], CheckUsernameResponse>,
  'confirm_phone_number' : ActorMethod<
    [ConfirmPhoneNumberArgs],
    ConfirmPhoneNumberResponse
  >,
  'create_challenge' : ActorMethod<
    [CreateChallengeArgs],
    CreateChallengeResponse
  >,
  'current_user' : ActorMethod<[CurrentUserArgs], CurrentUserResponse>,
  'mark_suspected_bot' : ActorMethod<
    [MarkSuspectedBotArgs],
    MarkSuspectedBotResponse
  >,
  'register_user' : ActorMethod<[RegisterUserArgs], RegisterUserResponse>,
  'remove_super_admin' : ActorMethod<
    [RemoveSuperAdminArgs],
    RemoveSuperAdminResponse
  >,
  'resend_code' : ActorMethod<[ResendCodeArgs], ResendCodeResponse>,
  'search' : ActorMethod<[SearchArgs], SearchResponse>,
  'set_username' : ActorMethod<[SetUsernameArgs], SetUsernameResponse>,
  'submit_phone_number' : ActorMethod<
    [SubmitPhoneNumberArgs],
    SubmitPhoneNumberResponse
  >,
  'super_admins' : ActorMethod<[SuperAdminsArgs], SuperAdminsResponse>,
  'suspected_bots' : ActorMethod<[SuspectedBotsArgs], SuspectedBotsResponse>,
  'suspend_user' : ActorMethod<[SuspendUserArgs], SuspendUserResponse>,
  'unsuspend_user' : ActorMethod<[UnsuspendUserArgs], UnsuspendUserResponse>,
  'upgrade_storage' : ActorMethod<[UpgradeStorageArgs], UpgradeStorageResponse>,
  'user' : ActorMethod<[UserArgs], UserResponse>,
  'users' : ActorMethod<[UsersArgs], UsersResponse>,
}
