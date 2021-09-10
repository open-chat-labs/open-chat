import { idlFactory, UserService } from "../user/candid/idl";
import { CandidService } from "../candidService";
import { chunkResponse, putChunkResponse } from "../user/mappers";
import type { ChunkResponse } from "../../domain/data/data";
import type { IDataClient } from "./data.client.interface";
import { db } from "../../utils/caching";
import { DataClientMock } from "./data.client.mock";
import { CachingDataClient } from "./data.caching.client";
import type { BlobReference, MessageContent, PutChunkResponse } from "../../domain/chat/chat";
import { rollbar } from "../../utils/logging";
import { v1 as uuidv1 } from "uuid";
import type { Identity } from "@dfinity/agent";

const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB

export class DataClient extends CandidService implements IDataClient {
    private dataService: UserService;

    static create(identity: Identity, canisterId: string): IDataClient {
        if (process.env.MOCK_SERVICES) {
            return db ? new CachingDataClient(db, new DataClientMock()) : new DataClientMock();
        }
        return db && process.env.CLIENT_CACHING
            ? new CachingDataClient(db, new DataClient(identity, canisterId))
            : new DataClient(identity, canisterId);
    }

    constructor(identity: Identity, private canisterId: string) {
        super(identity);
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

    putChunk(blobId: bigint, bytes: Uint8Array, index: number): Promise<PutChunkResponse> {
        return this.handleResponse(
            this.dataService.put_chunk({
                blob_id: blobId,
                bytes: Array.from(bytes),
                index,
            }),
            putChunkResponse
        );
    }

    private newBlobId(): bigint {
        return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
    }

    async uploadData(content: MessageContent): Promise<boolean> {
        if (content.kind === "file_content" || content.kind === "media_content") {
            if (content.blobData) {
                const data = await content.blobData;
                const blobId = this.newBlobId();
                if (data) {
                    const size = data.byteLength;
                    const chunks = [];
                    for (let byteStart = 0; byteStart < size; byteStart += CHUNK_SIZE_BYTES) {
                        const byteEnd = Math.min(size, byteStart + CHUNK_SIZE_BYTES);
                        const slice = data.slice(byteStart, byteEnd);
                        chunks.push(slice);
                    }

                    content.blobReference = {
                        blobId,
                        chunkSize: CHUNK_SIZE_BYTES,
                        blobSize: size,
                        canisterId: this.canisterId,
                    };

                    await Promise.all(
                        chunks.map((chunk, i) => {
                            return this.putChunk(blobId, chunk, i);
                        })
                    );
                }
            }
        }

        return Promise.resolve(true);
    }
}
