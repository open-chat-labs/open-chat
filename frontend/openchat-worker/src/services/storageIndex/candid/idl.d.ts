import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    AllocatedBucketResponse,
    CanForwardResponse,
    ProjectedAllowance,
    UserResponse,
} from "./types";
export {
    _SERVICE as StorageIndexService,
    AllocatedBucketResponse as CandidAllocatedBucketResponse,
    CanForwardResponse as CandidCanForwardResponse,
    ProjectedAllowance as CandidProjectedAllowance,
    UserResponse as CandidUserResponse,
};

export const idlFactory: IDL.InterfaceFactory;
