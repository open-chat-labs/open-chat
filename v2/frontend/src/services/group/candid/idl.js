export const idlFactory = ({ IDL }) => {
  const AddParticipantsArgs = IDL.Record({});
  const AddParticipantsResponse = IDL.Variant({ 'Success' : IDL.Null });
  const BlockUserArgs = IDL.Record({});
  const BlockUserResponse = IDL.Variant({ 'Success' : IDL.Null });
  const GetChunkArgs = IDL.Record({ 'blob_id' : IDL.Nat, 'index' : IDL.Nat32 });
  const GetChunkResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Record({ 'bytes' : IDL.Vec(IDL.Nat8) }),
  });
  const GetGroupArgs = IDL.Record({});
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const TimestampMillis = IDL.Nat64;
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
  const MessageId = IDL.Nat;
  const MessageIndex = IDL.Nat32;
  const ReplyContext = IDL.Record({
    'content' : MessageContent,
    'user_id' : UserId,
    'message_id' : MessageId,
    'message_index' : MessageIndex,
  });
  const Message = IDL.Record({
    'content' : MessageContent,
    'sender' : UserId,
    'timestamp' : TimestampMillis,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(ReplyContext),
    'message_index' : MessageIndex,
  });
  const GetGroupResponse = IDL.Variant({
    'Success' : IDL.Record({
      'participants' : IDL.Vec(UserId),
      'subject' : IDL.Text,
      'last_updated' : TimestampMillis,
      'display_date' : TimestampMillis,
      'latest_messages' : IDL.Vec(Message),
      'min_visible_message_index' : MessageIndex,
      'unread_by_me_message_id_ranges' : IDL.Vec(IDL.Vec(MessageIndex)),
      'unread_by_any_message_id_ranges' : IDL.Vec(IDL.Vec(MessageIndex)),
    }),
  });
  const GetMessagesArgs = IDL.Record({
    'to_index' : MessageIndex,
    'from_index' : MessageIndex,
  });
  const GetMessagesSuccess = IDL.Record({
    'messages' : IDL.Vec(Message),
    'latest_message_index' : MessageIndex,
  });
  const GetMessagesResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : GetMessagesSuccess,
  });
  const GetMessagesByIndexArgs = IDL.Record({
    'messages' : IDL.Vec(MessageIndex),
  });
  const GetMessagesByIndexResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : GetMessagesSuccess,
  });
  const InviteUsersArgs = IDL.Record({});
  const InviteUsersResponse = IDL.Variant({ 'Success' : IDL.Null });
  const JoinGroupArgs = IDL.Record({});
  const JoinGroupResponse = IDL.Variant({ 'Success' : IDL.Null });
  const LeaveGroupArgs = IDL.Record({});
  const LeaveGroupResponse = IDL.Variant({ 'Success' : IDL.Null });
  const MakeAdminArgs = IDL.Record({});
  const MakeAdminResponse = IDL.Variant({ 'Success' : IDL.Null });
  const MarkReadArgs = IDL.Record({ 'up_to_message_index' : MessageIndex });
  const MarkReadResponse = IDL.Variant({
    'SuccessNoChange' : IDL.Null,
    'Success' : IDL.Null,
    'NotInGroup' : IDL.Null,
  });
  const MetricsArgs = IDL.Record({});
  const MetricsResponse = IDL.Record({
    'blob_bytes_used' : IDL.Nat64,
    'cycles_balance' : IDL.Int64,
    'image_message_count' : IDL.Nat64,
    'caller_id' : IDL.Principal,
    'chunk_count' : IDL.Nat32,
    'bytes_used' : IDL.Nat64,
    'file_message_count' : IDL.Nat64,
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
  const RemoveAdminArgs = IDL.Record({});
  const RemoveAdminResponse = IDL.Variant({ 'Success' : IDL.Null });
  const RemoveParticipantsArgs = IDL.Record({});
  const RemoveParticipantsResponse = IDL.Variant({ 'Success' : IDL.Null });
  const SearchMessagesArgs = IDL.Record({
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
  const ReplyContextArgs = IDL.Record({ 'message_id' : MessageId });
  const SendMessageArgs = IDL.Record({
    'content' : MessageContent,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(ReplyContextArgs),
  });
  const SendMessageResponse = IDL.Variant({
    'BalanceExceeded' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'chat_summary' : IDL.Record({
        'last_updated' : TimestampMillis,
        'display_date' : TimestampMillis,
        'min_visible_message_index' : MessageIndex,
        'unread_by_me_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
        'unread_by_any_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
      }),
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
  const UnblockUserArgs = IDL.Record({});
  const UnblockUserResponse = IDL.Variant({ 'Success' : IDL.Null });
  return IDL.Service({
    'add_participants' : IDL.Func(
        [AddParticipantsArgs],
        [AddParticipantsResponse],
        [],
      ),
    'block_user' : IDL.Func([BlockUserArgs], [BlockUserResponse], []),
    'get_chunk' : IDL.Func([GetChunkArgs], [GetChunkResponse], ['query']),
    'get_group' : IDL.Func([GetGroupArgs], [GetGroupResponse], ['query']),
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
    'invite_users' : IDL.Func([InviteUsersArgs], [InviteUsersResponse], []),
    'join_group' : IDL.Func([JoinGroupArgs], [JoinGroupResponse], []),
    'leave_group' : IDL.Func([LeaveGroupArgs], [LeaveGroupResponse], []),
    'make_admin' : IDL.Func([MakeAdminArgs], [MakeAdminResponse], []),
    'mark_read' : IDL.Func([MarkReadArgs], [MarkReadResponse], []),
    'metrics' : IDL.Func([MetricsArgs], [MetricsResponse], ['query']),
    'put_chunk' : IDL.Func([PutChunkArgs], [PutChunkResponse], []),
    'remove_admin' : IDL.Func([RemoveAdminArgs], [RemoveAdminResponse], []),
    'remove_participants' : IDL.Func(
        [RemoveParticipantsArgs],
        [RemoveParticipantsResponse],
        [],
      ),
    'search_messages' : IDL.Func(
        [SearchMessagesArgs],
        [SearchMessagesResponse],
        ['query'],
      ),
    'send_message' : IDL.Func([SendMessageArgs], [SendMessageResponse], []),
    'set_avatar' : IDL.Func([SetAvatarArgs], [SetAvatarResponse], []),
    'unblock_user' : IDL.Func([UnblockUserArgs], [UnblockUserResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
