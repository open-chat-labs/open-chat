import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type { Principal } from "@icp-sdk/core/principal";
import { idlFactory, type StorageBucketService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import {
    deleteFileResponse,
    fileInfoResponse,
    forwardFileResponse,
    uploadChunkResponse,
    vaultFileChunkResponse,
} from "./mappers";
import type {
    DeleteFileResponse,
    FileInfoResponse,
    ForwardFileResponse,
    UploadChunkResponse,
    VaultFileChunkResponse,
} from "@shared";

export class StorageBucketClient extends CandidCanisterAgent<StorageBucketService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory, "StorageBucket");
    }

    // Fetches one chunk of a quarantined blob for an allowlisted vault reviewer. An update
    // call by design: every fetch session is recorded in the vault's access log, and chunks
    // after the first are served only in session order.
    vaultFileChunk(fileId: bigint, chunkIndex: number): Promise<VaultFileChunkResponse> {
        return this.handleResponse(
            this.service.vault_file_chunk({ file_id: fileId, chunk_index: chunkIndex }),
            vaultFileChunkResponse,
        );
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
            uploadChunkResponse,
        );
    }

    forwardFile(fileId: bigint, accessors: Array<Principal>): Promise<ForwardFileResponse> {
        return this.handleResponse(
            this.service.forward_file({ file_id: fileId, accessors }),
            forwardFileResponse,
        );
    }

    deleteFile(fileId: bigint): Promise<DeleteFileResponse> {
        return this.handleResponse(
            this.service.delete_file({ file_id: fileId }),
            deleteFileResponse,
        );
    }

    fileInfo(fileId: bigint): Promise<FileInfoResponse> {
        return this.handleResponse(this.service.file_info({ file_id: fileId }), fileInfoResponse);
    }
}
