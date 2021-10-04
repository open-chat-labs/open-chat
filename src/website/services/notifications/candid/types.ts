import type { Principal } from '@dfinity/principal';
export interface BlobReference {
  'blob_size' : number,
  'blob_id' : string,
  'canister_id' : CanisterId,
  'chunk_size' : number,
}
export type CanisterId = Principal;
export interface CyclesContent { 'caption' : [] | [string], 'amount' : bigint }
export interface DirectMessage {
  'content' : MessageContent,
  'sent_by_me' : boolean,
  'message_id' : MessageId,
  'replies_to' : [] | [DirectMessageReplyContext],
  'message_index' : MessageIndex,
}
export interface DirectMessageNotification {
  'sender' : UserId,
  'message' : DirectMessage,
  'sender_name' : string,
}
export type DirectMessageReplyContext = {
    'Private' : { 'chat_id' : GroupId, 'event_index' : EventIndex }
  } |
  {
    'Standard' : {
      'content' : MessageContent,
      'sent_by_me' : boolean,
      'event_index' : EventIndex,
    }
  };
export type EventIndex = number;
export interface FileContent {
  'name' : string,
  'mime_type' : string,
  'blob_reference' : [] | [BlobReference],
  'caption' : [] | [string],
}
export type GroupId = CanisterId;
export interface GroupMessage {
  'content' : MessageContent,
  'sender' : UserId,
  'message_id' : MessageId,
  'replies_to' : [] | [GroupMessageReplyContext],
  'message_index' : MessageIndex,
}
export interface GroupMessageNotification {
  'sender' : UserId,
  'message' : GroupMessage,
  'sender_name' : string,
  'chat_id' : GroupId,
  'group_name' : string,
}
export interface GroupMessageReplyContext {
  'content' : MessageContent,
  'user_id' : UserId,
  'message_id' : MessageId,
  'message_index' : MessageIndex,
}
export interface IndexedNotification {
  'value' : NotificationEnvelope,
  'index' : bigint,
}
export interface InitArgs { 'push_service_principals' : Array<Principal> }
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
export type Notification = {
    'DirectMessageNotification' : DirectMessageNotification
  } |
  { 'GroupMessageNotification' : GroupMessageNotification } |
  { 'V1GroupMessageNotification' : V1GroupMessageNotification } |
  { 'V1DirectMessageNotification' : V1DirectMessageNotification };
export interface NotificationEnvelope {
  'notification' : Notification,
  'recipients' : Array<UserId>,
}
export interface NotificationsArgs { 'from_notification_index' : bigint }
export type NotificationsResponse = { 'NotAuthorized' : null } |
  { 'Success' : NotificationsSuccessResult };
export interface NotificationsSuccessResult {
  'subscriptions' : Array<[UserId, Array<Subscription>]>,
  'notifications' : Array<IndexedNotification>,
}
export interface PushDirectMessageNotificationArgs {
  'recipient' : UserId,
  'notification' : DirectMessageNotification,
}
export type PushDirectMessageNotificationResponse = { 'Success' : null };
export interface PushGroupMessageNotificationArgs {
  'notification' : GroupMessageNotification,
  'recipients' : Array<UserId>,
}
export type PushGroupMessageNotificationResponse = { 'Success' : null };
export interface PushSubscriptionArgs {
  'subscription' : Subscription,
  'user_id' : UserId,
}
export type PushSubscriptionResponse = { 'Success' : null };
export interface PushV1DirectMessageNotificationArgs {
  'recipient' : UserId,
  'notification' : V1DirectMessageNotification,
}
export type PushV1DirectMessageNotificationResponse = { 'Success' : null };
export interface PushV1GroupMessageNotificationArgs {
  'notification' : V1GroupMessageNotification,
  'recipients' : Array<UserId>,
}
export type PushV1GroupMessageNotificationResponse = { 'Success' : null };
export interface RemoveNotificationsArgs { 'up_to_notification_index' : bigint }
export type RemoveNotificationsResponse = { 'NotAuthorized' : null } |
  { 'Success' : null };
export interface RemoveSubscriptionsArgs {
  'subscriptions_by_user' : Array<
    { 'user_id' : UserId, 'p256dh_keys' : Array<string> }
  >,
}
export type RemoveSubscriptionsResponse = { 'NotAuthorized' : null } |
  { 'Success' : null };
export interface Subscription {
  'endpoint' : string,
  'keys' : { 'auth' : string, 'p256dh' : string },
}
export interface SubscriptionExistsArgs {
  'p256dh_key' : string,
  'user_id' : UserId,
}
export type SubscriptionExistsResponse = { 'No' : null } |
  { 'Yes' : null };
export interface TextContent { 'text' : string }
export type TimestampMillis = bigint;
export type UserId = CanisterId;
export type V1ChatId = bigint;
export interface V1CyclesContent {
  'caption' : [] | [string],
  'amount' : bigint,
}
export interface V1DirectMessageNotification {
  'chat_id' : string,
  'sender' : UserId,
  'message' : V1Message,
  'sender_name' : string,
}
export interface V1FileContent {
  'blob_size' : number,
  'blob_id' : string,
  'name' : string,
  'mime_type' : string,
  'caption' : [] | [string],
  'chunk_size' : number,
  'blob_deleted' : boolean,
}
export interface V1GroupMessageNotification {
  'sender' : UserId,
  'message' : V1Message,
  'sender_name' : string,
  'chat_id' : string,
  'group_name' : string,
}
export interface V1MediaContent {
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
export interface V1Message {
  'id' : number,
  'content' : V1MessageContent,
  'sender' : UserId,
  'timestamp' : TimestampMillis,
  'replies_to' : [] | [V1ReplyContext],
  'client_message_id' : string,
}
export type V1MessageContent = { 'File' : V1FileContent } |
  { 'Text' : V1TextContent } |
  { 'Media' : V1MediaContent } |
  { 'Cycles' : V1CyclesContent };
export interface V1ReplyContext {
  'content' : V1MessageContent,
  'user_id' : UserId,
  'chat_id' : V1ChatId,
  'message_id' : number,
}
export interface V1TextContent { 'text' : string }
export interface _SERVICE {
  'notifications' : (arg_0: NotificationsArgs) => Promise<
      NotificationsResponse
    >,
  'push_direct_message_notification' : (
      arg_0: PushDirectMessageNotificationArgs,
    ) => Promise<PushDirectMessageNotificationResponse>,
  'push_group_message_notification' : (
      arg_0: PushGroupMessageNotificationArgs,
    ) => Promise<PushGroupMessageNotificationResponse>,
  'push_subscription' : (arg_0: PushSubscriptionArgs) => Promise<
      PushSubscriptionResponse
    >,
  'push_v1direct_message_notification' : (
      arg_0: PushV1DirectMessageNotificationArgs,
    ) => Promise<PushV1DirectMessageNotificationResponse>,
  'push_v1group_message_notification' : (
      arg_0: PushV1GroupMessageNotificationArgs,
    ) => Promise<PushV1GroupMessageNotificationResponse>,
  'remove_notifications' : (arg_0: RemoveNotificationsArgs) => Promise<
      RemoveNotificationsResponse
    >,
  'remove_subscriptions' : (arg_0: RemoveSubscriptionsArgs) => Promise<
      RemoveSubscriptionsResponse
    >,
  'subscription_exists' : (arg_0: SubscriptionExistsArgs) => Promise<
      SubscriptionExistsResponse
    >,
}
