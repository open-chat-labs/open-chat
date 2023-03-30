import type { CandidAllocatedBucketResponse, CandidCanForwardResponse, CandidProjectedAllowance, CandidUserResponse } from "./candid/idl";
import {
    AllocatedBucketResponse,
    AllowanceExceeded,
    CanForwardResponse,
    ProjectedAllowance,
    StorageUserNotFound,
    StorageUserResponse,
    UnsupportedValueError
} from "openchat-shared";

export function allocatedBucketResponse(
    candid: CandidAllocatedBucketResponse
): AllocatedBucketResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            canisterId: candid.Success.canister_id,
            fileId: candid.Success.file_id,
            chunkSize: candid.Success.chunk_size,
            projectedAllowance: projectedAllowance(candid.Success.projected_allowance),
        };
    }
    if ("AllowanceExceeded" in candid) {
        return allowanceExceeded(candid.AllowanceExceeded);
    }
    if ("UserNotFound" in candid) {
        return userNotFound();
    }
    if ("BucketUnavailable" in candid) {
        return {
            kind: "bucket_unavailable",
        };
    }
    throw new UnsupportedValueError(
        "Unknown Index.CandidAllocatedBucketResponse type received",
        candid
    );
}

export function canForwardResponse(candid: CandidCanForwardResponse): CanForwardResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            projectedAllowance: projectedAllowance(candid.Success),
        };
    }
    if ("AllowanceExceeded" in candid) {
        return allowanceExceeded(candid.AllowanceExceeded);
    }
    if ("UserNotFound" in candid) {
        return userNotFound();
    }
    throw new UnsupportedValueError(
        "Unknown Index.CandidCanForwardResponse type received",
        candid
    );
}

export function userResponse(candid: CandidUserResponse): StorageUserResponse {
    if ("Success" in candid) {
        return {
            kind: "user",
            byteLimit: candid.Success.byte_limit,
            bytesUsed: candid.Success.bytes_used,
        };
    }
    if ("UserNotFound" in candid) {
        return userNotFound();
    }
    throw new UnsupportedValueError("Unknown Index.CandidUserResponse type received", candid);
}

function allowanceExceeded(candid: CandidProjectedAllowance): AllowanceExceeded {
    return {
        kind: "allowance_exceeded",
        projectedAllowance: projectedAllowance(candid)
    };
}

function userNotFound(): StorageUserNotFound {
    return { kind: "user_not_found" };
}

function projectedAllowance(candid: CandidProjectedAllowance): ProjectedAllowance {
    return {
        byteLimit: candid.byte_limit,
        bytesUsed: candid.bytes_used,
        bytesUsedAfterOperation: candid.bytes_used_after_operation,
    };
}
