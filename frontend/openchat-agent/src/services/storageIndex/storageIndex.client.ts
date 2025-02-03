import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type StorageIndexService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { allocatedBucketResponse, canForwardResponse, userResponse } from "./mappers";
import type {
    AllocatedBucketResponse,
    CanForwardResponse,
    StorageUserResponse,
} from "openchat-shared";

export class StorageIndexClient extends CandidCanisterAgent<StorageIndexService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory);
    }

    user(): Promise<StorageUserResponse> {
        return this.handleResponse(this.service.user({}), userResponse);
    }

    allocatedBucket(
        fileHash: Uint8Array,
        fileSize: bigint,
        fileIdSeed: bigint | undefined,
    ): Promise<AllocatedBucketResponse> {
        return this.handleResponse(
            this.service.allocated_bucket_v2({
                file_hash: fileHash,
                file_size: fileSize,
                file_id_seed: fileIdSeed === undefined ? [] : [fileIdSeed],
            }),
            allocatedBucketResponse,
        );
    }

    canForward(fileHash: Uint8Array, fileSize: bigint): Promise<CanForwardResponse> {
        return this.handleResponse(
            this.service.can_forward({ file_hash: fileHash, file_size: fileSize }),
            canForwardResponse,
        );
    }
}
