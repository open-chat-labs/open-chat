import {
    CacheFirst,
    NetworkFirst,
    StaleWhileRevalidate,
    Strategy,
    StrategyHandler,
} from "workbox-strategies";
import { handleRequest } from "./http_request";

function toRequest(input) {
    return typeof input === "string" ? new Request(input) : input;
}

export class IcHandler extends StrategyHandler {
    async fetch(input: RequestInfo): Promise<Response> {
        console.debug(
            "SW: cache miss (or revalidation), falling back to default ic service worker ",
            input
        );
        const response = await handleRequest(toRequest(input));
        return response;
    }
}

function createIcHandler(strategy: Strategy, handler: StrategyHandler): IcHandler {
    return new IcHandler(strategy, {
        event: handler.event,
        request: handler.request,
        params: handler.params,
    });
}

export class CustomStaleWhileRevalidate extends StaleWhileRevalidate {
    async _handle(request: Request, handler: StrategyHandler) {
        return super._handle(request, createIcHandler(this, handler));
    }
}

export class CustomCacheFirst extends CacheFirst {
    async _handle(request: Request, handler: StrategyHandler) {
        return super._handle(request, createIcHandler(this, handler));
    }
}

export class CustomNetworkFirst extends NetworkFirst {
    async _handle(request: Request, handler: StrategyHandler) {
        return super._handle(request, createIcHandler(this, handler));
    }
}
