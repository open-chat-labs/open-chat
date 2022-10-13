export const idlFactory = ({ IDL }) => {
  const SubscriptionKeys = IDL.Record({
    'auth' : IDL.Text,
    'p256dh' : IDL.Text
  });
  const SubscriptionInfo = IDL.Record({
    'endpoint' : IDL.Text,
    'keys' : SubscriptionKeys
  });
  const PushSubscriptionArgs = IDL.Record({
    'subscription' : SubscriptionInfo
  });
  const PushSubscriptionResponse = IDL.Variant({
    'Success' : IDL.Null,
    'InternalError' : IDL.Text
  });
  const RemoveSubscriptionArgs = IDL.Record({ 'p256dh_key' : IDL.Text });
  const RemoveSubscriptionResponse = IDL.Variant({ 'Success' : IDL.Null });
  const RemoveSubscriptionsForUserArgs = IDL.Record({});
  const RemoveSubscriptionsForUserResponse = IDL.Variant({
    'Success' : IDL.Null
  });
  const SubscriptionExistsArgs = IDL.Record({ 'p256dh_key' : IDL.Text });
  const SubscriptionExistsResponse = IDL.Variant({
    'No' : IDL.Null,
    'Yes' : IDL.Null
  });
  return IDL.Service({
    'push_subscription' : IDL.Func(
        [PushSubscriptionArgs],
        [PushSubscriptionResponse],
        []
      ),
    'remove_subscription' : IDL.Func(
        [RemoveSubscriptionArgs],
        [RemoveSubscriptionResponse],
        []
      ),
    'remove_subscriptions_for_user' : IDL.Func(
        [RemoveSubscriptionsForUserArgs],
        [RemoveSubscriptionsForUserResponse],
        []
      ),
    'subscription_exists' : IDL.Func(
        [SubscriptionExistsArgs],
        [SubscriptionExistsResponse],
        ['query']
      )
  });
};
export const init = ({ IDL }) => { return []; };
