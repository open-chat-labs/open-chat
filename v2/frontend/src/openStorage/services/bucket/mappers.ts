import type {
    ApiUploadChunkResponse,
    ApiDeleteBlobResponse,
} from "./candid/idl";
import type { UploadChunkResponse, DeleteBlobResponse } from "../../domain/bucket";
import { UnsupportedValueError } from "../../utils/error";

export function uploadChunkResponse(
    candid: ApiUploadChunkResponse
): UploadChunkResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("BlobAlreadyExists" in candid) {
        return "blob_already_exists";
    }
    if ("BlobTooBig" in candid) {
        return "blob_too_big";
    }
    if ("ChunkSizeMismatch" in candid) {
        return "chunk_size_mismatch";
    }
    if ("ChunkIndexTooHigh" in candid) {
        return "chunk_index_too_high";
    }
    if ("AllowanceReached" in candid) {
        return "allowance_reached";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    if ("HashMismatch" in candid) {
        return "hash_mismatch";
    }
    if ("Full" in candid) {
        return "full";
    }
    throw new UnsupportedValueError(
        "Unknown Bucket.ApiUploadChunkResponse type received",
        candid
    );
}

export function deleteBlobResponse(
    candid: ApiDeleteBlobResponse
): DeleteBlobResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("NotFound" in candid) {
        return "not_found";
    }
    throw new UnsupportedValueError(
        "Unknown Bucket.ApiDeleteBlobResponse type received",
        candid
    );
}
