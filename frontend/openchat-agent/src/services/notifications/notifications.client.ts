/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { HttpAgent, Identity } from "@dfinity/agent";
import { CanisterAgent } from "../canisterAgent";
import { subscriptionExistsResponse } from "./mappers";
import { toVoid } from "../../utils/mapping";
import {
    NotificationsIndexPushSubscriptionArgs,
    NotificationsIndexPushSubscriptionResponse,
    NotificationsIndexRemoveSubscriptionArgs,
    NotificationsIndexRemoveSubscriptionResponse,
    NotificationsIndexSubscriptionExistsArgs,
    NotificationsIndexSubscriptionExistsResponse,
} from "../../typebox";

export class NotificationsClient extends CanisterAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);
    }

    subscriptionExists(p256dh_key: string): Promise<boolean> {
        return this.executeMsgpackQuery(
            "subscription_exists",
            {
                p256dh_key,
            },
            subscriptionExistsResponse,
            NotificationsIndexSubscriptionExistsArgs,
            NotificationsIndexSubscriptionExistsResponse,
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
        return this.executeMsgpackUpdate(
            "push_subscription",
            request,
            toVoid,
            NotificationsIndexPushSubscriptionArgs,
            NotificationsIndexPushSubscriptionResponse,
        );
    }

    removeSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.executeMsgpackUpdate(
            "remove_subscription",
            {
                p256dh_key: subscription.keys!["p256dh"],
            },
            toVoid,
            NotificationsIndexRemoveSubscriptionArgs,
            NotificationsIndexRemoveSubscriptionResponse,
        );
    }
}
