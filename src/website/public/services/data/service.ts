import async from "async";

import getChunk from "./getChunk";
import { CHUNK_SIZE_BYTES } from "../../constants";
import putChunk from "./putChunk";

export default class service {
    public static async getData(key: string, totalBytes: number, chunkSize: number) : Promise<GetDataResponse> {
        const bytes = new Uint8Array(totalBytes);
        const chunks = this.getChunkIndexes(totalBytes, chunkSize);

        await async.mapLimit(chunks, 10, async (i, callback) => {
            const response = await getChunk(key, i, chunkSize);
            if (response.kind === "success") {
                const offset = i * chunkSize;
                bytes.set(response.data, offset);
            } else {
                // TODO: Handle error
            }
            callback(null);
        });

        return {
            kind: "success",
            data: bytes
        };
    }

    public static async putData(key: string, data: ArrayBuffer) : Promise<boolean> {
        const size = data.byteLength;
        const chunks = [];
        for (let byteStart = 0; byteStart < size; byteStart += CHUNK_SIZE_BYTES) {
            const byteEnd = Math.min(size, byteStart + CHUNK_SIZE_BYTES);
            const slice = data.slice(byteStart, byteEnd);
            chunks.push(new Uint8Array(slice));
        }

        await async.forEachOfLimit(chunks, 10, async (c, i, callback) => {
            const index = i as number;
            await putChunk(key, index, c);
            callback(null);
        });

        return true;
    }

    static getChunkIndexes(totalBytes: number, chunkSize: number) : number[] {
        const chunks = [];
        let index = 0;
        for (let bytes = 0; bytes < totalBytes; bytes += chunkSize) {
            chunks.push(index++);
        }
        return chunks;
    }
}

export type GetDataResponse =
    Success |
    NotFound;

export type Success = {
    kind: "success",
    data: Uint8Array
}

export type NotFound = {
    kind: "notFound"
}
