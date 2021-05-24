import { Option } from "./model/common";

export default class ExponentialBackoffRecurringTaskRunner {
    task: () => Promise<boolean>;
    minIntervalMs: number;
    maxIntervalMs: number;
    intervalMultiplier: number;
    timeoutId: Option<NodeJS.Timeout> = null;
    cancel: Option<() => void> = null;
    stopped: boolean = false;

    constructor(task: () => Promise<boolean>, minIntervalMs: number, maxIntervalMs: number, intervalMultiplier: number) {
        this.task = task;
        this.minIntervalMs = minIntervalMs;
        this.maxIntervalMs = maxIntervalMs;
        this.intervalMultiplier = intervalMultiplier;
    }

    // When the task returns true the interval will be reset to the minimum
    public static startNew(task: () => Promise<boolean>, minIntervalMs: number, maxIntervalMs: number, intervalMultiplier: number, options: StartOptions) : ExponentialBackoffRecurringTaskRunner {
        if (intervalMultiplier <= 1) {
            throw new Error("'intervalMultiplier' must be > 1");
        }
        const taskRunner = new ExponentialBackoffRecurringTaskRunner(task, minIntervalMs, maxIntervalMs, intervalMultiplier);
        taskRunner.start(options);
        return taskRunner;
    }

    public start = (options: StartOptions) : Promise<void> => {
        return this.run(options);
    }

    public restart = (options: StartOptions) : Promise<void> => {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        return this.run(options);
    }

    public stop = () => {
        this.stopped = true;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    }

    private run = async (options: StartOptions) : Promise<void> => {
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
        switch (options) {
            case StartOptions.TriggerTaskAndReturn:
                this.task().finally(runInLoop);
                break;

            case StartOptions.WaitBeforeFirstRun:
                runInLoop();
                break;

            case StartOptions.AwaitFirstRun: {
                try {
                    await this.task();
                } finally {
                    runInLoop();
                }
                break;
            }
        }
    }
}

export enum StartOptions {
    TriggerTaskAndReturn,
    WaitBeforeFirstRun,
    AwaitFirstRun
}
