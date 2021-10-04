import type { Principal } from '@dfinity/principal';
export type AddParticipantsResponse = {
    'PartialSuccess' : { 'count_added' : number, 'blocked' : Array<UserId> }
  } |
  { 'ChatNotFound' : null } |
  { 'NotGroupChat' : null } |
  { 'Success' : number } |
  { 'Unauthorized' : null };
export type ChatId = bigint;
export type ChatSummary = { 'Group' : GroupChatSummary } |
  { 'Direct' : DirectChatSummary };
export interface CreateGroupChatRequest {
  'participants' : Array<UserId>,
  'subject' : string,
  'chat_history_visible_to_new_joiners' : boolean,
  'chat_id' : ChatId,
}
export type CreateGroupChatResponse = { 'SubjectTooLong' : number } |
  { 'SubjectTooShort' : number } |
  { 'TooManyParticipants' : number } |
  { 'ChatAlreadyExists' : null } |
  { 'Success' : GroupChatSummary };
export interface CyclesContent { 'caption' : [] | [string], 'amount' : bigint }
export type DeleteGroupResponse = { 'ChatNotFound' : null } |
  { 'NotGroupChat' : null } |
  { 'Success' : null } |
  { 'Unauthorized' : null } |
  { 'OnlyLastAdminCanDelete' : null };
export interface DirectChatSummary {
  'id' : ChatId,
  'them' : UserId,
  'last_updated' : Timestamp,
  'display_date' : Timestamp,
  'unread_by_them_message_id_ranges' : Array<Array<number>>,
  'latest_messages' : Array<Message>,
  'unread_by_me_message_id_ranges' : Array<Array<number>>,
  'muted': boolean,
}
export interface FileContent {
  'blob_size' : number,
  'blob_id' : string,
  'name' : string,
  'mime_type' : string,
  'caption' : [] | [string],
  'chunk_size' : number,
  'blob_deleted' : boolean,
}
export interface GetChatsRequest {
  'message_count_for_top_chat' : [] | [number],
  'updated_since' : [] | [Timestamp],
}
export type GetChatsResponse = { 'Success' : Array<ChatSummary> };
export type GetMessagesByIdResponse = { 'ChatNotFound' : null } |
  { 'Success' : GetMessagesResult };
export type GetMessagesResponse = { 'ChatNotFound' : null } |
  { 'Success' : GetMessagesResult };
export interface GetMessagesResult {
  'messages' : Array<Message>,
  'latest_message_id' : number,
}
export interface GetUpdatesRequest {
  'message_count_for_top_chat' : [] | [number],
  'updated_since' : [] | [Timestamp],
}
export type GetUpdatesResponse = { 'Success' : GetUpdatesResult };
export interface GetUpdatesResult {
  'chats' : Array<ChatSummary>,
  'blocked_users' : Array<UserId>,
}
export interface GroupChatSummary {
  'id' : ChatId,
  'participants' : Array<UserId>,
  'subject' : string,
  'last_updated' : Timestamp,
  'display_date' : Timestamp,
  'min_visible_message_id' : number,
  'latest_messages' : Array<Message>,
  'unread_by_me_message_id_ranges' : Array<Array<number>>,
  'unread_by_any_message_id_ranges' : Array<Array<number>>,
  'muted': boolean,
}
export type JoinGroupResponse = { 'AlreadyInGroup' : null } |
  { 'UserLimitReached' : null } |
  { 'ChatNotFound' : null } |
  { 'NotGroupChat' : null } |
  { 'Success' : null };
export type LeaveGroupResponse = { 'ParticipantNotFound' : null } |
  { 'ChatNotFound' : null } |
  { 'NotGroupChat' : null } |
  { 'Success' : null } |
  { 'LastAdminCannotLeave' : null };
export type MarkReadResponse = { 'ChatNotFound' : null } |
  { 'Success' : MarkReadResult };
export interface MarkReadResult {
  'unread_message_id_ranges' : Array<Array<number>>,
}
export interface MediaContent {
  'height' : number,
  'blob_size' : number,
  'blob_id' : string,
  'mime_type' : string,
  'thumbnail_data' : string,
  'caption' : [] | [string],
  'width' : number,
  'chunk_size' : number,
  'blob_deleted' : boolean,
}
export interface Message {
  'id' : number,
  'content' : MessageContent,
  'sender' : UserId,
  'timestamp' : Timestamp,
  'replies_to' : [] | [ReplyContext],
  'client_message_id' : string,
}
export type MessageContent = { 'File' : FileContent } |
  { 'Text' : TextContent } |
  { 'Media' : MediaContent } |
  { 'Cycles' : CyclesContent };
export type RemoveParticipantResponse = { 'CannotRemoveSelfFromChat' : null } |
  { 'ParticipantNotFound' : null } |
  { 'ChatNotFound' : null } |
  { 'NotGroupChat' : null } |
  { 'Success' : null } |
  { 'Unauthorized' : null };
export interface ReplyContext {
  'content' : MessageContent,
  'user_id' : UserId,
  'chat_id' : ChatId,
  'message_id' : number,
}
export type SearchAllMessagesResponse = { 'Success' : SearchAllMessagesResult };
export interface SearchAllMessagesResult {
  'matches' : Array<SearchMessagesMatch>,
}
export interface SearchMessagesMatch { 'message' : Message, 'chat_id' : ChatId }
export interface SendDirectMessageRequest {
  'content' : MessageContent,
  'recipient' : UserId,
  'sender_name' : [] | [string],
  'replies_to' : [] | [ReplyContext],
  'client_message_id' : string,
}
export type SendDirectMessageResponse = { 'BalanceExceeded' : null } |
  { 'Success' : SendDirectMessageResult } |
  { 'RecipientBlocked' : null } |
  { 'InvalidRequest' : null } |
  { 'SenderBlocked' : null } |
  { 'MessageTooLong' : number } |
  { 'UserNotFound' : null } |
  { 'RecipientNotFound' : null };
export interface SendDirectMessageResult {
  'timestamp' : Timestamp,
  'message_id' : number,
  'chat_summary' : DirectChatSummary,
}
export interface SendMessageRequest {
  'content' : MessageContent,
  'sender_name' : [] | [string],
  'chat_id' : ChatId,
  'replies_to' : [] | [ReplyContext],
  'client_message_id' : string,
}
export type SendMessageResponse = { 'ChatNotFound' : null } |
  { 'Success' : SendMessageResult } |
  { 'RecipientBlocked' : null } |
  { 'InvalidRequest' : null } |
  { 'SenderBlocked' : null } |
  { 'MessageTooLong' : number };
export interface SendMessageResult {
  'timestamp' : Timestamp,
  'message_id' : number,
  'chat_summary' : ChatSummary,
}
export interface Stats {
  'cycles_balance' : bigint,
  'chunk_bytes' : bigint,
  'group_chat_count' : number,
  'image_message_count' : bigint,
  'memory_used' : bigint,
  'user_id' : Principal,
  'direct_chat_count' : number,
  'chunk_count' : number,
  'file_message_count' : bigint,
  'cycles_message_count' : bigint,
  'timestamp' : bigint,
  'text_message_count' : bigint,
  'cycles_transferred' : bigint,
  'pruneable_message_count' : number,
  'video_message_count' : bigint,
}
export interface TextContent { 'text' : string }
export type Timestamp = bigint;
export type UserId = Principal;
export interface _SERVICE {
  'add_participants' : (arg_0: ChatId, arg_1: Array<UserId>) => Promise<
      AddParticipantsResponse
    >,
  'block_user' : (arg_0: UserId, arg_1: boolean) => Promise<undefined>,
  'create_group_chat' : (arg_0: CreateGroupChatRequest) => Promise<
      CreateGroupChatResponse
    >,
  'delete_group' : (arg_0: ChatId) => Promise<DeleteGroupResponse>,
  'get_chats' : (arg_0: GetChatsRequest) => Promise<GetChatsResponse>,
  'get_chunk' : (arg_0: string, arg_1: number) => Promise<[] | [Array<number>]>,
  'get_messages' : (arg_0: ChatId, arg_1: number, arg_2: number) => Promise<
      GetMessagesResponse
    >,
  'get_messages_by_id' : (arg_0: ChatId, arg_1: Array<number>) => Promise<
      GetMessagesByIdResponse
    >,
  'get_updates' : (arg_0: GetUpdatesRequest) => Promise<GetUpdatesResponse>,
  'join_group' : (arg_0: ChatId) => Promise<JoinGroupResponse>,
  'leave_group' : (arg_0: ChatId) => Promise<LeaveGroupResponse>,
  'mark_read' : (arg_0: ChatId, arg_1: number, arg_2: number) => Promise<
      MarkReadResponse
    >,
  'put_chunk' : (arg_0: string, arg_1: number, arg_2: Array<number>) => Promise<
      boolean
    >,
  'remove_participant' : (arg_0: ChatId, arg_1: UserId) => Promise<
      RemoveParticipantResponse
    >,
  'search_all_messages' : (arg_0: string, arg_1: number) => Promise<
      SearchAllMessagesResponse
    >,
  'send_direct_message' : (arg_0: SendDirectMessageRequest) => Promise<
      SendDirectMessageResponse
    >,
  'send_message' : (arg_0: SendMessageRequest) => Promise<SendMessageResponse>,
  'stats' : () => Promise<Stats>,
  'toggle_notifications' : (arg_0: ChatId, arg_1: boolean) => Promise<undefined>,
}
