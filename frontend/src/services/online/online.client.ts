/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Identity } from "@dfinity/agent";
import { idlFactory, OnlineService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { IOnlineClient } from "./online.client.interface";
import { toVoid } from "../../utils/mapping";

export class OnlineClient extends CandidService implements IOnlineClient {
    private service: OnlineService;

    private constructor(identity: Identity) {
        super(identity);

        this.service = this.createServiceClient<OnlineService>(
            idlFactory,
            "process.env.ONLINE_CANISTER"
        );
    }

    static create(identity: Identity): IOnlineClient {
        return new OnlineClient(identity);
    }

    markAsOnline(): Promise<void> {
        return this.handleResponse(this.service.mark_as_online({}), toVoid);
    }
}
