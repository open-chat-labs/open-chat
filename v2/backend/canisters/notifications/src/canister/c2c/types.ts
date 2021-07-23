import type { Principal } from '@dfinity/agent';
export interface BlobReference {
  'blob_size' : number,
  'blob_id' : string,
  'canister_id' : CanisterId,
  'chunk_size' : number,
};
export type CanisterId = Principal;
export interface CyclesContent { 'caption' : [] | [string], 'amount' : bigint };
export interface FileContent {
  'name' : string,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
};
export type GroupId = CanisterId;
export interface MediaContent {
  'height' : number,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'thumbnail_data' : string,
  'caption' : [] | [string],
  'width' : number,
};
export type MessageContent = { 'File' : FileContent } |
  { 'Text' : TextContent } |
  { 'Media' : MediaContent } |
  { 'Cycles' : CyclesContent };
export type MessageIndex = number;
export interface PushDirectMessageNotificationArgs {
  'content' : MessageContent,
  'recipient' : UserId,
  'sender' : UserId,
  'message_index' : MessageIndex,
};
export type PushDirectMessageNotificationResponse = { 'Success' : null };
export interface PushGroupMessageNotificationArgs {
  'content' : MessageContent,
  'sender' : UserId,
  'recipients' : Array<UserId>,
  'chat_id' : GroupId,
  'message_index' : MessageIndex,
};
export type PushGroupMessageNotificationResponse = { 'Success' : null };
export interface PushSubscriptionArgs {
  'subscription' : string,
  'user_id' : UserId,
};
export type PushSubscriptionResponse = { 'Success' : null };
export interface TextContent { 'text' : string };
export type UserId = CanisterId;
export default interface _SERVICE {
  'push_direct_message_notification' : (
      arg_0: PushDirectMessageNotificationArgs,
    ) => Promise<PushDirectMessageNotificationResponse>,
  'push_group_message_notification' : (
      arg_0: PushGroupMessageNotificationArgs,
    ) => Promise<PushGroupMessageNotificationResponse>,
  'push_subscription' : (arg_0: PushSubscriptionArgs) => Promise<
      PushSubscriptionResponse
    >,
};
