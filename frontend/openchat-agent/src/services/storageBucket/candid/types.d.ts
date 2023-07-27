import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type AccessGate = { 'SnsNeuron' : SnsNeuronGate } |
  { 'DiamondMember' : null };
export type AccessGateUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : AccessGate };
export interface AccessRules { 'text' : string, 'enabled' : boolean }
export type AccessorId = Principal;
export type AccountIdentifier = Uint8Array | number[];
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
export interface AvatarChanged {
  'changed_by' : UserId,
  'previous_avatar' : [] | [bigint],
  'new_avatar' : [] | [bigint],
}
export interface BannerChanged {
  'new_banner' : [] | [bigint],
  'changed_by' : UserId,
  'previous_banner' : [] | [bigint],
}
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
export type ChannelId = bigint;
export interface ChannelMatch {
  'id' : ChannelId,
  'gate' : [] | [AccessGate],
  'name' : string,
  'description' : string,
  'is_default' : boolean,
  'avatar_id' : [] | [bigint],
  'member_count' : number,
}
export interface ChannelMembership {
  'role' : GroupRole,
  'notifications_muted' : boolean,
  'joined' : TimestampMillis,
  'latest_threads' : Array<GroupCanisterThreadDetails>,
  'mentions' : Array<Mention>,
  'my_metrics' : ChatMetrics,
}
export interface ChannelMembershipUpdates {
  'role' : [] | [GroupRole],
  'notifications_muted' : [] | [boolean],
  'latest_threads' : Array<GroupCanisterThreadDetails>,
  'mentions' : Array<Mention>,
  'my_metrics' : [] | [ChatMetrics],
}
export type Chat = { 'Group' : ChatId } |
  { 'Channel' : [CommunityId, ChannelId] } |
  { 'Direct' : ChatId };
export type ChatEvent = { 'Empty' : null } |
  { 'ParticipantJoined' : ParticipantJoined } |
  { 'GroupDescriptionChanged' : GroupDescriptionChanged } |
  { 'GroupChatCreated' : GroupChatCreated } |
  { 'MessagePinned' : MessagePinned } |
  { 'UsersInvited' : UsersInvited } |
  { 'UsersBlocked' : UsersBlocked } |
  { 'MessageUnpinned' : MessageUnpinned } |
  { 'ParticipantsRemoved' : ParticipantsRemoved } |
  { 'GroupVisibilityChanged' : GroupVisibilityChanged } |
  { 'Message' : Message } |
  { 'PermissionsChanged' : PermissionsChanged } |
  { 'ChatFrozen' : GroupFrozen } |
  { 'GroupInviteCodeChanged' : GroupInviteCodeChanged } |
  { 'UsersUnblocked' : UsersUnblocked } |
  { 'ChatUnfrozen' : GroupUnfrozen } |
  { 'ParticipantLeft' : ParticipantLeft } |
  { 'GroupRulesChanged' : GroupRulesChanged } |
  { 'GroupNameChanged' : GroupNameChanged } |
  { 'GroupGateUpdated' : GroupGateUpdated } |
  { 'RoleChanged' : RoleChanged } |
  { 'EventsTimeToLiveUpdated' : EventsTimeToLiveUpdated } |
  { 'DirectChatCreated' : DirectChatCreated } |
  { 'AvatarChanged' : AvatarChanged } |
  { 'ParticipantsAdded' : ParticipantsAdded };
export interface ChatEventWrapper {
  'event' : ChatEvent,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
  'correlation_id' : bigint,
  'expires_at' : [] | [TimestampMillis],
}
export type ChatId = CanisterId;
export interface ChatMetrics {
  'prize_winner_messages' : bigint,
  'audio_messages' : bigint,
  'chat_messages' : bigint,
  'edits' : bigint,
  'icp_messages' : bigint,
  'last_active' : TimestampMillis,
  'giphy_messages' : bigint,
  'deleted_messages' : bigint,
  'file_messages' : bigint,
  'poll_votes' : bigint,
  'text_messages' : bigint,
  'message_reminders' : bigint,
  'image_messages' : bigint,
  'replies' : bigint,
  'video_messages' : bigint,
  'sns1_messages' : bigint,
  'polls' : bigint,
  'proposals' : bigint,
  'reported_messages' : bigint,
  'ckbtc_messages' : bigint,
  'reactions' : bigint,
  'kinic_messages' : bigint,
  'custom_type_messages' : bigint,
  'prize_messages' : bigint,
}
export interface CommunityCanisterChannelSummary {
  'channel_id' : ChannelId,
  'is_public' : boolean,
  'permissions' : GroupPermissions,
  'metrics' : ChatMetrics,
  'subtype' : [] | [GroupSubtype],
  'date_last_pinned' : [] | [TimestampMillis],
  'min_visible_event_index' : EventIndex,
  'gate' : [] | [AccessGate],
  'name' : string,
  'description' : string,
  'events_ttl' : [] | [Milliseconds],
  'last_updated' : TimestampMillis,
  'is_default' : boolean,
  'avatar_id' : [] | [bigint],
  'next_message_expiry' : [] | [TimestampMillis],
  'membership' : [] | [ChannelMembership],
  'latest_event_index' : EventIndex,
  'history_visible_to_new_joiners' : boolean,
  'min_visible_message_index' : MessageIndex,
  'member_count' : number,
  'expired_messages' : Array<MessageIndexRange>,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface CommunityCanisterChannelSummaryUpdates {
  'channel_id' : ChannelId,
  'is_public' : [] | [boolean],
  'permissions' : [] | [GroupPermissions],
  'metrics' : [] | [ChatMetrics],
  'subtype' : GroupSubtypeUpdate,
  'date_last_pinned' : [] | [TimestampMillis],
  'gate' : AccessGateUpdate,
  'name' : [] | [string],
  'description' : [] | [string],
  'events_ttl' : EventsTimeToLiveUpdate,
  'last_updated' : TimestampMillis,
  'is_default' : [] | [boolean],
  'avatar_id' : DocumentIdUpdate,
  'membership' : [] | [ChannelMembershipUpdates],
  'latest_event_index' : [] | [EventIndex],
  'updated_events' : Array<[[] | [number], number, bigint]>,
  'member_count' : [] | [number],
  'latest_message' : [] | [MessageEventWrapper],
}
export interface CommunityCanisterCommunitySummary {
  'is_public' : boolean,
  'permissions' : CommunityPermissions,
  'community_id' : CommunityId,
  'metrics' : ChatMetrics,
  'gate' : [] | [AccessGate],
  'name' : string,
  'description' : string,
  'last_updated' : TimestampMillis,
  'channels' : Array<CommunityCanisterChannelSummary>,
  'avatar_id' : [] | [bigint],
  'membership' : [] | [CommunityMembership],
  'frozen' : [] | [FrozenGroupInfo],
  'latest_event_index' : EventIndex,
  'banner_id' : [] | [bigint],
  'member_count' : number,
  'primary_language' : string,
}
export interface CommunityCanisterCommunitySummaryUpdates {
  'is_public' : [] | [boolean],
  'permissions' : [] | [CommunityPermissions],
  'community_id' : CommunityId,
  'channels_updated' : Array<CommunityCanisterChannelSummaryUpdates>,
  'metrics' : [] | [ChatMetrics],
  'gate' : AccessGateUpdate,
  'name' : [] | [string],
  'description' : [] | [string],
  'last_updated' : TimestampMillis,
  'channels_removed' : Array<ChannelId>,
  'avatar_id' : DocumentIdUpdate,
  'channels_added' : Array<CommunityCanisterChannelSummary>,
  'membership' : [] | [CommunityMembershipUpdates],
  'frozen' : FrozenGroupUpdate,
  'latest_event_index' : [] | [EventIndex],
  'banner_id' : DocumentIdUpdate,
  'member_count' : [] | [number],
  'primary_language' : [] | [string],
}
export type CommunityId = CanisterId;
export interface CommunityMatch {
  'id' : CommunityId,
  'channel_count' : number,
  'gate' : [] | [AccessGate],
  'name' : string,
  'description' : string,
  'moderation_flags' : number,
  'avatar_id' : [] | [bigint],
  'banner_id' : [] | [bigint],
  'member_count' : number,
  'primary_language' : string,
}
export interface CommunityMember {
  'role' : CommunityRole,
  'user_id' : UserId,
  'date_added' : TimestampMillis,
}
export interface CommunityMembership {
  'role' : CommunityRole,
  'joined' : TimestampMillis,
}
export interface CommunityMembershipUpdates { 'role' : [] | [CommunityRole] }
export type CommunityPermissionRole = { 'Owners' : null } |
  { 'Admins' : null } |
  { 'Members' : null };
export interface CommunityPermissions {
  'create_public_channel' : CommunityPermissionRole,
  'update_details' : CommunityPermissionRole,
  'remove_members' : CommunityPermissionRole,
  'invite_users' : CommunityPermissionRole,
  'change_roles' : CommunityPermissionRole,
  'create_private_channel' : CommunityPermissionRole,
}
export type CommunityRole = { 'Member' : null } |
  { 'Admin' : null } |
  { 'Owner' : null };
export type CompletedCryptoTransaction = {
    'NNS' : NnsCompletedCryptoTransaction
  } |
  { 'SNS' : SnsCompletedCryptoTransaction } |
  { 'ICRC1' : Icrc1CompletedCryptoTransaction };
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
  { 'KINIC' : null } |
  { 'CKBTC' : null };
export interface CustomMessageContent {
  'data' : Uint8Array | number[],
  'kind' : string,
}
export type Cycles = bigint;
export interface CyclesRegistrationFee {
  'recipient' : Principal,
  'valid_until' : TimestampMillis,
  'amount' : Cycles,
}
export interface DeleteFileArgs { 'file_id' : FileId }
export interface DeleteFileFailure {
  'reason' : DeleteFileFailureReason,
  'file_id' : FileId,
}
export type DeleteFileFailureReason = { 'NotFound' : null } |
  { 'NotAuthorized' : null };
export type DeleteFileResponse = { 'NotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null };
export interface DeleteFilesArgs { 'file_ids' : Array<FileId> }
export interface DeleteFilesResponse {
  'failures' : Array<DeleteFileFailure>,
  'success' : Array<FileId>,
}
export interface DeletedContent {
  'timestamp' : TimestampMillis,
  'deleted_by' : UserId,
}
export interface DiamondMembershipDetails {
  'recurring' : [] | [DiamondMembershipPlanDuration],
  'expires_at' : TimestampMillis,
}
export type DiamondMembershipPlanDuration = { 'OneYear' : null } |
  { 'ThreeMonths' : null } |
  { 'OneMonth' : null };
export type DirectChatCreated = {};
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
  'notifications_muted' : [] | [boolean],
  'events_ttl' : EventsTimeToLiveUpdate,
  'latest_event_index' : [] | [EventIndex],
  'updated_events' : Array<[number, bigint]>,
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
export interface Document {
  'id' : bigint,
  'data' : Uint8Array | number[],
  'mime_type' : string,
}
export type DocumentIdUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : bigint };
export type DocumentUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : Document };
export type EmptyArgs = {};
export type EventIndex = number;
export interface EventsSuccessResult {
  'events' : Array<ChatEventWrapper>,
  'timestamp' : TimestampMillis,
  'latest_event_index' : number,
}
export type EventsTimeToLiveUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : Milliseconds };
export interface EventsTimeToLiveUpdated {
  'new_ttl' : [] | [Milliseconds],
  'updated_by' : UserId,
}
export type FailedCryptoTransaction = { 'NNS' : NnsFailedCryptoTransaction } |
  { 'SNS' : SnsFailedCryptoTransaction } |
  { 'ICRC1' : Icrc1FailedCryptoTransaction };
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
export type FileId = bigint;
export interface FileInfoArgs { 'file_id' : FileId }
export type FileInfoResponse = { 'NotFound' : null } |
  { 'Success' : FileInfoSuccessResult };
export interface FileInfoSuccessResult {
  'is_owner' : boolean,
  'file_hash' : Hash,
  'file_size' : bigint,
}
export interface ForwardFileArgs {
  'accessors' : Array<AccessorId>,
  'file_id' : FileId,
}
export type ForwardFileResponse = { 'NotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : FileId };
export interface FrozenGroupInfo {
  'timestamp' : TimestampMillis,
  'frozen_by' : UserId,
  'reason' : [] | [string],
}
export type FrozenGroupUpdate = { 'NoChange' : null } |
  { 'SetToNone' : null } |
  { 'SetToSome' : FrozenGroupInfo };
export type GateCheckFailedReason = { 'NotDiamondMember' : null } |
  { 'NoSnsNeuronsFound' : null } |
  { 'NoSnsNeuronsWithRequiredDissolveDelayFound' : null } |
  { 'NoSnsNeuronsWithRequiredStakeFound' : null };
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
  'gate' : [] | [AccessGate],
  'name' : string,
  'role' : GroupRole,
  'wasm_version' : Version,
  'notifications_muted' : boolean,
  'description' : string,
  'events_ttl' : [] | [Milliseconds],
  'last_updated' : TimestampMillis,
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
  'gate' : AccessGateUpdate,
  'name' : [] | [string],
  'role' : [] | [GroupRole],
  'wasm_version' : [] | [Version],
  'notifications_muted' : [] | [boolean],
  'description' : [] | [string],
  'events_ttl' : EventsTimeToLiveUpdate,
  'last_updated' : TimestampMillis,
  'avatar_id' : DocumentIdUpdate,
  'next_message_expiry' : TimestampUpdate,
  'latest_threads' : Array<GroupCanisterThreadDetails>,
  'frozen' : FrozenGroupUpdate,
  'latest_event_index' : [] | [EventIndex],
  'updated_events' : Array<[[] | [number], number, bigint]>,
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
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
  'gate' : [] | [AccessGate],
  'name' : string,
  'role' : GroupRole,
  'wasm_version' : Version,
  'notifications_muted' : boolean,
  'description' : string,
  'events_ttl' : [] | [Milliseconds],
  'last_updated' : TimestampMillis,
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
export interface GroupDescriptionChanged {
  'new_description' : string,
  'previous_description' : string,
  'changed_by' : UserId,
}
export interface GroupFrozen { 'frozen_by' : UserId, 'reason' : [] | [string] }
export interface GroupGateUpdated {
  'updated_by' : UserId,
  'new_gate' : [] | [AccessGate],
}
export type GroupInviteCodeChange = { 'Enabled' : null } |
  { 'Disabled' : null } |
  { 'Reset' : null };
export interface GroupInviteCodeChanged {
  'changed_by' : UserId,
  'change' : GroupInviteCodeChange,
}
export interface GroupMatch {
  'id' : ChatId,
  'gate' : [] | [AccessGate],
  'name' : string,
  'description' : string,
  'avatar_id' : [] | [bigint],
  'chat_id' : ChatId,
  'member_count' : number,
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
export type GroupRole = { 'Participant' : null } |
  { 'Admin' : null } |
  { 'Moderator' : null } |
  { 'Owner' : null };
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
export interface GroupUnfrozen { 'unfrozen_by' : UserId }
export interface GroupVisibilityChanged {
  'changed_by' : UserId,
  'now_public' : boolean,
}
export type Hash = Uint8Array | number[];
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
export type Icrc1AccountOrMint = { 'Mint' : null } |
  { 'Account' : Icrc1Account };
export interface Icrc1CompletedCryptoTransaction {
  'to' : Icrc1AccountOrMint,
  'fee' : bigint,
  'created' : TimestampNanos,
  'token' : Cryptocurrency,
  'block_index' : BlockIndex,
  'from' : Icrc1AccountOrMint,
  'memo' : [] | [Memo],
  'ledger' : CanisterId,
  'amount' : bigint,
}
export interface Icrc1FailedCryptoTransaction {
  'to' : Icrc1AccountOrMint,
  'fee' : bigint,
  'created' : TimestampNanos,
  'token' : Cryptocurrency,
  'from' : Icrc1AccountOrMint,
  'memo' : [] | [Memo],
  'error_message' : string,
  'ledger' : CanisterId,
  'amount' : bigint,
}
export interface Icrc1PendingCryptoTransaction {
  'to' : Icrc1Account,
  'fee' : bigint,
  'created' : TimestampNanos,
  'token' : Cryptocurrency,
  'memo' : [] | [Memo],
  'ledger' : CanisterId,
  'amount' : bigint,
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
export type Memo = Uint8Array | number[];
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
export type MessageContent = { 'ReportedMessage' : ReportedMessage } |
  { 'Giphy' : GiphyContent } |
  { 'File' : FileContent } |
  { 'Poll' : PollContent } |
  { 'Text' : TextContent } |
  { 'Image' : ImageContent } |
  { 'Prize' : PrizeContent } |
  { 'Custom' : CustomMessageContent } |
  { 'GovernanceProposal' : ProposalContent } |
  { 'PrizeWinner' : PrizeWinnerContent } |
  { 'Audio' : AudioContent } |
  { 'Crypto' : CryptoContent } |
  { 'Video' : VideoContent } |
  { 'Deleted' : DeletedContent } |
  { 'MessageReminderCreated' : MessageReminderCreated } |
  { 'MessageReminder' : MessageReminder };
export type MessageContentInitial = { 'Giphy' : GiphyContent } |
  { 'File' : FileContent } |
  { 'Poll' : PollContent } |
  { 'Text' : TextContent } |
  { 'Image' : ImageContent } |
  { 'Prize' : PrizeContentInitial } |
  { 'Custom' : CustomMessageContent } |
  { 'GovernanceProposal' : ProposalContent } |
  { 'Audio' : AudioContent } |
  { 'Crypto' : CryptoContent } |
  { 'Video' : VideoContent } |
  { 'Deleted' : DeletedContent } |
  { 'MessageReminderCreated' : MessageReminderCreated } |
  { 'MessageReminder' : MessageReminder };
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
  'message_index' : MessageIndex,
}
export interface MessagePinned {
  'pinned_by' : UserId,
  'message_index' : MessageIndex,
}
export interface MessageReminder {
  'notes' : [] | [string],
  'reminder_id' : bigint,
}
export interface MessageReminderCreated {
  'hidden' : boolean,
  'notes' : [] | [string],
  'remind_at' : TimestampMillis,
  'reminder_id' : bigint,
}
export interface MessageReport {
  'notes' : [] | [string],
  'timestamp' : TimestampMillis,
  'reported_by' : UserId,
  'reason_code' : number,
}
export interface MessageUnpinned {
  'due_to_message_deleted' : boolean,
  'unpinned_by' : UserId,
  'message_index' : MessageIndex,
}
export interface MessagesSuccessResult {
  'messages' : Array<MessageEventWrapper>,
  'timestamp' : TimestampMillis,
  'latest_event_index' : EventIndex,
}
export type Milliseconds = bigint;
export type MultiUserChat = { 'Group' : ChatId } |
  { 'Channel' : [CommunityId, ChannelId] };
export interface NnsCompletedCryptoTransaction {
  'to' : NnsCryptoAccount,
  'fee' : Tokens,
  'created' : TimestampNanos,
  'token' : Cryptocurrency,
  'transaction_hash' : TransactionHash,
  'block_index' : BlockIndex,
  'from' : NnsCryptoAccount,
  'memo' : bigint,
  'ledger' : CanisterId,
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
  'memo' : bigint,
  'error_message' : string,
  'ledger' : CanisterId,
  'amount' : Tokens,
}
export type NnsNeuronId = bigint;
export interface NnsPendingCryptoTransaction {
  'to' : NnsUserOrAccount,
  'fee' : [] | [Tokens],
  'created' : TimestampNanos,
  'token' : Cryptocurrency,
  'memo' : [] | [bigint],
  'ledger' : CanisterId,
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
export interface OptionalCommunityPermissions {
  'create_public_channel' : [] | [CommunityPermissionRole],
  'update_details' : [] | [CommunityPermissionRole],
  'remove_members' : [] | [CommunityPermissionRole],
  'invite_users' : [] | [CommunityPermissionRole],
  'change_roles' : [] | [CommunityPermissionRole],
  'create_private_channel' : [] | [CommunityPermissionRole],
}
export interface OptionalGroupPermissions {
  'block_users' : [] | [PermissionRole],
  'change_permissions' : [] | [PermissionRole],
  'delete_messages' : [] | [PermissionRole],
  'send_messages' : [] | [PermissionRole],
  'remove_members' : [] | [PermissionRole],
  'update_group' : [] | [PermissionRole],
  'invite_users' : [] | [PermissionRole],
  'change_roles' : [] | [PermissionRole],
  'create_polls' : [] | [PermissionRole],
  'pin_messages' : [] | [PermissionRole],
  'reply_in_thread' : [] | [PermissionRole],
  'react_to_messages' : [] | [PermissionRole],
}
export interface PartialUserSummary {
  'username' : [] | [string],
  'diamond_member' : boolean,
  'user_id' : UserId,
  'is_bot' : boolean,
  'avatar_id' : [] | [bigint],
  'suspended' : boolean,
}
export interface Participant {
  'role' : GroupRole,
  'user_id' : UserId,
  'date_added' : TimestampMillis,
}
export interface ParticipantJoined {
  'user_id' : UserId,
  'invited_by' : [] | [UserId],
}
export interface ParticipantLeft { 'user_id' : UserId }
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
  { 'SNS' : SnsPendingCryptoTransaction } |
  { 'ICRC1' : Icrc1PendingCryptoTransaction };
export type PermissionRole = { 'Moderators' : null } |
  { 'Owner' : null } |
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
  'transaction' : CompletedCryptoTransaction,
  'winner' : UserId,
  'prize_message' : MessageIndex,
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
export interface PublicGroupSummary {
  'is_public' : boolean,
  'subtype' : [] | [GroupSubtype],
  'gate' : [] | [AccessGate],
  'name' : string,
  'wasm_version' : Version,
  'description' : string,
  'events_ttl' : [] | [Milliseconds],
  'last_updated' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'frozen' : [] | [FrozenGroupInfo],
  'latest_event_index' : EventIndex,
  'history_visible_to_new_joiners' : boolean,
  'chat_id' : ChatId,
  'participant_count' : number,
  'latest_message' : [] | [MessageEventWrapper],
}
export interface PushEventResult {
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
  'expires_at' : [] | [TimestampMillis],
}
export type RegistrationFee = { 'ICP' : ICPRegistrationFee } |
  { 'Cycles' : CyclesRegistrationFee };
export interface ReplyContext {
  'chat_if_other' : [] | [[Chat, [] | [MessageIndex]]],
  'event_index' : EventIndex,
}
export interface ReportedMessage {
  'count' : number,
  'reports' : Array<MessageReport>,
}
export interface RoleChanged {
  'user_ids' : Array<UserId>,
  'changed_by' : UserId,
  'old_role' : GroupRole,
  'new_role' : GroupRole,
}
export interface SelectedGroupUpdates {
  'blocked_users_removed' : Array<UserId>,
  'pinned_messages_removed' : Uint32Array | number[],
  'invited_users' : [] | [Array<UserId>],
  'members_added_or_updated' : Array<Participant>,
  'pinned_messages_added' : Uint32Array | number[],
  'members_removed' : Array<UserId>,
  'timestamp' : TimestampMillis,
  'latest_event_index' : EventIndex,
  'rules' : [] | [AccessRules],
  'blocked_users_added' : Array<UserId>,
}
export interface SnsCompletedCryptoTransaction {
  'to' : Icrc1AccountOrMint,
  'fee' : Tokens,
  'created' : TimestampNanos,
  'token' : Cryptocurrency,
  'transaction_hash' : TransactionHash,
  'block_index' : BlockIndex,
  'from' : Icrc1AccountOrMint,
  'memo' : [] | [bigint],
  'ledger' : CanisterId,
  'amount' : Tokens,
}
export interface SnsFailedCryptoTransaction {
  'to' : Icrc1AccountOrMint,
  'fee' : Tokens,
  'created' : TimestampNanos,
  'token' : Cryptocurrency,
  'transaction_hash' : TransactionHash,
  'from' : Icrc1AccountOrMint,
  'memo' : [] | [bigint],
  'error_message' : string,
  'ledger' : CanisterId,
  'amount' : Tokens,
}
export interface SnsNeuronGate {
  'min_stake_e8s' : [] | [bigint],
  'min_dissolve_delay' : [] | [Milliseconds],
  'governance_canister_id' : CanisterId,
}
export type SnsNeuronId = Uint8Array | number[];
export interface SnsPendingCryptoTransaction {
  'to' : Icrc1Account,
  'fee' : Tokens,
  'created' : TimestampNanos,
  'token' : Cryptocurrency,
  'memo' : [] | [bigint],
  'ledger' : CanisterId,
  'amount' : Tokens,
}
export interface SnsProposal {
  'id' : ProposalId,
  'url' : string,
  'status' : ProposalDecisionStatus,
  'payload_text_rendering' : [] | [string],
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
export interface ThreadPreview {
  'latest_replies' : Array<MessageEventWrapper>,
  'total_replies' : number,
  'root_message' : MessageEventWrapper,
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
export interface UploadChunkArgs {
  'accessors' : Array<AccessorId>,
  'chunk_index' : number,
  'hash' : Hash,
  'mime_type' : string,
  'total_size' : bigint,
  'bytes' : Uint8Array | number[],
  'expiry' : [] | [TimestampMillis],
  'chunk_size' : number,
  'file_id' : FileId,
}
export type UploadChunkResponse = { 'ChunkAlreadyExists' : null } |
  { 'Full' : null } |
  { 'ChunkSizeMismatch' : null } |
  { 'FileTooBig' : null } |
  { 'ChunkIndexTooHigh' : null } |
  { 'Success' : null } |
  { 'FileExpired' : null } |
  { 'HashMismatch' : null } |
  { 'FileAlreadyExists' : null } |
  { 'AllowanceExceeded' : null } |
  { 'InvalidFileId' : null } |
  { 'UserNotFound' : null };
export interface User { 'username' : string, 'user_id' : UserId }
export type UserId = CanisterId;
export interface UserSummary {
  'username' : string,
  'diamond_member' : boolean,
  'user_id' : UserId,
  'is_bot' : boolean,
  'avatar_id' : [] | [bigint],
  'seconds_since_last_online' : number,
  'suspended' : boolean,
}
export interface UsersBlocked {
  'user_ids' : Array<UserId>,
  'blocked_by' : UserId,
}
export interface UsersInvited {
  'user_ids' : Array<UserId>,
  'invited_by' : UserId,
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
export interface _SERVICE {
  'delete_file' : ActorMethod<[DeleteFileArgs], DeleteFileResponse>,
  'delete_files' : ActorMethod<[DeleteFilesArgs], DeleteFilesResponse>,
  'file_info' : ActorMethod<[FileInfoArgs], FileInfoResponse>,
  'forward_file' : ActorMethod<[ForwardFileArgs], ForwardFileResponse>,
  'upload_chunk_v2' : ActorMethod<[UploadChunkArgs], UploadChunkResponse>,
}
