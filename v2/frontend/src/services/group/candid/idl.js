export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const AddParticipantsArgs = IDL.Record({
    'allow_blocked_users' : IDL.Bool,
    'user_ids' : IDL.Vec(UserId),
    'added_by_name' : IDL.Text,
  });
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
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'ParticipantLimitReached' : IDL.Nat32,
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
    'CannotBlockUser' : IDL.Null,
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
  const ChangeRoleArgs = IDL.Record({ 'user_id' : UserId, 'new_role' : Role });
  const ChangeRoleResponse = IDL.Variant({
    'Invalid' : IDL.Null,
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const DeleteGroupArgs = IDL.Record({});
  const DeleteGroupResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Null,
  });
  const MessageId = IDL.Nat;
  const DeleteMessagesArgs = IDL.Record({ 'message_ids' : IDL.Vec(MessageId) });
  const DeleteMessagesResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Null,
  });
  const DismissAdminArgs = IDL.Record({ 'user_id' : UserId });
  const DismissAdminResponse = IDL.Variant({
    'UserNotAdmin' : IDL.Null,
    'CannotDismissSelf' : IDL.Null,
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
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
    'message_id' : MessageId,
  });
  const EditMessageResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Null,
  });
  const EventIndex = IDL.Nat32;
  const EventsArgs = IDL.Record({
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
  const ParticipantJoined = IDL.Record({
    'user_id' : UserId,
    'as_super_admin' : IDL.Bool,
  });
  const ParticipantAssumesSuperAdmin = IDL.Record({ 'user_id' : UserId });
  const GroupDescriptionChanged = IDL.Record({
    'new_description' : IDL.Text,
    'previous_description' : IDL.Text,
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
  const MessageIndex = IDL.Nat32;
  const PinnedMessageUpdated = IDL.Record({
    'updated_by' : UserId,
    'new_value' : IDL.Opt(MessageIndex),
  });
  const UsersBlocked = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'blocked_by' : UserId,
  });
  const ParticipantsRemoved = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'removed_by' : UserId,
  });
  const ParticipantRelinquishesSuperAdmin = IDL.Record({ 'user_id' : UserId });
  const ChatId = CanisterId;
  const ReplyContext = IDL.Record({
    'chat_id_if_other' : IDL.Opt(ChatId),
    'event_index' : EventIndex,
  });
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
  const ParticipantsDismissedAsAdmin = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'dismissed_by' : UserId,
  });
  const UsersUnblocked = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'unblocked_by' : UserId,
  });
  const ParticipantLeft = IDL.Record({ 'user_id' : UserId });
  const ParticipantDismissedAsSuperAdmin = IDL.Record({ 'user_id' : UserId });
  const GroupNameChanged = IDL.Record({
    'changed_by' : UserId,
    'new_name' : IDL.Text,
    'previous_name' : IDL.Text,
  });
  const RoleChanged = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'changed_by' : UserId,
    'old_role' : Role,
    'new_role' : Role,
  });
  const OwnershipTransferred = IDL.Record({
    'old_owner' : UserId,
    'new_owner' : UserId,
  });
  const AvatarChanged = IDL.Record({
    'changed_by' : UserId,
    'previous_avatar' : IDL.Opt(IDL.Nat),
    'new_avatar' : IDL.Opt(IDL.Nat),
  });
  const ParticipantsAdded = IDL.Record({
    'user_ids' : IDL.Vec(UserId),
    'unblocked' : IDL.Vec(UserId),
    'added_by' : UserId,
  });
  const GroupChatEvent = IDL.Variant({
    'MessageReactionRemoved' : UpdatedMessage,
    'ParticipantJoined' : ParticipantJoined,
    'ParticipantAssumesSuperAdmin' : ParticipantAssumesSuperAdmin,
    'GroupDescriptionChanged' : GroupDescriptionChanged,
    'GroupChatCreated' : GroupChatCreated,
    'ParticipantsPromotedToAdmin' : ParticipantsPromotedToAdmin,
    'PinnedMessageUpdated' : PinnedMessageUpdated,
    'UsersBlocked' : UsersBlocked,
    'MessageReactionAdded' : UpdatedMessage,
    'ParticipantsRemoved' : ParticipantsRemoved,
    'ParticipantRelinquishesSuperAdmin' : ParticipantRelinquishesSuperAdmin,
    'Message' : Message,
    'ParticipantsDismissedAsAdmin' : ParticipantsDismissedAsAdmin,
    'UsersUnblocked' : UsersUnblocked,
    'ParticipantLeft' : ParticipantLeft,
    'MessageDeleted' : UpdatedMessage,
    'ParticipantDismissedAsSuperAdmin' : ParticipantDismissedAsSuperAdmin,
    'GroupNameChanged' : GroupNameChanged,
    'RoleChanged' : RoleChanged,
    'OwnershipTransferred' : OwnershipTransferred,
    'MessageEdited' : UpdatedMessage,
    'AvatarChanged' : AvatarChanged,
    'ParticipantsAdded' : ParticipantsAdded,
  });
  const GroupChatEventWrapper = IDL.Record({
    'event' : GroupChatEvent,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
  });
  const EventsSuccessResult = IDL.Record({
    'affected_events' : IDL.Vec(GroupChatEventWrapper),
    'events' : IDL.Vec(GroupChatEventWrapper),
    'latest_event_index' : IDL.Nat32,
  });
  const EventsResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : EventsSuccessResult,
  });
  const EventsByIndexArgs = IDL.Record({ 'events' : IDL.Vec(EventIndex) });
  const EventsRangeArgs = IDL.Record({
    'to_index' : EventIndex,
    'from_index' : EventIndex,
  });
  const EventsWindowArgs = IDL.Record({
    'mid_point' : MessageIndex,
    'max_messages' : IDL.Nat32,
    'max_events' : IDL.Nat32,
  });
  const MakeAdminArgs = IDL.Record({ 'user_id' : UserId });
  const MakeAdminResponse = IDL.Variant({
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const PublicSummaryArgs = IDL.Record({});
  const Version = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
  });
  const MessageEventWrapper = IDL.Record({
    'event' : Message,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
  });
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
  const PublicSummarySuccess = IDL.Record({ 'summary' : PublicGroupSummary });
  const PublicSummaryResponse = IDL.Variant({
    'Success' : PublicSummarySuccess,
  });
  const RemoveParticipantArgs = IDL.Record({ 'user_id' : UserId });
  const RemoveParticipantResponse = IDL.Variant({
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'CannotRemoveSelf' : IDL.Null,
    'CannotRemoveUser' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const SearchMessagesArgs = IDL.Record({
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
  const SearchMessagesResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'CallerNotInGroup' : IDL.Null,
    'Success' : SearchMessagesSuccessResult,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const SelectedInitialArgs = IDL.Record({});
  const Participant = IDL.Record({
    'role' : Role,
    'user_id' : UserId,
    'date_added' : TimestampMillis,
  });
  const SelectedInitialSuccess = IDL.Record({
    'participants' : IDL.Vec(Participant),
    'blocked_users' : IDL.Vec(UserId),
    'latest_event_index' : EventIndex,
  });
  const SelectedInitialResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : SelectedInitialSuccess,
  });
  const SelectedUpdatesArgs = IDL.Record({ 'updates_since' : EventIndex });
  const SelectedUpdatesSuccess = IDL.Record({
    'blocked_users_removed' : IDL.Vec(UserId),
    'participants_added_or_updated' : IDL.Vec(Participant),
    'participants_removed' : IDL.Vec(UserId),
    'latest_event_index' : EventIndex,
    'blocked_users_added' : IDL.Vec(UserId),
  });
  const SelectedUpdatesResponse = IDL.Variant({
    'CallerNotInGroup' : IDL.Null,
    'Success' : SelectedUpdatesSuccess,
    'SuccessNoUpdates' : IDL.Null,
  });
  const User = IDL.Record({ 'username' : IDL.Text, 'user_id' : UserId });
  const GroupReplyContext = IDL.Record({ 'event_index' : EventIndex });
  const SendMessageArgs = IDL.Record({
    'content' : MessageContent,
    'mentioned' : IDL.Vec(User),
    'sender_name' : IDL.Text,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(GroupReplyContext),
  });
  const SendMessageResponse = IDL.Variant({
    'TextTooLong' : IDL.Nat32,
    'CallerNotInGroup' : IDL.Null,
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'event_index' : EventIndex,
      'message_index' : MessageIndex,
    }),
    'MessageEmpty' : IDL.Null,
  });
  const SetPinnedMessageArgs = IDL.Record({
    'message_index' : IDL.Opt(MessageIndex),
  });
  const SetPinnedMessageResponse = IDL.Variant({
    'MessageIndexOutOfRange' : IDL.Null,
    'NoChange' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const ToggleReactionArgs = IDL.Record({
    'message_id' : MessageId,
    'reaction' : IDL.Text,
  });
  const ToggleReactionResponse = IDL.Variant({
    'MessageNotFound' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'InvalidReaction' : IDL.Null,
    'Added' : EventIndex,
    'Removed' : EventIndex,
  });
  const TransferOwnershipArgs = IDL.Record({ 'new_owner' : UserId });
  const TransferOwnershipResponse = IDL.Variant({
    'UserNotInGroup' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'UserAlreadySuperAdmin' : IDL.Null,
  });
  const UnblockUserArgs = IDL.Record({ 'user_id' : UserId });
  const UnblockUserResponse = IDL.Variant({
    'GroupNotPublic' : IDL.Null,
    'CannotUnblockSelf' : IDL.Null,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const Avatar = IDL.Record({
    'id' : IDL.Nat,
    'data' : IDL.Vec(IDL.Nat8),
    'mime_type' : IDL.Text,
  });
  const AvatarUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : Avatar,
  });
  const UpdateGroupArgs = IDL.Record({
    'name' : IDL.Text,
    'description' : IDL.Text,
    'avatar' : AvatarUpdate,
  });
  const FieldTooLongResult = IDL.Record({
    'length_provided' : IDL.Nat32,
    'max_length' : IDL.Nat32,
  });
  const UpdateGroupResponse = IDL.Variant({
    'DescriptionTooLong' : FieldTooLongResult,
    'CallerNotInGroup' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'AvatarTooBig' : FieldTooLongResult,
    'Success' : IDL.Null,
    'NameTooLong' : FieldTooLongResult,
    'NameTaken' : IDL.Null,
    'InternalError' : IDL.Null,
  });
  return IDL.Service({
    'add_participants' : IDL.Func(
        [AddParticipantsArgs],
        [AddParticipantsResponse],
        [],
      ),
    'block_user' : IDL.Func([BlockUserArgs], [BlockUserResponse], []),
    'change_role' : IDL.Func([ChangeRoleArgs], [ChangeRoleResponse], []),
    'delete_group' : IDL.Func([DeleteGroupArgs], [DeleteGroupResponse], []),
    'delete_messages' : IDL.Func(
        [DeleteMessagesArgs],
        [DeleteMessagesResponse],
        [],
      ),
    'dismiss_admin' : IDL.Func([DismissAdminArgs], [DismissAdminResponse], []),
    'edit_message' : IDL.Func([EditMessageArgs], [EditMessageResponse], []),
    'events' : IDL.Func([EventsArgs], [EventsResponse], ['query']),
    'events_by_index' : IDL.Func(
        [EventsByIndexArgs],
        [EventsResponse],
        ['query'],
      ),
    'events_range' : IDL.Func([EventsRangeArgs], [EventsResponse], ['query']),
    'events_window' : IDL.Func([EventsWindowArgs], [EventsResponse], ['query']),
    'make_admin' : IDL.Func([MakeAdminArgs], [MakeAdminResponse], []),
    'public_summary' : IDL.Func(
        [PublicSummaryArgs],
        [PublicSummaryResponse],
        ['query'],
      ),
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
    'selected_initial' : IDL.Func(
        [SelectedInitialArgs],
        [SelectedInitialResponse],
        ['query'],
      ),
    'selected_updates' : IDL.Func(
        [SelectedUpdatesArgs],
        [SelectedUpdatesResponse],
        ['query'],
      ),
    'send_message' : IDL.Func([SendMessageArgs], [SendMessageResponse], []),
    'set_pinned_message' : IDL.Func(
        [SetPinnedMessageArgs],
        [SetPinnedMessageResponse],
        [],
      ),
    'toggle_reaction' : IDL.Func(
        [ToggleReactionArgs],
        [ToggleReactionResponse],
        [],
      ),
    'transfer_ownership' : IDL.Func(
        [TransferOwnershipArgs],
        [TransferOwnershipResponse],
        [],
      ),
    'unblock_user' : IDL.Func([UnblockUserArgs], [UnblockUserResponse], []),
    'update_group' : IDL.Func([UpdateGroupArgs], [UpdateGroupResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
