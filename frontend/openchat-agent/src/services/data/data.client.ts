import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { v1 as uuidv1 } from "uuid";
import { sha3_256 } from "js-sha3";
import type { AgentConfig } from "../../config";
import { buildBlobUrl } from "../../utils/chat";
import {
    StorageStatus,
    MessageContent,
    StoredMediaContent,
    BlobReference,
    StorageUpdated,
    random128,
    UploadFileResponse,
    AllowanceExceeded,
    ProjectedAllowance,
    StorageUserNotFound,
} from "openchat-shared";
import { StorageIndexClient } from "../storageIndex/storageIndex.client";
import { StorageBucketClient } from "../storageBucket/storageBucket.client";

export class DataClient extends EventTarget {
    static create(identity: Identity, config: AgentConfig): DataClient {
        const storageIndexClient = StorageIndexClient.create(identity, config);
        return new DataClient(identity, config, storageIndexClient);
    }

    private constructor(
        private identity: Identity,
        private config: AgentConfig,
        private storageIndexClient: StorageIndexClient
    ) {
        super();
    }

    static newBlobId(): bigint {
        return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
    }

    storageStatus(): Promise<StorageStatus> {
        return this.storageIndexClient.user().then((resp) => {
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

                const response = await this.uploadFile(
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
                    this.uploadFile(content.mimeType, accessorIds, content.videoData.blobData),
                    this.uploadFile("image/jpg", accessorIds, content.imageData.blobData),
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

                const response = await this.forwardFile(
                    content.blobReference.canisterId,
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
                    this.forwardFile(
                        videoCanisterId,
                        content.videoData.blobReference.blobId,
                        accessorIds
                    ),
                    this.forwardFile(
                        imageCanisterId,
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

    private async uploadFile(
        mimeType: string,
        accessors: Array<Principal>,
        bytes: ArrayBuffer,
        expiryTimestampMillis?: bigint,
        onProgress?: (percentComplete: number) => void
    ): Promise<UploadFileResponse> {
        const hash = new Uint8Array(hashBytes(bytes));
        const fileSize = bytes.byteLength;

        const allocatedBucketResponse = await this.storageIndexClient.allocatedBucket(
            hash,
            BigInt(fileSize),
            random128()
        );

        if (allocatedBucketResponse.kind !== "success") {
            // TODO make this better!
            throw new Error(allocatedBucketResponse.kind);
        }

        const bucketCanisterId = allocatedBucketResponse.canisterId.toString();
        const fileId = allocatedBucketResponse.fileId;
        const chunkSize = allocatedBucketResponse.chunkSize;
        const chunkCount = Math.ceil(fileSize / chunkSize);
        const chunkIndexes = [...Array(chunkCount).keys()];
        const bucketClient = StorageBucketClient.create(
            this.identity,
            this.config,
            bucketCanisterId
        );

        let chunksCompleted = 0;

        const promises = chunkIndexes.map(async (chunkIndex) => {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, fileSize);
            const chunkBytes = new Uint8Array(bytes.slice(start, end));

            let attempt = 0;

            while (attempt++ < 5) {
                try {
                    const chunkResponse = await bucketClient.uploadChunk(
                        fileId,
                        hash,
                        mimeType,
                        accessors,
                        BigInt(fileSize),
                        chunkSize,
                        chunkIndex,
                        chunkBytes,
                        expiryTimestampMillis
                    );

                    if (chunkResponse === "success") {
                        chunksCompleted++;
                        onProgress?.((100 * chunksCompleted) / chunkCount);
                        return;
                    }
                } catch (e) {
                    console.log("Error uploading chunk " + chunkIndex, e);
                }
            }
            throw new Error("Failed to upload chunk");
        });

        await Promise.all(promises);

        return {
            canisterId: bucketCanisterId,
            fileId,
            pathPrefix: "/files/",
            projectedAllowance: allocatedBucketResponse.projectedAllowance,
        };
    }

    private async forwardFile(
        bucketCanisterId: string,
        fileId: bigint,
        accessors: Array<Principal>
    ): Promise<ForwardFileResponse> {
        const bucketClient = StorageBucketClient.create(
            this.identity,
            this.config,
            bucketCanisterId
        );

        const fileInfoResponse = await bucketClient.fileInfo(fileId);
        if (fileInfoResponse.kind === "file_not_found") {
            return fileInfoResponse;
        }

        const canForwardResponse = await this.storageIndexClient.canForward(
            fileInfoResponse.fileHash,
            fileInfoResponse.fileSize
        );
        switch (canForwardResponse.kind) {
            case "user_not_found":
            case "allowance_exceeded":
                return canForwardResponse;
        }

        const forwardFileResponse = await bucketClient.forwardFile(fileId, accessors);
        switch (forwardFileResponse.kind) {
            case "success":
                return {
                    kind: "success",
                    newFileId: forwardFileResponse.newFileId,
                    projectedAllowance: canForwardResponse.projectedAllowance,
                };

            case "not_authorized":
            case "file_not_found":
                return forwardFileResponse;
        }
    }
}

function hashBytes(bytes: ArrayBuffer): ArrayBuffer {
    const hash = sha3_256.create();
    hash.update(bytes);
    return hash.arrayBuffer();
}

type ForwardFileResponse =
    | ForwardFileSuccess
    | AllowanceExceeded
    | StorageUserNotFound
    | { kind: "not_authorized" }
    | { kind: "file_not_found" };

type ForwardFileSuccess = {
    kind: "success";
    newFileId: bigint;
    projectedAllowance: ProjectedAllowance;
};
