export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const CommunityId = CanisterId;
  const TimestampMillis = IDL.Nat64;
  const ChatId = CanisterId;
  const ActiveGroupsArgs = IDL.Record({
    'community_ids' : IDL.Vec(CommunityId),
    'active_since' : IDL.Opt(TimestampMillis),
    'group_ids' : IDL.Vec(ChatId),
  });
  const UserId = CanisterId;
  const DeletedCommunityInfo = IDL.Record({
    'id' : CommunityId,
    'name' : IDL.Text,
    'public' : IDL.Bool,
    'timestamp' : TimestampMillis,
    'deleted_by' : UserId,
  });
  const DeletedGroupInfo = IDL.Record({
    'id' : ChatId,
    'name' : IDL.Text,
    'public' : IDL.Bool,
    'timestamp' : TimestampMillis,
    'deleted_by' : UserId,
    'group_name' : IDL.Text,
  });
  const ActiveGroupsResponse = IDL.Variant({
    'Success' : IDL.Record({
      'deleted_communities' : IDL.Vec(DeletedCommunityInfo),
      'deleted_groups' : IDL.Vec(DeletedGroupInfo),
      'active_groups' : IDL.Vec(ChatId),
      'timestamp' : TimestampMillis,
      'active_communities' : IDL.Vec(CommunityId),
    }),
  });
  const AddHotGroupExclusionArgs = IDL.Record({ 'chat_id' : ChatId });
  const AddHotGroupExclusionResponse = IDL.Variant({
    'ChatAlreadyExcluded' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const DeleteFrozenGroupArgs = IDL.Record({ 'chat_id' : ChatId });
  const DeleteFrozenGroupResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'ChatNotFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const ExploreCommunitiesArgs = IDL.Record({
    'page_size' : IDL.Nat8,
    'page_index' : IDL.Nat32,
    'exclude_moderation_flags' : IDL.Opt(IDL.Nat32),
    'search_term' : IDL.Opt(IDL.Text),
  });
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
  const CommunityMatch = IDL.Record({
    'id' : CommunityId,
    'channel_count' : IDL.Nat32,
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'description' : IDL.Text,
    'moderation_flags' : IDL.Nat32,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'banner_id' : IDL.Opt(IDL.Nat),
    'member_count' : IDL.Nat32,
  });
  const ExploreCommunitiesSuccess = IDL.Record({
    'matches' : IDL.Vec(CommunityMatch),
  });
  const ExploreCommunitiesResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'InvalidFlags' : IDL.Null,
    'Success' : ExploreCommunitiesSuccess,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const ExploreGroupsArgs = IDL.Record({
    'page_size' : IDL.Nat8,
    'page_index' : IDL.Nat32,
    'search_term' : IDL.Opt(IDL.Text),
  });
  const GroupMatch = IDL.Record({
    'id' : ChatId,
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'description' : IDL.Text,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'chat_id' : ChatId,
    'member_count' : IDL.Nat32,
  });
  const ExploreGroupsSuccess = IDL.Record({ 'matches' : IDL.Vec(GroupMatch) });
  const ExploreGroupsResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'Success' : ExploreGroupsSuccess,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const FilterGroupsArgs = IDL.Record({
    'active_since' : IDL.Opt(TimestampMillis),
    'chat_ids' : IDL.Vec(ChatId),
  });
  const FilterGroupsResponse = IDL.Variant({
    'Success' : IDL.Record({
      'upgrades_in_progress' : IDL.Vec(ChatId),
      'deleted_groups' : IDL.Vec(DeletedGroupInfo),
      'active_groups' : IDL.Vec(ChatId),
      'timestamp' : TimestampMillis,
    }),
  });
  const FreezeCommunityArgs = IDL.Record({
    'community_id' : ChatId,
    'suspend_members' : IDL.Opt(
      IDL.Record({ 'duration' : IDL.Opt(Milliseconds), 'reason' : IDL.Text })
    ),
    'reason' : IDL.Opt(IDL.Text),
  });
  const GroupFrozen = IDL.Record({
    'frozen_by' : UserId,
    'reason' : IDL.Opt(IDL.Text),
  });
  const EventIndex = IDL.Nat32;
  const FreezeCommunityResponse = IDL.Variant({
    'CommunityNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'event' : GroupFrozen,
      'timestamp' : TimestampMillis,
      'index' : EventIndex,
      'correlation_id' : IDL.Nat64,
      'expires_at' : IDL.Opt(TimestampMillis),
    }),
    'CommunityAlreadyFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const FreezeGroupArgs = IDL.Record({
    'suspend_members' : IDL.Opt(
      IDL.Record({ 'duration' : IDL.Opt(Milliseconds), 'reason' : IDL.Text })
    ),
    'chat_id' : ChatId,
    'reason' : IDL.Opt(IDL.Text),
  });
  const FreezeGroupResponse = IDL.Variant({
    'ChatAlreadyFrozen' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'event' : GroupFrozen,
      'timestamp' : TimestampMillis,
      'index' : EventIndex,
      'correlation_id' : IDL.Nat64,
      'expires_at' : IDL.Opt(TimestampMillis),
    }),
    'InternalError' : IDL.Text,
  });
  const RecommendedGroupsArgs = IDL.Record({
    'count' : IDL.Nat8,
    'exclusions' : IDL.Vec(ChatId),
  });
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
  const MessageIndex = IDL.Nat32;
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
  });
  const SnsPendingCryptoTransaction = IDL.Record({
    'to' : Icrc1Account,
    'fee' : Tokens,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'memo' : IDL.Opt(IDL.Nat64),
    'ledger' : CanisterId,
    'amount' : Tokens,
  });
  const Icrc1PendingCryptoTransaction = IDL.Record({
    'to' : Icrc1Account,
    'fee' : IDL.Nat,
    'created' : TimestampNanos,
    'token' : Cryptocurrency,
    'memo' : IDL.Opt(Memo),
    'ledger' : CanisterId,
    'amount' : IDL.Nat,
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
  const MessageId = IDL.Nat;
  const ChannelId = IDL.Nat;
  const Chat = IDL.Variant({
    'Group' : ChatId,
    'Channel' : IDL.Tuple(CommunityId, ChannelId),
    'Direct' : ChatId,
  });
  const ReplyContext = IDL.Record({
    'chat_if_other' : IDL.Opt(IDL.Tuple(Chat, IDL.Opt(MessageIndex))),
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
  const MessageEventWrapper = IDL.Record({
    'event' : Message,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
    'correlation_id' : IDL.Nat64,
    'expires_at' : IDL.Opt(TimestampMillis),
  });
  const PublicGroupSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'subtype' : IDL.Opt(GroupSubtype),
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'wasm_version' : Version,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'frozen' : IDL.Opt(FrozenGroupInfo),
    'latest_event_index' : EventIndex,
    'history_visible_to_new_joiners' : IDL.Bool,
    'chat_id' : ChatId,
    'participant_count' : IDL.Nat32,
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const RecommendedGroupsResponse = IDL.Variant({
    'Success' : IDL.Record({ 'groups' : IDL.Vec(PublicGroupSummary) }),
  });
  const RemoveHotGroupExclusionArgs = IDL.Record({ 'chat_id' : ChatId });
  const RemoveHotGroupExclusionResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'ChatNotExcluded' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const SearchArgs = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const SearchSuccessResult = IDL.Record({ 'matches' : IDL.Vec(GroupMatch) });
  const SearchResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'Success' : SearchSuccessResult,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const SetCommunityModerationFlagsArgs = IDL.Record({
    'flags' : IDL.Nat32,
    'community_id' : CommunityId,
  });
  const SetCommunityModerationFlagsResponse = IDL.Variant({
    'CommunityNotFound' : IDL.Null,
    'Unchanged' : IDL.Null,
    'InvalidFlags' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const SetUpgradeConcurrencyArgs = IDL.Record({ 'value' : IDL.Nat32 });
  const SetUpgradeConcurrencyResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const UnfreezeCommunityArgs = IDL.Record({ 'community_id' : ChatId });
  const GroupUnfrozen = IDL.Record({ 'unfrozen_by' : UserId });
  const UnfreezeCommunityResponse = IDL.Variant({
    'CommunityNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'event' : GroupUnfrozen,
      'timestamp' : TimestampMillis,
      'index' : EventIndex,
      'correlation_id' : IDL.Nat64,
      'expires_at' : IDL.Opt(TimestampMillis),
    }),
    'CommunityNotFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const UnfreezeGroupArgs = IDL.Record({ 'chat_id' : ChatId });
  const UnfreezeGroupResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'event' : GroupUnfrozen,
      'timestamp' : TimestampMillis,
      'index' : EventIndex,
      'correlation_id' : IDL.Nat64,
      'expires_at' : IDL.Opt(TimestampMillis),
    }),
    'ChatNotFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  return IDL.Service({
    'active_groups' : IDL.Func(
        [ActiveGroupsArgs],
        [ActiveGroupsResponse],
        ['query'],
      ),
    'add_hot_group_exclusion' : IDL.Func(
        [AddHotGroupExclusionArgs],
        [AddHotGroupExclusionResponse],
        [],
      ),
    'delete_frozen_group' : IDL.Func(
        [DeleteFrozenGroupArgs],
        [DeleteFrozenGroupResponse],
        [],
      ),
    'explore_communities' : IDL.Func(
        [ExploreCommunitiesArgs],
        [ExploreCommunitiesResponse],
        ['query'],
      ),
    'explore_groups' : IDL.Func(
        [ExploreGroupsArgs],
        [ExploreGroupsResponse],
        ['query'],
      ),
    'filter_groups' : IDL.Func(
        [FilterGroupsArgs],
        [FilterGroupsResponse],
        ['query'],
      ),
    'freeze_community' : IDL.Func(
        [FreezeCommunityArgs],
        [FreezeCommunityResponse],
        [],
      ),
    'freeze_group' : IDL.Func([FreezeGroupArgs], [FreezeGroupResponse], []),
    'recommended_groups' : IDL.Func(
        [RecommendedGroupsArgs],
        [RecommendedGroupsResponse],
        ['query'],
      ),
    'remove_hot_group_exclusion' : IDL.Func(
        [RemoveHotGroupExclusionArgs],
        [RemoveHotGroupExclusionResponse],
        [],
      ),
    'search' : IDL.Func([SearchArgs], [SearchResponse], ['query']),
    'set_community_moderation_flags' : IDL.Func(
        [SetCommunityModerationFlagsArgs],
        [SetCommunityModerationFlagsResponse],
        [],
      ),
    'set_community_upgrade_concurrency' : IDL.Func(
        [SetUpgradeConcurrencyArgs],
        [SetUpgradeConcurrencyResponse],
        [],
      ),
    'set_group_upgrade_concurrency' : IDL.Func(
        [SetUpgradeConcurrencyArgs],
        [SetUpgradeConcurrencyResponse],
        [],
      ),
    'unfreeze_community' : IDL.Func(
        [UnfreezeCommunityArgs],
        [UnfreezeCommunityResponse],
        [],
      ),
    'unfreeze_group' : IDL.Func(
        [UnfreezeGroupArgs],
        [UnfreezeGroupResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
