export const idlFactory = ({ IDL }) => {
  const InitArgs = IDL.Record({
    'push_service_principals' : IDL.Vec(IDL.Principal),
  });
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const MessageIndex = IDL.Nat32;
  const PushDirectMessageNotificationArgs = IDL.Record({
    'recipient' : UserId,
    'sender' : UserId,
    'message_index' : MessageIndex,
  });
  const PushDirectMessageNotificationResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  const GroupId = CanisterId;
  const PushGroupMessageNotificationArgs = IDL.Record({
    'sender' : UserId,
    'recipients' : IDL.Vec(UserId),
    'chat_id' : GroupId,
    'message_index' : MessageIndex,
  });
  const PushGroupMessageNotificationResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  const PushSubscriptionArgs = IDL.Record({
    'subscription' : IDL.Record({
      'endpoint' : IDL.Text,
      'keys' : IDL.Record({ 'auth' : IDL.Text, 'p256dh' : IDL.Text }),
    }),
    'user_id' : UserId,
  });
  const PushSubscriptionResponse = IDL.Variant({ 'Success' : IDL.Null });
  return IDL.Service({
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
  });
};
export const init = ({ IDL }) => {
  const InitArgs = IDL.Record({
    'push_service_principals' : IDL.Vec(IDL.Principal),
  });
  return [InitArgs];
};
