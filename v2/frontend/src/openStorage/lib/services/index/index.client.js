import { idlFactory } from "./candid/idl";
import { allocatedBucketResponse } from "./mappers";
import { CandidService } from "../candidService";
export class IndexClient extends CandidService {
    constructor(agent, canisterId) {
        super(agent, idlFactory, canisterId);
    }
    allocatedBucket(blobHash, blobSize) {
        return this.handleResponse(this.service.allocated_bucket({ blob_hash: blobHash, blob_size: blobSize }), allocatedBucketResponse);
    }
}
//# sourceMappingURL=index.client.js.map