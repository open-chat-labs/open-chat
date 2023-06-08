import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, OnlineService } from "./candid/idl";
import { CandidService } from "../candidService";
import { toVoid } from "../../utils/mapping";
import type { AgentConfig } from "../../config";
import { lastOnlineResponse } from "./mappers";

export class OnlineClient extends CandidService {
    private service: OnlineService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<OnlineService>(
            idlFactory,
            config.onlineCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): OnlineClient {
        return new OnlineClient(identity, config);
    }

    lastOnline(userIds: string[]): Promise<Record<string, number>> {
        const args = {
            user_ids: userIds.map((u) => Principal.fromText(u)),
        };
        return this.handleQueryResponse(() => this.service.last_online(args), lastOnlineResponse);
    }

    markAsOnline(): Promise<void> {
        return this.handleResponse(this.service.mark_as_online({}), toVoid);
    }
}
