import type { Identity } from "@dfinity/agent";
import { idlFactory, NotificationsService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { INotificationsClient } from "./notifications.client.interface";

export class NotificationsClient extends CandidService implements INotificationsClient {
    private service: NotificationsService;

    private constructor(identity: Identity) {
        super(identity);

        this.service = this.createServiceClient<NotificationsService>(
            idlFactory,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            "process.env.NOTIFICATIONS_CANISTER"
        );
    }

    static create(identity: Identity): INotificationsClient {
        return new NotificationsClient(identity);
    }

    test(): void {
        return undefined;
    }
}
