import type { Principal } from '@dfinity/principal';
export interface AddParticipantsArgs { 'user_ids' : Array<UserId> }
export interface AddParticipantsFailedResult {
  'errors' : Array<UserId>,
  'users_blocked_from_group' : Array<UserId>,
  'users_who_blocked_request' : Array<UserId>,
  'users_already_in_group' : Array<UserId>,
}
export interface AddParticipantsPartialSuccessResult {
  'errors' : Array<UserId>,
  'users_blocked_from_group' : Array<UserId>,
  'users_added' : Array<UserId>,
  'users_who_blocked_request' : Array<UserId>,
  'users_already_in_group' : Array<UserId>,
}
export type AddParticipantsResponse = {
    'Failed' : AddParticipantsFailedResult
  } |
  { 'PartialSuccess' : AddParticipantsPartialSuccessResult } |
  { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'NotInGroup' : null };
export interface BlobReference {
  'blob_size' : number,
  'blob_id' : string,
  'canister_id' : CanisterId,
  'chunk_size' : number,
}
export type BlockUserArgs = {};
export type BlockUserResponse = { 'Success' : null };
export type CanisterId = Principal;
export type EventIndex = number;
export interface EventWrapper {
  'event' : GroupChatEvent,
  'timestamp' : TimestampMillis,
  'index' : EventIndex,
}
export interface EventsArgs {
  'to_index' : EventIndex,
  'from_index' : EventIndex,
}
export interface EventsByIndexArgs { 'events' : Array<EventWrapper> }
export type EventsByIndexResponse = { 'ChatNotFound' : null } |
  { 'Success' : EventsSuccessResult };
export type EventsResponse = { 'ChatNotFound' : null } |
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
export interface GetChunkArgs { 'blob_id' : bigint, 'index' : number }
export type GetChunkResponse = { 'NotFound' : null } |
  { 'Success' : { 'bytes' : Array<number> } };
export type GetGroupArgs = {};
export type GetGroupResponse = {
    'Success' : {
      'participants' : Array<UserId>,
      'subject' : string,
      'last_updated' : TimestampMillis,
      'display_date' : TimestampMillis,
      'latest_messages' : Array<Message>,
      'min_visible_message_index' : MessageIndex,
      'unread_by_me_message_id_ranges' : Array<Array<MessageIndex>>,
      'unread_by_any_message_id_ranges' : Array<Array<MessageIndex>>,
    }
  };
export type GroupChatEvent = {
    'GroupChatCreated' : {
      'name' : string,
      'description' : [] | [string],
      'created_by' : UserId,
    }
  } |
  { 'Message' : Message };
export type GroupId = CanisterId;
export interface JoinGroupArgs { 'principal' : Principal }
export type JoinGroupResponse = { 'Blocked' : null } |
  { 'GroupNotPublic' : null } |
  { 'AlreadyInGroup' : null } |
  { 'Success' : {} };
export type LeaveGroupArgs = {};
export type LeaveGroupResponse = { 'Success' : null };
export type MakeAdminArgs = {};
export type MakeAdminResponse = { 'Success' : null };
export interface MarkReadArgs { 'up_to_message_index' : MessageIndex }
export type MarkReadResponse = { 'SuccessNoChange' : null } |
  { 'Success' : null } |
  { 'NotInGroup' : null };
export interface MediaContent {
  'height' : number,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'thumbnail_data' : string,
  'caption' : [] | [string],
  'width' : number,
}
export interface Message {
  'content' : MessageContent,
  'sender' : UserId,
  'message_id' : MessageId,
  'replies_to' : [] | [ReplyContext],
  'message_index' : MessageIndex,
}
export type MessageContent = { 'File' : FileContent } |
  { 'Text' : TextContent } |
  { 'Media' : MediaContent };
export type MessageId = bigint;
export type MessageIndex = number;
export type MetricsArgs = {};
export interface MetricsResponse {
  'blob_bytes_used' : bigint,
  'cycles_balance' : bigint,
  'image_message_count' : bigint,
  'caller_id' : Principal,
  'chunk_count' : number,
  'bytes_used' : bigint,
  'file_message_count' : bigint,
  'timestamp' : TimestampMillis,
  'text_message_count' : bigint,
  'wasm_memory_used' : bigint,
  'video_message_count' : bigint,
}
export interface PutChunkArgs {
  'blob_id' : bigint,
  'bytes' : Array<number>,
  'index' : number,
}
export type PutChunkResponse = { 'Full' : null } |
  { 'Success' : null };
export type RemoveAdminArgs = {};
export type RemoveAdminResponse = { 'Success' : null };
export type RemoveParticipantsArgs = {};
export type RemoveParticipantsResponse = { 'Success' : null };
export interface ReplyContext {
  'content' : MessageContent,
  'user_id' : UserId,
  'message_id' : MessageId,
  'message_index' : MessageIndex,
}
export interface ReplyContextArgs { 'message_id' : MessageId }
export interface SearchMessagesArgs {
  'max_results' : number,
  'search_term' : string,
}
export type SearchMessagesResponse = {
    'Success' : { 'matches' : Array<{ 'score' : number, 'message' : Message }> }
  } |
  { 'Failure' : null };
export interface SendMessageArgs {
  'content' : MessageContent,
  'message_id' : MessageId,
  'replies_to' : [] | [ReplyContextArgs],
}
export type SendMessageResponse = { 'BalanceExceeded' : null } |
  {
    'Success' : {
      'timestamp' : TimestampMillis,
      'chat_summary' : {
        'last_updated' : TimestampMillis,
        'display_date' : TimestampMillis,
        'min_visible_message_index' : MessageIndex,
        'unread_by_me_message_id_ranges' : Array<Array<number>>,
        'unread_by_any_message_id_ranges' : Array<Array<number>>,
      },
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
export type UnblockUserArgs = {};
export type UnblockUserResponse = { 'Success' : null };
export type UserId = CanisterId;
export interface _SERVICE {
  'add_participants' : (arg_0: AddParticipantsArgs) => Promise<
      AddParticipantsResponse
    >,
  'block_user' : (arg_0: BlockUserArgs) => Promise<BlockUserResponse>,
  'events' : (arg_0: EventsArgs) => Promise<EventsResponse>,
  'events_by_index' : (arg_0: EventsByIndexArgs) => Promise<
      EventsByIndexResponse
    >,
  'get_chunk' : (arg_0: GetChunkArgs) => Promise<GetChunkResponse>,
  'get_group' : (arg_0: GetGroupArgs) => Promise<GetGroupResponse>,
  'join_group' : (arg_0: JoinGroupArgs) => Promise<JoinGroupResponse>,
  'leave_group' : (arg_0: LeaveGroupArgs) => Promise<LeaveGroupResponse>,
  'make_admin' : (arg_0: MakeAdminArgs) => Promise<MakeAdminResponse>,
  'mark_read' : (arg_0: MarkReadArgs) => Promise<MarkReadResponse>,
  'metrics' : (arg_0: MetricsArgs) => Promise<MetricsResponse>,
  'put_chunk' : (arg_0: PutChunkArgs) => Promise<PutChunkResponse>,
  'remove_admin' : (arg_0: RemoveAdminArgs) => Promise<RemoveAdminResponse>,
  'remove_participants' : (arg_0: RemoveParticipantsArgs) => Promise<
      RemoveParticipantsResponse
    >,
  'search_messages' : (arg_0: SearchMessagesArgs) => Promise<
      SearchMessagesResponse
    >,
  'send_message' : (arg_0: SendMessageArgs) => Promise<SendMessageResponse>,
  'set_avatar' : (arg_0: SetAvatarArgs) => Promise<SetAvatarResponse>,
  'unblock_user' : (arg_0: UnblockUserArgs) => Promise<UnblockUserResponse>,
}
