export type RetirableWebGpuDevice = {
    queue: { onSubmittedWorkDone(): Promise<void> };
    lost: Promise<{ reason?: string; message?: string }>;
    destroy(): void;
};

type RetirementPhase = "draining" | "releasing" | "destroying" | "retired";

type RetirementOptions = {
    stage: string;
    timeoutMs?: number;
    currentDevice?: () => RetirableWebGpuDevice | undefined;
    clearCurrentDevice?: (retired: RetirableWebGpuDevice) => void;
    yieldTask?: () => Promise<void>;
    onPhase?: (phase: RetirementPhase) => void;
};

const DEFAULT_TOTAL_RETIREMENT_TIMEOUT_MS = 25_000;
const DEFAULT_QUEUE_DRAIN_TIMEOUT_MS = 10_000;
const DEFAULT_SESSION_RELEASE_TIMEOUT_MS = 5_000;
const DEFAULT_DEVICE_LOSS_TIMEOUT_MS = 10_000;
const DEFAULT_REFERENCE_RETIREMENT_TASKS = 3;

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function waitWithin<T>(
    operation: PromiseLike<T>,
    timeoutMessage: string,
    timeoutMs: number,
): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            Promise.resolve(operation),
            new Promise<never>((_, reject) => {
                timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
            }),
        ]);
    } finally {
        if (timeout !== undefined) clearTimeout(timeout);
    }
}

function remainingPhaseBudget(deadline: number, phaseLimitMs: number): number {
    return Math.max(0, Math.min(phaseLimitMs, deadline - Date.now()));
}

/**
 * Drain one ORT-owned device, release its final sessions, and wait until Chrome and ORT both
 * acknowledge destruction. A resolved session.dispose() is not itself a GPU retirement barrier.
 */
export async function releaseAndRetireWebGpuDevice(
    device: RetirableWebGpuDevice,
    release: () => Promise<unknown>,
    options: RetirementOptions,
): Promise<void> {
    const totalTimeoutMs = options.timeoutMs ?? DEFAULT_TOTAL_RETIREMENT_TIMEOUT_MS;
    const queueDrainTimeoutMs = options.timeoutMs ?? DEFAULT_QUEUE_DRAIN_TIMEOUT_MS;
    const sessionReleaseTimeoutMs = options.timeoutMs ?? DEFAULT_SESSION_RELEASE_TIMEOUT_MS;
    const deviceLossTimeoutMs = options.timeoutMs ?? DEFAULT_DEVICE_LOSS_TIMEOUT_MS;
    const deadline = Date.now() + totalTimeoutMs;
    const yieldTask =
        options.yieldTask ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    const deviceLost = device.lost;
    let drainFailure: unknown;
    let releaseFailure: unknown;
    let destroyFailure: unknown;
    let destroyAttempted = false;

    const destroyDevice = (): void => {
        if (destroyAttempted) return;
        destroyAttempted = true;
        options.onPhase?.("destroying");
        try {
            // ORT normally destroys its default device when the last session is released. Calling
            // destroy again is idempotent and closes the gap when a failed release leaves it alive.
            device.destroy();
        } catch (error) {
            destroyFailure = error;
        }
    };

    options.onPhase?.("draining");
    try {
        const outcome = await waitWithin(
            Promise.race([
                Promise.resolve()
                    .then(() => device.queue.onSubmittedWorkDone())
                    .then(() => ({ kind: "drained" }) as const),
                deviceLost.then((info) => ({ kind: "lost", info }) as const),
            ]),
            `WebGPU queue drain timed out during ${options.stage}.`,
            remainingPhaseBudget(deadline, queueDrainTimeoutMs),
        );
        if (outcome.kind === "lost") {
            const reason = outcome.info.reason ?? "unknown";
            throw new Error(`The WebGPU device was lost before the queue drained (${reason}).`);
        }
    } catch (error) {
        drainFailure = error;
        // An undrained queue is not safe to retain while ORT releases buffers. Retire the device
        // first, then make a bounded release attempt for the remaining CPU/session state.
        destroyDevice();
    }

    options.onPhase?.("releasing");
    try {
        await waitWithin(
            Promise.resolve().then(release),
            `WebGPU session release timed out during ${options.stage}.`,
            remainingPhaseBudget(deadline, sessionReleaseTimeoutMs),
        );
    } catch (error) {
        releaseFailure = error;
    }

    destroyDevice();

    const lost = await waitWithin(
        deviceLost,
        `WebGPU device retirement timed out during ${options.stage}.`,
        remainingPhaseBudget(deadline, deviceLossTimeoutMs),
    );
    if (lost.reason !== "destroyed") {
        const detail = lost.message === undefined || lost.message === "" ? "" : `: ${lost.message}`;
        throw new Error(
            `The WebGPU device was lost unexpectedly during ${options.stage} (${lost.reason ?? "unknown"})${detail}`,
        );
    }
    if (drainFailure !== undefined) {
        throw new Error(
            `The WebGPU queue could not drain during ${options.stage}: ${errorMessage(drainFailure)}`,
        );
    }
    if (releaseFailure !== undefined) {
        throw new Error(
            `The WebGPU sessions could not release during ${options.stage}: ${errorMessage(releaseFailure)}`,
        );
    }
    if (destroyFailure !== undefined) {
        throw new Error(
            `The WebGPU device could not be destroyed during ${options.stage}: ${errorMessage(destroyFailure)}`,
        );
    }

    // ORT clears env.webgpu.device from its device.lost continuation. Let that continuation run
    // before a decoder or a subsequent one-shot worker is allowed to request another device, but
    // keep these task turns inside the same absolute retirement deadline.
    let yieldFailure: unknown;
    const yieldWithinBudget = async (): Promise<boolean> => {
        if (yieldFailure !== undefined) return false;
        try {
            await waitWithin(
                Promise.resolve().then(yieldTask),
                `WebGPU cleanup task timed out during ${options.stage}.`,
                remainingPhaseBudget(deadline, totalTimeoutMs),
            );
            return true;
        } catch (error) {
            yieldFailure = error;
            return false;
        }
    };
    await yieldWithinBudget();
    if (options.currentDevice !== undefined) {
        for (
            let attempt = 1;
            attempt < DEFAULT_REFERENCE_RETIREMENT_TASKS && options.currentDevice() === device;
            attempt++
        ) {
            if (!(await yieldWithinBudget())) break;
        }
        if (options.currentDevice() === device && options.clearCurrentDevice !== undefined) {
            // Pinned ORT publishes this property as configurable specifically so a destroyed
            // device can be removed. Clear only the exact captured object after loss is confirmed,
            // even if the task-turn budget expired before ORT's own continuation ran.
            options.clearCurrentDevice(device);
            await yieldWithinBudget();
        }
        if (options.currentDevice() === device) {
            throw new Error(
                `ONNX Runtime retained a destroyed WebGPU device during ${options.stage}.`,
            );
        }
    }
    if (yieldFailure !== undefined) {
        throw new Error(
            `The WebGPU cleanup continuation could not finish during ${options.stage}: ${errorMessage(yieldFailure)}`,
        );
    }
    options.onPhase?.("retired");
}
