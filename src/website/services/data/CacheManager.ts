import { Option } from "../../domain/model/common";
import { ImmutableDataCache } from "../../utils/ImmutableDataCache";
import { DataSource } from "./CachingDataService";

export class CacheManager {
    private _caches: Map<DataSource, ImmutableDataCache> = new Map<DataSource, ImmutableDataCache>();

    constructor() {
        this._caches.set(
            DataSource.Avatar, 
            new ImmutableDataCache(
                DataSource[DataSource.Avatar], 
                { 
                    maxEntries: 200, 
                    maxAgeSeconds: 28 * 24 * 60 * 60 // 4 weeks
                }
            )
        );

        this._caches.set(
            DataSource.MediaMessage, 
            new ImmutableDataCache(
                DataSource[DataSource.MediaMessage], 
                { 
                    maxEntries: 50, 
                    maxAgeSeconds: 7 * 24 * 60 * 60 // 1 week
                }
            )
        );
    }

    public async tryGet(src: DataSource, key: string) : Promise<Option<Uint8Array>> {
        const cache = this._caches.get(src);
        if (!cache) {
            return null;
        }

        return await cache.tryGet(key);
    }
    
    public async put(src: DataSource, key: string, data: Uint8Array) : Promise<boolean> {
        const cache = this._caches.get(src);
        if (!cache) {
            return false;
        }
        
        return await cache.put(key, data);
    }

    public async scavenge() {
        for (const cache of this._caches.values()) {
            await cache.scavenge();
        }        
    }
}