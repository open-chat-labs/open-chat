import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
    adapterWithSerializedWebGpuPipelines,
    installSerializedWebGpuPipelineCompilation,
    serializeWebGpuPipelineCompilation,
    setOrtWebGpuStandardSoftmaxRouting,
} from "./transformersWebGpuPipelineCompilation";

type Deferred = { promise: Promise<void>; resolve: () => void };

function deferred(): Deferred {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

function descriptor(label: string) {
    return {
        label,
        layout: "auto",
        compute: { module: { label: `${label}-module` } },
    };
}

describe("serialized WebGPU pipeline compilation", () => {
    it("runs native pipeline compiles one-at-a-time and continues after rejection", async () => {
        const first = deferred();
        const third = deferred();
        const started: string[] = [];
        let inFlight = 0;
        let maxInFlight = 0;
        const nativeCreate = vi.fn(async (item: ReturnType<typeof descriptor>) => {
            started.push(item.label ?? "");
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            try {
                if (item.label === "first") await first.promise;
                if (item.label === "second") throw new Error("compiler rejected second");
                if (item.label === "third") await third.promise;
                return { label: item.label };
            } finally {
                inFlight--;
            }
        });
        const device = {
            createComputePipelineAsync: nativeCreate,
            createShaderModule: vi.fn((item: { code: string }) => item),
        };
        serializeWebGpuPipelineCompilation(device);
        serializeWebGpuPipelineCompilation(device);

        const firstResult = device.createComputePipelineAsync(descriptor("first"));
        const secondResult = device.createComputePipelineAsync(descriptor("second"));
        const thirdResult = device.createComputePipelineAsync(descriptor("third"));
        await vi.waitFor(() => expect(started).toEqual(["first"]));
        first.resolve();
        await expect(firstResult).resolves.toMatchObject({ label: "first" });
        await expect(secondResult).rejects.toThrow("compiler rejected second");
        await vi.waitFor(() => expect(started).toEqual(["first", "second", "third"]));
        third.resolve();
        await expect(thirdResult).resolves.toMatchObject({ label: "third" });

        expect(nativeCreate).toHaveBeenCalledTimes(3);
        expect(maxInFlight).toBe(1);
    });

    it("keeps independent devices independent and wraps adapter-created devices", async () => {
        const gates = [deferred(), deferred()];
        const started: string[] = [];
        const devices = gates.map((gate, index) => ({
            createComputePipelineAsync: vi.fn(async (_item: ReturnType<typeof descriptor>) => {
                started.push(`device-${index}`);
                await gate.promise;
                return {};
            }),
            createShaderModule: vi.fn((item: { code: string }) => item),
        }));
        let nextDevice = 0;
        const adapter = {
            label: "test-adapter",
            requestDevice: vi.fn(async () => devices[nextDevice++]),
        };
        const wrapped = adapterWithSerializedWebGpuPipelines(adapter);

        expect(adapterWithSerializedWebGpuPipelines(adapter)).toBe(wrapped);
        expect(wrapped.label).toBe("test-adapter");
        const [left, right] = await Promise.all([wrapped.requestDevice(), wrapped.requestDevice()]);
        const leftResult = left.createComputePipelineAsync(descriptor("left"));
        const rightResult = right.createComputePipelineAsync(descriptor("right"));
        await vi.waitFor(() => expect(started).toEqual(["device-0", "device-1"]));
        gates.forEach((gate) => gate.resolve());
        await Promise.all([leftResult, rightResult]);
    });

    it("wraps every adapter requested through the navigator GPU boundary", async () => {
        const nativeCreate = vi.fn(async (item: ReturnType<typeof descriptor>) => ({
            label: item.label,
        }));
        const adapter = {
            requestDevice: vi.fn(async () => ({
                createComputePipelineAsync: nativeCreate,
                createShaderModule: vi.fn((item: { code: string }) => item),
            })),
        };
        const nativeRequestAdapter = vi.fn(async () => adapter);
        const gpu = { label: "test-gpu", requestAdapter: nativeRequestAdapter };

        expect(installSerializedWebGpuPipelineCompilation(gpu)).toBe(gpu);
        expect(installSerializedWebGpuPipelineCompilation(gpu)).toBe(gpu);
        expect(gpu.label).toBe("test-gpu");
        const firstAdapter = await gpu.requestAdapter();
        const secondAdapter = await gpu.requestAdapter();
        expect(firstAdapter).toBe(secondAdapter);
        const device = await firstAdapter.requestDevice();
        await device.createComputePipelineAsync(descriptor("through-jspi-boundary"));

        expect(nativeRequestAdapter).toHaveBeenCalledTimes(2);
        expect(nativeCreate).toHaveBeenCalledOnce();
    });

    it("uses Gemma's smooth-softmax bit only for routing and restores standard WGSL", () => {
        const nativeShader = vi.fn((item: { label?: string; code: string }) => item);
        const device = {
            createComputePipelineAsync: vi.fn(async () => ({})),
            createShaderModule: nativeShader,
        };
        const smoothShader = {
            label: "InPlaceSoftmax",
            code: [
                "var max_value: f32 = 0.0;",
                "sum += exp(-max_value);",
                "output = exp(input - max_value) / sum;",
            ].join("\n"),
        };
        serializeWebGpuPipelineCompilation(device);
        try {
            setOrtWebGpuStandardSoftmaxRouting(true);
            device.createShaderModule(smoothShader);
            const routed = nativeShader.mock.calls[0][0].code;
            expect(routed).toContain("var max_value = f32(-3.4028234663852886e+38f);");
            expect(routed).not.toContain("var max_value: f32 = 0.0;");
            expect(routed).not.toContain("sum += exp(-max_value);");

            expect(() =>
                device.createShaderModule({
                    label: "changed-smooth-softmax",
                    code: "var max_value: f32 = 0.0;",
                }),
            ).toThrow("refusing to run Gemma with altered attention semantics");

            setOrtWebGpuStandardSoftmaxRouting(false);
            device.createShaderModule(smoothShader);
            expect(nativeShader.mock.calls.at(-1)?.[0]).toBe(smoothShader);
        } finally {
            setOrtWebGpuStandardSoftmaxRouting(false);
        }
    });

    it("wires serialization before model loading and strips private stage hooks", () => {
        const appDir = path.resolve(import.meta.dirname, "../..");
        const worker = fs.readFileSync(
            path.join(appDir, "src/workers/transformersWebGpuInference.worker.ts"),
            "utf8",
        );
        const transform = fs.readFileSync(
            path.join(appDir, "transformersWebGpuSequentialSessions.mjs"),
            "utf8",
        );
        expect(worker.indexOf("installSerializedWebGpuPipelineCompilation(gpu)")).toBeLessThan(
            worker.indexOf("gpu.requestAdapter()"),
        );
        expect(worker.indexOf("installSerializedWebGpuPipelineCompilation(gpu)")).toBeLessThan(
            worker.indexOf(".from_pretrained("),
        );
        expect(worker).toContain("openchat_report_staged_session");
        expect(transform).toContain("openchat_report_staged_session: _reportStagedSession");
        expect(transform).toContain('_reportStagedSession?.(name, "compile-start")');
        expect(transform).toContain('_reportStagedSession?.(name, "queue-drained")');
        expect(transform.indexOf("...cleanSessionOptions")).toBeGreaterThan(
            transform.indexOf("openchat_report_staged_session: _reportStagedSession"),
        );
    });
});
