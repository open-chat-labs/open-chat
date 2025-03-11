import type {
    SubscriptionExistsResponse,
    ToggleMuteNotificationResponse,
} from "openchat-shared";
import type {
    CommunityToggleMuteNotificationsResponse,
    GroupToggleMuteNotificationsResponse,
    NotificationsIndexSubscriptionExistsResponse,
    UserMuteNotificationsResponse,
} from "../../typebox";

export function toggleNotificationsResponse(
    value:
        | UserMuteNotificationsResponse
        | GroupToggleMuteNotificationsResponse
        | CommunityToggleMuteNotificationsResponse,
): ToggleMuteNotificationResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("MuteNotification failed with: ", value);
        return "failure";
    }
}

export function subscriptionExistsResponse(
    value: NotificationsIndexSubscriptionExistsResponse,
): SubscriptionExistsResponse {
    return value === "Yes";
}
