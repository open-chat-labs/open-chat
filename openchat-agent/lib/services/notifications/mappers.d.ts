import type { SubscriptionExistsResponse, ToggleMuteNotificationResponse } from "../../domain/notifications";
import type { ApiMuteNotificationsResponse, ApiUnmuteNotificationsResponse } from "../user/candid/idl";
import type { ApiSubscriptionExistsResponse } from "./candid/idl";
export declare function muteNotificationsResponse(candid: ApiMuteNotificationsResponse | ApiUnmuteNotificationsResponse): ToggleMuteNotificationResponse;
export declare function subscriptionExistsResponse(candid: ApiSubscriptionExistsResponse): SubscriptionExistsResponse;
