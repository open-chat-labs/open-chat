import { WorkboxPlugin } from "workbox-core";

export interface CacheableResponseOptions {
    statuses?: number[];
    headers?: { [headerName: string]: string };
    notHeaders?: { [headerName: string]: string };
}

class CacheableResponse {
    private readonly _statuses?: CacheableResponseOptions["statuses"];
    private readonly _headers?: CacheableResponseOptions["headers"];
    private readonly _notHeaders?: CacheableResponseOptions["notHeaders"];

    constructor(config: CacheableResponseOptions = {}) {
        this._statuses = config.statuses;
        this._headers = config.headers;
        this._notHeaders = config.notHeaders;
    }

    isResponseCacheable(response: Response): boolean {
        let cacheable = true;

        if (this._statuses) {
            cacheable = this._statuses.includes(response.status);
        }

        if (this._headers && cacheable) {
            cacheable = Object.keys(this._headers).some((headerName) => {
                return response.headers.get(headerName) === this._headers![headerName];
            });
        }

        if (this._notHeaders && cacheable) {
            cacheable = !Object.keys(this._notHeaders).some((headerName) => {
                return response.headers.get(headerName) === this._notHeaders![headerName];
            });
        }

        return cacheable;
    }
}

class CacheableResponsePlugin implements WorkboxPlugin {
    private readonly _cacheableResponse: CacheableResponse;

    constructor(config: CacheableResponseOptions) {
        this._cacheableResponse = new CacheableResponse(config);
    }

    cacheWillUpdate: WorkboxPlugin["cacheWillUpdate"] = async ({ response }) => {
        if (this._cacheableResponse.isResponseCacheable(response)) {
            return response;
        }
        return null;
    };
}

export { CacheableResponsePlugin };
