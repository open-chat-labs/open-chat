import type { AllocatedBucketResponse } from "../../domain/index";

export interface IIndexClient {
    allocatedBucket(blobHash: bigint, blobSize: bigint): Promise<AllocatedBucketResponse>;
}
