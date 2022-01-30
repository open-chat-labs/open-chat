import type { UserStorage } from "../../domain/user/user";
import type { MessageContent } from "../../domain/chat/chat";

export interface IDataClient {
    uploadData(content: MessageContent, accessorCanisterIds: string[]): Promise<boolean>;
    getUserStorage(): Promise<UserStorage>;
}
