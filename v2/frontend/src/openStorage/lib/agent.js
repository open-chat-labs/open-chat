import { v1 as uuidv1 } from "uuid";
import { BucketClient } from "./services/bucket/bucket.client";
import { IndexClient } from "./services/index/index.client";
import { hashBytes } from "./utils/hash";
export class OpenStorageAgent {
    constructor(agent, indexCanisterId) {
        this.agent = agent;
        this.indexClient = new IndexClient(agent, indexCanisterId);
    }
    async uploadBlob(mimeType, accessors, bytes, onProgress) {
        const hash = Array.from(new Uint8Array(hashBytes(bytes)));
        const blobSize = bytes.byteLength;
        const allocatedBucketResponse = await this.indexClient.allocatedBucket(hash, BigInt(blobSize));
        if (allocatedBucketResponse.kind !== "success") {
            // TODO make this better!
            throw new Error(allocatedBucketResponse.kind);
        }
        const blobId = OpenStorageAgent.newBlobId();
        const bucketCanisterId = allocatedBucketResponse.canisterId;
        const chunkSize = allocatedBucketResponse.chunkSize;
        const chunkCount = Math.ceil(blobSize / chunkSize);
        const chunkIndexes = [...Array(chunkCount).keys()];
        const bucketClient = new BucketClient(this.agent, bucketCanisterId);
        let chunksCompleted = 0;
        const promises = chunkIndexes.map(async (chunkIndex) => {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, blobSize);
            const chunkBytes = Array.from(new Uint8Array(bytes.slice(start, end)));
            let attempt = 0;
            while (attempt++ < 5) {
                try {
                    const chunkResponse = await bucketClient.uploadChunk(blobId, hash, mimeType, accessors, BigInt(blobSize), chunkSize, chunkIndex, chunkBytes);
                    if (chunkResponse === "success") {
                        chunksCompleted++;
                        onProgress === null || onProgress === void 0 ? void 0 : onProgress(100 * chunksCompleted / chunkCount);
                        return;
                    }
                }
                catch (e) {
                    console.log("Error uploading chunk " + chunkIndex, e);
                }
            }
            throw new Error("Failed to upload chunk");
        });
        await Promise.all(promises);
        return {
            canisterId: bucketCanisterId,
            blobId,
            pathPrefix: "/blobs/",
        };
    }
    static newBlobId() {
        return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
    }
}
//# sourceMappingURL=agent.js.map