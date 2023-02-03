export const idlFactory = ({ IDL }) => {
  const TimestampMillis = IDL.Nat64;
  const CanisterId = IDL.Principal;
  const ChatId = CanisterId;
  const FilterGroupsArgs = IDL.Record({
    'active_since' : IDL.Opt(TimestampMillis),
    'chat_ids' : IDL.Vec(ChatId),
  });
  const UserId = CanisterId;
  const DeletedGroupInfo = IDL.Record({
    'id' : ChatId,
    'public' : IDL.Bool,
    'timestamp' : TimestampMillis,
    'deleted_by' : UserId,
    'group_name' : IDL.Text,
  });
  const FilterGroupsResponse = IDL.Variant({
    'Success' : IDL.Record({
      'upgrades_in_progress' : IDL.Vec(ChatId),
      'deleted_groups' : IDL.Vec(DeletedGroupInfo),
      'active_groups' : IDL.Vec(ChatId),
      'timestamp' : TimestampMillis,
    }),
  });
  const FreezeGroupArgs = IDL.Record({
    'chat_id' : ChatId,
    'reason' : IDL.Opt(IDL.Text),
  });
  const ChatFrozen = IDL.Record({
    'frozen_by' : UserId,
    'reason' : IDL.Opt(IDL.Text),
  });
  const EventIndex = IDL.Nat32;
  const FreezeGroupResponse = IDL.Variant({
    'ChatAlreadyFrozen' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'event' : ChatFrozen,
      'timestamp' : TimestampMillis,
      'index' : EventIndex,
      'correlation_id' : IDL.Nat64,
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
  const MessageIndex = IDL.Nat32;
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  const PrizeWinnerContent = IDL.Record({
    'token' : Cryptocurrency,
    'winner' : UserId,
    'prize_message' : MessageIndex,
    'amount' : Tokens,
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
  const TimestampNanos = IDL.Nat64;
  const TransactionHash = IDL.Vec(IDL.Nat8);
  const Memo = IDL.Nat64;
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
  const Icrc1Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const SnsAccount = IDL.Variant({
    'Mint' : IDL.Null,
    'Account' : Icrc1Account,
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
  const BlockIndex = IDL.Nat64;
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
  const SnsPendingCryptoTransaction = IDL.Record({
    'to' : Icrc1Account,
    'fee' : Tokens,
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
  const MessageContent = IDL.Variant({
    'Giphy' : GiphyContent,
    'File' : FileContent,
    'Poll' : PollContent,
    'Text' : TextContent,
    'Image' : ImageContent,
    'Prize' : PrizeContent,
    'GovernanceProposal' : ProposalContent,
    'PrizeWinner' : PrizeWinnerContent,
    'Audio' : AudioContent,
    'Crypto' : CryptoContent,
    'Video' : VideoContent,
    'Deleted' : DeletedContent,
  });
  const ThreadSummary = IDL.Record({
    'latest_event_timestamp' : TimestampMillis,
    'participant_ids' : IDL.Vec(UserId),
    'reply_count' : IDL.Nat32,
    'latest_event_index' : EventIndex,
  });
  const MessageId = IDL.Nat;
  const ReplyContext = IDL.Record({
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
  const PublicGroupSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'subtype' : IDL.Opt(GroupSubtype),
    'name' : IDL.Text,
    'wasm_version' : Version,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'owner_id' : UserId,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'frozen' : IDL.Opt(FrozenGroupInfo),
    'latest_event_index' : EventIndex,
    'chat_id' : ChatId,
    'participant_count' : IDL.Nat32,
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const RecommendedGroupsResponse = IDL.Variant({
    'Success' : IDL.Record({ 'groups' : IDL.Vec(PublicGroupSummary) }),
  });
  const SearchArgs = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const GroupMatch = IDL.Record({
    'name' : IDL.Text,
    'description' : IDL.Text,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'chat_id' : ChatId,
  });
  const SearchSuccessResult = IDL.Record({ 'matches' : IDL.Vec(GroupMatch) });
  const SearchResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'Success' : SearchSuccessResult,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const UnfreezeGroupArgs = IDL.Record({ 'chat_id' : ChatId });
  const ChatUnfrozen = IDL.Record({ 'unfrozen_by' : UserId });
  const UnfreezeGroupResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'event' : ChatUnfrozen,
      'timestamp' : TimestampMillis,
      'index' : EventIndex,
      'correlation_id' : IDL.Nat64,
    }),
    'ChatNotFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  return IDL.Service({
    'filter_groups' : IDL.Func(
        [FilterGroupsArgs],
        [FilterGroupsResponse],
        ['query'],
      ),
    'freeze_group' : IDL.Func([FreezeGroupArgs], [FreezeGroupResponse], []),
    'recommended_groups' : IDL.Func(
        [RecommendedGroupsArgs],
        [RecommendedGroupsResponse],
        ['query'],
      ),
    'search' : IDL.Func([SearchArgs], [SearchResponse], ['query']),
    'unfreeze_group' : IDL.Func(
        [UnfreezeGroupArgs],
        [UnfreezeGroupResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
