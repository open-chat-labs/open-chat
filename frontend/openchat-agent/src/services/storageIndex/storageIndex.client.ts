import type { Identity } from "@dfinity/agent";
import { idlFactory, StorageIndexService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { IStorageIndexClient } from "./storageIndex.client.interface";
import { allocatedBucketResponse, canForwardResponse, userResponse } from "./mappers";
import type { AllocatedBucketResponse, CanForwardResponse, StorageUserResponse } from "openchat-shared";
import type { AgentConfig } from "../../config";

export class StorageIndexClient extends CandidService implements IStorageIndexClient {
    private service: StorageIndexService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<StorageIndexService>(
            idlFactory,
            config.openStorageIndexCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): IStorageIndexClient {
        return new StorageIndexClient(identity, config);
    }

    user(): Promise<StorageUserResponse> {
        return this.handleResponse(this.service.user({}), userResponse);
    }

    allocatedBucket(fileHash: Uint8Array, fileSize: bigint, fileIdSeed: bigint | undefined): Promise<AllocatedBucketResponse> {
        return this.handleResponse(
            this.service.allocated_bucket_v2({
                file_hash: fileHash,
                file_size: fileSize,
                file_id_seed: fileIdSeed === undefined
                    ? []
                    : [fileIdSeed]
            }),
            allocatedBucketResponse
        );
    }

    canForward(fileHash: Uint8Array, fileSize: bigint): Promise<CanForwardResponse> {
        return this.handleResponse(
            this.service.can_forward({ file_hash: fileHash, file_size: fileSize }),
            canForwardResponse
        );
    }
}
