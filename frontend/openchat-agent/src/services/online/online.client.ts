import type { HttpAgent, Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, type OnlineService } from "./candid/idl";
import { CandidService } from "../candidService";
import { toVoid } from "../../utils/mapping";
import type { AgentConfig } from "../../config";
import { lastOnlineResponse } from "./mappers";

export class OnlineClient extends CandidService {
    private service: OnlineService;

    constructor(identity: Identity, agent: HttpAgent, config: AgentConfig) {
        super(identity, agent);

        this.service = this.createServiceClient<OnlineService>(idlFactory, config.onlineCanister);
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
