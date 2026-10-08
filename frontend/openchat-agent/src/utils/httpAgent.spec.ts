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

// Stands in for the replicas behind a boundary node. It rejects a query or call whose expiry is
// not within the 5 minutes (plus 30 seconds of permitted drift) after its own clock, and answers
// a read of the time with a certificate. A real replica only checks the expiry of a query when
// its sender is not anonymous, but checking them all lets these tests use an anonymous identity.
function fakeReplica() {
    const secretKey = bls12_381.utils.randomPrivateKey();
    const rootKey = wrapDER(bls12_381.getPublicKeyForShortSignatures(secretKey), BLS12_381_G2_OID);
    let heldQuery: { arrive: () => void; released: Promise<void> } | undefined;
    const replica = {
        rootKey,
        // how far its clock is ahead of the device's, which is the test's clock
        aheadByMs: 0,
        // how far the time it certifies is behind its clock, as on a replica which has fallen behind
        staleByMs: 0,
        failTimeReads: false,
        // run once a call has been accepted, before the response to it is sent
        beforeCallResponse: undefined as (() => void) | undefined,
        queriesAnswered: 0,
        callsAccepted: 0,
        timeReads: 0,
        // Makes the next query wait, before the replica looks at it, until `release` is called or
        // the query is aborted. `arrived` resolves once that query has reached the replica.
        holdNextQuery(): { arrived: Promise<void>; release: () => void } {
            let arrive!: () => void;
            let release!: () => void;
            const arrived = new Promise<void>((resolve) => (arrive = resolve));
            const released = new Promise<void>((resolve) => (release = resolve));
            heldQuery = { arrive, released };
            return { arrived, release };
        },
        fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
            const path = new URL(input.toString()).pathname;
            if (path.endsWith("/read_state")) {
                replica.timeReads++;
                if (replica.failTimeReads) {
                    return new Response("unavailable", { status: 503 });
                }
                const certifiedMs = Date.now() + replica.aheadByMs - replica.staleByMs;
                const tree = [
                    2,
                    utf8ToBytes("time"),
                    [3, lebEncode(BigInt(certifiedMs) * 1_000_000n)],
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

            const isQuery = path.endsWith("/query");
            if (isQuery && heldQuery !== undefined) {
                const { arrive, released } = heldQuery;
                heldQuery = undefined;
                arrive();
                const signal = init?.signal;
                await new Promise<void>((resolve, reject) => {
                    void released.then(resolve);
                    signal?.addEventListener("abort", () => reject(signal.reason));
                });
            }

            const { content } = Cbor.decode<{ content: { ingress_expiry: bigint } }>(
                init!.body as Uint8Array,
            );
            const expiryMs = Number(BigInt(content.ingress_expiry) / 1_000_000n);
            const now = Date.now() + replica.aheadByMs;
            if (expiryMs < now || expiryMs > now + 5.5 * MINUTE_MS) {
                return new Response(
                    `Invalid request expiry: Specified ingress_expiry not within expected range: Minimum allowed expiry: ${now}, Maximum allowed expiry: ${now + 5.5 * MINUTE_MS}, Provided expiry: ${expiryMs}`,
                    { status: 400 },
                );
            }
            if (!isQuery) {
                replica.callsAccepted++;
                replica.beforeCallResponse?.();
                return new Response(null, { status: 202 });
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
    // One sync reads the time from three replicas
    const READS_PER_SYNC = 3;

    let replica: ReturnType<typeof fakeReplica>;
    let agent: HttpAgent;
    let warn: ReturnType<typeof vi.spyOn>;

    function query() {
        return agent.query(CANISTER_ID, { methodName: "m", arg: new Uint8Array() });
    }

    function call() {
        return agent.call(CANISTER_ID, {
            methodName: "m",
            arg: new Uint8Array(),
            effectiveCanisterId: CANISTER_ID,
        });
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
        warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
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

    test("resyncs the clock when an update call's expiry is rejected, without resubmitting it", async () => {
        await syncWithReplicaWhichIsBehind();

        await expect(call()).rejects.toThrow("Invalid request expiry");
        expect(replica.callsAccepted).toBe(0);
        expect(agent.getTimeDiffMsecs()).toBe(0);

        // the clock is right now, so the next call is accepted
        expect((await call()).response.status).toBe(202);
        expect(replica.callsAccepted).toBe(1);
        expect(replica.timeReads).toBe(READS_PER_SYNC);
    });

    test("does not submit an update call again when it expires with its response lost", async () => {
        // sync the clock, so that the agent hands a rejected expiry back rather than syncing
        await agent.syncTime(CANISTER_ID);

        // The call is accepted, but the machine sleeps before the response arrives and wakes to a
        // dead connection. The agent sends the call again, by which time it has expired.
        replica.beforeCallResponse = () => {
            replica.beforeCallResponse = undefined;
            vi.setSystemTime(Date.now() + 10 * MINUTE_MS);
            throw new TypeError("Failed to fetch");
        };

        await expect(call()).rejects.toThrow("Invalid request expiry");
        expect(replica.callsAccepted).toBe(1);
    });

    test("queries rejected together share one resync", async () => {
        await syncWithReplicaWhichIsBehind();

        const results = await Promise.all([query(), query(), query(), query()]);
        expect(results.map((r) => r.status)).toEqual(Array(4).fill("replied"));
        expect(replica.timeReads).toBe(READS_PER_SYNC);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    test("resends a query built before a resync and rejected after it, without another", async () => {
        await syncWithReplicaWhichIsBehind();

        // this query is built with the wrong clock, but the replica is slow to reject it
        const { arrived, release } = replica.holdNextQuery();
        const early = query();
        await arrived;

        // meanwhile another query is rejected, and the clock is put right
        await expect(query()).resolves.toMatchObject({ status: "replied" });
        expect(replica.timeReads).toBe(READS_PER_SYNC);

        // long enough later for another resync to be allowed
        vi.setSystemTime(Date.now() + TIME_RESYNC_MIN_INTERVAL_MS);
        release();
        await expect(early).resolves.toMatchObject({ status: "replied" });
        expect(replica.timeReads).toBe(READS_PER_SYNC);
    });

    test("an agent which has never synced its clock still syncs it once and resends", async () => {
        replica.aheadByMs = 10 * MINUTE_MS;

        await expect(query()).resolves.toMatchObject({ status: "replied" });
        expect(agent.getTimeDiffMsecs()).toBe(10 * MINUTE_MS);
        expect(replica.timeReads).toBe(READS_PER_SYNC);
        expect(replica.queriesAnswered).toBe(1);
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

    test("the device's clock being put back does not hold off the next resync", async () => {
        await syncWithReplicaWhichIsBehind();
        await expect(query()).resolves.toMatchObject({ status: "replied" });

        // the device's clock was 6 minutes fast all along, and is now corrected
        vi.setSystemTime(Date.now() - 6 * MINUTE_MS);
        replica.aheadByMs = 6 * MINUTE_MS;

        await expect(query()).resolves.toMatchObject({ status: "replied" });
        expect(agent.getTimeDiffMsecs()).toBe(6 * MINUTE_MS);
    });

    test("throws the rejection when no replica gives the time", async () => {
        await syncWithReplicaWhichIsBehind();
        replica.failTimeReads = true;

        await expect(query()).rejects.toThrow("Invalid request expiry");
        expect(replica.timeReads).toBe(READS_PER_SYNC);
        expect(replica.queriesAnswered).toBe(0);
    });

    test("rebuilds a query aborted after it expired without resyncing the clock", async () => {
        // sync the clock, so that the agent hands a rejected expiry back rather than syncing
        await agent.syncTime(CANISTER_ID);
        replica.timeReads = 0;

        const { arrived } = replica.holdNextQuery();
        const result = query();
        await arrived;

        // the machine slept with the query in flight
        vi.setSystemTime(Date.now() + 10 * MINUTE_MS);
        expect(abortInFlightQueries()).toBe(1);

        await expect(result).resolves.toMatchObject({ status: "replied" });
        expect(replica.queriesAnswered).toBe(1);
        expect(replica.timeReads).toBe(0);
    });
});
