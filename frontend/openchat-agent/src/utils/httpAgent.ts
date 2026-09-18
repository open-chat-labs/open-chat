import { HttpAgent, type Identity } from "@icp-sdk/core/agent";
import { isMainnet, offline } from "@shared";

// How long a query may wait for its response to start arriving. Queries normally answer well
// within a second, so a query still waiting after this is almost always stuck on a connection
// which died while the device was asleep or changed networks. Aborting lets the agent's retry
// send the query again. Generous, because a heavy composite query (eg. summary updates for a
// large batch of chats on a busy subnet) can legitimately take several seconds, and a limit it
// cannot meet would fail every attempt where waiting would have succeeded. The common stuck case,
// coming back after a suspension, is handled sooner by `abortInFlightQueries`.
export const QUERY_RESPONSE_TIMEOUT_MS = 30_000;

// A query sent at least this long ago may have passed its ingress expiry, which the agent sets
// to between 4 and 5 minutes after sending (it rounds down to the minute). Kept below that so
// clock drift cannot push a resend past the replica's check.
export const QUERY_EXPIRY_SAFE_AGE_MS = 3 * 60 * 1000;

// Recognised by the agent as an expired request, see `isIngressExpiryInvalidResponse` in
// @icp-sdk/core
const EXPIRED_QUERY_RESPONSE_TEXT =
    "Invalid request expiry: sent before the app was suspended, so not resent";

type InFlightQuery = {
    controller: AbortController;
    sentAt: number;
    body: unknown;
};

// The queries in flight across every agent in this context, so that `abortInFlightQueries` can
// abandon them all at once
const inFlightQueries = new Set<InFlightQuery>();

// The bodies of aborted queries too old to resend. The agent retries an aborted query by
// resending the same signed request, body object included, and once its ingress expiry has passed
// the replica is certain to reject it. Answering those resends here with the same rejection makes
// the agent rebuild the query with a fresh expiry straight away, without the wasted round trip.
const expiredQueryBodies = new WeakSet<object>();

function abortQuery(query: InFlightQuery, reason: DOMException, now: number) {
    if (now - query.sentAt >= QUERY_EXPIRY_SAFE_AGE_MS && isObject(query.body)) {
        expiredQueryBodies.add(query.body);
    }
    inFlightQueries.delete(query);
    query.controller.abort(reason);
}

function isObject(value: unknown): value is object {
    return typeof value === "object" && value !== null;
}

/**
 * Aborts every query in flight. Called when the app resumes after being suspended, since queries
 * sent before the suspension are likely to be waiting on a dead connection, and an updates pass
 * holding one of them would otherwise keep the next pass from starting. Each aborted query is
 * retried by the agent, rebuilt from scratch if it is old enough to have expired. Updates are left
 * alone: resubmitting one is not always harmless.
 *
 * Returns the number of queries aborted.
 */
export function abortInFlightQueries(now: number = Date.now()): number {
    const queries = [...inFlightQueries];
    const reason = new DOMException("Aborted after the app resumed", "AbortError");
    for (const query of queries) {
        abortQuery(query, reason, now);
    }
    return queries.length;
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

        const body = init?.body;
        if (isObject(body) && expiredQueryBodies.has(body)) {
            return new Response(EXPIRED_QUERY_RESPONSE_TEXT, {
                status: 400,
                statusText: "Bad Request",
            });
        }

        const controller = new AbortController();
        const callerSignal = init?.signal;
        if (callerSignal) {
            if (callerSignal.aborted) {
                controller.abort(callerSignal.reason);
            } else {
                callerSignal.addEventListener(
                    "abort",
                    () => controller.abort(callerSignal.reason),
                    {
                        once: true,
                    },
                );
            }
        }

        const query: InFlightQuery = { controller, sentAt: Date.now(), body };
        // After a suspension this can fire late, at the same time as the resume abort, so it
        // applies the same expiry check
        const timer = setTimeout(
            () =>
                abortQuery(
                    query,
                    new DOMException(`No response after ${timeoutMs}ms`, "TimeoutError"),
                    Date.now(),
                ),
            timeoutMs,
        );
        inFlightQueries.add(query);
        try {
            return await baseFetch(input, { ...init, signal: controller.signal });
        } finally {
            clearTimeout(timer);
            inFlightQueries.delete(query);
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
