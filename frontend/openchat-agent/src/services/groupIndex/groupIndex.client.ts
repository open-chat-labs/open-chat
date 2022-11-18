import type { Identity } from "@dfinity/agent";
import type { AgentConfig } from "../../config";
import type { GroupSearchResponse } from "openchat-shared";
import { CandidService } from "../candidService";
import { idlFactory, GroupIndexService } from "./candid/idl";
import type { IGroupIndexClient } from "./groupIndex.client.interface";
import { groupSearchResponse } from "./mappers";

export class GroupIndexClient extends CandidService implements IGroupIndexClient {
    private groupIndexService: GroupIndexService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.groupIndexService = this.createServiceClient<GroupIndexService>(
            idlFactory,
            config.groupIndexCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): IGroupIndexClient {
        return new GroupIndexClient(identity, config);
    }

    search(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(
            () => this.groupIndexService.search(args),
            groupSearchResponse,
            args
        );
    }
}
