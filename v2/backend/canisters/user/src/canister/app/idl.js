export default ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const BlockUserArgs = IDL.Record({ 'user_id' : UserId });
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
  const TimestampMillis = IDL.Nat64;
  const GetChatsArgs = IDL.Record({
    'message_count_for_top_chat' : IDL.Opt(IDL.Nat16),
    'updated_since' : IDL.Opt(TimestampMillis),
  });
  const ChatId = IDL.Nat;
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
  const ReplyContext = IDL.Record({
    'content' : MessageContent,
    'user_id' : UserId,
    'message_id' : IDL.Nat,
  });
  const Message = IDL.Record({
    'content' : MessageContent,
    'sender' : UserId,
    'timestamp' : TimestampMillis,
    'message_id' : IDL.Nat,
    'replies_to' : IDL.Opt(ReplyContext),
    'message_index' : IDL.Nat32,
  });
  const GroupChatSummary = IDL.Record({
    'id' : ChatId,
    'last_read_by_us' : IDL.Nat32,
    'participants' : IDL.Vec(UserId),
    'subject' : IDL.Text,
    'latest_message_index' : IDL.Nat32,
    'last_updated' : TimestampMillis,
    'display_date' : TimestampMillis,
    'last_read_by_them' : IDL.Nat32,
    'min_visible_message_index' : IDL.Nat32,
    'latest_message' : IDL.Opt(Message),
  });
  const DirectChatSummary = IDL.Record({
    'id' : ChatId,
    'last_read_by_us' : IDL.Nat32,
    'them' : UserId,
    'latest_message_index' : IDL.Nat32,
    'last_updated' : TimestampMillis,
    'display_date' : TimestampMillis,
    'last_read_by_them' : IDL.Nat32,
    'latest_message' : IDL.Opt(Message),
  });
  const ChatSummary = IDL.Variant({
    'Group' : GroupChatSummary,
    'Direct' : DirectChatSummary,
  });
  const GetChatsResponse = IDL.Variant({
    'Success' : IDL.Record({
      'chats' : IDL.Vec(ChatSummary),
      'timestamp' : TimestampMillis,
    }),
  });
  const GetChunkArgs = IDL.Record({ 'blob_id' : IDL.Nat, 'index' : IDL.Nat32 });
  const GetChunkResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Record({ 'bytes' : IDL.Vec(IDL.Nat8) }),
  });
  const GetMessagesArgs = IDL.Record({
    'user_id' : UserId,
    'to_index' : IDL.Nat32,
    'from_index' : IDL.Nat32,
  });
  const GetMessagesSuccess = IDL.Record({
    'messages' : IDL.Vec(Message),
    'latest_message_index' : IDL.Nat32,
  });
  const GetMessagesResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : GetMessagesSuccess,
  });
  const GetMessagesByIndexArgs = IDL.Record({
    'messages' : IDL.Vec(IDL.Nat32),
    'user_id' : UserId,
  });
  const GetMessagesByIndexResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : GetMessagesSuccess,
  });
  const GroupId = CanisterId;
  const HandleAddedToGroupArgs = IDL.Record({
    'added_by' : UserId,
    'group_id' : GroupId,
  });
  const HandleAddedToGroupResponse = IDL.Variant({
    'Blocked' : IDL.Null,
    'Success' : IDL.Null,
  });
  const HandleInvitedToGroupArgs = IDL.Record({
    'group_id' : GroupId,
    'invited_by' : UserId,
  });
  const HandleInvitedToGroupResponse = IDL.Variant({ 'Success' : IDL.Null });
  const HandleJoinedGroupArgs = IDL.Record({
    'user_principal' : IDL.Principal,
    'group_id' : GroupId,
  });
  const HandleJoinedGroupResponse = IDL.Variant({
    'Success' : IDL.Null,
    'Unauthorized' : IDL.Null,
  });
  const HandleLeftGroupArgs = IDL.Record({
    'user_principal' : IDL.Principal,
    'group_id' : GroupId,
  });
  const HandleLeftGroupResponse = IDL.Variant({
    'Success' : IDL.Null,
    'Unauthorized' : IDL.Null,
  });
  const HandleMessageArgs = IDL.Record({
    'content' : MessageContent,
    'sender' : UserId,
    'replies_to' : IDL.Opt(ReplyContext),
    'client_message_id' : IDL.Text,
  });
  const HandleMessageResponse = IDL.Variant({
    'Out' : IDL.Null,
    'Success' : IDL.Null,
    'SenderBlocked' : IDL.Null,
  });
  const HandleRemovedFromGroupArgs = IDL.Record({ 'group_id' : GroupId });
  const MarkReadArgs = IDL.Record({
    'up_to_message_index' : IDL.Nat32,
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
          'message' : Message,
        })
      ),
    }),
    'Failure' : IDL.Null,
  });
  const SendMessageArgs = IDL.Record({
    'content' : MessageContent,
    'recipient' : UserId,
    'message_id' : IDL.Text,
    'replies_to' : IDL.Opt(ReplyContext),
  });
  const SendMessageResponse = IDL.Variant({
    'BalanceExceeded' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'chat_summary' : ChatSummary,
      'message_index' : IDL.Nat32,
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
  return IDL.Service({
    'block_user' : IDL.Func([BlockUserArgs], [], []),
    'create_group' : IDL.Func([CreateGroupArgs], [CreateGroupResponse], []),
    'get_chats' : IDL.Func([GetChatsArgs], [GetChatsResponse], ['query']),
    'get_chunk' : IDL.Func([GetChunkArgs], [GetChunkResponse], ['query']),
    'get_messages' : IDL.Func(
        [GetMessagesArgs],
        [GetMessagesResponse],
        ['query'],
      ),
    'get_messages_by_index' : IDL.Func(
        [GetMessagesByIndexArgs],
        [GetMessagesByIndexResponse],
        ['query'],
      ),
    'handle_added_to_group' : IDL.Func(
        [HandleAddedToGroupArgs],
        [HandleAddedToGroupResponse],
        [],
      ),
    'handle_invited_to_group' : IDL.Func(
        [HandleInvitedToGroupArgs],
        [HandleInvitedToGroupResponse],
        [],
      ),
    'handle_joined_group' : IDL.Func(
        [HandleJoinedGroupArgs],
        [HandleJoinedGroupResponse],
        [],
      ),
    'handle_left_group' : IDL.Func(
        [HandleLeftGroupArgs],
        [HandleLeftGroupResponse],
        [],
      ),
    'handle_message_received' : IDL.Func(
        [HandleMessageArgs],
        [HandleMessageResponse],
        [],
      ),
    'handle_removed_from_group' : IDL.Func(
        [HandleRemovedFromGroupArgs],
        [],
        [],
      ),
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
  });
};
export const init = ({ IDL }) => { return []; };
