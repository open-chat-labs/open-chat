import type { HttpAgent } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import type { IBucketClient } from "./bucket.client.interface";
import { BucketService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { DeleteBlobResponse, UploadChunkResponse } from "../../domain/bucket";
export declare class BucketClient extends CandidService<BucketService> implements IBucketClient {
    constructor(agent: HttpAgent, canisterId: Principal);
    uploadChunk(
        blobId: bigint,
        hash: Array<number>,
        mimeType: string,
        accessors: Array<Principal>,
        totalSize: bigint,
        chunkSize: number,
        chunkIndex: number,
        bytes: Array<number>
    ): Promise<UploadChunkResponse>;
    deleteBlob(blobId: bigint): Promise<DeleteBlobResponse>;
}
