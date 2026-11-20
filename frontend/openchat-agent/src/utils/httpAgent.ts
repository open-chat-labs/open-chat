import {
    AgentError,
    HttpAgent,
    type Identity,
    IngressExpiryInvalidErrorCode,
} from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";
import { isMainnet, offline } from "@shared";
import { queryOutcomes, SLOW_QUERY_MS, type QueryOutcomes } from "./connectionHealth";

// How long a query may wait for its response to start arriving. Queries normally answer well
// within a second, so a query still waiting after this is almost always stuck on a connection
// which died while the device was asleep or changed networks. Aborting lets the agent's retry
// send the query again. Generous, because a heavy composite query (eg. summary updates for a
// large batch of chats on a busy subnet) can legitimately take several seconds, and a limit it
// cannot meet would fail every attempt where waiting would have succeeded. The common stuck case,
// coming back after a suspension, is handled sooner by `abortInFlightQueries`.
export const QUERY_RESPONSE_TIMEOUT_MS = 30_000;

// How long a request for the replica's status, which is how the agent fetches the root key off
// mainnet, may wait for its response to start arriving. A replica answers it straight away, so one
// that hasn't by then is down or stuck, and without a limit every request waiting on the root key
// (and the app's start-up with them) would wait forever. The agent retries the fetch a few times
// before giving up, and tries again on the next request.
export const ROOT_KEY_RESPONSE_TIMEOUT_MS = 5_000;

// A query sent at least this long ago may have passed its ingress expiry, which the agent sets
// to between 4 and 5 minutes after sending (it rounds down to the minute). Kept below that so
// clock drift cannot push a resend past the replica's check.
export const QUERY_EXPIRY_SAFE_AGE_MS = 3 * 60 * 1000;

// A timer that fires this much later than it was due means this context was suspended (the device
// slept, or the app was in the background), which says nothing about the connection
const LATE_TIMER_MS = 5_000;

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

function requestPath(input: RequestInfo | URL): string | undefined {
    const url = input instanceof Request ? input.url : input.toString();
    try {
        return new URL(url, "http://_").pathname;
    } catch {
        return undefined;
    }
}

function isQueryRequest(input: RequestInfo | URL): boolean {
    return /^\/api\/v\d+\/canister\/[^/]+\/query$/.test(requestPath(input) ?? "");
}

function isStatusRequest(input: RequestInfo | URL): boolean {
    return /^\/api\/v\d+\/status$/.test(requestPath(input) ?? "");
}

// Aborts the request if its response hasn't started arriving within `timeoutMs`
async function fetchWithTimeout(
    baseFetch: typeof fetch,
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    timeoutMs: number,
): Promise<Response> {
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
        () => controller.abort(new DOMException(`No response after ${timeoutMs}ms`, "TimeoutError")),
        timeoutMs,
    );
    try {
        return await baseFetch(input, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Wraps `fetch` so that query requests can be aborted, either by `abortInFlightQueries` or by
 * waiting longer than `timeoutMs` for the response to start. A request for the replica's status
 * (the root key) is aborted after `statusTimeoutMs`. Other requests pass straight through.
 * The timeout stops once the response headers arrive, so a large response on a slow connection
 * is not cut off while its body downloads.
 *
 * Each query also tells `outcomes` how the connection is doing: good once its response starts
 * arriving, bad if it fails or has waited `SLOW_QUERY_MS`. A query aborted here or by the caller
 * says nothing about the connection, and is not counted.
 */
export function createQueryAwareFetch(
    baseFetch: typeof fetch = (input, init) => fetch(input, init),
    timeoutMs: number = QUERY_RESPONSE_TIMEOUT_MS,
    outcomes: QueryOutcomes = queryOutcomes,
    statusTimeoutMs: number = ROOT_KEY_RESPONSE_TIMEOUT_MS,
): typeof fetch {
    return async (input, init) => {
        if (isStatusRequest(input)) {
            return fetchWithTimeout(baseFetch, input, init, statusTimeoutMs);
        }
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
        // Each query counts once, as good or bad
        let counted = false;
        const slowTimer = setTimeout(() => {
            counted = true;
            if (Date.now() - query.sentAt < SLOW_QUERY_MS + LATE_TIMER_MS) {
                outcomes.bad(query.sentAt);
            }
        }, SLOW_QUERY_MS);
        inFlightQueries.add(query);
        try {
            const response = await baseFetch(input, { ...init, signal: controller.signal });
            if (!counted) {
                counted = true;
                outcomes.good(Date.now() - query.sentAt);
            }
            return response;
        } catch (err) {
            if (!counted && !controller.signal.aborted) {
                counted = true;
                outcomes.bad(query.sentAt);
            }
            throw err;
        } finally {
            clearTimeout(timer);
            clearTimeout(slowTimer);
            inFlightQueries.delete(query);
        }
    };
}

// The least time between two of the resyncs `ResyncingHttpAgent` makes of its clock. A resync
// costs three requests, and while the replicas keep rejecting requests every one of them would
// otherwise ask for another.
export const TIME_RESYNC_MIN_INTERVAL_MS = 5_000;

function isExpiryRejection(err: unknown): err is AgentError {
    return err instanceof AgentError && err.hasCode(IngressExpiryInvalidErrorCode);
}

// True for the rejection `createQueryAwareFetch` answers with on the replica's behalf. It says
// nothing about the agent's clock, so the request only needs building again.
function isExpiredBeforeResend(err: AgentError): boolean {
    return (err.code as IngressExpiryInvalidErrorCode).message === EXPIRED_QUERY_RESPONSE_TEXT;
}

/**
 * An `HttpAgent` which resyncs its clock with the IC whenever a replica rejects the expiry of one
 * of its requests.
 *
 * The agent gives each request an expiry worked out from the device's clock plus an offset, which
 * it measures by asking a replica for the time. It only ever measures that offset once: the first
 * time an expiry is rejected or a certificate looks too old. After that a rejected expiry is simply
 * thrown, so if the offset is wrong (the replica it asked was behind, or the device's clock has
 * been corrected since) every request the agent sends is rejected until the page is reloaded.
 *
 * Here a rejected expiry makes the agent measure the offset again. A query is then sent once more.
 * An update call is not: the rejection may be of a resend, made after the call was accepted but
 * its response lost, and calling again would then run the update twice. It fails as before, but
 * with the clock put right for the next request.
 */
export class ResyncingHttpAgent extends HttpAgent {
    #resync: Promise<void> | undefined;
    #lastResyncAt = -Infinity;

    override async query(...args: Parameters<HttpAgent["query"]>): ReturnType<HttpAgent["query"]> {
        const [canisterId, fields] = args;
        const offset = this.getTimeDiffMsecs();
        try {
            return await super.query(...args);
        } catch (err) {
            if (!isExpiryRejection(err)) {
                throw err;
            }
            const rebuild =
                isExpiredBeforeResend(err) ||
                (await this.#clockChangedSince(offset, fields.effectiveCanisterId ?? canisterId));
            if (!rebuild) {
                throw err;
            }
            return super.query(...args);
        }
    }

    override async call(...args: Parameters<HttpAgent["call"]>): ReturnType<HttpAgent["call"]> {
        const [canisterId, options] = args;
        const offset = this.getTimeDiffMsecs();
        try {
            return await super.call(...args);
        } catch (err) {
            if (isExpiryRejection(err)) {
                await this.#clockChangedSince(offset, options.effectiveCanisterId ?? canisterId);
            }
            throw err;
        }
    }

    // Resolves to whether the clock's offset differs from `offset`, the one in use when a rejected
    // request was built. If it is still the same the clock is resynced first. If it has changed
    // already, the request was only rejected for having been built before that.
    async #clockChangedSince(offset: number, canisterId: Principal | string): Promise<boolean> {
        if (this.getTimeDiffMsecs() === offset) {
            await this.#resyncTime(canisterId);
        }
        return this.getTimeDiffMsecs() !== offset;
    }

    // Does nothing if the clock was last resynced too recently. Requests rejected together share
    // one resync.
    #resyncTime(canisterId: Principal | string): Promise<void> {
        if (this.#resync === undefined) {
            // `Math.abs` so that the device's clock being put back cannot hold off the next resync
            if (Math.abs(Date.now() - this.#lastResyncAt) < TIME_RESYNC_MIN_INTERVAL_MS) {
                return Promise.resolve();
            }
            const previousOffset = this.getTimeDiffMsecs();
            // `syncTime` also resolves, leaving the offset as it was, if no replica gave the time
            this.#resync = this.syncTime(Principal.from(canisterId))
                .then(
                    () =>
                        console.warn(
                            `Asked the IC for the time after a request's expiry was rejected. The agent's clock offset was ${previousOffset}ms, now ${this.getTimeDiffMsecs()}ms`,
                        ),
                    (err) => console.warn("Unable to resync the agent's clock with the IC", err),
                )
                .finally(() => {
                    this.#lastResyncAt = Date.now();
                    this.#resync = undefined;
                });
        }
        return this.#resync;
    }
}

/**
 * Creates the agent for `icUrl` without waiting on the network.
 *
 * On mainnet the agent verifies everything with the IC's root key, which it has built in. Any other
 * network (a local replica, a testnet) has its own root key, which has to be fetched from the
 * replica first. The agent is then created without one, so every request it makes waits for the
 * key to be fetched (the agent's own guard) and nothing is sent before it can be verified. The
 * fetch is started here, in the background, so the key is usually there before the first request,
 * and anything that doesn't need the network (reading the cache) needn't wait for it. If the fetch
 * fails, or takes longer than `ROOT_KEY_RESPONSE_TIMEOUT_MS`, the next request tries again.
 */
export function createHttpAgent(identity: Identity, icUrl: string): HttpAgent {
    const fetchRootKey = !isMainnet(icUrl);
    const agent = ResyncingHttpAgent.createSync({
        identity,
        host: icUrl,
        verifyQuerySignatures: false,
        fetch: createQueryAwareFetch(),
        shouldFetchRootKey: fetchRootKey,
    });
    if (fetchRootKey && !offline()) {
        void prefetchRootKey(agent);
    }
    return agent;
}

async function prefetchRootKey(agent: HttpAgent): Promise<void> {
    try {
        await agent.fetchRootKey();
    } catch (err) {
        console.warn("Unable to fetch the root key, it will be fetched again when needed", err);
    }
}
