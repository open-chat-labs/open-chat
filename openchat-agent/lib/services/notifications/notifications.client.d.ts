import type { Identity } from "@dfinity/agent";
import { CandidService } from "../candidService";
import type { INotificationsClient } from "./notifications.client.interface";
export declare class NotificationsClient extends CandidService implements INotificationsClient {
    private service;
    private constructor();
    static create(identity: Identity): INotificationsClient;
    subscriptionExists(p256dh_key: string): Promise<boolean>;
    pushSubscription(subscription: PushSubscription): Promise<void>;
    removeSubscription(subscription: PushSubscription): Promise<void>;
}
