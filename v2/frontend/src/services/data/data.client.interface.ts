export interface IDataClient {
    getData(
        blobId: bigint,
        totalBytes?: number,
        chunkSize?: number
    ): Promise<Uint8Array | undefined>;
}
