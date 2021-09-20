import type { MessageContent } from "../../domain/chat/chat";
import type { BlobReference } from "../../domain/data/data";

export interface IDataClient {
    uploadData(content: MessageContent): Promise<boolean>;
    setAvatar(data: Uint8Array): Promise<BlobReference>;
}
