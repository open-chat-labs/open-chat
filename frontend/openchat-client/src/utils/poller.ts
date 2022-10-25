import type { Unsubscriber } from "svelte/store";
import { background } from "../stores/background";

export class Poller {
    private timeoutId: number | undefined;
    private unsubscribeBackground: Unsubscriber | undefined;
    private lastExecutionTimestamp: number | undefined;
    private stopped = false;
    // Used to ensure each Poller instance runs exactly one instance of its task
    private runnerId: symbol | undefined;

    constructor(
        private fn: () => Promise<void>,
        private interval: number,
        // If idleInterval is undefined then the job will not run while the app is idle
        private idleInterval?: number,
        private immediate?: boolean // whether to kick off the first iteration immediately
    ) {
        this.unsubscribeBackground = background.subscribe((hidden) => {
            this.start(hidden);
        });
    }

    private start(hidden: boolean): void {
        const runnerId = Symbol();
        this.runnerId = runnerId;

        if (this.timeoutId !== undefined) {
            window.clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }

        const interval = hidden ? this.idleInterval : this.interval;
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
        if (this.unsubscribeBackground) {
            try {
                this.unsubscribeBackground();
                // eslint-disable-next-line no-empty
            } catch (_err) {}
        }
        this.stopped = true;
    }
}
