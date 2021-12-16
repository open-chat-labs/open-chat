import { UnsupportedValueError } from "../../utils/error";
export function allocatedBucketResponse(candid) {
    if ("Success" in candid) {
        return {
            kind: "success",
            canisterId: candid.Success.canister_id,
            chunkSize: candid.Success.chunk_size,
        };
    }
    if ("AllowanceReached" in candid) {
        return {
            kind: "allowance_reached",
        };
    }
    if ("UserNotFound" in candid) {
        return {
            kind: "user_not_found",
        };
    }
    if ("BucketUnavailable" in candid) {
        return {
            kind: "bucket_unavailable",
        };
    }
    throw new UnsupportedValueError("Unknown Index.ApiAllocatedBucketResponse type received", candid);
}
//# sourceMappingURL=mappers.js.map