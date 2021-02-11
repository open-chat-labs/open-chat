import { Option } from "./model/common";

export default class RecurringTaskRunner {
    task: () => Promise<void>;
    intervalMs: number;
    waitBeforeFirstRun: boolean;
    timeoutId: Option<NodeJS.Timeout> = null;
    cancel: Option<() => void> = null;
    stopped: boolean = false;

    constructor(task: () => Promise<void>, intervalMs: number, waitBeforeFirstRun: boolean) {
        this.task = task;
        this.intervalMs = intervalMs;
        this.waitBeforeFirstRun = waitBeforeFirstRun;
    }

    public static startNew(task: () => Promise<void>, intervalMs: number, waitBeforeFirstRun: boolean) : RecurringTaskRunner {
        const taskRunner = new RecurringTaskRunner(task, intervalMs, waitBeforeFirstRun);
        taskRunner.start();
        return taskRunner;
    }

    public start = () => {
        if (this.stopped) {
            return;
        }
        const runInLoop = () => {
            if (this.stopped) return;
            this.timeoutId = setTimeout(_ => this.task().finally(runInLoop), this.intervalMs);
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
