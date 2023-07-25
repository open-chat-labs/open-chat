export const idlFactory = ({ IDL }) => {
  const ChannelId = IDL.Nat;
  const CanisterId = IDL.Principal;
  const CommunityId = CanisterId;
  const UserId = CanisterId;
  const InviteUsersToChannelArgs = IDL.Record({
    'channel_id' : ChannelId,
    'community_id' : CommunityId,
    'user_ids' : IDL.Vec(UserId),
  });
  const InviteUsersToChannelFailed = IDL.Record({
    'failed_users' : IDL.Vec(UserId),
  });
  const InviteUsersToChannelPartialSuccess = IDL.Record({
    'failed_users' : IDL.Vec(UserId),
  });
  const InviteUsersToChannelResponse = IDL.Variant({
    'Failed' : InviteUsersToChannelFailed,
    'UserNotInChannel' : IDL.Null,
    'PartialSuccess' : InviteUsersToChannelPartialSuccess,
    'ChannelNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
    'TooManyInvites' : IDL.Nat32,
  });
  const InviteUsersToCommunityArgs = IDL.Record({
    'community_id' : CommunityId,
    'user_ids' : IDL.Vec(UserId),
  });
  const InviteUsersToCommunityResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
    'TooManyInvites' : IDL.Nat32,
  });
  const ChatId = CanisterId;
  const InviteUsersToGroupArgs = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'group_id' : ChatId,
    'correlation_id' : IDL.Nat64,
  });
  const InviteUsersToGroupResponse = IDL.Variant({
    'GroupNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
    'TooManyInvites' : IDL.Nat32,
  });
  const JoinChannelArgs = IDL.Record({
    'channel_id' : ChannelId,
    'community_id' : CommunityId,
    'invite_code' : IDL.Opt(IDL.Nat64),
  });
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
    'kinic_messages' : IDL.Nat64,
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
  const GroupRole = IDL.Variant({
    'Participant' : IDL.Null,
    'Admin' : IDL.Null,
    'Moderator' : IDL.Null,
    'Owner' : IDL.Null,
  });
  const MessageIndex = IDL.Nat32;
  const GroupCanisterThreadDetails = IDL.Record({
    'root_message_index' : MessageIndex,
    'last_updated' : TimestampMillis,
    'latest_event' : EventIndex,
    'latest_message' : MessageIndex,
  });
  const MessageId = IDL.Nat;
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
    'KINIC' : IDL.Null,
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
  const NnsCompletedCryptoTransaction = IDL.Record({
    'to' : NnsCryptoAccount,
    'fee' : Tokens,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'transaction_hash' : TransactionHash,
    'block_index' : BlockIndex,
    'from' : NnsCryptoAccount,
    'memo' : IDL.Nat64,
    'ledger' : CanisterId,
    'amount' : Tokens,
  });
  const Icrc1Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const Icrc1AccountOrMint = IDL.Variant({
    'Mint' : IDL.Null,
    'Account' : Icrc1Account,
  });
  const SnsCompletedCryptoTransaction = IDL.Record({
    'to' : Icrc1AccountOrMint,
    'fee' : Tokens,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'transaction_hash' : TransactionHash,
    'block_index' : BlockIndex,
    'from' : Icrc1AccountOrMint,
    'memo' : IDL.Opt(IDL.Nat64),
    'ledger' : CanisterId,
    'amount' : Tokens,
  });
  const Memo = IDL.Vec(IDL.Nat8);
  const Icrc1CompletedCryptoTransaction = IDL.Record({
    'to' : Icrc1AccountOrMint,
    'fee' : IDL.Nat,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'block_index' : BlockIndex,
    'from' : Icrc1AccountOrMint,
    'memo' : IDL.Opt(Memo),
    'ledger' : CanisterId,
    'amount' : IDL.Nat,
  });
  const CompletedCryptoTransaction = IDL.Variant({
    'NNS' : NnsCompletedCryptoTransaction,
    'SNS' : SnsCompletedCryptoTransaction,
    'ICRC1' : Icrc1CompletedCryptoTransaction,
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
    'memo' : IDL.Nat64,
    'error_message' : IDL.Text,
    'ledger' : CanisterId,
    'amount' : Tokens,
  });
  const SnsFailedCryptoTransaction = IDL.Record({
    'to' : Icrc1AccountOrMint,
    'fee' : Tokens,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'transaction_hash' : TransactionHash,
    'from' : Icrc1AccountOrMint,
    'memo' : IDL.Opt(IDL.Nat64),
    'error_message' : IDL.Text,
    'ledger' : CanisterId,
    'amount' : Tokens,
  });
  const Icrc1FailedCryptoTransaction = IDL.Record({
    'to' : Icrc1AccountOrMint,
    'fee' : IDL.Nat,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'from' : Icrc1AccountOrMint,
    'memo' : IDL.Opt(Memo),
    'error_message' : IDL.Text,
    'ledger' : CanisterId,
    'amount' : IDL.Nat,
  });
  const FailedCryptoTransaction = IDL.Variant({
    'NNS' : NnsFailedCryptoTransaction,
    'SNS' : SnsFailedCryptoTransaction,
    'ICRC1' : Icrc1FailedCryptoTransaction,
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
    'memo' : IDL.Opt(IDL.Nat64),
    'ledger' : CanisterId,
    'amount' : Tokens,
    'symbol' : IDL.Text,
  });
  const SnsPendingCryptoTransaction = IDL.Record({
    'to' : Icrc1Account,
    'fee' : Tokens,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'memo' : IDL.Opt(IDL.Nat64),
    'ledger' : CanisterId,
    'amount' : Tokens,
    'symbol' : IDL.Text,
  });
  const Icrc1PendingCryptoTransaction = IDL.Record({
    'to' : Icrc1Account,
    'fee' : IDL.Nat,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'memo' : IDL.Opt(Memo),
    'ledger' : CanisterId,
    'amount' : IDL.Nat,
    'symbol' : IDL.Text,
  });
  const PendingCryptoTransaction = IDL.Variant({
    'NNS' : NnsPendingCryptoTransaction,
    'SNS' : SnsPendingCryptoTransaction,
    'ICRC1' : Icrc1PendingCryptoTransaction,
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
  const Chat = IDL.Variant({
    'Group' : ChatId,
    'Channel' : IDL.Tuple(CommunityId, ChannelId),
    'Direct' : ChatId,
  });
  const ReplyContext = IDL.Record({
    'chat_if_other' : IDL.Opt(IDL.Tuple(Chat, IDL.Opt(MessageIndex))),
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
    'is_default' : IDL.Bool,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'next_message_expiry' : IDL.Opt(TimestampMillis),
    'membership' : IDL.Opt(ChannelMembership),
    'latest_event_index' : EventIndex,
    'history_visible_to_new_joiners' : IDL.Bool,
    'min_visible_message_index' : MessageIndex,
    'member_count' : IDL.Nat32,
    'expired_messages' : IDL.Vec(MessageIndexRange),
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const CommunityPermissionRole = IDL.Variant({
    'Owners' : IDL.Null,
    'Admins' : IDL.Null,
    'Members' : IDL.Null,
  });
  const CommunityPermissions = IDL.Record({
    'create_public_channel' : CommunityPermissionRole,
    'block_users' : CommunityPermissionRole,
    'update_details' : CommunityPermissionRole,
    'remove_members' : CommunityPermissionRole,
    'invite_users' : CommunityPermissionRole,
    'change_roles' : CommunityPermissionRole,
    'create_private_channel' : CommunityPermissionRole,
  });
  const CommunityRole = IDL.Variant({
    'Member' : IDL.Null,
    'Admin' : IDL.Null,
    'Owner' : IDL.Null,
  });
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
    'metrics' : ChatMetrics,
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
    'primary_language' : IDL.Text,
  });
  const GateCheckFailedReason = IDL.Variant({
    'NotDiamondMember' : IDL.Null,
    'NoSnsNeuronsFound' : IDL.Null,
    'NoSnsNeuronsWithRequiredDissolveDelayFound' : IDL.Null,
    'NoSnsNeuronsWithRequiredStakeFound' : IDL.Null,
  });
  const JoinChannelResponse = IDL.Variant({
    'NotInvited' : IDL.Null,
    'AlreadyInChannel' : CommunityCanisterChannelSummary,
    'SuccessJoinedCommunity' : CommunityCanisterCommunitySummary,
    'CommunityNotFound' : IDL.Null,
    'GateCheckFailed' : GateCheckFailedReason,
    'MemberLimitReached' : IDL.Nat32,
    'ChannelNotFound' : IDL.Null,
    'Success' : CommunityCanisterChannelSummary,
    'CommunityNotPublic' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
    'UserBlocked' : IDL.Null,
  });
  const JoinCommunityArgs = IDL.Record({
    'community_id' : CommunityId,
    'invite_code' : IDL.Opt(IDL.Nat64),
  });
  const JoinCommunityResponse = IDL.Variant({
    'NotInvited' : IDL.Null,
    'CommunityNotFound' : IDL.Null,
    'GateCheckFailed' : GateCheckFailedReason,
    'MemberLimitReached' : IDL.Nat32,
    'Success' : CommunityCanisterCommunitySummary,
    'CommunityNotPublic' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'AlreadyInCommunity' : CommunityCanisterCommunitySummary,
    'InternalError' : IDL.Text,
    'UserBlocked' : IDL.Null,
  });
  const JoinGroupArgs = IDL.Record({
    'invite_code' : IDL.Opt(IDL.Nat64),
    'correlation_id' : IDL.Nat64,
    'chat_id' : ChatId,
  });
  const Version = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
  });
  const GroupCanisterGroupChatSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'permissions' : GroupPermissions,
    'metrics' : ChatMetrics,
    'subtype' : IDL.Opt(GroupSubtype),
    'date_last_pinned' : IDL.Opt(TimestampMillis),
    'min_visible_event_index' : EventIndex,
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'role' : GroupRole,
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
  const JoinGroupResponse = IDL.Variant({
    'NotInvited' : IDL.Null,
    'Blocked' : IDL.Null,
    'GroupNotFound' : IDL.Null,
    'GroupNotPublic' : IDL.Null,
    'AlreadyInGroup' : IDL.Null,
    'GateCheckFailed' : GateCheckFailedReason,
    'ChatFrozen' : IDL.Null,
    'Success' : GroupCanisterGroupChatSummary,
    'UserSuspended' : IDL.Null,
    'ParticipantLimitReached' : IDL.Nat32,
    'AlreadyInGroupV2' : GroupCanisterGroupChatSummary,
    'InternalError' : IDL.Text,
  });
  const RegisterUserArgs = IDL.Record({
    'username' : IDL.Text,
    'public_key' : IDL.Vec(IDL.Nat8),
    'referral_code' : IDL.Opt(IDL.Text),
  });
  const RegisterUserResponse = IDL.Variant({
    'UsernameTooShort' : IDL.Nat16,
    'UsernameInvalid' : IDL.Null,
    'AlreadyRegistered' : IDL.Null,
    'UserLimitReached' : IDL.Null,
    'UsernameTooLong' : IDL.Nat16,
    'Success' : IDL.Record({
      'icp_account' : AccountIdentifier,
      'user_id' : UserId,
    }),
    'PublicKeyInvalid' : IDL.Text,
    'ReferralCodeAlreadyClaimed' : IDL.Null,
    'ReferralCodeExpired' : IDL.Null,
    'InternalError' : IDL.Text,
    'ReferralCodeInvalid' : IDL.Null,
    'CyclesBalanceTooLow' : IDL.Null,
  });
  const ReportMessageArgs = IDL.Record({
    'notes' : IDL.Opt(IDL.Text),
    'chat_id' : ChatId,
    'reason_code' : IDL.Nat32,
    'event_index' : EventIndex,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const ReportMessageResponse = IDL.Variant({
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const MultiUserChat = IDL.Variant({
    'Group' : ChatId,
    'Channel' : IDL.Tuple(CommunityId, ChannelId),
  });
  const ReportMessageV2Args = IDL.Record({
    'notes' : IDL.Opt(IDL.Text),
    'chat_id' : MultiUserChat,
    'reason_code' : IDL.Nat32,
    'event_index' : EventIndex,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  return IDL.Service({
    'invite_users_to_channel' : IDL.Func(
        [InviteUsersToChannelArgs],
        [InviteUsersToChannelResponse],
        [],
      ),
    'invite_users_to_community' : IDL.Func(
        [InviteUsersToCommunityArgs],
        [InviteUsersToCommunityResponse],
        [],
      ),
    'invite_users_to_group' : IDL.Func(
        [InviteUsersToGroupArgs],
        [InviteUsersToGroupResponse],
        [],
      ),
    'join_channel' : IDL.Func([JoinChannelArgs], [JoinChannelResponse], []),
    'join_community' : IDL.Func(
        [JoinCommunityArgs],
        [JoinCommunityResponse],
        [],
      ),
    'join_group' : IDL.Func([JoinGroupArgs], [JoinGroupResponse], []),
    'register_user' : IDL.Func([RegisterUserArgs], [RegisterUserResponse], []),
    'report_message' : IDL.Func(
        [ReportMessageArgs],
        [ReportMessageResponse],
        [],
      ),
    'report_message_v2' : IDL.Func(
        [ReportMessageV2Args],
        [ReportMessageResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
