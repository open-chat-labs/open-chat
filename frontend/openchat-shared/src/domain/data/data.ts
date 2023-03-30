import type { Principal } from "@dfinity/principal";

export interface BlobReference {
    blobId: bigint;
    canisterId: string;
}

export interface DataContent {
    blobReference?: BlobReference;
    blobData?: Uint8Array;
    blobUrl?: string;
}

export type StorageStatus = {
    byteLimit: number;
    bytesUsed: number;
};

export type UploadChunkResponse =
    | "success"
    | "file_already_exists"
    | "file_too_big"
    | "file_expired"
    | "chunk_already_exists"
    | "chunk_index_too_high"
    | "chunk_size_mismatch"
    | "allowance_exceeded"
    | "user_not_found"
    | "hash_mismatch"
    | "invalid_file_id"
    | "full";

export type ForwardFileResponse =
    | { kind: "success", newFileId: bigint }
    | { kind: "not_authorized" }
    | { kind: "file_not_found" };

export type DeleteFileResponse = "success" | "not_authorized" | "file_not_found";

export type FileInfoResponse =
    | FileInfoSuccess
    | { kind: "file_not_found" };

export type FileInfoSuccess = {
    kind: "success",
    isOwner: boolean,
    fileSize: bigint,
    fileHash: Uint8Array,
};

export type AllocatedBucketResponse =
    | AllocatedBucketSuccess
    | AllocatedBucketBucketUnavailable
    | AllowanceExceeded
    | StorageUserNotFound;

export type AllocatedBucketSuccess = {
    kind: "success";
    canisterId: Principal;
    fileId: bigint;
    chunkSize: number;
    projectedAllowance: ProjectedAllowance,
};

export type AllocatedBucketBucketUnavailable = {
    kind: "bucket_unavailable";
};

export type CanForwardResponse =
    | CanForwardSuccess
    | AllowanceExceeded
    | StorageUserNotFound;

export type CanForwardSuccess = {
    kind: "success",
    projectedAllowance: ProjectedAllowance
};

export interface UploadFileResponse {
    canisterId: string;
    fileId: bigint;
    pathPrefix: string;
    projectedAllowance: ProjectedAllowance,
}

export type StorageUserResponse = StorageUserRecord | StorageUserNotFound;

export type StorageUserRecord = {
    kind: "user";
    byteLimit: bigint;
    bytesUsed: bigint;
};

export type StorageUserNotFound = {
    kind: "user_not_found";
};

export type AllowanceExceeded = {
    kind: "allowance_exceeded",
    projectedAllowance: ProjectedAllowance
};

export type ProjectedAllowance = {
    byteLimit: bigint,
    bytesUsed: bigint,
    bytesUsedAfterOperation: bigint,
};
