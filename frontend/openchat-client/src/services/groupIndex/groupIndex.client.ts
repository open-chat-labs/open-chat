import type { Identity } from "@dfinity/agent";
import type { OpenChatConfig } from "../../config";
import type { GroupSearchResponse } from "../../domain/search/search";
import { CandidService } from "../candidService";
import { idlFactory, GroupIndexService } from "./candid/idl";
import type { IGroupIndexClient } from "./groupIndex.client.interface";
import { groupSearchResponse } from "./mappers";

export class GroupIndexClient extends CandidService implements IGroupIndexClient {
    private groupIndexService: GroupIndexService;

    private constructor(identity: Identity, config: OpenChatConfig) {
        super(identity);

        this.groupIndexService = this.createServiceClient<GroupIndexService>(
            idlFactory,
            config.groupIndexCanister,
            config
        );
    }

    static create(identity: Identity, config: OpenChatConfig): IGroupIndexClient {
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
