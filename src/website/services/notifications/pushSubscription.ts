import CanisterClientFactory from "../CanisterClientFactory";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import { UserId } from "../../domain/model/users";
import { PushSubscriptionArgs } from "./candid/types";

export default async function(userId: UserId, subscription: PushSubscription) : Promise<void> {
    const client = CanisterClientFactory.current!.notificationsClient;
    let subscriptionJson = subscription.toJSON();
    const args: PushSubscriptionArgs = {
        user_id: userIdToCandid(userId),
        subscription: {
            endpoint: subscriptionJson.endpoint!,
            keys: {
                auth: subscriptionJson.keys!["auth"],
                p256dh: subscriptionJson.keys!["p256dh"],
            }
        }
    };
    await client.push_subscription(args);
}
