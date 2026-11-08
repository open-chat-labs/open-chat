// Pages the website canister serves beside the app as their own documents, rather than routes
// of the app: the canister map, written by the website build as /canister-map-<version>.html
// and framed by the Architecture page. The service worker leaves their navigations to the
// browser (they must not replace the cached app document), and the app opens links to them as
// whole pages (in the native shells, in an external browser).
export const STANDALONE_PAGE_PREFIXES = ["/canister-map-"];

export function isStandalonePagePath(pathname: string): boolean {
    return STANDALONE_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
