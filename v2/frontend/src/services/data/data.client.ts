import { idlFactory, UserService } from "../user/candid/idl";
import { CandidService } from "../candidService";
import { chunkResponse } from "../user/mappers";
import type { ChunkResponse } from "../../domain/data/data";
import type { IDataClient } from "./data.client.interface";
import { db } from "../../utils/caching";
import { DataClientMock } from "./data.client.mock";
import { CachingDataClient } from "./data.caching.client";
import type { BlobReference } from "../../domain/chat/chat";

export class DataClient extends CandidService implements IDataClient {
    private dataService: UserService;

    static create(_canisterId: string): IDataClient {
        // todo - replace this with the real thing
        let client: IDataClient = new DataClientMock();
        if (db) {
            client = new CachingDataClient(db, client);
        }
        return client;
    }

    constructor(canisterId: string) {
        super();
        this.dataService = this.createServiceClient<UserService>(idlFactory, canisterId);
    }

    async getData({ blobId, blobSize, chunkSize }: BlobReference): Promise<ChunkResponse> {
        if (!blobSize || !chunkSize) {
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
