import type { BlobReference, MessageContent } from "../../domain/chat/chat";

export interface IDataClient {
    getData(blobRef: BlobReference): Promise<Uint8Array | undefined>;
    uploadData(content: MessageContent): Promise<boolean>;
}
