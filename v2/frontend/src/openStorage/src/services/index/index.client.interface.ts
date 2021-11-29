import type { AllocatedBucketResponse } from "../../domain/index";

export interface IIndexClient {
    allocatedBucket(blobHash: Array<number>, blobSize: bigint): Promise<AllocatedBucketResponse>;
}
