export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const InitArgs = IDL.Record({
    'owner' : IDL.Principal,
    'notification_canister_ids' : IDL.Vec(CanisterId),
  });
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
  const ChatId = CanisterId;
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
  const Cycles = IDL.Nat;
  const CyclesContent = IDL.Record({
    'caption' : IDL.Opt(IDL.Text),
    'amount' : Cycles,
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
    'Cycles' : CyclesContent,
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
    'message_id' : MessageId,
    'event_index' : EventIndex,
  });
  const ReplyContext = IDL.Record({
    'chat_id_if_other' : IDL.Opt(ChatId),
    'event_index' : EventIndex,
  });
  const MessageIndex = IDL.Nat32;
  const Message = IDL.Record({
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
  const JoinGroupArgs = IDL.Record({ 'chat_id' : ChatId });
  const JoinGroupResponse = IDL.Variant({
    'Blocked' : IDL.Null,
    'GroupNotFound' : IDL.Null,
    'GroupNotPublic' : IDL.Null,
    'AlreadyInGroup' : IDL.Null,
    'Success' : IDL.Null,
    'ParticipantLimitReached' : IDL.Nat32,
    'InternalError' : IDL.Text,
  });
  const LeaveGroupArgs = IDL.Record({ 'chat_id' : ChatId });
  const LeaveGroupResponse = IDL.Variant({
    'GroupNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const MessageIndexRange = IDL.Record({
    'to' : MessageIndex,
    'from' : MessageIndex,
  });
  const ChatMessagesRead = IDL.Record({
    'message_ranges' : IDL.Vec(MessageIndexRange),
    'chat_id' : ChatId,
  });
  const MarkReadArgs = IDL.Record({
    'messages_read' : IDL.Vec(ChatMessagesRead),
  });
  const MarkReadResponse = IDL.Variant({ 'Success' : IDL.Null });
  const MetricsArgs = IDL.Record({});
  const MetricsResponse = IDL.Record({
    'blob_bytes_used' : IDL.Nat64,
    'cycles_balance' : IDL.Int64,
    'group_chat_count' : IDL.Nat32,
    'image_message_count' : IDL.Nat64,
    'caller_id' : IDL.Principal,
    'direct_chat_count' : IDL.Nat32,
    'chunk_count' : IDL.Nat32,
    'bytes_used' : IDL.Nat64,
    'file_message_count' : IDL.Nat64,
    'cycles_message_count' : IDL.Nat64,
    'timestamp' : TimestampMillis,
    'text_message_count' : IDL.Nat64,
    'wasm_memory_used' : IDL.Nat64,
    'video_message_count' : IDL.Nat64,
  });
  const MuteNotificationsArgs = IDL.Record({ 'chat_id' : ChatId });
  const MuteNotificationsResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
  });
  const PutChunkArgs = IDL.Record({
    'total_chunks' : IDL.Nat32,
    'blob_id' : IDL.Nat,
    'mime_type' : IDL.Text,
    'bytes' : IDL.Vec(IDL.Nat8),
    'index' : IDL.Nat32,
  });
  const PutChunkResponse = IDL.Variant({
    'ChunkAlreadyExists' : IDL.Null,
    'BlobTooBig' : IDL.Null,
    'Full' : IDL.Null,
    'BlobAlreadyExists' : IDL.Null,
    'Success' : IDL.Null,
    'ChunkTooBig' : IDL.Null,
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
    'BalanceExceeded' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'chat_id' : ChatId,
      'event_index' : EventIndex,
      'message_index' : MessageIndex,
    }),
    'RecipientBlocked' : IDL.Null,
    'InvalidRequest' : IDL.Null,
    'MessageTooLong' : IDL.Nat32,
    'RecipientNotFound' : IDL.Null,
  });
  const SetAvatarArgs = IDL.Record({
    'id' : IDL.Nat,
    'data' : IDL.Vec(IDL.Nat8),
    'mime_type' : IDL.Text,
  });
  const SetAvatarResponse = IDL.Variant({
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : IDL.Nat,
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
  const TransactionsArgs = IDL.Record({
    'max_transactions' : IDL.Nat8,
    'ascending' : IDL.Bool,
    'start_index' : IDL.Nat32,
  });
  const Cryptocurrency = IDL.Variant({ 'ICP' : IDL.Null, 'Cycles' : IDL.Null });
  const CryptocurrencyDeposit = IDL.Record({
    'from' : IDL.Text,
    'amount' : IDL.Nat,
  });
  const CryptocurrencySend = IDL.Record({
    'to' : IDL.Text,
    'to_user' : UserId,
    'amount' : IDL.Nat,
  });
  const CryptocurrencyWithdrawal = IDL.Record({
    'to' : IDL.Text,
    'amount' : IDL.Nat,
  });
  const CryptocurrencyReceive = IDL.Record({
    'from_user' : UserId,
    'from' : IDL.Text,
    'amount' : IDL.Nat,
  });
  const CryptocurrencyTransfer = IDL.Variant({
    'Deposit' : CryptocurrencyDeposit,
    'Send' : CryptocurrencySend,
    'Withdrawal' : CryptocurrencyWithdrawal,
    'Receive' : CryptocurrencyReceive,
  });
  const CryptocurrencyTransaction = IDL.Record({
    'currency' : Cryptocurrency,
    'block_height' : IDL.Opt(IDL.Nat64),
    'transfer' : CryptocurrencyTransfer,
  });
  const Transaction = IDL.Variant({
    'Cryptocurrency' : CryptocurrencyTransaction,
  });
  const TransactionWrapper = IDL.Record({
    'transaction' : Transaction,
    'timestamp' : TimestampMillis,
    'index' : IDL.Nat32,
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
  const UpdatesArgs = IDL.Record({ 'updates_since' : IDL.Opt(UpdatesSince) });
  const Role = IDL.Variant({ 'Participant' : IDL.Null, 'Admin' : IDL.Null });
  const Participant = IDL.Record({
    'role' : Role,
    'user_id' : UserId,
    'date_added' : TimestampMillis,
  });
  const MessageEventWrapper = IDL.Record({
    'event' : Message,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
  });
  const GroupChatSummaryUpdates = IDL.Record({
    'participants_added_or_updated' : IDL.Vec(Participant),
    'participants_removed' : IDL.Vec(UserId),
    'name' : IDL.Opt(IDL.Text),
    'notifications_muted' : IDL.Opt(IDL.Bool),
    'description' : IDL.Opt(IDL.Text),
    'last_updated' : TimestampMillis,
    'read_by_me' : IDL.Opt(IDL.Vec(MessageIndexRange)),
    'avatar_id' : IDL.Opt(IDL.Nat),
    'latest_event_index' : IDL.Opt(EventIndex),
    'chat_id' : ChatId,
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
  const GroupChatSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'participants' : IDL.Vec(Participant),
    'min_visible_event_index' : EventIndex,
    'name' : IDL.Text,
    'notifications_muted' : IDL.Bool,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'read_by_me' : IDL.Vec(MessageIndexRange),
    'joined' : TimestampMillis,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'latest_event_index' : EventIndex,
    'min_visible_message_index' : MessageIndex,
    'chat_id' : ChatId,
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
  const UpdatesResponse = IDL.Variant({
    'Success' : IDL.Record({
      'cycles_balance' : IDL.Opt(Cycles),
      'chats_updated' : IDL.Vec(ChatSummaryUpdates),
      'blocked_users' : IDL.Vec(UserId),
      'chats_added' : IDL.Vec(ChatSummary),
      'chats_removed' : IDL.Vec(ChatId),
      'timestamp' : TimestampMillis,
      'transactions' : IDL.Vec(Transaction),
    }),
  });
  return IDL.Service({
    'block_user' : IDL.Func([BlockUserArgs], [BlockUserResponse], []),
    'create_group' : IDL.Func([CreateGroupArgs], [CreateGroupResponse], []),
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
    'join_group' : IDL.Func([JoinGroupArgs], [JoinGroupResponse], []),
    'leave_group' : IDL.Func([LeaveGroupArgs], [LeaveGroupResponse], []),
    'mark_read' : IDL.Func([MarkReadArgs], [MarkReadResponse], []),
    'metrics' : IDL.Func([MetricsArgs], [MetricsResponse], ['query']),
    'mute_notifications' : IDL.Func(
        [MuteNotificationsArgs],
        [MuteNotificationsResponse],
        [],
      ),
    'put_chunk' : IDL.Func([PutChunkArgs], [PutChunkResponse], []),
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
export const init = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const InitArgs = IDL.Record({
    'owner' : IDL.Principal,
    'notification_canister_ids' : IDL.Vec(CanisterId),
  });
  return [InitArgs];
};
