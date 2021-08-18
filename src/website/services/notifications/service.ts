import { UserId } from "../../domain/model/users";
import pushSubscription from "./pushSubscription";
import subscriptionExists from "./subscriptionExists";

export default class service {
    public static pushSubscription(userId: UserId, subscription: PushSubscription) : Promise<void> {
        return pushSubscription(userId, subscription);
    }
    public static subscriptionExists(userId: UserId, p256dh_key: string) : Promise<boolean> {
        return subscriptionExists(userId, p256dh_key);
    }
}