import { UnsupportedValueError } from "../../utils/error";
export function muteNotificationsResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError(`Unexpected ApiToggleMuteNotificationsResponse type received`, candid);
}
export function subscriptionExistsResponse(candid) {
    if ("Yes" in candid) {
        return true;
    }
    if ("No" in candid) {
        return false;
    }
    throw new UnsupportedValueError(`Unexpected ApiSubscriptionExistsResponse type received`, candid);
}
//# sourceMappingURL=mappers.js.map