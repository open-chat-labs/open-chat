import { idlFactory } from "./candid/idl";
import { CandidService } from "../candidService";
import { subscriptionExistsResponse } from "./mappers";
import { toVoid } from "../../utils/mapping";
export class NotificationsClient extends CandidService {
    constructor(identity) {
        super(identity);
        this.service = this.createServiceClient(idlFactory, "process.env.NOTIFICATIONS_CANISTER");
    }
    static create(identity) {
        return new NotificationsClient(identity);
    }
    subscriptionExists(p256dh_key) {
        return this.handleResponse(this.service.subscription_exists({
            p256dh_key,
        }), subscriptionExistsResponse);
    }
    pushSubscription(subscription) {
        const json = subscription.toJSON();
        const request = {
            subscription: {
                endpoint: json.endpoint,
                keys: {
                    auth: json.keys["auth"],
                    p256dh: json.keys["p256dh"],
                },
            },
        };
        return this.handleResponse(this.service.push_subscription(request), toVoid);
    }
    removeSubscription(subscription) {
        const json = subscription.toJSON();
        return this.handleResponse(this.service.remove_subscription({
            p256dh_key: json.keys["p256dh"]
        }), toVoid);
    }
}
//# sourceMappingURL=notifications.client.js.map