import type { HttpAgent } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
export declare class OpenStorageAgent {
    private readonly agent;
    private readonly indexClient;
    constructor(agent: HttpAgent, indexCanisterId: Principal);
    uploadBlob(
        mimeType: string,
        accessors: Array<Principal>,
        bytes: ArrayBuffer,
        onProgress?: (percentComplete: number) => void
    ): Promise<UploadBlobResponse>;
    private static newBlobId;
}
export interface UploadBlobResponse {
    canisterId: Principal;
    blobId: bigint;
    pathPrefix: string;
}
