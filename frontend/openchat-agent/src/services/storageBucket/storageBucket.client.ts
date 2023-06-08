import type { Identity } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import { idlFactory, StorageBucketService } from "./candid/idl";
import { CandidService } from "../candidService";
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
import type { AgentConfig } from "../../config";

export class StorageBucketClient extends CandidService {
    private service: StorageBucketService;

    private constructor(identity: Identity, config: AgentConfig, canisterId: string) {
        super(identity);

        this.service = this.createServiceClient<StorageBucketService>(
            idlFactory,
            canisterId,
            config
        );
    }

    static create(
        identity: Identity,
        config: AgentConfig,
        canisterId: string
    ): StorageBucketClient {
        return new StorageBucketClient(identity, config, canisterId);
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
        expiryTimestampMillis: bigint | undefined
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
            uploadChunkResponse
        );
    }

    forwardFile(fileId: bigint, accessors: Array<Principal>): Promise<ForwardFileResponse> {
        return this.handleResponse(
            this.service.forward_file({ file_id: fileId, accessors }),
            forwardFileResponse
        );
    }

    deleteFile(fileId: bigint): Promise<DeleteFileResponse> {
        return this.handleResponse(
            this.service.delete_file({ file_id: fileId }),
            deleteFileResponse
        );
    }

    fileInfo(fileId: bigint): Promise<FileInfoResponse> {
        return this.handleResponse(this.service.file_info({ file_id: fileId }), fileInfoResponse);
    }
}
