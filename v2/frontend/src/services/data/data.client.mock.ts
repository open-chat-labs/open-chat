import type { UserStorage } from "../../domain/user/user";
import type { MessageContent } from "../../domain/chat/chat";
import type { IDataClient } from "./data.client.interface";

export const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB

export class DataClientMock implements IDataClient {
    async uploadData(_content: MessageContent): Promise<boolean> {
        return Promise.resolve(true);
    }
    getUserStorage(): Promise<UserStorage> {
        return Promise.resolve({
            byteLimit: 0,
            bytesUsed: 0,
        });
    }
}
