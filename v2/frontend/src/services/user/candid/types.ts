import type { Principal } from '@dfinity/principal';
export interface BlobReference {
  'blob_size' : number,
  'blob_id' : string,
  'canister_id' : CanisterId,
  'chunk_size' : number,
}
export interface BlockUserArgs { 'user_id' : UserId }
export type CanisterId = Principal;
export type ChatId = { 'Group' : GroupId } |
  { 'Direct' : DirectChatId };
export type ChatSummary = { 'Group' : GroupChatSummary } |
  { 'Direct' : DirectChatSummary };
export type ChatSummaryUpdates = { 'Group' : GroupChatSummaryUpdates } |
  { 'Direct' : DirectChatSummaryUpdates };
export interface ChunkArgs { 'blob_id' : bigint, 'index' : number }
export type ChunkResponse = { 'NotFound' : null } |
  { 'Success' : { 'bytes' : Array<number> } };
export interface CreateGroupArgs { 'is_public' : boolean, 'name' : string }
export type CreateGroupResponse = { 'PublicGroupAlreadyExists' : null } |
  { 'UnknownError' : null } |
  { 'Success' : { 'canister_id' : CanisterId } } |
  { 'InvalidName' : null } |
  { 'NameTooLong' : number } |
  { 'GroupLimitExceeded' : number };
export interface CyclesContent { 'caption' : [] | [string], 'amount' : bigint }
export type DirectChatEvent = { 'Message' : DirectMessage };
export type DirectChatId = Principal;
export interface DirectChatSummary {
  'date_created' : TimestampMillis,
  'them' : UserId,
  'last_updated' : TimestampMillis,
  'latest_read_by_me' : MessageIndex,
  'latest_event_index' : EventIndex,
  'chat_id' : DirectChatId,
  'latest_read_by_them' : MessageIndex,
  'latest_message' : {
    'event' : DirectMessage,
    'timestamp' : TimestampMillis,
    'index' : EventIndex,
  },
}
export interface DirectChatSummaryUpdates {
  'last_updated' : TimestampMillis,
  'latest_read_by_me' : [] | [MessageIndex],
  'latest_event_index' : [] | [EventIndex],
  'chat_id' : DirectChatId,
  'latest_read_by_them' : [] | [MessageIndex],
  'latest_message' : [] | [EventWrapper],
}
export interface DirectMessage {
  'content' : MessageContent,
  'sender' : UserId,
  'timestamp' : TimestampMillis,
  'message_id' : MessageId,
  'replies_to' : [] | [DirectReplyContext],
  'message_index' : MessageIndex,
}
export type DirectReplyContext = {
    'Private' : { 'chat_id' : GroupId, 'message_index' : MessageIndex }
  } |
  {
    'Standard' : {
      'content' : MessageContent,
      'sent_by_me' : boolean,
      'message_index' : MessageIndex,
    }
  };
export type EventIndex = number;
export interface EventWrapper {
  'event' : DirectChatEvent,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export interface EventsArgs {
  'user_id' : UserId,
  'to_index' : EventIndex,
  'from_index' : EventIndex,
}
export interface EventsByIndexArgs {
  'user_id' : UserId,
  'events' : Array<EventIndex>,
}
export type EventsByIndexResponse = { 'ChatNotFound' : null } |
  { 'Success' : EventsSuccessResult };
export type EventsResponse = { 'ChatNotFound' : null } |
  { 'NotAuthorised' : null } |
  { 'Success' : EventsSuccessResult };
export interface EventsSuccessResult {
  'events' : Array<EventWrapper>,
  'latest_event_index' : EventIndex,
}
export interface FileContent {
  'name' : string,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
}
export interface GroupChatSummary {
  'is_public' : boolean,
  'participants' : Array<Participant>,
  'name' : string,
  'description' : string,
  'last_updated' : TimestampMillis,
  'latest_read_by_me' : MessageIndex,
  'joined' : TimestampMillis,
  'latest_event_index' : EventIndex,
  'min_visible_message_index' : MessageIndex,
  'chat_id' : GroupId,
  'latest_message' : [] | [
    {
      'event' : GroupMessage,
      'timestamp' : TimestampMillis,
      'index' : EventIndex,
    }
  ],
}
export interface GroupChatSummaryUpdates {
  'participants_added' : Array<Participant>,
  'participants_removed' : Array<UserId>,
  'name' : [] | [string],
  'description' : [] | [string],
  'last_updated' : TimestampMillis,
  'latest_read_by_me' : [] | [MessageIndex],
  'latest_event_index' : [] | [EventIndex],
  'chat_id' : GroupId,
  'participants_updated' : Array<Participant>,
  'latest_message' : [] | [EventWrapper],
}
export interface GroupChatUpdatesSince {
  'updates_since' : TimestampMillis,
  'chat_id' : GroupId,
}
export type GroupId = CanisterId;
export interface GroupMessage {
  'content' : MessageContent,
  'sender' : UserId,
  'message_id' : MessageId,
  'replies_to' : [] | [GroupReplyContext],
  'message_index' : MessageIndex,
}
export interface GroupReplyContext {
  'content' : MessageContent,
  'user_id' : UserId,
  'event_index' : EventIndex,
}
export interface HandleAddToGroupRequestedArgs { 'added_by' : UserId }
export type HandleAddToGroupRequestedResponse = { 'Blocked' : null } |
  { 'Success' : HandleAddToGroupRequestedSuccessResult };
export interface HandleAddToGroupRequestedSuccessResult {
  'principal' : Principal,
}
export interface HandleMarkReadArgs { 'up_to_message_index' : MessageIndex }
export type HandleMarkReadResponse = { 'SuccessNoChange' : null } |
  { 'ChatNotFound' : null } |
  { 'Success' : null };
export interface HandleMessageReceivedArgs {
  'content' : MessageContent,
  'sender_name' : string,
  'message_id' : MessageId,
  'replies_to' : [] | [ReplyContextArgs],
}
export type HandleMessageReceivedResponse = { 'Success' : null };
export interface InitArgs {
  'owner' : Principal,
  'notification_canister_ids' : Array<CanisterId>,
}
export interface JoinGroupArgs { 'group_chat_id' : GroupId }
export type JoinGroupResponse = { 'Blocked' : null } |
  { 'GroupNotFound' : null } |
  { 'GroupNotPublic' : null } |
  { 'AlreadyInGroup' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'InternalError' : string };
export interface MarkReadArgs {
  'up_to_message_index' : MessageIndex,
  'user_id' : UserId,
}
export type MarkReadResponse = { 'SuccessNoChange' : null } |
  { 'ChatNotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null };
export interface MediaContent {
  'height' : number,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'thumbnail_data' : string,
  'caption' : [] | [string],
  'width' : number,
}
export type MessageContent = { 'File' : FileContent } |
  { 'Text' : TextContent } |
  { 'Media' : MediaContent } |
  { 'Cycles' : CyclesContent };
export type MessageId = bigint;
export type MessageIndex = number;
export type MetricsArgs = {};
export interface MetricsResponse {
  'blob_bytes_used' : bigint,
  'cycles_balance' : bigint,
  'group_chat_count' : number,
  'image_message_count' : bigint,
  'caller_id' : Principal,
  'direct_chat_count' : number,
  'chunk_count' : number,
  'bytes_used' : bigint,
  'file_message_count' : bigint,
  'cycles_message_count' : bigint,
  'timestamp' : TimestampMillis,
  'text_message_count' : bigint,
  'wasm_memory_used' : bigint,
  'video_message_count' : bigint,
}
export interface Participant {
  'role' : { 'Admin' : null } |
    { 'Standard' : null },
  'user_id' : UserId,
  'date_added' : TimestampMillis,
}
export interface PrivateReplyDetails {
  'content' : MessageContent,
  'group_chat_id' : GroupId,
  'user_id' : UserId,
}
export interface PutChunkArgs {
  'blob_id' : bigint,
  'bytes' : Array<number>,
  'index' : number,
}
export type PutChunkResponse = { 'Full' : null } |
  { 'Success' : null };
export interface ReplyContextArgs {
  'chat_id_if_other' : [] | [GroupId],
  'message_index' : MessageIndex,
}
export interface SearchAllMessagesArgs {
  'max_results' : number,
  'search_term' : string,
}
export type SearchAllMessagesResponse = {
    'Success' : {
      'matches' : Array<
        {
          'chat' : CanisterId,
          'is_direct' : boolean,
          'message' : DirectMessage,
        }
      >,
    }
  } |
  { 'Failure' : null };
export interface SendMessageArgs {
  'content' : MessageContent,
  'recipient' : UserId,
  'sender_name' : string,
  'message_id' : MessageId,
  'replies_to' : [] | [ReplyContextArgs],
}
export type SendMessageResponse = { 'BalanceExceeded' : null } |
  {
    'Success' : {
      'latest_read_by_me' : MessageIndex,
      'timestamp' : TimestampMillis,
      'latest_read_by_them' : MessageIndex,
      'message_index' : MessageIndex,
    }
  } |
  { 'RecipientBlocked' : null } |
  { 'InvalidRequest' : null } |
  { 'SenderBlocked' : null } |
  { 'MessageTooLong' : number } |
  { 'RecipientNotFound' : null };
export interface SetAvatarArgs { 'mime_type' : string, 'bytes' : Array<number> }
export type SetAvatarResponse = { 'InvalidMimeType' : number } |
  { 'FileTooBig' : number } |
  { 'Success' : null };
export interface TextContent { 'text' : string }
export type TimestampMillis = bigint;
export interface UnblockUserArgs { 'user_id' : UserId }
export interface UpdatesArgs { 'updates_since' : [] | [UpdatesSince] }
export type UpdatesResponse = {
    'Success' : {
      'chats_updated' : Array<ChatSummaryUpdates>,
      'chats_added' : Array<ChatSummary>,
      'chats_removed' : Array<ChatId>,
      'timestamp' : TimestampMillis,
    }
  };
export interface UpdatesSince {
  'group_chats' : Array<GroupChatUpdatesSince>,
  'timestamp' : TimestampMillis,
}
export type UserId = CanisterId;
export interface _SERVICE {
  'block_user' : (arg_0: BlockUserArgs) => Promise<undefined>,
  'chunk' : (arg_0: ChunkArgs) => Promise<ChunkResponse>,
  'create_group' : (arg_0: CreateGroupArgs) => Promise<CreateGroupResponse>,
  'events' : (arg_0: EventsArgs) => Promise<EventsResponse>,
  'events_by_index' : (arg_0: EventsByIndexArgs) => Promise<
      EventsByIndexResponse
    >,
  'handle_add_to_group_requested' : (
      arg_0: HandleAddToGroupRequestedArgs,
    ) => Promise<HandleAddToGroupRequestedResponse>,
  'handle_mark_read' : (arg_0: HandleMarkReadArgs) => Promise<
      HandleMarkReadResponse
    >,
  'handle_message_received' : (arg_0: HandleMessageReceivedArgs) => Promise<
      HandleMessageReceivedResponse
    >,
  'join_group' : (arg_0: JoinGroupArgs) => Promise<JoinGroupResponse>,
  'mark_read' : (arg_0: MarkReadArgs) => Promise<MarkReadResponse>,
  'metrics' : (arg_0: MetricsArgs) => Promise<MetricsResponse>,
  'put_chunk' : (arg_0: PutChunkArgs) => Promise<PutChunkResponse>,
  'search_all_messages' : (arg_0: SearchAllMessagesArgs) => Promise<
      SearchAllMessagesResponse
    >,
  'send_message' : (arg_0: SendMessageArgs) => Promise<SendMessageResponse>,
  'set_avatar' : (arg_0: SetAvatarArgs) => Promise<SetAvatarResponse>,
  'unblock_user' : (arg_0: UnblockUserArgs) => Promise<undefined>,
  'updates' : (arg_0: UpdatesArgs) => Promise<UpdatesResponse>,
}
