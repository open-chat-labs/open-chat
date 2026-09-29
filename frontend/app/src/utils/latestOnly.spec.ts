import { describe, expect, it } from "vitest";
import { LatestOnly } from "./latestOnly";

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

// Invariant (#9634): a BTC send form only shows a fee estimate that was requested for the amount
// currently in the form. Both forms route their ckBTC withdrawal-info requests through LatestOnly.
describe("LatestOnly", () => {
    it("drops a response that arrives after a newer request has started", async () => {
        const latest = new LatestOnly();
        const applied: string[] = [];
        const slow = deferred<string>();
        const fast = deferred<string>();

        const first = latest.run(
            () => slow.promise,
            (v) => applied.push(v),
        );
        const second = latest.run(
            () => fast.promise,
            (v) => applied.push(v),
        );
        fast.resolve("estimate for the current amount");
        slow.resolve("estimate for an old amount");
        await Promise.all([first, second]);

        expect(applied).toEqual(["estimate for the current amount"]);
    });

    it("applies each response when requests don't overlap", async () => {
        const latest = new LatestOnly();
        const applied: number[] = [];

        await latest.run(
            () => Promise.resolve(1),
            (v) => applied.push(v),
        );
        await latest.run(
            () => Promise.resolve(2),
            (v) => applied.push(v),
        );

        expect(applied).toEqual([1, 2]);
    });
});
