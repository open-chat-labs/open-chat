import type { MessageContent, StorageStatus, StoredMediaContent } from "openchat-shared";

export interface IDataClient {
    storageStatus(): Promise<StorageStatus>;
    uploadData(
        content: MessageContent,
        accessorCanisterIds: string[]
    ): Promise<StoredMediaContent | undefined>;
    forwardData(
        content: MessageContent,
        accessorCanisterIds: string[]
    ): Promise<StoredMediaContent | undefined>;
}
