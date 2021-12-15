import type { Principal } from "@dfinity/principal";
export declare type AllocatedBucketResponse =
    | AllocatedBucketSuccess
    | AllocatedBucketAllowanceReached
    | AllocatedBucketUserNotFound
    | AllocatedBucketBucketUnavailable;
export declare type AllocatedBucketSuccess = {
    kind: "success";
    canisterId: Principal;
    chunkSize: number;
};
export declare type AllocatedBucketAllowanceReached = {
    kind: "allowance_reached";
};
export declare type AllocatedBucketUserNotFound = {
    kind: "user_not_found";
};
export declare type AllocatedBucketBucketUnavailable = {
    kind: "bucket_unavailable";
};
