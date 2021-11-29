import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    UploadChunkResponse,
    DeleteBlobResponse,
} from "./types";
export {
    _SERVICE as BucketService,
    UploadChunkResponse as ApiUploadChunkResponse,
    DeleteBlobResponse as ApiDeleteBlobResponse,
};

export const idlFactory: IDL.InterfaceFactory;
