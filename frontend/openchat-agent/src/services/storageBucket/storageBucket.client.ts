import type { HttpAgent, Identity } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import { idlFactory, type StorageBucketService } from "./candid/idl";
import { CanisterAgent } from "../canisterAgent";
import {
    deleteFileResponse,
    fileInfoResponse,
    forwardFileResponse,
    uploadChunkResponse,
} from "./mappers";
import type {
    DeleteFileResponse,
    FileInfoResponse,
    ForwardFileResponse,
    UploadChunkResponse,
} from "openchat-shared";

export class StorageBucketClient extends CanisterAgent {
    private service: StorageBucketService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, "StorageBucket");

        this.service = this.createServiceClient<StorageBucketService>(idlFactory);
    }

    uploadChunk(
        fileId: bigint,
        hash: Uint8Array,
        mimeType: string,
        accessors: Array<Principal>,
        totalSize: bigint,
        chunkSize: number,
        chunkIndex: number,
        bytes: Uint8Array,
        expiryTimestampMillis: bigint | undefined,
    ): Promise<UploadChunkResponse> {
        return this.handleResponse(
            this.service.upload_chunk_v2({
                accessors,
                chunk_index: chunkIndex,
                file_id: fileId,
                hash,
                mime_type: mimeType,
                total_size: totalSize,
                bytes,
                chunk_size: chunkSize,
                expiry: expiryTimestampMillis !== undefined ? [expiryTimestampMillis] : [],
            }),
            "upload_chunk_v2",
            uploadChunkResponse,
        );
    }

    forwardFile(fileId: bigint, accessors: Array<Principal>): Promise<ForwardFileResponse> {
        return this.handleResponse(
            this.service.forward_file({ file_id: fileId, accessors }),
            "forward_file",
            forwardFileResponse,
        );
    }

    deleteFile(fileId: bigint): Promise<DeleteFileResponse> {
        return this.handleResponse(
            this.service.delete_file({ file_id: fileId }),
            "delete_file",
            deleteFileResponse,
        );
    }

    fileInfo(fileId: bigint): Promise<FileInfoResponse> {
        return this.handleResponse(this.service.file_info({ file_id: fileId }), "file_info", fileInfoResponse);
    }
}
