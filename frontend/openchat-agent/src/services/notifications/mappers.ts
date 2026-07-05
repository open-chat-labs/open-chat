import type {
    SubscriptionExistsResponse,
} from "@shared";
import type {
    NotificationsIndexSubscriptionExistsResponse,
} from "../../typebox";

export function subscriptionExistsResponse(
    value: NotificationsIndexSubscriptionExistsResponse,
): SubscriptionExistsResponse {
    return value === "Yes";
}
