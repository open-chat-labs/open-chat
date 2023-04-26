export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const AddParticipantsArgs = IDL.Record({
    'allow_blocked_users' : IDL.Bool,
    'user_ids' : IDL.Vec(UserId),
    'added_by_name' : IDL.Text,
    'correlation_id' : IDL.Nat64,
  });
  const AddParticipantsFailedResult = IDL.Record({
    'errors' : IDL.Vec(UserId),
    'users_who_failed_gate_check' : IDL.Vec(UserId),
    'users_suspended' : IDL.Vec(UserId),
    'users_blocked_from_group' : IDL.Vec(UserId),
    'users_not_authorized_to_add' : IDL.Vec(UserId),
    'users_who_blocked_request' : IDL.Vec(UserId),
    'users_already_in_group' : IDL.Vec(UserId),
  });
  const AddParticipantsPartialSuccessResult = IDL.Record({
    'errors' : IDL.Vec(UserId),
    'users_who_failed_gate_check' : IDL.Vec(UserId),
    'users_suspended' : IDL.Vec(UserId),
    'users_blocked_from_group' : IDL.Vec(UserId),
    'users_not_authorized_to_add' : IDL.Vec(UserId),
    'users_added' : IDL.Vec(UserId),
    'users_who_blocked_request' : IDL.Vec(UserId),
    'users_already_in_group' : IDL.Vec(UserId),
  });
  const AddParticipantsResponse = IDL.Variant({
    'Failed' : AddParticipantsFailedResult,
    'PartialSuccess' : AddParticipantsPartialSuccessResult,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'ParticipantLimitReached' : IDL.Nat32,
  });
  const MessageId = IDL.Nat;
  const MessageIndex = IDL.Nat32;
  const AddReactionArgs = IDL.Record({
    'username' : IDL.Text,
    'correlation_id' : IDL.Nat64,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'reaction' : IDL.Text,
  });
  const TimestampMillis = IDL.Nat64;
  const EventIndex = IDL.Nat32;
  const PushEventResult = IDL.Record({
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
    'expires_at' : IDL.Opt(TimestampMillis),
  });
  const AddReactionResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'NoChange' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'InvalidReaction' : IDL.Null,
    'SuccessV2' : PushEventResult,
  });
  const BlockUserArgs = IDL.Record({
    'user_id' : UserId,
    'correlation_id' : IDL.Nat64,
  });
  const BlockUserResponse = IDL.Variant({
    'GroupNotPublic' : IDL.Null,
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'InternalError' : IDL.Text,
    'CannotBlockSelf' : IDL.Null,
    'CannotBlockUser' : IDL.Null,
  });
  const Role = IDL.Variant({
    'Participant' : IDL.Null,
    'Admin' : IDL.Null,
    'Owner' : IDL.Null,
  });
  const ChangeRoleArgs = IDL.Record({
    'user_id' : UserId,
    'new_role' : Role,
    'correlation_id' : IDL.Nat64,
  });
  const ChangeRoleResponse = IDL.Variant({
    'Invalid' : IDL.Null,
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const ClaimPrizeArgs = IDL.Record({
    'correlation_id' : IDL.Nat64,
    'message_id' : MessageId,
  });
  const AccountIdentifier = IDL.Vec(IDL.Nat8);
  const NnsCryptoAccount = IDL.Variant({
    'Mint' : IDL.Null,
    'Account' : AccountIdentifier,
  });
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  const TimestampNanos = IDL.Nat64;
  const Cryptocurrency = IDL.Variant({
    'InternetComputer' : IDL.Null,
    'CHAT' : IDL.Null,
    'SNS1' : IDL.Null,
    'CKBTC' : IDL.Null,
  });
  const TransactionHash = IDL.Vec(IDL.Nat8);
  const BlockIndex = IDL.Nat64;
  const Memo = IDL.Nat64;
  const NnsCompletedCryptoTransaction = IDL.Record({
    'to' : NnsCryptoAccount,
    'fee' : Tokens,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'transaction_hash' : TransactionHash,
    'block_index' : BlockIndex,
    'from' : NnsCryptoAccount,
    'memo' : Memo,
    'amount' : Tokens,
  });
  const Icrc1Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const SnsAccount = IDL.Variant({
    'Mint' : IDL.Null,
    'Account' : Icrc1Account,
  });
  const SnsCompletedCryptoTransaction = IDL.Record({
    'to' : SnsAccount,
    'fee' : Tokens,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'transaction_hash' : TransactionHash,
    'block_index' : BlockIndex,
    'from' : SnsAccount,
    'memo' : IDL.Opt(Memo),
    'amount' : Tokens,
  });
  const CompletedCryptoTransaction = IDL.Variant({
    'NNS' : NnsCompletedCryptoTransaction,
    'SNS' : SnsCompletedCryptoTransaction,
  });
  const NnsFailedCryptoTransaction = IDL.Record({
    'to' : NnsCryptoAccount,
    'fee' : Tokens,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'transaction_hash' : TransactionHash,
    'from' : NnsCryptoAccount,
    'memo' : Memo,
    'error_message' : IDL.Text,
    'amount' : Tokens,
  });
  const SnsFailedCryptoTransaction = IDL.Record({
    'to' : SnsAccount,
    'fee' : Tokens,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'transaction_hash' : TransactionHash,
    'from' : SnsAccount,
    'memo' : IDL.Opt(Memo),
    'error_message' : IDL.Text,
    'amount' : Tokens,
  });
  const FailedCryptoTransaction = IDL.Variant({
    'NNS' : NnsFailedCryptoTransaction,
    'SNS' : SnsFailedCryptoTransaction,
  });
  const ClaimPrizeResponse = IDL.Variant({
    'PrizeFullyClaimed' : IDL.Null,
    'MessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'AlreadyClaimed' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'PrizeEnded' : IDL.Null,
    'FailedAfterTransfer' : IDL.Tuple(IDL.Text, CompletedCryptoTransaction),
    'TransferFailed' : IDL.Tuple(IDL.Text, FailedCryptoTransaction),
  });
  const DeleteMessagesArgs = IDL.Record({
    'as_platform_moderator' : IDL.Opt(IDL.Bool),
    'message_ids' : IDL.Vec(MessageId),
    'correlation_id' : IDL.Nat64,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const DeleteMessagesResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'NotPlatformModerator' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const DeletedMessageArgs = IDL.Record({
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const MessageReport = IDL.Record({
    'notes' : IDL.Opt(IDL.Text),
    'timestamp' : TimestampMillis,
    'reported_by' : UserId,
    'reason_code' : IDL.Nat32,
  });
  const ReportedMessage = IDL.Record({ 'reports' : IDL.Vec(MessageReport) });
  const GiphyImageVariant = IDL.Record({
    'url' : IDL.Text,
    'height' : IDL.Nat32,
    'mime_type' : IDL.Text,
    'width' : IDL.Nat32,
  });
  const GiphyContent = IDL.Record({
    'title' : IDL.Text,
    'desktop' : GiphyImageVariant,
    'caption' : IDL.Opt(IDL.Text),
    'mobile' : GiphyImageVariant,
  });
  const BlobReference = IDL.Record({
    'blob_id' : IDL.Nat,
    'canister_id' : CanisterId,
  });
  const FileContent = IDL.Record({
    'name' : IDL.Text,
    'mime_type' : IDL.Text,
    'file_size' : IDL.Nat32,
    'blob_reference' : IDL.Opt(BlobReference),
    'caption' : IDL.Opt(IDL.Text),
  });
  const TotalPollVotes = IDL.Variant({
    'Anonymous' : IDL.Vec(IDL.Tuple(IDL.Nat32, IDL.Nat32)),
    'Visible' : IDL.Vec(IDL.Tuple(IDL.Nat32, IDL.Vec(UserId))),
    'Hidden' : IDL.Nat32,
  });
  const PollVotes = IDL.Record({
    'total' : TotalPollVotes,
    'user' : IDL.Vec(IDL.Nat32),
  });
  const PollConfig = IDL.Record({
    'allow_multiple_votes_per_user' : IDL.Bool,
    'text' : IDL.Opt(IDL.Text),
    'show_votes_before_end_date' : IDL.Bool,
    'end_date' : IDL.Opt(TimestampMillis),
    'anonymous' : IDL.Bool,
    'options' : IDL.Vec(IDL.Text),
  });
  const PollContent = IDL.Record({
    'votes' : PollVotes,
    'ended' : IDL.Bool,
    'config' : PollConfig,
  });
  const TextContent = IDL.Record({ 'text' : IDL.Text });
  const ImageContent = IDL.Record({
    'height' : IDL.Nat32,
    'mime_type' : IDL.Text,
    'blob_reference' : IDL.Opt(BlobReference),
    'thumbnail_data' : IDL.Text,
    'caption' : IDL.Opt(IDL.Text),
    'width' : IDL.Nat32,
  });
  const PrizeContent = IDL.Record({
    'token' : Cryptocurrency,
    'end_date' : TimestampMillis,
    'prizes_remaining' : IDL.Nat32,
    'prizes_pending' : IDL.Nat32,
    'caption' : IDL.Opt(IDL.Text),
    'winners' : IDL.Vec(UserId),
  });
  const CustomMessageContent = IDL.Record({
    'data' : IDL.Vec(IDL.Nat8),
    'kind' : IDL.Text,
  });
  const ProposalId = IDL.Nat64;
  const ProposalDecisionStatus = IDL.Variant({
    'Failed' : IDL.Null,
    'Open' : IDL.Null,
    'Rejected' : IDL.Null,
    'Executed' : IDL.Null,
    'Adopted' : IDL.Null,
    'Unspecified' : IDL.Null,
  });
  const Tally = IDL.Record({
    'no' : IDL.Nat64,
    'yes' : IDL.Nat64,
    'total' : IDL.Nat64,
    'timestamp' : TimestampMillis,
  });
  const ProposalRewardStatus = IDL.Variant({
    'ReadyToSettle' : IDL.Null,
    'AcceptVotes' : IDL.Null,
    'Unspecified' : IDL.Null,
    'Settled' : IDL.Null,
  });
  const NnsNeuronId = IDL.Nat64;
  const NnsProposal = IDL.Record({
    'id' : ProposalId,
    'url' : IDL.Text,
    'status' : ProposalDecisionStatus,
    'tally' : Tally,
    'title' : IDL.Text,
    'created' : TimestampMillis,
    'topic' : IDL.Int32,
    'last_updated' : TimestampMillis,
    'deadline' : TimestampMillis,
    'reward_status' : ProposalRewardStatus,
    'summary' : IDL.Text,
    'proposer' : NnsNeuronId,
  });
  const SnsNeuronId = IDL.Vec(IDL.Nat8);
  const SnsProposal = IDL.Record({
    'id' : ProposalId,
    'url' : IDL.Text,
    'status' : ProposalDecisionStatus,
    'payload_text_rendering' : IDL.Opt(IDL.Text),
    'tally' : Tally,
    'title' : IDL.Text,
    'created' : TimestampMillis,
    'action' : IDL.Nat64,
    'last_updated' : TimestampMillis,
    'deadline' : TimestampMillis,
    'reward_status' : ProposalRewardStatus,
    'summary' : IDL.Text,
    'proposer' : SnsNeuronId,
  });
  const Proposal = IDL.Variant({ 'NNS' : NnsProposal, 'SNS' : SnsProposal });
  const ProposalContent = IDL.Record({
    'my_vote' : IDL.Opt(IDL.Bool),
    'governance_canister_id' : CanisterId,
    'proposal' : Proposal,
  });
  const PrizeWinnerContent = IDL.Record({
    'transaction' : CompletedCryptoTransaction,
    'winner' : UserId,
    'prize_message' : MessageIndex,
  });
  const AudioContent = IDL.Record({
    'mime_type' : IDL.Text,
    'blob_reference' : IDL.Opt(BlobReference),
    'caption' : IDL.Opt(IDL.Text),
  });
  const NnsUserOrAccount = IDL.Variant({
    'User' : UserId,
    'Account' : AccountIdentifier,
  });
  const NnsPendingCryptoTransaction = IDL.Record({
    'to' : NnsUserOrAccount,
    'fee' : IDL.Opt(Tokens),
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'memo' : IDL.Opt(Memo),
    'amount' : Tokens,
  });
  const SnsPendingCryptoTransaction = IDL.Record({
    'to' : Icrc1Account,
    'fee' : Tokens,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'memo' : IDL.Opt(Memo),
    'amount' : Tokens,
  });
  const PendingCryptoTransaction = IDL.Variant({
    'NNS' : NnsPendingCryptoTransaction,
    'SNS' : SnsPendingCryptoTransaction,
  });
  const CryptoTransaction = IDL.Variant({
    'Failed' : FailedCryptoTransaction,
    'Completed' : CompletedCryptoTransaction,
    'Pending' : PendingCryptoTransaction,
  });
  const CryptoContent = IDL.Record({
    'recipient' : UserId,
    'caption' : IDL.Opt(IDL.Text),
    'transfer' : CryptoTransaction,
  });
  const VideoContent = IDL.Record({
    'height' : IDL.Nat32,
    'image_blob_reference' : IDL.Opt(BlobReference),
    'video_blob_reference' : IDL.Opt(BlobReference),
    'mime_type' : IDL.Text,
    'thumbnail_data' : IDL.Text,
    'caption' : IDL.Opt(IDL.Text),
    'width' : IDL.Nat32,
  });
  const DeletedContent = IDL.Record({
    'timestamp' : TimestampMillis,
    'deleted_by' : UserId,
  });
  const MessageReminderCreated = IDL.Record({
    'hidden' : IDL.Bool,
    'notes' : IDL.Opt(IDL.Text),
    'remind_at' : TimestampMillis,
    'reminder_id' : IDL.Nat64,
  });
  const MessageReminder = IDL.Record({
    'notes' : IDL.Opt(IDL.Text),
    'reminder_id' : IDL.Nat64,
  });
  const MessageContent = IDL.Variant({
    'ReportedMessage' : ReportedMessage,
    'Giphy' : GiphyContent,
    'File' : FileContent,
    'Poll' : PollContent,
    'Text' : TextContent,
    'Image' : ImageContent,
    'Prize' : PrizeContent,
    'Custom' : CustomMessageContent,
    'GovernanceProposal' : ProposalContent,
    'PrizeWinner' : PrizeWinnerContent,
    'Audio' : AudioContent,
    'Crypto' : CryptoContent,
    'Video' : VideoContent,
    'Deleted' : DeletedContent,
    'MessageReminderCreated' : MessageReminderCreated,
    'MessageReminder' : MessageReminder,
  });
  const DeletedMessageResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'content' : MessageContent }),
    'MessageHardDeleted' : IDL.Null,
    'MessageNotDeleted' : IDL.Null,
  });
  const DisableInviteCodeArgs = IDL.Record({ 'correlation_id' : IDL.Nat64 });
  const DisableInviteCodeResponse = IDL.Variant({
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const EditMessageArgs = IDL.Record({
    'content' : MessageContent,
    'correlation_id' : IDL.Nat64,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const EditMessageResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const EnableInviteCodeArgs = IDL.Record({ 'correlation_id' : IDL.Nat64 });
  const EnableInviteCodeResponse = IDL.Variant({
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'code' : IDL.Nat64 }),
    'UserSuspended' : IDL.Null,
  });
  const EventsArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'invite_code' : IDL.Opt(IDL.Nat64),
    'max_messages' : IDL.Nat32,
    'max_events' : IDL.Nat32,
    'ascending' : IDL.Bool,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'start_index' : EventIndex,
  });
  const UpdatedMessage = IDL.Record({
    'updated_by' : UserId,
    'message_id' : MessageId,
    'event_index' : EventIndex,
  });
  const ParticipantJoined = IDL.Record({ 'user_id' : UserId });
  const ParticipantAssumesSuperAdmin = IDL.Record({ 'user_id' : UserId });
  const GroupDescriptionChanged = IDL.Record({
    'new_description' : IDL.Text,
    'previous_description' : IDL.Text,
    'changed_by' : UserId,
  });
  const GroupChatCreated = IDL.Record({
    'name' : IDL.Text,
    'description' : IDL.Text,
    'created_by' : UserId,
  });
  const MessagePinned = IDL.Record({
    'pinned_by' : UserId,
    'message_index' : MessageIndex,
  });
  const UsersBlocked = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'blocked_by' : UserId,
  });
  const MessageUnpinned = IDL.Record({
    'due_to_message_deleted' : IDL.Bool,
    'unpinned_by' : UserId,
    'message_index' : MessageIndex,
  });
  const ParticipantsRemoved = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'removed_by' : UserId,
  });
  const ParticipantRelinquishesSuperAdmin = IDL.Record({ 'user_id' : UserId });
  const GroupVisibilityChanged = IDL.Record({
    'changed_by' : UserId,
    'now_public' : IDL.Bool,
  });
  const ThreadSummary = IDL.Record({
    'latest_event_timestamp' : TimestampMillis,
    'participant_ids' : IDL.Vec(UserId),
    'reply_count' : IDL.Nat32,
    'latest_event_index' : EventIndex,
  });
  const ChatId = CanisterId;
  const ReplyContext = IDL.Record({
    'event_list_if_other' : IDL.Opt(IDL.Tuple(ChatId, IDL.Opt(MessageIndex))),
    'chat_id_if_other' : IDL.Opt(ChatId),
    'event_index' : EventIndex,
  });
  const Message = IDL.Record({
    'forwarded' : IDL.Bool,
    'content' : MessageContent,
    'edited' : IDL.Bool,
    'last_updated' : IDL.Opt(TimestampMillis),
    'sender' : UserId,
    'thread_summary' : IDL.Opt(ThreadSummary),
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(ReplyContext),
    'reactions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(UserId))),
    'message_index' : MessageIndex,
  });
  const PermissionRole = IDL.Variant({
    'Owner' : IDL.Null,
    'Admins' : IDL.Null,
    'Members' : IDL.Null,
  });
  const GroupPermissions = IDL.Record({
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
  });
  const PermissionsChanged = IDL.Record({
    'changed_by' : UserId,
    'old_permissions' : GroupPermissions,
    'new_permissions' : GroupPermissions,
  });
  const ChatFrozen = IDL.Record({
    'frozen_by' : UserId,
    'reason' : IDL.Opt(IDL.Text),
  });
  const PollEnded = IDL.Record({
    'event_index' : EventIndex,
    'message_index' : MessageIndex,
  });
  const GroupInviteCodeChange = IDL.Variant({
    'Enabled' : IDL.Null,
    'Disabled' : IDL.Null,
    'Reset' : IDL.Null,
  });
  const GroupInviteCodeChanged = IDL.Record({
    'changed_by' : UserId,
    'change' : GroupInviteCodeChange,
  });
  const ThreadUpdated = IDL.Record({
    'latest_thread_message_index_if_updated' : IDL.Opt(MessageIndex),
    'event_index' : EventIndex,
    'message_index' : MessageIndex,
  });
  const UsersUnblocked = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'unblocked_by' : UserId,
  });
  const ChatUnfrozen = IDL.Record({ 'unfrozen_by' : UserId });
  const ParticipantLeft = IDL.Record({ 'user_id' : UserId });
  const GroupRulesChanged = IDL.Record({
    'changed_by' : UserId,
    'enabled' : IDL.Bool,
    'prev_enabled' : IDL.Bool,
  });
  const ParticipantDismissedAsSuperAdmin = IDL.Record({ 'user_id' : UserId });
  const GroupNameChanged = IDL.Record({
    'changed_by' : UserId,
    'new_name' : IDL.Text,
    'previous_name' : IDL.Text,
  });
  const Milliseconds = IDL.Nat64;
  const SnsNeuronGate = IDL.Record({
    'min_stake_e8s' : IDL.Opt(IDL.Nat64),
    'min_dissolve_delay' : IDL.Opt(Milliseconds),
    'governance_canister_id' : CanisterId,
  });
  const GroupGate = IDL.Variant({
    'SnsNeuron' : SnsNeuronGate,
    'DiamondMember' : IDL.Null,
  });
  const GroupGateUpdated = IDL.Record({
    'updated_by' : UserId,
    'new_gate' : IDL.Opt(GroupGate),
  });
  const RoleChanged = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'changed_by' : UserId,
    'old_role' : Role,
    'new_role' : Role,
  });
  const EventsTimeToLiveUpdated = IDL.Record({
    'new_ttl' : IDL.Opt(Milliseconds),
    'updated_by' : UserId,
  });
  const ProposalUpdated = IDL.Record({
    'event_index' : EventIndex,
    'message_index' : MessageIndex,
  });
  const ProposalsUpdated = IDL.Record({
    'proposals' : IDL.Vec(ProposalUpdated),
  });
  const OwnershipTransferred = IDL.Record({
    'old_owner' : UserId,
    'new_owner' : UserId,
  });
  const DirectChatCreated = IDL.Record({});
  const AvatarChanged = IDL.Record({
    'changed_by' : UserId,
    'previous_avatar' : IDL.Opt(IDL.Nat),
    'new_avatar' : IDL.Opt(IDL.Nat),
  });
  const ParticipantsAdded = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'unblocked' : IDL.Vec(UserId),
    'added_by' : UserId,
  });
  const ChatEvent = IDL.Variant({
    'Empty' : IDL.Null,
    'MessageReactionRemoved' : UpdatedMessage,
    'ParticipantJoined' : ParticipantJoined,
    'ParticipantAssumesSuperAdmin' : ParticipantAssumesSuperAdmin,
    'GroupDescriptionChanged' : GroupDescriptionChanged,
    'GroupChatCreated' : GroupChatCreated,
    'MessagePinned' : MessagePinned,
    'UsersBlocked' : UsersBlocked,
    'MessageUnpinned' : MessageUnpinned,
    'MessageReactionAdded' : UpdatedMessage,
    'ParticipantsRemoved' : ParticipantsRemoved,
    'ParticipantRelinquishesSuperAdmin' : ParticipantRelinquishesSuperAdmin,
    'GroupVisibilityChanged' : GroupVisibilityChanged,
    'Message' : Message,
    'PermissionsChanged' : PermissionsChanged,
    'ChatFrozen' : ChatFrozen,
    'PollEnded' : PollEnded,
    'GroupInviteCodeChanged' : GroupInviteCodeChanged,
    'ThreadUpdated' : ThreadUpdated,
    'UsersUnblocked' : UsersUnblocked,
    'ChatUnfrozen' : ChatUnfrozen,
    'PollVoteRegistered' : UpdatedMessage,
    'ParticipantLeft' : ParticipantLeft,
    'MessageDeleted' : UpdatedMessage,
    'GroupRulesChanged' : GroupRulesChanged,
    'ParticipantDismissedAsSuperAdmin' : ParticipantDismissedAsSuperAdmin,
    'GroupNameChanged' : GroupNameChanged,
    'MessageUndeleted' : UpdatedMessage,
    'GroupGateUpdated' : GroupGateUpdated,
    'RoleChanged' : RoleChanged,
    'PollVoteDeleted' : UpdatedMessage,
    'EventsTimeToLiveUpdated' : EventsTimeToLiveUpdated,
    'ProposalsUpdated' : ProposalsUpdated,
    'OwnershipTransferred' : OwnershipTransferred,
    'DirectChatCreated' : DirectChatCreated,
    'MessageEdited' : UpdatedMessage,
    'AvatarChanged' : AvatarChanged,
    'ParticipantsAdded' : ParticipantsAdded,
  });
  const ChatEventWrapper = IDL.Record({
    'event' : ChatEvent,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
    'correlation_id' : IDL.Nat64,
    'expires_at' : IDL.Opt(TimestampMillis),
  });
  const EventsSuccessResult = IDL.Record({
    'events' : IDL.Vec(ChatEventWrapper),
    'timestamp' : TimestampMillis,
    'latest_event_index' : IDL.Nat32,
  });
  const EventsResponse = IDL.Variant({
    'ThreadMessageNotFound' : IDL.Null,
    'ReplicaNotUpToDate' : EventIndex,
    'CallerNotInGroup' : IDL.Null,
    'Success' : EventsSuccessResult,
  });
  const EventsByIndexArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'invite_code' : IDL.Opt(IDL.Nat64),
    'events' : IDL.Vec(EventIndex),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const EventsWindowArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'mid_point' : MessageIndex,
    'invite_code' : IDL.Opt(IDL.Nat64),
    'max_messages' : IDL.Nat32,
    'max_events' : IDL.Nat32,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const InviteCodeArgs = IDL.Record({});
  const InviteCodeResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'code' : IDL.Opt(IDL.Nat64) }),
  });
  const LocalUserIndexArgs = IDL.Record({});
  const LocalUserIndexResponse = IDL.Variant({ 'Success' : CanisterId });
  const MakePrivateArgs = IDL.Record({ 'correlation_id' : IDL.Nat64 });
  const MakePrivateResponse = IDL.Variant({
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'AlreadyPrivate' : IDL.Null,
    'InternalError' : IDL.Null,
  });
  const MessagesByMessageIndexArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'messages' : IDL.Vec(MessageIndex),
    'invite_code' : IDL.Opt(IDL.Nat64),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const MessageEventWrapper = IDL.Record({
    'event' : Message,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
    'correlation_id' : IDL.Nat64,
    'expires_at' : IDL.Opt(TimestampMillis),
  });
  const MessagesByMessageIndexResponse = IDL.Variant({
    'ThreadMessageNotFound' : IDL.Null,
    'ReplicaNotUpToDate' : EventIndex,
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Record({
      'messages' : IDL.Vec(MessageEventWrapper),
      'latest_event_index' : EventIndex,
    }),
  });
  const PinMessageArgs = IDL.Record({
    'correlation_id' : IDL.Nat64,
    'message_index' : MessageIndex,
  });
  const PinMessageV2Response = IDL.Variant({
    'MessageIndexOutOfRange' : IDL.Null,
    'MessageNotFound' : IDL.Null,
    'NoChange' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : PushEventResult,
    'UserSuspended' : IDL.Null,
  });
  const PublicSummaryArgs = IDL.Record({ 'invite_code' : IDL.Opt(IDL.Nat64) });
  const GovernanceProposalsSubtype = IDL.Record({
    'is_nns' : IDL.Bool,
    'governance_canister_id' : CanisterId,
  });
  const GroupSubtype = IDL.Variant({
    'GovernanceProposals' : GovernanceProposalsSubtype,
  });
  const Version = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
  });
  const FrozenGroupInfo = IDL.Record({
    'timestamp' : TimestampMillis,
    'frozen_by' : UserId,
    'reason' : IDL.Opt(IDL.Text),
  });
  const PublicGroupSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'subtype' : IDL.Opt(GroupSubtype),
    'gate' : IDL.Opt(GroupGate),
    'name' : IDL.Text,
    'wasm_version' : Version,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'frozen' : IDL.Opt(FrozenGroupInfo),
    'latest_event_index' : EventIndex,
    'chat_id' : ChatId,
    'participant_count' : IDL.Nat32,
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const PublicSummarySuccess = IDL.Record({ 'summary' : PublicGroupSummary });
  const PublicSummaryResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : PublicSummarySuccess,
  });
  const VoteOperation = IDL.Variant({
    'RegisterVote' : IDL.Null,
    'DeleteVote' : IDL.Null,
  });
  const RegisterPollVoteArgs = IDL.Record({
    'poll_option' : IDL.Nat32,
    'operation' : VoteOperation,
    'correlation_id' : IDL.Nat64,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'message_index' : MessageIndex,
  });
  const RegisterPollVoteResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'PollEnded' : IDL.Null,
    'Success' : PollVotes,
    'UserSuspended' : IDL.Null,
    'OptionIndexOutOfRange' : IDL.Null,
    'PollNotFound' : IDL.Null,
  });
  const RegisterProposalVoteArgs = IDL.Record({
    'adopt' : IDL.Bool,
    'message_index' : MessageIndex,
  });
  const RegisterProposalVoteResponse = IDL.Variant({
    'AlreadyVoted' : IDL.Bool,
    'ProposalNotFound' : IDL.Null,
    'ProposalMessageNotFound' : IDL.Null,
    'NoEligibleNeurons' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'ProposalNotAcceptingVotes' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const RegisterProposalVoteV2Response = IDL.Variant({
    'ProposalMessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const RemoveParticipantArgs = IDL.Record({
    'user_id' : UserId,
    'correlation_id' : IDL.Nat64,
  });
  const RemoveParticipantResponse = IDL.Variant({
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CannotRemoveSelf' : IDL.Null,
    'CannotRemoveUser' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const RemoveReactionArgs = IDL.Record({
    'correlation_id' : IDL.Nat64,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'reaction' : IDL.Text,
  });
  const RemoveReactionResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'NoChange' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'SuccessV2' : PushEventResult,
  });
  const ResetInviteCodeArgs = IDL.Record({ 'correlation_id' : IDL.Nat64 });
  const ResetInviteCodeResponse = IDL.Variant({
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'code' : IDL.Nat64 }),
    'UserSuspended' : IDL.Null,
  });
  const RulesArgs = IDL.Record({ 'invite_code' : IDL.Opt(IDL.Nat64) });
  const RulesSuccess = IDL.Record({ 'rules' : IDL.Opt(IDL.Text) });
  const RulesResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : RulesSuccess,
  });
  const SearchMessagesArgs = IDL.Record({
    'max_results' : IDL.Nat8,
    'users' : IDL.Opt(IDL.Vec(UserId)),
    'search_term' : IDL.Text,
  });
  const MessageMatch = IDL.Record({
    'content' : MessageContent,
    'sender' : UserId,
    'score' : IDL.Nat32,
    'chat_id' : ChatId,
    'message_index' : MessageIndex,
  });
  const SearchMessagesSuccessResult = IDL.Record({
    'matches' : IDL.Vec(MessageMatch),
  });
  const SearchMessagesResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'TooManyUsers' : IDL.Nat8,
    'CallerNotInGroup' : IDL.Null,
    'Success' : SearchMessagesSuccessResult,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const SelectedInitialArgs = IDL.Record({});
  const Participant = IDL.Record({
    'role' : Role,
    'user_id' : UserId,
    'date_added' : TimestampMillis,
  });
  const GroupRules = IDL.Record({ 'text' : IDL.Text, 'enabled' : IDL.Bool });
  const SelectedInitialSuccess = IDL.Record({
    'participants' : IDL.Vec(Participant),
    'blocked_users' : IDL.Vec(UserId),
    'pinned_messages' : IDL.Vec(MessageIndex),
    'latest_event_index' : EventIndex,
    'rules' : GroupRules,
  });
  const SelectedInitialResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : SelectedInitialSuccess,
  });
  const SelectedUpdatesArgs = IDL.Record({ 'updates_since' : EventIndex });
  const SelectedUpdatesSuccess = IDL.Record({
    'blocked_users_removed' : IDL.Vec(UserId),
    'participants_added_or_updated' : IDL.Vec(Participant),
    'pinned_messages_removed' : IDL.Vec(MessageIndex),
    'participants_removed' : IDL.Vec(UserId),
    'pinned_messages_added' : IDL.Vec(MessageIndex),
    'latest_event_index' : EventIndex,
    'rules' : IDL.Opt(GroupRules),
    'blocked_users_added' : IDL.Vec(UserId),
  });
  const SelectedUpdatesResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : SelectedUpdatesSuccess,
    'SuccessNoUpdates' : EventIndex,
  });
  const User = IDL.Record({ 'username' : IDL.Text, 'user_id' : UserId });
  const GroupReplyContext = IDL.Record({ 'event_index' : EventIndex });
  const SendMessageArgs = IDL.Record({
    'content' : MessageContent,
    'mentioned' : IDL.Vec(User),
    'forwarding' : IDL.Bool,
    'sender_name' : IDL.Text,
    'correlation_id' : IDL.Nat64,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(GroupReplyContext),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const InvalidPollReason = IDL.Variant({
    'DuplicateOptions' : IDL.Null,
    'TooFewOptions' : IDL.Nat32,
    'TooManyOptions' : IDL.Nat32,
    'OptionTooLong' : IDL.Nat32,
    'EndDateInThePast' : IDL.Null,
    'PollsNotValidForDirectChats' : IDL.Null,
  });
  const SendMessageResponse = IDL.Variant({
    'TextTooLong' : IDL.Nat32,
    'ThreadMessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'expires_at' : IDL.Opt(TimestampMillis),
      'message_index' : MessageIndex,
    }),
    'MessageEmpty' : IDL.Null,
    'InvalidPoll' : InvalidPollReason,
    'UserSuspended' : IDL.Null,
    'InvalidRequest' : IDL.Text,
  });
  const PrizeContentInitial = IDL.Record({
    'end_date' : TimestampMillis,
    'caption' : IDL.Opt(IDL.Text),
    'prizes' : IDL.Vec(Tokens),
    'transfer' : CryptoTransaction,
  });
  const MessageContentInitial = IDL.Variant({
    'Giphy' : GiphyContent,
    'File' : FileContent,
    'Poll' : PollContent,
    'Text' : TextContent,
    'Image' : ImageContent,
    'Prize' : PrizeContentInitial,
    'Custom' : CustomMessageContent,
    'GovernanceProposal' : ProposalContent,
    'Audio' : AudioContent,
    'Crypto' : CryptoContent,
    'Video' : VideoContent,
    'Deleted' : DeletedContent,
    'MessageReminderCreated' : MessageReminderCreated,
    'MessageReminder' : MessageReminder,
  });
  const SendMessageV2Args = IDL.Record({
    'content' : MessageContentInitial,
    'mentioned' : IDL.Vec(User),
    'forwarding' : IDL.Bool,
    'sender_name' : IDL.Text,
    'correlation_id' : IDL.Nat64,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(GroupReplyContext),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const SummaryArgs = IDL.Record({});
  const ChatMetrics = IDL.Record({
    'prize_winner_messages' : IDL.Nat64,
    'audio_messages' : IDL.Nat64,
    'cycles_messages' : IDL.Nat64,
    'chat_messages' : IDL.Nat64,
    'edits' : IDL.Nat64,
    'icp_messages' : IDL.Nat64,
    'last_active' : TimestampMillis,
    'giphy_messages' : IDL.Nat64,
    'deleted_messages' : IDL.Nat64,
    'file_messages' : IDL.Nat64,
    'poll_votes' : IDL.Nat64,
    'text_messages' : IDL.Nat64,
    'message_reminders' : IDL.Nat64,
    'image_messages' : IDL.Nat64,
    'replies' : IDL.Nat64,
    'video_messages' : IDL.Nat64,
    'sns1_messages' : IDL.Nat64,
    'polls' : IDL.Nat64,
    'proposals' : IDL.Nat64,
    'reported_messages' : IDL.Nat64,
    'ckbtc_messages' : IDL.Nat64,
    'reactions' : IDL.Nat64,
    'custom_type_messages' : IDL.Nat64,
    'prize_messages' : IDL.Nat64,
  });
  const GroupCanisterThreadDetails = IDL.Record({
    'root_message_index' : MessageIndex,
    'last_updated' : TimestampMillis,
    'latest_event' : EventIndex,
    'latest_message' : MessageIndex,
  });
  const Mention = IDL.Record({
    'message_id' : MessageId,
    'event_index' : EventIndex,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'mentioned_by' : UserId,
    'message_index' : MessageIndex,
  });
  const MessageIndexRange = IDL.Record({
    'end' : MessageIndex,
    'start' : MessageIndex,
  });
  const GroupCanisterGroupChatSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'permissions' : GroupPermissions,
    'metrics' : ChatMetrics,
    'subtype' : IDL.Opt(GroupSubtype),
    'date_last_pinned' : IDL.Opt(TimestampMillis),
    'min_visible_event_index' : EventIndex,
    'gate' : IDL.Opt(GroupGate),
    'name' : IDL.Text,
    'role' : Role,
    'wasm_version' : Version,
    'notifications_muted' : IDL.Bool,
    'description' : IDL.Text,
    'events_ttl' : IDL.Opt(Milliseconds),
    'last_updated' : TimestampMillis,
    'joined' : TimestampMillis,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'next_message_expiry' : IDL.Opt(TimestampMillis),
    'latest_threads' : IDL.Vec(GroupCanisterThreadDetails),
    'frozen' : IDL.Opt(FrozenGroupInfo),
    'latest_event_index' : EventIndex,
    'history_visible_to_new_joiners' : IDL.Bool,
    'min_visible_message_index' : MessageIndex,
    'mentions' : IDL.Vec(Mention),
    'chat_id' : ChatId,
    'expired_messages' : IDL.Vec(MessageIndexRange),
    'participant_count' : IDL.Nat32,
    'my_metrics' : ChatMetrics,
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const SummaryResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Record({ 'summary' : GroupCanisterGroupChatSummary }),
  });
  const SummaryUpdatesArgs = IDL.Record({ 'updates_since' : TimestampMillis });
  const GroupSubtypeUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : GroupSubtype,
  });
  const GroupGateUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : GroupGate,
  });
  const EventsTimeToLiveUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : Milliseconds,
  });
  const AvatarIdUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : IDL.Nat,
  });
  const TimestampUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : TimestampMillis,
  });
  const FrozenGroupUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : FrozenGroupInfo,
  });
  const GroupCanisterGroupChatSummaryUpdates = IDL.Record({
    'is_public' : IDL.Opt(IDL.Bool),
    'permissions' : IDL.Opt(GroupPermissions),
    'metrics' : IDL.Opt(ChatMetrics),
    'subtype' : GroupSubtypeUpdate,
    'date_last_pinned' : IDL.Opt(TimestampMillis),
    'gate' : GroupGateUpdate,
    'name' : IDL.Opt(IDL.Text),
    'role' : IDL.Opt(Role),
    'wasm_version' : IDL.Opt(Version),
    'notifications_muted' : IDL.Opt(IDL.Bool),
    'description' : IDL.Opt(IDL.Text),
    'events_ttl' : EventsTimeToLiveUpdate,
    'last_updated' : TimestampMillis,
    'avatar_id' : AvatarIdUpdate,
    'next_message_expiry' : TimestampUpdate,
    'latest_threads' : IDL.Vec(GroupCanisterThreadDetails),
    'frozen' : FrozenGroupUpdate,
    'latest_event_index' : IDL.Opt(EventIndex),
    'updated_events' : IDL.Vec(
      IDL.Tuple(IDL.Opt(IDL.Nat32), IDL.Nat32, IDL.Nat64)
    ),
    'mentions' : IDL.Vec(Mention),
    'chat_id' : ChatId,
    'newly_expired_messages' : IDL.Vec(MessageIndexRange),
    'participant_count' : IDL.Opt(IDL.Nat32),
    'my_metrics' : IDL.Opt(ChatMetrics),
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const SummaryUpdatesResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Record({
      'updates' : GroupCanisterGroupChatSummaryUpdates,
    }),
    'SuccessNoUpdates' : IDL.Null,
  });
  const ThreadPreviewsArgs = IDL.Record({
    'latest_client_thread_update' : IDL.Opt(TimestampMillis),
    'threads' : IDL.Vec(MessageIndex),
  });
  const ThreadPreview = IDL.Record({
    'latest_replies' : IDL.Vec(MessageEventWrapper),
    'total_replies' : IDL.Nat32,
    'root_message' : MessageEventWrapper,
  });
  const ThreadPreviewsResponse = IDL.Variant({
    'ReplicaNotUpToDate' : TimestampMillis,
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Record({
      'threads' : IDL.Vec(ThreadPreview),
      'timestamp' : TimestampMillis,
    }),
  });
  const UnblockUserArgs = IDL.Record({
    'user_id' : UserId,
    'correlation_id' : IDL.Nat64,
  });
  const UnblockUserResponse = IDL.Variant({
    'GroupNotPublic' : IDL.Null,
    'CannotUnblockSelf' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const UndeleteMessagesArgs = IDL.Record({
    'message_ids' : IDL.Vec(MessageId),
    'correlation_id' : IDL.Nat64,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const UndeleteMessagesResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'Success' : IDL.Record({ 'messages' : IDL.Vec(Message) }),
    'UserSuspended' : IDL.Null,
  });
  const UnpinMessageArgs = IDL.Record({
    'correlation_id' : IDL.Nat64,
    'message_index' : MessageIndex,
  });
  const UnpinMessageResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'NoChange' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : EventIndex,
    'UserSuspended' : IDL.Null,
    'SuccessV2' : PushEventResult,
  });
  const OptionalGroupPermissions = IDL.Record({
    'block_users' : IDL.Opt(PermissionRole),
    'change_permissions' : IDL.Opt(PermissionRole),
    'delete_messages' : IDL.Opt(PermissionRole),
    'send_messages' : IDL.Opt(PermissionRole),
    'remove_members' : IDL.Opt(PermissionRole),
    'update_group' : IDL.Opt(PermissionRole),
    'invite_users' : IDL.Opt(PermissionRole),
    'change_roles' : IDL.Opt(PermissionRole),
    'add_members' : IDL.Opt(PermissionRole),
    'create_polls' : IDL.Opt(PermissionRole),
    'pin_messages' : IDL.Opt(PermissionRole),
    'reply_in_thread' : IDL.Opt(PermissionRole),
    'react_to_messages' : IDL.Opt(PermissionRole),
  });
  const Avatar = IDL.Record({
    'id' : IDL.Nat,
    'data' : IDL.Vec(IDL.Nat8),
    'mime_type' : IDL.Text,
  });
  const AvatarUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : Avatar,
  });
  const UpdateGroupV2Args = IDL.Record({
    'permissions' : IDL.Opt(OptionalGroupPermissions),
    'gate' : GroupGateUpdate,
    'name' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'events_ttl' : EventsTimeToLiveUpdate,
    'correlation_id' : IDL.Nat64,
    'rules' : IDL.Opt(GroupRules),
    'avatar' : AvatarUpdate,
  });
  const FieldTooLongResult = IDL.Record({
    'length_provided' : IDL.Nat32,
    'max_length' : IDL.Nat32,
  });
  const FieldTooShortResult = IDL.Record({
    'length_provided' : IDL.Nat32,
    'min_length' : IDL.Nat32,
  });
  const UpdateGroupV2Response = IDL.Variant({
    'NameReserved' : IDL.Null,
    'RulesTooLong' : FieldTooLongResult,
    'DescriptionTooLong' : FieldTooLongResult,
    'NameTooShort' : FieldTooShortResult,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'RulesTooShort' : FieldTooShortResult,
    'NameTooLong' : FieldTooLongResult,
    'NameTaken' : IDL.Null,
    'InternalError' : IDL.Null,
  });
  return IDL.Service({
    'add_participants' : IDL.Func(
        [AddParticipantsArgs],
        [AddParticipantsResponse],
        [],
      ),
    'add_reaction' : IDL.Func([AddReactionArgs], [AddReactionResponse], []),
    'block_user' : IDL.Func([BlockUserArgs], [BlockUserResponse], []),
    'change_role' : IDL.Func([ChangeRoleArgs], [ChangeRoleResponse], []),
    'claim_prize' : IDL.Func([ClaimPrizeArgs], [ClaimPrizeResponse], []),
    'delete_messages' : IDL.Func(
        [DeleteMessagesArgs],
        [DeleteMessagesResponse],
        [],
      ),
    'deleted_message' : IDL.Func(
        [DeletedMessageArgs],
        [DeletedMessageResponse],
        ['query'],
      ),
    'disable_invite_code' : IDL.Func(
        [DisableInviteCodeArgs],
        [DisableInviteCodeResponse],
        [],
      ),
    'edit_message' : IDL.Func([EditMessageArgs], [EditMessageResponse], []),
    'enable_invite_code' : IDL.Func(
        [EnableInviteCodeArgs],
        [EnableInviteCodeResponse],
        [],
      ),
    'events' : IDL.Func([EventsArgs], [EventsResponse], ['query']),
    'events_by_index' : IDL.Func(
        [EventsByIndexArgs],
        [EventsResponse],
        ['query'],
      ),
    'events_window' : IDL.Func([EventsWindowArgs], [EventsResponse], ['query']),
    'invite_code' : IDL.Func([InviteCodeArgs], [InviteCodeResponse], ['query']),
    'local_user_index' : IDL.Func(
        [LocalUserIndexArgs],
        [LocalUserIndexResponse],
        ['query'],
      ),
    'make_private' : IDL.Func([MakePrivateArgs], [MakePrivateResponse], []),
    'messages_by_message_index' : IDL.Func(
        [MessagesByMessageIndexArgs],
        [MessagesByMessageIndexResponse],
        ['query'],
      ),
    'pin_message_v2' : IDL.Func([PinMessageArgs], [PinMessageV2Response], []),
    'public_summary' : IDL.Func(
        [PublicSummaryArgs],
        [PublicSummaryResponse],
        ['query'],
      ),
    'register_poll_vote' : IDL.Func(
        [RegisterPollVoteArgs],
        [RegisterPollVoteResponse],
        [],
      ),
    'register_proposal_vote' : IDL.Func(
        [RegisterProposalVoteArgs],
        [RegisterProposalVoteResponse],
        [],
      ),
    'register_proposal_vote_v2' : IDL.Func(
        [RegisterProposalVoteArgs],
        [RegisterProposalVoteV2Response],
        [],
      ),
    'remove_participant' : IDL.Func(
        [RemoveParticipantArgs],
        [RemoveParticipantResponse],
        [],
      ),
    'remove_reaction' : IDL.Func(
        [RemoveReactionArgs],
        [RemoveReactionResponse],
        [],
      ),
    'reset_invite_code' : IDL.Func(
        [ResetInviteCodeArgs],
        [ResetInviteCodeResponse],
        [],
      ),
    'rules' : IDL.Func([RulesArgs], [RulesResponse], ['query']),
    'search_messages' : IDL.Func(
        [SearchMessagesArgs],
        [SearchMessagesResponse],
        ['query'],
      ),
    'selected_initial' : IDL.Func(
        [SelectedInitialArgs],
        [SelectedInitialResponse],
        ['query'],
      ),
    'selected_updates' : IDL.Func(
        [SelectedUpdatesArgs],
        [SelectedUpdatesResponse],
        ['query'],
      ),
    'send_message' : IDL.Func([SendMessageArgs], [SendMessageResponse], []),
    'send_message_v2' : IDL.Func(
        [SendMessageV2Args],
        [SendMessageResponse],
        [],
      ),
    'summary' : IDL.Func([SummaryArgs], [SummaryResponse], ['query']),
    'summary_updates' : IDL.Func(
        [SummaryUpdatesArgs],
        [SummaryUpdatesResponse],
        ['query'],
      ),
    'thread_previews' : IDL.Func(
        [ThreadPreviewsArgs],
        [ThreadPreviewsResponse],
        ['query'],
      ),
    'unblock_user' : IDL.Func([UnblockUserArgs], [UnblockUserResponse], []),
    'undelete_messages' : IDL.Func(
        [UndeleteMessagesArgs],
        [UndeleteMessagesResponse],
        [],
      ),
    'unpin_message' : IDL.Func([UnpinMessageArgs], [UnpinMessageResponse], []),
    'update_group_v2' : IDL.Func(
        [UpdateGroupV2Args],
        [UpdateGroupV2Response],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
