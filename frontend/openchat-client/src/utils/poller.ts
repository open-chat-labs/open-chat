import { derived, type Unsubscriber } from "svelte/store";
import { background } from "../stores/background";
import { offlineStore } from "../stores/network";

type PollerEnvironment = {
    background: boolean;
    offline: boolean;
};

export class Poller {
    private timeoutId: number | undefined;
    private lastExecutionTimestamp: number | undefined;
    private stopped = false;
    // Used to ensure each Poller instance runs exactly one instance of its task
    private runnerId: symbol | undefined;
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

    private start(): void {
        const runnerId = Symbol();
        this.runnerId = runnerId;

        if (this.timeoutId !== undefined) {
            window.clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }

        // if we are offline, bail out
        if (this.status.offline) return;

        const interval = this.status.background ? this.idleInterval : this.interval;
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

        const runThenLoop = () => {
            if (this.stopped || this.runnerId !== runnerId) return;

            this.fn().finally(() => {
                this.lastExecutionTimestamp = Date.now();
                this.timeoutId = window.setTimeout(runThenLoop, interval);
            });
        };

        this.immediate = false;
        this.timeoutId = window.setTimeout(runThenLoop, firstInterval);
    }

    stop(): void {
        if (this.timeoutId !== undefined) {
            window.clearTimeout(this.timeoutId);
        }
        if (this.unsubscribeStatus) {
            try {
                this.unsubscribeStatus();
                // eslint-disable-next-line no-empty
            } catch (_err) {}
        }
        this.stopped = true;
    }
}
