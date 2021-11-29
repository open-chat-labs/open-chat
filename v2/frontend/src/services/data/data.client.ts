import { HttpAgent } from "@dfinity/agent";
import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { OpenStorageAgent, UploadBlobResponse } from "@open-ic/open-storage-agent";
import type { IDataClient } from "./data.client.interface";
import { DataClientMock } from "./data.client.mock";
import type { MessageContent } from "../../domain/chat/chat";
import { v1 as uuidv1 } from "uuid";
import type { BlobReference } from "../../domain/data/data";

export class DataClient implements IDataClient {
    private openStorageAgent: OpenStorageAgent;

    static create(identity: Identity): IDataClient {
        if (process.env.MOCK_SERVICES) {
            return new DataClientMock();
        }
        const agent = new HttpAgent({ identity });
        if (process.env.NODE_ENV !== "production") {
            agent.fetchRootKey();
        }
        const openStorageAgent = new OpenStorageAgent(
            agent,
            Principal.fromText("process.env.OPEN_STORAGE_INDEX_CANISTER"));

        return new DataClient(openStorageAgent);
    }

    constructor(openStorageAgent: OpenStorageAgent) {
        this.openStorageAgent = openStorageAgent;
    }

    static newBlobId(): bigint {
        return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
    }

    async uploadData(content: MessageContent, accessorCanisterIds: string[]): Promise<boolean> {
        if (
            content.kind === "file_content" ||
            content.kind === "image_content" ||
            content.kind === "audio_content"
        ) {
            if (content.blobData && content.blobReference === undefined) {
                const accessorIds = accessorCanisterIds.map(c => Principal.fromText(c));

                content.blobReference = this.convertResponse(await this.openStorageAgent.uploadBlob(
                    content.mimeType,
                    accessorIds,
                    content.blobData
                ));
            }
        }

        if (content.kind === "video_content") {
            if (
                content.videoData.blobData &&
                content.imageData.blobData &&
                content.videoData.blobReference === undefined &&
                content.imageData.blobReference === undefined
            ) {
                const accessorIds = accessorCanisterIds.map(c => Principal.fromText(c));

                await Promise.all([
                    this.openStorageAgent.uploadBlob(content.mimeType, accessorIds, content.videoData.blobData),
                    this.openStorageAgent.uploadBlob("image/jpg", accessorIds, content.imageData.blobData),
                ]).then(([video, image]) => {
                    content.videoData.blobReference = this.convertResponse(video);
                    content.imageData.blobReference = this.convertResponse(image);
                });
            }
        }

        return Promise.resolve(true);
    }

    convertResponse(response: UploadBlobResponse): BlobReference {
        return {
            canisterId: response.canisterId.toString(),
            blobId: response.blobId
        };
    }
}
