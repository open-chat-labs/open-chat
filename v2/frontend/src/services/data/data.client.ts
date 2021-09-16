import { idlFactory, UserService } from "../user/candid/idl";
import { CandidService } from "../candidService";
import { putChunkResponse } from "../user/mappers";
import type { IDataClient } from "./data.client.interface";
import { DataClientMock } from "./data.client.mock";
import type { BlobReference, MessageContent, PutChunkResponse } from "../../domain/chat/chat";
import { v1 as uuidv1 } from "uuid";
import type { Identity } from "@dfinity/agent";

const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB

export class DataClient extends CandidService implements IDataClient {
    private dataService: UserService;

    static create(identity: Identity, canisterId: string): IDataClient {
        if (process.env.MOCK_SERVICES) {
            return new DataClientMock();
        }
        return new DataClient(identity, canisterId);
    }

    constructor(identity: Identity, private canisterId: string) {
        super(identity);
        this.dataService = this.createServiceClient<UserService>(idlFactory, canisterId);
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

    putFirstChunk(
        blobId: bigint,
        bytes: Uint8Array,
        totalChunks: number,
        mimeType: string
    ): Promise<PutChunkResponse> {
        return this.handleResponse(
            this.dataService.put_first_chunk({
                blob_id: blobId,
                bytes: Array.from(bytes),
                mime_type: mimeType,
                total_chunks: totalChunks,
            }),
            putChunkResponse
        );
    }

    private newBlobId(): bigint {
        return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
    }

    private async uploadBlobData(mimeType: string, data: Uint8Array): Promise<BlobReference> {
        const blobId = this.newBlobId();
        const size = data.byteLength;
        const chunks = [];
        for (let byteStart = 0; byteStart < size; byteStart += CHUNK_SIZE_BYTES) {
            const byteEnd = Math.min(size, byteStart + CHUNK_SIZE_BYTES);
            const slice = data.slice(byteStart, byteEnd);
            chunks.push(slice);
        }

        const blobReference = {
            blobId,
            chunkSize: CHUNK_SIZE_BYTES,
            blobSize: size,
            canisterId: this.canisterId,
        };

        await Promise.all(
            chunks.map((chunk, i) => {
                return i === 0
                    ? this.putFirstChunk(blobId, chunk, chunks.length, mimeType)
                    : this.putChunk(blobId, chunk, i);
            })
        );

        return blobReference;
    }

    async uploadData(content: MessageContent): Promise<boolean> {
        if (
            content.kind === "file_content" ||
            content.kind === "image_content" ||
            content.kind === "audio_content"
        ) {
            if (content.blobData) {
                content.blobReference = await this.uploadBlobData(
                    content.mimeType,
                    content.blobData
                );
            }
        }

        if (content.kind === "video_content") {
            if (content.videoData.blobData && content.imageData.blobData) {
                await Promise.all([
                    this.uploadBlobData(content.mimeType, content.videoData.blobData),
                    this.uploadBlobData("image/jpg", content.imageData.blobData),
                ]).then(([video, image]) => {
                    content.videoData.blobReference = video;
                    content.imageData.blobReference = image;
                });
            }
        }

        return Promise.resolve(true);
    }
}
