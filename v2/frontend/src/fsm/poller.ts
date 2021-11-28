import type { Unsubscriber } from "svelte/store";
import { background } from "../stores/background";

export class Poller {
    private intervalId: number | undefined;
    private unsubscribeBackground: Unsubscriber | undefined;

    constructor(
        private fn: () => unknown,
        private interval: number,
        private idleInterval: number = interval
    ) {
        this.unsubscribeBackground = background.subscribe((hidden) => {
            this.start(hidden);
        });
    }

    private start(hidden: boolean): void {
        const interval = hidden ? this.idleInterval : this.interval;
        if (this.intervalId !== undefined) {
            window.clearInterval(this.intervalId);
        }
        this.intervalId = window.setInterval(this.fn, interval);
    }

    stop(): void {
        if (this.intervalId !== undefined) {
            window.clearInterval(this.intervalId);
        }
        if (this.unsubscribeBackground) {
            this.unsubscribeBackground();
        }
    }
}
