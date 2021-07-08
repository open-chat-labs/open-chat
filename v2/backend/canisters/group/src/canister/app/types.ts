import type { Principal } from '@dfinity/agent';
export type AddParticipantsArgs = {};
export type AddParticipantsResponse = { 'Success' : null };
export interface BlobReference {
  'blob_size' : number,
  'blob_id' : string,
  'canister_id' : CanisterId,
  'chunk_size' : number,
};
export type BlockUserArgs = {};
export type BlockUserResponse = { 'Success' : null };
export type CanisterId = Principal;
export interface FileContent {
  'name' : string,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
};
export interface GetChunkArgs { 'blob_id' : bigint, 'index' : number };
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
      'min_visible_message_index' : number,
      'unread_by_me_message_id_ranges' : Array<Array<number>>,
      'unread_by_any_message_id_ranges' : Array<Array<number>>,
    }
  };
export interface GetMessagesArgs { 'to_index' : number, 'from_index' : number };
export interface GetMessagesByIndexArgs { 'messages' : Array<number> };
export type GetMessagesByIndexResponse = { 'ChatNotFound' : null } |
  { 'Success' : GetMessagesSuccess };
export type GetMessagesResponse = { 'ChatNotFound' : null } |
  { 'Success' : GetMessagesSuccess };
export interface GetMessagesSuccess {
  'messages' : Array<Message>,
  'latest_message_index' : number,
};
export type GroupId = CanisterId;
export type InviteUsersArgs = {};
export type InviteUsersResponse = { 'Success' : null };
export type JoinGroupArgs = {};
export type JoinGroupResponse = { 'Success' : null };
export type LeaveGroupArgs = {};
export type LeaveGroupResponse = { 'Success' : null };
export type MakeAdminArgs = {};
export type MakeAdminResponse = { 'Success' : null };
export interface MarkReadArgs { 'up_to_message_index' : number };
export type MarkReadResponse = { 'Success' : null } |
  { 'NotInGroup' : null };
export interface MediaContent {
  'height' : number,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'thumbnail_data' : string,
  'caption' : [] | [string],
  'width' : number,
};
export interface Message {
  'content' : MessageContent,
  'sender' : UserId,
  'timestamp' : TimestampMillis,
  'message_id' : bigint,
  'replies_to' : [] | [ReplyContext],
  'message_index' : number,
};
export type MessageContent = { 'File' : FileContent } |
  { 'Text' : TextContent } |
  { 'Media' : MediaContent };
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
};
export interface PutChunkArgs {
  'blob_id' : bigint,
  'bytes' : Array<number>,
  'index' : number,
};
export type PutChunkResponse = { 'Full' : null } |
  { 'Success' : null };
export type RemoveAdminArgs = {};
export type RemoveAdminResponse = { 'Success' : null };
export type RemoveParticipantsArgs = {};
export type RemoveParticipantsResponse = { 'Success' : null };
export interface ReplyContext {
  'content' : MessageContent,
  'user_id' : UserId,
  'message_id' : bigint,
};
export interface SearchMessagesArgs {
  'max_results' : number,
  'search_term' : string,
};
export type SearchMessagesResponse = {
    'Success' : { 'matches' : Array<{ 'score' : number, 'message' : Message }> }
  } |
  { 'Failure' : null };
export interface SendMessageArgs {
  'content' : MessageContent,
  'message_id' : bigint,
  'replies_to' : [] | [ReplyContext],
};
export type SendMessageResponse = { 'BalanceExceeded' : null } |
  {
    'Success' : {
      'timestamp' : TimestampMillis,
      'message_id' : number,
      'chat_summary' : {
        'last_updated' : TimestampMillis,
        'display_date' : TimestampMillis,
        'min_visible_message_index' : number,
        'unread_by_me_message_id_ranges' : Array<Array<number>>,
        'unread_by_any_message_id_ranges' : Array<Array<number>>,
      },
    }
  } |
  { 'RecipientBlocked' : null } |
  { 'InvalidRequest' : null } |
  { 'SenderBlocked' : null } |
  { 'MessageTooLong' : number } |
  { 'RecipientNotFound' : null };
export interface SetAvatarArgs {
  'mime_type' : string,
  'bytes' : Array<number>,
};
export type SetAvatarResponse = { 'InvalidMimeType' : number } |
  { 'FileTooBig' : number } |
  { 'Success' : null };
export interface TextContent { 'text' : string };
export type TimestampMillis = bigint;
export type UnblockUserArgs = {};
export type UnblockUserResponse = { 'Success' : null };
export type UserId = CanisterId;
export default interface _SERVICE {
  'add_participants' : (arg_0: AddParticipantsArgs) => Promise<
      AddParticipantsResponse
    >,
  'block_user' : (arg_0: BlockUserArgs) => Promise<BlockUserResponse>,
  'get_chunk' : (arg_0: GetChunkArgs) => Promise<GetChunkResponse>,
  'get_group' : (arg_0: GetGroupArgs) => Promise<GetGroupResponse>,
  'get_messages' : (arg_0: GetMessagesArgs) => Promise<GetMessagesResponse>,
  'get_messages_by_index' : (arg_0: GetMessagesByIndexArgs) => Promise<
      GetMessagesByIndexResponse
    >,
  'invite_users' : (arg_0: InviteUsersArgs) => Promise<InviteUsersResponse>,
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
};
