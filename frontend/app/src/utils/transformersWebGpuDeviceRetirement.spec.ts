import { describe, expect, it, vi } from "vitest";
import {
    releaseAndRetireWebGpuDevice,
    type RetirableWebGpuDevice,
} from "./transformersWebGpuDeviceRetirement";

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((settle) => {
        resolve = settle;
    });
    return { promise, resolve };
}

describe("releaseAndRetireWebGpuDevice", () => {
    it("drains, releases, destroys, and observes ORT clearing the retired device", async () => {
        const events: string[] = [];
        const loss = deferred<{ reason?: string; message?: string }>();
        let current: RetirableWebGpuDevice | undefined;
        const device: RetirableWebGpuDevice = {
            queue: {
                async onSubmittedWorkDone() {
                    events.push("queue");
                },
            },
            lost: loss.promise,
            destroy() {
                events.push("destroy");
                loss.resolve({ reason: "destroyed" });
            },
        };
        current = device;

        await releaseAndRetireWebGpuDevice(
            device,
            async () => {
                events.push("release");
            },
            {
                stage: "test transition",
                currentDevice: () => current,
                yieldTask: async () => {
                    events.push("yield");
                    current = undefined;
                },
                onPhase: (phase) => events.push(`phase:${phase}`),
            },
        );

        expect(events).toEqual([
            "phase:draining",
            "queue",
            "phase:releasing",
            "release",
            "phase:destroying",
            "destroy",
            "yield",
            "phase:retired",
        ]);
    });

    it("clears only the captured destroyed device when ORT's lost continuation stalls", async () => {
        const loss = deferred<{ reason?: string }>();
        let current: RetirableWebGpuDevice | undefined;
        let tasks = 0;
        const device: RetirableWebGpuDevice = {
            queue: { onSubmittedWorkDone: vi.fn(async () => undefined) },
            lost: loss.promise,
            destroy() {
                loss.resolve({ reason: "destroyed" });
            },
        };
        current = device;

        await releaseAndRetireWebGpuDevice(device, async () => undefined, {
            stage: "test transition",
            currentDevice: () => current,
            clearCurrentDevice: (retired) => {
                expect(retired).toBe(device);
                current = undefined;
            },
            yieldTask: async () => {
                tasks++;
            },
        });

        expect(tasks).toBe(4);
    });

    it("rejects an unexpected driver loss after still releasing the session", async () => {
        const release = vi.fn(async () => undefined);
        const device: RetirableWebGpuDevice = {
            queue: { onSubmittedWorkDone: vi.fn(async () => undefined) },
            lost: Promise.resolve({ reason: "unknown", message: "out of memory" }),
            destroy: vi.fn(),
        };

        await expect(
            releaseAndRetireWebGpuDevice(device, release, { stage: "decoder teardown" }),
        ).rejects.toThrow(
            "The WebGPU device was lost unexpectedly during decoder teardown (unknown): out of memory",
        );
        expect(release).toHaveBeenCalledOnce();
        expect(device.destroy).toHaveBeenCalledOnce();
    });

    it("does not skip cleanup when the queue drain fails", async () => {
        const release = vi.fn(async () => undefined);
        const loss = deferred<{ reason?: string }>();
        const destroy = vi.fn(() => loss.resolve({ reason: "destroyed" }));
        const device: RetirableWebGpuDevice = {
            queue: {
                onSubmittedWorkDone: vi.fn(async () => {
                    throw new Error("queue failed");
                }),
            },
            lost: loss.promise,
            destroy,
        };

        await expect(
            releaseAndRetireWebGpuDevice(device, release, { stage: "decoder teardown" }),
        ).rejects.toThrow("The WebGPU queue could not drain during decoder teardown: queue failed");
        expect(release).toHaveBeenCalledOnce();
        expect(destroy).toHaveBeenCalledOnce();
        expect(destroy.mock.invocationCallOrder[0]).toBeLessThan(
            release.mock.invocationCallOrder[0],
        );
    });

    it("bounds a stalled queue drain and still releases and destroys", async () => {
        const release = vi.fn(async () => undefined);
        const loss = deferred<{ reason?: string }>();
        const device: RetirableWebGpuDevice = {
            queue: { onSubmittedWorkDone: vi.fn(() => new Promise<void>(() => undefined)) },
            lost: loss.promise,
            destroy: vi.fn(() => loss.resolve({ reason: "destroyed" })),
        };

        await expect(
            releaseAndRetireWebGpuDevice(device, release, {
                stage: "decoder teardown",
                timeoutMs: 1,
            }),
        ).rejects.toThrow(
            "The WebGPU queue could not drain during decoder teardown: WebGPU queue drain timed out during decoder teardown",
        );
        expect(release).toHaveBeenCalledOnce();
        expect(device.destroy).toHaveBeenCalledOnce();
    });

    it("bounds a stalled session release and still destroys", async () => {
        const loss = deferred<{ reason?: string }>();
        const device: RetirableWebGpuDevice = {
            queue: { onSubmittedWorkDone: vi.fn(async () => undefined) },
            lost: loss.promise,
            destroy: vi.fn(() => loss.resolve({ reason: "destroyed" })),
        };

        await expect(
            releaseAndRetireWebGpuDevice(device, () => new Promise(() => undefined), {
                stage: "decoder teardown",
                timeoutMs: 1,
            }),
        ).rejects.toThrow(
            "The WebGPU sessions could not release during decoder teardown: WebGPU session release timed out during decoder teardown",
        );
        expect(device.destroy).toHaveBeenCalledOnce();
    });

    it("fails closed when destruction is never acknowledged", async () => {
        const device: RetirableWebGpuDevice = {
            queue: { onSubmittedWorkDone: vi.fn(async () => undefined) },
            lost: new Promise(() => undefined),
            destroy: vi.fn(),
        };

        await expect(
            releaseAndRetireWebGpuDevice(device, async () => undefined, {
                stage: "decoder teardown",
                timeoutMs: 1,
            }),
        ).rejects.toThrow("WebGPU device retirement timed out during decoder teardown");
    });

    it("enforces one overall deadline across stalled phases", async () => {
        vi.useFakeTimers();
        try {
            const device: RetirableWebGpuDevice = {
                queue: { onSubmittedWorkDone: vi.fn(() => new Promise<void>(() => undefined)) },
                lost: new Promise(() => undefined),
                destroy: vi.fn(),
            };
            const retirement = releaseAndRetireWebGpuDevice(
                device,
                () => new Promise(() => undefined),
                { stage: "decoder teardown", timeoutMs: 25 },
            );
            const startedAt = Date.now();
            const rejection = expect(retirement).rejects.toThrow(
                "WebGPU device retirement timed out during decoder teardown",
            );

            await vi.advanceTimersByTimeAsync(25);
            await vi.runAllTimersAsync();
            await rejection;
            // The final zero-budget timer may consume one fake-clock tick, but it must not add
            // either phase's independent timeout after the shared deadline expires.
            expect(Date.now() - startedAt).toBeLessThanOrEqual(26);
        } finally {
            vi.useRealTimers();
        }
    });

    it("bounds a stalled post-loss task while still clearing the exact destroyed device", async () => {
        vi.useFakeTimers();
        try {
            const loss = deferred<{ reason?: string }>();
            let current: RetirableWebGpuDevice | undefined;
            const device: RetirableWebGpuDevice = {
                queue: { onSubmittedWorkDone: vi.fn(async () => undefined) },
                lost: loss.promise,
                destroy: vi.fn(() => loss.resolve({ reason: "destroyed" })),
            };
            current = device;
            const clearCurrentDevice = vi.fn(() => {
                current = undefined;
            });
            const retirement = releaseAndRetireWebGpuDevice(device, async () => undefined, {
                stage: "decoder teardown",
                timeoutMs: 25,
                currentDevice: () => current,
                clearCurrentDevice,
                yieldTask: () => new Promise<void>(() => undefined),
            });
            const startedAt = Date.now();
            const rejection = expect(retirement).rejects.toThrow(
                "The WebGPU cleanup continuation could not finish during decoder teardown: WebGPU cleanup task timed out during decoder teardown",
            );

            await vi.advanceTimersByTimeAsync(25);
            await vi.runAllTimersAsync();
            await rejection;
            expect(Date.now() - startedAt).toBeLessThanOrEqual(26);
            expect(clearCurrentDevice).toHaveBeenCalledOnce();
            expect(current).toBeUndefined();
        } finally {
            vi.useRealTimers();
        }
    });
});
