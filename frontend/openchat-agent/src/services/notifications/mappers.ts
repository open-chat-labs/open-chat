import type {
    SubscriptionExistsResponse,
} from "openchat-shared";
import type {
    NotificationsIndexSubscriptionExistsResponse,
} from "../../typebox";

export function subscriptionExistsResponse(
    value: NotificationsIndexSubscriptionExistsResponse,
): SubscriptionExistsResponse {
    return value === "Yes";
}
