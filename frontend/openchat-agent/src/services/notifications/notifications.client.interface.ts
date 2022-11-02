export interface INotificationsClient {
    subscriptionExists(p256dh_key: string): Promise<boolean>;
    pushSubscription(subscription: PushSubscriptionJSON): Promise<void>;
    removeSubscription(subscription: PushSubscriptionJSON): Promise<void>;
}
