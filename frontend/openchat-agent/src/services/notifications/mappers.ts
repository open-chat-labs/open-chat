import {
    SubscriptionExistsResponse,
    ToggleMuteNotificationResponse,
    UnsupportedValueError,
} from "openchat-shared";
import type {
    ApiMuteNotificationsResponse,
    ApiUnmuteNotificationsResponse,
} from "../user/candid/idl";
import type { ApiSubscriptionExistsResponse } from "./candid/idl";

export function muteNotificationsResponse(
    candid: ApiMuteNotificationsResponse | ApiUnmuteNotificationsResponse
): ToggleMuteNotificationResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        `Unexpected ApiToggleMuteNotificationsResponse type received`,
        candid
    );
}

export function subscriptionExistsResponse(
    candid: ApiSubscriptionExistsResponse
): SubscriptionExistsResponse {
    if ("Yes" in candid) {
        return true;
    }
    if ("No" in candid) {
        return false;
    }
    throw new UnsupportedValueError(
        `Unexpected ApiSubscriptionExistsResponse type received`,
        candid
    );
}
