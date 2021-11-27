import type { Principal } from "@dfinity/principal";
import type { DeleteBlobResponse, UploadChunkResponse } from "../../domain/bucket";

export interface IBucketClient {
    uploadChunk(
        blobId: bigint,
        hash: bigint,
        mimeType: string,
        accessors: Array<Principal>,
        totalSize: bigint,
        chunkSize: number,
        chunkIndex: number,
        bytes: Array<number>): Promise<UploadChunkResponse>;
    deleteBlob(blobId: bigint) : Promise<DeleteBlobResponse>;
}
