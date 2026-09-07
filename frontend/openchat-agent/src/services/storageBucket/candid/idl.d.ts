import type { IDL } from "@icp-sdk/core/candid";
import {
    _SERVICE,
    DeleteFileResponse,
    FileInfoResponse,
    ForwardFileResponse,
    UploadChunkResponse,
    VaultFileChunkResponse,
    VaultFileInfoResponse,
    VaultLogResponse,
} from "./types";
export {
    _SERVICE as StorageBucketService,
    DeleteFileResponse as CandidDeleteFileResponse,
    FileInfoResponse as CandidFileInfoResponse,
    ForwardFileResponse as CandidForwardFileResponse,
    UploadChunkResponse as CandidUploadChunkResponse,
    VaultFileChunkResponse as CandidVaultFileChunkResponse,
    VaultFileInfoResponse as CandidVaultFileInfoResponse,
    VaultLogResponse as CandidVaultLogResponse,
};

export const idlFactory: IDL.InterfaceFactory;
