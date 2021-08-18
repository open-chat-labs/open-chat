import CanisterClientFactory from "../CanisterClientFactory";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import { UserId } from "../../domain/model/users";
import { SubscriptionExistsArgs } from "./candid/types";

export default async function(userId: UserId, p256dh_key: string) : Promise<boolean> {
    const client = CanisterClientFactory.current!.notificationsClient;
    const args: SubscriptionExistsArgs = {
        user_id: userIdToCandid(userId),
        p256dh_key
    };    
    const response = await client.subscription_exists(args);
    return "Yes" in response;
}
