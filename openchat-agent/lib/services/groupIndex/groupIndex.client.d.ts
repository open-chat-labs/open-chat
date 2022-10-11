import type { Identity } from "@dfinity/agent";
import type { GroupSearchResponse } from "../../domain/search/search";
import { CandidService } from "../candidService";
import type { IGroupIndexClient } from "./groupIndex.client.interface";
export declare class GroupIndexClient extends CandidService implements IGroupIndexClient {
    private groupIndexService;
    private constructor();
    static create(identity: Identity): IGroupIndexClient;
    search(searchTerm: string, maxResults?: number): Promise<GroupSearchResponse>;
}
