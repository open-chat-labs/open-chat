import type { BlobReference } from "../../domain/chat/chat";

export interface IDataClient {
    getData(blobRef: BlobReference): Promise<Uint8Array | undefined>;
}
