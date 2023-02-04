import { handleRequest } from "./http_request";
import { registerRoute, setCatchHandler, setDefaultHandler } from "workbox-routing";
import { ExpirationPlugin } from "workbox-expiration";
import { CustomCacheFirst, CustomStaleWhileRevalidate } from "./strategies";
import { CacheableResponsePlugin } from "./cacheable";

declare const self: ServiceWorkerGlobalScope;

const DEBUG = false;

//workbox config
registerRoute(
    (route) => {
        return [
            /assets\/.*png|jpg|svg|gif/,
            /main-.*[css|js]$/,
            /ArchitecturePage-.*js$/,
            /HashLinkTarget-.*js$/,
            /Headline-.*js$/,
            /RoadmapPage-.*js$/,
            /SMSUpgrade-.*js$/,
            /WhitepaperPage-.*js$/,
            /worker.js/,
        ].some((re) => re.test(route.request.url));
    },
    new CustomCacheFirst({
        cacheName: "openchat_cache_first",
        plugins: [
            new CacheableResponsePlugin({
                statuses: [200],
                notHeaders: {
                    "content-type": "text/html",
                    "Content-Type": "text/html",
                },
            }),
            new ExpirationPlugin({
                maxAgeSeconds: 30 * 24 * 60 * 60,
            }),
        ],
    })
);

registerRoute(
    (route) => {
        return [/openchat.webmanifest/, /icon.png/, /apple-touch-icon.png/, /oc-logo2.svg/].some(
            (re) => re.test(route.request.url)
        );
    },
    new CustomStaleWhileRevalidate({
        cacheName: "openchat_stale_while_revalidate",
        plugins: [
            new CacheableResponsePlugin({
                statuses: [200],
                notHeaders: {
                    "content-type": "text/html",
                    "Content-Type": "text/html",
                },
            }),
            new ExpirationPlugin({
                maxAgeSeconds: 30 * 24 * 60 * 60,
            }),
        ],
    })
);

setDefaultHandler(({ request }) => {
    return defaultHandler(request);
});

setCatchHandler(({ request }) => {
    return defaultHandler(request);
});

addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting().then(() => console.log("SW: skipping waiting in response to message"));
    }
});

// Always install updated SW immediately
self.addEventListener("install", (ev) => {
    ev.waitUntil(self.skipWaiting().then(() => console.log("SW: skipWaiting promise resolved")));
});

self.addEventListener("activate", (ev) => {
    // upon activation take control of all clients (tabs & windows)
    ev.waitUntil(self.clients.claim());
    console.log("SW: actived");
});

async function defaultHandler(request: Request): Promise<Response> {
    let referrer: URL | undefined;
    try {
        if (request.referrer) {
            referrer = new URL(request.referrer);
        }
    } catch {
        console.error("Invalid referrer: ", request.referrer);
    }

    console.log("SW: version 66");

    try {
        console.debug(
            "SW: default handler - signed in falling back to default ic service worker ",
            request.url,
            referrer?.pathname
        );
        return handleRequest(request);
    } catch (e) {
        const error_message = String(e);
        console.error(error_message);
        if (DEBUG) {
            return new Response(error_message, {
                status: 501,
            });
        }
        return new Response("Internal Error", { status: 502 });
    }
}
