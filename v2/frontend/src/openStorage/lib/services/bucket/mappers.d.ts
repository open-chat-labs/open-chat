import type { ApiUploadChunkResponse, ApiDeleteBlobResponse } from "./candid/idl";
import type { UploadChunkResponse, DeleteBlobResponse } from "../../domain/bucket";
export declare function uploadChunkResponse(candid: ApiUploadChunkResponse): UploadChunkResponse;
export declare function deleteBlobResponse(candid: ApiDeleteBlobResponse): DeleteBlobResponse;
