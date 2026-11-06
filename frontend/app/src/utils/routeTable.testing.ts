// For specs: what page.js makes of a URL with the route table (routeTable.ts), as the routers
// register it. Shared by the table's own spec and the native tree's locations spec.
import type { RouteParams } from "@client";
import page from "page";
import { redirectTable, routeTable } from "./routeTable";

// What Route needs of its page.js instance, which page.js doesn't expose: decoding the URL's parts
// as page.js does by default
const decoder = {
    _decodeURLEncodedURIComponent: (value: unknown) =>
        typeof value === "string" ? decodeURIComponent(value.replace(/\+/g, " ")) : value,
} as unknown as PageJS.Static;

// What page.js would make of a URL: the first entry whose path matches, as the router registers them
export function resolve(url: string): RouteParams {
    const [pathname, querystring = ""] = url.split("?");
    for (const entry of routeTable) {
        const params: Record<string, string> = {};
        // page.js's typings leave out Route's third argument, the instance it decodes with
        const Route = page.Route as unknown as new (
            path: string,
            options: undefined,
            page: PageJS.Static,
        ) => PageJS.Route;
        if (new Route(entry.path, undefined, decoder).match(pathname, params)) {
            return entry.parse({ params, querystring, pathname, path: url } as PageJS.Context);
        }
    }
    throw new Error(`no route for ${url}`);
}

// Where a redirect sends a path, if one does
export function redirect(pathname: string): string | undefined {
    for (const entry of redirectTable) {
        const params: Record<string, string> = {};
        const Route = page.Route as unknown as new (
            path: string,
            options: undefined,
            page: PageJS.Static,
        ) => PageJS.Route;
        if (new Route(entry.path, undefined, decoder).match(pathname, params)) {
            return entry.to(params);
        }
    }
    return undefined;
}
