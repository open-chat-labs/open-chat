import type { Identity } from "@dfinity/agent";
import { idlFactory } from "./candid/idl";
import type { GroupIndexService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { IGroupIndexClient } from "./groupIndex.client.interface";
import type { GroupSearchResponse } from "../../domain/search/search";
import { groupSearchResponse } from "./mappers";

export class GroupIndexClient extends CandidService implements IGroupIndexClient {
    private groupIndexService: GroupIndexService;

    private constructor(identity: Identity) {
        super(identity);

        this.groupIndexService = this.createServiceClient<GroupIndexService>(
            idlFactory,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            process.env.GROUP_INDEX_CANISTER!
        );
    }

    static create(identity: Identity): IGroupIndexClient {
        return new GroupIndexClient(identity);
    }

    search(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this.handleResponse(
            this.groupIndexService.search({
                search_term: searchTerm,
                max_results: maxResults,
            }),
            groupSearchResponse
        );
    }
}
