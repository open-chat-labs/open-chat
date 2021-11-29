import type { HttpAgent } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import { IndexService } from "./candid/idl";
import type { IIndexClient } from "./index.client.interface";
import { CandidService } from "../candidService";
import type { AllocatedBucketResponse } from "../../domain/index";
export declare class IndexClient extends CandidService<IndexService> implements IIndexClient {
    constructor(agent: HttpAgent, canisterId: Principal);
    allocatedBucket(blobHash: Array<number>, blobSize: bigint): Promise<AllocatedBucketResponse>;
}
