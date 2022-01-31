import type { UserStorage } from "../../domain/user/user";
import type { MessageContent } from "../../domain/chat/chat";
import type { IDataClient } from "./data.client.interface";

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
