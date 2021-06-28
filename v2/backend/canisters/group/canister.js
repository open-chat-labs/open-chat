export default ({ IDL }) => {
  const AddParticipantsRequest = IDL.Record({});
  const AddParticipantsResponse = IDL.Variant({ 'Success' : IDL.Null });
  const BlockUserRequest = IDL.Record({});
  const BlockUserResponse = IDL.Variant({ 'Success' : IDL.Null });
  const GetChunkRequest = IDL.Record({
    'blob_id' : IDL.Nat,
    'index' : IDL.Nat32,
  });
  const GetChunkResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Record({ 'bytes' : IDL.Vec(IDL.Nat8) }),
  });
  const GetGroupRequest = IDL.Record({});
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const Timestamp = IDL.Nat64;
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
  const MessageContent = IDL.Variant({
    'File' : FileContent,
    'Text' : TextContent,
    'Media' : MediaContent,
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
  const GetGroupResponse = IDL.Variant({
    'Success' : IDL.Record({
      'participants' : IDL.Vec(UserId),
      'subject' : IDL.Text,
      'last_updated' : Timestamp,
      'display_date' : Timestamp,
      'min_visible_message_id' : IDL.Nat32,
      'latest_messages' : IDL.Vec(Message),
      'unread_by_me_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
      'unread_by_any_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
    }),
  });
  const GetMessagesRequest = IDL.Record({
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
  });
  const GetMessagesByIndexResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : GetMessagesSuccess,
  });
  const InviteUsersRequest = IDL.Record({});
  const InviteUsersResponse = IDL.Variant({ 'Success' : IDL.Null });
  const JoinGroupRequest = IDL.Record({});
  const JoinGroupResponse = IDL.Variant({ 'Success' : IDL.Null });
  const LeaveGroupRequest = IDL.Record({});
  const LeaveGroupResponse = IDL.Variant({ 'Success' : IDL.Null });
  const MakeAdminRequest = IDL.Record({});
  const MakeAdminResponse = IDL.Variant({ 'Success' : IDL.Null });
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
    'image_message_count' : IDL.Nat64,
    'caller_id' : IDL.Principal,
    'chunk_count' : IDL.Nat32,
    'bytes_used' : IDL.Nat64,
    'file_message_count' : IDL.Nat64,
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
  const RemoveAdminRequest = IDL.Record({});
  const RemoveAdminResponse = IDL.Variant({ 'Success' : IDL.Null });
  const RemoveParticipantsRequest = IDL.Record({});
  const RemoveParticipantsResponse = IDL.Variant({ 'Success' : IDL.Null });
  const SearchMessagesRequest = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const SearchMessagesResponse = IDL.Variant({
    'Success' : IDL.Record({
      'matches' : IDL.Vec(
        IDL.Record({ 'score' : IDL.Nat32, 'message' : Message })
      ),
    }),
    'Failure' : IDL.Null,
  });
  const SendMessageRequest = IDL.Record({
    'content' : MessageContent,
    'replies_to' : IDL.Opt(ReplyContext),
    'client_message_id' : IDL.Text,
  });
  const SendMessageResponse = IDL.Variant({
    'BalanceExceeded' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : Timestamp,
      'chat_summary' : IDL.Record({
        'last_updated' : Timestamp,
        'display_date' : Timestamp,
        'min_visible_message_id' : IDL.Nat32,
        'unread_by_me_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
        'unread_by_any_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
      }),
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
  const UnblockUserRequest = IDL.Record({});
  const UnblockUserResponse = IDL.Variant({ 'Success' : IDL.Null });
  return IDL.Service({
    'add_participants' : IDL.Func(
        [AddParticipantsRequest],
        [AddParticipantsResponse],
        [],
      ),
    'block_user' : IDL.Func([BlockUserRequest], [BlockUserResponse], []),
    'get_chunk' : IDL.Func([GetChunkRequest], [GetChunkResponse], ['query']),
    'get_group' : IDL.Func([GetGroupRequest], [GetGroupResponse], ['query']),
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
    'invite_users' : IDL.Func([InviteUsersRequest], [InviteUsersResponse], []),
    'join_group' : IDL.Func([JoinGroupRequest], [JoinGroupResponse], []),
    'leave_group' : IDL.Func([LeaveGroupRequest], [LeaveGroupResponse], []),
    'make_admin' : IDL.Func([MakeAdminRequest], [MakeAdminResponse], []),
    'mark_read' : IDL.Func([MarkReadRequest], [MarkReadResponse], []),
    'metrics' : IDL.Func([], [Metrics], ['query']),
    'put_chunk' : IDL.Func([PutChunkRequest], [PutChunkResponse], []),
    'remove_admin' : IDL.Func([RemoveAdminRequest], [RemoveAdminResponse], []),
    'remove_participants' : IDL.Func(
        [RemoveParticipantsRequest],
        [RemoveParticipantsResponse],
        [],
      ),
    'search_messages' : IDL.Func(
        [SearchMessagesRequest],
        [SearchMessagesResponse],
        ['query'],
      ),
    'send_message' : IDL.Func([SendMessageRequest], [SendMessageResponse], []),
    'set_avatar' : IDL.Func([SetAvatarRequest], [SetAvatarResponse], []),
    'unblock_user' : IDL.Func([UnblockUserRequest], [UnblockUserResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
