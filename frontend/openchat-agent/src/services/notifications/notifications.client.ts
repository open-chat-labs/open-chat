/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Identity } from "@dfinity/agent";
import { idlFactory, NotificationsService } from "./candid/idl";
import { CandidService } from "../candidService";
import { subscriptionExistsResponse } from "./mappers";
import { toVoid } from "../../utils/mapping";
import type { AgentConfig } from "../../config";

export class NotificationsClient extends CandidService {
    private service: NotificationsService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<NotificationsService>(
            idlFactory,
            config.notificationsCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): NotificationsClient {
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

    pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        const request = {
            subscription: {
                endpoint: subscription.endpoint!,
                keys: {
                    auth: subscription.keys!["auth"],
                    p256dh: subscription.keys!["p256dh"],
                },
            },
        };
        return this.handleResponse(this.service.push_subscription(request), toVoid);
    }

    removeSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.handleResponse(
            this.service.remove_subscription({
                p256dh_key: subscription.keys!["p256dh"],
            }),
            toVoid
        );
    }
}
