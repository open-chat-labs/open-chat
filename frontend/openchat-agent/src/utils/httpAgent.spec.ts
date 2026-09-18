import { vi } from "vitest";
import { abortInFlightQueries, createQueryAwareFetch } from "./httpAgent";

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
});
