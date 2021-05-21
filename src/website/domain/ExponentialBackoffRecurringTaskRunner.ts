import { Option } from "./model/common";

export default class ExponentialBackoffRecurringTaskRunner {
    task: () => Promise<boolean>;
    minIntervalMs: number;
    maxIntervalMs: number;
    intervalMultiplier: number;
    waitBeforeFirstRun: boolean;
    timeoutId: Option<NodeJS.Timeout> = null;
    cancel: Option<() => void> = null;
    stopped: boolean = false;

    constructor(task: () => Promise<boolean>, minIntervalMs: number, maxIntervalMs: number, intervalMultiplier: number, waitBeforeFirstRun: boolean) {
        this.task = task;
        this.minIntervalMs = minIntervalMs;
        this.maxIntervalMs = maxIntervalMs;
        this.intervalMultiplier = intervalMultiplier;
        this.waitBeforeFirstRun = waitBeforeFirstRun;
    }

    // When the task returns true the interval will be reset to the minimum
    // Increase factor is the
    public static startNew(task: () => Promise<boolean>, minIntervalMs: number, maxIntervalMs: number, intervalMultiplier: number, waitBeforeFirstRun: boolean) : ExponentialBackoffRecurringTaskRunner {
        if (intervalMultiplier <= 1) {
            throw new Error("'intervalMultiplier' must be > 1");
        }
        const taskRunner = new ExponentialBackoffRecurringTaskRunner(task, minIntervalMs, maxIntervalMs, intervalMultiplier, waitBeforeFirstRun);
        taskRunner.start();
        return taskRunner;
    }

    public start = () => {
        if (this.stopped) {
            return;
        }
        let nextIntervalMs = this.minIntervalMs;
        const runInLoop = () => {
            if (this.stopped) return;
            this.timeoutId = setTimeout(async _ => {
                let reset = false;
                try {
                    reset = await this.task();
                } finally {
                    if (reset) {
                        nextIntervalMs = this.minIntervalMs;
                    } else {
                        nextIntervalMs = Math.min(nextIntervalMs * this.intervalMultiplier, this.maxIntervalMs);
                    }
                }
                runInLoop();
            }, nextIntervalMs);

        }
        if (this.waitBeforeFirstRun) {
            runInLoop();
        } else {
            this.task().finally(runInLoop);
        }
    }

    public stop = () => {
        this.stopped = true;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    }
}
