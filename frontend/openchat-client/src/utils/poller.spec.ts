import { vi } from "vitest";
import { Poller } from "./poller";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
    visibility = state;
    document.dispatchEvent(new Event("visibilitychange"));
}

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((res) => (resolve = res));
    return { promise, resolve };
}

describe("Poller", () => {
    beforeAll(() => {
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => visibility,
        });
    });

    beforeEach(() => {
        vi.useFakeTimers();
        visibility = "visible";
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("runs immediately and then on the interval", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const poller = new Poller(fn, 1000, undefined, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);
        poller.stop();
    });

    test("does not run immediately when immediate is false", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const poller = new Poller(fn, 1000, undefined, false);
        await vi.advanceTimersByTimeAsync(999);
        expect(fn).toHaveBeenCalledTimes(0);
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(1);
        poller.stop();
    });

    test("stop prevents further runs", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const poller = new Poller(fn, 1000, undefined, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);
        poller.stop();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test("an unreferenced poller keeps running (the leak shape fixed in openchat.ts)", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const first = new Poller(fn, 1000, undefined, false);
        const second = new Poller(fn, 1000, undefined, false);
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);
        first.stop();
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(3);
        second.stop();
    });

    test("going to the background and back mid-run does not start a second run", async () => {
        const runs: ReturnType<typeof deferred>[] = [];
        let concurrent = 0;
        let maxConcurrent = 0;
        const fn = vi.fn(() => {
            const d = deferred();
            runs.push(d);
            concurrent++;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            return d.promise.finally(() => concurrent--);
        });
        const poller = new Poller(fn, 1000, 60_000, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);

        // the restart would once have computed a first interval of 0 and run again at once
        setVisibility("hidden");
        setVisibility("visible");
        await vi.advanceTimersByTimeAsync(5000);
        expect(fn).toHaveBeenCalledTimes(1);

        // the run in flight schedules the next when it finishes
        runs[0].resolve();
        await vi.advanceTimersByTimeAsync(999);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(2);
        expect(maxConcurrent).toBe(1);
        poller.stop();
    });

    test("a run that finishes in the background waits for the idle interval", async () => {
        const run = deferred();
        const fn = vi.fn(() => (fn.mock.calls.length === 1 ? run.promise : Promise.resolve()));
        const poller = new Poller(fn, 1000, 60_000, true);
        await vi.advanceTimersByTimeAsync(0);

        setVisibility("hidden");
        run.resolve();
        await vi.advanceTimersByTimeAsync(59_999);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(2);
        // the background store keeps its last value between tests
        setVisibility("visible");
        poller.stop();
    });

    test("a job with no idle interval stops in the background, even if it was mid-run", async () => {
        const run = deferred();
        const fn = vi.fn(() => (fn.mock.calls.length === 1 ? run.promise : Promise.resolve()));
        const poller = new Poller(fn, 1000, undefined, true);
        await vi.advanceTimersByTimeAsync(0);

        setVisibility("hidden");
        run.resolve();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(fn).toHaveBeenCalledTimes(1);

        // and picks up again on returning, as soon as it is due
        setVisibility("visible");
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(2);
        poller.stop();
    });

    test("stop during a run prevents the next one", async () => {
        const run = deferred();
        const fn = vi.fn(() => run.promise);
        const poller = new Poller(fn, 1000, undefined, true);
        await vi.advanceTimersByTimeAsync(0);
        poller.stop();
        run.resolve();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
