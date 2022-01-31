import type { MessageContent } from "../../domain/chat/chat";
import type { IDataClient } from "./data.client.interface";
import type { StorageStatus, UploadDataResponse } from "../../domain/data/data";

export class DataClientMock implements IDataClient {
    async storageStatus(): Promise<StorageStatus> {
        return Promise.resolve({ byteLimit: BigInt(0), bytesUsed: BigInt(0) });
    }

    async uploadData(_content: MessageContent): Promise<UploadDataResponse> {
        return Promise.resolve({ success: true, byteLimit: BigInt(0), bytesUsed: BigInt(0) });
    }
}
