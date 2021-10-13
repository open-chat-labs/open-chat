export interface INotificationsClient {
    subscriptionExists(userId: string, p256dh_key: string): Promise<boolean>;
    pushSubscription(userId: string, subscription: PushSubscription): Promise<void>;
}
