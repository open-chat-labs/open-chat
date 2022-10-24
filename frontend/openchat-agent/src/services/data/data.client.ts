import { HttpAgent } from "@dfinity/agent";
import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { OpenStorageAgent, UploadFileResponse } from "@open-ic/open-storage-agent";
import type { IDataClient } from "./data.client.interface";
import type { MessageContent, StoredMediaContent } from "../../domain/chat/chat";
import { v1 as uuidv1 } from "uuid";
import type { BlobReference, StorageStatus } from "../../domain/data/data";
import type { AgentConfig } from "../../config";
import { buildBlobUrl } from "../../utils/chat";
import { StorageUpdated } from "../../events";

export class DataClient extends EventTarget implements IDataClient {
    private openStorageAgent: OpenStorageAgent;

    static create(identity: Identity, config: AgentConfig): IDataClient {
        const host = config.icUrl;
        const agent = new HttpAgent({ identity, host });
        const isMainnet = (config.icUrl ?? window.location.origin).includes("ic0.app");
        if (!isMainnet) {
            agent.fetchRootKey();
        }
        const openStorageAgent = new OpenStorageAgent(
            agent,
            Principal.fromText(config.openStorageIndexCanister)
        );

        return new DataClient(openStorageAgent, config);
    }

    constructor(openStorageAgent: OpenStorageAgent, private config: AgentConfig) {
        super();
        this.openStorageAgent = openStorageAgent;
    }

    static newBlobId(): bigint {
        return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
    }

    storageStatus(): Promise<StorageStatus> {
        return this.openStorageAgent.user().then((resp) => {
            if (resp.kind === "user") {
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
    ): Promise<StoredMediaContent | undefined> {
        let byteLimit: number | undefined = undefined;
        let bytesUsed: number | undefined = undefined;
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

                const ref = this.extractBlobReference(response);

                updatedContent = {
                    ...content,
                    blobReference: ref,
                    blobUrl: buildBlobUrl(
                        this.config.blobUrlPattern,
                        ref.canisterId,
                        ref.blobId,
                        "blobs"
                    ),
                };
                byteLimit = Number(response.projectedAllowance.byteLimit);
                bytesUsed = Number(response.projectedAllowance.bytesUsedAfterOperation);
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
                    const videoRef = this.extractBlobReference(video);
                    const imageRef = this.extractBlobReference(image);
                    updatedContent = {
                        ...content,
                        videoData: {
                            ...content.videoData,
                            blobReference: videoRef,
                            blobUrl: buildBlobUrl(
                                this.config.blobUrlPattern,
                                videoRef.canisterId,
                                videoRef.blobId,
                                "blobs"
                            ),
                        },
                        imageData: {
                            ...content.imageData,
                            blobReference: imageRef,
                            blobUrl: buildBlobUrl(
                                this.config.blobUrlPattern,
                                imageRef.canisterId,
                                imageRef.blobId,
                                "blobs"
                            ),
                        },
                    };
                    byteLimit = Number(video.projectedAllowance.byteLimit);
                    bytesUsed = Number(
                        video.projectedAllowance.bytesUsedAfterOperation +
                            image.projectedAllowance.bytesUsedAfterOperation -
                            image.projectedAllowance.bytesUsed
                    );
                });
            }
        }

        if (bytesUsed !== undefined && byteLimit !== undefined) {
            this.dispatchEvent(
                new StorageUpdated({
                    byteLimit,
                    bytesUsed,
                })
            );
        }

        return updatedContent;
    }

    async forwardData(
        content: MessageContent,
        accessorCanisterIds: string[]
    ): Promise<StoredMediaContent | undefined> {
        let byteLimit: number | undefined = undefined;
        let bytesUsed: number | undefined = undefined;
        let updatedContent: StoredMediaContent | undefined = undefined;
        let error: string | undefined = undefined;

        if (
            content.kind === "file_content" ||
            content.kind === "image_content" ||
            content.kind === "audio_content"
        ) {
            if (content.blobReference !== undefined) {
                const accessorIds = accessorCanisterIds.map((c) => Principal.fromText(c));

                const response = await this.openStorageAgent.forwardFile(
                    Principal.fromText(content.blobReference.canisterId),
                    content.blobReference.blobId,
                    accessorIds
                );
                if (response.kind === "success") {
                    byteLimit = Number(response.projectedAllowance.byteLimit);
                    bytesUsed = Number(response.projectedAllowance.bytesUsedAfterOperation);
                    updatedContent = {
                        ...content,
                        blobReference: {
                            canisterId: content.blobReference.canisterId,
                            blobId: response.newFileId,
                        },
                        blobUrl: buildBlobUrl(
                            this.config.blobUrlPattern,
                            content.blobReference.canisterId,
                            content.blobReference.blobId,
                            "blobs"
                        ),
                    };
                } else {
                    if (response.kind === "allowance_exceeded") {
                        byteLimit = Number(response.projectedAllowance.byteLimit);
                        bytesUsed = Number(response.projectedAllowance.bytesUsed);
                    }
                    error = response.kind;
                }
            }
        } else if (content.kind === "video_content") {
            if (
                content.videoData.blobReference !== undefined &&
                content.imageData.blobReference !== undefined
            ) {
                const accessorIds = accessorCanisterIds.map((c) => Principal.fromText(c));
                const videoCanisterId = content.videoData.blobReference.canisterId;
                const imageCanisterId = content.imageData.blobReference.canisterId;

                await Promise.all([
                    this.openStorageAgent.forwardFile(
                        Principal.fromText(videoCanisterId),
                        content.videoData.blobReference.blobId,
                        accessorIds
                    ),
                    this.openStorageAgent.forwardFile(
                        Principal.fromText(imageCanisterId),
                        content.imageData.blobReference.blobId,
                        accessorIds
                    ),
                ]).then(([video, image]) => {
                    if (video.kind === "success" && image.kind === "success") {
                        byteLimit = Number(video.projectedAllowance.byteLimit);
                        bytesUsed = Number(
                            video.projectedAllowance.bytesUsedAfterOperation +
                                image.projectedAllowance.bytesUsedAfterOperation -
                                image.projectedAllowance.bytesUsed
                        );
                        updatedContent = {
                            ...content,
                            videoData: {
                                ...content.videoData,
                                blobReference: {
                                    canisterId: videoCanisterId,
                                    blobId: video.newFileId,
                                },
                                blobUrl: buildBlobUrl(
                                    this.config.blobUrlPattern,
                                    videoCanisterId,
                                    video.newFileId,
                                    "blobs"
                                ),
                            },
                            imageData: {
                                ...content.imageData,
                                blobReference: {
                                    canisterId: imageCanisterId,
                                    blobId: image.newFileId,
                                },
                                blobUrl: buildBlobUrl(
                                    this.config.blobUrlPattern,
                                    imageCanisterId,
                                    image.newFileId,
                                    "blobs"
                                ),
                            },
                        };
                    } else if (video.kind === "success") {
                        byteLimit = Number(video.projectedAllowance.byteLimit);
                        bytesUsed = Number(video.projectedAllowance.bytesUsedAfterOperation);
                        error = image.kind;
                    } else {
                        if (video.kind === "allowance_exceeded") {
                            byteLimit = Number(video.projectedAllowance.byteLimit);
                            bytesUsed = Number(video.projectedAllowance.bytesUsed);
                        }
                        error = video.kind;
                    }
                });
            }
        }

        if (bytesUsed !== undefined && byteLimit !== undefined) {
            this.dispatchEvent(
                new StorageUpdated({
                    byteLimit,
                    bytesUsed,
                })
            );
        }

        if (error !== undefined) {
            throw new Error("Unable to forward file: " + error);
        }

        return updatedContent;
    }

    extractBlobReference(response: UploadFileResponse): BlobReference {
        return {
            canisterId: response.canisterId.toString(),
            blobId: response.fileId,
        };
    }
}
