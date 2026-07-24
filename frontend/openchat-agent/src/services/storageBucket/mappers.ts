import type { VaultFileChunkResponse } from "@shared";
import type {
    CandidDeleteFileResponse,
    CandidFileInfoResponse,
    CandidForwardFileResponse,
    CandidUploadChunkResponse,
    CandidVaultFileChunkResponse,
} from "./candid/idl";
import type {
    DeleteFileResponse,
    FileInfoResponse,
    ForwardFileResponse,
    UploadChunkResponse,
} from "@shared";
import { UnsupportedValueError } from "@shared";

export function uploadChunkResponse(candid: CandidUploadChunkResponse): UploadChunkResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("FileAlreadyExists" in candid) {
        return "file_already_exists";
    }
    if ("FileTooBig" in candid) {
        return "file_too_big";
    }
    if ("FileExpired" in candid) {
        return "file_expired";
    }
    if ("ChunkAlreadyExists" in candid) {
        return "chunk_already_exists";
    }
    if ("ChunkSizeMismatch" in candid) {
        return "chunk_size_mismatch";
    }
    if ("ChunkIndexTooHigh" in candid) {
        return "chunk_index_too_high";
    }
    if ("AllowanceExceeded" in candid) {
        return "allowance_exceeded";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    if ("HashMismatch" in candid) {
        return "hash_mismatch";
    }
    if ("InvalidFileId" in candid) {
        return "invalid_file_id";
    }
    if ("Full" in candid) {
        return "full";
    }
    throw new UnsupportedValueError(
        "Unknown Bucket.CandidUploadChunkResponse type received",
        candid,
    );
}

export function forwardFileResponse(candid: CandidForwardFileResponse): ForwardFileResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            newFileId: candid.Success,
        };
    }
    if ("NotAuthorized" in candid) {
        return { kind: "not_authorized" };
    }
    if ("NotFound" in candid) {
        return { kind: "file_not_found" };
    }
    throw new UnsupportedValueError(
        "Unknown Bucket.CandidForwardFileResponse type received",
        candid,
    );
}

export function deleteFileResponse(candid: CandidDeleteFileResponse): DeleteFileResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("NotFound" in candid) {
        return "file_not_found";
    }
    throw new UnsupportedValueError(
        "Unknown Bucket.CandidDeleteFileResponse type received",
        candid,
    );
}

export function fileInfoResponse(candid: CandidFileInfoResponse): FileInfoResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            isOwner: candid.Success.is_owner,
            fileSize: candid.Success.file_size,
            fileHash: Array.isArray(candid.Success.file_hash)
                ? new Uint8Array(candid.Success.file_hash)
                : candid.Success.file_hash,
        };
    }
    if ("NotFound" in candid) {
        return { kind: "file_not_found" };
    }
    throw new UnsupportedValueError("Unknown Bucket.CandidFileInfoResponse type received", candid);
}

export function vaultFileChunkResponse(
    candid: CandidVaultFileChunkResponse,
): VaultFileChunkResponse {
    if ("Success" in candid) {
        const bytes = candid.Success.bytes;
        return {
            kind: "success",
            bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
            chunkIndex: candid.Success.chunk_index,
            chunkCount: candid.Success.chunk_count,
            totalSize: candid.Success.total_size,
            mimeType: candid.Success.mime_type,
        };
    }
    if ("SessionRequired" in candid) return { kind: "session_required" };
    if ("NotFound" in candid) return { kind: "not_found" };
    if ("NotAuthorized" in candid) return { kind: "not_authorized" };
    throw new UnsupportedValueError(
        "Unknown Bucket.CandidVaultFileChunkResponse type received",
        candid,
    );
}
