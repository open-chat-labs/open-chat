import type { Principal } from "@dfinity/principal";
import type { DeleteFileResponse, FileInfoResponse, ForwardFileResponse, UploadChunkResponse } from "openchat-shared";

export interface IStorageBucketClient {
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
    ): Promise<UploadChunkResponse>;
    forwardFile(fileId: bigint, accessors: Array<Principal>): Promise<ForwardFileResponse>;
    deleteFile(fileId: bigint): Promise<DeleteFileResponse>;
    fileInfo(fileId: bigint): Promise<FileInfoResponse>;
}
