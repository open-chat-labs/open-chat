import type { Principal } from '@dfinity/principal';
export interface BlobReference {
  'blob_size' : number,
  'blob_id' : string,
  'canister_id' : CanisterId,
  'chunk_size' : number,
};
export interface BlockUserRequest { 'user_id' : UserId };
export type CanisterId = Principal;
export interface ChatSummary {
  'them' : UserId,
  'last_updated' : Timestamp,
  'display_date' : Timestamp,
  'unread_by_them_message_id_ranges' : Array<Array<number>>,
  'latest_messages' : Array<Message>,
  'unread_by_me_message_id_ranges' : Array<Array<number>>,
};
export interface CreateGroupRequest { 'is_public' : boolean, 'name' : string };
export type CreateGroupResponse = { 'PublicGroupAlreadyExists' : null } |
  { 'UnknownError' : null } |
  { 'Success' : { 'canister_id' : CanisterId } } |
  { 'InvalidName' : null } |
  { 'NameTooLong' : number } |
  { 'GroupLimitExceeded' : number };
export interface CyclesContent { 'caption' : [] | [string], 'amount' : bigint };
export interface FileContent {
  'name' : string,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
};
export interface GetChatsRequest {
  'message_count_for_top_chat' : [] | [number],
  'updated_since' : [] | [Timestamp],
};
export type GetChatsResponse = { 'Success' : { 'chats' : Array<ChatSummary> } };
export interface GetChunkRequest { 'blob_id' : bigint, 'index' : number };
export type GetChunkResponse = { 'NotFound' : null } |
  { 'Success' : { 'bytes' : Array<number> } };
export interface GetMessagesByIndexRequest {
  'messages' : Array<number>,
  'user_id' : UserId,
};
export type GetMessagesByIndexResponse = { 'ChatNotFound' : null } |
  { 'Success' : GetMessagesSuccess };
export interface GetMessagesRequest {
  'user_id' : UserId,
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
export interface HandleAddedToGroupRequest {
  'added_by' : UserId,
  'group_id' : GroupId,
};
export type HandleAddedToGroupResponse = { 'Blocked' : null } |
  { 'Success' : null };
export interface HandleInvitedToGroupRequest {
  'group_id' : GroupId,
  'invited_by' : UserId,
};
export type HandleInvitedToGroupResponse = { 'Success' : null };
export interface HandleJoinedGroupRequest {
  'user_principal' : Principal,
  'group_id' : GroupId,
};
export type HandleJoinedGroupResponse = { 'Success' : null } |
  { 'Unauthorized' : null };
export interface HandleLeftGroupRequest {
  'user_principal' : Principal,
  'group_id' : GroupId,
};
export type HandleLeftGroupResponse = { 'Success' : null } |
  { 'Unauthorized' : null };
export interface HandleMessageRequest {
  'content' : MessageContent,
  'sender' : UserId,
  'replies_to' : [] | [ReplyContext],
  'client_message_id' : string,
};
export type HandleMessageResponse = { 'Out' : null } |
  { 'Success' : null } |
  { 'SenderBlocked' : null };
export interface HandleRemovedFromGroupRequest { 'group_id' : GroupId };
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
  { 'Media' : MediaContent } |
  { 'Cycles' : CyclesContent };
export interface Metrics {
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
export interface ReplyContext {
  'content' : MessageContent,
  'user_id' : UserId,
  'message_id' : number,
};
export interface SearchAllMessagesRequest {
  'max_results' : number,
  'search_term' : string,
};
export type SearchAllMessagesResponse = {
    'Success' : {
      'matches' : Array<
        { 'chat' : CanisterId, 'is_direct' : boolean, 'message' : Message }
      >,
    }
  } |
  { 'Failure' : null };
export interface SendMessageRequest {
  'content' : MessageContent,
  'recipient' : UserId,
  'replies_to' : [] | [ReplyContext],
  'client_message_id' : string,
};
export type SendMessageResponse = { 'BalanceExceeded' : null } |
  {
    'Success' : {
      'timestamp' : Timestamp,
      'chat_summary' : ChatSummary,
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
export interface UnblockUserRequest { 'user_id' : UserId };
export type UserId = CanisterId;
export default interface _SERVICE {
  'block_user' : (arg_0: BlockUserRequest) => Promise<undefined>,
  'create_group' : (arg_0: CreateGroupRequest) => Promise<CreateGroupResponse>,
  'get_chats' : (arg_0: GetChatsRequest) => Promise<GetChatsResponse>,
  'get_chunk' : (arg_0: GetChunkRequest) => Promise<GetChunkResponse>,
  'get_messages' : (arg_0: GetMessagesRequest) => Promise<GetMessagesResponse>,
  'get_messages_by_index' : (arg_0: GetMessagesByIndexRequest) => Promise<
      GetMessagesByIndexResponse
    >,
  'handle_added_to_group' : (arg_0: HandleAddedToGroupRequest) => Promise<
      HandleAddedToGroupResponse
    >,
  'handle_invited_to_group' : (arg_0: HandleInvitedToGroupRequest) => Promise<
      HandleInvitedToGroupResponse
    >,
  'handle_joined_group' : (arg_0: HandleJoinedGroupRequest) => Promise<
      HandleJoinedGroupResponse
    >,
  'handle_left_group' : (arg_0: HandleLeftGroupRequest) => Promise<
      HandleLeftGroupResponse
    >,
  'handle_message_received' : (arg_0: HandleMessageRequest) => Promise<
      HandleMessageResponse
    >,
  'handle_removed_from_group' : (
      arg_0: HandleRemovedFromGroupRequest,
    ) => Promise<undefined>,
  'mark_read' : (arg_0: MarkReadRequest) => Promise<MarkReadResponse>,
  'metrics' : () => Promise<Metrics>,
  'put_chunk' : (arg_0: PutChunkRequest) => Promise<PutChunkResponse>,
  'search_all_messages' : (arg_0: SearchAllMessagesRequest) => Promise<
      SearchAllMessagesResponse
    >,
  'send_message' : (arg_0: SendMessageRequest) => Promise<SendMessageResponse>,
  'set_avatar' : (arg_0: SetAvatarRequest) => Promise<SetAvatarResponse>,
  'unblock_user' : (arg_0: UnblockUserRequest) => Promise<undefined>,
};
