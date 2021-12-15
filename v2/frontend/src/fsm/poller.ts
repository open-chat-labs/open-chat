import type { Unsubscriber } from "svelte/store";
import { background } from "../stores/background";

export class Poller {
    private timeoutId: number | undefined;
    private unsubscribeBackground: Unsubscriber | undefined;
    private stopped = false;

    constructor(
        private fn: () => Promise<void>,
        private interval: number,
        private idleInterval: number = interval
    ) {
        this.unsubscribeBackground = background.subscribe((hidden) => {
            this.start(hidden);
        });
    }

    private start(hidden: boolean): void {
        const interval = hidden ? this.idleInterval : this.interval;
        if (this.timeoutId !== undefined) {
            window.clearTimeout(this.timeoutId);
        }

        const runInLoop = () => {
            if (this.stopped) return;
            this.timeoutId = window.setTimeout(() => this.fn().finally(runInLoop), interval);
        };

        this.timeoutId = window.setTimeout(runInLoop, interval);
    }

    stop(): void {
        if (this.timeoutId !== undefined) {
            window.clearTimeout(this.timeoutId);
        }
        if (this.unsubscribeBackground) {
            this.unsubscribeBackground();
        }
    }
}
