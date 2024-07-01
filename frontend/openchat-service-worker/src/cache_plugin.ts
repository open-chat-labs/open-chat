import { type WorkboxPlugin } from "workbox-core/types";

class CustomCachePlugin implements WorkboxPlugin {
    cacheWillUpdate: WorkboxPlugin["cacheWillUpdate"] = async ({ response }) => {
        if (!response) return null;

        if (response.status !== 200) {
            return null;
        }

        const responseContentType = response.headers.get("content-type");
        if (responseContentType && responseContentType.toLocaleLowerCase().includes("text/html")) {
            console.log("Received fallback content type of text/html, response will not be cached");
            return null;
        }

        // for anything else, allow caching to proceed
        return response;
    };
}

export { CustomCachePlugin };
