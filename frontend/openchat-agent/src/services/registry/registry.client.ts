import type { Identity } from "@dfinity/agent";
import type { RegistryUpdatesResponse } from "openchat-shared";
import { idlFactory, RegistryService } from "./candid/idl";
import { CandidService } from "../candidService";
import { updatesResponse } from "./mappers";
import type { AgentConfig } from "../../config";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class RegistryClient extends CandidService {
    private service: RegistryService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<RegistryService>(
            idlFactory,
            config.onlineCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): RegistryClient {
        return new RegistryClient(identity, config);
    }

    updates(since?: bigint): Promise<RegistryUpdatesResponse> {
        const args = {
            since: apiOptional(identity, since)
        };
        return this.handleQueryResponse(() => this.service.updates(args), updatesResponse);
    }
}
