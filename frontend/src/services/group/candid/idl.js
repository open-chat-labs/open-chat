export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const AddParticipantsArgs = IDL.Record({
    'allow_blocked_users' : IDL.Bool,
    'user_ids' : IDL.Vec(UserId),
    'added_by_name' : IDL.Text,
  });
  const AddParticipantsFailedResult = IDL.Record({
    'errors' : IDL.Vec(UserId),
    'users_blocked_from_group' : IDL.Vec(UserId),
    'users_who_blocked_request' : IDL.Vec(UserId),
    'users_already_in_group' : IDL.Vec(UserId),
  });
  const AddParticipantsPartialSuccessResult = IDL.Record({
    'errors' : IDL.Vec(UserId),
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
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'ParticipantLimitReached' : IDL.Nat32,
  });
  const BlockUserArgs = IDL.Record({ 'user_id' : UserId });
  const BlockUserResponse = IDL.Variant({
    'GroupNotPublic' : IDL.Null,
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
    'CannotBlockSelf' : IDL.Null,
    'CannotBlockUser' : IDL.Null,
  });
  const FallbackRole = IDL.Variant({
    'Participant' : IDL.Null,
    'Admin' : IDL.Null,
  });
  const Role = IDL.Variant({
    'Participant' : IDL.Null,
    'SuperAdmin' : FallbackRole,
    'Admin' : IDL.Null,
    'Owner' : IDL.Null,
  });
  const ChangeRoleArgs = IDL.Record({ 'user_id' : UserId, 'new_role' : Role });
  const ChangeRoleResponse = IDL.Variant({
    'Invalid' : IDL.Null,
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const MessageId = IDL.Nat;
  const MessageIndex = IDL.Nat32;
  const DeleteMessagesArgs = IDL.Record({
    'message_ids' : IDL.Vec(MessageId),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const DeleteMessagesResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Null,
  });
  const DisableInviteCodeArgs = IDL.Record({});
  const DisableInviteCodeResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
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
  const TimestampMillis = IDL.Nat64;
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
  const AudioContent = IDL.Record({
    'mime_type' : IDL.Text,
    'blob_reference' : IDL.Opt(BlobReference),
    'caption' : IDL.Opt(IDL.Text),
  });
  const AccountIdentifier = IDL.Vec(IDL.Nat8);
  const NnsCryptoAccount = IDL.Variant({
    'Mint' : IDL.Null,
    'Account' : AccountIdentifier,
  });
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  const Cryptocurrency = IDL.Variant({ 'InternetComputer' : IDL.Null });
  const TransactionHash = IDL.Vec(IDL.Nat8);
  const Memo = IDL.Nat64;
  const NnsFailedCryptoTransaction = IDL.Record({
    'to' : NnsCryptoAccount,
    'fee' : Tokens,
    'created' : TimestampMillis,
    'token' : Cryptocurrency,
    'transaction_hash' : TransactionHash,
    'from' : NnsCryptoAccount,
    'memo' : Memo,
    'error_message' : IDL.Text,
    'amount' : Tokens,
  });
  const FailedCryptoTransaction = IDL.Variant({
    'NNS' : NnsFailedCryptoTransaction,
  });
  const BlockIndex = IDL.Nat64;
  const NnsCompletedCryptoTransaction = IDL.Record({
    'to' : NnsCryptoAccount,
    'fee' : Tokens,
    'created' : TimestampMillis,
    'token' : Cryptocurrency,
    'transaction_hash' : TransactionHash,
    'block_index' : BlockIndex,
    'from' : NnsCryptoAccount,
    'memo' : Memo,
    'amount' : Tokens,
  });
  const CompletedCryptoTransaction = IDL.Variant({
    'NNS' : NnsCompletedCryptoTransaction,
  });
  const NnsUserOrAccount = IDL.Variant({
    'User' : UserId,
    'Account' : AccountIdentifier,
  });
  const NnsPendingCryptoTransaction = IDL.Record({
    'to' : NnsUserOrAccount,
    'fee' : IDL.Opt(Tokens),
    'token' : Cryptocurrency,
    'memo' : IDL.Opt(Memo),
    'amount' : Tokens,
  });
  const PendingCryptoTransaction = IDL.Variant({
    'NNS' : NnsPendingCryptoTransaction,
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
  const MessageContent = IDL.Variant({
    'Giphy' : GiphyContent,
    'File' : FileContent,
    'Poll' : PollContent,
    'Text' : TextContent,
    'Image' : ImageContent,
    'GovernanceProposal' : ProposalContent,
    'Audio' : AudioContent,
    'Crypto' : CryptoContent,
    'Video' : VideoContent,
    'Deleted' : DeletedContent,
  });
  const EditMessageArgs = IDL.Record({
    'content' : MessageContent,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const EditMessageResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Null,
  });
  const EnableInviteCodeArgs = IDL.Record({});
  const EnableInviteCodeResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'code' : IDL.Nat64 }),
  });
  const EventIndex = IDL.Nat32;
  const EventsArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'invite_code' : IDL.Opt(IDL.Nat64),
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
  const ParticipantJoined = IDL.Record({
    'user_id' : UserId,
    'as_super_admin' : IDL.Bool,
  });
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
    'chat_id_if_other' : IDL.Opt(ChatId),
    'event_index' : EventIndex,
  });
  const Message = IDL.Record({
    'forwarded' : IDL.Bool,
    'content' : MessageContent,
    'edited' : IDL.Bool,
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
  const ParticipantLeft = IDL.Record({ 'user_id' : UserId });
  const ParticipantDismissedAsSuperAdmin = IDL.Record({ 'user_id' : UserId });
  const GroupNameChanged = IDL.Record({
    'changed_by' : UserId,
    'new_name' : IDL.Text,
    'previous_name' : IDL.Text,
  });
  const RoleChanged = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'changed_by' : UserId,
    'old_role' : Role,
    'new_role' : Role,
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
    'PollEnded' : PollEnded,
    'GroupInviteCodeChanged' : GroupInviteCodeChanged,
    'ThreadUpdated' : ThreadUpdated,
    'UsersUnblocked' : UsersUnblocked,
    'PollVoteRegistered' : UpdatedMessage,
    'ParticipantLeft' : ParticipantLeft,
    'MessageDeleted' : UpdatedMessage,
    'ParticipantDismissedAsSuperAdmin' : ParticipantDismissedAsSuperAdmin,
    'GroupNameChanged' : GroupNameChanged,
    'RoleChanged' : RoleChanged,
    'PollVoteDeleted' : UpdatedMessage,
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
  });
  const EventsSuccessResult = IDL.Record({
    'affected_events' : IDL.Vec(ChatEventWrapper),
    'events' : IDL.Vec(ChatEventWrapper),
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
  const EventsRangeArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'invite_code' : IDL.Opt(IDL.Nat64),
    'to_index' : EventIndex,
    'from_index' : EventIndex,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const EventsWindowArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'mid_point' : MessageIndex,
    'invite_code' : IDL.Opt(IDL.Nat64),
    'max_events' : IDL.Nat32,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const InviteCodeArgs = IDL.Record({});
  const InviteCodeResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'code' : IDL.Opt(IDL.Nat64) }),
  });
  const MakePrivateArgs = IDL.Record({});
  const MakePrivateResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
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
  const PinMessageArgs = IDL.Record({ 'message_index' : MessageIndex });
  const PinMessageResponse = IDL.Variant({
    'MessageIndexOutOfRange' : IDL.Null,
    'MessageNotFound' : IDL.Null,
    'NoChange' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : EventIndex,
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
  const PublicGroupSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'subtype' : IDL.Opt(GroupSubtype),
    'name' : IDL.Text,
    'wasm_version' : Version,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'owner_id' : UserId,
    'avatar_id' : IDL.Opt(IDL.Nat),
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
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'message_index' : MessageIndex,
  });
  const RegisterPollVoteResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'PollEnded' : IDL.Null,
    'Success' : PollVotes,
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
    'Success' : IDL.Null,
    'ProposalNotAcceptingVotes' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const RemoveParticipantArgs = IDL.Record({ 'user_id' : UserId });
  const RemoveParticipantResponse = IDL.Variant({
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'CannotRemoveSelf' : IDL.Null,
    'CannotRemoveUser' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const ResetInviteCodeArgs = IDL.Record({});
  const ResetInviteCodeResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'code' : IDL.Nat64 }),
  });
  const SearchMessagesArgs = IDL.Record({
    'max_results' : IDL.Nat8,
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
  const SelectedInitialSuccess = IDL.Record({
    'participants' : IDL.Vec(Participant),
    'blocked_users' : IDL.Vec(UserId),
    'pinned_messages' : IDL.Vec(MessageIndex),
    'latest_event_index' : EventIndex,
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
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'message_index' : MessageIndex,
    }),
    'MessageEmpty' : IDL.Null,
    'InvalidPoll' : InvalidPollReason,
    'InvalidRequest' : IDL.Text,
  });
  const ThreadPreviewsArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'threads' : IDL.Vec(MessageIndex),
  });
  const ThreadPreview = IDL.Record({
    'latest_replies' : IDL.Vec(MessageEventWrapper),
    'total_replies' : IDL.Nat32,
    'root_message' : MessageEventWrapper,
  });
  const ThreadPreviewsResponse = IDL.Variant({
    'ReplicaNotUpToDate' : EventIndex,
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Record({
      'threads' : IDL.Vec(ThreadPreview),
      'latest_event_index' : EventIndex,
    }),
  });
  const ToggleReactionArgs = IDL.Record({
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'reaction' : IDL.Text,
  });
  const ToggleReactionResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'InvalidReaction' : IDL.Null,
    'Added' : EventIndex,
    'Removed' : EventIndex,
  });
  const UnblockUserArgs = IDL.Record({ 'user_id' : UserId });
  const UnblockUserResponse = IDL.Variant({
    'GroupNotPublic' : IDL.Null,
    'CannotUnblockSelf' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const UnpinMessageArgs = IDL.Record({ 'message_index' : MessageIndex });
  const UnpinMessageResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'NoChange' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : EventIndex,
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
  const UpdateGroupArgs = IDL.Record({
    'permissions' : IDL.Opt(GroupPermissions),
    'name' : IDL.Text,
    'description' : IDL.Text,
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
  const UpdateGroupResponse = IDL.Variant({
    'NameReserved' : IDL.Null,
    'DescriptionTooLong' : FieldTooLongResult,
    'NameTooShort' : FieldTooShortResult,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : IDL.Null,
    'NameTooLong' : FieldTooLongResult,
    'NameTaken' : IDL.Null,
    'InternalError' : IDL.Null,
  });
  const UpdatePermissionsArgs = IDL.Record({
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
  const UpdatePermissionsResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  return IDL.Service({
    'add_participants' : IDL.Func(
        [AddParticipantsArgs],
        [AddParticipantsResponse],
        [],
      ),
    'block_user' : IDL.Func([BlockUserArgs], [BlockUserResponse], []),
    'change_role' : IDL.Func([ChangeRoleArgs], [ChangeRoleResponse], []),
    'delete_messages' : IDL.Func(
        [DeleteMessagesArgs],
        [DeleteMessagesResponse],
        [],
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
    'events_range' : IDL.Func([EventsRangeArgs], [EventsResponse], ['query']),
    'events_window' : IDL.Func([EventsWindowArgs], [EventsResponse], ['query']),
    'invite_code' : IDL.Func([InviteCodeArgs], [InviteCodeResponse], ['query']),
    'make_private' : IDL.Func([MakePrivateArgs], [MakePrivateResponse], []),
    'messages_by_message_index' : IDL.Func(
        [MessagesByMessageIndexArgs],
        [MessagesByMessageIndexResponse],
        ['query'],
      ),
    'pin_message' : IDL.Func([PinMessageArgs], [PinMessageResponse], []),
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
    'remove_participant' : IDL.Func(
        [RemoveParticipantArgs],
        [RemoveParticipantResponse],
        [],
      ),
    'reset_invite_code' : IDL.Func(
        [ResetInviteCodeArgs],
        [ResetInviteCodeResponse],
        [],
      ),
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
    'thread_previews' : IDL.Func(
        [ThreadPreviewsArgs],
        [ThreadPreviewsResponse],
        ['query'],
      ),
    'toggle_reaction' : IDL.Func(
        [ToggleReactionArgs],
        [ToggleReactionResponse],
        [],
      ),
    'unblock_user' : IDL.Func([UnblockUserArgs], [UnblockUserResponse], []),
    'unpin_message' : IDL.Func([UnpinMessageArgs], [UnpinMessageResponse], []),
    'update_group' : IDL.Func([UpdateGroupArgs], [UpdateGroupResponse], []),
    'update_permissions' : IDL.Func(
        [UpdatePermissionsArgs],
        [UpdatePermissionsResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
