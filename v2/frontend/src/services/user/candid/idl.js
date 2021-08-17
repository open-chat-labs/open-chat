export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const InitArgs = IDL.Record({
    'owner' : IDL.Principal,
    'notification_canister_ids' : IDL.Vec(CanisterId),
  });
  const UserId = CanisterId;
  const BlockUserArgs = IDL.Record({ 'user_id' : UserId });
  const ChunkArgs = IDL.Record({ 'blob_id' : IDL.Nat, 'index' : IDL.Nat32 });
  const ChunkResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Record({ 'bytes' : IDL.Vec(IDL.Nat8) }),
  });
  const CreateGroupArgs = IDL.Record({
    'is_public' : IDL.Bool,
    'name' : IDL.Text,
  });
  const CreateGroupResponse = IDL.Variant({
    'PublicGroupAlreadyExists' : IDL.Null,
    'UnknownError' : IDL.Null,
    'Success' : IDL.Record({ 'canister_id' : CanisterId }),
    'InvalidName' : IDL.Null,
    'NameTooLong' : IDL.Nat16,
    'GroupLimitExceeded' : IDL.Nat16,
  });
  const EventIndex = IDL.Nat32;
  const EventsArgs = IDL.Record({
    'user_id' : UserId,
    'to_index' : EventIndex,
    'from_index' : EventIndex,
  });
  const BlobReference = IDL.Record({
    'blob_size' : IDL.Nat32,
    'blob_id' : IDL.Text,
    'canister_id' : CanisterId,
    'chunk_size' : IDL.Nat32,
  });
  const FileContent = IDL.Record({
    'name' : IDL.Text,
    'mime_type' : IDL.Text,
    'blob_reference' : IDL.Opt(BlobReference),
    'caption' : IDL.Opt(IDL.Text),
  });
  const TextContent = IDL.Record({ 'text' : IDL.Text });
  const MediaContent = IDL.Record({
    'height' : IDL.Nat32,
    'mime_type' : IDL.Text,
    'blob_reference' : IDL.Opt(BlobReference),
    'thumbnail_data' : IDL.Text,
    'caption' : IDL.Opt(IDL.Text),
    'width' : IDL.Nat32,
  });
  const CyclesContent = IDL.Record({
    'caption' : IDL.Opt(IDL.Text),
    'amount' : IDL.Nat,
  });
  const MessageContent = IDL.Variant({
    'File' : FileContent,
    'Text' : TextContent,
    'Media' : MediaContent,
    'Cycles' : CyclesContent,
  });
  const TimestampMillis = IDL.Nat64;
  const MessageId = IDL.Nat;
  const GroupId = CanisterId;
  const MessageIndex = IDL.Nat32;
  const DirectReplyContext = IDL.Variant({
    'Private' : IDL.Record({
      'chat_id' : GroupId,
      'message_index' : MessageIndex,
    }),
    'Standard' : IDL.Record({
      'content' : MessageContent,
      'sent_by_me' : IDL.Bool,
      'message_index' : MessageIndex,
    }),
  });
  const DirectMessage = IDL.Record({
    'content' : MessageContent,
    'sender' : UserId,
    'timestamp' : TimestampMillis,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(DirectReplyContext),
    'message_index' : MessageIndex,
  });
  const DirectChatEvent = IDL.Variant({ 'Message' : DirectMessage });
  const EventWrapper = IDL.Record({
    'event' : DirectChatEvent,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
  });
  const EventsSuccessResult = IDL.Record({
    'events' : IDL.Vec(EventWrapper),
    'latest_event_index' : EventIndex,
  });
  const EventsResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'NotAuthorised' : IDL.Null,
    'Success' : EventsSuccessResult,
  });
  const EventsByIndexArgs = IDL.Record({
    'user_id' : UserId,
    'events' : IDL.Vec(EventIndex),
  });
  const EventsByIndexResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : EventsSuccessResult,
  });
  const HandleAddToGroupRequestedArgs = IDL.Record({ 'added_by' : UserId });
  const HandleAddToGroupRequestedSuccessResult = IDL.Record({
    'principal' : IDL.Principal,
  });
  const HandleAddToGroupRequestedResponse = IDL.Variant({
    'Blocked' : IDL.Null,
    'Success' : HandleAddToGroupRequestedSuccessResult,
  });
  const HandleMarkReadArgs = IDL.Record({
    'up_to_message_index' : MessageIndex,
  });
  const HandleMarkReadResponse = IDL.Variant({
    'SuccessNoChange' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Null,
  });
  const ReplyContextArgs = IDL.Record({
    'chat_id_if_other' : IDL.Opt(GroupId),
    'message_index' : MessageIndex,
  });
  const HandleMessageReceivedArgs = IDL.Record({
    'content' : MessageContent,
    'sender_name' : IDL.Text,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(ReplyContextArgs),
  });
  const HandleMessageReceivedResponse = IDL.Variant({ 'Success' : IDL.Null });
  const JoinGroupArgs = IDL.Record({ 'group_chat_id' : GroupId });
  const JoinGroupResponse = IDL.Variant({
    'Blocked' : IDL.Null,
    'GroupNotFound' : IDL.Null,
    'GroupNotPublic' : IDL.Null,
    'AlreadyInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const MarkReadArgs = IDL.Record({
    'up_to_message_index' : MessageIndex,
    'user_id' : UserId,
  });
  const MarkReadResponse = IDL.Variant({
    'SuccessNoChange' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
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
  const PutChunkArgs = IDL.Record({
    'blob_id' : IDL.Nat,
    'bytes' : IDL.Vec(IDL.Nat8),
    'index' : IDL.Nat32,
  });
  const PutChunkResponse = IDL.Variant({
    'Full' : IDL.Null,
    'Success' : IDL.Null,
  });
  const SearchAllMessagesArgs = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const SearchAllMessagesResponse = IDL.Variant({
    'Success' : IDL.Record({
      'matches' : IDL.Vec(
        IDL.Record({
          'chat' : CanisterId,
          'is_direct' : IDL.Bool,
          'message' : DirectMessage,
        })
      ),
    }),
    'Failure' : IDL.Null,
  });
  const SendMessageArgs = IDL.Record({
    'content' : MessageContent,
    'recipient' : UserId,
    'sender_name' : IDL.Text,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(ReplyContextArgs),
  });
  const SendMessageResponse = IDL.Variant({
    'BalanceExceeded' : IDL.Null,
    'Success' : IDL.Record({
      'latest_read_by_me' : MessageIndex,
      'timestamp' : TimestampMillis,
      'latest_read_by_them' : MessageIndex,
      'message_index' : MessageIndex,
    }),
    'RecipientBlocked' : IDL.Null,
    'InvalidRequest' : IDL.Null,
    'SenderBlocked' : IDL.Null,
    'MessageTooLong' : IDL.Nat32,
    'RecipientNotFound' : IDL.Null,
  });
  const SetAvatarArgs = IDL.Record({
    'mime_type' : IDL.Text,
    'bytes' : IDL.Vec(IDL.Nat8),
  });
  const SetAvatarResponse = IDL.Variant({
    'InvalidMimeType' : IDL.Nat32,
    'FileTooBig' : IDL.Nat32,
    'Success' : IDL.Null,
  });
  const UnblockUserArgs = IDL.Record({ 'user_id' : UserId });
  const GroupChatUpdatesSince = IDL.Record({
    'updates_since' : TimestampMillis,
    'chat_id' : GroupId,
  });
  const UpdatesSince = IDL.Record({
    'group_chats' : IDL.Vec(GroupChatUpdatesSince),
    'timestamp' : TimestampMillis,
  });
  const UpdatesArgs = IDL.Record({ 'updates_since' : IDL.Opt(UpdatesSince) });
  const Participant = IDL.Record({
    'role' : IDL.Variant({ 'Admin' : IDL.Null, 'Standard' : IDL.Null }),
    'user_id' : UserId,
    'date_added' : TimestampMillis,
  });
  const GroupReplyContext = IDL.Record({
    'content' : MessageContent,
    'user_id' : UserId,
    'event_index' : EventIndex,
  });
  const GroupMessage = IDL.Record({
    'content' : MessageContent,
    'sender' : UserId,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(GroupReplyContext),
    'message_index' : MessageIndex,
  });
  const GroupChatSummaryUpdates = IDL.Record({
    'participants_added_or_updated' : IDL.Vec(Participant),
    'participants_removed' : IDL.Vec(UserId),
    'name' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'latest_read_by_me' : IDL.Opt(MessageIndex),
    'timestamp' : TimestampMillis,
    'latest_event_index' : IDL.Opt(EventIndex),
    'chat_id' : GroupId,
    'latest_message' : IDL.Opt(
      IDL.Record({
        'event' : GroupMessage,
        'timestamp' : TimestampMillis,
        'index' : EventIndex,
      })
    ),
  });
  const DirectChatId = IDL.Principal;
  const DirectChatSummaryUpdates = IDL.Record({
    'latest_read_by_me' : IDL.Opt(MessageIndex),
    'latest_event_index' : IDL.Opt(EventIndex),
    'chat_id' : DirectChatId,
    'latest_read_by_them' : IDL.Opt(MessageIndex),
    'latest_message' : IDL.Opt(
      IDL.Record({
        'event' : DirectMessage,
        'timestamp' : TimestampMillis,
        'index' : EventIndex,
      })
    ),
  });
  const ChatSummaryUpdates = IDL.Variant({
    'Group' : GroupChatSummaryUpdates,
    'Direct' : DirectChatSummaryUpdates,
  });
  const GroupChatSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'participants' : IDL.Vec(Participant),
    'name' : IDL.Text,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'latest_read_by_me' : MessageIndex,
    'joined' : TimestampMillis,
    'latest_event_index' : EventIndex,
    'min_visible_message_index' : MessageIndex,
    'chat_id' : GroupId,
    'latest_message' : IDL.Opt(
      IDL.Record({
        'event' : GroupMessage,
        'timestamp' : TimestampMillis,
        'index' : EventIndex,
      })
    ),
  });
  const DirectChatSummary = IDL.Record({
    'date_created' : TimestampMillis,
    'them' : UserId,
    'last_updated' : TimestampMillis,
    'latest_read_by_me' : MessageIndex,
    'latest_event_index' : EventIndex,
    'chat_id' : DirectChatId,
    'latest_read_by_them' : MessageIndex,
    'latest_message' : IDL.Record({
      'event' : DirectMessage,
      'timestamp' : TimestampMillis,
      'index' : EventIndex,
    }),
  });
  const ChatSummary = IDL.Variant({
    'Group' : GroupChatSummary,
    'Direct' : DirectChatSummary,
  });
  const ChatId = IDL.Variant({ 'Group' : GroupId, 'Direct' : DirectChatId });
  const UpdatesResponse = IDL.Variant({
    'Success' : IDL.Record({
      'chats_updated' : IDL.Vec(ChatSummaryUpdates),
      'chats_added' : IDL.Vec(ChatSummary),
      'chats_removed' : IDL.Vec(ChatId),
      'timestamp' : TimestampMillis,
    }),
  });
  return IDL.Service({
    'block_user' : IDL.Func([BlockUserArgs], [], []),
    'chunk' : IDL.Func([ChunkArgs], [ChunkResponse], ['query']),
    'create_group' : IDL.Func([CreateGroupArgs], [CreateGroupResponse], []),
    'events' : IDL.Func([EventsArgs], [EventsResponse], ['query']),
    'events_by_index' : IDL.Func(
        [EventsByIndexArgs],
        [EventsByIndexResponse],
        ['query'],
      ),
    'handle_add_to_group_requested' : IDL.Func(
        [HandleAddToGroupRequestedArgs],
        [HandleAddToGroupRequestedResponse],
        [],
      ),
    'handle_mark_read' : IDL.Func(
        [HandleMarkReadArgs],
        [HandleMarkReadResponse],
        [],
      ),
    'handle_message_received' : IDL.Func(
        [HandleMessageReceivedArgs],
        [HandleMessageReceivedResponse],
        [],
      ),
    'join_group' : IDL.Func([JoinGroupArgs], [JoinGroupResponse], []),
    'mark_read' : IDL.Func([MarkReadArgs], [MarkReadResponse], []),
    'metrics' : IDL.Func([MetricsArgs], [MetricsResponse], ['query']),
    'put_chunk' : IDL.Func([PutChunkArgs], [PutChunkResponse], []),
    'search_all_messages' : IDL.Func(
        [SearchAllMessagesArgs],
        [SearchAllMessagesResponse],
        ['query'],
      ),
    'send_message' : IDL.Func([SendMessageArgs], [SendMessageResponse], []),
    'set_avatar' : IDL.Func([SetAvatarArgs], [SetAvatarResponse], []),
    'unblock_user' : IDL.Func([UnblockUserArgs], [], []),
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
