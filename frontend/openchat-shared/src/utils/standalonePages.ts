// Pages the website canister serves beside the app as their own documents, rather than routes
// of the app. The service worker leaves their navigations to the browser (they must not replace
// the cached app document), the app opens links to them as whole pages (in the native shells,
// in an external browser), and the website build writes them into build/ (see
// frontend/app/rollup.config.mjs).
export const STANDALONE_PAGE_PATHS = ["/canisters"];

export function isStandalonePagePath(pathname: string): boolean {
    return STANDALONE_PAGE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
