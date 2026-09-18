import { derived, type Unsubscriber } from "svelte/store";
import { background } from "../stores/background";
import { offlineStore } from "../stores/network";

// How long a run may take before the poller stops waiting for it. A run that never settles (a
// lost worker response, say) would otherwise hold the poller forever, since the next run is only
// scheduled when the previous one finishes. The abandoned run is left to finish on its own and
// nothing it does afterwards touches the poller.
export const POLLER_RUN_TIMEOUT_MS = 2 * 60 * 1000;

type PollerEnvironment = {
    background: boolean;
    offline: boolean;
};

export class Poller {
    private timeoutId: number | undefined;
    private lastExecutionTimestamp: number | undefined;
    private stopped = false;
    // At most one run at a time within this poller. A restart (the app going to the background
    // and back, or coming back online) used to start a fresh run straight away even while one
    // was still in flight, because the last execution is only recorded when a run finishes. Two
    // overlapping chat updates passes both start from the same cached state and the one that
    // finishes last wins, even when its answer is the older one. Runs of two different pollers
    // for the same task can still overlap: a caller that replaces its poller while a run is in
    // flight has to handle that itself.
    //
    // The id of the run in flight, so that a run abandoned by the timeout cannot finish again
    private currentRun: number | undefined = undefined;
    private runCount = 0;
    private runTimeoutId: number | undefined;
    private unsubscribeStatus: Unsubscriber | undefined;
    private status: PollerEnvironment = { background: false, offline: false };

    constructor(
        private fn: () => Promise<unknown>,
        private interval: number,
        // If idleInterval is undefined then the job will not run while the app is idle
        private idleInterval?: number,
        private immediate?: boolean, // whether to kick off the first iteration immediately
    ) {
        const statusStore = derived([background, offlineStore], ([$background, $offlineStore]) => ({
            background: $background,
            offline: $offlineStore,
        }));

        // when the poller environment changes, restart
        this.unsubscribeStatus = statusStore.subscribe((status) => {
            this.status = status;
            this.start();
        });
    }

    // The interval for the current environment, or undefined if the job should not run in it
    private currentInterval(): number | undefined {
        if (this.status.offline) return undefined;
        return this.status.background ? this.idleInterval : this.interval;
    }

    private start(): void {
        this.clearTimer();

        // A run in flight schedules the next one when it finishes, using whatever environment
        // is current by then
        if (this.currentRun !== undefined) return;

        const interval = this.currentInterval();
        if (interval === undefined) {
            return;
        }

        // The first interval after toggling 'hidden' can be shorter so that if the job is now due based on the new
        // interval then it will run immediately.
        const firstInterval =
            this.lastExecutionTimestamp !== undefined
                ? Math.max(0, this.lastExecutionTimestamp + interval - Date.now())
                : this.immediate
                  ? 0
                  : interval;

        this.immediate = false;
        this.schedule(firstInterval);
    }

    private schedule(delay: number): void {
        this.clearTimer();
        this.timeoutId = window.setTimeout(() => this.run(), delay);
    }

    private run(): void {
        this.timeoutId = undefined;
        if (this.stopped || this.currentRun !== undefined) return;

        const runId = ++this.runCount;
        this.currentRun = runId;
        this.runTimeoutId = window.setTimeout(() => {
            console.warn(`Poller: task still running after ${POLLER_RUN_TIMEOUT_MS}ms, moving on`);
            this.finish(runId);
        }, POLLER_RUN_TIMEOUT_MS);

        // Called inside the chain so that a task which throws rather than rejecting still
        // finishes the run
        Promise.resolve()
            .then(() => this.fn())
            .catch((err) => console.warn("Poller: task failed", err))
            .finally(() => this.finish(runId));
    }

    private finish(runId: number): void {
        // already finished, by the timeout or by the task itself
        if (this.currentRun !== runId) return;
        this.currentRun = undefined;
        window.clearTimeout(this.runTimeoutId);
        this.runTimeoutId = undefined;
        this.lastExecutionTimestamp = Date.now();
        if (this.stopped) return;
        const interval = this.currentInterval();
        if (interval !== undefined) {
            this.schedule(interval);
        }
    }

    private clearTimer(): void {
        if (this.timeoutId !== undefined) {
            window.clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
    }

    stop(): void {
        this.clearTimer();
        window.clearTimeout(this.runTimeoutId);
        this.runTimeoutId = undefined;
        if (this.unsubscribeStatus) {
            try {
                this.unsubscribeStatus();
                // eslint-disable-next-line no-empty
            } catch (_err) {}
        }
        this.stopped = true;
    }
}
