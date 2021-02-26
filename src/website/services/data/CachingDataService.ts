import { CacheManager } from "./CacheManager";
import { DataService } from "./DataService";

export enum DataSource {
    Avatar,
    MediaMessage,
    FileMessage
}

class CachingDataService {
    private _cache: CacheManager;
    private _service: DataService;

    constructor() {
        this._cache = new CacheManager();
        this._service = new DataService();
    }

    public async getData(src: DataSource, key: string, totalBytes?: number, chunkSize?: number) : Promise<GetDataResponse> {
        let data = await this._cache.tryGet(src, key);
        if (!data) {
            data = await this._service.getData(key, totalBytes, chunkSize);
            if (!data) {
                return { kind: "notFound" };
            }
            await this._cache.put(src, key, data);
        }        
        return { kind: "success", data };
    }    
    
    public async putData(src: DataSource, key: string, data: Uint8Array, unchunked?: boolean) : Promise<boolean> {
        await this._cache.put(src, key, data);
        return this._service.putData(key, data, unchunked);
    }

    public async scavengeCache() {
        await this._cache.scavenge();
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

const service = new CachingDataService();

export default service;