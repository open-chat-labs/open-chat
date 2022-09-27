/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Identity } from "@dfinity/agent";
import { idlFactory, NotificationsService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { INotificationsClient } from "./notifications.client.interface";
import { subscriptionExistsResponse } from "./mappers";
import { toVoid } from "../../utils/mapping";

export class NotificationsClient extends CandidService implements INotificationsClient {
    private service: NotificationsService;

    private constructor(identity: Identity) {
        super(identity);

        this.service = this.createServiceClient<NotificationsService>(
            idlFactory,
            "process.env.NOTIFICATIONS_CANISTER"
        );
    }

    static create(identity: Identity): INotificationsClient {
        return new NotificationsClient(identity);
    }

    subscriptionExists(p256dh_key: string): Promise<boolean> {
        return this.handleResponse(
            this.service.subscription_exists({
                p256dh_key,
            }),
            subscriptionExistsResponse
        );
    }

    pushSubscription(subscription: PushSubscription): Promise<void> {
        const json = subscription.toJSON();
        const request = {
            subscription: {
                endpoint: json.endpoint!,
                keys: {
                    auth: json.keys!["auth"],
                    p256dh: json.keys!["p256dh"],
                },
            },
        };
        return this.handleResponse(this.service.push_subscription(request), toVoid);
    }

    removeSubscription(subscription: PushSubscription): Promise<void> {
        const json = subscription.toJSON();
        return this.handleResponse(
            this.service.remove_subscription({
                p256dh_key: json.keys!["p256dh"]
            }),
            toVoid
        );
    }
}
