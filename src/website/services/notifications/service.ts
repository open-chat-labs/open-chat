import { UserId } from "../../domain/model/users";
import pushSubscription from "./pushSubscription";

export default class service {
    public static pushSubscription(userId: UserId, subscription: PushSubscription) : Promise<void> {
        return pushSubscription(userId, subscription);
    }
}