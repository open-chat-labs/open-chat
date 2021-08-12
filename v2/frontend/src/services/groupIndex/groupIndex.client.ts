import type { Identity } from "@dfinity/agent";
import idlFactory, { GroupIndexService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { IGroupIndexClient } from "./groupIndex.client.interface";

export class GroupIndexClient extends CandidService implements IGroupIndexClient {
    private groupIndexService: GroupIndexService;

    constructor(identity: Identity) {
        super(identity);
        this.groupIndexService = this.createServiceClient<GroupIndexService>(
            idlFactory,
            "user_index_canister_id" // todo - where does this come from - probably an env var
        );
    }

    todo(): string {
        return "todo";
    }
}
