import type { HttpAgent } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import { idlFactory, IndexService } from "./candid/idl";
import type { IIndexClient } from "./index.client.interface";
import { allocatedBucketResponse } from "./mappers";
import { CandidService } from "../candidService";
import type { AllocatedBucketResponse } from "../../domain/index";

export class IndexClient extends CandidService<IndexService> implements IIndexClient {
    constructor(agent: HttpAgent, canisterId: Principal) {
        super(agent, idlFactory, canisterId);
    }

    allocatedBucket(blobHash: bigint, blobSize: bigint): Promise<AllocatedBucketResponse> {
        return this.handleResponse(
            this.service.allocated_bucket({ blob_hash: blobHash, blob_size: blobSize }),
            allocatedBucketResponse
        );
    }
}
