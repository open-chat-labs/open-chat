import { idlFactory, UserService } from "../user/candid/idl";
import { CandidService } from "../candidService";
import { chunkResponse } from "../user/mappers";
import type { ChunkResponse } from "../../domain/data/data";
import type { IDataClient } from "./data.client.interface";
import { db } from "../../utils/caching";
import { DataClientMock } from "./data.client.mock";
import { CachingDataClient } from "./data.caching.client";
import type { BlobReference } from "../../domain/chat/chat";
import { rollbar } from "../../utils/logging";

export class DataClient extends CandidService implements IDataClient {
    private dataService: UserService;

    static create(canisterId: string): IDataClient {
        if (process.env.MOCK_SERVICES) {
            return db ? new CachingDataClient(db, new DataClientMock()) : new DataClientMock();
        }
        return db && process.env.CLIENT_CACHING
            ? new CachingDataClient(db, new DataClient(canisterId))
            : new DataClient(canisterId);
    }

    constructor(canisterId: string) {
        super();
        this.dataService = this.createServiceClient<UserService>(idlFactory, canisterId);
    }

    private getChunkIndexes(totalBytes: number, chunkSize: number): number[] {
        const chunks = [];
        let index = 0;
        for (let bytes = 0; bytes < totalBytes; bytes += chunkSize) {
            chunks.push(index++);
        }
        return chunks;
    }

    async getData({ blobId, blobSize, chunkSize }: BlobReference): Promise<ChunkResponse> {
        if (!blobSize || !chunkSize) {
            return this.getChunk(blobId, 0);
        }
        const bytes = new Uint8Array(blobSize);
        const chunks = this.getChunkIndexes(blobSize, chunkSize);

        try {
            // todo - need to double check the error handling here
            // not too worried about that because this *should* get deleted anyway when we just
            // have normal urls for data items
            const responses = await Promise.all(chunks.map((_, i) => this.getChunk(blobId, i)));
            responses.forEach((resp, i) => {
                if (resp) {
                    bytes.set(resp, i * chunkSize);
                }
            });
        } catch (err) {
            rollbar.error(`Unable to load blobref: ${blobId}`, err);
            return undefined;
        }

        return bytes;
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
