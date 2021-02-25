import async from "async";
import { Option } from "../../domain/model/common";
import getChunk from "./getChunk";
import { CHUNK_SIZE_BYTES, MAX_CACHE_OBJECT_SIZE_BYTES } from "../../constants";
import putChunk from "./putChunk";

export default class service {

    public static async getData(key: string, totalBytes?: number, chunkSize?: number) : Promise<GetDataResponse> {
        let data = await service.tryGetDataFromCache(key);
        if (!data) {
            data = await service.getDataInternal(key, totalBytes, chunkSize);
            if (!data) {
                return { kind: "notFound" };
            }
            await service.putDataIntoCache(key, data);
        }        
        return { kind: "success", data };
    }    
    
    public static async putData(key: string, data: Uint8Array, unchunked?: boolean) : Promise<boolean> {
        await service.putDataIntoCache(key, data);

        if (unchunked) {
            await putChunk(key, 0, data);
            return true;
        }

        const size = data.byteLength;
        const chunks = [];
        for (let byteStart = 0; byteStart < size; byteStart += CHUNK_SIZE_BYTES) {
            const byteEnd = Math.min(size, byteStart + CHUNK_SIZE_BYTES);
            const slice = data.slice(byteStart, byteEnd);
            chunks.push(slice);
        }

        await async.forEachOfLimit(chunks, 10, async (c, i, callback) => {
            const index = i as number;
            await putChunk(key, index, c);
            callback(null);
        });

        return true;
    }

    static async tryGetDataFromCache(key: string) : Promise<Option<Uint8Array>> {
        try {
            const request = new Request(key);
            const response = await caches.match(request);
            if (!response) {
                return null;
            }
            return new Uint8Array(await response.arrayBuffer());
        } catch (e) {
            console.log(e);
            return null;
        }
    }

    static async putDataIntoCache(key: string, data: Uint8Array) : Promise<boolean> {
        try {
            if (data.length > MAX_CACHE_OBJECT_SIZE_BYTES) {
                return false;
            }
            const cache = await caches.open("v1");            
            if (!cache) {
                return false;
            }
            await cache.put(new Request(key), new Response(data));
            return true;
        } catch (e) {
            console.log(e);
            return false;
        }
    }
    
    static async getDataInternal(key: string, totalBytes?: number, chunkSize?: number) : Promise<Option<Uint8Array>> {
        
        if (!totalBytes || !chunkSize) {
            const response = await getChunk(key, 0);
            switch (response.kind) {
                case "notFound":
                    return null;
                case "success":
                    return response.data;
            }
        }

        const bytes = new Uint8Array(totalBytes);
        const chunks = this.getChunkIndexes(totalBytes, chunkSize);

        try {
            await async.mapLimit(chunks, 10, async (i, callback) => {
                const response = await getChunk(key, i);
                if (response.kind === "success") {
                    const offset = i * chunkSize;
                    bytes.set(response.data, offset);
                    callback(null);
                } else {
                    callback({
                        name: "getDataFailed",
                        message: response.kind
                    });
                }
            });
        } catch (e) {
            console.log(e);
            return null;    
        }

        return bytes;
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
