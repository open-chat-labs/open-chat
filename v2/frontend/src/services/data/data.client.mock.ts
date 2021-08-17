import type { IDataClient } from "./data.client.interface";

export const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB

export class DataClientMock implements IDataClient {
    async getData(
        blobId: bigint,
        _totalBytes?: number,
        _chunkSize?: number
    ): Promise<Uint8Array | undefined> {
        const url =
            blobId === BigInt(0)
                ? "https://natureconservancy-h.assetsadobe.com/is/image/content/dam/tnc/nature/en/photos/australia/Quokka_Sam-West.jpg?crop=0,886,2365,1773&wid=640&hei=480&scl=3.6953125"
                : "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
        return fetch(url)
            .then((resp) => resp.arrayBuffer())
            .then((bytes) => new Uint8Array(bytes));
    }
}
