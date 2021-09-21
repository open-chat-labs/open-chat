import type { MessageContent } from "../../domain/chat/chat";

export interface IDataClient {
    uploadData(content: MessageContent): Promise<boolean>;
}
