export const idlFactory = ({ IDL }) => {
  const InitArgs = IDL.Record({
    'push_service_principals' : IDL.Vec(IDL.Principal),
  });
  const NotificationsArgs = IDL.Record({
    'from_notification_index' : IDL.Nat64,
  });
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const Subscription = IDL.Record({
    'endpoint' : IDL.Text,
    'keys' : IDL.Record({ 'auth' : IDL.Text, 'p256dh' : IDL.Text }),
  });
  const BlobReference = IDL.Record({
    'blob_size' : IDL.Nat32,
    'blob_id' : IDL.Text,
    'canister_id' : CanisterId,
    'chunk_size' : IDL.Nat32,
  });
  const FileContent = IDL.Record({
    'name' : IDL.Text,
    'mime_type' : IDL.Text,
    'blob_reference' : IDL.Opt(BlobReference),
    'caption' : IDL.Opt(IDL.Text),
  });
  const TextContent = IDL.Record({ 'text' : IDL.Text });
  const MediaContent = IDL.Record({
    'height' : IDL.Nat32,
    'mime_type' : IDL.Text,
    'blob_reference' : IDL.Opt(BlobReference),
    'thumbnail_data' : IDL.Text,
    'caption' : IDL.Opt(IDL.Text),
    'width' : IDL.Nat32,
  });
  const CyclesContent = IDL.Record({
    'caption' : IDL.Opt(IDL.Text),
    'amount' : IDL.Nat,
  });
  const MessageContent = IDL.Variant({
    'File' : FileContent,
    'Text' : TextContent,
    'Media' : MediaContent,
    'Cycles' : CyclesContent,
  });
  const MessageId = IDL.Nat;
  const GroupId = CanisterId;
  const EventIndex = IDL.Nat32;
  const DirectMessageReplyContext = IDL.Variant({
    'Private' : IDL.Record({ 'chat_id' : GroupId, 'event_index' : EventIndex }),
    'Standard' : IDL.Record({
      'content' : MessageContent,
      'sent_by_me' : IDL.Bool,
      'event_index' : EventIndex,
    }),
  });
  const MessageIndex = IDL.Nat32;
  const DirectMessage = IDL.Record({
    'content' : MessageContent,
    'sent_by_me' : IDL.Bool,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(DirectMessageReplyContext),
    'message_index' : MessageIndex,
  });
  const DirectMessageNotification = IDL.Record({
    'sender' : UserId,
    'message' : DirectMessage,
    'sender_name' : IDL.Text,
  });
  const GroupMessageReplyContext = IDL.Record({
    'content' : MessageContent,
    'user_id' : UserId,
    'message_id' : MessageId,
    'message_index' : MessageIndex,
  });
  const GroupMessage = IDL.Record({
    'content' : MessageContent,
    'sender' : UserId,
    'message_id' : MessageId,
    'replies_to' : IDL.Opt(GroupMessageReplyContext),
    'message_index' : MessageIndex,
  });
  const GroupMessageNotification = IDL.Record({
    'sender' : UserId,
    'message' : GroupMessage,
    'sender_name' : IDL.Text,
    'chat_id' : GroupId,
    'group_name' : IDL.Text,
  });
  const V1FileContent = IDL.Record({
    'blob_size' : IDL.Nat32,
    'blob_id' : IDL.Text,
    'name' : IDL.Text,
    'mime_type' : IDL.Text,
    'caption' : IDL.Opt(IDL.Text),
    'chunk_size' : IDL.Nat32,
    'blob_deleted' : IDL.Bool,
  });
  const V1TextContent = IDL.Record({ 'text' : IDL.Text });
  const V1MediaContent = IDL.Record({
    'height' : IDL.Nat32,
    'blob_size' : IDL.Nat32,
    'blob_id' : IDL.Text,
    'mime_type' : IDL.Text,
    'thumbnail_data' : IDL.Text,
    'caption' : IDL.Opt(IDL.Text),
    'width' : IDL.Nat32,
    'chunk_size' : IDL.Nat32,
    'blob_deleted' : IDL.Bool,
  });
  const V1CyclesContent = IDL.Record({
    'caption' : IDL.Opt(IDL.Text),
    'amount' : IDL.Nat,
  });
  const V1MessageContent = IDL.Variant({
    'File' : V1FileContent,
    'Text' : V1TextContent,
    'Media' : V1MediaContent,
    'Cycles' : V1CyclesContent,
  });
  const TimestampMillis = IDL.Nat64;
  const V1ChatId = IDL.Nat;
  const V1ReplyContext = IDL.Record({
    'content' : V1MessageContent,
    'user_id' : UserId,
    'chat_id' : V1ChatId,
    'message_id' : IDL.Nat32,
  });
  const V1Message = IDL.Record({
    'id' : IDL.Nat32,
    'content' : V1MessageContent,
    'sender' : UserId,
    'timestamp' : TimestampMillis,
    'replies_to' : IDL.Opt(V1ReplyContext),
    'client_message_id' : IDL.Text,
  });
  const V1GroupMessageNotification = IDL.Record({
    'sender' : UserId,
    'message' : V1Message,
    'sender_name' : IDL.Text,
    'chat_id' : IDL.Text,
    'group_name' : IDL.Text,
  });
  const V1DirectMessageNotification = IDL.Record({
    'chat_id' : IDL.Text,
    'sender' : UserId,
    'message' : V1Message,
    'sender_name' : IDL.Text,
  });
  const Notification = IDL.Variant({
    'DirectMessageNotification' : DirectMessageNotification,
    'GroupMessageNotification' : GroupMessageNotification,
    'V1GroupMessageNotification' : V1GroupMessageNotification,
    'V1DirectMessageNotification' : V1DirectMessageNotification,
  });
  const NotificationEnvelope = IDL.Record({
    'notification' : Notification,
    'recipients' : IDL.Vec(UserId),
  });
  const IndexedNotification = IDL.Record({
    'value' : NotificationEnvelope,
    'index' : IDL.Nat64,
  });
  const NotificationsSuccessResult = IDL.Record({
    'subscriptions' : IDL.Vec(IDL.Tuple(UserId, IDL.Vec(Subscription))),
    'notifications' : IDL.Vec(IndexedNotification),
  });
  const NotificationsResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : NotificationsSuccessResult,
  });
  const PushDirectMessageNotificationArgs = IDL.Record({
    'recipient' : UserId,
    'notification' : DirectMessageNotification,
  });
  const PushDirectMessageNotificationResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  const PushGroupMessageNotificationArgs = IDL.Record({
    'notification' : GroupMessageNotification,
    'recipients' : IDL.Vec(UserId),
  });
  const PushGroupMessageNotificationResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  const PushSubscriptionArgs = IDL.Record({
    'subscription' : Subscription,
    'user_id' : UserId,
  });
  const PushSubscriptionResponse = IDL.Variant({ 'Success' : IDL.Null });
  const PushV1DirectMessageNotificationArgs = IDL.Record({
    'recipient' : UserId,
    'notification' : V1DirectMessageNotification,
  });
  const PushV1DirectMessageNotificationResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  const PushV1GroupMessageNotificationArgs = IDL.Record({
    'notification' : V1GroupMessageNotification,
    'recipients' : IDL.Vec(UserId),
  });
  const PushV1GroupMessageNotificationResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  const RemoveNotificationsArgs = IDL.Record({
    'up_to_notification_index' : IDL.Nat64,
  });
  const RemoveNotificationsResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const RemoveSubscriptionsArgs = IDL.Record({
    'subscriptions_by_user' : IDL.Vec(
      IDL.Record({ 'user_id' : UserId, 'p256dh_keys' : IDL.Vec(IDL.Text) })
    ),
  });
  const RemoveSubscriptionsResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const SubscriptionExistsArgs = IDL.Record({
    'p256dh_key' : IDL.Text,
    'user_id' : UserId,
  });
  const SubscriptionExistsResponse = IDL.Variant({
    'No' : IDL.Null,
    'Yes' : IDL.Null,
  });
  return IDL.Service({
    'notifications' : IDL.Func(
        [NotificationsArgs],
        [NotificationsResponse],
        ['query'],
      ),
    'push_direct_message_notification' : IDL.Func(
        [PushDirectMessageNotificationArgs],
        [PushDirectMessageNotificationResponse],
        [],
      ),
    'push_group_message_notification' : IDL.Func(
        [PushGroupMessageNotificationArgs],
        [PushGroupMessageNotificationResponse],
        [],
      ),
    'push_subscription' : IDL.Func(
        [PushSubscriptionArgs],
        [PushSubscriptionResponse],
        [],
      ),
    'push_v1direct_message_notification' : IDL.Func(
        [PushV1DirectMessageNotificationArgs],
        [PushV1DirectMessageNotificationResponse],
        [],
      ),
    'push_v1group_message_notification' : IDL.Func(
        [PushV1GroupMessageNotificationArgs],
        [PushV1GroupMessageNotificationResponse],
        [],
      ),
    'remove_notifications' : IDL.Func(
        [RemoveNotificationsArgs],
        [RemoveNotificationsResponse],
        [],
      ),
    'remove_subscriptions' : IDL.Func(
        [RemoveSubscriptionsArgs],
        [RemoveSubscriptionsResponse],
        [],
      ),
    'subscription_exists' : IDL.Func(
        [SubscriptionExistsArgs],
        [SubscriptionExistsResponse],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => {
  const InitArgs = IDL.Record({
    'push_service_principals' : IDL.Vec(IDL.Principal),
  });
  return [InitArgs];
};
