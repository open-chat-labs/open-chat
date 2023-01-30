import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type AccountIdentifier = Uint8Array | number[];
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
  { 'Success' : EventIndex } |
  { 'UserSuspended' : null } |
  { 'InvalidReaction' : null } |
  { 'SuccessV2' : PushEventResult };
export interface AddRecommendedGroupExclusionsArgs {
  'duration' : [] | [Milliseconds],
  'groups' : Array<ChatId>,
}
export type AddRecommendedGroupExclusionsResponse = { 'Success' : null };
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
export interface AssumeGroupSuperAdminArgs {
  'correlation_id' : bigint,
  'chat_id' : ChatId,
}
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
export type CanisterId = Principal;
export type CanisterUpgradeStatus = { 'NotRequired' : null } |
  { 'InProgress' : null };
export interface CanisterWasm {
  'compressed' : boolean,
  'version' : Version,
  'module' : Uint8Array | number[],
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
export interface ChatMessagesRead {
  'threads' : Array<ThreadRead>,
  'read_up_to' : [] | [MessageIndex],
  'chat_id' : ChatId,
  'date_read_pinned' : [] | [TimestampMillis],
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
  'sns1_messages' : bigint,
  'polls' : bigint,
  'proposals' : bigint,
  'reported_messages' : bigint,
  'ckbtc_messages' : bigint,
  'reactions' : bigint,
}
export type ChatSummary = { 'Group' : GroupChatSummary } |
  { 'Direct' : DirectChatSummary };
export type ChatSummaryUpdates = { 'Group' : GroupChatSummaryUpdates } |
  { 'Direct' : DirectChatSummaryUpdates };
export interface ChatUnfrozen { 'unfrozen_by' : UserId }
export type CompletedCryptoTransaction = {
    'NNS' : NnsCompletedCryptoTransaction
  } |
  { 'SNS' : SnsCompletedCryptoTransaction };
export interface ConfirmationCodeSms {
  'confirmation_code' : string,
  'phone_number' : string,
}
export interface Contact { 'nickname' : [] | [string], 'user_id' : UserId }
export type ContactsArgs = {};
export type ContactsResponse = { 'Success' : { 'contacts' : Array<Contact> } };
export interface CreateGroupArgs {
  'is_public' : boolean,
  'permissions' : [] | [GroupPermissions],
  'name' : string,
  'description' : string,
  'history_visible_to_new_joiners' : boolean,
  'rules' : GroupRules,
  'avatar' : [] | [Avatar],
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
  { 'InternalError' : null };
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
  { 'SNS1' : null } |
  { 'CKBTC' : null };
export type Cycles = bigint;
export interface CyclesRegistrationFee {
  'recipient' : Principal,
  'valid_until' : TimestampMillis,
  'amount' : Cycles,
}
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
  'latest_event_index' : EventIndex,
  'read_by_me_up_to' : [] | [MessageIndex],
  'archived' : boolean,
  'my_metrics' : ChatMetrics,
  'latest_message' : MessageEventWrapper,
}
export interface DirectChatSummaryUpdates {
  'read_by_them_up_to' : [] | [MessageIndex],
  'metrics' : [] | [ChatMetrics],
  'affected_events' : Uint32Array | number[],
  'notifications_muted' : [] | [boolean],
  'latest_event_index' : [] | [EventIndex],
  'read_by_me_up_to' : [] | [MessageIndex],
  'chat_id' : ChatId,
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
export interface EditMessageArgs {
  'content' : MessageContent,
  'user_id' : UserId,
  'correlation_id' : bigint,
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type EditMessageResponse = { 'MessageNotFound' : null } |
  { 'ChatNotFound' : null } |
  { 'Success' : null } |
  { 'UserSuspended' : null } |
  { 'UserBlocked' : null };
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
  'affected_events' : Array<ChatEventWrapper>,
  'events' : Array<ChatEventWrapper>,
  'latest_event_index' : EventIndex,
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
  'last_updated' : TimestampMillis,
  'owner_id' : UserId,
  'joined' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'latest_threads' : Array<GroupCanisterThreadDetails>,
  'frozen' : [] | [FrozenGroupInfo],
  'latest_event_index' : EventIndex,
  'history_visible_to_new_joiners' : boolean,
  'min_visible_message_index' : MessageIndex,
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
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
  'last_updated' : TimestampMillis,
  'owner_id' : [] | [UserId],
  'avatar_id' : AvatarIdUpdate,
  'latest_threads' : Array<GroupCanisterThreadDetails>,
  'frozen' : FrozenGroupUpdate,
  'latest_event_index' : [] | [EventIndex],
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'affected_events_v2' : Array<[EventIndex, TimestampMillis]>,
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
  'last_updated' : TimestampMillis,
  'owner_id' : UserId,
  'joined' : TimestampMillis,
  'avatar_id' : [] | [bigint],
  'latest_threads' : Array<ThreadSyncDetails>,
  'frozen' : [] | [FrozenGroupInfo],
  'latest_event_index' : EventIndex,
  'history_visible_to_new_joiners' : boolean,
  'read_by_me_up_to' : [] | [MessageIndex],
  'min_visible_message_index' : MessageIndex,
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'date_read_pinned' : [] | [TimestampMillis],
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
  'last_updated' : TimestampMillis,
  'owner_id' : [] | [UserId],
  'avatar_id' : AvatarIdUpdate,
  'latest_threads' : Array<ThreadSyncDetails>,
  'frozen' : FrozenGroupUpdate,
  'latest_event_index' : [] | [EventIndex],
  'read_by_me_up_to' : [] | [MessageIndex],
  'mentions' : Array<Mention>,
  'chat_id' : ChatId,
  'date_read_pinned' : [] | [TimestampMillis],
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
export interface InitUserPrincipalMigrationArgs { 'new_principal' : Principal }
export type InitUserPrincipalMigrationResponse = { 'Success' : null };
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
export interface OptionalContact { 'nickname' : TextUpdate, 'user_id' : UserId }
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
export interface PollVotes {
  'total' : TotalPollVotes,
  'user' : Uint32Array | number[],
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
export interface RelinquishGroupSuperAdminArgs {
  'correlation_id' : bigint,
  'chat_id' : ChatId,
}
export type RelinquishGroupSuperAdminResponse = { 'CallerNotInGroup' : null } |
  { 'Success' : null } |
  { 'NotSuperAdmin' : null } |
  { 'InternalError' : string };
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
  { 'Success' : EventIndex } |
  { 'UserSuspended' : null } |
  { 'SuccessV2' : PushEventResult };
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
  'correlation_id' : bigint,
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
export interface SetAvatarArgs { 'avatar' : [] | [Avatar] }
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
export interface Tokens { 'e8s' : bigint }
export type TotalPollVotes = { 'Anonymous' : Array<[number, number]> } |
  { 'Visible' : Array<[number, Array<UserId>]> } |
  { 'Hidden' : number };
export type TransactionHash = Uint8Array | number[];
export interface TransferCryptoWithinGroupArgs {
  'content' : CryptoContent,
  'recipient' : UserId,
  'mentioned' : Array<User>,
  'group_id' : ChatId,
  'sender_name' : string,
  'correlation_id' : bigint,
  'message_id' : MessageId,
  'replies_to' : [] | [GroupReplyContext],
  'thread_root_message_index' : [] | [MessageIndex],
}
export type TransferCryptoWithinGroupResponse = { 'TextTooLong' : number } |
  { 'TransferLimitExceeded' : bigint } |
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
export interface UpdatedMessage {
  'updated_by' : UserId,
  'message_id' : MessageId,
  'event_index' : EventIndex,
}
export interface UpdatesV2Args { 'updates_since' : TimestampMillis }
export type UpdatesV2Response = {
    'Success' : {
      'user_canister_wasm_version' : [] | [Version],
      'direct_chats_added' : Array<DirectChatSummary>,
      'blocked_users_v2' : [] | [Array<UserId>],
      'group_chats_added' : Array<UserCanisterGroupChatSummary>,
      'avatar_id' : AvatarIdUpdate,
      'chats_removed' : Array<ChatId>,
      'timestamp' : TimestampMillis,
      'group_chats_updated' : Array<UserCanisterGroupChatSummaryUpdates>,
      'direct_chats_updated' : Array<DirectChatSummaryUpdates>,
      'pinned_chats' : [] | [Array<ChatId>],
    }
  };
export interface User { 'username' : string, 'user_id' : UserId }
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
  'add_reaction' : ActorMethod<[AddReactionArgs], AddReactionResponse>,
  'add_recommended_group_exclusions' : ActorMethod<
    [AddRecommendedGroupExclusionsArgs],
    AddRecommendedGroupExclusionsResponse
  >,
  'archive_chat' : ActorMethod<[ArchiveChatArgs], ArchiveChatResponse>,
  'assume_group_super_admin' : ActorMethod<
    [AssumeGroupSuperAdminArgs],
    AssumeGroupSuperAdminResponse
  >,
  'bio' : ActorMethod<[BioArgs], BioResponse>,
  'block_user' : ActorMethod<[BlockUserArgs], BlockUserResponse>,
  'contacts' : ActorMethod<[ContactsArgs], ContactsResponse>,
  'create_group' : ActorMethod<[CreateGroupArgs], CreateGroupResponse>,
  'delete_group' : ActorMethod<[DeleteGroupArgs], DeleteGroupResponse>,
  'delete_messages' : ActorMethod<[DeleteMessagesArgs], DeleteMessagesResponse>,
  'deleted_message' : ActorMethod<[DeletedMessageArgs], DeletedMessageResponse>,
  'edit_message' : ActorMethod<[EditMessageArgs], EditMessageResponse>,
  'events' : ActorMethod<[EventsArgs], EventsResponse>,
  'events_by_index' : ActorMethod<[EventsByIndexArgs], EventsResponse>,
  'events_window' : ActorMethod<[EventsWindowArgs], EventsResponse>,
  'init_user_principal_migration' : ActorMethod<
    [InitUserPrincipalMigrationArgs],
    InitUserPrincipalMigrationResponse
  >,
  'initial_state_v2' : ActorMethod<
    [InitialStateV2Args],
    InitialStateV2Response
  >,
  'leave_group' : ActorMethod<[LeaveGroupArgs], LeaveGroupResponse>,
  'mark_read_v2' : ActorMethod<[MarkReadArgs], MarkReadResponse>,
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
  'public_profile' : ActorMethod<[PublicProfileArgs], PublicProfileResponse>,
  'relinquish_group_super_admin' : ActorMethod<
    [RelinquishGroupSuperAdminArgs],
    RelinquishGroupSuperAdminResponse
  >,
  'remove_reaction' : ActorMethod<[RemoveReactionArgs], RemoveReactionResponse>,
  'search_messages' : ActorMethod<[SearchMessagesArgs], SearchMessagesResponse>,
  'send_message' : ActorMethod<[SendMessageArgs], SendMessageResponse>,
  'set_avatar' : ActorMethod<[SetAvatarArgs], SetAvatarResponse>,
  'set_bio' : ActorMethod<[SetBioArgs], SetBioResponse>,
  'set_contact' : ActorMethod<[SetContactArgs], SetContactResponse>,
  'transfer_crypto_within_group_v2' : ActorMethod<
    [TransferCryptoWithinGroupArgs],
    TransferCryptoWithinGroupResponse
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
  'updates_v2' : ActorMethod<[UpdatesV2Args], UpdatesV2Response>,
  'withdraw_crypto_v2' : ActorMethod<
    [WithdrawCryptoArgs],
    WithdrawCryptoResponse
  >,
}
