import type { AllocatedBucketResponse, CanForwardResponse, StorageUserResponse } from "openchat-shared";

export interface IStorageIndexClient {
    user(): Promise<StorageUserResponse>;
    allocatedBucket(fileHash: Uint8Array, fileSize: bigint, fileIdSeed: bigint | undefined): Promise<AllocatedBucketResponse>;
    canForward(fileHash: Uint8Array, fileSize: bigint): Promise<CanForwardResponse>;
}
