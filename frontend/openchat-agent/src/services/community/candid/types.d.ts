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
export interface AddMembersToChannelArgs {
  'channel_id' : ChannelId,
  'user_ids' : Array<UserId>,
  'added_by_name' : string,
}
export interface AddMembersToChannelFailed {
  'users_limit_reached' : Array<UserId>,
  'users_failed_gate_check' : Array<UserFailedGateCheck>,
  'users_already_in_channel' : Array<UserId>,
  'users_failed_with_error' : Array<UserFailedError>,
}
export interface AddMembersToChannelPartialSuccess {
  'users_limit_reached' : Array<UserId>,
  'users_failed_gate_check' : Array<UserFailedGateCheck>,
  'users_already_in_channel' : Array<UserId>,
  'users_failed_with_error' : Array<UserFailedError>,
  'users_added' : Array<UserId>,
}
export type AddMembersToChannelResponse = {
    'Failed' : AddMembersToChannelFailed
  } |
  { 'UserNotInChannel' : null } |
  { 'PartialSuccess' : AddMembersToChannelPartialSuccess } |
  { 'ChannelNotFound' : null } |
  { 'UserLimitReached' : number } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
export interface AddReactionArgs {
  'channel_id' : ChannelId,
  'username' : string,
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
  'reaction' : string,
}
export type AddReactionResponse = { 'UserNotInChannel' : null } |
  { 'MessageNotFound' : null } |
  { 'NoChange' : null } |
  { 'ChannelNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'InvalidReaction' : null };
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
export interface BlockUserArgs { 'user_id' : UserId }
export type BlockUserResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'CommunityNotPublic' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'TargetUserNotInCommunity' : null } |
  { 'InternalError' : string } |
  { 'CannotBlockSelf' : null } |
  { 'CannotBlockUser' : null };
export type CanisterId = Principal;
export type CanisterUpgradeStatus = { 'NotRequired' : null } |
  { 'InProgress' : null };
export interface CanisterWasm {
  'compressed' : boolean,
  'version' : Version,
  'module' : Uint8Array | number[],
}
export interface ChangeChannelRoleArgs {
  'channel_id' : ChannelId,
  'user_id' : UserId,
  'new_role' : GroupRole,
}
export type ChangeChannelRoleResponse = { 'Invalid' : null } |
  { 'UserNotInChannel' : null } |
  { 'ChannelNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'TargetUserNotInChannel' : null };
export interface ChangeRoleArgs {
  'user_id' : UserId,
  'new_role' : CommunityRole,
}
export type ChangeRoleResponse = { 'Invalid' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'TargetUserNotInCommunity' : null } |
  { 'InternalError' : string };
export type ChannelId = bigint;
export type ChatEvent = { 'Empty' : null } |
  { 'MessageReactionRemoved' : UpdatedMessage } |
  { 'ParticipantJoined' : ParticipantJoined } |
  { 'ParticipantAssumesSuperAdmin' : ParticipantAssumesSuperAdmin } |
  { 'GroupDescriptionChanged' : GroupDescriptionChanged } |
  { 'GroupChatCreated' : GroupChatCreated } |
  { 'MessagePinned' : MessagePinned } |
  { 'UsersInvited' : UsersInvited } |
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
  { 'GroupGateUpdated' : GroupGateUpdated } |
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
<<<<<<< HEAD
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
  'custom_type_messages' : bigint,
  'prize_messages' : bigint,
=======
    prize_winner_messages: bigint;
    audio_messages: bigint;
    chat_messages: bigint;
    edits: bigint;
    icp_messages: bigint;
    last_active: TimestampMillis;
    giphy_messages: bigint;
    deleted_messages: bigint;
    file_messages: bigint;
    poll_votes: bigint;
    text_messages: bigint;
    message_reminders: bigint;
    image_messages: bigint;
    replies: bigint;
    video_messages: bigint;
    sns1_messages: bigint;
    polls: bigint;
    proposals: bigint;
    reported_messages: bigint;
    ckbtc_messages: bigint;
    reactions: bigint;
    custom_type_messages: bigint;
    prize_messages: bigint;
}
export interface ChatUnfrozen {
    unfrozen_by: UserId;
>>>>>>> master
}
export interface ChatUnfrozen { 'unfrozen_by' : UserId }
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
  'role' : GroupRole,
  'notifications_muted' : boolean,
  'description' : string,
  'events_ttl' : [] | [Milliseconds],
  'last_updated' : TimestampMillis,
  'joined' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'next_message_expiry' : [] | [TimestampMillis],
  'latest_threads' : Array<GroupCanisterThreadDetails>,
  'latest_event_index' : EventIndex,
  'banner_id' : [] | [bigint],
  'history_visible_to_new_joiners' : boolean,
  'min_visible_message_index' : MessageIndex,
  'mentions' : Array<Mention>,
  'member_count' : number,
  'expired_messages' : Array<MessageIndexRange>,
  'my_metrics' : ChatMetrics,
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
  'role' : [] | [GroupRole],
  'notifications_muted' : [] | [boolean],
  'description' : [] | [string],
  'events_ttl' : EventsTimeToLiveUpdate,
  'last_updated' : TimestampMillis,
  'avatar_id' : DocumentIdUpdate,
  'latest_threads' : Array<GroupCanisterThreadDetails>,
  'latest_event_index' : [] | [EventIndex],
  'mentions' : Array<Mention>,
  'member_count' : [] | [number],
  'my_metrics' : [] | [ChatMetrics],
  'latest_message' : [] | [MessageEventWrapper],
}
export interface CommunityCanisterCommunitySummary {
  'is_public' : boolean,
  'permissions' : CommunityPermissions,
  'community_id' : CommunityId,
  'gate' : [] | [AccessGate],
  'name' : string,
  'role' : CommunityRole,
  'description' : string,
  'last_updated' : TimestampMillis,
  'channels' : Array<CommunityCanisterChannelSummary>,
  'joined' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'frozen' : [] | [FrozenGroupInfo],
  'latest_event_index' : EventIndex,
  'banner_id' : [] | [bigint],
  'member_count' : number,
}
export interface CommunityCanisterCommunitySummaryUpdates {
  'is_public' : [] | [boolean],
  'permissions' : [] | [CommunityPermissions],
  'community_id' : CommunityId,
  'channels_updated' : Array<CommunityCanisterChannelSummaryUpdates>,
  'gate' : AccessGateUpdate,
  'name' : [] | [string],
  'role' : [] | [CommunityRole],
  'description' : [] | [string],
  'last_updated' : TimestampMillis,
  'channels_removed' : Array<ChannelId>,
  'avatar_id' : DocumentIdUpdate,
  'channels_added' : Array<CommunityCanisterChannelSummary>,
  'frozen' : FrozenGroupUpdate,
  'latest_event_index' : [] | [EventIndex],
  'banner_id' : DocumentIdUpdate,
  'member_count' : [] | [number],
}
export type CommunityId = CanisterId;
export type CommunityPermissionRole = { 'Owners' : null } |
  { 'Admins' : null } |
  { 'Members' : null };
export interface CommunityPermissions {
  'create_public_channel' : CommunityPermissionRole,
  'block_users' : CommunityPermissionRole,
  'change_permissions' : CommunityPermissionRole,
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
  { 'SNS' : SnsCompletedCryptoTransaction };
export interface CreateChannelArgs {
  'is_public' : boolean,
  'permissions' : [] | [GroupPermissions],
  'subtype' : [] | [GroupSubtype],
  'gate' : [] | [AccessGate],
  'name' : string,
  'description' : string,
  'events_ttl' : [] | [Milliseconds],
  'history_visible_to_new_joiners' : boolean,
  'rules' : AccessRules,
  'avatar' : [] | [Document],
}
export type CreateChannelResponse = { 'MaxChannelsCreated' : number } |
  { 'NameReserved' : null } |
  { 'RulesTooLong' : FieldTooLongResult } |
  { 'DescriptionTooLong' : FieldTooLongResult } |
  { 'NameTooShort' : FieldTooShortResult } |
  { 'NotAuthorized' : null } |
  { 'AvatarTooBig' : FieldTooLongResult } |
  { 'Success' : { 'channel_id' : ChannelId } } |
  { 'UserSuspended' : null } |
  { 'RulesTooShort' : FieldTooShortResult } |
  { 'CommunityFrozen' : null } |
  { 'NameTooLong' : FieldTooLongResult } |
  { 'NameTaken' : null };
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
export interface DeclineInvitationArgs { 'channel_id' : [] | [ChannelId] }
export type DeclineInvitationResponse = { 'NotInvited' : null } |
  { 'ChannelNotFound' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null };
export interface DeleteChannelArgs { 'channel_id' : ChannelId }
export type DeleteChannelResponse = { 'UserNotInChannel' : null } |
  { 'ChannelNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
export interface DeleteMessagesArgs {
  'channel_id' : ChannelId,
  'as_platform_moderator' : [] | [boolean],
  'message_ids' : Array<MessageId>,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type DeleteMessagesResponse = { 'UserNotInChannel' : null } |
  { 'MessageNotFound' : null } |
  { 'ChannelNotFound' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'NotPlatformModerator' : null } |
  { 'InternalError' : string };
export interface DeletedContent {
  'timestamp' : TimestampMillis,
  'deleted_by' : UserId,
}
export interface DeletedMessageArgs {
  'channel_id' : ChannelId,
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type DeletedMessageResponse = { 'UserNotInChannel' : null } |
  { 'MessageNotFound' : null } |
  { 'ChannelNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : { 'content' : MessageContent } } |
  { 'UserNotInCommunity' : null } |
  { 'MessageHardDeleted' : null } |
  { 'MessageNotDeleted' : null };
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
export type DisableInviteCodeResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
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
export interface EditMessageArgs {
  'channel_id' : ChannelId,
  'content' : MessageContentInitial,
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type EditMessageResponse = { 'UserNotInChannel' : null } |
  { 'MessageNotFound' : null } |
  { 'ChannelNotFound' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
export type EmptyArgs = {};
export type EnableInviteCodeResponse = { 'NotAuthorized' : null } |
  { 'Success' : { 'code' : bigint } } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
export type EventIndex = number;
export interface EventsArgs {
  'channel_id' : ChannelId,
  'latest_client_event_index' : [] | [EventIndex],
  'max_messages' : number,
  'max_events' : number,
  'ascending' : boolean,
  'thread_root_message_index' : [] | [MessageIndex],
  'start_index' : EventIndex,
}
export interface EventsByIndexArgs {
  'channel_id' : ChannelId,
  'latest_client_event_index' : [] | [EventIndex],
  'events' : Uint32Array | number[],
  'thread_root_message_index' : [] | [MessageIndex],
}
export type EventsResponse = { 'ThreadNotFound' : null } |
  { 'UserNotInChannel' : null } |
  { 'ReplicaNotUpToDate' : EventIndex } |
  { 'ChannelNotFound' : null } |
  { 'Success' : EventsSuccessResult } |
  { 'UserNotInCommunity' : null };
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
export interface EventsWindowArgs {
  'channel_id' : ChannelId,
  'latest_client_event_index' : [] | [EventIndex],
  'mid_point' : MessageIndex,
  'max_messages' : number,
  'max_events' : number,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type FailedCryptoTransaction = { 'NNS' : NnsFailedCryptoTransaction } |
  { 'SNS' : SnsFailedCryptoTransaction };
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
export type InviteCodeResponse = { 'NotAuthorized' : null } |
  { 'Success' : { 'code' : [] | [bigint] } } |
  { 'UserNotInCommunity' : null };
export interface JoinChannelArgs { 'channel_id' : ChannelId }
export type JoinChannelResponse = { 'NotInvited' : null } |
  { 'AlreadyInChannel' : CommunityCanisterChannelSummary } |
  { 'GateCheckFailed' : GateCheckFailedReason } |
  { 'ChannelNotFound' : null } |
  { 'UserLimitReached' : number } |
  { 'Success' : CommunityCanisterChannelSummary } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'InternalError' : string } |
  { 'UserBlocked' : null };
export interface LeaveChannelArgs { 'channel_id' : ChannelId }
export type LeaveChannelResponse = { 'UserNotInChannel' : null } |
  { 'LastOwnerCannotLeave' : null } |
  { 'ChannelNotFound' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
export type LocalUserIndexResponse = { 'Success' : CanisterId };
export interface MakeChannelPrivateArgs { 'channel_id' : ChannelId }
export type MakeChannelPrivateResponse = { 'UserNotInChannel' : null } |
  { 'ChannelNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'AlreadyPrivate' : null } |
  { 'CommunityFrozen' : null };
export type MakePrivateResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'AlreadyPrivate' : null } |
  { 'CommunityFrozen' : null } |
  { 'InternalError' : null };
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
export interface MessagesByMessageIndexArgs {
  'channel_id' : ChannelId,
  'latest_client_event_index' : [] | [EventIndex],
  'messages' : Uint32Array | number[],
  'thread_root_message_index' : [] | [MessageIndex],
}
export type MessagesByMessageIndexResponse = { 'ThreadNotFound' : null } |
  { 'UserNotInChannel' : null } |
  { 'ReplicaNotUpToDate' : EventIndex } |
  { 'ChannelNotFound' : null } |
  { 'Success' : MessagesSuccessResult } |
  { 'UserNotInCommunity' : null };
export interface MessagesSuccessResult {
  'messages' : Array<MessageEventWrapper>,
  'timestamp' : TimestampMillis,
  'latest_event_index' : EventIndex,
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
  'created' : TimestampNanos,
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
export interface OptionalCommunityPermissions {
  'create_public_channel' : [] | [CommunityPermissionRole],
  'block_users' : [] | [CommunityPermissionRole],
  'change_permissions' : [] | [CommunityPermissionRole],
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
export interface OwnershipTransferred {
  'old_owner' : UserId,
  'new_owner' : UserId,
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
export interface ParticipantAssumesSuperAdmin { 'user_id' : UserId }
export interface ParticipantDismissedAsSuperAdmin { 'user_id' : UserId }
export interface ParticipantJoined {
  'user_id' : UserId,
  'invited_by' : [] | [UserId],
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
export type PermissionRole = { 'Moderators' : null } |
  { 'Owner' : null } |
  { 'Admins' : null } |
  { 'Members' : null };
export interface PermissionsChanged {
  'changed_by' : UserId,
  'old_permissions' : GroupPermissions,
  'new_permissions' : GroupPermissions,
}
export interface PinMessageArgs {
  'channel_id' : ChannelId,
  'message_index' : MessageIndex,
}
export type PinMessageResponse = { 'UserNotInChannel' : null } |
  { 'MessageNotFound' : null } |
  { 'NoChange' : null } |
  { 'ChannelNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : PushEventResult } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
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
export interface ProposalUpdated {
  'event_index' : EventIndex,
  'message_index' : MessageIndex,
}
export interface ProposalsUpdated { 'proposals' : Array<ProposalUpdated> }
export interface PublicGroupSummary {
  'is_public' : boolean,
  'subtype' : [] | [GroupSubtype],
  'gate' : [] | [AccessGate],
  'name' : string,
  'wasm_version' : Version,
  'description' : string,
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
export interface RemoveMemberArgs { 'user_id' : UserId }
export interface RemoveMemberFromChannelArgs {
  'channel_id' : ChannelId,
  'user_id' : UserId,
}
export type RemoveMemberFromChannelResponse = { 'UserNotInChannel' : null } |
  { 'ChannelNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'TargetUserNotInCommunity' : null } |
  { 'TargetUserNotInChannel' : null } |
  { 'CannotRemoveSelf' : null };
export type RemoveMemberResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'TargetUserNotInCommunity' : null } |
  { 'CannotRemoveSelf' : null } |
  { 'CannotRemoveUser' : null } |
  { 'InternalError' : string };
export interface RemoveReactionArgs {
  'channel_id' : ChannelId,
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
  'reaction' : string,
}
export type RemoveReactionResponse = { 'UserNotInChannel' : null } |
  { 'MessageNotFound' : null } |
  { 'NoChange' : null } |
  { 'ChannelNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
export interface ReplyContext {
  'event_list_if_other' : [] | [[ChatId, [] | [MessageIndex]]],
  'chat_id_if_other' : [] | [ChatId],
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
export interface RulesArgs { 'invite_code' : [] | [bigint] }
export type RulesResponse = { 'NotAuthorized' : null } |
  { 'Success' : { 'rules' : [] | [string] } };
export interface SearchChannelArgs {
  'channel_id' : ChannelId,
  'max_results' : number,
  'users' : [] | [Array<UserId>],
  'search_term' : string,
}
export type SearchChannelResponse = { 'TermTooShort' : number } |
  { 'UserNotInChannel' : null } |
  { 'ChannelNotFound' : null } |
  { 'TooManyUsers' : number } |
  { 'Success' : { 'matches' : Array<MessageMatch> } } |
  { 'UserNotInCommunity' : null } |
  { 'TermTooLong' : number } |
  { 'InvalidTerm' : null };
export interface SelectedChannelInitialArgs { 'channel_id' : ChannelId }
export type SelectedChannelInitialResponse = { 'UserNotInChannel' : null } |
  { 'ChannelNotFound' : null } |
  {
    'Success' : {
      'members' : Array<Participant>,
      'invited_users' : Array<UserId>,
      'blocked_users' : Array<UserId>,
      'timestamp' : TimestampMillis,
      'pinned_messages' : Uint32Array | number[],
      'latest_event_index' : EventIndex,
      'rules' : AccessRules,
    }
  } |
  { 'UserNotInCommunity' : null };
export interface SelectedChannelUpdatesArgs {
  'channel_id' : ChannelId,
  'updates_since' : TimestampMillis,
}
export type SelectedChannelUpdatesResponse = { 'UserNotInChannel' : null } |
  { 'ChannelNotFound' : null } |
  { 'Success' : SelectedGroupUpdates } |
  { 'UserNotInCommunity' : null } |
  { 'SuccessNoUpdates' : null };
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
export interface SendMessageArgs {
  'channel_id' : ChannelId,
  'content' : MessageContentInitial,
  'mentioned' : Array<User>,
  'forwarding' : boolean,
  'sender_name' : string,
  'message_id' : MessageId,
  'replies_to' : [] | [GroupReplyContext],
  'thread_root_message_index' : [] | [MessageIndex],
}
export type SendMessageResponse = { 'TextTooLong' : number } |
  { 'ThreadMessageNotFound' : null } |
  { 'UserNotInChannel' : null } |
  { 'ChannelNotFound' : null } |
  { 'NotAuthorized' : null } |
  {
    'Success' : {
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'expires_at' : [] | [TimestampMillis],
      'message_index' : MessageIndex,
    }
  } |
  { 'UserNotInCommunity' : null } |
  { 'MessageEmpty' : null } |
  { 'InvalidPoll' : InvalidPollReason } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'InvalidRequest' : string };
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
  'memo' : [] | [Memo],
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
export type SummaryResponse = {
    'Success' : { 'summary' : CommunityCanisterCommunitySummary }
  } |
  { 'UserNotInCommunity' : null };
export interface SummaryUpdatesArgs { 'updates_since' : TimestampMillis }
export type SummaryUpdatesResponse = {
    'Success' : { 'updates' : CommunityCanisterCommunitySummaryUpdates }
  } |
  { 'UserNotInCommunity' : null } |
  { 'SuccessNoUpdates' : null };
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
export interface ToggleMuteChannelNotificationsArgs {
  'channel_id' : ChannelId,
  'mute' : boolean,
}
export type ToggleMuteChannelNotificationsResponse = {
    'UserNotInChannel' : null
  } |
  { 'ChannelNotFound' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
export interface ToggleMuteNotificationsArgs { 'mute' : boolean }
export type ToggleMuteNotificationsResponse = { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
export interface Tokens { 'e8s' : bigint }
export type TotalPollVotes = { 'Anonymous' : Array<[number, number]> } |
  { 'Visible' : Array<[number, Array<UserId>]> } |
  { 'Hidden' : number };
export type TransactionHash = Uint8Array | number[];
export interface UnblockUserArgs { 'user_id' : UserId }
export type UnblockUserResponse = { 'CannotUnblockSelf' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'CommunityNotPublic' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
export interface UndeleteMessagesArgs {
  'channel_id' : ChannelId,
  'message_ids' : Array<MessageId>,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type UndeleteMessagesResponse = { 'GroupNotFound' : null } |
  { 'UserNotInChannel' : null } |
  { 'MessageNotFound' : null } |
  { 'Success' : { 'messages' : Array<Message> } } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null };
export interface UpdateChannelArgs {
  'channel_id' : ChannelId,
  'permissions' : [] | [OptionalGroupPermissions],
  'gate' : AccessGateUpdate,
  'name' : [] | [string],
  'description' : [] | [string],
  'rules' : [] | [AccessRules],
  'avatar' : DocumentUpdate,
}
export type UpdateChannelResponse = { 'NameReserved' : null } |
  { 'RulesTooLong' : FieldTooLongResult } |
  { 'DescriptionTooLong' : FieldTooLongResult } |
  { 'NameTooShort' : FieldTooShortResult } |
  { 'UserNotInChannel' : null } |
  { 'ChannelNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'AvatarTooBig' : FieldTooLongResult } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'RulesTooShort' : FieldTooShortResult } |
  { 'CommunityFrozen' : null } |
  { 'NameTooLong' : FieldTooLongResult } |
  { 'NameTaken' : null };
export interface UpdateCommunityArgs {
  'permissions' : [] | [OptionalCommunityPermissions],
  'gate' : AccessGateUpdate,
  'name' : [] | [string],
  'banner' : DocumentUpdate,
  'description' : [] | [string],
  'rules' : [] | [AccessRules],
  'avatar' : DocumentUpdate,
}
export type UpdateCommunityResponse = { 'NameReserved' : null } |
  { 'RulesTooLong' : FieldTooLongResult } |
  { 'DescriptionTooLong' : FieldTooLongResult } |
  { 'NameTooShort' : FieldTooShortResult } |
  { 'NotAuthorized' : null } |
  { 'AvatarTooBig' : FieldTooLongResult } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'UserSuspended' : null } |
  { 'RulesTooShort' : FieldTooShortResult } |
  { 'CommunityFrozen' : null } |
  { 'NameTooLong' : FieldTooLongResult } |
  { 'NameTaken' : null } |
  { 'InternalError' : null } |
  { 'BannerTooBig' : FieldTooLongResult };
export interface UpdatedMessage {
  'updated_by' : UserId,
  'message_id' : MessageId,
  'event_index' : EventIndex,
}
export interface User { 'username' : string, 'user_id' : UserId }
export interface UserFailedError { 'user_id' : UserId, 'error' : string }
export interface UserFailedGateCheck {
  'user_id' : UserId,
  'reason' : GateCheckFailedReason,
}
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
  'add_members_to_channel' : ActorMethod<
    [AddMembersToChannelArgs],
    AddMembersToChannelResponse
  >,
  'add_reaction' : ActorMethod<[AddReactionArgs], AddReactionResponse>,
  'block_user' : ActorMethod<[BlockUserArgs], BlockUserResponse>,
  'change_channel_role' : ActorMethod<
    [ChangeChannelRoleArgs],
    ChangeChannelRoleResponse
  >,
  'change_role' : ActorMethod<[ChangeRoleArgs], ChangeRoleResponse>,
  'create_channel' : ActorMethod<[CreateChannelArgs], CreateChannelResponse>,
  'decline_invitation' : ActorMethod<
    [DeclineInvitationArgs],
    DeclineInvitationResponse
  >,
  'delete_channel' : ActorMethod<[DeleteChannelArgs], DeleteChannelResponse>,
  'delete_messages' : ActorMethod<[DeleteMessagesArgs], DeleteMessagesResponse>,
  'deleted_message' : ActorMethod<[DeletedMessageArgs], DeletedMessageResponse>,
  'disable_invite_code' : ActorMethod<[EmptyArgs], DisableInviteCodeResponse>,
  'edit_message' : ActorMethod<[EditMessageArgs], EditMessageResponse>,
  'enable_invite_code' : ActorMethod<[EmptyArgs], EnableInviteCodeResponse>,
  'events' : ActorMethod<[EventsArgs], EventsResponse>,
  'events_by_index' : ActorMethod<[EventsByIndexArgs], EventsResponse>,
  'events_window' : ActorMethod<[EventsWindowArgs], EventsResponse>,
  'invite_code' : ActorMethod<[EmptyArgs], InviteCodeResponse>,
  'join_channel' : ActorMethod<[JoinChannelArgs], JoinChannelResponse>,
  'leave_channel' : ActorMethod<[LeaveChannelArgs], LeaveChannelResponse>,
  'local_user_index' : ActorMethod<[EmptyArgs], LocalUserIndexResponse>,
  'make_channel_private' : ActorMethod<
    [MakeChannelPrivateArgs],
    MakeChannelPrivateResponse
  >,
  'make_private' : ActorMethod<[EmptyArgs], MakePrivateResponse>,
  'messages_by_message_index' : ActorMethod<
    [MessagesByMessageIndexArgs],
    MessagesByMessageIndexResponse
  >,
  'pin_message' : ActorMethod<[PinMessageArgs], PinMessageResponse>,
  'remove_member' : ActorMethod<[RemoveMemberArgs], RemoveMemberResponse>,
  'remove_member_from_channel' : ActorMethod<
    [RemoveMemberFromChannelArgs],
    RemoveMemberFromChannelResponse
  >,
  'remove_reaction' : ActorMethod<[RemoveReactionArgs], RemoveReactionResponse>,
  'reset_invite_code' : ActorMethod<[EmptyArgs], EnableInviteCodeResponse>,
  'rules' : ActorMethod<[RulesArgs], RulesResponse>,
  'search_channel' : ActorMethod<[SearchChannelArgs], SearchChannelResponse>,
  'selected_channel_initial' : ActorMethod<
    [SelectedChannelInitialArgs],
    SelectedChannelInitialResponse
  >,
  'selected_channel_updates' : ActorMethod<
    [SelectedChannelUpdatesArgs],
    SelectedChannelUpdatesResponse
  >,
  'send_message' : ActorMethod<[SendMessageArgs], SendMessageResponse>,
  'summary' : ActorMethod<[EmptyArgs], SummaryResponse>,
  'summary_updates' : ActorMethod<[SummaryUpdatesArgs], SummaryUpdatesResponse>,
  'toggle_mute_channel_notifications' : ActorMethod<
    [ToggleMuteChannelNotificationsArgs],
    ToggleMuteChannelNotificationsResponse
  >,
  'toggle_mute_notifications' : ActorMethod<
    [ToggleMuteNotificationsArgs],
    ToggleMuteNotificationsResponse
  >,
  'unblock_user' : ActorMethod<[UnblockUserArgs], UnblockUserResponse>,
  'undelete_messages' : ActorMethod<
    [UndeleteMessagesArgs],
    UndeleteMessagesResponse
  >,
  'update_channel' : ActorMethod<[UpdateChannelArgs], UpdateChannelResponse>,
  'update_community' : ActorMethod<
    [UpdateCommunityArgs],
    UpdateCommunityResponse
  >,
}
