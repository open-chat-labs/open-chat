import type { MessageContent } from "../../domain/chat/chat";
import type { StorageStatus, UploadDataResponse } from "../../domain/data/data";

export interface IDataClient {
    storageStatus(): Promise<StorageStatus>;
    uploadData(content: MessageContent, accessorCanisterIds: string[]): Promise<UploadDataResponse>;
}
