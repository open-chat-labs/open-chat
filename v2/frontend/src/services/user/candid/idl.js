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
  const Avatar = IDL.Record({
    'id' : IDL.Nat,
    'data' : IDL.Vec(IDL.Nat8),
    'mime_type' : IDL.Text,
  });
  const CreateGroupArgs = IDL.Record({
    'is_public' : IDL.Bool,
    'name' : IDL.Text,
    'description' : IDL.Text,
    'history_visible_to_new_joiners' : IDL.Bool,
    'avatar' : IDL.Opt(Avatar),
  });
  const FieldTooLongResult = IDL.Record({
    'length_provided' : IDL.Nat32,
    'max_length' : IDL.Nat32,
  });
  const CreateGroupSuccessResult = IDL.Record({ 'chat_id' : ChatId });
  const CreateGroupResponse = IDL.Variant({
    'DescriptionTooLong' : FieldTooLongResult,
    'Throttled' : IDL.Null,
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : CreateGroupSuccessResult,
    'NameTooLong' : FieldTooLongResult,
    'NameTaken' : IDL.Null,
    'MaxGroupsCreated' : IDL.Nat32,
    'InternalError' : IDL.Null,
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
  const DismissAlertsArgs = IDL.Record({ 'alert_ids' : IDL.Vec(IDL.Text) });
  const DismissAlertsResponse = IDL.Variant({
    'PartialSuccess' : IDL.Vec(IDL.Text),
    'Success' : IDL.Null,
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
  const TextContent = IDL.Record({ 'text' : IDL.Text });
  const ImageContent = IDL.Record({
    'height' : IDL.Nat32,
    'mime_type' : IDL.Text,
    'blob_reference' : IDL.Opt(BlobReference),
    'thumbnail_data' : IDL.Text,
    'caption' : IDL.Opt(IDL.Text),
    'width' : IDL.Nat32,
  });
  const ICP = IDL.Record({ 'e8s' : IDL.Nat64 });
  const Memo = IDL.Nat64;
  const FailedICPTransfer = IDL.Record({
    'fee' : ICP,
    'memo' : Memo,
    'error_message' : IDL.Text,
    'recipient' : UserId,
    'amount' : ICP,
  });
  const BlockIndex = IDL.Nat64;
  const CompletedICPTransfer = IDL.Record({
    'fee' : ICP,
    'block_index' : BlockIndex,
    'memo' : Memo,
    'recipient' : UserId,
    'sender' : UserId,
    'amount' : ICP,
  });
  const PendingICPTransfer = IDL.Record({
    'fee' : IDL.Opt(ICP),
    'memo' : IDL.Opt(Memo),
    'recipient' : UserId,
    'amount' : ICP,
  });
  const ICPTransfer = IDL.Variant({
    'Failed' : FailedICPTransfer,
    'Completed' : CompletedICPTransfer,
    'Pending' : PendingICPTransfer,
  });
  const Cycles = IDL.Nat;
  const FailedCyclesTransfer = IDL.Record({
    'error_message' : IDL.Text,
    'recipient' : UserId,
    'cycles' : Cycles,
  });
  const CompletedCyclesTransfer = IDL.Record({
    'recipient' : UserId,
    'sender' : UserId,
    'cycles' : Cycles,
  });
  const PendingCyclesTransfer = IDL.Record({
    'recipient' : UserId,
    'cycles' : Cycles,
  });
  const CyclesTransfer = IDL.Variant({
    'Failed' : FailedCyclesTransfer,
    'Completed' : CompletedCyclesTransfer,
    'Pending' : PendingCyclesTransfer,
  });
  const CryptocurrencyTransfer = IDL.Variant({
    'ICP' : ICPTransfer,
    'Cycles' : CyclesTransfer,
  });
  const CryptocurrencyContent = IDL.Record({
    'caption' : IDL.Opt(IDL.Text),
    'transfer' : CryptocurrencyTransfer,
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
  const TimestampMillis = IDL.Nat64;
  const DeletedContent = IDL.Record({
    'timestamp' : TimestampMillis,
    'deleted_by' : UserId,
  });
  const MessageContent = IDL.Variant({
    'File' : FileContent,
    'Text' : TextContent,
    'Image' : ImageContent,
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
    'max_messages' : IDL.Nat32,
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
  const DirectChatCreated = IDL.Record({});
  const DirectChatEvent = IDL.Variant({
    'MessageReactionRemoved' : UpdatedMessage,
    'MessageReactionAdded' : UpdatedMessage,
    'Message' : Message,
    'MessageDeleted' : UpdatedMessage,
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
    'max_messages' : IDL.Nat32,
    'max_events' : IDL.Nat32,
  });
  const InitialStateArgs = IDL.Record({});
  const Version = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
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
    'min_visible_event_index' : EventIndex,
    'name' : IDL.Text,
    'role' : Role,
    'wasm_version' : Version,
    'notifications_muted' : IDL.Bool,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'read_by_me' : IDL.Vec(MessageIndexRange),
    'pinned_message' : IDL.Opt(MessageIndex),
    'joined' : TimestampMillis,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'latest_event_index' : EventIndex,
    'min_visible_message_index' : MessageIndex,
    'mentions' : IDL.Vec(Mention),
    'chat_id' : ChatId,
    'participant_count' : IDL.Nat32,
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const DirectChatSummary = IDL.Record({
    'date_created' : TimestampMillis,
    'them' : UserId,
    'notifications_muted' : IDL.Bool,
    'read_by_me' : IDL.Vec(MessageIndexRange),
    'latest_event_index' : EventIndex,
    'read_by_them' : IDL.Vec(MessageIndexRange),
    'latest_message' : MessageEventWrapper,
  });
  const ChatSummary = IDL.Variant({
    'Group' : GroupChatSummary,
    'Direct' : DirectChatSummary,
  });
  const AccountIdentifier = IDL.Vec(IDL.Nat8);
  const CompletedICPDeposit = IDL.Record({
    'fee' : ICP,
    'block_index' : BlockIndex,
    'memo' : Memo,
    'from_address' : AccountIdentifier,
    'amount' : ICP,
  });
  const ICPDeposit = IDL.Variant({ 'Completed' : CompletedICPDeposit });
  const CompletedCyclesDeposit = IDL.Record({
    'from' : CanisterId,
    'cycles' : Cycles,
  });
  const CyclesDeposit = IDL.Variant({ 'Completed' : CompletedCyclesDeposit });
  const CryptocurrencyDeposit = IDL.Variant({
    'ICP' : ICPDeposit,
    'Cycles' : CyclesDeposit,
  });
  const FailedICPWithdrawal = IDL.Record({
    'to' : AccountIdentifier,
    'fee' : ICP,
    'memo' : Memo,
    'error_message' : IDL.Text,
    'amount' : ICP,
  });
  const CompletedICPWithdrawal = IDL.Record({
    'to' : AccountIdentifier,
    'fee' : ICP,
    'block_index' : BlockIndex,
    'memo' : Memo,
    'amount' : ICP,
  });
  const PendingICPWithdrawal = IDL.Record({
    'to' : AccountIdentifier,
    'fee' : IDL.Opt(ICP),
    'memo' : IDL.Opt(Memo),
    'amount' : ICP,
  });
  const ICPWithdrawal = IDL.Variant({
    'Failed' : FailedICPWithdrawal,
    'Completed' : CompletedICPWithdrawal,
    'Pending' : PendingICPWithdrawal,
  });
  const FailedCyclesWithdrawal = IDL.Record({
    'to' : CanisterId,
    'error_message' : IDL.Text,
    'cycles' : Cycles,
  });
  const CompletedCyclesWithdrawal = IDL.Record({
    'to' : CanisterId,
    'cycles' : Cycles,
  });
  const PendingCyclesWithdrawal = IDL.Record({
    'to' : CanisterId,
    'cycles' : Cycles,
  });
  const CyclesWithdrawal = IDL.Variant({
    'Failed' : FailedCyclesWithdrawal,
    'Completed' : CompletedCyclesWithdrawal,
    'Pending' : PendingCyclesWithdrawal,
  });
  const CryptocurrencyWithdrawal = IDL.Variant({
    'ICP' : ICPWithdrawal,
    'Cycles' : CyclesWithdrawal,
  });
  const CryptocurrencyTransaction = IDL.Variant({
    'Deposit' : CryptocurrencyDeposit,
    'Withdrawal' : CryptocurrencyWithdrawal,
    'Transfer' : CryptocurrencyTransfer,
  });
  const Transaction = IDL.Variant({
    'Cryptocurrency' : CryptocurrencyTransaction,
  });
  const TransactionWrapper = IDL.Record({
    'transaction' : Transaction,
    'timestamp' : TimestampMillis,
    'index' : IDL.Nat32,
  });
  const InitialStateResponse = IDL.Variant({
    'Success' : IDL.Record({
      'cycles_balance' : Cycles,
      'user_canister_wasm_version' : Version,
      'upgrades_in_progress' : IDL.Vec(ChatId),
      'chats' : IDL.Vec(ChatSummary),
      'blocked_users' : IDL.Vec(UserId),
      'timestamp' : TimestampMillis,
      'transactions' : IDL.Vec(TransactionWrapper),
    }),
    'InternalError' : IDL.Text,
  });
  const JoinGroupArgs = IDL.Record({
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
  const MuteNotificationsArgs = IDL.Record({ 'chat_id' : ChatId });
  const MuteNotificationsResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
  });
  const RecommendedGroupsArgs = IDL.Record({ 'count' : IDL.Nat8 });
  const PublicGroupSummary = IDL.Record({
    'name' : IDL.Text,
    'wasm_version' : Version,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'pinned_message' : IDL.Opt(MessageIndex),
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
    'sender_name' : IDL.Text,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(ReplyContext),
  });
  const SendMessageResponse = IDL.Variant({
    'TextTooLong' : IDL.Nat32,
    'TransactionFailed' : IDL.Text,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'message_index' : MessageIndex,
    }),
    'MessageEmpty' : IDL.Null,
    'RecipientBlocked' : IDL.Null,
    'InvalidRequest' : IDL.Text,
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
  const NightMode = IDL.Variant({
    'On' : IDL.Null,
    'Off' : IDL.Null,
    'Auto' : IDL.Null,
  });
  const OptionalUserPreferences = IDL.Record({
    'large_emoji' : IDL.Opt(IDL.Bool),
    'notification_preferences' : IDL.Opt(
      IDL.Record({
        'private_group_chats' : IDL.Opt(IDL.Bool),
        'direct_chats' : IDL.Opt(IDL.Bool),
        'silent' : IDL.Opt(IDL.Bool),
        'public_group_chats' : IDL.Opt(IDL.Bool),
        'vibrate' : IDL.Opt(IDL.Bool),
      })
    ),
    'night_mode' : IDL.Opt(NightMode),
    'language' : IDL.Opt(IDL.Text),
    'enter_key_sends' : IDL.Opt(IDL.Bool),
    'generate_link_previews' : IDL.Opt(IDL.Bool),
    'use_system_emoji' : IDL.Opt(IDL.Bool),
    'enable_animations' : IDL.Opt(IDL.Bool),
  });
  const SetPreferencesArgs = IDL.Record({
    'preferences' : OptionalUserPreferences,
  });
  const SetPreferencesResponse = IDL.Variant({ 'Success' : IDL.Null });
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
  const TransactionsArgs = IDL.Record({
    'max_transactions' : IDL.Nat8,
    'ascending' : IDL.Bool,
    'start_index' : IDL.Nat32,
  });
  const TransactionsSuccessResult = IDL.Record({
    'latest_transaction_index' : IDL.Opt(IDL.Nat32),
    'transactions' : IDL.Vec(TransactionWrapper),
  });
  const TransactionsResponse = IDL.Variant({
    'Success' : TransactionsSuccessResult,
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
  const GroupDeletedAlert = IDL.Record({
    'deleted_by' : UserId,
    'chat_id' : ChatId,
  });
  const RemovedFromGroupAlert = IDL.Record({
    'chat_id' : ChatId,
    'removed_by' : UserId,
  });
  const AlertDetails = IDL.Variant({
    'GroupDeleted' : GroupDeletedAlert,
    'CryptocurrencyDepositReceived' : CryptocurrencyDeposit,
    'RemovedFromGroup' : RemovedFromGroupAlert,
    'BlockedFromGroup' : RemovedFromGroupAlert,
  });
  const Alert = IDL.Record({
    'id' : IDL.Text,
    'details' : AlertDetails,
    'elapsed' : Milliseconds,
  });
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
    'name' : IDL.Opt(IDL.Text),
    'role' : IDL.Opt(Role),
    'wasm_version' : IDL.Opt(Version),
    'notifications_muted' : IDL.Opt(IDL.Bool),
    'description' : IDL.Opt(IDL.Text),
    'last_updated' : TimestampMillis,
    'read_by_me' : IDL.Opt(IDL.Vec(MessageIndexRange)),
    'pinned_message' : PinnedMessageUpdate,
    'avatar_id' : AvatarIdUpdate,
    'latest_event_index' : IDL.Opt(EventIndex),
    'mentions' : IDL.Vec(Mention),
    'chat_id' : ChatId,
    'participant_count' : IDL.Opt(IDL.Nat32),
    'latest_message' : IDL.Opt(MessageEventWrapper),
  });
  const DirectChatSummaryUpdates = IDL.Record({
    'notifications_muted' : IDL.Opt(IDL.Bool),
    'read_by_me' : IDL.Opt(IDL.Vec(MessageIndexRange)),
    'latest_event_index' : IDL.Opt(EventIndex),
    'chat_id' : ChatId,
    'read_by_them' : IDL.Opt(IDL.Vec(MessageIndexRange)),
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
      'alerts' : IDL.Vec(Alert),
      'chats_updated' : IDL.Vec(ChatSummaryUpdates),
      'blocked_users' : IDL.Vec(UserId),
      'chats_added' : IDL.Vec(ChatSummary),
      'avatar_id' : AvatarIdUpdate,
      'chats_removed' : IDL.Vec(ChatId),
      'timestamp' : TimestampMillis,
      'transactions' : IDL.Vec(TransactionWrapper),
    }),
    'InternalError' : IDL.Text,
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
    'delete_messages' : IDL.Func(
        [DeleteMessagesArgs],
        [DeleteMessagesResponse],
        [],
      ),
    'dismiss_alerts' : IDL.Func(
        [DismissAlertsArgs],
        [DismissAlertsResponse],
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
    'mute_notifications' : IDL.Func(
        [MuteNotificationsArgs],
        [MuteNotificationsResponse],
        [],
      ),
    'recommended_groups' : IDL.Func(
        [RecommendedGroupsArgs],
        [RecommendedGroupsResponse],
        ['query'],
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
    'set_preferences' : IDL.Func(
        [SetPreferencesArgs],
        [SetPreferencesResponse],
        [],
      ),
    'toggle_reaction' : IDL.Func(
        [ToggleReactionArgs],
        [ToggleReactionResponse],
        [],
      ),
    'transactions' : IDL.Func(
        [TransactionsArgs],
        [TransactionsResponse],
        ['query'],
      ),
    'unblock_user' : IDL.Func([UnblockUserArgs], [UnblockUserResponse], []),
    'unmute_notifications' : IDL.Func(
        [UnmuteNotificationsArgs],
        [UnmuteNotificationsResponse],
        [],
      ),
    'updates' : IDL.Func([UpdatesArgs], [UpdatesResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
