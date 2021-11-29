import { idlFactory } from "./candid/idl";
import { deleteBlobResponse, uploadChunkResponse } from "./mappers";
import { CandidService } from "../candidService";
export class BucketClient extends CandidService {
    constructor(agent, canisterId) {
        super(agent, idlFactory, canisterId);
    }
    uploadChunk(blobId, hash, mimeType, accessors, totalSize, chunkSize, chunkIndex, bytes) {
        return this.handleResponse(this.service.upload_chunk({
            accessors,
            chunk_index: chunkIndex,
            blob_id: blobId,
            hash,
            mime_type: mimeType,
            total_size: totalSize,
            bytes,
            chunk_size: chunkSize,
        }), uploadChunkResponse);
    }
    deleteBlob(blobId) {
        return this.handleResponse(this.service.delete_blob({ blob_id: blobId }), deleteBlobResponse);
    }
}
//# sourceMappingURL=bucket.client.js.map