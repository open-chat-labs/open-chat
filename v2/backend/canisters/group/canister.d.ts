import type { Principal } from '@dfinity/principal';
export type AddParticipantsRequest = {};
export type AddParticipantsResponse = { 'Success' : null };
export interface BlobReference {
  'blob_size' : number,
  'blob_id' : string,
  'canister_id' : CanisterId,
  'chunk_size' : number,
};
export type BlockUserRequest = {};
export type BlockUserResponse = { 'Success' : null };
export type CanisterId = Principal;
export interface FileContent {
  'name' : string,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
};
export interface GetChunkRequest { 'blob_id' : bigint, 'index' : number };
export type GetChunkResponse = { 'NotFound' : null } |
  { 'Success' : { 'bytes' : Array<number> } };
export type GetGroupRequest = {};
export type GetGroupResponse = {
    'Success' : {
      'participants' : Array<UserId>,
      'subject' : string,
      'last_updated' : Timestamp,
      'display_date' : Timestamp,
      'min_visible_message_id' : number,
      'latest_messages' : Array<Message>,
      'unread_by_me_message_id_ranges' : Array<Array<number>>,
      'unread_by_any_message_id_ranges' : Array<Array<number>>,
    }
  };
export interface GetMessagesByIndexRequest { 'messages' : Array<number> };
export type GetMessagesByIndexResponse = { 'ChatNotFound' : null } |
  { 'Success' : GetMessagesSuccess };
export interface GetMessagesRequest {
  'to_index' : number,
  'from_index' : number,
};
export type GetMessagesResponse = { 'ChatNotFound' : null } |
  { 'Success' : GetMessagesSuccess };
export interface GetMessagesSuccess {
  'messages' : Array<Message>,
  'latest_message_id' : number,
};
export type GroupId = CanisterId;
export type InviteUsersRequest = {};
export type InviteUsersResponse = { 'Success' : null };
export type JoinGroupRequest = {};
export type JoinGroupResponse = { 'Success' : null };
export type LeaveGroupRequest = {};
export type LeaveGroupResponse = { 'Success' : null };
export type MakeAdminRequest = {};
export type MakeAdminResponse = { 'Success' : null };
export interface MarkReadRequest {
  'user_id' : UserId,
  'to_index' : number,
  'from_index' : number,
};
export type MarkReadResponse = { 'ChatNotFound' : null } |
  { 'Success' : { 'unread_message_id_ranges' : Array<Array<number>> } };
export interface MediaContent {
  'height' : number,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'thumbnail_data' : string,
  'caption' : [] | [string],
  'width' : number,
};
export interface Message {
  'id' : number,
  'content' : MessageContent,
  'sender' : UserId,
  'timestamp' : Timestamp,
  'replies_to' : [] | [ReplyContext],
  'client_message_id' : string,
};
export type MessageContent = { 'File' : FileContent } |
  { 'Text' : TextContent } |
  { 'Media' : MediaContent };
export interface Metrics {
  'blob_bytes_used' : bigint,
  'cycles_balance' : bigint,
  'image_message_count' : bigint,
  'caller_id' : Principal,
  'chunk_count' : number,
  'bytes_used' : bigint,
  'file_message_count' : bigint,
  'timestamp' : bigint,
  'text_message_count' : bigint,
  'wasm_memory_used' : bigint,
  'video_message_count' : bigint,
};
export interface PutChunkRequest {
  'blob_id' : bigint,
  'bytes' : Array<number>,
  'index' : number,
};
export type PutChunkResponse = { 'Full' : null } |
  { 'Success' : null };
export type RemoveAdminRequest = {};
export type RemoveAdminResponse = { 'Success' : null };
export type RemoveParticipantsRequest = {};
export type RemoveParticipantsResponse = { 'Success' : null };
export interface ReplyContext {
  'content' : MessageContent,
  'user_id' : UserId,
  'message_id' : number,
};
export interface SearchMessagesRequest {
  'max_results' : number,
  'search_term' : string,
};
export type SearchMessagesResponse = {
    'Success' : { 'matches' : Array<{ 'score' : number, 'message' : Message }> }
  } |
  { 'Failure' : null };
export interface SendMessageRequest {
  'content' : MessageContent,
  'replies_to' : [] | [ReplyContext],
  'client_message_id' : string,
};
export type SendMessageResponse = { 'BalanceExceeded' : null } |
  {
    'Success' : {
      'timestamp' : Timestamp,
      'chat_summary' : {
        'last_updated' : Timestamp,
        'display_date' : Timestamp,
        'min_visible_message_id' : number,
        'unread_by_me_message_id_ranges' : Array<Array<number>>,
        'unread_by_any_message_id_ranges' : Array<Array<number>>,
      },
      'message_index' : number,
    }
  } |
  { 'RecipientBlocked' : null } |
  { 'InvalidRequest' : null } |
  { 'SenderBlocked' : null } |
  { 'MessageTooLong' : number } |
  { 'RecipientNotFound' : null };
export interface SetAvatarRequest {
  'mime_type' : string,
  'bytes' : Array<number>,
};
export type SetAvatarResponse = { 'InvalidMimeType' : number } |
  { 'FileTooBig' : number } |
  { 'Success' : null };
export interface TextContent { 'text' : string };
export type Timestamp = bigint;
export type UnblockUserRequest = {};
export type UnblockUserResponse = { 'Success' : null };
export type UserId = CanisterId;
export default interface _SERVICE {
  'add_participants' : (arg_0: AddParticipantsRequest) => Promise<
      AddParticipantsResponse
    >,
  'block_user' : (arg_0: BlockUserRequest) => Promise<BlockUserResponse>,
  'get_chunk' : (arg_0: GetChunkRequest) => Promise<GetChunkResponse>,
  'get_group' : (arg_0: GetGroupRequest) => Promise<GetGroupResponse>,
  'get_messages' : (arg_0: GetMessagesRequest) => Promise<GetMessagesResponse>,
  'get_messages_by_index' : (arg_0: GetMessagesByIndexRequest) => Promise<
      GetMessagesByIndexResponse
    >,
  'invite_users' : (arg_0: InviteUsersRequest) => Promise<InviteUsersResponse>,
  'join_group' : (arg_0: JoinGroupRequest) => Promise<JoinGroupResponse>,
  'leave_group' : (arg_0: LeaveGroupRequest) => Promise<LeaveGroupResponse>,
  'make_admin' : (arg_0: MakeAdminRequest) => Promise<MakeAdminResponse>,
  'mark_read' : (arg_0: MarkReadRequest) => Promise<MarkReadResponse>,
  'metrics' : () => Promise<Metrics>,
  'put_chunk' : (arg_0: PutChunkRequest) => Promise<PutChunkResponse>,
  'remove_admin' : (arg_0: RemoveAdminRequest) => Promise<RemoveAdminResponse>,
  'remove_participants' : (arg_0: RemoveParticipantsRequest) => Promise<
      RemoveParticipantsResponse
    >,
  'search_messages' : (arg_0: SearchMessagesRequest) => Promise<
      SearchMessagesResponse
    >,
  'send_message' : (arg_0: SendMessageRequest) => Promise<SendMessageResponse>,
  'set_avatar' : (arg_0: SetAvatarRequest) => Promise<SetAvatarResponse>,
  'unblock_user' : (arg_0: UnblockUserRequest) => Promise<UnblockUserResponse>,
};
