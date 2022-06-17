export const idlFactory = ({ IDL }) => {
  const Milliseconds = IDL.Nat64;
  const CanisterId = IDL.Principal;
  const ChatId = CanisterId;
  const AddRecommendedGroupExclusionsArgs = IDL.Record({
    'duration' : IDL.Opt(Milliseconds),
    'groups' : IDL.Vec(ChatId),
  });
  const AddRecommendedGroupExclusionsResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  const AssumeGroupSuperAdminArgs = IDL.Record({ 'chat_id' : ChatId });
  const AssumeGroupSuperAdminResponse = IDL.Variant({
    'AlreadyOwner' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Null,
    'NotSuperAdmin' : IDL.Null,
    'InternalError' : IDL.Text,
    'AlreadySuperAdmin' : IDL.Null,
  });
  const BioArgs = IDL.Record({});
  const BioResponse = IDL.Variant({ 'Success' : IDL.Text });
  const UserId = CanisterId;
  const BlockUserArgs = IDL.Record({ 'user_id' : UserId });
  const BlockUserResponse = IDL.Variant({ 'Success' : IDL.Null });
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
    'react_to_messages' : PermissionRole,
  });
  const Avatar = IDL.Record({
    'id' : IDL.Nat,
    'data' : IDL.Vec(IDL.Nat8),
    'mime_type' : IDL.Text,
  });
  const CreateGroupArgs = IDL.Record({
    'is_public' : IDL.Bool,
    'permissions' : IDL.Opt(GroupPermissions),
    'name' : IDL.Text,
    'description' : IDL.Text,
    'history_visible_to_new_joiners' : IDL.Bool,
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
  const CreateGroupSuccessResult = IDL.Record({ 'chat_id' : ChatId });
  const CreateGroupResponse = IDL.Variant({
    'DescriptionTooLong' : FieldTooLongResult,
    'NameTooShort' : FieldTooShortResult,
    'Throttled' : IDL.Null,
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : CreateGroupSuccessResult,
    'NameTooLong' : FieldTooLongResult,
    'NameTaken' : IDL.Null,
    'MaxGroupsCreated' : IDL.Nat32,
    'InternalError' : IDL.Null,
  });
  const DeleteGroupArgs = IDL.Record({ 'chat_id' : ChatId });
  const DeleteGroupResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const MessageId = IDL.Nat;
  const DeleteMessagesArgs = IDL.Record({
    'user_id' : UserId,
    'message_ids' : IDL.Vec(MessageId),
  });
  const DeleteMessagesResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
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
  const NeuronId = IDL.Nat64;
  const ProposalContent = IDL.Record({
    'url' : IDL.Text,
    'title' : IDL.Text,
    'my_vote' : IDL.Opt(IDL.Bool),
    'reject_votes' : IDL.Nat32,
    'deadline' : TimestampMillis,
    'adopt_votes' : IDL.Nat32,
    'summary' : IDL.Text,
    'proposal_id' : ProposalId,
    'governance_canister_id' : CanisterId,
    'proposer' : NeuronId,
  });
  const AccountIdentifier = IDL.Vec(IDL.Nat8);
  const CryptoAccountFull = IDL.Variant({
    'UserIndex' : AccountIdentifier,
    'Named' : IDL.Tuple(IDL.Text, AccountIdentifier),
    'Mint' : IDL.Null,
    'User' : IDL.Tuple(UserId, AccountIdentifier),
    'Unknown' : AccountIdentifier,
  });
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  const Cryptocurrency = IDL.Variant({ 'InternetComputer' : IDL.Null });
  const TransactionHash = IDL.Vec(IDL.Nat8);
  const Memo = IDL.Nat64;
  const FailedCryptoTransaction = IDL.Record({
    'to' : CryptoAccountFull,
    'fee' : Tokens,
    'created' : TimestampMillis,
    'token' : Cryptocurrency,
    'transaction_hash' : TransactionHash,
    'from' : CryptoAccountFull,
    'memo' : Memo,
    'error_message' : IDL.Text,
    'amount' : Tokens,
  });
  const BlockIndex = IDL.Nat64;
  const CompletedCryptoTransaction = IDL.Record({
    'to' : CryptoAccountFull,
    'fee' : Tokens,
    'created' : TimestampMillis,
    'token' : Cryptocurrency,
    'transaction_hash' : TransactionHash,
    'block_index' : BlockIndex,
    'from' : CryptoAccountFull,
    'memo' : Memo,
    'amount' : Tokens,
  });
  const CryptoAccount = IDL.Variant({
    'Mint' : IDL.Null,
    'User' : UserId,
    'Account' : AccountIdentifier,
  });
  const PendingCryptoTransaction = IDL.Record({
    'to' : CryptoAccount,
    'fee' : IDL.Opt(Tokens),
    'token' : Cryptocurrency,
    'memo' : IDL.Opt(Memo),
    'amount' : Tokens,
  });
  const CryptoTransaction = IDL.Variant({
    'Failed' : FailedCryptoTransaction,
    'Completed' : CompletedCryptoTransaction,
    'Pending' : PendingCryptoTransaction,
  });
  const CryptocurrencyContent = IDL.Record({
    'caption' : IDL.Opt(IDL.Text),
    'transfer' : CryptoTransaction,
  });
  const AudioContent = IDL.Record({
    'mime_type' : IDL.Text,
    'blob_reference' : IDL.Opt(BlobReference),
    'caption' : IDL.Opt(IDL.Text),
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
    'Cryptocurrency' : CryptocurrencyContent,
    'Audio' : AudioContent,
    'Video' : VideoContent,
    'Deleted' : DeletedContent,
  });
  const EditMessageArgs = IDL.Record({
    'content' : MessageContent,
    'user_id' : UserId,
    'message_id' : MessageId,
  });
  const EditMessageResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
    'UserBlocked' : IDL.Null,
  });
  const EventIndex = IDL.Nat32;
  const EventsArgs = IDL.Record({
    'user_id' : UserId,
    'max_events' : IDL.Nat32,
    'ascending' : IDL.Bool,
    'start_index' : EventIndex,
  });
  const UpdatedMessage = IDL.Record({
    'updated_by' : UserId,
    'message_id' : MessageId,
    'event_index' : EventIndex,
  });
  const ReplyContext = IDL.Record({
    'chat_id_if_other' : IDL.Opt(ChatId),
    'event_index' : EventIndex,
  });
  const MessageIndex = IDL.Nat32;
  const Message = IDL.Record({
    'forwarded' : IDL.Bool,
    'content' : MessageContent,
    'edited' : IDL.Bool,
    'sender' : UserId,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(ReplyContext),
    'reactions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(UserId))),
    'message_index' : MessageIndex,
  });
  const PollEnded = IDL.Record({
    'event_index' : EventIndex,
    'message_index' : MessageIndex,
  });
  const DirectChatCreated = IDL.Record({});
  const DirectChatEvent = IDL.Variant({
    'MessageReactionRemoved' : UpdatedMessage,
    'MessageReactionAdded' : UpdatedMessage,
    'Message' : Message,
    'PollEnded' : PollEnded,
    'PollVoteRegistered' : UpdatedMessage,
    'MessageDeleted' : UpdatedMessage,
    'PollVoteDeleted' : UpdatedMessage,
    'DirectChatCreated' : DirectChatCreated,
    'MessageEdited' : UpdatedMessage,
  });
  const DirectChatEventWrapper = IDL.Record({
    'event' : DirectChatEvent,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
  });
  const EventsSuccessResult = IDL.Record({
    'affected_events' : IDL.Vec(DirectChatEventWrapper),
    'events' : IDL.Vec(DirectChatEventWrapper),
  });
  const EventsResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : EventsSuccessResult,
  });
  const EventsByIndexArgs = IDL.Record({
    'user_id' : UserId,
    'events' : IDL.Vec(EventIndex),
  });
  const EventsRangeArgs = IDL.Record({
    'user_id' : UserId,
    'to_index' : EventIndex,
    'from_index' : EventIndex,
  });
  const EventsWindowArgs = IDL.Record({
    'mid_point' : MessageIndex,
    'user_id' : UserId,
    'max_events' : IDL.Nat32,
  });
  const InitialStateArgs = IDL.Record({});
  const Cycles = IDL.Nat;
  const Version = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
  });
  const ChatMetrics = IDL.Record({
    'audio_messages' : IDL.Nat64,
    'cycles_messages' : IDL.Nat64,
    'edits' : IDL.Nat64,
    'icp_messages' : IDL.Nat64,
    'last_active' : TimestampMillis,
    'giphy_messages' : IDL.Nat64,
    'deleted_messages' : IDL.Nat64,
    'file_messages' : IDL.Nat64,
    'poll_votes' : IDL.Nat64,
    'text_messages' : IDL.Nat64,
    'image_messages' : IDL.Nat64,
    'replies' : IDL.Nat64,
    'video_messages' : IDL.Nat64,
    'polls' : IDL.Nat64,
    'proposals' : IDL.Nat64,
    'reactions' : IDL.Nat64,
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
  const MessageIndexRange = IDL.Record({
    'to' : MessageIndex,
    'from' : MessageIndex,
  });
  const Mention = IDL.Record({
    'message_id' : MessageId,
    'event_index' : EventIndex,
    'mentioned_by' : UserId,
    'message_index' : MessageIndex,
  });
  const MessageEventWrapper = IDL.Record({
    'event' : Message,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
  });
  const GroupChatSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'permissions' : GroupPermissions,
    'metrics' : ChatMetrics,
    'min_visible_event_index' : EventIndex,
    'name' : IDL.Text,
    'role' : Role,
    'wasm_version' : Version,
    'notifications_muted' : IDL.Bool,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'read_by_me' : IDL.Vec(MessageIndexRange),
    'pinned_message' : IDL.Opt(MessageIndex),
    'owner_id' : UserId,
    'joined' : TimestampMillis,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'latest_event_index' : EventIndex,
    'history_visible_to_new_joiners' : IDL.Bool,
    'min_visible_message_index' : MessageIndex,
    'mentions' : IDL.Vec(Mention),
    'chat_id' : ChatId,
    'participant_count' : IDL.Nat32,
    'my_metrics' : ChatMetrics,
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const DirectChatSummary = IDL.Record({
    'date_created' : TimestampMillis,
    'metrics' : ChatMetrics,
    'them' : UserId,
    'notifications_muted' : IDL.Bool,
    'read_by_me' : IDL.Vec(MessageIndexRange),
    'latest_event_index' : EventIndex,
    'read_by_them' : IDL.Vec(MessageIndexRange),
    'my_metrics' : ChatMetrics,
    'latest_message' : MessageEventWrapper,
  });
  const ChatSummary = IDL.Variant({
    'Group' : GroupChatSummary,
    'Direct' : DirectChatSummary,
  });
  const InitialStateResponse = IDL.Variant({
    'Success' : IDL.Record({
      'cycles_balance' : Cycles,
      'user_canister_wasm_version' : Version,
      'upgrades_in_progress' : IDL.Vec(ChatId),
      'chats' : IDL.Vec(ChatSummary),
      'blocked_users' : IDL.Vec(UserId),
      'timestamp' : TimestampMillis,
    }),
    'InternalError' : IDL.Text,
  });
  const JoinGroupArgs = IDL.Record({
    'invite_code' : IDL.Opt(IDL.Nat64),
    'as_super_admin' : IDL.Bool,
    'chat_id' : ChatId,
  });
  const JoinGroupResponse = IDL.Variant({
    'Blocked' : IDL.Null,
    'GroupNotFound' : IDL.Null,
    'GroupNotPublic' : IDL.Null,
    'AlreadyInGroup' : IDL.Null,
    'Success' : GroupChatSummary,
    'NotSuperAdmin' : IDL.Null,
    'ParticipantLimitReached' : IDL.Nat32,
    'InternalError' : IDL.Text,
  });
  const LeaveGroupArgs = IDL.Record({ 'chat_id' : ChatId });
  const LeaveGroupResponse = IDL.Variant({
    'GroupNotFound' : IDL.Null,
    'GroupNotPublic' : IDL.Null,
    'OwnerCannotLeave' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const ChatMessagesRead = IDL.Record({
    'message_ranges' : IDL.Vec(MessageIndexRange),
    'chat_id' : ChatId,
  });
  const MarkReadArgs = IDL.Record({
    'messages_read' : IDL.Vec(ChatMessagesRead),
  });
  const MarkReadResponse = IDL.Variant({ 'Success' : IDL.Null });
  const MessagesByMessageIndexArgs = IDL.Record({
    'messages' : IDL.Vec(MessageIndex),
    'user_id' : UserId,
  });
  const MessagesByMessageIndexResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Record({
      'messages' : IDL.Vec(MessageEventWrapper),
      'latest_event_index' : EventIndex,
    }),
  });
  const MuteNotificationsArgs = IDL.Record({ 'chat_id' : ChatId });
  const MuteNotificationsResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
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
  const RecommendedGroupsArgs = IDL.Record({ 'count' : IDL.Nat8 });
  const PublicGroupSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'name' : IDL.Text,
    'wasm_version' : Version,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'pinned_message' : IDL.Opt(MessageIndex),
    'owner_id' : UserId,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'latest_event_index' : EventIndex,
    'chat_id' : ChatId,
    'participant_count' : IDL.Nat32,
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const RecommendedGroupsSuccessResult = IDL.Record({
    'groups' : IDL.Vec(PublicGroupSummary),
  });
  const RecommendedGroupsResponse = IDL.Variant({
    'Success' : RecommendedGroupsSuccessResult,
    'InternalError' : IDL.Text,
  });
  const VoteOperation = IDL.Variant({
    'RegisterVote' : IDL.Null,
    'DeleteVote' : IDL.Null,
  });
  const RegisterPollVoteArgs = IDL.Record({
    'user_id' : UserId,
    'poll_option' : IDL.Nat32,
    'operation' : VoteOperation,
    'message_index' : MessageIndex,
  });
  const RegisterPollVoteResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'PollEnded' : IDL.Null,
    'Success' : PollVotes,
    'OptionIndexOutOfRange' : IDL.Null,
    'PollNotFound' : IDL.Null,
  });
  const RelinquishGroupSuperAdminArgs = IDL.Record({ 'chat_id' : ChatId });
  const RelinquishGroupSuperAdminResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Null,
    'NotSuperAdmin' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const SearchAllMessagesArgs = IDL.Record({
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
  const SearchAllMessagesResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'Success' : SearchMessagesSuccessResult,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const SearchMessagesArgs = IDL.Record({
    'max_results' : IDL.Nat8,
    'user_id' : UserId,
    'search_term' : IDL.Text,
  });
  const SearchMessagesResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'ChatNotFound' : IDL.Null,
    'Success' : SearchMessagesSuccessResult,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const SendMessageArgs = IDL.Record({
    'content' : MessageContent,
    'recipient' : UserId,
    'forwarding' : IDL.Bool,
    'sender_name' : IDL.Text,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(ReplyContext),
  });
  const InvalidPollReason = IDL.Variant({
    'DuplicateOptions' : IDL.Null,
    'TooFewOptions' : IDL.Nat32,
    'TooManyOptions' : IDL.Nat32,
    'OptionTooLong' : IDL.Nat32,
    'EndDateInThePast' : IDL.Null,
  });
  const SendMessageResponse = IDL.Variant({
    'TextTooLong' : IDL.Nat32,
    'TransferLimitExceeded' : IDL.Nat64,
    'TransferCannotBeZero' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'message_index' : MessageIndex,
    }),
    'MessageEmpty' : IDL.Null,
    'InvalidPoll' : InvalidPollReason,
    'RecipientBlocked' : IDL.Null,
    'InvalidRequest' : IDL.Text,
    'TransferFailed' : IDL.Text,
    'TransferSuccess' : IDL.Record({
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptoTransaction,
      'message_index' : MessageIndex,
    }),
  });
  const SetAvatarArgs = IDL.Record({ 'avatar' : IDL.Opt(Avatar) });
  const SetAvatarResponse = IDL.Variant({
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : IDL.Null,
  });
  const SetBioArgs = IDL.Record({ 'text' : IDL.Text });
  const SetBioResponse = IDL.Variant({
    'TooLong' : FieldTooLongResult,
    'Success' : IDL.Null,
  });
  const ToggleReactionArgs = IDL.Record({
    'user_id' : UserId,
    'message_id' : MessageId,
    'reaction' : IDL.Text,
  });
  const ToggleReactionResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'InvalidReaction' : IDL.Null,
    'Added' : EventIndex,
    'Removed' : EventIndex,
  });
  const User = IDL.Record({ 'username' : IDL.Text, 'user_id' : UserId });
  const GroupReplyContext = IDL.Record({ 'event_index' : EventIndex });
  const TransferCryptoWithinGroupArgs = IDL.Record({
    'content' : CryptocurrencyContent,
    'recipient' : UserId,
    'mentioned' : IDL.Vec(User),
    'group_id' : ChatId,
    'sender_name' : IDL.Text,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(GroupReplyContext),
  });
  const TransferCryptoWithinGroupResponse = IDL.Variant({
    'TextTooLong' : IDL.Nat32,
    'TransferLimitExceeded' : Tokens,
    'CallerNotInGroup' : IDL.Opt(CompletedCryptoTransaction),
    'TransferCannotBeZero' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'transfer' : CompletedCryptoTransaction,
      'message_index' : MessageIndex,
    }),
    'RecipientBlocked' : IDL.Null,
    'InvalidRequest' : IDL.Text,
    'TransferFailed' : IDL.Text,
    'InternalError' : IDL.Tuple(IDL.Text, CompletedCryptoTransaction),
    'CryptocurrencyNotSupported' : Cryptocurrency,
  });
  const UnblockUserArgs = IDL.Record({ 'user_id' : UserId });
  const UnblockUserResponse = IDL.Variant({ 'Success' : IDL.Null });
  const UnmuteNotificationsArgs = IDL.Record({ 'chat_id' : ChatId });
  const UnmuteNotificationsResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
  });
  const GroupChatUpdatesSince = IDL.Record({
    'updates_since' : TimestampMillis,
    'chat_id' : ChatId,
  });
  const UpdatesSince = IDL.Record({
    'group_chats' : IDL.Vec(GroupChatUpdatesSince),
    'timestamp' : TimestampMillis,
  });
  const UpdatesArgs = IDL.Record({ 'updates_since' : UpdatesSince });
  const PinnedMessageUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : MessageIndex,
  });
  const AvatarIdUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : IDL.Nat,
  });
  const GroupChatSummaryUpdates = IDL.Record({
    'is_public' : IDL.Opt(IDL.Bool),
    'permissions' : IDL.Opt(GroupPermissions),
    'metrics' : IDL.Opt(ChatMetrics),
    'name' : IDL.Opt(IDL.Text),
    'role' : IDL.Opt(Role),
    'wasm_version' : IDL.Opt(Version),
    'affected_events' : IDL.Vec(EventIndex),
    'notifications_muted' : IDL.Opt(IDL.Bool),
    'description' : IDL.Opt(IDL.Text),
    'last_updated' : TimestampMillis,
    'read_by_me' : IDL.Opt(IDL.Vec(MessageIndexRange)),
    'pinned_message' : PinnedMessageUpdate,
    'owner_id' : IDL.Opt(UserId),
    'avatar_id' : AvatarIdUpdate,
    'latest_event_index' : IDL.Opt(EventIndex),
    'mentions' : IDL.Vec(Mention),
    'chat_id' : ChatId,
    'participant_count' : IDL.Opt(IDL.Nat32),
    'my_metrics' : IDL.Opt(ChatMetrics),
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const DirectChatSummaryUpdates = IDL.Record({
    'metrics' : IDL.Opt(ChatMetrics),
    'affected_events' : IDL.Vec(EventIndex),
    'notifications_muted' : IDL.Opt(IDL.Bool),
    'read_by_me' : IDL.Opt(IDL.Vec(MessageIndexRange)),
    'latest_event_index' : IDL.Opt(EventIndex),
    'chat_id' : ChatId,
    'read_by_them' : IDL.Opt(IDL.Vec(MessageIndexRange)),
    'my_metrics' : IDL.Opt(ChatMetrics),
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const ChatSummaryUpdates = IDL.Variant({
    'Group' : GroupChatSummaryUpdates,
    'Direct' : DirectChatSummaryUpdates,
  });
  const UpdatesResponse = IDL.Variant({
    'Success' : IDL.Record({
      'cycles_balance' : IDL.Opt(Cycles),
      'user_canister_wasm_version' : IDL.Opt(Version),
      'upgrades_in_progress' : IDL.Vec(ChatId),
      'chats_updated' : IDL.Vec(ChatSummaryUpdates),
      'blocked_users' : IDL.Vec(UserId),
      'chats_added' : IDL.Vec(ChatSummary),
      'avatar_id' : AvatarIdUpdate,
      'chats_removed' : IDL.Vec(ChatId),
      'timestamp' : TimestampMillis,
    }),
    'InternalError' : IDL.Text,
  });
  const WithdrawCryptoRequest = IDL.Record({
    'withdrawal' : PendingCryptoTransaction,
  });
  const WithdrawCryptoResponse = IDL.Variant({
    'CurrencyNotSupported' : IDL.Null,
    'TransactionFailed' : FailedCryptoTransaction,
    'Success' : CompletedCryptoTransaction,
  });
  return IDL.Service({
    'add_recommended_group_exclusions' : IDL.Func(
        [AddRecommendedGroupExclusionsArgs],
        [AddRecommendedGroupExclusionsResponse],
        [],
      ),
    'assume_group_super_admin' : IDL.Func(
        [AssumeGroupSuperAdminArgs],
        [AssumeGroupSuperAdminResponse],
        [],
      ),
    'bio' : IDL.Func([BioArgs], [BioResponse], ['query']),
    'block_user' : IDL.Func([BlockUserArgs], [BlockUserResponse], []),
    'create_group' : IDL.Func([CreateGroupArgs], [CreateGroupResponse], []),
    'delete_group' : IDL.Func([DeleteGroupArgs], [DeleteGroupResponse], []),
    'delete_messages' : IDL.Func(
        [DeleteMessagesArgs],
        [DeleteMessagesResponse],
        [],
      ),
    'edit_message' : IDL.Func([EditMessageArgs], [EditMessageResponse], []),
    'events' : IDL.Func([EventsArgs], [EventsResponse], ['query']),
    'events_by_index' : IDL.Func(
        [EventsByIndexArgs],
        [EventsResponse],
        ['query'],
      ),
    'events_range' : IDL.Func([EventsRangeArgs], [EventsResponse], ['query']),
    'events_window' : IDL.Func([EventsWindowArgs], [EventsResponse], ['query']),
    'initial_state' : IDL.Func(
        [InitialStateArgs],
        [InitialStateResponse],
        ['query'],
      ),
    'join_group_v2' : IDL.Func([JoinGroupArgs], [JoinGroupResponse], []),
    'leave_group' : IDL.Func([LeaveGroupArgs], [LeaveGroupResponse], []),
    'mark_read' : IDL.Func([MarkReadArgs], [MarkReadResponse], []),
    'messages_by_message_index' : IDL.Func(
        [MessagesByMessageIndexArgs],
        [MessagesByMessageIndexResponse],
        ['query'],
      ),
    'mute_notifications' : IDL.Func(
        [MuteNotificationsArgs],
        [MuteNotificationsResponse],
        [],
      ),
    'public_profile' : IDL.Func(
        [PublicProfileArgs],
        [PublicProfileResponse],
        ['query'],
      ),
    'recommended_groups' : IDL.Func(
        [RecommendedGroupsArgs],
        [RecommendedGroupsResponse],
        ['query'],
      ),
    'register_poll_vote' : IDL.Func(
        [RegisterPollVoteArgs],
        [RegisterPollVoteResponse],
        [],
      ),
    'relinquish_group_super_admin' : IDL.Func(
        [RelinquishGroupSuperAdminArgs],
        [RelinquishGroupSuperAdminResponse],
        [],
      ),
    'search_all_messages' : IDL.Func(
        [SearchAllMessagesArgs],
        [SearchAllMessagesResponse],
        ['query'],
      ),
    'search_messages' : IDL.Func(
        [SearchMessagesArgs],
        [SearchMessagesResponse],
        ['query'],
      ),
    'send_message' : IDL.Func([SendMessageArgs], [SendMessageResponse], []),
    'set_avatar' : IDL.Func([SetAvatarArgs], [SetAvatarResponse], []),
    'set_bio' : IDL.Func([SetBioArgs], [SetBioResponse], []),
    'toggle_reaction' : IDL.Func(
        [ToggleReactionArgs],
        [ToggleReactionResponse],
        [],
      ),
    'transfer_crypto_within_group' : IDL.Func(
        [TransferCryptoWithinGroupArgs],
        [TransferCryptoWithinGroupResponse],
        [],
      ),
    'unblock_user' : IDL.Func([UnblockUserArgs], [UnblockUserResponse], []),
    'unmute_notifications' : IDL.Func(
        [UnmuteNotificationsArgs],
        [UnmuteNotificationsResponse],
        [],
      ),
    'updates' : IDL.Func([UpdatesArgs], [UpdatesResponse], ['query']),
    'withdraw_crypto' : IDL.Func(
        [WithdrawCryptoRequest],
        [WithdrawCryptoResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
