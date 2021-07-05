export default ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const BlockUserRequest = IDL.Record({ 'user_id' : UserId });
  const CreateGroupRequest = IDL.Record({
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
  const Timestamp = IDL.Nat64;
  const GetChatsRequest = IDL.Record({
    'message_count_for_top_chat' : IDL.Opt(IDL.Nat16),
    'updated_since' : IDL.Opt(Timestamp),
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
  const ReplyContext = IDL.Record({
    'content' : MessageContent,
    'user_id' : UserId,
    'message_id' : IDL.Nat32,
  });
  const Message = IDL.Record({
    'id' : IDL.Nat32,
    'content' : MessageContent,
    'sender' : UserId,
    'timestamp' : Timestamp,
    'replies_to' : IDL.Opt(ReplyContext),
    'client_message_id' : IDL.Text,
  });
  const ChatSummary = IDL.Record({
    'them' : UserId,
    'last_updated' : Timestamp,
    'display_date' : Timestamp,
    'unread_by_them_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
    'latest_messages' : IDL.Vec(Message),
    'unread_by_me_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
  });
  const GetChatsResponse = IDL.Variant({
    'Success' : IDL.Record({ 'chats' : IDL.Vec(ChatSummary) }),
  });
  const GetChunkRequest = IDL.Record({
    'blob_id' : IDL.Nat,
    'index' : IDL.Nat32,
  });
  const GetChunkResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Record({ 'bytes' : IDL.Vec(IDL.Nat8) }),
  });
  const GetMessagesRequest = IDL.Record({
    'user_id' : UserId,
    'to_index' : IDL.Nat32,
    'from_index' : IDL.Nat32,
  });
  const GetMessagesSuccess = IDL.Record({
    'messages' : IDL.Vec(Message),
    'latest_message_id' : IDL.Nat32,
  });
  const GetMessagesResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : GetMessagesSuccess,
  });
  const GetMessagesByIndexRequest = IDL.Record({
    'messages' : IDL.Vec(IDL.Nat32),
    'user_id' : UserId,
  });
  const GetMessagesByIndexResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : GetMessagesSuccess,
  });
  const GroupId = CanisterId;
  const HandleAddedToGroupRequest = IDL.Record({
    'added_by' : UserId,
    'group_id' : GroupId,
  });
  const HandleAddedToGroupResponse = IDL.Variant({
    'Blocked' : IDL.Null,
    'Success' : IDL.Null,
  });
  const HandleInvitedToGroupRequest = IDL.Record({
    'group_id' : GroupId,
    'invited_by' : UserId,
  });
  const HandleInvitedToGroupResponse = IDL.Variant({ 'Success' : IDL.Null });
  const HandleJoinedGroupRequest = IDL.Record({
    'user_principal' : IDL.Principal,
    'group_id' : GroupId,
  });
  const HandleJoinedGroupResponse = IDL.Variant({
    'Success' : IDL.Null,
    'Unauthorized' : IDL.Null,
  });
  const HandleLeftGroupRequest = IDL.Record({
    'user_principal' : IDL.Principal,
    'group_id' : GroupId,
  });
  const HandleLeftGroupResponse = IDL.Variant({
    'Success' : IDL.Null,
    'Unauthorized' : IDL.Null,
  });
  const HandleMessageRequest = IDL.Record({
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
  const HandleRemovedFromGroupRequest = IDL.Record({ 'group_id' : GroupId });
  const MarkReadRequest = IDL.Record({
    'user_id' : UserId,
    'to_index' : IDL.Nat32,
    'from_index' : IDL.Nat32,
  });
  const MarkReadResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : IDL.Record({
      'unread_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
    }),
  });
  const Metrics = IDL.Record({
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
    'timestamp' : IDL.Nat64,
    'text_message_count' : IDL.Nat64,
    'wasm_memory_used' : IDL.Nat64,
    'video_message_count' : IDL.Nat64,
  });
  const PutChunkRequest = IDL.Record({
    'blob_id' : IDL.Nat,
    'bytes' : IDL.Vec(IDL.Nat8),
    'index' : IDL.Nat32,
  });
  const PutChunkResponse = IDL.Variant({
    'Full' : IDL.Null,
    'Success' : IDL.Null,
  });
  const SearchAllMessagesRequest = IDL.Record({
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
  const SendMessageRequest = IDL.Record({
    'content' : MessageContent,
    'recipient' : UserId,
    'replies_to' : IDL.Opt(ReplyContext),
    'client_message_id' : IDL.Text,
  });
  const SendMessageResponse = IDL.Variant({
    'BalanceExceeded' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : Timestamp,
      'chat_summary' : ChatSummary,
      'message_index' : IDL.Nat32,
    }),
    'RecipientBlocked' : IDL.Null,
    'InvalidRequest' : IDL.Null,
    'SenderBlocked' : IDL.Null,
    'MessageTooLong' : IDL.Nat32,
    'RecipientNotFound' : IDL.Null,
  });
  const SetAvatarRequest = IDL.Record({
    'mime_type' : IDL.Text,
    'bytes' : IDL.Vec(IDL.Nat8),
  });
  const SetAvatarResponse = IDL.Variant({
    'InvalidMimeType' : IDL.Nat32,
    'FileTooBig' : IDL.Nat32,
    'Success' : IDL.Null,
  });
  const UnblockUserRequest = IDL.Record({ 'user_id' : UserId });
  return IDL.Service({
    'block_user' : IDL.Func([BlockUserRequest], [], []),
    'create_group' : IDL.Func([CreateGroupRequest], [CreateGroupResponse], []),
    'get_chats' : IDL.Func([GetChatsRequest], [GetChatsResponse], ['query']),
    'get_chunk' : IDL.Func([GetChunkRequest], [GetChunkResponse], ['query']),
    'get_messages' : IDL.Func(
        [GetMessagesRequest],
        [GetMessagesResponse],
        ['query'],
      ),
    'get_messages_by_index' : IDL.Func(
        [GetMessagesByIndexRequest],
        [GetMessagesByIndexResponse],
        ['query'],
      ),
    'handle_added_to_group' : IDL.Func(
        [HandleAddedToGroupRequest],
        [HandleAddedToGroupResponse],
        [],
      ),
    'handle_invited_to_group' : IDL.Func(
        [HandleInvitedToGroupRequest],
        [HandleInvitedToGroupResponse],
        [],
      ),
    'handle_joined_group' : IDL.Func(
        [HandleJoinedGroupRequest],
        [HandleJoinedGroupResponse],
        [],
      ),
    'handle_left_group' : IDL.Func(
        [HandleLeftGroupRequest],
        [HandleLeftGroupResponse],
        [],
      ),
    'handle_message_received' : IDL.Func(
        [HandleMessageRequest],
        [HandleMessageResponse],
        [],
      ),
    'handle_removed_from_group' : IDL.Func(
        [HandleRemovedFromGroupRequest],
        [],
        [],
      ),
    'mark_read' : IDL.Func([MarkReadRequest], [MarkReadResponse], []),
    'metrics' : IDL.Func([], [Metrics], ['query']),
    'put_chunk' : IDL.Func([PutChunkRequest], [PutChunkResponse], []),
    'search_all_messages' : IDL.Func(
        [SearchAllMessagesRequest],
        [SearchAllMessagesResponse],
        ['query'],
      ),
    'send_message' : IDL.Func([SendMessageRequest], [SendMessageResponse], []),
    'set_avatar' : IDL.Func([SetAvatarRequest], [SetAvatarResponse], []),
    'unblock_user' : IDL.Func([UnblockUserRequest], [], []),
  });
};
export const init = ({ IDL }) => { return []; };
