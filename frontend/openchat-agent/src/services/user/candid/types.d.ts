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
export interface AddHotGroupExclusionsArgs {
  'duration' : [] | [Milliseconds],
  'groups' : Array<ChatId>,
}
export type AddHotGroupExclusionsResponse = { 'Success' : null };
export interface AddReactionArgs {
  'username' : string,
  'user_id' : UserId,
  'correlation_id' : bigint,
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
  'reaction' : string,
}
export type AddReactionResponse = { 'MessageNotFound' : null } |
  { 'NoChange' : null } |
  { 'ChatNotFound' : null } |
  { 'Success' : null } |
  { 'UserSuspended' : null } |
  { 'InvalidReaction' : null } |
  { 'SuccessV2' : PushEventResult };
export interface AddedToGroupNotification {
  'added_by_name' : string,
  'added_by' : UserId,
  'timestamp' : TimestampMillis,
  'chat_id' : ChatId,
  'group_name' : string,
}
export interface ArchiveChatArgs { 'chat_id' : ChatId }
export type ArchiveChatResponse = { 'ChatNotFound' : null } |
  { 'Success' : null };
export interface ArchiveUnarchiveChatsArgs {
  'to_archive' : Array<Chat>,
  'to_unarchive' : Array<Chat>,
}
export type ArchiveUnarchiveChatsResponse = {
    'PartialSuccess' : { 'chats_not_found' : Array<Chat> }
  } |
  { 'Success' : null } |
  { 'UserSuspended' : null } |
  { 'Failure' : null };
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
export type BioArgs = {};
export type BioResponse = { 'Success' : string };
export interface BlobReference {
  'blob_id' : bigint,
  'canister_id' : CanisterId,
}
export type BlockIndex = bigint;
export interface BlockUserArgs { 'user_id' : UserId }
export type BlockUserResponse = { 'Success' : null } |
  { 'UserSuspended' : null };
export interface CachedGroupChatSummaries {
  'summaries' : Array<GroupChatSummary>,
  'timestamp' : TimestampMillis,
}
export interface CancelMessageReminderArgs { 'reminder_id' : bigint }
export type CancelMessageReminderResponse = { 'Success' : null };
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
export interface ChannelMessagesRead {
  'channel_id' : ChannelId,
  'threads' : Array<ThreadRead>,
  'read_up_to' : [] | [MessageIndex],
  'date_read_pinned' : [] | [TimestampMillis],
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
export type ChatInList = { 'Group' : ChatId } |
  { 'Favourite' : Chat } |
  { 'Direct' : ChatId } |
  { 'Community' : [CommunityId, ChannelId] };
export interface ChatMessagesRead {
  'threads' : Array<ThreadRead>,
  'read_up_to' : [] | [MessageIndex],
  'chat_id' : ChatId,
  'date_read_pinned' : [] | [TimestampMillis],
}
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
export interface CommunitiesInitial {
  'summaries' : Array<UserCanisterCommunitySummary>,
}
export interface CommunitiesUpdates {
  'added' : Array<UserCanisterCommunitySummary>,
  'updated' : Array<UserCanisterCommunitySummaryUpdates>,
  'removed' : Array<CommunityId>,
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
  'banner_id' : [] | [bigint],
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
export interface CommunityMessagesRead {
  'community_id' : CommunityId,
  'channels_read' : Array<ChannelMessagesRead>,
}
export type CommunityPermissionRole = { 'Owners' : null } |
  { 'Admins' : null } |
  { 'Members' : null };
export interface CommunityPermissions {
  'create_public_channel' : CommunityPermissionRole,
  'block_users' : CommunityPermissionRole,
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
export interface Contact { 'nickname' : [] | [string], 'user_id' : UserId }
export type ContactsArgs = {};
export type ContactsResponse = { 'Success' : { 'contacts' : Array<Contact> } };
export interface CreateCommunityArgs {
  'is_public' : boolean,
  'permissions' : [] | [CommunityPermissions],
  'gate' : [] | [AccessGate],
  'name' : string,
  'banner' : [] | [Document],
  'description' : string,
  'history_visible_to_new_joiners' : boolean,
  'default_channels' : Array<string>,
  'rules' : AccessRules,
  'avatar' : [] | [Document],
  'primary_language' : string,
}
export type CreateCommunityResponse = { 'DefaultChannelsInvalid' : null } |
  { 'NameReserved' : null } |
  { 'RulesTooLong' : FieldTooLongResult } |
  { 'DescriptionTooLong' : FieldTooLongResult } |
  { 'NameTooShort' : FieldTooShortResult } |
  { 'Throttled' : null } |
  { 'AvatarTooBig' : FieldTooLongResult } |
  { 'Success' : CreateCommunitySuccessResult } |
  { 'Unauthorized' : null } |
  { 'UserSuspended' : null } |
  { 'RulesTooShort' : FieldTooShortResult } |
  { 'NameTooLong' : FieldTooLongResult } |
  { 'NameTaken' : null } |
  { 'InternalError' : string } |
  { 'MaxCommunitiesCreated' : number } |
  { 'BannerTooBig' : FieldTooLongResult };
export interface CreateCommunitySuccessResult { 'community_id' : CommunityId }
export interface CreateGroupArgs {
  'is_public' : boolean,
  'permissions' : [] | [GroupPermissions],
  'gate' : [] | [AccessGate],
  'name' : string,
  'description' : string,
  'history_visible_to_new_joiners' : boolean,
  'rules' : AccessRules,
  'avatar' : [] | [Document],
}
export type CreateGroupResponse = { 'NameReserved' : null } |
  { 'RulesTooLong' : FieldTooLongResult } |
  { 'DescriptionTooLong' : FieldTooLongResult } |
  { 'NameTooShort' : FieldTooShortResult } |
  { 'Throttled' : null } |
  { 'AvatarTooBig' : FieldTooLongResult } |
  { 'Success' : CreateGroupSuccessResult } |
  { 'UserSuspended' : null } |
  { 'RulesTooShort' : FieldTooShortResult } |
  { 'NameTooLong' : FieldTooLongResult } |
  { 'NameTaken' : null } |
  { 'MaxGroupsCreated' : number } |
  { 'InternalError' : null } |
  { 'UnauthorizedToCreatePublicGroup' : null };
export interface CreateGroupSuccessResult { 'chat_id' : ChatId }
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
export interface DeleteCommunityArgs { 'community_id' : CommunityId }
export type DeleteCommunityResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'InternalError' : string };
export interface DeleteGroupArgs { 'chat_id' : ChatId }
export type DeleteGroupResponse = { 'ChatFrozen' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'UserSuspended' : null } |
  { 'InternalError' : string };
export interface DeleteMessagesArgs {
  'user_id' : UserId,
  'message_ids' : Array<MessageId>,
  'correlation_id' : bigint,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type DeleteMessagesResponse = { 'ChatNotFound' : null } |
  { 'Success' : null } |
  { 'UserSuspended' : null };
export interface DeletedContent {
  'timestamp' : TimestampMillis,
  'deleted_by' : UserId,
}
export interface DeletedMessageArgs {
  'user_id' : UserId,
  'message_id' : MessageId,
}
export type DeletedMessageResponse = { 'MessageNotFound' : null } |
  { 'ChatNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : { 'content' : MessageContent } } |
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
export interface DirectChatsInitial {
  'summaries' : Array<DirectChatSummary>,
  'pinned' : Array<ChatId>,
}
export interface DirectChatsUpdates {
  'added' : Array<DirectChatSummary>,
  'pinned' : [] | [Array<ChatId>],
  'updated' : Array<DirectChatSummaryUpdates>,
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
export type EditMessageResponse = { 'MessageNotFound' : null } |
  { 'ChatNotFound' : null } |
  { 'Success' : null } |
  { 'UserSuspended' : null } |
  { 'UserBlocked' : null };
export interface EditMessageV2Args {
  'content' : MessageContentInitial,
  'user_id' : UserId,
  'correlation_id' : bigint,
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type EmptyArgs = {};
export type EventIndex = number;
export interface EventsArgs {
  'latest_client_event_index' : [] | [EventIndex],
  'user_id' : UserId,
  'max_messages' : number,
  'max_events' : number,
  'ascending' : boolean,
  'thread_root_message_index' : [] | [MessageIndex],
  'start_index' : EventIndex,
}
export interface EventsByIndexArgs {
  'latest_client_event_index' : [] | [EventIndex],
  'user_id' : UserId,
  'events' : Uint32Array | number[],
  'thread_root_message_index' : [] | [MessageIndex],
}
export type EventsResponse = { 'ReplicaNotUpToDate' : EventIndex } |
  { 'ChatNotFound' : null } |
  { 'Success' : EventsSuccessResult };
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
  'latest_client_event_index' : [] | [EventIndex],
  'mid_point' : MessageIndex,
  'user_id' : UserId,
  'max_messages' : number,
  'max_events' : number,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type FailedCryptoTransaction = { 'NNS' : NnsFailedCryptoTransaction } |
  { 'SNS' : SnsFailedCryptoTransaction } |
  { 'ICRC1' : Icrc1FailedCryptoTransaction };
export interface FavouriteChatsInitial {
  'chats' : Array<Chat>,
  'pinned' : Array<Chat>,
}
export interface FavouriteChatsUpdates {
  'chats' : [] | [Array<Chat>],
  'pinned' : [] | [Array<Chat>],
}
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
export interface GroupChatsInitial {
  'summaries' : Array<UserCanisterGroupChatSummary>,
  'pinned' : Array<ChatId>,
  'cached' : [] | [CachedGroupChatSummaries],
}
export interface GroupChatsUpdates {
  'added' : Array<UserCanisterGroupChatSummary>,
  'pinned' : [] | [Array<ChatId>],
  'updated' : Array<UserCanisterGroupChatSummaryUpdates>,
  'removed' : Array<ChatId>,
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
export type HotGroupExclusionsArgs = {};
export type HotGroupExclusionsResponse = { 'Success' : Array<ChatId> };
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
export interface InitUserPrincipalMigrationArgs { 'new_principal' : Principal }
export type InitUserPrincipalMigrationResponse = { 'Success' : null };
export interface InitialStateArgs { 'disable_cache' : [] | [boolean] }
export type InitialStateResponse = {
    'Success' : {
      'communities' : CommunitiesInitial,
      'blocked_users' : Array<UserId>,
      'favourite_chats' : FavouriteChatsInitial,
      'group_chats' : GroupChatsInitial,
      'avatar_id' : [] | [bigint],
      'direct_chats' : DirectChatsInitial,
      'timestamp' : TimestampMillis,
    }
  };
export interface InitialStateV2Args { 'disable_cache' : [] | [boolean] }
export type InitialStateV2Response = {
    'SuccessCached' : {
      'user_canister_wasm_version' : Version,
      'blocked_users' : Array<UserId>,
      'group_chats_added' : Array<UserCanisterGroupChatSummary>,
      'avatar_id' : [] | [bigint],
      'direct_chats' : Array<DirectChatSummary>,
      'timestamp' : TimestampMillis,
      'cached_group_chat_summaries' : Array<GroupChatSummary>,
      'cache_timestamp' : TimestampMillis,
      'pinned_chats' : Array<ChatId>,
    }
  } |
  {
    'Success' : {
      'user_canister_wasm_version' : Version,
      'blocked_users' : Array<UserId>,
      'group_chats' : Array<UserCanisterGroupChatSummary>,
      'avatar_id' : [] | [bigint],
      'direct_chats' : Array<DirectChatSummary>,
      'timestamp' : TimestampMillis,
      'pinned_chats' : Array<ChatId>,
    }
  };
export type InvalidPollReason = { 'DuplicateOptions' : null } |
  { 'TooFewOptions' : number } |
  { 'TooManyOptions' : number } |
  { 'OptionTooLong' : number } |
  { 'EndDateInThePast' : null } |
  { 'PollsNotValidForDirectChats' : null };
export interface LeaveCommunityArgs { 'community_id' : CommunityId }
export type LeaveCommunityResponse = { 'CommunityNotFound' : null } |
  { 'LastOwnerCannotLeave' : null } |
  { 'Success' : null } |
  { 'UserNotInCommunity' : null } |
  { 'CommunityNotPublic' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'InternalError' : string };
export interface LeaveGroupArgs {
  'correlation_id' : bigint,
  'chat_id' : ChatId,
}
export type LeaveGroupResponse = { 'GroupNotFound' : null } |
  { 'GroupNotPublic' : null } |
  { 'OwnerCannotLeave' : null } |
  { 'CallerNotInGroup' : null } |
  { 'ChatFrozen' : null } |
  { 'Success' : null } |
  { 'UserSuspended' : null } |
  { 'InternalError' : string };
export interface ManageFavouriteChatsArgs {
  'to_add' : Array<Chat>,
  'to_remove' : Array<Chat>,
}
export type ManageFavouriteChatsResponse = { 'Success' : null } |
  { 'UserSuspended' : null };
export interface MarkReadArgs {
  'community_messages_read' : Array<CommunityMessagesRead>,
  'messages_read' : Array<ChatMessagesRead>,
}
export type MarkReadResponse = { 'Success' : null };
export interface MarkReadV2Args { 'messages_read' : Array<ChatMessagesRead> }
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
export interface MessagesByMessageIndexArgs {
  'latest_client_event_index' : [] | [EventIndex],
  'messages' : Uint32Array | number[],
  'user_id' : UserId,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type MessagesByMessageIndexResponse = {
    'ReplicaNotUpToDate' : EventIndex
  } |
  { 'ChatNotFound' : null } |
  {
    'Success' : {
      'messages' : Array<MessageEventWrapper>,
      'latest_event_index' : EventIndex,
    }
  };
export interface MessagesSuccessResult {
  'messages' : Array<MessageEventWrapper>,
  'timestamp' : TimestampMillis,
  'latest_event_index' : EventIndex,
}
export type MigrateUserPrincipalArgs = {};
export type MigrateUserPrincipalResponse = { 'PrincipalAlreadyInUse' : null } |
  { 'MigrationAlreadyInProgress' : null } |
  { 'Success' : null } |
  { 'InternalError' : string } |
  { 'MigrationNotInitialized' : null };
export type Milliseconds = bigint;
export type MultiUserChat = { 'Group' : ChatId } |
  { 'Channel' : [CommunityId, ChannelId] };
export interface MuteNotificationsArgs { 'chat_id' : ChatId }
export type MuteNotificationsResponse = { 'ChatNotFound' : null } |
  { 'Success' : null } |
  { 'InternalError' : string };
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
  'block_users' : [] | [CommunityPermissionRole],
  'update_details' : [] | [CommunityPermissionRole],
  'remove_members' : [] | [CommunityPermissionRole],
  'invite_users' : [] | [CommunityPermissionRole],
  'change_roles' : [] | [CommunityPermissionRole],
  'create_private_channel' : [] | [CommunityPermissionRole],
}
export interface OptionalContact { 'nickname' : TextUpdate, 'user_id' : UserId }
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
export interface PinChatRequest { 'chat_id' : ChatId }
export type PinChatResponse = { 'Success' : null } |
  { 'PinnedLimitReached' : number };
export interface PinChatV2Request { 'chat' : ChatInList }
export type PinChatV2Response = { 'ChatNotFound' : null } |
  { 'Success' : null };
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
  'last_updated' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'frozen' : [] | [FrozenGroupInfo],
  'latest_event_index' : EventIndex,
  'history_visible_to_new_joiners' : boolean,
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
export interface PushEventResult {
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
  'expires_at' : [] | [TimestampMillis],
}
export type RegistrationFee = { 'ICP' : ICPRegistrationFee } |
  { 'Cycles' : CyclesRegistrationFee };
export interface RemoveReactionArgs {
  'user_id' : UserId,
  'correlation_id' : bigint,
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
  'reaction' : string,
}
export type RemoveReactionResponse = { 'MessageNotFound' : null } |
  { 'NoChange' : null } |
  { 'ChatNotFound' : null } |
  { 'Success' : null } |
  { 'UserSuspended' : null } |
  { 'SuccessV2' : PushEventResult };
export interface ReplyContext {
  'chat_if_other' : [] | [[Chat, [] | [MessageIndex]]],
  'event_list_if_other' : [] | [[ChatId, [] | [MessageIndex]]],
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
export type SendMessageResponse = { 'TextTooLong' : number } |
  {
    'TransferSuccessV2' : {
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptoTransaction,
      'expires_at' : [] | [TimestampMillis],
      'message_index' : MessageIndex,
    }
  } |
  { 'TransferCannotBeZero' : null } |
  {
    'Success' : {
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'expires_at' : [] | [TimestampMillis],
      'message_index' : MessageIndex,
    }
  } |
  { 'MessageEmpty' : null } |
  { 'InvalidPoll' : InvalidPollReason } |
  { 'RecipientBlocked' : null } |
  { 'UserSuspended' : null } |
  { 'InvalidRequest' : string } |
  { 'TransferFailed' : string } |
  { 'InternalError' : string } |
  { 'RecipientNotFound' : null };
export interface SendMessageV2Args {
  'content' : MessageContentInitial,
  'recipient' : UserId,
  'forwarding' : boolean,
  'sender_name' : string,
  'correlation_id' : bigint,
  'message_id' : MessageId,
  'replies_to' : [] | [ReplyContext],
  'thread_root_message_index' : [] | [MessageIndex],
}
export interface SendMessageWithTransferToChannelArgs {
  'channel_id' : ChannelId,
  'community_id' : CommunityId,
  'content' : MessageContentInitial,
  'mentioned' : Array<User>,
  'sender_name' : string,
  'message_id' : MessageId,
  'replies_to' : [] | [GroupReplyContext],
  'thread_root_message_index' : [] | [MessageIndex],
}
export type SendMessageWithTransferToChannelResponse = {
    'TextTooLong' : number
  } |
  { 'UserNotInChannel' : CompletedCryptoTransaction } |
  { 'ChannelNotFound' : CompletedCryptoTransaction } |
  { 'TransferCannotBeZero' : null } |
  {
    'Success' : {
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptoTransaction,
      'expires_at' : [] | [TimestampMillis],
      'message_index' : MessageIndex,
    }
  } |
  { 'UserNotInCommunity' : [] | [CompletedCryptoTransaction] } |
  { 'RecipientBlocked' : null } |
  { 'UserSuspended' : null } |
  { 'CommunityFrozen' : null } |
  { 'InvalidRequest' : string } |
  { 'TransferFailed' : string } |
  { 'InternalError' : [string, CompletedCryptoTransaction] } |
  { 'CryptocurrencyNotSupported' : Cryptocurrency };
export interface SendMessageWithTransferToGroupArgs {
  'content' : MessageContentInitial,
  'mentioned' : Array<User>,
  'group_id' : ChatId,
  'sender_name' : string,
  'correlation_id' : bigint,
  'message_id' : MessageId,
  'replies_to' : [] | [GroupReplyContext],
  'thread_root_message_index' : [] | [MessageIndex],
}
export type SendMessageWithTransferToGroupResponse = {
    'TextTooLong' : number
  } |
  { 'CallerNotInGroup' : [] | [CompletedCryptoTransaction] } |
  { 'ChatFrozen' : null } |
  { 'TransferCannotBeZero' : null } |
  {
    'Success' : {
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptoTransaction,
      'expires_at' : [] | [TimestampMillis],
      'message_index' : MessageIndex,
    }
  } |
  { 'RecipientBlocked' : null } |
  { 'UserSuspended' : null } |
  { 'InvalidRequest' : string } |
  { 'TransferFailed' : string } |
  { 'InternalError' : [string, CompletedCryptoTransaction] } |
  { 'CryptocurrencyNotSupported' : Cryptocurrency };
export interface SetAvatarArgs { 'avatar' : [] | [Document] }
export type SetAvatarResponse = { 'AvatarTooBig' : FieldTooLongResult } |
  { 'Success' : null } |
  { 'UserSuspended' : null };
export interface SetBioArgs { 'text' : string }
export type SetBioResponse = { 'TooLong' : FieldTooLongResult } |
  { 'Success' : null } |
  { 'UserSuspended' : null };
export interface SetContactArgs { 'contact' : OptionalContact }
export type SetContactResponse = { 'NoChange' : null } |
  { 'NicknameTooLong' : FieldTooLongResult } |
  { 'Success' : null } |
  { 'UserSuspended' : null } |
  { 'NicknameTooShort' : FieldTooShortResult };
export interface SetMessageReminderArgs {
  'notes' : [] | [string],
  'remind_at' : TimestampMillis,
  'chat_id' : ChatId,
  'event_index' : EventIndex,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type SetMessageReminderResponse = {
    'NotesTooLong' : FieldTooLongResult
  } |
  { 'Success' : bigint } |
  { 'ReminderDateInThePast' : null } |
  { 'UserSuspended' : null };
export interface SetMessageReminderV2Args {
  'chat' : Chat,
  'notes' : [] | [string],
  'remind_at' : TimestampMillis,
  'event_index' : EventIndex,
  'thread_root_message_index' : [] | [MessageIndex],
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
export interface UnArchiveChatArgs { 'chat_id' : ChatId }
export type UnArchiveChatResponse = { 'ChatNotFound' : null } |
  { 'Success' : null };
export interface UnblockUserArgs { 'user_id' : UserId }
export type UnblockUserResponse = { 'Success' : null } |
  { 'UserSuspended' : null };
export interface UndeleteMessagesArgs {
  'user_id' : UserId,
  'message_ids' : Array<MessageId>,
  'correlation_id' : bigint,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type UndeleteMessagesResponse = { 'ChatNotFound' : null } |
  { 'Success' : { 'messages' : Array<Message> } } |
  { 'UserSuspended' : null };
export interface UnmuteNotificationsArgs { 'chat_id' : ChatId }
export type UnmuteNotificationsResponse = { 'ChatNotFound' : null } |
  { 'Success' : null } |
  { 'InternalError' : string };
export interface UnpinChatRequest { 'chat_id' : ChatId }
export type UnpinChatResponse = { 'Success' : null };
export interface UnpinChatV2Request { 'chat' : ChatInList }
export type UnpinChatV2Response = { 'ChatNotFound' : null } |
  { 'Success' : null };
export interface UpdatesArgs { 'updates_since' : TimestampMillis }
export type UpdatesResponse = {
    'Success' : {
      'communities' : CommunitiesUpdates,
      'blocked_users' : [] | [Array<UserId>],
      'favourite_chats' : FavouriteChatsUpdates,
      'group_chats' : GroupChatsUpdates,
      'avatar_id' : DocumentIdUpdate,
      'direct_chats' : DirectChatsUpdates,
      'timestamp' : TimestampMillis,
    }
  } |
  { 'SuccessNoUpdates' : null };
export interface UpdatesV2Args { 'updates_since' : TimestampMillis }
export type UpdatesV2Response = {
    'Success' : {
      'user_canister_wasm_version' : [] | [Version],
      'direct_chats_added' : Array<DirectChatSummary>,
      'blocked_users_v2' : [] | [Array<UserId>],
      'group_chats_added' : Array<UserCanisterGroupChatSummary>,
      'avatar_id' : DocumentIdUpdate,
      'chats_removed' : Array<ChatId>,
      'timestamp' : TimestampMillis,
      'group_chats_updated' : Array<UserCanisterGroupChatSummaryUpdates>,
      'direct_chats_updated' : Array<DirectChatSummaryUpdates>,
      'pinned_chats' : [] | [Array<ChatId>],
    }
  } |
  { 'SuccessNoUpdates' : null };
export interface User { 'username' : string, 'user_id' : UserId }
export interface UserCanisterChannelSummary {
  'channel_id' : ChannelId,
  'read_by_me_up_to' : [] | [MessageIndex],
  'date_read_pinned' : [] | [TimestampMillis],
  'threads_read' : Array<[MessageIndex, MessageIndex]>,
  'archived' : boolean,
}
export interface UserCanisterChannelSummaryUpdates {
  'channel_id' : ChannelId,
  'read_by_me_up_to' : [] | [MessageIndex],
  'date_read_pinned' : [] | [TimestampMillis],
  'threads_read' : Array<[MessageIndex, MessageIndex]>,
  'archived' : [] | [boolean],
}
export interface UserCanisterCommunitySummary {
  'community_id' : CommunityId,
  'channels' : Array<UserCanisterChannelSummary>,
  'pinned' : Array<ChannelId>,
  'archived' : boolean,
}
export interface UserCanisterCommunitySummaryUpdates {
  'community_id' : CommunityId,
  'channels' : Array<UserCanisterChannelSummaryUpdates>,
  'pinned' : [] | [Array<ChannelId>],
  'archived' : [] | [boolean],
}
export interface UserCanisterGroupChatSummary {
  'read_by_me_up_to' : [] | [MessageIndex],
  'chat_id' : ChatId,
  'date_read_pinned' : [] | [TimestampMillis],
  'threads_read' : Array<[MessageIndex, MessageIndex]>,
  'archived' : boolean,
}
export interface UserCanisterGroupChatSummaryUpdates {
  'read_by_me_up_to' : [] | [MessageIndex],
  'chat_id' : ChatId,
  'date_read_pinned' : [] | [TimestampMillis],
  'threads_read' : Array<[MessageIndex, MessageIndex]>,
  'archived' : [] | [boolean],
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
export interface WithdrawCryptoArgs { 'withdrawal' : PendingCryptoTransaction }
export type WithdrawCryptoResponse = { 'CurrencyNotSupported' : null } |
  { 'TransactionFailed' : FailedCryptoTransaction } |
  { 'Success' : CompletedCryptoTransaction };
export interface _SERVICE {
  'add_hot_group_exclusions' : ActorMethod<
    [AddHotGroupExclusionsArgs],
    AddHotGroupExclusionsResponse
  >,
  'add_reaction' : ActorMethod<[AddReactionArgs], AddReactionResponse>,
  'archive_chat' : ActorMethod<[ArchiveChatArgs], ArchiveChatResponse>,
  'archive_unarchive_chats' : ActorMethod<
    [ArchiveUnarchiveChatsArgs],
    ArchiveUnarchiveChatsResponse
  >,
  'bio' : ActorMethod<[BioArgs], BioResponse>,
  'block_user' : ActorMethod<[BlockUserArgs], BlockUserResponse>,
  'cancel_message_reminder' : ActorMethod<
    [CancelMessageReminderArgs],
    CancelMessageReminderResponse
  >,
  'contacts' : ActorMethod<[ContactsArgs], ContactsResponse>,
  'create_community' : ActorMethod<
    [CreateCommunityArgs],
    CreateCommunityResponse
  >,
  'create_group' : ActorMethod<[CreateGroupArgs], CreateGroupResponse>,
  'delete_community' : ActorMethod<
    [DeleteCommunityArgs],
    DeleteCommunityResponse
  >,
  'delete_group' : ActorMethod<[DeleteGroupArgs], DeleteGroupResponse>,
  'delete_messages' : ActorMethod<[DeleteMessagesArgs], DeleteMessagesResponse>,
  'deleted_message' : ActorMethod<[DeletedMessageArgs], DeletedMessageResponse>,
  'edit_message_v2' : ActorMethod<[EditMessageV2Args], EditMessageResponse>,
  'events' : ActorMethod<[EventsArgs], EventsResponse>,
  'events_by_index' : ActorMethod<[EventsByIndexArgs], EventsResponse>,
  'events_window' : ActorMethod<[EventsWindowArgs], EventsResponse>,
  'hot_group_exclusions' : ActorMethod<
    [HotGroupExclusionsArgs],
    HotGroupExclusionsResponse
  >,
  'init_user_principal_migration' : ActorMethod<
    [InitUserPrincipalMigrationArgs],
    InitUserPrincipalMigrationResponse
  >,
  'initial_state' : ActorMethod<[InitialStateArgs], InitialStateResponse>,
  'initial_state_v2' : ActorMethod<
    [InitialStateV2Args],
    InitialStateV2Response
  >,
  'leave_community' : ActorMethod<[LeaveCommunityArgs], LeaveCommunityResponse>,
  'leave_group' : ActorMethod<[LeaveGroupArgs], LeaveGroupResponse>,
  'manage_favourite_chats' : ActorMethod<
    [ManageFavouriteChatsArgs],
    ManageFavouriteChatsResponse
  >,
  'mark_read' : ActorMethod<[MarkReadArgs], MarkReadResponse>,
  'mark_read_v2' : ActorMethod<[MarkReadV2Args], MarkReadResponse>,
  'messages_by_message_index' : ActorMethod<
    [MessagesByMessageIndexArgs],
    MessagesByMessageIndexResponse
  >,
  'migrate_user_principal' : ActorMethod<
    [MigrateUserPrincipalArgs],
    MigrateUserPrincipalResponse
  >,
  'mute_notifications' : ActorMethod<
    [MuteNotificationsArgs],
    MuteNotificationsResponse
  >,
  'pin_chat' : ActorMethod<[PinChatRequest], PinChatResponse>,
  'pin_chat_v2' : ActorMethod<[PinChatV2Request], PinChatV2Response>,
  'public_profile' : ActorMethod<[PublicProfileArgs], PublicProfileResponse>,
  'remove_reaction' : ActorMethod<[RemoveReactionArgs], RemoveReactionResponse>,
  'search_messages' : ActorMethod<[SearchMessagesArgs], SearchMessagesResponse>,
  'send_message_v2' : ActorMethod<[SendMessageV2Args], SendMessageResponse>,
  'send_message_with_transfer_to_channel' : ActorMethod<
    [SendMessageWithTransferToChannelArgs],
    SendMessageWithTransferToChannelResponse
  >,
  'send_message_with_transfer_to_group' : ActorMethod<
    [SendMessageWithTransferToGroupArgs],
    SendMessageWithTransferToGroupResponse
  >,
  'set_avatar' : ActorMethod<[SetAvatarArgs], SetAvatarResponse>,
  'set_bio' : ActorMethod<[SetBioArgs], SetBioResponse>,
  'set_contact' : ActorMethod<[SetContactArgs], SetContactResponse>,
  'set_message_reminder' : ActorMethod<
    [SetMessageReminderArgs],
    SetMessageReminderResponse
  >,
  'set_message_reminder_v2' : ActorMethod<
    [SetMessageReminderV2Args],
    SetMessageReminderResponse
  >,
  'unarchive_chat' : ActorMethod<[UnArchiveChatArgs], UnArchiveChatResponse>,
  'unblock_user' : ActorMethod<[UnblockUserArgs], UnblockUserResponse>,
  'undelete_messages' : ActorMethod<
    [UndeleteMessagesArgs],
    UndeleteMessagesResponse
  >,
  'unmute_notifications' : ActorMethod<
    [UnmuteNotificationsArgs],
    UnmuteNotificationsResponse
  >,
  'unpin_chat' : ActorMethod<[UnpinChatRequest], UnpinChatResponse>,
  'unpin_chat_v2' : ActorMethod<[UnpinChatV2Request], UnpinChatV2Response>,
  'updates' : ActorMethod<[UpdatesArgs], UpdatesResponse>,
  'updates_v2' : ActorMethod<[UpdatesV2Args], UpdatesV2Response>,
  'withdraw_crypto_v2' : ActorMethod<
    [WithdrawCryptoArgs],
    WithdrawCryptoResponse
  >,
}
