import type { Principal } from '@dfinity/agent';
export type AddParticipantsResponse = {
    'ChatNotFound' : null
} |
    { 'NotGroupChat' : null } |
    { 'Success' : number } |
    { 'Unauthorized' : null };
export type ChatId = bigint;
export type ChatSummary = { 'Group' : GroupChatSummary } |
    { 'Direct' : DirectChatSummary };
export interface CreateGroupChatRequest {
    'participants' : Array<UserId>,
    'subject' : string,
    'chat_id' : ChatId,
};
export type CreateGroupChatResponse = { 'ChatAlreadyExists' : null } |
    { 'Success' : GroupChatSummary };
export interface CyclesContent {
    'caption' : [] | [string],
    'amount' : bigint,
};
export interface DirectChatSummary {
    'id' : ChatId,
    'them' : UserId,
    'last_updated' : Timestamp,
    'display_date' : Timestamp,
    'unread_by_them_message_id_ranges' : Array<Array<number>>,
    'latest_messages' : Array<Message>,
    'unread_by_me_message_id_ranges' : Array<Array<number>>,
};
export interface FileContent {
    'blob_size' : number,
    'blob_id' : string,
    'name' : string,
    'mime_type' : string,
    'caption' : [] | [string],
    'chunk_size' : number,
};
export interface GetChatsRequest {
    'message_count_for_top_chat' : [] | [number],
    'updated_since' : [] | [Timestamp],
};
export type GetChatsResponse = { 'Success' : Array<ChatSummary> };
export type GetMessagesByIdResponse = { 'ChatNotFound' : null } |
    { 'Success' : GetMessagesResult };
export type GetMessagesResponse = { 'ChatNotFound' : null } |
    { 'Success' : GetMessagesResult };
export interface GetMessagesResult {
    'messages' : Array<Message>,
    'latest_message_id' : number,
};
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
};
export type LeaveGroupResponse = { 'CannotLeaveGroupEmpty' : null } |
    { 'ParticipantNotFound' : null } |
    { 'ChatNotFound' : null } |
    { 'NotGroupChat' : null } |
    { 'Success' : null };

export type MarkReadResponse = { 'ChatNotFound' : null } |
    { 'Success' : MarkReadResult };
export interface MarkReadResult {
    'unread_message_id_ranges' : Array<Array<number>>,
};
export interface MediaContent {
    'height' : number,
    'blob_size' : number,
    'blob_id' : string,
    'mime_type' : string,
    'thumbnail_data' : string,
    'caption' : [] | [string],
    'width' : number,
    'chunk_size' : number,
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
};
export type SearchAllMessagesResponse = { 'Success' : SearchAllMessagesResult };
export interface SearchAllMessagesResult {
    'matches' : Array<SearchMessagesMatch>,
};
export interface SearchMessagesMatch {
    'message' : Message,
    'chat_id' : ChatId,
};
export interface SendDirectMessageRequest {
    'content' : MessageContent,
    'recipient' : UserId,
    'replies_to' : [] | [ReplyContext],
    'client_message_id' : string,
};
export type SendDirectMessageResponse = { 'BalanceExceeded' : null } |
    { 'Success' : SendDirectMessageResult } |
    { 'UserNotFound' : null } |
    { 'RecipientNotFound' : null };
export interface SendDirectMessageResult {
    'timestamp' : Timestamp,
    'message_id' : number,
    'chat_summary' : DirectChatSummary,
};
export interface SendMessageRequest {
    'content' : MessageContent,
    'chat_id' : ChatId,
    'replies_to' : [] | [ReplyContext],
    'client_message_id' : string,
};
export type SendMessageResponse = { 'ChatNotFound' : null } |
    { 'Success' : SendMessageResult };
export interface SendMessageResult {
    'timestamp' : Timestamp,
    'message_id' : number,
    'chat_summary' : ChatSummary,
};
export interface TextContent { 'text' : string };
export type Timestamp = bigint;
export type UserId = Principal;
export default interface _SERVICE {
    'add_participants' : (arg_0: ChatId, arg_1: Array<UserId>) => Promise<
        AddParticipantsResponse
        >,
    'create_group_chat' : (arg_0: CreateGroupChatRequest) => Promise<
        CreateGroupChatResponse
        >,
    'get_chats' : (arg_0: GetChatsRequest) => Promise<GetChatsResponse>,
    'get_chunk' : (arg_0: string, arg_1: number) => Promise<[] | [Array<number>]>,
    'get_messages' : (arg_0: ChatId, arg_1: number, arg_2: number) => Promise<
        GetMessagesResponse
        >,
    'get_messages_by_id' : (arg_0: ChatId, arg_1: Array<number>) => Promise<
        GetMessagesByIdResponse
        >,
    'leave_group' : (arg_0: ChatId) => Promise<
        LeaveGroupResponse
        >,
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
};