import { vi } from "vitest";
import { Poller, POLLER_RUN_TIMEOUT_MS, POLLER_TRIGGER_MIN_GAP_MS } from "./poller";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
    visibility = state;
    document.dispatchEvent(new Event("visibilitychange"));
}

// Stopped after each test, so a failed assertion cannot leave a poller running into the next
const pollers: Poller[] = [];
function track(poller: Poller): Poller {
    pollers.push(poller);
    return poller;
}

function triggerLatest() {
    pollers[pollers.length - 1].triggerNow();
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
        pollers.splice(0).forEach((p) => p.stop());
        // the background store keeps its last value while it has subscribers
        setVisibility("visible");
        vi.useRealTimers();
    });

    test("runs immediately and then on the interval", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const poller = track(new Poller(fn, 1000, undefined, true));
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);
        poller.stop();
    });

    test("does not run immediately when immediate is false", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const poller = track(new Poller(fn, 1000, undefined, false));
        await vi.advanceTimersByTimeAsync(999);
        expect(fn).toHaveBeenCalledTimes(0);
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(1);
        poller.stop();
    });

    test("stop prevents further runs", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const poller = track(new Poller(fn, 1000, undefined, true));
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);
        poller.stop();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test("an unreferenced poller keeps running (the leak shape fixed in openchat.ts)", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const first = track(new Poller(fn, 1000, undefined, false));
        const second = track(new Poller(fn, 1000, undefined, false));
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
        const poller = track(new Poller(fn, 1000, 60_000, true));
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);

        // the restart used to start a second run while this one was still in flight
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
        const poller = track(new Poller(fn, 1000, 60_000, true));
        await vi.advanceTimersByTimeAsync(0);

        setVisibility("hidden");
        run.resolve();
        await vi.advanceTimersByTimeAsync(59_999);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(2);
        poller.stop();
    });

    test("a job with no idle interval stops in the background, even if it was mid-run", async () => {
        const run = deferred();
        const fn = vi.fn(() => (fn.mock.calls.length === 1 ? run.promise : Promise.resolve()));
        const poller = track(new Poller(fn, 1000, undefined, true));
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
        const poller = track(new Poller(fn, 1000, undefined, true));
        await vi.advanceTimersByTimeAsync(0);
        poller.stop();
        run.resolve();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test("a run that never settles is abandoned after the timeout", async () => {
        const hung = deferred();
        const fn = vi.fn(() => (fn.mock.calls.length === 1 ? hung.promise : Promise.resolve()));
        vi.spyOn(console, "warn").mockImplementation(() => {});
        track(new Poller(fn, 1000, undefined, true));
        await vi.advanceTimersByTimeAsync(0);

        await vi.advanceTimersByTimeAsync(POLLER_RUN_TIMEOUT_MS - 1);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1 + 1000);
        expect(fn).toHaveBeenCalledTimes(2);

        // the abandoned run finishing late schedules nothing of its own
        hung.resolve();
        await vi.advanceTimersByTimeAsync(999);
        expect(fn).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(3);
    });

    test("a task that throws rather than rejecting still schedules the next run", async () => {
        const fn = vi.fn((): Promise<void> => {
            if (fn.mock.calls.length === 1) throw new Error("sync");
            return Promise.resolve();
        });
        vi.spyOn(console, "warn").mockImplementation(() => {});
        track(new Poller(fn, 1000, undefined, true));
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    test("triggerNow runs straight away and the interval restarts from that run", async () => {
        const fn = vi.fn(() => Promise.resolve());
        track(new Poller(fn, 5000, undefined, false));
        await vi.advanceTimersByTimeAsync(400);
        triggerLatest();
        triggerLatest();
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(4999);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    test("triggerNow during a run is followed by one more run, after the minimum gap", async () => {
        const run = deferred();
        const fn = vi.fn(() => (fn.mock.calls.length === 1 ? run.promise : Promise.resolve()));
        track(new Poller(fn, 5000, undefined, true));
        await vi.advanceTimersByTimeAsync(0);

        triggerLatest();
        triggerLatest();
        await vi.advanceTimersByTimeAsync(500);
        expect(fn).toHaveBeenCalledTimes(1);

        run.resolve();
        await vi.advanceTimersByTimeAsync(POLLER_TRIGGER_MIN_GAP_MS - 1);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(4999);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    test("a burst of triggers never runs closer together than the minimum gap", async () => {
        const fn = vi.fn(() => Promise.resolve());
        track(new Poller(fn, 5000, undefined, true));
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);

        for (let i = 0; i < 10; i++) {
            triggerLatest();
            await vi.advanceTimersByTimeAsync(100);
        }
        // 1000ms elapsed: exactly one triggered run, at the gap
        expect(fn).toHaveBeenCalledTimes(2);
    });

    test("triggerNow never delays a run that is already due sooner", async () => {
        const fn = vi.fn(() => Promise.resolve());
        track(new Poller(fn, 300, undefined, true));
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(100);
        triggerLatest();
        await vi.advanceTimersByTimeAsync(199);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    test("triggerNow does nothing in the background, offline or once stopped", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const poller = track(new Poller(fn, 5000, 60_000, false));
        setVisibility("hidden");
        poller.triggerNow();
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(0);
        setVisibility("visible");

        window.dispatchEvent(new Event("offline"));
        poller.triggerNow();
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(0);
        window.dispatchEvent(new Event("online"));

        poller.stop();
        poller.triggerNow();
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(0);
    });

    test("a trigger during a run that ends in the background is dropped", async () => {
        const run = deferred();
        const fn = vi.fn(() => (fn.mock.calls.length === 1 ? run.promise : Promise.resolve()));
        track(new Poller(fn, 5000, undefined, true));
        await vi.advanceTimersByTimeAsync(0);

        triggerLatest();
        setVisibility("hidden");
        run.resolve();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(fn).toHaveBeenCalledTimes(1);

        // back in the foreground: the overdue run, then the normal interval with no extra run
        setVisibility("visible");
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(4999);
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
