import { ChatSchema, getCachedData, setCachedData } from "../../utils/caching";
import type { IDBPDatabase } from "idb";
import type { IDataClient } from "./data.client.interface";
import type { BlobReference, MessageContent } from "../../domain/chat/chat";

export class CachingDataClient implements IDataClient {
    constructor(private db: Promise<IDBPDatabase<ChatSchema>>, private client: IDataClient) {}

    async getData(blobRef: BlobReference): Promise<Uint8Array | undefined> {
        const cachedData = await getCachedData(this.db, blobRef.blobId);
        return (
            cachedData ?? this.client.getData(blobRef).then(setCachedData(this.db, blobRef.blobId))
        );
    }

    async uploadData(content: MessageContent): Promise<boolean> {
        return this.client.uploadData(content);
    }
}
