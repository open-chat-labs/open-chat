import { HttpAgent, Identity } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import async from "async";
import { v1 as uuidv1 } from "uuid";
import { BucketClient } from "./services/bucket/bucket.client";
import { IndexClient } from "./services/index/index.client";
import type { IIndexClient } from "./services/index/index.client.interface";
import { hashBytes } from "./utils/hash";

export class OpenStorageAgent {
    private readonly agent: HttpAgent;
    private readonly indexClient: IIndexClient;

    constructor(identity: Identity, indexCanisterId: Principal, fetchRootKey = false) {
        const agent = new HttpAgent({ identity });
        if (fetchRootKey) {
            agent.fetchRootKey();
        }
        this.agent = agent;
        this.indexClient = new IndexClient(agent, indexCanisterId);
    }

    async uploadBlob(
        mimeType: string,
        accessors: Array<Principal>,
        bytes: ArrayBuffer,
        onProgress?: (percentComplete: number) => void): Promise<UploadBlobResponse> {

        const hash = hashBytes(bytes);

        const allocatedBucketResponse = await this.indexClient.allocatedBucket(hash, BigInt(bytes.byteLength));

        if (allocatedBucketResponse.kind !== "success") {
            // TODO make this better!
            throw new Error(allocatedBucketResponse.kind);
        }

        const bucketCanisterId = allocatedBucketResponse.canisterId;
        const blobId = OpenStorageAgent.newBlobId();
        const blobSize = bytes.byteLength;
        const chunkSize = allocatedBucketResponse.chunkSize;
        const chunkCount = ((blobSize - 1) / chunkSize) + 1;
        const chunkIndexes = [...Array(chunkCount).keys()];

        const bucketClient = new BucketClient(this.agent, bucketCanisterId);

        let chunksCompleted = 0;

        await async.eachOfLimit(chunkIndexes, 10, async (chunkIndex) => {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, blobSize);
            const chunkBytes = Array.from(new Uint8Array(bytes.slice(start, end)));
            let attempt = 0;

            while (attempt++ < 5) {
                try {
                    const chunkResponse = await bucketClient.uploadChunk(
                        blobId,
                        hash,
                        mimeType,
                        accessors,
                        BigInt(blobSize),
                        chunkSize,
                        chunkIndex,
                        chunkBytes);

                    if (chunkResponse === "success") {
                        chunksCompleted++;
                        onProgress?.(100 * chunksCompleted / chunkCount);
                        return;
                    }
                } catch {
                }
            }
            throw new Error("Failed to upload chunk");
        });

        return {
            canisterId: bucketCanisterId,
            blobId,
            pathPrefix: "/blobs/",
        }
    }

    static newBlobId(): bigint {
        return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
    }
}

export interface UploadBlobResponse {
    canisterId: Principal,
    blobId: bigint,
    pathPrefix: string,
}
