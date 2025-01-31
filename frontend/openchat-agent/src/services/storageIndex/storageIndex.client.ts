import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type StorageIndexService } from "./candid/idl";
import { CanisterAgent } from "../canisterAgent";
import { allocatedBucketResponse, canForwardResponse, userResponse } from "./mappers";
import type {
    AllocatedBucketResponse,
    CanForwardResponse,
    StorageUserResponse,
} from "openchat-shared";

export class StorageIndexClient extends CanisterAgent {
    private service: StorageIndexService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, "StorageIndex");

        this.service = this.createServiceClient<StorageIndexService>(idlFactory);
    }

    user(): Promise<StorageUserResponse> {
        return this.handleQueryResponse(() => this.service.user({}), "user", userResponse);
    }

    allocatedBucket(
        fileHash: Uint8Array,
        fileSize: bigint,
        fileIdSeed: bigint | undefined,
    ): Promise<AllocatedBucketResponse> {
        return this.handleQueryResponse(
            () => this.service.allocated_bucket_v2({
                file_hash: fileHash,
                file_size: fileSize,
                file_id_seed: fileIdSeed === undefined ? [] : [fileIdSeed],
            }),
            "allocated_bucket_v2",
            allocatedBucketResponse,
        );
    }

    canForward(fileHash: Uint8Array, fileSize: bigint): Promise<CanForwardResponse> {
        return this.handleQueryResponse(
            () => this.service.can_forward({ file_hash: fileHash, file_size: fileSize }),
            "canForward",
            canForwardResponse,
        );
    }
}
