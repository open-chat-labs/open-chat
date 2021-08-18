import type { Identity } from "@dfinity/agent";
import { idlFactory, UserService } from "../user/candid/idl";
import { CandidService } from "../candidService";
import { chunkResponse } from "../user/mappers";
import type { ChunkResponse } from "../../domain/data/data";
import type { IDataClient } from "./data.client.interface";
import type { Principal } from "@dfinity/principal";

export class DataClient extends CandidService implements IDataClient {
    private dataService: UserService;

    constructor(identity: Identity, canisterId: Principal) {
        super(identity);
        this.dataService = this.createServiceClient<UserService>(idlFactory, canisterId.toString());
    }

    async getData(blobId: bigint, totalBytes?: number, chunkSize?: number): Promise<ChunkResponse> {
        if (!totalBytes || !chunkSize) {
            return this.getChunk(blobId, 0);
        }
        return undefined;
    }

    private async getChunk(blobId: bigint, chunkIndex: number): Promise<ChunkResponse> {
        return this.handleResponse(
            this.dataService.chunk({
                blob_id: blobId,
                index: chunkIndex,
            }),
            chunkResponse
        );
    }
}
