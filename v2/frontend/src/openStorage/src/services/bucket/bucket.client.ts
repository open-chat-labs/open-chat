import type { HttpAgent } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import type { IBucketClient } from "./bucket.client.interface";
import { idlFactory, BucketService } from "./candid/idl";
import { deleteBlobResponse, uploadChunkResponse } from "./mappers";
import { CandidService } from "../candidService";
import type { DeleteBlobResponse, UploadChunkResponse } from "../../domain/bucket";

export class BucketClient extends CandidService<BucketService> implements IBucketClient {
    constructor(agent: HttpAgent, canisterId: Principal) {
        super(agent, idlFactory, canisterId);
    }

    uploadChunk(
        blobId: bigint,
        hash: Array<number>,
        mimeType: string,
        accessors: Array<Principal>,
        totalSize: bigint,
        chunkSize: number,
        chunkIndex: number,
        bytes: Array<number>): Promise<UploadChunkResponse> {
        return this.handleResponse(
            this.service.upload_chunk({
                accessors,
                chunk_index: chunkIndex,
                blob_id: blobId,
                hash,
                mime_type: mimeType,
                total_size: totalSize,
                bytes,
                chunk_size: chunkSize,
            }),
            uploadChunkResponse
        );
    }

    deleteBlob(blobId: bigint): Promise<DeleteBlobResponse> {
        return this.handleResponse(
            this.service.delete_blob({ blob_id: blobId }),
            deleteBlobResponse
        );
    }
}
