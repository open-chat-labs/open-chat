import { AnonymousIdentity, HttpAgent } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";
import { vi } from "vitest";
import { abortInFlightQueries, createQueryAwareFetch, QUERY_EXPIRY_SAFE_AGE_MS } from "./httpAgent";

const QUERY_URL = new URL("https://icp-api.io/api/v3/canister/rrkah-fqaaa-aaaaa-aaaaq-cai/query");
const CALL_URL = new URL("https://icp-api.io/api/v4/canister/rrkah-fqaaa-aaaaa-aaaaq-cai/call");

// A fetch which never answers until its signal is aborted, like one stuck on a dead connection
function hangingFetch() {
    const signals: (AbortSignal | undefined)[] = [];
    const fn = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal ?? undefined;
        signals.push(signal);
        return new Promise<Response>((_, reject) => {
            signal?.addEventListener("abort", () => reject(signal.reason));
        });
    });
    return { fn: fn as unknown as typeof fetch, signals };
}

describe("createQueryAwareFetch", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        abortInFlightQueries();
        vi.useRealTimers();
    });

    test("aborts a query that has no response within the timeout", async () => {
        const { fn } = hangingFetch();
        const wrapped = createQueryAwareFetch(fn, 1000);
        const result = wrapped(QUERY_URL, { method: "POST" });
        const assertion = expect(result).rejects.toMatchObject({ name: "TimeoutError" });
        await vi.advanceTimersByTimeAsync(1000);
        await assertion;
    });

    test("does not time out a query that answers in time", async () => {
        const response = new Response("ok");
        const wrapped = createQueryAwareFetch(() => Promise.resolve(response), 1000);
        await expect(wrapped(QUERY_URL)).resolves.toBe(response);
        // the timer was cleared, so nothing fires later
        expect(vi.getTimerCount()).toBe(0);
    });

    test("abortInFlightQueries aborts every query waiting for a response", async () => {
        const { fn } = hangingFetch();
        const wrapped = createQueryAwareFetch(fn, 60_000);
        const first = wrapped(QUERY_URL);
        const second = wrapped(QUERY_URL.toString());
        const firstAssertion = expect(first).rejects.toMatchObject({ name: "AbortError" });
        const secondAssertion = expect(second).rejects.toMatchObject({ name: "AbortError" });

        expect(abortInFlightQueries()).toBe(2);
        await firstAssertion;
        await secondAssertion;
        expect(abortInFlightQueries()).toBe(0);
    });

    test("leaves update calls alone", async () => {
        const { fn, signals } = hangingFetch();
        const wrapped = createQueryAwareFetch(fn, 1000);
        const init = { method: "POST" };
        void wrapped(CALL_URL, init);

        expect(signals[0]).toBeUndefined();
        expect(abortInFlightQueries()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    test("still honours a signal passed by the caller", async () => {
        const { fn } = hangingFetch();
        const wrapped = createQueryAwareFetch(fn, 60_000);
        const caller = new AbortController();
        const result = wrapped(QUERY_URL, { signal: caller.signal });
        const assertion = expect(result).rejects.toBe("cancelled");
        caller.abort("cancelled");
        await assertion;
    });

    test("resends a recently sent query after aborting it", async () => {
        const { fn } = hangingFetch();
        const wrapped = createQueryAwareFetch(fn, 60 * 60_000);
        const body = new Uint8Array([1, 2, 3]);
        const first = wrapped(QUERY_URL, { body });
        const assertion = expect(first).rejects.toMatchObject({ name: "AbortError" });
        await vi.advanceTimersByTimeAsync(QUERY_EXPIRY_SAFE_AGE_MS - 1000);
        abortInFlightQueries();
        await assertion;

        wrapped(QUERY_URL, { body }).catch(() => undefined);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    test("answers the resend of an aborted query too old to be valid as expired, without sending it", async () => {
        const { fn } = hangingFetch();
        const wrapped = createQueryAwareFetch(fn, 60 * 60_000);
        const body = new Uint8Array([1, 2, 3]);
        const first = wrapped(QUERY_URL, { body });
        const assertion = expect(first).rejects.toMatchObject({ name: "AbortError" });
        // the machine slept: the clock moves on without any timers firing
        vi.setSystemTime(Date.now() + 10 * 60_000);
        abortInFlightQueries();
        await assertion;

        const resend = await wrapped(QUERY_URL, { body });
        expect(resend.status).toBe(400);
        expect(await resend.text()).toContain("Invalid request expiry: ");
        expect(fn).toHaveBeenCalledTimes(1);

        // a different request is sent as normal
        wrapped(QUERY_URL, { body: new Uint8Array([1, 2, 3]) }).catch(() => undefined);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    test("a timeout firing late after a suspension also treats the query as expired", async () => {
        const { fn } = hangingFetch();
        const wrapped = createQueryAwareFetch(fn, 30_000);
        const body = new Uint8Array([1, 2, 3]);
        const first = wrapped(QUERY_URL, { body });
        const assertion = expect(first).rejects.toMatchObject({ name: "TimeoutError" });
        vi.setSystemTime(Date.now() + 10 * 60_000);
        await vi.advanceTimersByTimeAsync(30_000);
        await assertion;

        const resend = await wrapped(QUERY_URL, { body });
        expect(resend.status).toBe(400);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test("the agent does not resend a query aborted after it expired", async () => {
        const sentBodies: unknown[] = [];
        let queryCalls = 0;
        const base = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = new URL(input.toString()).pathname;
            if (path.endsWith("/query")) {
                queryCalls++;
                sentBodies.push(init?.body);
                if (queryCalls === 1) {
                    const signal = init!.signal!;
                    return new Promise<Response>((_, reject) =>
                        signal.addEventListener("abort", () => reject(signal.reason)),
                    );
                }
            }
            // everything else, including the rebuilt query and the agent's time sync, fails fast
            return Promise.resolve(new Response("unavailable", { status: 503 }));
        });
        const agent = HttpAgent.createSync({
            identity: new AnonymousIdentity(),
            host: "https://icp-api.io",
            verifyQuerySignatures: false,
            fetch: createQueryAwareFetch(base as unknown as typeof fetch, 60 * 60_000),
        });

        const result = agent.query(Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai"), {
            methodName: "m",
            arg: new Uint8Array(),
        });
        const settled = result.then(
            () => "resolved",
            () => "rejected",
        );
        await vi.advanceTimersByTimeAsync(0);
        expect(queryCalls).toBe(1);

        vi.setSystemTime(Date.now() + 10 * 60_000);
        abortInFlightQueries();
        await vi.advanceTimersByTimeAsync(30_000);
        await settled;
        // the agent retried the aborted query, rather than giving up
        expect(base.mock.calls.length).toBeGreaterThan(1);

        // The stale signed request never went out again. Any later query is a new request.
        expect(sentBodies.slice(1)).not.toContain(sentBodies[0]);
    });
});
