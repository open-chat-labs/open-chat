import type { Principal } from '@dfinity/principal';
export interface BlobReference {
  'blob_size' : number,
  'blob_id' : string,
  'canister_id' : CanisterId,
  'chunk_size' : number,
}
export interface BlockUserArgs { 'user_id' : UserId }
export type CanisterId = Principal;
export type ChatId = { 'DirectChatId' : null } |
  { 'GroupId' : null };
export type ChatSummary = { 'Group' : GroupChatSummary } |
  { 'Direct' : DirectChatSummary };
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
export type DirectChatId = Principal;
export interface DirectChatSummary {
  'id' : DirectChatId,
  'them' : UserId,
  'last_updated' : TimestampMillis,
  'latest_read_by_me' : MessageIndex,
  'latest_read_by_them' : MessageIndex,
  'latest_message' : Message,
}
export interface FileContent {
  'name' : string,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
}
export interface GroupChatSummary {
  'id' : GroupId,
  'participants' : Array<Participant>,
  'name' : string,
  'description' : string,
  'last_updated' : TimestampMillis,
  'public' : boolean,
  'latest_read_by_me' : MessageIndex,
  'joined' : TimestampMillis,
  'min_visible_message_index' : MessageIndex,
  'latest_message' : [] | [Message],
}
export type GroupId = CanisterId;
export interface InitArgs {
  'owner' : Principal,
  'notification_canister_ids' : Array<CanisterId>,
}
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
export interface Message {
  'content' : MessageContent,
  'sender' : UserId,
  'timestamp' : TimestampMillis,
  'message_id' : MessageId,
  'replies_to' : [] | [ReplyContext],
  'message_index' : MessageIndex,
}
export type MessageContent = { 'File' : FileContent } |
  { 'Text' : TextContent } |
  { 'Media' : MediaContent } |
  { 'Cycles' : CyclesContent };
export type MessageId = bigint;
export type MessageIndex = number;
export interface MessagesArgs {
  'user_id' : UserId,
  'to_index' : MessageIndex,
  'from_index' : MessageIndex,
}
export interface MessagesByIndexArgs {
  'messages' : Array<MessageIndex>,
  'user_id' : UserId,
}
export type MessagesByIndexResponse = { 'ChatNotFound' : null } |
  { 'Success' : MessagesSuccess };
export type MessagesResponse = { 'ChatNotFound' : null } |
  { 'Success' : MessagesSuccess };
export interface MessagesSuccess {
  'messages' : Array<Message>,
  'latest_message_index' : MessageIndex,
}
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
export type ReplyContext = {
    'Private' : { 'chat_id' : GroupId, 'message_index' : MessageIndex }
  } |
  {
    'Standard' : {
      'content' : MessageContent,
      'sent_by_me' : boolean,
      'message_index' : MessageIndex,
    }
  };
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
        { 'chat' : CanisterId, 'is_direct' : boolean, 'message' : Message }
      >,
    }
  } |
  { 'Failure' : null };
export interface SendMessageArgs {
  'content' : MessageContent,
  'recipient' : UserId,
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
export type UpdatedChatSummary = { 'Group' : UpdatedGroupChatSummary } |
  { 'Direct' : UpdatedDirectChatSummary };
export interface UpdatedDirectChatSummary {
  'last_updated' : TimestampMillis,
  'latest_read_by_me' : [] | [MessageIndex],
  'chat_id' : DirectChatId,
  'latest_read_by_them' : [] | [MessageIndex],
  'latest_message' : [] | [Message],
}
export interface UpdatedGroupChatSummary {
  'participants_added' : Array<Participant>,
  'participants_removed' : Array<UserId>,
  'name' : [] | [string],
  'description' : [] | [string],
  'last_updated' : TimestampMillis,
  'latest_read_by_me' : [] | [MessageIndex],
  'chat_id' : GroupId,
  'participants_updated' : Array<Participant>,
  'latest_message' : [] | [Message],
}
export interface UpdatesArgs {
  'groups' : Array<{ 'last_updated' : TimestampMillis, 'chat_id' : GroupId }>,
  'last_updated' : [] | [TimestampMillis],
}
export type UpdatesResponse = {
    'Success' : {
      'chats_updated' : Array<UpdatedChatSummary>,
      'chats_added' : Array<ChatSummary>,
      'chats_removed' : Array<ChatId>,
    }
  };
export type UserId = CanisterId;
export interface _SERVICE {
  'block_user' : (arg_0: BlockUserArgs) => Promise<undefined>,
  'chunk' : (arg_0: ChunkArgs) => Promise<ChunkResponse>,
  'create_group' : (arg_0: CreateGroupArgs) => Promise<CreateGroupResponse>,
  'mark_read' : (arg_0: MarkReadArgs) => Promise<MarkReadResponse>,
  'messages' : (arg_0: MessagesArgs) => Promise<MessagesResponse>,
  'messages_by_index' : (arg_0: MessagesByIndexArgs) => Promise<
      MessagesByIndexResponse
    >,
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