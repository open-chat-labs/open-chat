import { HttpAgent, type Identity } from "@icp-sdk/core/agent";
import { isMainnet, offline } from "@shared";

// How long a query may wait for its response to start arriving. Queries normally answer well
// within a second, so a query still waiting after this is almost always stuck on a connection
// which died while the device was asleep or changed networks. The browser can take a long time
// to notice that on its own, and every query in an updates pass waits for it. Aborting lets the
// agent's retry send the query again.
export const QUERY_RESPONSE_TIMEOUT_MS = 10_000;

// The queries in flight across every agent in this context, so that `abortInFlightQueries` can
// abandon them all at once
const inFlightQueries = new Set<AbortController>();

/**
 * Aborts every query in flight. Called when the app resumes after being suspended, since queries
 * sent before the suspension are likely to be waiting on a dead connection, and an updates pass
 * holding one of them would otherwise keep the next pass from starting. Each aborted query is
 * retried by the agent. Updates are left alone: resubmitting one is not always harmless.
 *
 * Returns the number of queries aborted.
 */
export function abortInFlightQueries(): number {
    const count = inFlightQueries.size;
    for (const controller of inFlightQueries) {
        controller.abort(new DOMException("Aborted after the app resumed", "AbortError"));
    }
    inFlightQueries.clear();
    return count;
}

function isQueryRequest(input: RequestInfo | URL): boolean {
    const url = input instanceof Request ? input.url : input.toString();
    try {
        return /^\/api\/v\d+\/canister\/[^/]+\/query$/.test(new URL(url, "http://_").pathname);
    } catch {
        return false;
    }
}

/**
 * Wraps `fetch` so that query requests can be aborted, either by `abortInFlightQueries` or by
 * waiting longer than `timeoutMs` for the response to start. Other requests pass straight through.
 * The timeout stops once the response headers arrive, so a large response on a slow connection
 * is not cut off while its body downloads.
 */
export function createQueryAwareFetch(
    baseFetch: typeof fetch = (input, init) => fetch(input, init),
    timeoutMs: number = QUERY_RESPONSE_TIMEOUT_MS,
): typeof fetch {
    return async (input, init) => {
        if (!isQueryRequest(input)) {
            return baseFetch(input, init);
        }

        const controller = new AbortController();
        const callerSignal = init?.signal;
        if (callerSignal) {
            if (callerSignal.aborted) {
                controller.abort(callerSignal.reason);
            } else {
                callerSignal.addEventListener("abort", () => controller.abort(callerSignal.reason), {
                    once: true,
                });
            }
        }

        const timer = setTimeout(
            () =>
                controller.abort(
                    new DOMException(`No response after ${timeoutMs}ms`, "TimeoutError"),
                ),
            timeoutMs,
        );
        inFlightQueries.add(controller);
        try {
            return await baseFetch(input, { ...init, signal: controller.signal });
        } finally {
            clearTimeout(timer);
            inFlightQueries.delete(controller);
        }
    };
}

export function createHttpAgentSync(identity: Identity, icUrl: string): HttpAgent {
    const [agent] = createHttpAgentInternal(identity, icUrl);
    return agent;
}

export async function createHttpAgent(identity: Identity, icUrl: string): Promise<HttpAgent> {
    const [agent, fetchRootKeyPromise] = createHttpAgentInternal(identity, icUrl);
    await fetchRootKeyPromise;
    return agent;
}

function createHttpAgentInternal(identity: Identity, icUrl: string): [HttpAgent, Promise<void>] {
    const agent = HttpAgent.createSync({
        identity,
        host: icUrl,
        verifyQuerySignatures: false,
        fetch: createQueryAwareFetch(),
    });
    const fetchRootKey = !isMainnet(icUrl) && !offline();
    const fetchRootKeyPromise = fetchRootKey
        ? agent.fetchRootKey().then((_) => {})
        : Promise.resolve();

    return [agent, fetchRootKeyPromise];
}
