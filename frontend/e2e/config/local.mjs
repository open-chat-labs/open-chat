// The suite creates users, groups and messages, so it only ever runs against a local replica's
// dev server (PRD #10550 invariant 4).
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** `url`, if it's on this machine; anything else throws. */
export function localUrl(url) {
    const { hostname } = new URL(url);
    if (!LOCAL_HOSTS.has(hostname)) {
        throw new Error(`The e2e suite only runs against a local server, not ${hostname}`);
    }
    return url;
}
