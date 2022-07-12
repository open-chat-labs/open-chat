import type { Principal } from '@dfinity/principal';
export type AccountIdentifier = Array<number>;
export interface AddParticipantsArgs {
  'allow_blocked_users' : boolean,
  'user_ids' : Array<UserId>,
  'added_by_name' : string,
}
export interface AddParticipantsFailedResult {
  'errors' : Array<UserId>,
  'users_blocked_from_group' : Array<UserId>,
  'users_who_blocked_request' : Array<UserId>,
  'users_already_in_group' : Array<UserId>,
}
export interface AddParticipantsPartialSuccessResult {
  'errors' : Array<UserId>,
  'users_blocked_from_group' : Array<UserId>,
  'users_not_authorized_to_add' : Array<UserId>,
  'users_added' : Array<UserId>,
  'users_who_blocked_request' : Array<UserId>,
  'users_already_in_group' : Array<UserId>,
}
export type AddParticipantsResponse = {
    'Failed' : AddParticipantsFailedResult
  } |
  { 'PartialSuccess' : AddParticipantsPartialSuccessResult } |
  { 'CallerNotInGroup' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'ParticipantLimitReached' : number };
export interface AddedToGroupNotification {
  'added_by_name' : string,
  'added_by' : UserId,
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
export interface BlobReference {
  'blob_id' : bigint,
  'canister_id' : CanisterId,
}
export type BlockIndex = bigint;
export interface BlockUserArgs { 'user_id' : UserId }
export type BlockUserResponse = { 'GroupNotPublic' : null } |
  { 'UserNotInGroup' : null } |
  { 'CallerNotInGroup' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'InternalError' : string } |
  { 'CannotBlockSelf' : null } |
  { 'CannotBlockUser' : null };
export type CanisterId = Principal;
export type CanisterUpgradeStatus = { 'NotRequired' : null } |
  { 'InProgress' : null };
export interface CanisterWasm {
  'compressed' : boolean,
  'version' : Version,
  'module' : Array<number>,
}
export interface ChangeRoleArgs { 'user_id' : UserId, 'new_role' : Role }
export type ChangeRoleResponse = { 'Invalid' : null } |
  { 'UserNotInGroup' : null } |
  { 'CallerNotInGroup' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null };
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
export interface ConfirmationCodeSms {
  'confirmation_code' : string,
  'phone_number' : string,
}
export type CryptoAccount = { 'Mint' : null } |
  { 'User' : UserId } |
  { 'Account' : AccountIdentifier };
export type CryptoAccountFull = { 'UserIndex' : AccountIdentifier } |
  { 'Named' : [string, AccountIdentifier] } |
  { 'Mint' : null } |
  { 'User' : [UserId, AccountIdentifier] } |
  { 'Unknown' : AccountIdentifier };
export type CryptoTransaction = { 'Failed' : FailedCryptoTransaction } |
  { 'Completed' : CompletedCryptoTransaction } |
  { 'Pending' : PendingCryptoTransaction };
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
export type DeleteGroupArgs = {};
export type DeleteGroupResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'InternalError' : null };
export interface DeleteMessagesArgs {
  'message_ids' : Array<MessageId>,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type DeleteMessagesResponse = { 'MessageNotFound' : null } |
  { 'CallerNotInGroup' : null } |
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
export type DisableInviteCodeArgs = {};
export type DisableInviteCodeResponse = { 'NotAuthorized' : null } |
  { 'Success' : null };
export interface EditMessageArgs {
  'content' : MessageContent,
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type EditMessageResponse = { 'MessageNotFound' : null } |
  { 'CallerNotInGroup' : null } |
  { 'Success' : null };
export type EnableInviteCodeArgs = {};
export type EnableInviteCodeResponse = { 'NotAuthorized' : null } |
  { 'Success' : { 'code' : bigint } };
export type EventIndex = number;
export interface EventsArgs {
  'invite_code' : [] | [bigint],
  'max_events' : number,
  'ascending' : boolean,
  'thread_root_message_index' : [] | [MessageIndex],
  'start_index' : EventIndex,
}
export interface EventsByIndexArgs {
  'invite_code' : [] | [bigint],
  'events' : Array<EventIndex>,
  'thread_root_message_index' : [] | [MessageIndex],
}
export interface EventsRangeArgs {
  'invite_code' : [] | [bigint],
  'to_index' : EventIndex,
  'from_index' : EventIndex,
  'thread_root_message_index' : [] | [MessageIndex],
}
export type EventsResponse = { 'ThreadMessageNotFound' : null } |
  { 'CallerNotInGroup' : null } |
  { 'Success' : EventsSuccessResult };
export interface EventsSuccessResult {
  'affected_events' : Array<ChatEventWrapper>,
  'events' : Array<ChatEventWrapper>,
  'latest_event_index' : number,
}
export interface EventsWindowArgs {
  'mid_point' : MessageIndex,
  'invite_code' : [] | [bigint],
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
export type InvalidPollReason = { 'DuplicateOptions' : null } |
  { 'TooFewOptions' : number } |
  { 'TooManyOptions' : number } |
  { 'OptionTooLong' : number } |
  { 'EndDateInThePast' : null };
export type InviteCodeArgs = {};
export type InviteCodeResponse = { 'NotAuthorized' : null } |
  { 'Success' : { 'code' : [] | [bigint] } };
export type MakePrivateArgs = {};
export type MakePrivateResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'AlreadyPrivate' : null } |
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
  'thread_root_message_index' : [] | [MessageIndex],
}
export type MessagesByMessageIndexResponse = {
    'ThreadMessageNotFound' : null
  } |
  { 'CallerNotInGroup' : null } |
  {
    'Success' : {
      'messages' : Array<MessageEventWrapper>,
      'latest_event_index' : EventIndex,
    }
  };
export type Milliseconds = bigint;
export type NeuronId = bigint;
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
export interface PinMessageArgs { 'message_index' : MessageIndex }
export type PinMessageResponse = { 'MessageIndexOutOfRange' : null } |
  { 'MessageNotFound' : null } |
  { 'NoChange' : null } |
  { 'CallerNotInGroup' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : EventIndex };
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
export interface ProposalContent {
  'url' : string,
  'title' : string,
  'my_vote' : [] | [boolean],
  'reject_votes' : number,
  'deadline' : TimestampMillis,
  'adopt_votes' : number,
  'summary' : string,
  'proposal_id' : ProposalId,
  'governance_canister_id' : CanisterId,
  'proposer' : NeuronId,
}
export type ProposalId = bigint;
export interface PublicGroupSummary {
  'is_public' : boolean,
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
export interface PublicSummaryArgs { 'invite_code' : [] | [bigint] }
export type PublicSummaryResponse = { 'NotAuthorized' : null } |
  { 'Success' : PublicSummarySuccess };
export interface PublicSummarySuccess { 'summary' : PublicGroupSummary }
export interface RegisterPollVoteArgs {
  'poll_option' : number,
  'operation' : VoteOperation,
  'thread_root_message_index' : [] | [MessageIndex],
  'message_index' : MessageIndex,
}
export type RegisterPollVoteResponse = { 'CallerNotInGroup' : null } |
  { 'PollEnded' : null } |
  { 'Success' : PollVotes } |
  { 'OptionIndexOutOfRange' : null } |
  { 'PollNotFound' : null };
export type RegistrationFee = { 'ICP' : ICPRegistrationFee } |
  { 'Cycles' : CyclesRegistrationFee };
export interface RemoveParticipantArgs { 'user_id' : UserId }
export type RemoveParticipantResponse = { 'UserNotInGroup' : null } |
  { 'CallerNotInGroup' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'CannotRemoveSelf' : null } |
  { 'CannotRemoveUser' : null } |
  { 'InternalError' : string };
export interface ReplyContext {
  'chat_id_if_other' : [] | [ChatId],
  'event_index' : EventIndex,
}
export type ResetInviteCodeArgs = {};
export type ResetInviteCodeResponse = { 'NotAuthorized' : null } |
  { 'Success' : { 'code' : bigint } };
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
  'search_term' : string,
}
export type SearchMessagesResponse = { 'TermTooShort' : number } |
  { 'CallerNotInGroup' : null } |
  { 'Success' : SearchMessagesSuccessResult } |
  { 'TermTooLong' : number } |
  { 'InvalidTerm' : null };
export interface SearchMessagesSuccessResult { 'matches' : Array<MessageMatch> }
export type SelectedInitialArgs = {};
export type SelectedInitialResponse = { 'CallerNotInGroup' : null } |
  { 'Success' : SelectedInitialSuccess };
export interface SelectedInitialSuccess {
  'participants' : Array<Participant>,
  'blocked_users' : Array<UserId>,
  'pinned_messages' : Array<MessageIndex>,
  'latest_event_index' : EventIndex,
}
export interface SelectedUpdatesArgs { 'updates_since' : EventIndex }
export type SelectedUpdatesResponse = { 'CallerNotInGroup' : null } |
  { 'Success' : SelectedUpdatesSuccess } |
  { 'SuccessNoUpdates' : EventIndex };
export interface SelectedUpdatesSuccess {
  'blocked_users_removed' : Array<UserId>,
  'participants_added_or_updated' : Array<Participant>,
  'pinned_messages_removed' : Array<MessageIndex>,
  'participants_removed' : Array<UserId>,
  'pinned_messages_added' : Array<MessageIndex>,
  'latest_event_index' : EventIndex,
  'blocked_users_added' : Array<UserId>,
}
export interface SendMessageArgs {
  'content' : MessageContent,
  'mentioned' : Array<User>,
  'forwarding' : boolean,
  'sender_name' : string,
  'message_id' : MessageId,
  'replies_to' : [] | [GroupReplyContext],
  'thread_root_message_index' : [] | [MessageIndex],
}
export type SendMessageResponse = { 'TextTooLong' : number } |
  { 'ThreadMessageNotFound' : null } |
  { 'CallerNotInGroup' : null } |
  { 'NotAuthorized' : null } |
  {
    'Success' : {
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'message_index' : MessageIndex,
    }
  } |
  { 'MessageEmpty' : null } |
  { 'InvalidPoll' : InvalidPollReason } |
  { 'InvalidRequest' : string };
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
export interface ThreadPreview {
  'latest_replies' : Array<MessageEventWrapper>,
  'total_replies' : number,
  'root_message' : MessageEventWrapper,
}
export interface ThreadPreviewsArgs { 'threads' : Array<MessageIndex> }
export type ThreadPreviewsResponse = { 'CallerNotInGroup' : null } |
  { 'Success' : { 'threads' : Array<ThreadPreview> } };
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
  'latest_event' : EventIndex,
  'latest_message' : MessageIndex,
}
export interface ThreadUpdated {
  'latest_thread_message_index_if_updated' : [] | [MessageIndex],
  'event_index' : EventIndex,
  'message_index' : MessageIndex,
}
export type TimestampMillis = bigint;
export type TimestampNanos = bigint;
export interface ToggleReactionArgs {
  'message_id' : MessageId,
  'thread_root_message_index' : [] | [MessageIndex],
  'reaction' : string,
}
export type ToggleReactionResponse = { 'MessageNotFound' : null } |
  { 'CallerNotInGroup' : null } |
  { 'NotAuthorized' : null } |
  { 'InvalidReaction' : null } |
  { 'Added' : EventIndex } |
  { 'Removed' : EventIndex };
export interface Tokens { 'e8s' : bigint }
export type TotalPollVotes = { 'Anonymous' : Array<[number, number]> } |
  { 'Visible' : Array<[number, Array<UserId>]> } |
  { 'Hidden' : number };
export type TransactionHash = Array<number>;
export interface UnblockUserArgs { 'user_id' : UserId }
export type UnblockUserResponse = { 'GroupNotPublic' : null } |
  { 'CannotUnblockSelf' : null } |
  { 'CallerNotInGroup' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null };
export interface UnpinMessageArgs { 'message_index' : MessageIndex }
export type UnpinMessageResponse = { 'MessageNotFound' : null } |
  { 'NoChange' : null } |
  { 'CallerNotInGroup' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : EventIndex };
export interface UpdateGroupArgs {
  'permissions' : [] | [GroupPermissions],
  'name' : string,
  'description' : string,
  'avatar' : AvatarUpdate,
}
export type UpdateGroupResponse = {
    'DescriptionTooLong' : FieldTooLongResult
  } |
  { 'NameTooShort' : FieldTooShortResult } |
  { 'CallerNotInGroup' : null } |
  { 'NotAuthorized' : null } |
  { 'AvatarTooBig' : FieldTooLongResult } |
  { 'Success' : null } |
  { 'NameTooLong' : FieldTooLongResult } |
  { 'NameTaken' : null } |
  { 'InternalError' : null };
export interface UpdatePermissionsArgs {
  'block_users' : [] | [PermissionRole],
  'change_permissions' : [] | [PermissionRole],
  'delete_messages' : [] | [PermissionRole],
  'send_messages' : [] | [PermissionRole],
  'remove_members' : [] | [PermissionRole],
  'update_group' : [] | [PermissionRole],
  'invite_users' : [] | [PermissionRole],
  'change_roles' : [] | [PermissionRole],
  'add_members' : [] | [PermissionRole],
  'create_polls' : [] | [PermissionRole],
  'pin_messages' : [] | [PermissionRole],
  'reply_in_thread' : [] | [PermissionRole],
  'react_to_messages' : [] | [PermissionRole],
}
export type UpdatePermissionsResponse = { 'CallerNotInGroup' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null };
export interface UpdatedMessage {
  'updated_by' : UserId,
  'message_id' : MessageId,
  'event_index' : EventIndex,
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
export interface _SERVICE {
  'add_participants' : (arg_0: AddParticipantsArgs) => Promise<
      AddParticipantsResponse
    >,
  'block_user' : (arg_0: BlockUserArgs) => Promise<BlockUserResponse>,
  'change_role' : (arg_0: ChangeRoleArgs) => Promise<ChangeRoleResponse>,
  'delete_group' : (arg_0: DeleteGroupArgs) => Promise<DeleteGroupResponse>,
  'delete_messages' : (arg_0: DeleteMessagesArgs) => Promise<
      DeleteMessagesResponse
    >,
  'disable_invite_code' : (arg_0: DisableInviteCodeArgs) => Promise<
      DisableInviteCodeResponse
    >,
  'edit_message' : (arg_0: EditMessageArgs) => Promise<EditMessageResponse>,
  'enable_invite_code' : (arg_0: EnableInviteCodeArgs) => Promise<
      EnableInviteCodeResponse
    >,
  'events' : (arg_0: EventsArgs) => Promise<EventsResponse>,
  'events_by_index' : (arg_0: EventsByIndexArgs) => Promise<EventsResponse>,
  'events_range' : (arg_0: EventsRangeArgs) => Promise<EventsResponse>,
  'events_window' : (arg_0: EventsWindowArgs) => Promise<EventsResponse>,
  'invite_code' : (arg_0: InviteCodeArgs) => Promise<InviteCodeResponse>,
  'make_private' : (arg_0: MakePrivateArgs) => Promise<MakePrivateResponse>,
  'messages_by_message_index' : (arg_0: MessagesByMessageIndexArgs) => Promise<
      MessagesByMessageIndexResponse
    >,
  'pin_message' : (arg_0: PinMessageArgs) => Promise<PinMessageResponse>,
  'public_summary' : (arg_0: PublicSummaryArgs) => Promise<
      PublicSummaryResponse
    >,
  'register_poll_vote' : (arg_0: RegisterPollVoteArgs) => Promise<
      RegisterPollVoteResponse
    >,
  'remove_participant' : (arg_0: RemoveParticipantArgs) => Promise<
      RemoveParticipantResponse
    >,
  'reset_invite_code' : (arg_0: ResetInviteCodeArgs) => Promise<
      ResetInviteCodeResponse
    >,
  'search_messages' : (arg_0: SearchMessagesArgs) => Promise<
      SearchMessagesResponse
    >,
  'selected_initial' : (arg_0: SelectedInitialArgs) => Promise<
      SelectedInitialResponse
    >,
  'selected_updates' : (arg_0: SelectedUpdatesArgs) => Promise<
      SelectedUpdatesResponse
    >,
  'send_message' : (arg_0: SendMessageArgs) => Promise<SendMessageResponse>,
  'thread_previews' : (arg_0: ThreadPreviewsArgs) => Promise<
      ThreadPreviewsResponse
    >,
  'toggle_reaction' : (arg_0: ToggleReactionArgs) => Promise<
      ToggleReactionResponse
    >,
  'unblock_user' : (arg_0: UnblockUserArgs) => Promise<UnblockUserResponse>,
  'unpin_message' : (arg_0: UnpinMessageArgs) => Promise<UnpinMessageResponse>,
  'update_group' : (arg_0: UpdateGroupArgs) => Promise<UpdateGroupResponse>,
  'update_permissions' : (arg_0: UpdatePermissionsArgs) => Promise<
      UpdatePermissionsResponse
    >,
}
