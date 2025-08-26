import type { IDL } from "@icp-sdk/core/candid";
import {
    _SERVICE,
    DeleteFileResponse,
    FileInfoResponse,
    ForwardFileResponse,
    UploadChunkResponse,
} from "./types";
export {
    _SERVICE as StorageBucketService,
    DeleteFileResponse as CandidDeleteFileResponse,
    FileInfoResponse as CandidFileInfoResponse,
    ForwardFileResponse as CandidForwardFileResponse,
    UploadChunkResponse as CandidUploadChunkResponse,
};

export const idlFactory: IDL.InterfaceFactory;
