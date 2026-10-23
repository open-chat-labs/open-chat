// Whether the app's own traffic says the connection is unusable, though the browser reports it
// online, as cellular connections often do. Measured in the worker, see `ConnectionHealth` in
// openchat-agent, and passed on to the main thread.
let connectionUnusable = false;

export function setConnectionUnusable(unusable: boolean): void {
    connectionUnusable = unusable;
}

// The official API domains of the IC mainnet, whose root key is baked into the agent libraries.
// Every other network has its own, which has to be fetched before any certificate can be
// verified. A mainnet URL missing from this list still works, but the built-in key it should
// have used is swapped for one fetched off the network, which is exactly the trust the built-in
// key exists to avoid.
const MAINNET_DOMAINS = ["icp-api.io", "ic0.app", "icp0.io"];

export function isMainnet(icUrl: string): boolean {
    let hostname: string;
    try {
        hostname = new URL(icUrl).hostname;
    } catch {
        return false;
    }
    return MAINNET_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function offline(): boolean {
    return !navigator.onLine || connectionUnusable;
}
