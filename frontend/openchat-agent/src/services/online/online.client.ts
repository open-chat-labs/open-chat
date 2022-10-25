import type { Identity } from "@dfinity/agent";
import { idlFactory, OnlineService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { IOnlineClient } from "./online.client.interface";
import { toVoid } from "../../utils/mapping";
import type { AgentConfig } from "../../config";

export class OnlineClient extends CandidService implements IOnlineClient {
    private service: OnlineService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<OnlineService>(
            idlFactory,
            config.onlineCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): IOnlineClient {
        return new OnlineClient(identity, config);
    }

    markAsOnline(): Promise<void> {
        return this.handleResponse(this.service.mark_as_online({}), toVoid);
    }
}
