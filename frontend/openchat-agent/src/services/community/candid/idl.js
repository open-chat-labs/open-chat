export const idlFactory = ({ IDL }) => {
  const ChannelId = IDL.Nat;
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const AddMembersToChannelArgs = IDL.Record({
    'channel_id' : ChannelId,
    'user_ids' : IDL.Vec(UserId),
    'added_by_name' : IDL.Text,
  });
  const GateCheckFailedReason = IDL.Variant({
    'NotDiamondMember' : IDL.Null,
    'NoSnsNeuronsFound' : IDL.Null,
    'NoSnsNeuronsWithRequiredDissolveDelayFound' : IDL.Null,
    'NoSnsNeuronsWithRequiredStakeFound' : IDL.Null,
  });
  const UserFailedGateCheck = IDL.Record({
    'user_id' : UserId,
    'reason' : GateCheckFailedReason,
  });
  const UserFailedError = IDL.Record({
    'user_id' : UserId,
    'error' : IDL.Text,
  });
  const AddMembersToChannelFailed = IDL.Record({
    'users_limit_reached' : IDL.Vec(UserId),
    'users_failed_gate_check' : IDL.Vec(UserFailedGateCheck),
    'users_already_in_channel' : IDL.Vec(UserId),
    'users_failed_with_error' : IDL.Vec(UserFailedError),
  });
  const AddMembersToChannelPartialSuccess = IDL.Record({
    'users_limit_reached' : IDL.Vec(UserId),
    'users_failed_gate_check' : IDL.Vec(UserFailedGateCheck),
    'users_already_in_channel' : IDL.Vec(UserId),
    'users_failed_with_error' : IDL.Vec(UserFailedError),
    'users_added' : IDL.Vec(UserId),
  });
  const AddMembersToChannelResponse = IDL.Variant({
    'Failed' : AddMembersToChannelFailed,
    'UserNotInChannel' : IDL.Null,
    'PartialSuccess' : AddMembersToChannelPartialSuccess,
    'ChannelNotFound' : IDL.Null,
    'UserLimitReached' : IDL.Nat32,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
  });
  const MessageId = IDL.Nat;
  const MessageIndex = IDL.Nat32;
  const AddReactionArgs = IDL.Record({
    'channel_id' : ChannelId,
    'username' : IDL.Text,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'reaction' : IDL.Text,
  });
  const AddReactionResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'MessageNotFound' : IDL.Null,
    'NoChange' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'InvalidReaction' : IDL.Null,
  });
  const BlockUserArgs = IDL.Record({ 'user_id' : UserId });
  const BlockUserResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'CommunityNotPublic' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'TargetUserNotInCommunity' : IDL.Null,
    'InternalError' : IDL.Text,
    'CannotBlockSelf' : IDL.Null,
    'CannotBlockUser' : IDL.Null,
  });
  const GroupRole = IDL.Variant({
    'Participant' : IDL.Null,
    'Admin' : IDL.Null,
    'Moderator' : IDL.Null,
    'Owner' : IDL.Null,
  });
  const ChangeChannelRoleArgs = IDL.Record({
    'channel_id' : ChannelId,
    'user_id' : UserId,
    'new_role' : GroupRole,
  });
  const ChangeChannelRoleResponse = IDL.Variant({
    'Invalid' : IDL.Null,
    'UserNotInChannel' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'TargetUserNotInChannel' : IDL.Null,
  });
  const CommunityRole = IDL.Variant({
    'Member' : IDL.Null,
    'Admin' : IDL.Null,
    'Owner' : IDL.Null,
  });
  const ChangeRoleArgs = IDL.Record({
    'user_id' : UserId,
    'new_role' : CommunityRole,
  });
  const ChangeRoleResponse = IDL.Variant({
    'Invalid' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'TargetUserNotInCommunity' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const ChannelSummaryArgs = IDL.Record({ 'channel_id' : ChannelId });
  const PermissionRole = IDL.Variant({
    'Moderators' : IDL.Null,
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
  const TimestampMillis = IDL.Nat64;
  const ChatMetrics = IDL.Record({
    'prize_winner_messages' : IDL.Nat64,
    'audio_messages' : IDL.Nat64,
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
  const GovernanceProposalsSubtype = IDL.Record({
    'is_nns' : IDL.Bool,
    'governance_canister_id' : CanisterId,
  });
  const GroupSubtype = IDL.Variant({
    'GovernanceProposals' : GovernanceProposalsSubtype,
  });
  const EventIndex = IDL.Nat32;
  const Milliseconds = IDL.Nat64;
  const SnsNeuronGate = IDL.Record({
    'min_stake_e8s' : IDL.Opt(IDL.Nat64),
    'min_dissolve_delay' : IDL.Opt(Milliseconds),
    'governance_canister_id' : CanisterId,
  });
  const AccessGate = IDL.Variant({
    'SnsNeuron' : SnsNeuronGate,
    'DiamondMember' : IDL.Null,
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
  const ChannelMembership = IDL.Record({
    'role' : GroupRole,
    'notifications_muted' : IDL.Bool,
    'joined' : TimestampMillis,
    'latest_threads' : IDL.Vec(GroupCanisterThreadDetails),
    'mentions' : IDL.Vec(Mention),
    'my_metrics' : ChatMetrics,
  });
  const MessageIndexRange = IDL.Record({
    'end' : MessageIndex,
    'start' : MessageIndex,
  });
  const MessageReport = IDL.Record({
    'notes' : IDL.Opt(IDL.Text),
    'timestamp' : TimestampMillis,
    'reported_by' : UserId,
    'reason_code' : IDL.Nat32,
  });
  const ReportedMessage = IDL.Record({
    'count' : IDL.Nat32,
    'reports' : IDL.Vec(MessageReport),
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
  const Cryptocurrency = IDL.Variant({
    'InternetComputer' : IDL.Null,
    'CHAT' : IDL.Null,
    'SNS1' : IDL.Null,
    'CKBTC' : IDL.Null,
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
  const AccountIdentifier = IDL.Vec(IDL.Nat8);
  const NnsCryptoAccount = IDL.Variant({
    'Mint' : IDL.Null,
    'Account' : AccountIdentifier,
  });
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  const TimestampNanos = IDL.Nat64;
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
  const MessageEventWrapper = IDL.Record({
    'event' : Message,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
    'correlation_id' : IDL.Nat64,
    'expires_at' : IDL.Opt(TimestampMillis),
  });
  const CommunityCanisterChannelSummary = IDL.Record({
    'channel_id' : ChannelId,
    'is_public' : IDL.Bool,
    'permissions' : GroupPermissions,
    'metrics' : ChatMetrics,
    'subtype' : IDL.Opt(GroupSubtype),
    'date_last_pinned' : IDL.Opt(TimestampMillis),
    'min_visible_event_index' : EventIndex,
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'description' : IDL.Text,
    'events_ttl' : IDL.Opt(Milliseconds),
    'last_updated' : TimestampMillis,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'next_message_expiry' : IDL.Opt(TimestampMillis),
    'membership' : IDL.Opt(ChannelMembership),
    'latest_event_index' : EventIndex,
    'banner_id' : IDL.Opt(IDL.Nat),
    'history_visible_to_new_joiners' : IDL.Bool,
    'min_visible_message_index' : MessageIndex,
    'member_count' : IDL.Nat32,
    'expired_messages' : IDL.Vec(MessageIndexRange),
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const ChannelSummaryResponse = IDL.Variant({
    'ChannelNotFound' : IDL.Null,
    'Success' : CommunityCanisterChannelSummary,
    'PrivateCommunity' : IDL.Null,
    'PrivateChannel' : IDL.Null,
  });
  const ChannelSummaryUpdatesArgs = IDL.Record({
    'channel_id' : ChannelId,
    'updates_since' : TimestampMillis,
  });
  const GroupSubtypeUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : GroupSubtype,
  });
  const AccessGateUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : AccessGate,
  });
  const EventsTimeToLiveUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : Milliseconds,
  });
  const DocumentIdUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : IDL.Nat,
  });
  const ChannelMembershipUpdates = IDL.Record({
    'role' : IDL.Opt(GroupRole),
    'notifications_muted' : IDL.Opt(IDL.Bool),
    'latest_threads' : IDL.Vec(GroupCanisterThreadDetails),
    'mentions' : IDL.Vec(Mention),
    'my_metrics' : IDL.Opt(ChatMetrics),
  });
  const CommunityCanisterChannelSummaryUpdates = IDL.Record({
    'channel_id' : ChannelId,
    'is_public' : IDL.Opt(IDL.Bool),
    'permissions' : IDL.Opt(GroupPermissions),
    'metrics' : IDL.Opt(ChatMetrics),
    'subtype' : GroupSubtypeUpdate,
    'date_last_pinned' : IDL.Opt(TimestampMillis),
    'gate' : AccessGateUpdate,
    'name' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'events_ttl' : EventsTimeToLiveUpdate,
    'last_updated' : TimestampMillis,
    'avatar_id' : DocumentIdUpdate,
    'membership' : IDL.Opt(ChannelMembershipUpdates),
    'latest_event_index' : IDL.Opt(EventIndex),
    'member_count' : IDL.Opt(IDL.Nat32),
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const ChannelSummaryUpdatesResponse = IDL.Variant({
    'SuccessAdded' : CommunityCanisterChannelSummary,
    'ChannelNotFound' : IDL.Null,
    'SuccessNoUpdates' : IDL.Null,
    'PrivateCommunity' : IDL.Null,
    'PrivateChannel' : IDL.Null,
    'SuccessUpdated' : CommunityCanisterChannelSummaryUpdates,
  });
  const AccessRules = IDL.Record({ 'text' : IDL.Text, 'enabled' : IDL.Bool });
  const Document = IDL.Record({
    'id' : IDL.Nat,
    'data' : IDL.Vec(IDL.Nat8),
    'mime_type' : IDL.Text,
  });
  const CreateChannelArgs = IDL.Record({
    'is_public' : IDL.Bool,
    'permissions' : IDL.Opt(GroupPermissions),
    'subtype' : IDL.Opt(GroupSubtype),
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'description' : IDL.Text,
    'events_ttl' : IDL.Opt(Milliseconds),
    'history_visible_to_new_joiners' : IDL.Bool,
    'rules' : AccessRules,
    'avatar' : IDL.Opt(Document),
  });
  const FieldTooLongResult = IDL.Record({
    'length_provided' : IDL.Nat32,
    'max_length' : IDL.Nat32,
  });
  const FieldTooShortResult = IDL.Record({
    'length_provided' : IDL.Nat32,
    'min_length' : IDL.Nat32,
  });
  const CreateChannelResponse = IDL.Variant({
    'MaxChannelsCreated' : IDL.Nat32,
    'NameReserved' : IDL.Null,
    'RulesTooLong' : FieldTooLongResult,
    'DescriptionTooLong' : FieldTooLongResult,
    'NameTooShort' : FieldTooShortResult,
    'NotAuthorized' : IDL.Null,
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : IDL.Record({ 'channel_id' : ChannelId }),
    'UserSuspended' : IDL.Null,
    'RulesTooShort' : FieldTooShortResult,
    'CommunityFrozen' : IDL.Null,
    'NameTooLong' : FieldTooLongResult,
    'NameTaken' : IDL.Null,
  });
  const DeclineInvitationArgs = IDL.Record({
    'channel_id' : IDL.Opt(ChannelId),
  });
  const DeclineInvitationResponse = IDL.Variant({
    'NotInvited' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
  });
  const DeleteChannelArgs = IDL.Record({ 'channel_id' : ChannelId });
  const DeleteChannelResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
  });
  const DeleteMessagesArgs = IDL.Record({
    'channel_id' : ChannelId,
    'as_platform_moderator' : IDL.Opt(IDL.Bool),
    'message_ids' : IDL.Vec(MessageId),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const DeleteMessagesResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'MessageNotFound' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'NotPlatformModerator' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const DeletedMessageArgs = IDL.Record({
    'channel_id' : ChannelId,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const DeletedMessageResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'MessageNotFound' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'content' : MessageContent }),
    'UserNotInCommunity' : IDL.Null,
    'MessageHardDeleted' : IDL.Null,
    'MessageNotDeleted' : IDL.Null,
  });
  const EmptyArgs = IDL.Record({});
  const DisableInviteCodeResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
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
  const EditMessageArgs = IDL.Record({
    'channel_id' : ChannelId,
    'content' : MessageContentInitial,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const EditMessageResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'MessageNotFound' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
  });
  const EnableInviteCodeResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'code' : IDL.Nat64 }),
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
  });
  const EventsArgs = IDL.Record({
    'channel_id' : ChannelId,
    'latest_client_event_index' : IDL.Opt(EventIndex),
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
  const ParticipantJoined = IDL.Record({
    'user_id' : UserId,
    'invited_by' : IDL.Opt(UserId),
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
  const UsersInvited = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'invited_by' : UserId,
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
<<<<<<< HEAD
=======
  const ThreadSummary = IDL.Record({
    'latest_event_timestamp' : TimestampMillis,
    'participant_ids' : IDL.Vec(UserId),
    'reply_count' : IDL.Nat32,
    'latest_event_index' : EventIndex,
  });
  const ChatId = CanisterId;
  const ReplyContext = IDL.Record({
    'event_list_if_other' : IDL.Opt(IDL.Tuple(ChatId, IDL.Opt(MessageIndex))),
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
>>>>>>> master
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
  const GroupGateUpdated = IDL.Record({
    'updated_by' : UserId,
    'new_gate' : IDL.Opt(AccessGate),
  });
  const RoleChanged = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'changed_by' : UserId,
    'old_role' : GroupRole,
    'new_role' : GroupRole,
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
    'UsersInvited' : UsersInvited,
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
    'ThreadNotFound' : IDL.Null,
    'UserNotInChannel' : IDL.Null,
    'ReplicaNotUpToDate' : EventIndex,
    'ChannelNotFound' : IDL.Null,
    'Success' : EventsSuccessResult,
    'UserNotInCommunity' : IDL.Null,
  });
  const EventsByIndexArgs = IDL.Record({
    'channel_id' : ChannelId,
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'events' : IDL.Vec(EventIndex),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const EventsWindowArgs = IDL.Record({
    'channel_id' : ChannelId,
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'mid_point' : MessageIndex,
    'max_messages' : IDL.Nat32,
    'max_events' : IDL.Nat32,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const InviteCodeResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'code' : IDL.Opt(IDL.Nat64) }),
    'UserNotInCommunity' : IDL.Null,
  });
  const JoinChannelArgs = IDL.Record({ 'channel_id' : ChannelId });
  const JoinChannelResponse = IDL.Variant({
    'NotInvited' : IDL.Null,
    'AlreadyInChannel' : CommunityCanisterChannelSummary,
    'GateCheckFailed' : GateCheckFailedReason,
    'ChannelNotFound' : IDL.Null,
    'UserLimitReached' : IDL.Nat32,
    'Success' : CommunityCanisterChannelSummary,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
    'UserBlocked' : IDL.Null,
  });
  const LeaveChannelArgs = IDL.Record({ 'channel_id' : ChannelId });
  const LeaveChannelResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'LastOwnerCannotLeave' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
  });
  const LocalUserIndexResponse = IDL.Variant({ 'Success' : CanisterId });
  const MakeChannelPrivateArgs = IDL.Record({ 'channel_id' : ChannelId });
  const MakeChannelPrivateResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'AlreadyPrivate' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
  });
  const MakePrivateResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'AlreadyPrivate' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'InternalError' : IDL.Null,
  });
  const MessagesByMessageIndexArgs = IDL.Record({
    'channel_id' : ChannelId,
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'messages' : IDL.Vec(MessageIndex),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const MessagesSuccessResult = IDL.Record({
    'messages' : IDL.Vec(MessageEventWrapper),
    'timestamp' : TimestampMillis,
    'latest_event_index' : EventIndex,
  });
  const MessagesByMessageIndexResponse = IDL.Variant({
    'ThreadNotFound' : IDL.Null,
    'UserNotInChannel' : IDL.Null,
    'ReplicaNotUpToDate' : EventIndex,
    'ChannelNotFound' : IDL.Null,
    'Success' : MessagesSuccessResult,
    'UserNotInCommunity' : IDL.Null,
  });
  const PinMessageArgs = IDL.Record({
    'channel_id' : ChannelId,
    'message_index' : MessageIndex,
  });
  const PushEventResult = IDL.Record({
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
    'expires_at' : IDL.Opt(TimestampMillis),
  });
  const PinMessageResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'MessageNotFound' : IDL.Null,
    'NoChange' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : PushEventResult,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
  });
  const RemoveMemberArgs = IDL.Record({ 'user_id' : UserId });
  const RemoveMemberResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'TargetUserNotInCommunity' : IDL.Null,
    'CannotRemoveSelf' : IDL.Null,
    'CannotRemoveUser' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const RemoveMemberFromChannelArgs = IDL.Record({
    'channel_id' : ChannelId,
    'user_id' : UserId,
  });
  const RemoveMemberFromChannelResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'TargetUserNotInCommunity' : IDL.Null,
    'TargetUserNotInChannel' : IDL.Null,
    'CannotRemoveSelf' : IDL.Null,
  });
  const RemoveReactionArgs = IDL.Record({
    'channel_id' : ChannelId,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'reaction' : IDL.Text,
  });
  const RemoveReactionResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'MessageNotFound' : IDL.Null,
    'NoChange' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
  });
  const RulesArgs = IDL.Record({ 'invite_code' : IDL.Opt(IDL.Nat64) });
  const RulesResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'rules' : IDL.Opt(IDL.Text) }),
  });
  const SearchChannelArgs = IDL.Record({
    'channel_id' : ChannelId,
    'max_results' : IDL.Nat8,
    'users' : IDL.Opt(IDL.Vec(UserId)),
    'search_term' : IDL.Text,
  });
  const MessageMatch = IDL.Record({
    'content' : MessageContent,
    'sender' : UserId,
    'score' : IDL.Nat32,
    'message_index' : MessageIndex,
  });
  const SearchChannelResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'UserNotInChannel' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'TooManyUsers' : IDL.Nat8,
    'Success' : IDL.Record({ 'matches' : IDL.Vec(MessageMatch) }),
    'UserNotInCommunity' : IDL.Null,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const SelectedChannelInitialArgs = IDL.Record({ 'channel_id' : ChannelId });
  const Participant = IDL.Record({
    'role' : GroupRole,
    'user_id' : UserId,
    'date_added' : TimestampMillis,
  });
  const SelectedChannelInitialResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'Success' : IDL.Record({
      'members' : IDL.Vec(Participant),
      'invited_users' : IDL.Vec(UserId),
      'blocked_users' : IDL.Vec(UserId),
      'timestamp' : TimestampMillis,
      'pinned_messages' : IDL.Vec(MessageIndex),
      'latest_event_index' : EventIndex,
      'rules' : AccessRules,
    }),
    'UserNotInCommunity' : IDL.Null,
  });
  const SelectedChannelUpdatesArgs = IDL.Record({
    'channel_id' : ChannelId,
    'updates_since' : TimestampMillis,
  });
  const SelectedGroupUpdates = IDL.Record({
    'blocked_users_removed' : IDL.Vec(UserId),
    'pinned_messages_removed' : IDL.Vec(MessageIndex),
    'invited_users' : IDL.Opt(IDL.Vec(UserId)),
    'members_added_or_updated' : IDL.Vec(Participant),
    'pinned_messages_added' : IDL.Vec(MessageIndex),
    'members_removed' : IDL.Vec(UserId),
    'timestamp' : TimestampMillis,
    'latest_event_index' : EventIndex,
    'rules' : IDL.Opt(AccessRules),
    'blocked_users_added' : IDL.Vec(UserId),
  });
  const SelectedChannelUpdatesResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'Success' : SelectedGroupUpdates,
    'UserNotInCommunity' : IDL.Null,
    'SuccessNoUpdates' : IDL.Null,
  });
  const User = IDL.Record({ 'username' : IDL.Text, 'user_id' : UserId });
  const GroupReplyContext = IDL.Record({ 'event_index' : EventIndex });
  const SendMessageArgs = IDL.Record({
    'channel_id' : ChannelId,
    'content' : MessageContentInitial,
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
    'UserNotInChannel' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'expires_at' : IDL.Opt(TimestampMillis),
      'message_index' : MessageIndex,
    }),
    'UserNotInCommunity' : IDL.Null,
    'MessageEmpty' : IDL.Null,
    'InvalidPoll' : InvalidPollReason,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'InvalidRequest' : IDL.Text,
  });
  const CommunityPermissionRole = IDL.Variant({
    'Owners' : IDL.Null,
    'Admins' : IDL.Null,
    'Members' : IDL.Null,
  });
  const CommunityPermissions = IDL.Record({
    'create_public_channel' : CommunityPermissionRole,
    'block_users' : CommunityPermissionRole,
    'change_permissions' : CommunityPermissionRole,
    'update_details' : CommunityPermissionRole,
    'remove_members' : CommunityPermissionRole,
    'invite_users' : CommunityPermissionRole,
    'change_roles' : CommunityPermissionRole,
    'create_private_channel' : CommunityPermissionRole,
  });
  const CommunityId = CanisterId;
  const CommunityMembership = IDL.Record({
    'role' : CommunityRole,
    'joined' : TimestampMillis,
  });
  const FrozenGroupInfo = IDL.Record({
    'timestamp' : TimestampMillis,
    'frozen_by' : UserId,
    'reason' : IDL.Opt(IDL.Text),
  });
  const CommunityCanisterCommunitySummary = IDL.Record({
    'is_public' : IDL.Bool,
    'permissions' : CommunityPermissions,
    'community_id' : CommunityId,
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'channels' : IDL.Vec(CommunityCanisterChannelSummary),
    'avatar_id' : IDL.Opt(IDL.Nat),
    'membership' : IDL.Opt(CommunityMembership),
    'frozen' : IDL.Opt(FrozenGroupInfo),
    'latest_event_index' : EventIndex,
    'banner_id' : IDL.Opt(IDL.Nat),
    'member_count' : IDL.Nat32,
  });
  const SummaryResponse = IDL.Variant({
    'Success' : CommunityCanisterCommunitySummary,
    'PrivateCommunity' : IDL.Null,
  });
  const SummaryUpdatesArgs = IDL.Record({ 'updates_since' : TimestampMillis });
  const CommunityMembershipUpdates = IDL.Record({
    'role' : IDL.Opt(CommunityRole),
    'channels_removed' : IDL.Vec(ChannelId),
  });
  const FrozenGroupUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : FrozenGroupInfo,
  });
  const CommunityCanisterCommunitySummaryUpdates = IDL.Record({
    'is_public' : IDL.Opt(IDL.Bool),
    'permissions' : IDL.Opt(CommunityPermissions),
    'community_id' : CommunityId,
    'channels_updated' : IDL.Vec(CommunityCanisterChannelSummaryUpdates),
    'gate' : AccessGateUpdate,
    'name' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'last_updated' : TimestampMillis,
    'avatar_id' : DocumentIdUpdate,
    'channels_added' : IDL.Vec(CommunityCanisterChannelSummary),
    'membership' : IDL.Opt(CommunityMembershipUpdates),
    'frozen' : FrozenGroupUpdate,
    'latest_event_index' : IDL.Opt(EventIndex),
    'banner_id' : DocumentIdUpdate,
    'member_count' : IDL.Opt(IDL.Nat32),
  });
  const SummaryUpdatesResponse = IDL.Variant({
    'Success' : CommunityCanisterCommunitySummaryUpdates,
    'SuccessNoUpdates' : IDL.Null,
    'PrivateCommunity' : IDL.Null,
  });
  const ToggleMuteChannelNotificationsArgs = IDL.Record({
    'channel_id' : ChannelId,
    'mute' : IDL.Bool,
  });
  const ToggleMuteChannelNotificationsResponse = IDL.Variant({
    'UserNotInChannel' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
  });
  const ToggleMuteNotificationsArgs = IDL.Record({ 'mute' : IDL.Bool });
  const ToggleMuteNotificationsResponse = IDL.Variant({
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
  });
  const UnblockUserArgs = IDL.Record({ 'user_id' : UserId });
  const UnblockUserResponse = IDL.Variant({
    'CannotUnblockSelf' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'CommunityNotPublic' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
  });
  const UndeleteMessagesArgs = IDL.Record({
    'channel_id' : ChannelId,
    'message_ids' : IDL.Vec(MessageId),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const UndeleteMessagesResponse = IDL.Variant({
    'GroupNotFound' : IDL.Null,
    'UserNotInChannel' : IDL.Null,
    'MessageNotFound' : IDL.Null,
    'Success' : IDL.Record({ 'messages' : IDL.Vec(Message) }),
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
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
    'create_polls' : IDL.Opt(PermissionRole),
    'pin_messages' : IDL.Opt(PermissionRole),
    'reply_in_thread' : IDL.Opt(PermissionRole),
    'react_to_messages' : IDL.Opt(PermissionRole),
  });
  const DocumentUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : Document,
  });
  const UpdateChannelArgs = IDL.Record({
    'channel_id' : ChannelId,
    'permissions' : IDL.Opt(OptionalGroupPermissions),
    'gate' : AccessGateUpdate,
    'name' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'rules' : IDL.Opt(AccessRules),
    'avatar' : DocumentUpdate,
  });
  const UpdateChannelResponse = IDL.Variant({
    'NameReserved' : IDL.Null,
    'RulesTooLong' : FieldTooLongResult,
    'DescriptionTooLong' : FieldTooLongResult,
    'NameTooShort' : FieldTooShortResult,
    'UserNotInChannel' : IDL.Null,
    'ChannelNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'RulesTooShort' : FieldTooShortResult,
    'CommunityFrozen' : IDL.Null,
    'NameTooLong' : FieldTooLongResult,
    'NameTaken' : IDL.Null,
  });
  const OptionalCommunityPermissions = IDL.Record({
    'create_public_channel' : IDL.Opt(CommunityPermissionRole),
    'block_users' : IDL.Opt(CommunityPermissionRole),
    'change_permissions' : IDL.Opt(CommunityPermissionRole),
    'update_details' : IDL.Opt(CommunityPermissionRole),
    'remove_members' : IDL.Opt(CommunityPermissionRole),
    'invite_users' : IDL.Opt(CommunityPermissionRole),
    'change_roles' : IDL.Opt(CommunityPermissionRole),
    'create_private_channel' : IDL.Opt(CommunityPermissionRole),
  });
  const UpdateCommunityArgs = IDL.Record({
    'permissions' : IDL.Opt(OptionalCommunityPermissions),
    'gate' : AccessGateUpdate,
    'name' : IDL.Opt(IDL.Text),
    'banner' : DocumentUpdate,
    'description' : IDL.Opt(IDL.Text),
    'rules' : IDL.Opt(AccessRules),
    'avatar' : DocumentUpdate,
  });
  const UpdateCommunityResponse = IDL.Variant({
    'NameReserved' : IDL.Null,
    'RulesTooLong' : FieldTooLongResult,
    'DescriptionTooLong' : FieldTooLongResult,
    'NameTooShort' : FieldTooShortResult,
    'NotAuthorized' : IDL.Null,
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'RulesTooShort' : FieldTooShortResult,
    'CommunityFrozen' : IDL.Null,
    'NameTooLong' : FieldTooLongResult,
    'NameTaken' : IDL.Null,
    'InternalError' : IDL.Null,
    'BannerTooBig' : FieldTooLongResult,
  });
  return IDL.Service({
    'add_members_to_channel' : IDL.Func(
        [AddMembersToChannelArgs],
        [AddMembersToChannelResponse],
        [],
      ),
    'add_reaction' : IDL.Func([AddReactionArgs], [AddReactionResponse], []),
    'block_user' : IDL.Func([BlockUserArgs], [BlockUserResponse], []),
    'change_channel_role' : IDL.Func(
        [ChangeChannelRoleArgs],
        [ChangeChannelRoleResponse],
        [],
      ),
    'change_role' : IDL.Func([ChangeRoleArgs], [ChangeRoleResponse], []),
    'channel_summary' : IDL.Func(
        [ChannelSummaryArgs],
        [ChannelSummaryResponse],
        ['query'],
      ),
    'channel_summary_updates' : IDL.Func(
        [ChannelSummaryUpdatesArgs],
        [ChannelSummaryUpdatesResponse],
        ['query'],
      ),
    'create_channel' : IDL.Func(
        [CreateChannelArgs],
        [CreateChannelResponse],
        [],
      ),
    'decline_invitation' : IDL.Func(
        [DeclineInvitationArgs],
        [DeclineInvitationResponse],
        [],
      ),
    'delete_channel' : IDL.Func(
        [DeleteChannelArgs],
        [DeleteChannelResponse],
        [],
      ),
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
        [EmptyArgs],
        [DisableInviteCodeResponse],
        [],
      ),
    'edit_message' : IDL.Func([EditMessageArgs], [EditMessageResponse], []),
    'enable_invite_code' : IDL.Func(
        [EmptyArgs],
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
    'invite_code' : IDL.Func([EmptyArgs], [InviteCodeResponse], ['query']),
    'join_channel' : IDL.Func([JoinChannelArgs], [JoinChannelResponse], []),
    'leave_channel' : IDL.Func([LeaveChannelArgs], [LeaveChannelResponse], []),
    'local_user_index' : IDL.Func(
        [EmptyArgs],
        [LocalUserIndexResponse],
        ['query'],
      ),
    'make_channel_private' : IDL.Func(
        [MakeChannelPrivateArgs],
        [MakeChannelPrivateResponse],
        [],
      ),
    'make_private' : IDL.Func([EmptyArgs], [MakePrivateResponse], []),
    'messages_by_message_index' : IDL.Func(
        [MessagesByMessageIndexArgs],
        [MessagesByMessageIndexResponse],
        ['query'],
      ),
    'pin_message' : IDL.Func([PinMessageArgs], [PinMessageResponse], []),
    'remove_member' : IDL.Func([RemoveMemberArgs], [RemoveMemberResponse], []),
    'remove_member_from_channel' : IDL.Func(
        [RemoveMemberFromChannelArgs],
        [RemoveMemberFromChannelResponse],
        [],
      ),
    'remove_reaction' : IDL.Func(
        [RemoveReactionArgs],
        [RemoveReactionResponse],
        [],
      ),
    'reset_invite_code' : IDL.Func([EmptyArgs], [EnableInviteCodeResponse], []),
    'rules' : IDL.Func([RulesArgs], [RulesResponse], ['query']),
    'search_channel' : IDL.Func(
        [SearchChannelArgs],
        [SearchChannelResponse],
        ['query'],
      ),
    'selected_channel_initial' : IDL.Func(
        [SelectedChannelInitialArgs],
        [SelectedChannelInitialResponse],
        ['query'],
      ),
    'selected_channel_updates' : IDL.Func(
        [SelectedChannelUpdatesArgs],
        [SelectedChannelUpdatesResponse],
        ['query'],
      ),
    'send_message' : IDL.Func([SendMessageArgs], [SendMessageResponse], []),
    'summary' : IDL.Func([EmptyArgs], [SummaryResponse], ['query']),
    'summary_updates' : IDL.Func(
        [SummaryUpdatesArgs],
        [SummaryUpdatesResponse],
        ['query'],
      ),
    'toggle_mute_channel_notifications' : IDL.Func(
        [ToggleMuteChannelNotificationsArgs],
        [ToggleMuteChannelNotificationsResponse],
        [],
      ),
    'toggle_mute_notifications' : IDL.Func(
        [ToggleMuteNotificationsArgs],
        [ToggleMuteNotificationsResponse],
        [],
      ),
    'unblock_user' : IDL.Func([UnblockUserArgs], [UnblockUserResponse], []),
    'undelete_messages' : IDL.Func(
        [UndeleteMessagesArgs],
        [UndeleteMessagesResponse],
        [],
      ),
    'update_channel' : IDL.Func(
        [UpdateChannelArgs],
        [UpdateChannelResponse],
        [],
      ),
    'update_community' : IDL.Func(
        [UpdateCommunityArgs],
        [UpdateCommunityResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
