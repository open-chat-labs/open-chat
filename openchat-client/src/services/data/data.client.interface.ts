import type { MessageContent, StoredMediaContent } from "../../domain/chat/chat";
import type { StorageStatus } from "../../domain/data/data";

export interface IDataClient {
    storageStatus(): Promise<StorageStatus>;
    uploadData(content: MessageContent, accessorCanisterIds: string[]): Promise<StoredMediaContent | undefined>;
    forwardData(content: MessageContent, accessorCanisterIds: string[]): Promise<StoredMediaContent | undefined>;
}
