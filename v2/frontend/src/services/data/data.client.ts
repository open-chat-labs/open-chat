import { idlFactory, UserService } from "../user/candid/idl";
import { CandidService } from "../candidService";
import { putChunkResponse } from "../user/mappers";
import type { IDataClient } from "./data.client.interface";
import { DataClientMock } from "./data.client.mock";
import type { MessageContent, PutChunkResponse } from "../../domain/chat/chat";
import { v1 as uuidv1 } from "uuid";
import type { Identity } from "@dfinity/agent";
import type { BlobReference } from "../../domain/data/data";

const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB

type PutChunkFn = (
    blobId: bigint,
    bytes: Uint8Array,
    totalChunks: number,
    mimeType: string,
    index: number
) => Promise<PutChunkResponse>;

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

    putAvatarChunk(
        blobId: bigint,
        bytes: Uint8Array,
        totalChunks: number,
        mimeType: string,
        index: number
    ): Promise<PutChunkResponse> {
        return this.handleResponse(
            this.dataService.put_avatar_chunk({
                blob_id: blobId,
                bytes: Array.from(bytes),
                mime_type: mimeType,
                total_chunks: totalChunks,
                index: index,
            }),
            putChunkResponse
        );
    }

    putChunk(
        blobId: bigint,
        bytes: Uint8Array,
        totalChunks: number,
        mimeType: string,
        index: number
    ): Promise<PutChunkResponse> {
        return this.handleResponse(
            this.dataService.put_chunk({
                blob_id: blobId,
                bytes: Array.from(bytes),
                mime_type: mimeType,
                total_chunks: totalChunks,
                index: index,
            }),
            putChunkResponse
        );
    }

    static newBlobId(): bigint {
        return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
    }

    private async uploadBlobData(
        mimeType: string,
        data: Uint8Array,
        putFn: PutChunkFn
    ): Promise<BlobReference> {
        const blobId = DataClient.newBlobId();
        const size = data.byteLength;
        const chunks = [];
        for (let byteStart = 0; byteStart < size; byteStart += CHUNK_SIZE_BYTES) {
            const byteEnd = Math.min(size, byteStart + CHUNK_SIZE_BYTES);
            const slice = data.slice(byteStart, byteEnd);
            chunks.push(slice);
        }

        const blobReference = {
            blobId,
            canisterId: this.canisterId,
        };

        await Promise.all(
            chunks.map((chunk, i) => putFn(blobId, chunk, chunks.length, mimeType, i))
        );

        return blobReference;
    }

    async setAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.uploadBlobData(
            "image/jpg",
            data,
            (blobId, bytes, totalChunks, mimeType, index) =>
                this.putAvatarChunk(blobId, bytes, totalChunks, mimeType, index)
        );
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
                    content.blobData,
                    (blobId, bytes, totalChunks, mimeType, index) =>
                        this.putChunk(blobId, bytes, totalChunks, mimeType, index)
                );
            }
        }

        if (content.kind === "video_content") {
            if (content.videoData.blobData && content.imageData.blobData) {
                await Promise.all([
                    this.uploadBlobData(
                        content.mimeType,
                        content.videoData.blobData,
                        (blobId, bytes, totalChunks, mimeType, index) =>
                            this.putChunk(blobId, bytes, totalChunks, mimeType, index)
                    ),
                    this.uploadBlobData(
                        "image/jpg",
                        content.imageData.blobData,
                        (blobId, bytes, totalChunks, mimeType, index) =>
                            this.putChunk(blobId, bytes, totalChunks, mimeType, index)
                    ),
                ]).then(([video, image]) => {
                    content.videoData.blobReference = video;
                    content.imageData.blobReference = image;
                });
            }
        }

        return Promise.resolve(true);
    }
}
