import { describe, expect, test } from "vitest";
import { afterLoadsInFlight } from "./afterLoadsInFlight";

function deferred(): { promise: Promise<void>; resolve: () => void; reject: () => void } {
    let resolve!: () => void;
    let reject!: () => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = () => rej(new Error("load failed"));
    });
    return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("afterLoadsInFlight", () => {
    test("checks at once when nothing is loading", async () => {
        expect(await afterLoadsInFlight(() => undefined, () => true)).toBe(true);
    });

    test("an update that came in during a load is checked once the load is over (#10584)", async () => {
        const load = deferred();
        let inflight: Promise<void> | undefined = load.promise;
        let settled: boolean | undefined;
        void afterLoadsInFlight(
            () => inflight,
            () => true,
        ).then((check) => (settled = check));

        await flush();
        expect(settled).toBeUndefined();

        inflight = undefined;
        load.resolve();
        await flush();
        expect(settled).toBe(true);
    });

    test("waits for a load that starts as the one it waited for ends", async () => {
        const first = deferred();
        const second = deferred();
        let inflight: Promise<void> | undefined = first.promise;
        let settled: boolean | undefined;
        void afterLoadsInFlight(
            () => inflight,
            () => true,
        ).then((check) => (settled = check));

        inflight = second.promise;
        first.resolve();
        await flush();
        expect(settled).toBeUndefined();

        inflight = undefined;
        second.resolve();
        await flush();
        expect(settled).toBe(true);
    });

    test("a failed load is over too", async () => {
        const load = deferred();
        let inflight: Promise<void> | undefined = load.promise;
        const check = afterLoadsInFlight(
            () => inflight,
            () => true,
        );
        inflight = undefined;
        load.reject();
        expect(await check).toBe(true);
    });

    test("doesn't check once the chat it was for has been left", async () => {
        const load = deferred();
        let inflight: Promise<void> | undefined = load.promise;
        let current = true;
        const check = afterLoadsInFlight(
            () => inflight,
            () => current,
        );
        current = false;
        inflight = undefined;
        load.resolve();
        expect(await check).toBe(false);
    });
});
