export const idlFactory = ({ IDL }) => {
  const ChatId = IDL.Nat;
  const UserId = IDL.Principal;
  const AddParticipantsResponse = IDL.Variant({
    'PartialSuccess' : IDL.Record({
      'count_added' : IDL.Nat32,
      'blocked' : IDL.Vec(UserId),
    }),
    'ChatNotFound' : IDL.Null,
    'NotGroupChat' : IDL.Null,
    'Success' : IDL.Nat32,
    'Unauthorized' : IDL.Null,
  });
  const CreateGroupChatRequest = IDL.Record({
    'participants' : IDL.Vec(UserId),
    'subject' : IDL.Text,
    'chat_history_visible_to_new_joiners' : IDL.Bool,
    'chat_id' : ChatId,
  });
  const Timestamp = IDL.Nat64;
  const FileContent = IDL.Record({
    'blob_size' : IDL.Nat32,
    'blob_id' : IDL.Text,
    'name' : IDL.Text,
    'mime_type' : IDL.Text,
    'caption' : IDL.Opt(IDL.Text),
    'chunk_size' : IDL.Nat32,
    'blob_deleted' : IDL.Bool,
  });
  const TextContent = IDL.Record({ 'text' : IDL.Text });
  const MediaContent = IDL.Record({
    'height' : IDL.Nat32,
    'blob_size' : IDL.Nat32,
    'blob_id' : IDL.Text,
    'mime_type' : IDL.Text,
    'thumbnail_data' : IDL.Text,
    'caption' : IDL.Opt(IDL.Text),
    'width' : IDL.Nat32,
    'chunk_size' : IDL.Nat32,
    'blob_deleted' : IDL.Bool,
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
    'chat_id' : ChatId,
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
  const GroupChatSummary = IDL.Record({
    'id' : ChatId,
    'participants' : IDL.Vec(UserId),
    'subject' : IDL.Text,
    'last_updated' : Timestamp,
    'display_date' : Timestamp,
    'min_visible_message_id' : IDL.Nat32,
    'latest_messages' : IDL.Vec(Message),
    'unread_by_me_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
    'unread_by_any_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
    'muted': IDL.Bool,
  });
  const CreateGroupChatResponse = IDL.Variant({
    'SubjectTooLong' : IDL.Nat8,
    'SubjectTooShort' : IDL.Nat8,
    'TooManyParticipants' : IDL.Nat8,
    'ChatAlreadyExists' : IDL.Null,
    'Success' : GroupChatSummary,
  });
  const DeleteGroupResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'NotGroupChat' : IDL.Null,
    'Success' : IDL.Null,
    'Unauthorized' : IDL.Null,
    'OnlyLastAdminCanDelete' : IDL.Null,
  });
  const GetChatsRequest = IDL.Record({
    'message_count_for_top_chat' : IDL.Opt(IDL.Nat16),
    'updated_since' : IDL.Opt(Timestamp),
  });
  const DirectChatSummary = IDL.Record({
    'id' : ChatId,
    'them' : UserId,
    'last_updated' : Timestamp,
    'display_date' : Timestamp,
    'unread_by_them_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
    'latest_messages' : IDL.Vec(Message),
    'unread_by_me_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
    'muted': IDL.Bool,
  });
  const ChatSummary = IDL.Variant({
    'Group' : GroupChatSummary,
    'Direct' : DirectChatSummary,
  });
  const GetChatsResponse = IDL.Variant({ 'Success' : IDL.Vec(ChatSummary) });
  const GetMessagesResult = IDL.Record({
    'messages' : IDL.Vec(Message),
    'latest_message_id' : IDL.Nat32,
  });
  const GetMessagesResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : GetMessagesResult,
  });
  const GetMessagesByIdResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : GetMessagesResult,
  });
  const GetUpdatesRequest = IDL.Record({
    'message_count_for_top_chat' : IDL.Opt(IDL.Nat16),
    'updated_since' : IDL.Opt(Timestamp),
  });
  const GetUpdatesResult = IDL.Record({
    'chats' : IDL.Vec(ChatSummary),
    'blocked_users' : IDL.Vec(UserId),
  });
  const GetUpdatesResponse = IDL.Variant({ 'Success' : GetUpdatesResult });
  const JoinGroupResponse = IDL.Variant({
    'AlreadyInGroup' : IDL.Null,
    'UserLimitReached' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'NotGroupChat' : IDL.Null,
    'Success' : IDL.Null,
  });
  const LeaveGroupResponse = IDL.Variant({
    'ParticipantNotFound' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'NotGroupChat' : IDL.Null,
    'Success' : IDL.Null,
    'LastAdminCannotLeave' : IDL.Null,
  });
  const MarkReadResult = IDL.Record({
    'unread_message_id_ranges' : IDL.Vec(IDL.Vec(IDL.Nat32)),
  });
  const MarkReadResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : MarkReadResult,
  });
  const RemoveParticipantResponse = IDL.Variant({
    'CannotRemoveSelfFromChat' : IDL.Null,
    'ParticipantNotFound' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'NotGroupChat' : IDL.Null,
    'Success' : IDL.Null,
    'Unauthorized' : IDL.Null,
  });
  const SearchMessagesMatch = IDL.Record({
    'message' : Message,
    'chat_id' : ChatId,
  });
  const SearchAllMessagesResult = IDL.Record({
    'matches' : IDL.Vec(SearchMessagesMatch),
  });
  const SearchAllMessagesResponse = IDL.Variant({
    'Success' : SearchAllMessagesResult,
  });
  const SendDirectMessageRequest = IDL.Record({
    'content' : MessageContent,
    'recipient' : UserId,
    'sender_name' : IDL.Opt(IDL.Text),
    'replies_to' : IDL.Opt(ReplyContext),
    'client_message_id' : IDL.Text,
  });
  const SendDirectMessageResult = IDL.Record({
    'timestamp' : Timestamp,
    'message_id' : IDL.Nat32,
    'chat_summary' : DirectChatSummary,
  });
  const SendDirectMessageResponse = IDL.Variant({
    'BalanceExceeded' : IDL.Null,
    'Success' : SendDirectMessageResult,
    'RecipientBlocked' : IDL.Null,
    'InvalidRequest' : IDL.Null,
    'SenderBlocked' : IDL.Null,
    'MessageTooLong' : IDL.Nat32,
    'UserNotFound' : IDL.Null,
    'RecipientNotFound' : IDL.Null,
  });
  const SendMessageRequest = IDL.Record({
    'content' : MessageContent,
    'sender_name' : IDL.Opt(IDL.Text),
    'chat_id' : ChatId,
    'replies_to' : IDL.Opt(ReplyContext),
    'client_message_id' : IDL.Text,
  });
  const SendMessageResult = IDL.Record({
    'timestamp' : Timestamp,
    'message_id' : IDL.Nat32,
    'chat_summary' : ChatSummary,
  });
  const SendMessageResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : SendMessageResult,
    'RecipientBlocked' : IDL.Null,
    'InvalidRequest' : IDL.Null,
    'SenderBlocked' : IDL.Null,
    'MessageTooLong' : IDL.Nat32,
  });
  const Stats = IDL.Record({
    'cycles_balance' : IDL.Int64,
    'chunk_bytes' : IDL.Nat64,
    'group_chat_count' : IDL.Nat32,
    'image_message_count' : IDL.Nat64,
    'memory_used' : IDL.Nat64,
    'user_id' : IDL.Principal,
    'direct_chat_count' : IDL.Nat32,
    'chunk_count' : IDL.Nat32,
    'file_message_count' : IDL.Nat64,
    'cycles_message_count' : IDL.Nat64,
    'timestamp' : IDL.Nat64,
    'text_message_count' : IDL.Nat64,
    'cycles_transferred' : IDL.Nat,
    'pruneable_message_count' : IDL.Nat32,
    'video_message_count' : IDL.Nat64,
  });
  return IDL.Service({
    'add_participants' : IDL.Func(
        [ChatId, IDL.Vec(UserId)],
        [AddParticipantsResponse],
        [],
      ),
    'block_user' : IDL.Func([UserId, IDL.Bool], [], []),
    'create_group_chat' : IDL.Func(
        [CreateGroupChatRequest],
        [CreateGroupChatResponse],
        [],
      ),
    'delete_group' : IDL.Func([ChatId], [DeleteGroupResponse], []),
    'get_chats' : IDL.Func([GetChatsRequest], [GetChatsResponse], ['query']),
    'get_chunk' : IDL.Func(
        [IDL.Text, IDL.Nat32],
        [IDL.Opt(IDL.Vec(IDL.Nat8))],
        ['query'],
      ),
    'get_messages' : IDL.Func(
        [ChatId, IDL.Nat32, IDL.Nat32],
        [GetMessagesResponse],
        ['query'],
      ),
    'get_messages_by_id' : IDL.Func(
        [ChatId, IDL.Vec(IDL.Nat32)],
        [GetMessagesByIdResponse],
        ['query'],
      ),
    'get_updates' : IDL.Func(
        [GetUpdatesRequest],
        [GetUpdatesResponse],
        ['query'],
      ),
    'join_group' : IDL.Func([ChatId], [JoinGroupResponse], []),
    'leave_group' : IDL.Func([ChatId], [LeaveGroupResponse], []),
    'mark_read' : IDL.Func(
        [ChatId, IDL.Nat32, IDL.Nat32],
        [MarkReadResponse],
        [],
      ),
    'put_chunk' : IDL.Func(
        [IDL.Text, IDL.Nat32, IDL.Vec(IDL.Nat8)],
        [IDL.Bool],
        [],
      ),
    'remove_participant' : IDL.Func(
        [ChatId, UserId],
        [RemoveParticipantResponse],
        [],
      ),
    'search_all_messages' : IDL.Func(
        [IDL.Text, IDL.Nat8],
        [SearchAllMessagesResponse],
        ['query'],
      ),
    'send_direct_message' : IDL.Func(
        [SendDirectMessageRequest],
        [SendDirectMessageResponse],
        [],
      ),
    'send_message' : IDL.Func([SendMessageRequest], [SendMessageResponse], []),
    'stats' : IDL.Func([], [Stats], ['query']),
    'toggle_notifications' : IDL.Func([ChatId, IDL.Bool], [], []),
  });
};
export const init = ({ IDL }) => { return []; };
