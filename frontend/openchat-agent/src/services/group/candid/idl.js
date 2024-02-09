export const idlFactory = ({ IDL }) => {
  const MessageId = IDL.Nat;
  const MessageIndex = IDL.Nat32;
  const AcceptP2PSwapArgs = IDL.Record({
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const AcceptSwapSuccess = IDL.Record({ 'token1_txn_in' : IDL.Nat64 });
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const SwapStatusErrorReserved = IDL.Record({ 'reserved_by' : UserId });
  const SwapStatusErrorAccepted = IDL.Record({
    'accepted_by' : UserId,
    'token1_txn_in' : IDL.Nat64,
  });
  const SwapStatusErrorCancelled = IDL.Record({
    'token0_txn_out' : IDL.Opt(IDL.Nat64),
  });
  const SwapStatusErrorCompleted = IDL.Record({
    'accepted_by' : UserId,
    'token1_txn_out' : IDL.Nat64,
    'token0_txn_out' : IDL.Nat64,
    'token1_txn_in' : IDL.Nat64,
  });
  const SwapStatusErrorExpired = IDL.Record({
    'token0_txn_out' : IDL.Opt(IDL.Nat64),
  });
  const SwapStatusError = IDL.Variant({
    'Reserved' : SwapStatusErrorReserved,
    'Accepted' : SwapStatusErrorAccepted,
    'Cancelled' : SwapStatusErrorCancelled,
    'Completed' : SwapStatusErrorCompleted,
    'Expired' : SwapStatusErrorExpired,
  });
  const AcceptP2PSwapResponse = IDL.Variant({
    'UserNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'Success' : AcceptSwapSuccess,
    'UserSuspended' : IDL.Null,
    'StatusError' : SwapStatusError,
    'SwapNotFound' : IDL.Null,
    'InternalError' : IDL.Text,
    'InsufficientFunds' : IDL.Null,
  });
  const AddReactionArgs = IDL.Record({
    'username' : IDL.Text,
    'display_name' : IDL.Opt(IDL.Text),
    'correlation_id' : IDL.Nat64,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'reaction' : IDL.Text,
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
  const CancelP2PSwapArgs = IDL.Record({
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const CancelP2PSwapResponse = IDL.Variant({
    'UserNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'Success' : IDL.Null,
    'StatusError' : SwapStatusError,
    'SwapNotFound' : IDL.Null,
  });
  const GroupRole = IDL.Variant({
    'Participant' : IDL.Null,
    'Admin' : IDL.Null,
    'Moderator' : IDL.Null,
    'Owner' : IDL.Null,
  });
  const ChangeRoleArgs = IDL.Record({
    'user_id' : UserId,
    'new_role' : GroupRole,
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
    'KINIC' : IDL.Null,
    'CKBTC' : IDL.Null,
    'Other' : IDL.Text,
  });
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
    'ICRC1' : Icrc1CompletedCryptoTransaction,
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
    'ICRC1' : Icrc1FailedCryptoTransaction,
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
  const CommunityPermissionRole = IDL.Variant({
    'Owners' : IDL.Null,
    'Admins' : IDL.Null,
    'Members' : IDL.Null,
  });
  const CommunityPermissions = IDL.Record({
    'create_public_channel' : CommunityPermissionRole,
    'manage_user_groups' : CommunityPermissionRole,
    'update_details' : CommunityPermissionRole,
    'remove_members' : CommunityPermissionRole,
    'invite_users' : CommunityPermissionRole,
    'change_roles' : CommunityPermissionRole,
    'create_private_channel' : CommunityPermissionRole,
  });
  const Rules = IDL.Record({ 'text' : IDL.Text, 'enabled' : IDL.Bool });
  const ConvertIntoCommunityArgs = IDL.Record({
    'permissions' : IDL.Opt(CommunityPermissions),
    'history_visible_to_new_joiners' : IDL.Bool,
    'rules' : Rules,
    'primary_language' : IDL.Opt(IDL.Text),
  });
  const ChannelId = IDL.Nat;
  const CommunityId = CanisterId;
  const ConvertIntoCommunityResponse = IDL.Variant({
    'AlreadyImportingToAnotherCommunity' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'channel_id' : ChannelId,
      'community_id' : CommunityId,
    }),
    'UserSuspended' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const EmptyArgs = IDL.Record({});
  const DeclineInvitationResponse = IDL.Variant({
    'NotInvited' : IDL.Null,
    'Success' : IDL.Null,
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
  const TimestampMillis = IDL.Nat64;
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
    'allow_user_to_change_vote' : IDL.Bool,
    'options' : IDL.Vec(IDL.Text),
  });
  const PollContent = IDL.Record({
    'votes' : PollVotes,
    'ended' : IDL.Bool,
    'config' : PollConfig,
  });
  const TextContent = IDL.Record({ 'text' : IDL.Text });
  const P2PSwapReserved = IDL.Record({ 'reserved_by' : UserId });
  const P2PSwapAccepted = IDL.Record({
    'accepted_by' : UserId,
    'token1_txn_in' : IDL.Nat64,
  });
  const P2PSwapCancelled = IDL.Record({
    'token0_txn_out' : IDL.Opt(IDL.Nat64),
  });
  const P2PSwapCompleted = IDL.Record({
    'accepted_by' : UserId,
    'token1_txn_out' : IDL.Nat64,
    'token0_txn_out' : IDL.Nat64,
    'token1_txn_in' : IDL.Nat64,
  });
  const P2PSwapExpired = P2PSwapCancelled;
  const P2PSwapStatus = IDL.Variant({
    'Reserved' : P2PSwapReserved,
    'Open' : IDL.Null,
    'Accepted' : P2PSwapAccepted,
    'Cancelled' : P2PSwapCancelled,
    'Completed' : P2PSwapCompleted,
    'Expired' : P2PSwapExpired,
  });
  const TokenInfo = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'token' : Cryptocurrency,
    'ledger' : CanisterId,
  });
  const P2PSwapContent = IDL.Record({
    'status' : P2PSwapStatus,
    'token0_txn_in' : IDL.Nat64,
    'swap_id' : IDL.Nat32,
    'token0_amount' : IDL.Nat,
    'token0' : TokenInfo,
    'token1' : TokenInfo,
    'caption' : IDL.Opt(IDL.Text),
    'token1_amount' : IDL.Nat,
    'expires_at' : TimestampMillis,
  });
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
    'diamond_only' : IDL.Bool,
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
    'payload_text_rendering' : IDL.Opt(IDL.Text),
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
    'P2PSwap' : P2PSwapContent,
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
  });
  const DisableInviteCodeArgs = IDL.Record({ 'correlation_id' : IDL.Nat64 });
  const DisableInviteCodeResponse = IDL.Variant({
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const Milliseconds = IDL.Nat64;
  const P2PSwapContentInitial = IDL.Record({
    'token0_amount' : IDL.Nat,
    'token0' : TokenInfo,
    'token1' : TokenInfo,
    'caption' : IDL.Opt(IDL.Text),
    'token1_amount' : IDL.Nat,
    'expires_in' : Milliseconds,
  });
  const PrizeContentInitial = IDL.Record({
    'end_date' : TimestampMillis,
    'caption' : IDL.Opt(IDL.Text),
    'prizes' : IDL.Vec(Tokens),
    'transfer' : CryptoTransaction,
    'diamond_only' : IDL.Bool,
  });
  const MessageContentInitial = IDL.Variant({
    'Giphy' : GiphyContent,
    'File' : FileContent,
    'Poll' : PollContent,
    'Text' : TextContent,
    'P2PSwap' : P2PSwapContentInitial,
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
  const EditMessageV2Args = IDL.Record({
    'content' : MessageContentInitial,
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
  const EventIndex = IDL.Nat32;
  const EventsArgs = IDL.Record({
    'max_messages' : IDL.Nat32,
    'max_events' : IDL.Nat32,
    'ascending' : IDL.Bool,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'latest_known_update' : IDL.Opt(TimestampMillis),
    'start_index' : EventIndex,
  });
  const ParticipantJoined = IDL.Record({
    'user_id' : UserId,
    'invited_by' : IDL.Opt(UserId),
  });
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
  const GroupVisibilityChanged = IDL.Record({
    'changed_by' : UserId,
    'now_public' : IDL.Bool,
  });
  const ThreadSummary = IDL.Record({
    'latest_event_timestamp' : TimestampMillis,
    'participant_ids' : IDL.Vec(UserId),
    'reply_count' : IDL.Nat32,
    'latest_event_index' : EventIndex,
    'followed_by_me' : IDL.Bool,
  });
  const ChatId = CanisterId;
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
    'tips' : IDL.Vec(
      IDL.Tuple(CanisterId, IDL.Vec(IDL.Tuple(UserId, IDL.Nat)))
    ),
    'last_updated' : IDL.Opt(TimestampMillis),
    'sender' : UserId,
    'thread_summary' : IDL.Opt(ThreadSummary),
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(ReplyContext),
    'reactions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(UserId))),
    'message_index' : MessageIndex,
  });
  const PermissionRole = IDL.Variant({
    'None' : IDL.Null,
    'Moderators' : IDL.Null,
    'Owner' : IDL.Null,
    'Admins' : IDL.Null,
    'Members' : IDL.Null,
  });
  const CustomPermission = IDL.Record({
    'subtype' : IDL.Text,
    'role' : PermissionRole,
  });
  const MessagePermissions = IDL.Record({
    'audio' : IDL.Opt(PermissionRole),
    'video' : IDL.Opt(PermissionRole),
    'custom' : IDL.Vec(CustomPermission),
    'file' : IDL.Opt(PermissionRole),
    'poll' : IDL.Opt(PermissionRole),
    'text' : IDL.Opt(PermissionRole),
    'crypto' : IDL.Opt(PermissionRole),
    'giphy' : IDL.Opt(PermissionRole),
    'default' : PermissionRole,
    'image' : IDL.Opt(PermissionRole),
    'prize' : IDL.Opt(PermissionRole),
    'p2p_swap' : IDL.Opt(PermissionRole),
  });
  const GroupPermissions = IDL.Record({
    'mention_all_members' : PermissionRole,
    'delete_messages' : PermissionRole,
    'remove_members' : PermissionRole,
    'update_group' : PermissionRole,
    'message_permissions' : MessagePermissions,
    'invite_users' : PermissionRole,
    'thread_permissions' : IDL.Opt(MessagePermissions),
    'change_roles' : PermissionRole,
    'add_members' : PermissionRole,
    'pin_messages' : PermissionRole,
    'react_to_messages' : PermissionRole,
  });
  const PermissionsChanged = IDL.Record({
    'changed_by' : UserId,
    'old_permissions_v2' : GroupPermissions,
    'new_permissions_v2' : GroupPermissions,
  });
  const MembersAddedToDefaultChannel = IDL.Record({ 'count' : IDL.Nat32 });
  const GroupFrozen = IDL.Record({
    'frozen_by' : UserId,
    'reason' : IDL.Opt(IDL.Text),
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
  const UsersUnblocked = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'unblocked_by' : UserId,
  });
  const GroupUnfrozen = IDL.Record({ 'unfrozen_by' : UserId });
  const ParticipantLeft = IDL.Record({ 'user_id' : UserId });
  const GroupRulesChanged = IDL.Record({
    'changed_by' : UserId,
    'enabled' : IDL.Bool,
    'prev_enabled' : IDL.Bool,
  });
  const GroupNameChanged = IDL.Record({
    'changed_by' : UserId,
    'new_name' : IDL.Text,
    'previous_name' : IDL.Text,
  });
  const VerifiedCredentialGate = IDL.Record({
    'credential_arguments' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'issuer_origin' : IDL.Text,
    'credential_type' : IDL.Text,
  });
  const SnsNeuronGate = IDL.Record({
    'min_stake_e8s' : IDL.Opt(IDL.Nat64),
    'min_dissolve_delay' : IDL.Opt(Milliseconds),
    'governance_canister_id' : CanisterId,
  });
  const TokenBalanceGate = IDL.Record({
    'min_balance' : IDL.Nat,
    'ledger_canister_id' : CanisterId,
  });
  const PaymentGate = IDL.Record({
    'fee' : IDL.Nat,
    'ledger_canister_id' : CanisterId,
    'amount' : IDL.Nat,
  });
  const AccessGate = IDL.Variant({
    'VerifiedCredential' : VerifiedCredentialGate,
    'SnsNeuron' : SnsNeuronGate,
    'TokenBalance' : TokenBalanceGate,
    'DiamondMember' : IDL.Null,
    'Payment' : PaymentGate,
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
    'ParticipantJoined' : ParticipantJoined,
    'GroupDescriptionChanged' : GroupDescriptionChanged,
    'GroupChatCreated' : GroupChatCreated,
    'MessagePinned' : MessagePinned,
    'UsersInvited' : UsersInvited,
    'UsersBlocked' : UsersBlocked,
    'MessageUnpinned' : MessageUnpinned,
    'ParticipantsRemoved' : ParticipantsRemoved,
    'GroupVisibilityChanged' : GroupVisibilityChanged,
    'Message' : Message,
    'PermissionsChanged' : PermissionsChanged,
    'MembersAddedToDefaultChannel' : MembersAddedToDefaultChannel,
    'ChatFrozen' : GroupFrozen,
    'GroupInviteCodeChanged' : GroupInviteCodeChanged,
    'UsersUnblocked' : UsersUnblocked,
    'ChatUnfrozen' : GroupUnfrozen,
    'ParticipantLeft' : ParticipantLeft,
    'GroupRulesChanged' : GroupRulesChanged,
    'GroupNameChanged' : GroupNameChanged,
    'GroupGateUpdated' : GroupGateUpdated,
    'RoleChanged' : RoleChanged,
    'EventsTimeToLiveUpdated' : EventsTimeToLiveUpdated,
    'DirectChatCreated' : DirectChatCreated,
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
    'expired_message_ranges' : IDL.Vec(IDL.Tuple(MessageIndex, MessageIndex)),
    'chat_last_updated' : TimestampMillis,
    'events' : IDL.Vec(ChatEventWrapper),
    'latest_event_index' : IDL.Nat32,
    'expired_event_ranges' : IDL.Vec(IDL.Tuple(EventIndex, EventIndex)),
  });
  const EventsResponse = IDL.Variant({
    'ThreadMessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'Success' : EventsSuccessResult,
    'ReplicaNotUpToDateV2' : TimestampMillis,
  });
  const EventsByIndexArgs = IDL.Record({
    'events' : IDL.Vec(EventIndex),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'latest_known_update' : IDL.Opt(TimestampMillis),
  });
  const EventsWindowArgs = IDL.Record({
    'mid_point' : MessageIndex,
    'max_messages' : IDL.Nat32,
    'max_events' : IDL.Nat32,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'latest_known_update' : IDL.Opt(TimestampMillis),
  });
  const FollowThreadArgs = IDL.Record({
    'thread_root_message_index' : MessageIndex,
  });
  const FollowThreadResponse = IDL.Variant({
    'ThreadNotFound' : IDL.Null,
    'GroupFrozen' : IDL.Null,
    'AlreadyFollowing' : IDL.Null,
    'UserNotInGroup' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const InviteCodeArgs = IDL.Record({});
  const InviteCodeResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'code' : IDL.Opt(IDL.Nat64) }),
  });
  const LocalUserIndexArgs = IDL.Record({});
  const LocalUserIndexResponse = IDL.Variant({ 'Success' : CanisterId });
  const MessagesByMessageIndexArgs = IDL.Record({
    'messages' : IDL.Vec(MessageIndex),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'latest_known_update' : IDL.Opt(TimestampMillis),
  });
  const MessageEventWrapper = IDL.Record({
    'event' : Message,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
    'correlation_id' : IDL.Nat64,
    'expires_at' : IDL.Opt(TimestampMillis),
  });
  const MessagesSuccessResult = IDL.Record({
    'messages' : IDL.Vec(MessageEventWrapper),
    'chat_last_updated' : TimestampMillis,
    'latest_event_index' : EventIndex,
  });
  const MessagesByMessageIndexResponse = IDL.Variant({
    'ThreadMessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'Success' : MessagesSuccessResult,
    'ReplicaNotUpToDateV2' : TimestampMillis,
  });
  const PinMessageArgs = IDL.Record({
    'correlation_id' : IDL.Nat64,
    'message_index' : MessageIndex,
  });
  const PushEventResult = IDL.Record({
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
    'expires_at' : IDL.Opt(TimestampMillis),
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
  const BuildVersion = IDL.Record({
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
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'wasm_version' : BuildVersion,
    'latest_message_index' : IDL.Opt(MessageIndex),
    'description' : IDL.Text,
    'events_ttl' : IDL.Opt(Milliseconds),
    'last_updated' : TimestampMillis,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'local_user_index_canister_id' : CanisterId,
    'frozen' : IDL.Opt(FrozenGroupInfo),
    'latest_event_index' : EventIndex,
    'history_visible_to_new_joiners' : IDL.Bool,
    'chat_id' : ChatId,
    'events_ttl_last_updated' : TimestampMillis,
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
    'UserCannotChangeVote' : IDL.Null,
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
  });
  const ReportMessageArgs = IDL.Record({
    'delete' : IDL.Bool,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const ReportMessageResponse = IDL.Variant({
    'AlreadyReported' : IDL.Null,
    'MessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'InternalError' : IDL.Text,
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
    'role' : GroupRole,
    'user_id' : UserId,
    'date_added' : TimestampMillis,
  });
  const Version = IDL.Nat32;
  const VersionedRules = IDL.Record({
    'text' : IDL.Text,
    'version' : Version,
    'enabled' : IDL.Bool,
  });
  const SelectedInitialSuccess = IDL.Record({
    'participants' : IDL.Vec(Participant),
    'invited_users' : IDL.Vec(UserId),
    'blocked_users' : IDL.Vec(UserId),
    'last_updated' : TimestampMillis,
    'chat_rules' : VersionedRules,
    'timestamp' : TimestampMillis,
    'pinned_messages' : IDL.Vec(MessageIndex),
    'latest_event_index' : EventIndex,
  });
  const SelectedInitialResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : SelectedInitialSuccess,
  });
  const SelectedUpdatesV2Args = IDL.Record({
    'updates_since' : TimestampMillis,
  });
  const SelectedGroupUpdates = IDL.Record({
    'blocked_users_removed' : IDL.Vec(UserId),
    'pinned_messages_removed' : IDL.Vec(MessageIndex),
    'invited_users' : IDL.Opt(IDL.Vec(UserId)),
    'last_updated' : TimestampMillis,
    'members_added_or_updated' : IDL.Vec(Participant),
    'pinned_messages_added' : IDL.Vec(MessageIndex),
    'chat_rules' : IDL.Opt(VersionedRules),
    'members_removed' : IDL.Vec(UserId),
    'timestamp' : TimestampMillis,
    'latest_event_index' : EventIndex,
    'blocked_users_added' : IDL.Vec(UserId),
  });
  const SelectedUpdatesV2Response = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : SelectedGroupUpdates,
    'SuccessNoUpdates' : TimestampMillis,
  });
  const User = IDL.Record({ 'username' : IDL.Text, 'user_id' : UserId });
  const GroupReplyContext = IDL.Record({ 'event_index' : EventIndex });
  const SendMessageV2Args = IDL.Record({
    'content' : MessageContentInitial,
    'message_filter_failed' : IDL.Opt(IDL.Nat64),
    'mentioned' : IDL.Vec(User),
    'sender_display_name' : IDL.Opt(IDL.Text),
    'forwarding' : IDL.Bool,
    'rules_accepted' : IDL.Opt(Version),
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
    'RulesNotAccepted' : IDL.Null,
  });
  const SummaryArgs = IDL.Record({});
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
  const GroupMembership = IDL.Record({
    'role' : GroupRole,
    'notifications_muted' : IDL.Bool,
    'joined' : TimestampMillis,
    'rules_accepted' : IDL.Bool,
    'latest_threads' : IDL.Vec(GroupCanisterThreadDetails),
    'mentions' : IDL.Vec(Mention),
    'my_metrics' : ChatMetrics,
  });
  const GroupCanisterGroupChatSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'metrics' : ChatMetrics,
    'subtype' : IDL.Opt(GroupSubtype),
    'permissions_v2' : GroupPermissions,
    'date_last_pinned' : IDL.Opt(TimestampMillis),
    'min_visible_event_index' : EventIndex,
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'role' : GroupRole,
    'wasm_version' : BuildVersion,
    'notifications_muted' : IDL.Bool,
    'latest_message_index' : IDL.Opt(MessageIndex),
    'description' : IDL.Text,
    'events_ttl' : IDL.Opt(Milliseconds),
    'last_updated' : TimestampMillis,
    'joined' : TimestampMillis,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'rules_accepted' : IDL.Bool,
    'membership' : IDL.Opt(GroupMembership),
    'local_user_index_canister_id' : CanisterId,
    'latest_threads' : IDL.Vec(GroupCanisterThreadDetails),
    'frozen' : IDL.Opt(FrozenGroupInfo),
    'latest_event_index' : EventIndex,
    'history_visible_to_new_joiners' : IDL.Bool,
    'min_visible_message_index' : MessageIndex,
    'mentions' : IDL.Vec(Mention),
    'chat_id' : ChatId,
    'events_ttl_last_updated' : TimestampMillis,
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
  const GroupMembershipUpdates = IDL.Record({
    'role' : IDL.Opt(GroupRole),
    'notifications_muted' : IDL.Opt(IDL.Bool),
    'unfollowed_threads' : IDL.Vec(MessageIndex),
    'rules_accepted' : IDL.Opt(IDL.Bool),
    'latest_threads' : IDL.Vec(GroupCanisterThreadDetails),
    'mentions' : IDL.Vec(Mention),
    'my_metrics' : IDL.Opt(ChatMetrics),
  });
  const FrozenGroupUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : FrozenGroupInfo,
  });
  const GroupCanisterGroupChatSummaryUpdates = IDL.Record({
    'is_public' : IDL.Opt(IDL.Bool),
    'metrics' : IDL.Opt(ChatMetrics),
    'subtype' : GroupSubtypeUpdate,
    'permissions_v2' : IDL.Opt(GroupPermissions),
    'date_last_pinned' : IDL.Opt(TimestampMillis),
    'gate' : AccessGateUpdate,
    'name' : IDL.Opt(IDL.Text),
    'role' : IDL.Opt(GroupRole),
    'wasm_version' : IDL.Opt(BuildVersion),
    'notifications_muted' : IDL.Opt(IDL.Bool),
    'latest_message_index' : IDL.Opt(MessageIndex),
    'description' : IDL.Opt(IDL.Text),
    'events_ttl' : EventsTimeToLiveUpdate,
    'last_updated' : TimestampMillis,
    'unfollowed_threads' : IDL.Vec(MessageIndex),
    'avatar_id' : DocumentIdUpdate,
    'rules_accepted' : IDL.Opt(IDL.Bool),
    'membership' : IDL.Opt(GroupMembershipUpdates),
    'latest_threads' : IDL.Vec(GroupCanisterThreadDetails),
    'frozen' : FrozenGroupUpdate,
    'latest_event_index' : IDL.Opt(EventIndex),
    'updated_events' : IDL.Vec(
      IDL.Tuple(IDL.Opt(IDL.Nat32), IDL.Nat32, IDL.Nat64)
    ),
    'mentions' : IDL.Vec(Mention),
    'chat_id' : ChatId,
    'events_ttl_last_updated' : IDL.Opt(TimestampMillis),
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
  const ToggleMuteNotificationsArgs = IDL.Record({ 'mute' : IDL.Bool });
  const ToggleMuteNotificationsResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Null,
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
  const UnfollowThreadArgs = IDL.Record({
    'thread_root_message_index' : MessageIndex,
  });
  const UnfollowThreadResponse = IDL.Variant({
    'ThreadNotFound' : IDL.Null,
    'GroupFrozen' : IDL.Null,
    'UserNotInGroup' : IDL.Null,
    'NotFollowing' : IDL.Null,
    'Success' : IDL.Null,
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
    'UserSuspended' : IDL.Null,
    'SuccessV2' : PushEventResult,
  });
  const PermissionRoleUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : PermissionRole,
  });
  const OptionalMessagePermissions = IDL.Record({
    'custom_updated' : IDL.Vec(CustomPermission),
    'audio' : PermissionRoleUpdate,
    'video' : PermissionRoleUpdate,
    'file' : PermissionRoleUpdate,
    'poll' : PermissionRoleUpdate,
    'text' : PermissionRoleUpdate,
    'crypto' : PermissionRoleUpdate,
    'giphy' : PermissionRoleUpdate,
    'custom_deleted' : IDL.Vec(IDL.Text),
    'default' : IDL.Opt(PermissionRole),
    'p2p_trade' : PermissionRoleUpdate,
    'image' : PermissionRoleUpdate,
    'prize' : PermissionRoleUpdate,
    'p2p_swap' : PermissionRoleUpdate,
  });
  const OptionalMessagePermissionsUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : OptionalMessagePermissions,
  });
  const OptionalGroupPermissions = IDL.Record({
    'mention_all_members' : IDL.Opt(PermissionRole),
    'delete_messages' : IDL.Opt(PermissionRole),
    'remove_members' : IDL.Opt(PermissionRole),
    'update_group' : IDL.Opt(PermissionRole),
    'message_permissions' : IDL.Opt(OptionalMessagePermissions),
    'invite_users' : IDL.Opt(PermissionRole),
    'thread_permissions' : OptionalMessagePermissionsUpdate,
    'change_roles' : IDL.Opt(PermissionRole),
    'pin_messages' : IDL.Opt(PermissionRole),
    'react_to_messages' : IDL.Opt(PermissionRole),
  });
  const UpdatedRules = IDL.Record({
    'new_version' : IDL.Bool,
    'text' : IDL.Text,
    'enabled' : IDL.Bool,
  });
  const Document = IDL.Record({
    'id' : IDL.Nat,
    'data' : IDL.Vec(IDL.Nat8),
    'mime_type' : IDL.Text,
  });
  const DocumentUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : Document,
  });
  const UpdateGroupV2Args = IDL.Record({
    'permissions_v2' : IDL.Opt(OptionalGroupPermissions),
    'gate' : AccessGateUpdate,
    'name' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'events_ttl' : EventsTimeToLiveUpdate,
    'public' : IDL.Opt(IDL.Bool),
    'correlation_id' : IDL.Nat64,
    'rules' : IDL.Opt(UpdatedRules),
    'avatar' : DocumentUpdate,
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
    'UserSuspended' : IDL.Null,
    'RulesTooShort' : FieldTooShortResult,
    'NameTooLong' : FieldTooLongResult,
    'SuccessV2' : IDL.Record({ 'rules_version' : IDL.Opt(Version) }),
    'NameTaken' : IDL.Null,
    'InternalError' : IDL.Null,
  });
  return IDL.Service({
    'accept_p2p_swap' : IDL.Func(
        [AcceptP2PSwapArgs],
        [AcceptP2PSwapResponse],
        [],
      ),
    'add_reaction' : IDL.Func([AddReactionArgs], [AddReactionResponse], []),
    'block_user' : IDL.Func([BlockUserArgs], [BlockUserResponse], []),
    'cancel_p2p_swap' : IDL.Func(
        [CancelP2PSwapArgs],
        [CancelP2PSwapResponse],
        [],
      ),
    'change_role' : IDL.Func([ChangeRoleArgs], [ChangeRoleResponse], []),
    'claim_prize' : IDL.Func([ClaimPrizeArgs], [ClaimPrizeResponse], []),
    'convert_into_community' : IDL.Func(
        [ConvertIntoCommunityArgs],
        [ConvertIntoCommunityResponse],
        [],
      ),
    'decline_invitation' : IDL.Func(
        [EmptyArgs],
        [DeclineInvitationResponse],
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
        [DisableInviteCodeArgs],
        [DisableInviteCodeResponse],
        [],
      ),
    'edit_message_v2' : IDL.Func(
        [EditMessageV2Args],
        [EditMessageResponse],
        [],
      ),
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
    'follow_thread' : IDL.Func([FollowThreadArgs], [FollowThreadResponse], []),
    'invite_code' : IDL.Func([InviteCodeArgs], [InviteCodeResponse], ['query']),
    'local_user_index' : IDL.Func(
        [LocalUserIndexArgs],
        [LocalUserIndexResponse],
        ['query'],
      ),
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
    'report_message' : IDL.Func(
        [ReportMessageArgs],
        [ReportMessageResponse],
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
    'selected_updates_v2' : IDL.Func(
        [SelectedUpdatesV2Args],
        [SelectedUpdatesV2Response],
        ['query'],
      ),
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
    'unfollow_thread' : IDL.Func(
        [UnfollowThreadArgs],
        [UnfollowThreadResponse],
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
