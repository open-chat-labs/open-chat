// One IntersectionObserver per (root, rootMargin, threshold) configuration,
// shared by every element observed with that configuration, instead of one
// observer per component instance. Each element gets the newest entry
// reported for it in a delivery (the same entry a dedicated observer's
// "sort by time, take first" would pick).

type Handler = (entry: IntersectionObserverEntry) => void;
type Shared = { observer: IntersectionObserver; handlers: WeakMap<Element, Handler> };

const byRoot = new WeakMap<Node, Map<string, Shared>>();
const rootless = new Map<string, Shared>();

function configKey(init: IntersectionObserverInit): string {
    const threshold = init.threshold ?? 0;
    return `${init.rootMargin ?? ""}|${Array.isArray(threshold) ? threshold.join(",") : threshold}`;
}

function sharedFor(init: IntersectionObserverInit): Shared {
    const root = init.root instanceof Node ? init.root : undefined;
    let pool: Map<string, Shared> | undefined;
    if (root === undefined) {
        pool = rootless;
    } else {
        pool = byRoot.get(root);
        if (pool === undefined) {
            pool = new Map();
            byRoot.set(root, pool);
        }
    }
    const key = configKey(init);
    let shared = pool.get(key);
    if (shared === undefined) {
        const handlers = new WeakMap<Element, Handler>();
        const observer = new IntersectionObserver((entries) => {
            const latest = new Map<Element, IntersectionObserverEntry>();
            for (const entry of entries) {
                const current = latest.get(entry.target);
                if (current === undefined || entry.time > current.time) {
                    latest.set(entry.target, entry);
                }
            }
            for (const [target, entry] of latest) {
                // a throwing handler must not starve the other targets in the
                // batch, as it could not when each had its own observer
                try {
                    handlers.get(target)?.(entry);
                } catch (e) {
                    console.error("IntersectionObserver handler failed", e);
                }
            }
        }, init);
        shared = { observer, handlers };
        pool.set(key, shared);
    }
    return shared;
}

// Returns an unobserve function. Safe to call more than once.
export function observeIntersection(
    el: Element,
    handler: Handler,
    init: IntersectionObserverInit = {},
): () => void {
    const shared = sharedFor(init);
    shared.handlers.set(el, handler);
    shared.observer.observe(el);
    return () => {
        shared.handlers.delete(el);
        shared.observer.unobserve(el);
    };
}
