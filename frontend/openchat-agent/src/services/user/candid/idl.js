export const idlFactory = ({ IDL }) => {
  const Milliseconds = IDL.Nat64;
  const CanisterId = IDL.Principal;
  const ChatId = CanisterId;
  const AddHotGroupExclusionsArgs = IDL.Record({
    'duration' : IDL.Opt(Milliseconds),
    'groups' : IDL.Vec(ChatId),
  });
  const AddHotGroupExclusionsResponse = IDL.Variant({ 'Success' : IDL.Null });
  const UserId = CanisterId;
  const MessageId = IDL.Nat;
  const MessageIndex = IDL.Nat32;
  const AddReactionArgs = IDL.Record({
    'username' : IDL.Text,
    'user_id' : UserId,
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
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'InvalidReaction' : IDL.Null,
    'SuccessV2' : PushEventResult,
  });
  const ArchiveChatArgs = IDL.Record({ 'chat_id' : ChatId });
  const ArchiveChatResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
  });
  const BioArgs = IDL.Record({});
  const BioResponse = IDL.Variant({ 'Success' : IDL.Text });
  const BlockUserArgs = IDL.Record({ 'user_id' : UserId });
  const BlockUserResponse = IDL.Variant({
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const CancelMessageReminderArgs = IDL.Record({ 'reminder_id' : IDL.Nat64 });
  const CancelMessageReminderResponse = IDL.Variant({ 'Success' : IDL.Null });
  const ContactsArgs = IDL.Record({});
  const Contact = IDL.Record({
    'nickname' : IDL.Opt(IDL.Text),
    'user_id' : UserId,
  });
  const ContactsResponse = IDL.Variant({
    'Success' : IDL.Record({ 'contacts' : IDL.Vec(Contact) }),
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
  const SnsNeuronGate = IDL.Record({
    'min_stake_e8s' : IDL.Opt(IDL.Nat64),
    'min_dissolve_delay' : IDL.Opt(Milliseconds),
    'governance_canister_id' : CanisterId,
  });
  const AccessGate = IDL.Variant({
    'SnsNeuron' : SnsNeuronGate,
    'DiamondMember' : IDL.Null,
  });
  const AccessRules = IDL.Record({ 'text' : IDL.Text, 'enabled' : IDL.Bool });
  const Avatar = IDL.Record({
    'id' : IDL.Nat,
    'data' : IDL.Vec(IDL.Nat8),
    'mime_type' : IDL.Text,
  });
  const CreateCommunityArgs = IDL.Record({
    'is_public' : IDL.Bool,
    'permissions' : IDL.Opt(CommunityPermissions),
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'description' : IDL.Text,
    'history_visible_to_new_joiners' : IDL.Bool,
    'default_channels' : IDL.Vec(IDL.Text),
    'rules' : AccessRules,
    'avatar' : IDL.Opt(Avatar),
  });
  const FieldTooLongResult = IDL.Record({
    'length_provided' : IDL.Nat32,
    'max_length' : IDL.Nat32,
  });
  const FieldTooShortResult = IDL.Record({
    'length_provided' : IDL.Nat32,
    'min_length' : IDL.Nat32,
  });
  const CommunityId = IDL.Principal;
  const CreateCommunitySuccessResult = IDL.Record({
    'community_id' : CommunityId,
  });
  const CreateCommunityResponse = IDL.Variant({
    'DefaultChannelsInvalid' : IDL.Null,
    'NameReserved' : IDL.Null,
    'RulesTooLong' : FieldTooLongResult,
    'DescriptionTooLong' : FieldTooLongResult,
    'NameTooShort' : FieldTooShortResult,
    'Throttled' : IDL.Null,
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : CreateCommunitySuccessResult,
    'Unauthorized' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'RulesTooShort' : FieldTooShortResult,
    'NameTooLong' : FieldTooLongResult,
    'NameTaken' : IDL.Null,
    'InternalError' : IDL.Null,
    'MaxCommunitiesCreated' : IDL.Nat32,
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
  const CreateGroupArgs = IDL.Record({
    'is_public' : IDL.Bool,
    'permissions' : IDL.Opt(GroupPermissions),
    'gate' : IDL.Opt(AccessGate),
    'name' : IDL.Text,
    'description' : IDL.Text,
    'history_visible_to_new_joiners' : IDL.Bool,
    'rules' : AccessRules,
    'avatar' : IDL.Opt(Avatar),
  });
  const CreateGroupSuccessResult = IDL.Record({ 'chat_id' : ChatId });
  const CreateGroupResponse = IDL.Variant({
    'NameReserved' : IDL.Null,
    'RulesTooLong' : FieldTooLongResult,
    'DescriptionTooLong' : FieldTooLongResult,
    'NameTooShort' : FieldTooShortResult,
    'Throttled' : IDL.Null,
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : CreateGroupSuccessResult,
    'UserSuspended' : IDL.Null,
    'RulesTooShort' : FieldTooShortResult,
    'NameTooLong' : FieldTooLongResult,
    'NameTaken' : IDL.Null,
    'MaxGroupsCreated' : IDL.Nat32,
    'InternalError' : IDL.Null,
    'UnauthorizedToCreatePublicGroup' : IDL.Null,
  });
  const DeleteCommunityArgs = IDL.Record({ 'community_id' : CommunityId });
  const DeleteCommunityResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const DeleteGroupArgs = IDL.Record({ 'chat_id' : ChatId });
  const DeleteGroupResponse = IDL.Variant({
    'ChatFrozen' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const DeleteMessagesArgs = IDL.Record({
    'user_id' : UserId,
    'message_ids' : IDL.Vec(MessageId),
    'correlation_id' : IDL.Nat64,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const DeleteMessagesResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const DeletedMessageArgs = IDL.Record({
    'user_id' : UserId,
    'message_id' : MessageId,
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
  const DeletedMessageResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({ 'content' : MessageContent }),
    'MessageHardDeleted' : IDL.Null,
    'MessageNotDeleted' : IDL.Null,
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
  const EditMessageV2Args = IDL.Record({
    'content' : MessageContentInitial,
    'user_id' : UserId,
    'correlation_id' : IDL.Nat64,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const EditMessageResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'UserBlocked' : IDL.Null,
  });
  const EventsArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'user_id' : UserId,
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
  const ThreadSummary = IDL.Record({
    'latest_event_timestamp' : TimestampMillis,
    'participant_ids' : IDL.Vec(UserId),
    'reply_count' : IDL.Nat32,
    'latest_event_index' : EventIndex,
  });
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
    'ReplicaNotUpToDate' : EventIndex,
    'ChatNotFound' : IDL.Null,
    'Success' : EventsSuccessResult,
  });
  const EventsByIndexArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'user_id' : UserId,
    'events' : IDL.Vec(EventIndex),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const EventsWindowArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'mid_point' : MessageIndex,
    'user_id' : UserId,
    'max_messages' : IDL.Nat32,
    'max_events' : IDL.Nat32,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const HotGroupExclusionsArgs = IDL.Record({});
  const HotGroupExclusionsResponse = IDL.Variant({
    'Success' : IDL.Vec(ChatId),
  });
  const InitUserPrincipalMigrationArgs = IDL.Record({
    'new_principal' : IDL.Principal,
  });
  const InitUserPrincipalMigrationResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  const InitialStateV2Args = IDL.Record({
    'disable_cache' : IDL.Opt(IDL.Bool),
  });
  const Version = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
  });
  const UserCanisterGroupChatSummary = IDL.Record({
    'read_by_me_up_to' : IDL.Opt(MessageIndex),
    'chat_id' : ChatId,
    'date_read_pinned' : IDL.Opt(TimestampMillis),
    'threads_read' : IDL.Vec(IDL.Tuple(MessageIndex, MessageIndex)),
    'archived' : IDL.Bool,
  });
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
  const MessageIndexRange = IDL.Record({
    'end' : MessageIndex,
    'start' : MessageIndex,
  });
  const MessageEventWrapper = IDL.Record({
    'event' : Message,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
    'correlation_id' : IDL.Nat64,
    'expires_at' : IDL.Opt(TimestampMillis),
  });
  const DirectChatSummary = IDL.Record({
    'read_by_them_up_to' : IDL.Opt(MessageIndex),
    'date_created' : TimestampMillis,
    'metrics' : ChatMetrics,
    'them' : UserId,
    'notifications_muted' : IDL.Bool,
    'events_ttl' : IDL.Opt(Milliseconds),
    'latest_event_index' : EventIndex,
    'read_by_me_up_to' : IDL.Opt(MessageIndex),
    'expired_messages' : IDL.Vec(MessageIndexRange),
    'archived' : IDL.Bool,
    'my_metrics' : ChatMetrics,
    'latest_message' : MessageEventWrapper,
  });
  const GovernanceProposalsSubtype = IDL.Record({
    'is_nns' : IDL.Bool,
    'governance_canister_id' : CanisterId,
  });
  const GroupSubtype = IDL.Variant({
    'GovernanceProposals' : GovernanceProposalsSubtype,
  });
  const ThreadSyncDetails = IDL.Record({
    'root_message_index' : MessageIndex,
    'last_updated' : TimestampMillis,
    'read_up_to' : IDL.Opt(MessageIndex),
    'latest_event' : IDL.Opt(EventIndex),
    'latest_message' : IDL.Opt(MessageIndex),
  });
  const FrozenGroupInfo = IDL.Record({
    'timestamp' : TimestampMillis,
    'frozen_by' : UserId,
    'reason' : IDL.Opt(IDL.Text),
  });
  const Mention = IDL.Record({
    'message_id' : MessageId,
    'event_index' : EventIndex,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'mentioned_by' : UserId,
    'message_index' : MessageIndex,
  });
  const GroupChatSummary = IDL.Record({
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
    'latest_threads' : IDL.Vec(ThreadSyncDetails),
    'frozen' : IDL.Opt(FrozenGroupInfo),
    'latest_event_index' : EventIndex,
    'history_visible_to_new_joiners' : IDL.Bool,
    'read_by_me_up_to' : IDL.Opt(MessageIndex),
    'min_visible_message_index' : MessageIndex,
    'mentions' : IDL.Vec(Mention),
    'chat_id' : ChatId,
    'date_read_pinned' : IDL.Opt(TimestampMillis),
    'expired_messages' : IDL.Vec(MessageIndexRange),
    'archived' : IDL.Bool,
    'participant_count' : IDL.Nat32,
    'my_metrics' : ChatMetrics,
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const InitialStateV2Response = IDL.Variant({
    'SuccessCached' : IDL.Record({
      'user_canister_wasm_version' : Version,
      'blocked_users' : IDL.Vec(UserId),
      'group_chats_added' : IDL.Vec(UserCanisterGroupChatSummary),
      'avatar_id' : IDL.Opt(IDL.Nat),
      'direct_chats' : IDL.Vec(DirectChatSummary),
      'timestamp' : TimestampMillis,
      'cached_group_chat_summaries' : IDL.Vec(GroupChatSummary),
      'cache_timestamp' : TimestampMillis,
      'pinned_chats' : IDL.Vec(ChatId),
    }),
    'Success' : IDL.Record({
      'user_canister_wasm_version' : Version,
      'blocked_users' : IDL.Vec(UserId),
      'group_chats' : IDL.Vec(UserCanisterGroupChatSummary),
      'avatar_id' : IDL.Opt(IDL.Nat),
      'direct_chats' : IDL.Vec(DirectChatSummary),
      'timestamp' : TimestampMillis,
      'pinned_chats' : IDL.Vec(ChatId),
    }),
  });
  const LeaveCommunityArgs = IDL.Record({ 'community_id' : CommunityId });
  const LeaveCommunityResponse = IDL.Variant({
    'CommunityNotFound' : IDL.Null,
    'LastOwnerCannotLeave' : IDL.Null,
    'Success' : IDL.Null,
    'UserNotInCommunity' : IDL.Null,
    'CommunityNotPublic' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const LeaveGroupArgs = IDL.Record({
    'correlation_id' : IDL.Nat64,
    'chat_id' : ChatId,
  });
  const LeaveGroupResponse = IDL.Variant({
    'GroupNotFound' : IDL.Null,
    'GroupNotPublic' : IDL.Null,
    'OwnerCannotLeave' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'ChatFrozen' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const ChannelId = IDL.Nat;
  const ThreadRead = IDL.Record({
    'root_message_index' : MessageIndex,
    'read_up_to' : MessageIndex,
  });
  const ChannelMessagesRead = IDL.Record({
    'channel_id' : ChannelId,
    'threads' : IDL.Vec(ThreadRead),
    'read_up_to' : IDL.Opt(MessageIndex),
    'date_read_pinned' : IDL.Opt(TimestampMillis),
  });
  const CommunityMessagesRead = IDL.Record({
    'community_id' : CommunityId,
    'channels_read' : IDL.Vec(ChannelMessagesRead),
  });
  const ChatMessagesRead = IDL.Record({
    'threads' : IDL.Vec(ThreadRead),
    'read_up_to' : IDL.Opt(MessageIndex),
    'chat_id' : ChatId,
    'date_read_pinned' : IDL.Opt(TimestampMillis),
  });
  const MarkReadArgs = IDL.Record({
    'community_messages_read' : IDL.Vec(CommunityMessagesRead),
    'messages_read' : IDL.Vec(ChatMessagesRead),
  });
  const MarkReadResponse = IDL.Variant({ 'Success' : IDL.Null });
  const MarkReadV2Args = IDL.Record({
    'messages_read' : IDL.Vec(ChatMessagesRead),
  });
  const MessagesByMessageIndexArgs = IDL.Record({
    'latest_client_event_index' : IDL.Opt(EventIndex),
    'messages' : IDL.Vec(MessageIndex),
    'user_id' : UserId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const MessagesByMessageIndexResponse = IDL.Variant({
    'ReplicaNotUpToDate' : EventIndex,
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Record({
      'messages' : IDL.Vec(MessageEventWrapper),
      'latest_event_index' : EventIndex,
    }),
  });
  const MigrateUserPrincipalArgs = IDL.Record({});
  const MigrateUserPrincipalResponse = IDL.Variant({
    'PrincipalAlreadyInUse' : IDL.Null,
    'MigrationAlreadyInProgress' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
    'MigrationNotInitialized' : IDL.Null,
  });
  const MuteNotificationsArgs = IDL.Record({ 'chat_id' : ChatId });
  const MuteNotificationsResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const PinChatRequest = IDL.Record({ 'chat_id' : ChatId });
  const PinChatResponse = IDL.Variant({
    'Success' : IDL.Null,
    'PinnedLimitReached' : IDL.Nat32,
  });
  const PublicProfileArgs = IDL.Record({});
  const PublicProfile = IDL.Record({
    'bio' : IDL.Text,
    'is_premium' : IDL.Bool,
    'created' : TimestampMillis,
    'username' : IDL.Text,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'phone_is_verified' : IDL.Bool,
  });
  const PublicProfileResponse = IDL.Variant({ 'Success' : PublicProfile });
  const RemoveReactionArgs = IDL.Record({
    'user_id' : UserId,
    'correlation_id' : IDL.Nat64,
    'message_id' : MessageId,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
    'reaction' : IDL.Text,
  });
  const RemoveReactionResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'NoChange' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'SuccessV2' : PushEventResult,
  });
  const SearchMessagesArgs = IDL.Record({
    'max_results' : IDL.Nat8,
    'user_id' : UserId,
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
    'ChatNotFound' : IDL.Null,
    'Success' : SearchMessagesSuccessResult,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const SendMessageV2Args = IDL.Record({
    'content' : MessageContentInitial,
    'recipient' : UserId,
    'forwarding' : IDL.Bool,
    'sender_name' : IDL.Text,
    'correlation_id' : IDL.Nat64,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(ReplyContext),
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
    'TransferSuccessV2' : IDL.Record({
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptoTransaction,
      'expires_at' : IDL.Opt(TimestampMillis),
      'message_index' : MessageIndex,
    }),
    'TransferCannotBeZero' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'expires_at' : IDL.Opt(TimestampMillis),
      'message_index' : MessageIndex,
    }),
    'MessageEmpty' : IDL.Null,
    'InvalidPoll' : InvalidPollReason,
    'RecipientBlocked' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'InvalidRequest' : IDL.Text,
    'TransferFailed' : IDL.Text,
    'InternalError' : IDL.Text,
    'RecipientNotFound' : IDL.Null,
  });
  const User = IDL.Record({ 'username' : IDL.Text, 'user_id' : UserId });
  const GroupReplyContext = IDL.Record({ 'event_index' : EventIndex });
  const SendMessageWithTransferToChannelArgs = IDL.Record({
    'channel_id' : ChannelId,
    'community_id' : CommunityId,
    'content' : MessageContentInitial,
    'mentioned' : IDL.Vec(User),
    'sender_name' : IDL.Text,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(GroupReplyContext),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const SendMessageWithTransferToChannelResponse = IDL.Variant({
    'TextTooLong' : IDL.Nat32,
    'UserNotInChannel' : CompletedCryptoTransaction,
    'ChannelNotFound' : CompletedCryptoTransaction,
    'TransferCannotBeZero' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptoTransaction,
      'expires_at' : IDL.Opt(TimestampMillis),
      'message_index' : MessageIndex,
    }),
    'UserNotInCommunity' : IDL.Opt(CompletedCryptoTransaction),
    'RecipientBlocked' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'CommunityFrozen' : IDL.Null,
    'InvalidRequest' : IDL.Text,
    'TransferFailed' : IDL.Text,
    'InternalError' : IDL.Tuple(IDL.Text, CompletedCryptoTransaction),
    'CryptocurrencyNotSupported' : Cryptocurrency,
  });
  const SendMessageWithTransferToGroupArgs = IDL.Record({
    'content' : MessageContentInitial,
    'mentioned' : IDL.Vec(User),
    'group_id' : ChatId,
    'sender_name' : IDL.Text,
    'correlation_id' : IDL.Nat64,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(GroupReplyContext),
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const SendMessageWithTransferToGroupResponse = IDL.Variant({
    'TextTooLong' : IDL.Nat32,
    'CallerNotInGroup' : IDL.Opt(CompletedCryptoTransaction),
    'ChatFrozen' : IDL.Null,
    'TransferCannotBeZero' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptoTransaction,
      'expires_at' : IDL.Opt(TimestampMillis),
      'message_index' : MessageIndex,
    }),
    'RecipientBlocked' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'InvalidRequest' : IDL.Text,
    'TransferFailed' : IDL.Text,
    'InternalError' : IDL.Tuple(IDL.Text, CompletedCryptoTransaction),
    'CryptocurrencyNotSupported' : Cryptocurrency,
  });
  const SetAvatarArgs = IDL.Record({ 'avatar' : IDL.Opt(Avatar) });
  const SetAvatarResponse = IDL.Variant({
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const SetBioArgs = IDL.Record({ 'text' : IDL.Text });
  const SetBioResponse = IDL.Variant({
    'TooLong' : FieldTooLongResult,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const TextUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : IDL.Text,
  });
  const OptionalContact = IDL.Record({
    'nickname' : TextUpdate,
    'user_id' : UserId,
  });
  const SetContactArgs = IDL.Record({ 'contact' : OptionalContact });
  const SetContactResponse = IDL.Variant({
    'NoChange' : IDL.Null,
    'NicknameTooLong' : FieldTooLongResult,
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
    'NicknameTooShort' : FieldTooShortResult,
  });
  const SetMessageReminderArgs = IDL.Record({
    'notes' : IDL.Opt(IDL.Text),
    'remind_at' : TimestampMillis,
    'chat_id' : ChatId,
    'event_index' : EventIndex,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const SetMessageReminderResponse = IDL.Variant({
    'NotesTooLong' : FieldTooLongResult,
    'Success' : IDL.Nat64,
    'ReminderDateInThePast' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const UnArchiveChatArgs = IDL.Record({ 'chat_id' : ChatId });
  const UnArchiveChatResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
  });
  const UnblockUserArgs = IDL.Record({ 'user_id' : UserId });
  const UnblockUserResponse = IDL.Variant({
    'Success' : IDL.Null,
    'UserSuspended' : IDL.Null,
  });
  const UndeleteMessagesArgs = IDL.Record({
    'user_id' : UserId,
    'message_ids' : IDL.Vec(MessageId),
    'correlation_id' : IDL.Nat64,
    'thread_root_message_index' : IDL.Opt(MessageIndex),
  });
  const UndeleteMessagesResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Record({ 'messages' : IDL.Vec(Message) }),
    'UserSuspended' : IDL.Null,
  });
  const UnmuteNotificationsArgs = IDL.Record({ 'chat_id' : ChatId });
  const UnmuteNotificationsResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const UnpinChatRequest = IDL.Record({ 'chat_id' : ChatId });
  const UnpinChatResponse = IDL.Variant({ 'Success' : IDL.Null });
  const UpdatesV2Args = IDL.Record({ 'updates_since' : TimestampMillis });
  const AvatarIdUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : IDL.Nat,
  });
  const UserCanisterGroupChatSummaryUpdates = IDL.Record({
    'read_by_me_up_to' : IDL.Opt(MessageIndex),
    'chat_id' : ChatId,
    'date_read_pinned' : IDL.Opt(TimestampMillis),
    'threads_read' : IDL.Vec(IDL.Tuple(MessageIndex, MessageIndex)),
    'archived' : IDL.Opt(IDL.Bool),
  });
  const EventsTimeToLiveUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : Milliseconds,
  });
  const DirectChatSummaryUpdates = IDL.Record({
    'read_by_them_up_to' : IDL.Opt(MessageIndex),
    'metrics' : IDL.Opt(ChatMetrics),
    'notifications_muted' : IDL.Opt(IDL.Bool),
    'events_ttl' : EventsTimeToLiveUpdate,
    'latest_event_index' : IDL.Opt(EventIndex),
    'updated_events' : IDL.Vec(IDL.Tuple(IDL.Nat32, IDL.Nat64)),
    'read_by_me_up_to' : IDL.Opt(MessageIndex),
    'chat_id' : ChatId,
    'newly_expired_messages' : IDL.Vec(MessageIndexRange),
    'archived' : IDL.Opt(IDL.Bool),
    'my_metrics' : IDL.Opt(ChatMetrics),
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const UpdatesV2Response = IDL.Variant({
    'Success' : IDL.Record({
      'user_canister_wasm_version' : IDL.Opt(Version),
      'direct_chats_added' : IDL.Vec(DirectChatSummary),
      'blocked_users_v2' : IDL.Opt(IDL.Vec(UserId)),
      'group_chats_added' : IDL.Vec(UserCanisterGroupChatSummary),
      'avatar_id' : AvatarIdUpdate,
      'chats_removed' : IDL.Vec(ChatId),
      'timestamp' : TimestampMillis,
      'group_chats_updated' : IDL.Vec(UserCanisterGroupChatSummaryUpdates),
      'direct_chats_updated' : IDL.Vec(DirectChatSummaryUpdates),
      'pinned_chats' : IDL.Opt(IDL.Vec(ChatId)),
    }),
    'SuccessNoUpdates' : IDL.Null,
  });
  const WithdrawCryptoArgs = IDL.Record({
    'withdrawal' : PendingCryptoTransaction,
  });
  const WithdrawCryptoResponse = IDL.Variant({
    'CurrencyNotSupported' : IDL.Null,
    'TransactionFailed' : FailedCryptoTransaction,
    'Success' : CompletedCryptoTransaction,
  });
  return IDL.Service({
    'add_hot_group_exclusions' : IDL.Func(
        [AddHotGroupExclusionsArgs],
        [AddHotGroupExclusionsResponse],
        [],
      ),
    'add_reaction' : IDL.Func([AddReactionArgs], [AddReactionResponse], []),
    'archive_chat' : IDL.Func([ArchiveChatArgs], [ArchiveChatResponse], []),
    'bio' : IDL.Func([BioArgs], [BioResponse], ['query']),
    'block_user' : IDL.Func([BlockUserArgs], [BlockUserResponse], []),
    'cancel_message_reminder' : IDL.Func(
        [CancelMessageReminderArgs],
        [CancelMessageReminderResponse],
        [],
      ),
    'contacts' : IDL.Func([ContactsArgs], [ContactsResponse], ['query']),
    'create_community' : IDL.Func(
        [CreateCommunityArgs],
        [CreateCommunityResponse],
        [],
      ),
    'create_group' : IDL.Func([CreateGroupArgs], [CreateGroupResponse], []),
    'delete_community' : IDL.Func(
        [DeleteCommunityArgs],
        [DeleteCommunityResponse],
        [],
      ),
    'delete_group' : IDL.Func([DeleteGroupArgs], [DeleteGroupResponse], []),
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
    'edit_message_v2' : IDL.Func(
        [EditMessageV2Args],
        [EditMessageResponse],
        [],
      ),
    'events' : IDL.Func([EventsArgs], [EventsResponse], ['query']),
    'events_by_index' : IDL.Func(
        [EventsByIndexArgs],
        [EventsResponse],
        ['query'],
      ),
    'events_window' : IDL.Func([EventsWindowArgs], [EventsResponse], ['query']),
    'hot_group_exclusions' : IDL.Func(
        [HotGroupExclusionsArgs],
        [HotGroupExclusionsResponse],
        ['query'],
      ),
    'init_user_principal_migration' : IDL.Func(
        [InitUserPrincipalMigrationArgs],
        [InitUserPrincipalMigrationResponse],
        [],
      ),
    'initial_state_v2' : IDL.Func(
        [InitialStateV2Args],
        [InitialStateV2Response],
        ['query'],
      ),
    'leave_community' : IDL.Func(
        [LeaveCommunityArgs],
        [LeaveCommunityResponse],
        [],
      ),
    'leave_group' : IDL.Func([LeaveGroupArgs], [LeaveGroupResponse], []),
    'mark_read' : IDL.Func([MarkReadArgs], [MarkReadResponse], []),
    'mark_read_v2' : IDL.Func([MarkReadV2Args], [MarkReadResponse], []),
    'messages_by_message_index' : IDL.Func(
        [MessagesByMessageIndexArgs],
        [MessagesByMessageIndexResponse],
        ['query'],
      ),
    'migrate_user_principal' : IDL.Func(
        [MigrateUserPrincipalArgs],
        [MigrateUserPrincipalResponse],
        [],
      ),
    'mute_notifications' : IDL.Func(
        [MuteNotificationsArgs],
        [MuteNotificationsResponse],
        [],
      ),
    'pin_chat' : IDL.Func([PinChatRequest], [PinChatResponse], []),
    'public_profile' : IDL.Func(
        [PublicProfileArgs],
        [PublicProfileResponse],
        ['query'],
      ),
    'remove_reaction' : IDL.Func(
        [RemoveReactionArgs],
        [RemoveReactionResponse],
        [],
      ),
    'search_messages' : IDL.Func(
        [SearchMessagesArgs],
        [SearchMessagesResponse],
        ['query'],
      ),
    'send_message_v2' : IDL.Func(
        [SendMessageV2Args],
        [SendMessageResponse],
        [],
      ),
    'send_message_with_transfer_to_channel' : IDL.Func(
        [SendMessageWithTransferToChannelArgs],
        [SendMessageWithTransferToChannelResponse],
        [],
      ),
    'send_message_with_transfer_to_group' : IDL.Func(
        [SendMessageWithTransferToGroupArgs],
        [SendMessageWithTransferToGroupResponse],
        [],
      ),
    'set_avatar' : IDL.Func([SetAvatarArgs], [SetAvatarResponse], []),
    'set_bio' : IDL.Func([SetBioArgs], [SetBioResponse], []),
    'set_contact' : IDL.Func([SetContactArgs], [SetContactResponse], []),
    'set_message_reminder' : IDL.Func(
        [SetMessageReminderArgs],
        [SetMessageReminderResponse],
        [],
      ),
    'unarchive_chat' : IDL.Func(
        [UnArchiveChatArgs],
        [UnArchiveChatResponse],
        [],
      ),
    'unblock_user' : IDL.Func([UnblockUserArgs], [UnblockUserResponse], []),
    'undelete_messages' : IDL.Func(
        [UndeleteMessagesArgs],
        [UndeleteMessagesResponse],
        [],
      ),
    'unmute_notifications' : IDL.Func(
        [UnmuteNotificationsArgs],
        [UnmuteNotificationsResponse],
        [],
      ),
    'unpin_chat' : IDL.Func([UnpinChatRequest], [UnpinChatResponse], []),
    'updates_v2' : IDL.Func([UpdatesV2Args], [UpdatesV2Response], ['query']),
    'withdraw_crypto_v2' : IDL.Func(
        [WithdrawCryptoArgs],
        [WithdrawCryptoResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
