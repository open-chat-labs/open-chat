import { ChatSchema, getCachedData, setCachedData } from "../../utils/caching";
import type { IDBPDatabase } from "idb";
import type { IDataClient } from "./data.client.interface";

export class CachingDataClient implements IDataClient {
    constructor(private db: Promise<IDBPDatabase<ChatSchema>>, private client: IDataClient) {}

    async getData(
        blobId: bigint,
        totalBytes?: number,
        chunkSize?: number
    ): Promise<Uint8Array | undefined> {
        const cachedData = await getCachedData(this.db, blobId);
        return (
            cachedData ??
            this.client.getData(blobId, totalBytes, chunkSize).then(setCachedData(this.db, blobId))
        );
    }
}
