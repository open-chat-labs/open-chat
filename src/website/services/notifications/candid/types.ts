import type { Principal } from '@dfinity/principal';
export type CanisterId = Principal;
export type GroupId = CanisterId;
export interface InitArgs { 'push_service_principals' : Array<Principal> }
export type MessageIndex = number;
export interface PushDirectMessageNotificationArgs {
  'recipient' : UserId,
  'sender' : UserId,
  'message_index' : MessageIndex,
}
export type PushDirectMessageNotificationResponse = { 'Success' : null };
export interface PushGroupMessageNotificationArgs {
  'sender' : UserId,
  'recipients' : Array<UserId>,
  'chat_id' : GroupId,
  'message_index' : MessageIndex,
}
export type PushGroupMessageNotificationResponse = { 'Success' : null };
export interface PushSubscriptionArgs {
  'subscription' : {
    'endpoint' : string,
    'keys' : { 'auth' : string, 'p256dh' : string },
  },
  'user_id' : UserId,
}
export type PushSubscriptionResponse = { 'Success' : null };
export type UserId = CanisterId;
export interface _SERVICE {
  'push_direct_message_notification' : (
      arg_0: PushDirectMessageNotificationArgs,
    ) => Promise<PushDirectMessageNotificationResponse>,
  'push_group_message_notification' : (
      arg_0: PushGroupMessageNotificationArgs,
    ) => Promise<PushGroupMessageNotificationResponse>,
  'push_subscription' : (arg_0: PushSubscriptionArgs) => Promise<
      PushSubscriptionResponse
    >,
}
