import { get, Unsubscriber } from "svelte/store";
import { background } from "../stores/background";

export class Poller {
    private timeoutId: number | undefined;
    private unsubscribeBackground: Unsubscriber | undefined;
    private lastExecutionTimestamp: number | undefined;
    private stopped = false;
    // Used to ensure each Poller instance runs exactly one instance of its task
    private runnerId: number | undefined;

    constructor(
        private fn: () => Promise<void>,
        private interval: number,
        private idleInterval: number = interval
    ) {
        this.unsubscribeBackground = background.subscribe((hidden) => {
            this.start(hidden, undefined);
        });
    }

    triggerExecution(): void {
        if (!this.stopped) {
            this.start(get(background), 0);
        }
    }

    private start(hidden: boolean, firstIntervalOverride: number | undefined): void {
        const runnerId = Math.random();
        this.runnerId = runnerId;

        if (this.timeoutId !== undefined) {
            window.clearTimeout(this.timeoutId);
        }

        const interval = hidden ? this.idleInterval : this.interval;

        // The first interval after toggling 'hidden' can be shorter so that if the job is now due based on the new
        // interval then it will run immediately.
        const firstInterval = firstIntervalOverride ??
            (this.lastExecutionTimestamp !== undefined
                ? Math.max(0, this.lastExecutionTimestamp + interval - Date.now())
                : interval);

        const runThenLoop = () => {
            if (this.stopped) return;
            this.fn().finally(() => {
                this.lastExecutionTimestamp = Date.now();
                if (this.runnerId === runnerId) {
                    this.timeoutId = window.setTimeout(runThenLoop, interval);
                }
            });
        };

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
