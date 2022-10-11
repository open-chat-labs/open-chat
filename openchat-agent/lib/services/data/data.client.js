import { HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { OpenStorageAgent } from "@open-ic/open-storage-agent";
import { v1 as uuidv1 } from "uuid";
import { storageStore } from "../../stores/storage";
export class DataClient {
    constructor(openStorageAgent) {
        this.openStorageAgent = openStorageAgent;
    }
    static create(identity) {
        const host = process.env.IC_URL;
        const agent = new HttpAgent({ identity, host });
        if (process.env.NODE_ENV !== "production") {
            agent.fetchRootKey();
        }
        const openStorageAgent = new OpenStorageAgent(agent, Principal.fromText("process.env.OPEN_STORAGE_INDEX_CANISTER"));
        return new DataClient(openStorageAgent);
    }
    static newBlobId() {
        return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
    }
    storageStatus() {
        return this.openStorageAgent.user().then((resp) => {
            if (resp.kind === "user") {
                return {
                    byteLimit: Number(resp.byteLimit),
                    bytesUsed: Number(resp.bytesUsed),
                };
            }
            else {
                return {
                    byteLimit: 0,
                    bytesUsed: 0,
                };
            }
        });
    }
    async uploadData(content, accessorCanisterIds) {
        let byteLimit = undefined;
        let bytesUsed = undefined;
        let updatedContent = undefined;
        if (content.kind === "file_content" ||
            content.kind === "image_content" ||
            content.kind === "audio_content") {
            if (content.blobData && content.blobReference === undefined) {
                const accessorIds = accessorCanisterIds.map((c) => Principal.fromText(c));
                const response = await this.openStorageAgent.uploadFile(content.mimeType, accessorIds, content.blobData);
                updatedContent = Object.assign(Object.assign({}, content), { blobReference: this.extractBlobReference(response) });
                byteLimit = Number(response.projectedAllowance.byteLimit);
                bytesUsed = Number(response.projectedAllowance.bytesUsedAfterOperation);
            }
        }
        else if (content.kind === "video_content") {
            if (content.videoData.blobData &&
                content.imageData.blobData &&
                content.videoData.blobReference === undefined &&
                content.imageData.blobReference === undefined) {
                const accessorIds = accessorCanisterIds.map((c) => Principal.fromText(c));
                await Promise.all([
                    this.openStorageAgent.uploadFile(content.mimeType, accessorIds, content.videoData.blobData),
                    this.openStorageAgent.uploadFile("image/jpg", accessorIds, content.imageData.blobData),
                ]).then(([video, image]) => {
                    updatedContent = Object.assign(Object.assign({}, content), { videoData: Object.assign(Object.assign({}, content.videoData), { blobReference: this.extractBlobReference(video) }), imageData: Object.assign(Object.assign({}, content.imageData), { blobReference: this.extractBlobReference(image) }) });
                    byteLimit = Number(video.projectedAllowance.byteLimit);
                    bytesUsed = Number(video.projectedAllowance.bytesUsedAfterOperation +
                        image.projectedAllowance.bytesUsedAfterOperation -
                        image.projectedAllowance.bytesUsed);
                });
            }
        }
        if (bytesUsed !== undefined && byteLimit !== undefined) {
            storageStore.set({
                byteLimit,
                bytesUsed,
            });
        }
        return updatedContent;
    }
    async forwardData(content, accessorCanisterIds) {
        let byteLimit = undefined;
        let bytesUsed = undefined;
        let updatedContent = undefined;
        let error = undefined;
        if (content.kind === "file_content" ||
            content.kind === "image_content" ||
            content.kind === "audio_content") {
            if (content.blobReference !== undefined) {
                const accessorIds = accessorCanisterIds.map((c) => Principal.fromText(c));
                const response = await this.openStorageAgent.forwardFile(Principal.fromText(content.blobReference.canisterId), content.blobReference.blobId, accessorIds);
                if (response.kind === "success") {
                    byteLimit = Number(response.projectedAllowance.byteLimit);
                    bytesUsed = Number(response.projectedAllowance.bytesUsedAfterOperation);
                    updatedContent = Object.assign(Object.assign({}, content), { blobReference: {
                            canisterId: content.blobReference.canisterId,
                            blobId: response.newFileId,
                        } });
                }
                else {
                    if (response.kind === "allowance_exceeded") {
                        byteLimit = Number(response.projectedAllowance.byteLimit);
                        bytesUsed = Number(response.projectedAllowance.bytesUsed);
                    }
                    error = response.kind;
                }
            }
        }
        else if (content.kind === "video_content") {
            if (content.videoData.blobReference !== undefined &&
                content.imageData.blobReference !== undefined) {
                const accessorIds = accessorCanisterIds.map((c) => Principal.fromText(c));
                const videoCanisterId = content.videoData.blobReference.canisterId;
                const imageCanisterId = content.imageData.blobReference.canisterId;
                await Promise.all([
                    this.openStorageAgent.forwardFile(Principal.fromText(videoCanisterId), content.videoData.blobReference.blobId, accessorIds),
                    this.openStorageAgent.forwardFile(Principal.fromText(imageCanisterId), content.imageData.blobReference.blobId, accessorIds),
                ]).then(([video, image]) => {
                    if (video.kind === "success" && image.kind === "success") {
                        byteLimit = Number(video.projectedAllowance.byteLimit);
                        bytesUsed = Number(video.projectedAllowance.bytesUsedAfterOperation +
                            image.projectedAllowance.bytesUsedAfterOperation -
                            image.projectedAllowance.bytesUsed);
                        updatedContent = Object.assign(Object.assign({}, content), { videoData: Object.assign(Object.assign({}, content.videoData), { blobReference: {
                                    canisterId: videoCanisterId,
                                    blobId: video.newFileId,
                                } }), imageData: Object.assign(Object.assign({}, content.imageData), { blobReference: {
                                    canisterId: imageCanisterId,
                                    blobId: image.newFileId,
                                } }) });
                    }
                    else if (video.kind === "success") {
                        byteLimit = Number(video.projectedAllowance.byteLimit);
                        bytesUsed = Number(video.projectedAllowance.bytesUsedAfterOperation);
                        error = image.kind;
                    }
                    else {
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
            storageStore.set({
                byteLimit,
                bytesUsed,
            });
        }
        if (error !== undefined) {
            throw new Error("Unable to forward file: " + error);
        }
        return updatedContent;
    }
    extractBlobReference(response) {
        return {
            canisterId: response.canisterId.toString(),
            blobId: response.fileId,
        };
    }
}
//# sourceMappingURL=data.client.js.map