export interface INotificationsClient {
    subscriptionExists(p256dh_key: string): Promise<boolean>;
    pushSubscription(subscription: PushSubscription): Promise<void>;
    removeSubscription(subscription: PushSubscription): Promise<void>;
}
