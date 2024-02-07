export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const ChatId = CanisterId;
  const MessageIndex = IDL.Nat32;
  const CommunityId = CanisterId;
  const ChannelId = IDL.Nat;
  const UserId = CanisterId;
  const EventsContext = IDL.Variant({
    'Group' : IDL.Tuple(ChatId, IDL.Opt(MessageIndex)),
    'Channel' : IDL.Tuple(CommunityId, ChannelId, IDL.Opt(MessageIndex)),
    'Direct' : UserId,
  });
  const EventIndex = IDL.Nat32;
  const TimestampMillis = IDL.Nat64;
  const ChatEventsArgsInner = IDL.Record({
    'context' : EventsContext,
    'args' : IDL.Variant({
      'Page' : IDL.Record({
        'max_messages' : IDL.Nat32,
        'max_events' : IDL.Nat32,
        'ascending' : IDL.Bool,
        'start_index' : EventIndex,
      }),
      'ByIndex' : IDL.Record({ 'events' : IDL.Vec(EventIndex) }),
      'Window' : IDL.Record({
        'mid_point' : MessageIndex,
        'max_messages' : IDL.Nat32,
        'max_events' : IDL.Nat32,
      }),
    }),
    'latest_known_update' : IDL.Opt(TimestampMillis),
  });
  const ChatEventsArgs = IDL.Record({
    'requests' : IDL.Vec(ChatEventsArgsInner),
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
  const Cryptocurrency = IDL.Variant({
    'InternetComputer' : IDL.Null,
    'CHAT' : IDL.Null,
    'SNS1' : IDL.Null,
    'KINIC' : IDL.Null,
    'CKBTC' : IDL.Null,
    'Other' : IDL.Text,
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
  const ThreadSummary = IDL.Record({
    'latest_event_timestamp' : TimestampMillis,
    'participant_ids' : IDL.Vec(UserId),
    'reply_count' : IDL.Nat32,
    'latest_event_index' : EventIndex,
    'followed_by_me' : IDL.Bool,
  });
  const MessageId = IDL.Nat;
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
  const Milliseconds = IDL.Nat64;
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
  const GroupRole = IDL.Variant({
    'Participant' : IDL.Null,
    'Admin' : IDL.Null,
    'Moderator' : IDL.Null,
    'Owner' : IDL.Null,
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
  const ChatEventsResponseInner = IDL.Variant({
    'ReplicaNotUpToDate' : TimestampMillis,
    'NotFound' : IDL.Null,
    'Success' : EventsSuccessResult,
    'InternalError' : IDL.Text,
  });
  const ChatEventsResponse = IDL.Variant({
    'Success' : IDL.Record({
      'responses' : IDL.Vec(ChatEventsResponseInner),
      'timestamp' : TimestampMillis,
    }),
  });
  const SummaryUpdatesArgs = IDL.Record({
    'updates_since' : IDL.Opt(TimestampMillis),
    'canister_id' : CanisterId,
    'invite_code' : IDL.Opt(IDL.Nat64),
    'is_community' : IDL.Bool,
  });
  const GroupAndCommunitySummaryUpdatesArgs = IDL.Record({
    'requests' : IDL.Vec(SummaryUpdatesArgs),
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
  const MessageEventWrapper = IDL.Record({
    'event' : Message,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
    'correlation_id' : IDL.Nat64,
    'expires_at' : IDL.Opt(TimestampMillis),
  });
  const CommunityCanisterChannelSummary = IDL.Record({
    'latest_message_sender_display_name' : IDL.Opt(IDL.Text),
    'channel_id' : ChannelId,
    'is_public' : IDL.Bool,
    'metrics' : ChatMetrics,
    'subtype' : IDL.Opt(GroupSubtype),
    'permissions_v2' : GroupPermissions,
    'date_last_pinned' : IDL.Opt(TimestampMillis),
    'min_visible_event_index' : EventIndex,
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'latest_message_index' : IDL.Opt(MessageIndex),
    'description' : IDL.Text,
    'events_ttl' : IDL.Opt(Milliseconds),
    'last_updated' : TimestampMillis,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'membership' : IDL.Opt(GroupMembership),
    'latest_event_index' : EventIndex,
    'history_visible_to_new_joiners' : IDL.Bool,
    'min_visible_message_index' : MessageIndex,
    'member_count' : IDL.Nat32,
    'events_ttl_last_updated' : TimestampMillis,
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const UserGroup = IDL.Record({
    'members' : IDL.Nat32,
    'name' : IDL.Text,
    'user_group_id' : IDL.Nat32,
  });
  const CommunityRole = IDL.Variant({
    'Member' : IDL.Null,
    'Admin' : IDL.Null,
    'Owner' : IDL.Null,
  });
  const CommunityMembership = IDL.Record({
    'role' : CommunityRole,
    'display_name' : IDL.Opt(IDL.Text),
    'joined' : TimestampMillis,
    'rules_accepted' : IDL.Bool,
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
    'user_groups' : IDL.Vec(UserGroup),
    'avatar_id' : IDL.Opt(IDL.Nat),
    'membership' : IDL.Opt(CommunityMembership),
    'local_user_index_canister_id' : CanisterId,
    'frozen' : IDL.Opt(FrozenGroupInfo),
    'latest_event_index' : EventIndex,
    'banner_id' : IDL.Opt(IDL.Nat),
    'member_count' : IDL.Nat32,
    'primary_language' : IDL.Text,
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
  const BuildVersion = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
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
  const CommunityCanisterChannelSummaryUpdates = IDL.Record({
    'latest_message_sender_display_name' : IDL.Opt(IDL.Text),
    'channel_id' : ChannelId,
    'is_public' : IDL.Opt(IDL.Bool),
    'metrics' : IDL.Opt(ChatMetrics),
    'subtype' : GroupSubtypeUpdate,
    'permissions_v2' : IDL.Opt(GroupPermissions),
    'date_last_pinned' : IDL.Opt(TimestampMillis),
    'gate' : AccessGateUpdate,
    'name' : IDL.Opt(IDL.Text),
    'latest_message_index' : IDL.Opt(MessageIndex),
    'description' : IDL.Opt(IDL.Text),
    'events_ttl' : EventsTimeToLiveUpdate,
    'last_updated' : TimestampMillis,
    'avatar_id' : DocumentIdUpdate,
    'membership' : IDL.Opt(GroupMembershipUpdates),
    'latest_event_index' : IDL.Opt(EventIndex),
    'updated_events' : IDL.Vec(
      IDL.Tuple(IDL.Opt(IDL.Nat32), IDL.Nat32, IDL.Nat64)
    ),
    'member_count' : IDL.Opt(IDL.Nat32),
    'events_ttl_last_updated' : IDL.Opt(TimestampMillis),
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const TextUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : IDL.Text,
  });
  const CommunityMembershipUpdates = IDL.Record({
    'role' : IDL.Opt(CommunityRole),
    'display_name' : TextUpdate,
    'rules_accepted' : IDL.Opt(IDL.Bool),
  });
  const CommunityCanisterCommunitySummaryUpdates = IDL.Record({
    'is_public' : IDL.Opt(IDL.Bool),
    'permissions' : IDL.Opt(CommunityPermissions),
    'community_id' : CommunityId,
    'channels_updated' : IDL.Vec(CommunityCanisterChannelSummaryUpdates),
    'metrics' : IDL.Opt(ChatMetrics),
    'user_groups_deleted' : IDL.Vec(IDL.Nat32),
    'gate' : AccessGateUpdate,
    'name' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'last_updated' : TimestampMillis,
    'channels_removed' : IDL.Vec(ChannelId),
    'user_groups' : IDL.Vec(UserGroup),
    'avatar_id' : DocumentIdUpdate,
    'channels_added' : IDL.Vec(CommunityCanisterChannelSummary),
    'membership' : IDL.Opt(CommunityMembershipUpdates),
    'frozen' : FrozenGroupUpdate,
    'latest_event_index' : IDL.Opt(EventIndex),
    'banner_id' : DocumentIdUpdate,
    'member_count' : IDL.Opt(IDL.Nat32),
    'primary_language' : IDL.Opt(IDL.Text),
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
  const SummaryUpdatesResponse = IDL.Variant({
    'SuccessCommunity' : CommunityCanisterCommunitySummary,
    'SuccessGroupUpdates' : GroupCanisterGroupChatSummaryUpdates,
    'SuccessCommunityUpdates' : CommunityCanisterCommunitySummaryUpdates,
    'NotFound' : IDL.Null,
    'SuccessGroup' : GroupCanisterGroupChatSummary,
    'SuccessNoUpdates' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const GroupAndCommunitySummaryUpdatesResponse = IDL.Variant({
    'Success' : IDL.Vec(SummaryUpdatesResponse),
  });
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
  const ICRC2_TransferFromError = IDL.Variant({
    'GenericError' : IDL.Record({
      'message' : IDL.Text,
      'error_code' : IDL.Nat,
    }),
    'TemporarilyUnavailable' : IDL.Null,
    'InsufficientAllowance' : IDL.Record({ 'allowance' : IDL.Nat }),
    'BadBurn' : IDL.Record({ 'min_burn_amount' : IDL.Nat }),
    'Duplicate' : IDL.Record({ 'duplicate_of' : IDL.Nat }),
    'BadFee' : IDL.Record({ 'expected_fee' : IDL.Nat }),
    'CreatedInFuture' : IDL.Record({ 'ledger_time' : IDL.Nat64 }),
    'TooOld' : IDL.Null,
    'InsufficientFunds' : IDL.Record({ 'balance' : IDL.Nat }),
  });
  const GateCheckFailedReason = IDL.Variant({
    'NotDiamondMember' : IDL.Null,
    'PaymentFailed' : ICRC2_TransferFromError,
    'InsufficientBalance' : IDL.Nat,
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
  const ReportMessageResponse = IDL.Variant({
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  return IDL.Service({
    'chat_events' : IDL.Func([ChatEventsArgs], [ChatEventsResponse], ['query']),
    'group_and_community_summary_updates' : IDL.Func(
        [GroupAndCommunitySummaryUpdatesArgs],
        [GroupAndCommunitySummaryUpdatesResponse],
        ['query'],
      ),
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
    'report_message_v2' : IDL.Func(
        [ReportMessageV2Args],
        [ReportMessageResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
