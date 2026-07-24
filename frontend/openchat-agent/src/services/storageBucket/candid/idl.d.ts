import type { IDL } from "@icp-sdk/core/candid";
import {
    _SERVICE,
    DeleteFileResponse,
    FileInfoResponse,
    ForwardFileResponse,
    UploadChunkResponse,
    VaultFileChunkResponse,
} from "./types";
export {
    _SERVICE as StorageBucketService,
    DeleteFileResponse as CandidDeleteFileResponse,
    FileInfoResponse as CandidFileInfoResponse,
    ForwardFileResponse as CandidForwardFileResponse,
    UploadChunkResponse as CandidUploadChunkResponse,
    VaultFileChunkResponse as CandidVaultFileChunkResponse,
};

export const idlFactory: IDL.InterfaceFactory;
