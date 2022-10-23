/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Identity } from "@dfinity/agent";
import { idlFactory, NotificationsService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { INotificationsClient } from "./notifications.client.interface";
import { subscriptionExistsResponse } from "./mappers";
import { toVoid } from "../../utils/mapping";
import type { OpenChatConfig } from "../../config";

export class NotificationsClient extends CandidService implements INotificationsClient {
    private service: NotificationsService;

    private constructor(identity: Identity, config: OpenChatConfig) {
        super(identity);

        this.service = this.createServiceClient<NotificationsService>(
            idlFactory,
            config.notificationsCanister,
            config
        );
    }

    static create(identity: Identity, config: OpenChatConfig): INotificationsClient {
        return new NotificationsClient(identity, config);
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
                p256dh_key: json.keys!["p256dh"],
            }),
            toVoid
        );
    }
}
