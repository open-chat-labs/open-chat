import type { Identity } from "@dfinity/agent";
import { OpenStorageAgent, UploadFileResponse } from "@open-ic/open-storage-agent";
import type { IDataClient } from "./data.client.interface";
import type { MessageContent, StoredMediaContent } from "../../domain/chat/chat";
import type { BlobReference, StorageStatus } from "../../domain/data/data";
export declare class DataClient implements IDataClient {
    private openStorageAgent;
    static create(identity: Identity): IDataClient;
    constructor(openStorageAgent: OpenStorageAgent);
    static newBlobId(): bigint;
    storageStatus(): Promise<StorageStatus>;
    uploadData(content: MessageContent, accessorCanisterIds: string[]): Promise<StoredMediaContent | undefined>;
    forwardData(content: MessageContent, accessorCanisterIds: string[]): Promise<StoredMediaContent | undefined>;
    extractBlobReference(response: UploadFileResponse): BlobReference;
}
