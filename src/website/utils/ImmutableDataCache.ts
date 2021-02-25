import { CacheExpiration } from 'workbox-expiration';
import { Option } from "../domain/model/common";
import { MAX_CACHE_OBJECT_SIZE_BYTES } from "../constants";

interface ImmutableDataCacheExpirationConfig {
    maxEntries?: number;
    maxAgeSeconds?: number;
}

export class ImmutableDataCache {

    private _expirationManager: CacheExpiration;
    private _cacheName: string;

    constructor(cacheName: string, config: ImmutableDataCacheExpirationConfig = {}) {
        this._cacheName = cacheName;
        this._expirationManager = new CacheExpiration(
            cacheName, 
            {
                maxAgeSeconds: config.maxAgeSeconds,
                maxEntries: config.maxEntries
            });
    }

    public async tryGet(key: string) : Promise<Option<Uint8Array>> {
        try {
            const cache = await this.openCache();            
            if (!cache) {
                return null;
            }

            const response = await cache.match(key);
            if (!response) {
                return null;
            }

            // We are doing this with the assumption that the cached objects are immutable
            await this._expirationManager.updateTimestamp(key);

            return new Uint8Array(await response.arrayBuffer());
        } catch (e) {
            console.log(e);
            return null;
        }
    }

    public async put(key: string, data: Uint8Array) : Promise<boolean> {
        try {
            if (data.length > MAX_CACHE_OBJECT_SIZE_BYTES) {
                return false;
            }

            const cache = await this.openCache();            
            if (!cache) {
                return false;
            }
            
            await cache.put(key, new Response(data));

            await this._expirationManager.updateTimestamp(key);

            return true;
        } catch (e) {
            console.log(e);
            return false;
        }
    }

    public async scavenge() {
        await this._expirationManager.expireEntries();
    }

    private async openCache() : Promise<Option<Cache>> {
        if (!("caches" in window)) {
            return null;
        }

        return await caches.open(this._cacheName) ?? null; 
    }
}