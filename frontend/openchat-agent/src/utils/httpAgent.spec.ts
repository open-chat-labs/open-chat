import {
    AnonymousIdentity,
    BLS12_381_G2_OID,
    Cbor,
    HttpAgent,
    IC_STATE_ROOT_DOMAIN_SEPARATOR,
    reconstruct,
    wrapDER,
    type HashTree,
} from "@icp-sdk/core/agent";
import { lebEncode } from "@icp-sdk/core/candid";
import { Principal } from "@icp-sdk/core/principal";
import { bls12_381 } from "@noble/curves/bls12-381";
import { utf8ToBytes } from "@noble/hashes/utils";
import { vi } from "vitest";
import {
    abortInFlightQueries,
    createQueryAwareFetch,
    QUERY_EXPIRY_SAFE_AGE_MS,
    ResyncingHttpAgent,
    TIME_RESYNC_MIN_INTERVAL_MS,
} from "./httpAgent";

const CANISTER_ID = Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai");
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

const MINUTE_MS = 60_000;

// Stands in for the replicas behind a boundary node. Like a real one it rejects a request whose
// expiry is not within the 5 minutes (plus 30 seconds of permitted drift) after its own clock,
// which here is the test's clock, and answers a read of the time with a certificate. `staleByMs`
// is how far the time it certifies is behind its clock, as it is on a replica which has fallen
// behind.
function fakeReplica() {
    const secretKey = bls12_381.utils.randomPrivateKey();
    const rootKey = wrapDER(bls12_381.getPublicKeyForShortSignatures(secretKey), BLS12_381_G2_OID);
    const replica = {
        rootKey,
        staleByMs: 0,
        // while true, queries never answer until they are aborted
        hangQueries: false,
        queriesHanging: 0,
        queriesAnswered: 0,
        callsAccepted: 0,
        timeReads: 0,
        fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
            const path = new URL(input.toString()).pathname;
            const { content } = Cbor.decode<{ content: { ingress_expiry: bigint } }>(
                init!.body as Uint8Array,
            );
            const expiryMs = Number(BigInt(content.ingress_expiry) / 1_000_000n);
            const now = Date.now();
            if (expiryMs < now || expiryMs > now + 5.5 * MINUTE_MS) {
                return new Response(
                    `Invalid request expiry: Specified ingress_expiry not within expected range: Minimum allowed expiry: ${now}, Maximum allowed expiry: ${now + 5.5 * MINUTE_MS}, Provided expiry: ${expiryMs}`,
                    { status: 400 },
                );
            }
            if (path.endsWith("/read_state")) {
                replica.timeReads++;
                const tree = [
                    2,
                    utf8ToBytes("time"),
                    [3, lebEncode(BigInt(now - replica.staleByMs) * 1_000_000n)],
                ] as unknown as HashTree;
                const signature = bls12_381.signShortSignature(
                    new Uint8Array([
                        ...IC_STATE_ROOT_DOMAIN_SEPARATOR,
                        ...(await reconstruct(tree)),
                    ]),
                    secretKey,
                );
                const certificate = Cbor.encode({ tree, signature });
                return new Response(Cbor.encode({ certificate }) as Uint8Array<ArrayBuffer>);
            }
            if (path.endsWith("/call")) {
                replica.callsAccepted++;
                return new Response(null, { status: 202 });
            }
            if (replica.hangQueries) {
                replica.queriesHanging++;
                const signal = init!.signal!;
                return new Promise<Response>((_, reject) =>
                    signal.addEventListener("abort", () => reject(signal.reason)),
                );
            }
            replica.queriesAnswered++;
            return new Response(
                Cbor.encode({
                    status: "replied",
                    reply: { arg: new Uint8Array([1]) },
                    signatures: [],
                }) as Uint8Array<ArrayBuffer>,
            );
        }) as typeof fetch,
    };
    return replica;
}

describe("ResyncingHttpAgent", () => {
    // One resync reads the time from three replicas
    const READS_PER_SYNC = 3;

    let replica: ReturnType<typeof fakeReplica>;
    let agent: HttpAgent;

    function query() {
        return agent.query(CANISTER_ID, { methodName: "m", arg: new Uint8Array() });
    }

    // Leaves the agent as it is after syncing its clock with a replica which had fallen behind:
    // synced, but with an offset which makes every expiry it sets too early to be accepted
    async function syncWithReplicaWhichIsBehind() {
        replica.staleByMs = 6 * MINUTE_MS;
        await agent.syncTime(CANISTER_ID);
        replica.staleByMs = 0;
        replica.timeReads = 0;
        expect(agent.getTimeDiffMsecs()).toBe(-6 * MINUTE_MS);
    }

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        replica = fakeReplica();
        agent = ResyncingHttpAgent.createSync({
            identity: new AnonymousIdentity(),
            host: "https://icp-api.io",
            verifyQuerySignatures: false,
            rootKey: replica.rootKey,
            fetch: createQueryAwareFetch(replica.fetch),
        });
    });

    afterEach(() => {
        abortInFlightQueries();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    test("a query is answered without syncing the clock when its expiry is accepted", async () => {
        await expect(query()).resolves.toMatchObject({ status: "replied" });
        expect(replica.timeReads).toBe(0);
    });

    test("resyncs the clock and resends a query whose expiry is rejected", async () => {
        await syncWithReplicaWhichIsBehind();

        await expect(query()).resolves.toMatchObject({ status: "replied" });
        expect(agent.getTimeDiffMsecs()).toBe(0);
        expect(replica.timeReads).toBe(READS_PER_SYNC);

        // the clock is right now, so the next query goes straight through
        await expect(query()).resolves.toMatchObject({ status: "replied" });
        expect(replica.timeReads).toBe(READS_PER_SYNC);
    });

    test("resyncs the clock and resubmits an update call whose expiry is rejected", async () => {
        await syncWithReplicaWhichIsBehind();

        const { response } = await agent.call(CANISTER_ID, {
            methodName: "m",
            arg: new Uint8Array(),
            effectiveCanisterId: CANISTER_ID,
        });
        expect(response.status).toBe(202);
        expect(replica.callsAccepted).toBe(1);
        expect(replica.timeReads).toBe(READS_PER_SYNC);
    });

    test("queries rejected together share one resync", async () => {
        await syncWithReplicaWhichIsBehind();

        const results = await Promise.all([query(), query(), query(), query()]);
        expect(results.map((r) => r.status)).toEqual(Array(4).fill("replied"));
        expect(replica.timeReads).toBe(READS_PER_SYNC);
    });

    test("recovers when the device's clock is corrected after the agent synced with it", async () => {
        // the device's clock is 10 minutes slow, which the agent finds out from the replica
        const deviceTime = Date.now();
        replica.staleByMs = -10 * MINUTE_MS;
        await agent.syncTime(CANISTER_ID);
        expect(agent.getTimeDiffMsecs()).toBe(10 * MINUTE_MS);

        // the device's clock is put right, leaving the agent's offset 10 minutes out
        vi.setSystemTime(deviceTime + 10 * MINUTE_MS);
        replica.staleByMs = 0;

        await expect(query()).resolves.toMatchObject({ status: "replied" });
        expect(agent.getTimeDiffMsecs()).toBe(0);
    });

    test("does not resync again until the minimum interval has passed", async () => {
        await syncWithReplicaWhichIsBehind();
        // every resync reads the same stale time, so the clock stays wrong
        replica.staleByMs = 6 * MINUTE_MS;

        await expect(query()).rejects.toThrow("Invalid request expiry");
        expect(replica.timeReads).toBe(READS_PER_SYNC);
        await expect(query()).rejects.toThrow("Invalid request expiry");
        expect(replica.timeReads).toBe(READS_PER_SYNC);

        vi.setSystemTime(Date.now() + TIME_RESYNC_MIN_INTERVAL_MS);
        replica.staleByMs = 0;
        await expect(query()).resolves.toMatchObject({ status: "replied" });
        expect(replica.timeReads).toBe(2 * READS_PER_SYNC);
    });

    test("throws the rejection when the clock cannot be resynced", async () => {
        await syncWithReplicaWhichIsBehind();
        vi.spyOn(agent, "syncTime").mockRejectedValue(new Error("offline"));

        await expect(query()).rejects.toThrow("Invalid request expiry");
        expect(replica.queriesAnswered).toBe(0);
    });

    test("rebuilds a query aborted after it expired without resyncing the clock", async () => {
        // sync the clock, so that the agent hands a rejected expiry back rather than syncing
        await agent.syncTime(CANISTER_ID);
        replica.timeReads = 0;

        replica.hangQueries = true;
        const result = query();
        await vi.waitFor(() => expect(replica.queriesHanging).toBe(1));
        replica.hangQueries = false;

        // the machine slept with the query in flight
        vi.setSystemTime(Date.now() + 10 * MINUTE_MS);
        expect(abortInFlightQueries()).toBe(1);

        await expect(result).resolves.toMatchObject({ status: "replied" });
        expect(replica.queriesAnswered).toBe(1);
        expect(replica.timeReads).toBe(0);
    });
});
