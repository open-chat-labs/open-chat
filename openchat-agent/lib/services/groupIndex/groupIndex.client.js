import { CandidService } from "../candidService";
import { idlFactory } from "./candid/idl";
import { groupSearchResponse } from "./mappers";
export class GroupIndexClient extends CandidService {
    constructor(identity) {
        super(identity);
        this.groupIndexService = this.createServiceClient(idlFactory, 
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        "process.env.GROUP_INDEX_CANISTER");
    }
    static create(identity) {
        return new GroupIndexClient(identity);
    }
    search(searchTerm, maxResults = 10) {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(() => this.groupIndexService.search(args), groupSearchResponse, args);
    }
}
//# sourceMappingURL=groupIndex.client.js.map