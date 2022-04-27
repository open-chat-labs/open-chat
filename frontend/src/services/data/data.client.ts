import { HttpAgent } from "@dfinity/agent";
import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { OpenStorageAgent, UploadFileResponse } from "@open-ic/open-storage-agent";
import type { IDataClient } from "./data.client.interface";
import type { MessageContent, StoredMediaContent } from "../../domain/chat/chat";
import { v1 as uuidv1 } from "uuid";
import type { BlobReference, StorageStatus, UploadDataResponse } from "../../domain/data/data";
import { storageStore } from "../../stores/storage";

export class DataClient implements IDataClient {
    private openStorageAgent: OpenStorageAgent;

    static create(identity: Identity): IDataClient {
        const agent = new HttpAgent({ identity });
        if (process.env.NODE_ENV !== "production") {
            agent.fetchRootKey();
        }
        const openStorageAgent = new OpenStorageAgent(
            agent,
            Principal.fromText("process.env.OPEN_STORAGE_INDEX_CANISTER")
        );

        return new DataClient(openStorageAgent);
    }

    constructor(openStorageAgent: OpenStorageAgent) {
        this.openStorageAgent = openStorageAgent;
    }

    static newBlobId(): bigint {
        return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
    }

    storageStatus(): Promise<StorageStatus> {
        return this.openStorageAgent.user().then((resp) => {
            if (resp.kind === "user") {
                console.log("User storage: ", resp);
                return {
                    byteLimit: Number(resp.byteLimit),
                    bytesUsed: Number(resp.bytesUsed),
                };
            } else {
                return {
                    byteLimit: 0,
                    bytesUsed: 0,
                };
            }
        });
    }

    async uploadData(
        content: MessageContent,
        accessorCanisterIds: string[]
    ): Promise<UploadDataResponse> {
        let byteLimit = 0;
        let bytesUsed = 0;
        let updatedContent: StoredMediaContent | undefined = undefined;

        if (
            content.kind === "file_content" ||
            content.kind === "image_content" ||
            content.kind === "audio_content"
        ) {
            if (content.blobData && content.blobReference === undefined) {
                const accessorIds = accessorCanisterIds.map((c) => Principal.fromText(c));

                const response = await this.openStorageAgent.uploadFile(
                    content.mimeType,
                    accessorIds,
                    content.blobData
                );
                updatedContent = {
                    ...content,
                    blobReference: this.extractBlobReference(response),
                };
                byteLimit = Number(response.byteLimit);
                bytesUsed = Number(response.bytesUsed);
                storageStore.set({
                    byteLimit,
                    bytesUsed,
                });
            }
        } else if (content.kind === "video_content") {
            if (
                content.videoData.blobData &&
                content.imageData.blobData &&
                content.videoData.blobReference === undefined &&
                content.imageData.blobReference === undefined
            ) {
                const accessorIds = accessorCanisterIds.map((c) => Principal.fromText(c));

                await Promise.all([
                    this.openStorageAgent.uploadFile(
                        content.mimeType,
                        accessorIds,
                        content.videoData.blobData
                    ),
                    this.openStorageAgent.uploadFile(
                        "image/jpg",
                        accessorIds,
                        content.imageData.blobData
                    ),
                ]).then(([video, image]) => {
                    updatedContent = {
                        ...content,
                        videoData: {
                            ...content.videoData,
                            blobReference: this.extractBlobReference(video),
                        },
                        imageData: {
                            ...content.imageData,
                            blobReference: this.extractBlobReference(image),
                        },
                    };
                    // TODO - include the bytes of the image too.
                    // We can't simply add the bytes because the user may have previously uploaded the same image, in
                    // which case we do not charge them for uploading it again. We need the OpenStorage agent to return
                    // additional data.
                    byteLimit = Number(video.byteLimit);
                    bytesUsed = Number(video.bytesUsed);
                    storageStore.set({
                        byteLimit,
                        bytesUsed,
                    });
                });
            }
        }

        return { success: true, byteLimit, bytesUsed, content: updatedContent };
    }

    extractBlobReference(response: UploadFileResponse): BlobReference {
        return {
            canisterId: response.canisterId.toString(),
            blobId: response.fileId,
        };
    }
}
