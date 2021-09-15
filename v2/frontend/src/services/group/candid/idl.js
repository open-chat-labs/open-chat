export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const AddParticipantsArgs = IDL.Record({ 'user_ids' : IDL.Vec(UserId) });
  const AddParticipantsFailedResult = IDL.Record({
    'errors' : IDL.Vec(UserId),
    'users_blocked_from_group' : IDL.Vec(UserId),
    'users_who_blocked_request' : IDL.Vec(UserId),
    'users_already_in_group' : IDL.Vec(UserId),
  });
  const AddParticipantsPartialSuccessResult = IDL.Record({
    'errors' : IDL.Vec(UserId),
    'users_blocked_from_group' : IDL.Vec(UserId),
    'users_added' : IDL.Vec(UserId),
    'users_who_blocked_request' : IDL.Vec(UserId),
    'users_already_in_group' : IDL.Vec(UserId),
  });
  const AddParticipantsResponse = IDL.Variant({
    'Failed' : AddParticipantsFailedResult,
    'PartialSuccess' : AddParticipantsPartialSuccessResult,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'NotInGroup' : IDL.Null,
  });
  const BlockUserArgs = IDL.Record({ 'user_id' : UserId });
  const BlockUserResponse = IDL.Variant({
    'GroupNotPublic' : IDL.Null,
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
    'CannotBlockSelf' : IDL.Null,
  });
  const EventIndex = IDL.Nat32;
  const EventsArgs = IDL.Record({
    'to_index' : EventIndex,
    'from_index' : EventIndex,
  });
  const ParticipantJoined = IDL.Record({ 'user_id' : UserId });
  const GroupDescriptionChanged = IDL.Record({
    'new_description' : IDL.Opt(IDL.Text),
    'previous_description' : IDL.Opt(IDL.Text),
    'changed_by' : UserId,
  });
  const GroupChatCreated = IDL.Record({
    'name' : IDL.Text,
    'description' : IDL.Text,
    'created_by' : UserId,
  });
  const ParticipantsPromotedToAdmin = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'promoted_by' : UserId,
  });
  const ParticipantsRemoved = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'removed_by' : UserId,
  });
  const BlobReference = IDL.Record({
    'blob_size' : IDL.Nat32,
    'blob_id' : IDL.Nat,
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
  const MessageId = IDL.Nat;
  const GroupReplyContext = IDL.Record({
    'content' : MessageContent,
    'user_id' : UserId,
    'event_index' : EventIndex,
  });
  const MessageIndex = IDL.Nat32;
  const GroupMessage = IDL.Record({
    'content' : MessageContent,
    'sender' : UserId,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(GroupReplyContext),
    'message_index' : MessageIndex,
  });
  const ParticipantsDismissedAsAdmin = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'dismissed_by' : UserId,
  });
  const ParticipantLeft = IDL.Record({ 'user_id' : UserId });
  const GroupNameChanged = IDL.Record({
    'changed_by' : UserId,
    'new_name' : IDL.Text,
    'previous_name' : IDL.Text,
  });
  const ParticipantsAdded = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'added_by' : UserId,
  });
  const GroupChatEvent = IDL.Variant({
    'ParticipantJoined' : ParticipantJoined,
    'GroupDescriptionChanged' : GroupDescriptionChanged,
    'GroupChatCreated' : GroupChatCreated,
    'ParticipantsPromotedToAdmin' : ParticipantsPromotedToAdmin,
    'ParticipantsRemoved' : ParticipantsRemoved,
    'Message' : GroupMessage,
    'ParticipantsDismissedAsAdmin' : ParticipantsDismissedAsAdmin,
    'ParticipantLeft' : ParticipantLeft,
    'GroupNameChanged' : GroupNameChanged,
    'ParticipantsAdded' : ParticipantsAdded,
  });
  const TimestampMillis = IDL.Nat64;
  const GroupChatEventWrapper = IDL.Record({
    'event' : GroupChatEvent,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
  });
  const EventsSuccessResult = IDL.Record({
    'events' : IDL.Vec(GroupChatEventWrapper),
    'latest_event_index' : EventIndex,
  });
  const EventsResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : EventsSuccessResult,
  });
  const EventsByIndexArgs = IDL.Record({
    'events' : IDL.Vec(GroupChatEventWrapper),
  });
  const EventsByIndexResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'Success' : EventsSuccessResult,
  });
  const MakeAdminArgs = IDL.Record({ 'user_id' : UserId });
  const MakeAdminResponse = IDL.Variant({
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const MessageIndexRange = IDL.Record({
    'to' : MessageIndex,
    'from' : MessageIndex,
  });
  const MarkReadArgs = IDL.Record({
    'message_ranges' : IDL.Vec(MessageIndexRange),
  });
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
    'ChunkAlreadyExists' : IDL.Null,
    'Full' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'BlobAlreadyExists' : IDL.Null,
    'Success' : IDL.Null,
    'ChunkTooBig' : IDL.Null,
  });
  const PutFirstChunkArgs = IDL.Record({
    'total_chunks' : IDL.Nat32,
    'blob_id' : IDL.Nat,
    'mime_type' : IDL.Text,
    'bytes' : IDL.Vec(IDL.Nat8),
  });
  const RemoveAdminArgs = IDL.Record({ 'user_id' : UserId });
  const RemoveAdminResponse = IDL.Variant({
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const RemoveParticipantArgs = IDL.Record({ 'user_id' : UserId });
  const RemoveParticipantResponse = IDL.Variant({
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'CannotRemoveSelf' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const SearchMessagesArgs = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const GroupMessageMatch = IDL.Record({
    'content' : MessageContent,
    'sender' : UserId,
    'score' : IDL.Nat32,
    'event_index' : EventIndex,
  });
  const SearchMessagesSuccessResult = IDL.Record({
    'matches' : IDL.Vec(GroupMessageMatch),
  });
  const SearchMessagesResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'Success' : SearchMessagesSuccessResult,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
    'NotInGroup' : IDL.Null,
  });
  const ReplyContextArgs = IDL.Record({ 'message_id' : MessageId });
  const SendMessageArgs = IDL.Record({
    'content' : MessageContent,
    'sender_name' : IDL.Text,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(ReplyContextArgs),
  });
  const SendMessageResponse = IDL.Variant({
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'message_index' : MessageIndex,
    }),
    'NotInGroup' : IDL.Null,
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
  const SummaryArgs = IDL.Record({});
  const Role = IDL.Variant({ 'Participant' : IDL.Null, 'Admin' : IDL.Null });
  const Participant = IDL.Record({
    'role' : Role,
    'user_id' : UserId,
    'date_added' : TimestampMillis,
  });
  const ChatId = CanisterId;
  const GroupMessageEventWrapper = IDL.Record({
    'event' : GroupMessage,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
  });
  const GroupChatSummary = IDL.Record({
    'is_public' : IDL.Bool,
    'participants' : IDL.Vec(Participant),
    'min_visible_event_index' : EventIndex,
    'name' : IDL.Text,
    'description' : IDL.Text,
    'last_updated' : TimestampMillis,
    'read_by_me' : IDL.Vec(MessageIndexRange),
    'joined' : TimestampMillis,
    'latest_event_index' : EventIndex,
    'min_visible_message_index' : MessageIndex,
    'chat_id' : ChatId,
    'latest_message' : IDL.Opt(GroupMessageEventWrapper),
  });
  const SummaryResponse = IDL.Variant({
    'Success' : GroupChatSummary,
    'SuccessNoUpdates' : IDL.Null,
    'NotInGroup' : IDL.Null,
  });
  const SummaryUpdatesArgs = IDL.Record({ 'updates_since' : TimestampMillis });
  const GroupChatSummaryUpdates = IDL.Record({
    'participants_added_or_updated' : IDL.Vec(Participant),
    'participants_removed' : IDL.Vec(UserId),
    'name' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'last_updated' : TimestampMillis,
    'read_by_me' : IDL.Opt(IDL.Vec(MessageIndexRange)),
    'latest_event_index' : IDL.Opt(EventIndex),
    'chat_id' : ChatId,
    'latest_message' : IDL.Opt(GroupMessageEventWrapper),
  });
  const SummaryUpdatesSuccess = IDL.Record({
    'updates' : GroupChatSummaryUpdates,
  });
  const SummaryUpdatesResponse = IDL.Variant({
    'Success' : SummaryUpdatesSuccess,
    'SuccessNoUpdates' : IDL.Null,
    'NotInGroup' : IDL.Null,
  });
  const UnblockUserArgs = IDL.Record({ 'user_id' : UserId });
  const UnblockUserResponse = IDL.Variant({
    'GroupNotPublic' : IDL.Null,
    'CannotUnblockSelf' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  return IDL.Service({
    'add_participants' : IDL.Func(
        [AddParticipantsArgs],
        [AddParticipantsResponse],
        [],
      ),
    'block_user' : IDL.Func([BlockUserArgs], [BlockUserResponse], []),
    'events' : IDL.Func([EventsArgs], [EventsResponse], ['query']),
    'events_by_index' : IDL.Func(
        [EventsByIndexArgs],
        [EventsByIndexResponse],
        ['query'],
      ),
    'make_admin' : IDL.Func([MakeAdminArgs], [MakeAdminResponse], []),
    'mark_read' : IDL.Func([MarkReadArgs], [MarkReadResponse], []),
    'metrics' : IDL.Func([MetricsArgs], [MetricsResponse], ['query']),
    'put_chunk' : IDL.Func([PutChunkArgs], [PutChunkResponse], []),
    'put_first_chunk' : IDL.Func([PutFirstChunkArgs], [PutChunkResponse], []),
    'remove_admin' : IDL.Func([RemoveAdminArgs], [RemoveAdminResponse], []),
    'remove_participant' : IDL.Func(
        [RemoveParticipantArgs],
        [RemoveParticipantResponse],
        [],
      ),
    'search_messages' : IDL.Func(
        [SearchMessagesArgs],
        [SearchMessagesResponse],
        ['query'],
      ),
    'send_message' : IDL.Func([SendMessageArgs], [SendMessageResponse], []),
    'set_avatar' : IDL.Func([SetAvatarArgs], [SetAvatarResponse], []),
    'summary' : IDL.Func([SummaryArgs], [SummaryResponse], ['query']),
    'summary_updates' : IDL.Func(
        [SummaryUpdatesArgs],
        [SummaryUpdatesResponse],
        ['query'],
      ),
    'unblock_user' : IDL.Func([UnblockUserArgs], [UnblockUserResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
