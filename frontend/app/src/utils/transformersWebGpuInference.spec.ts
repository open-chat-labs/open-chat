import type { InferenceRequest } from "@shared";
import { describe, expect, it, vi } from "vitest";
import {
    createTransformersWebGpuEngine,
    preloadTransformersWebGpuModel,
    shouldUseTransformersWebGpuSpike,
    transformersWebGpuModelDownloaded,
    type TransformersWebGpuArtifactCache,
    type TransformersWebGpuWorker,
} from "./transformersWebGpuInference";
import {
    PHONE_QWEN3_VL_2B_MODEL_ID,
    TRANSFORMERS_QWEN_ARTIFACT_BYTES,
    TRANSFORMERS_QWEN_ARTIFACTS,
    TRANSFORMERS_QWEN_DEVICE_MAP,
    TRANSFORMERS_QWEN_MODEL_ID,
    TRANSFORMERS_QWEN_REVISION,
    TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON,
    TRANSFORMERS_WEBGPU_CACHE_KEY,
    TRANSFORMERS_WEBGPU_WORKER_PATH,
    type TransformersWebGpuFromWorker,
    type TransformersWebGpuToWorker,
} from "./transformersWebGpuProtocol";

class FakeWorker implements TransformersWebGpuWorker {
    onmessage: ((event: MessageEvent<TransformersWebGpuFromWorker>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    readonly sent: TransformersWebGpuToWorker[] = [];
    readonly transfers: Transferable[][] = [];
    readonly terminate = vi.fn();

    postMessage(message: TransformersWebGpuToWorker, transfer: Transferable[] = []): void {
        this.sent.push(message);
        this.transfers.push(transfer);
    }

    respond(message: TransformersWebGpuFromWorker): void {
        this.onmessage?.({ data: message } as MessageEvent<TransformersWebGpuFromWorker>);
    }
}

const IMAGE_REQUEST: InferenceRequest = {
    prompt: "Return JSON",
    text: "Receipt note",
    image: new Uint8Array([1, 2, 3]),
    maxTokens: 123,
};

describe("Transformers.js Qwen WebGPU spike", () => {
    it("pins the optimized model revision and audited q4 artifact footprint", () => {
        expect(TRANSFORMERS_QWEN_MODEL_ID).toBe("onnx-community/Qwen3-VL-2B-Instruct-ONNX");
        expect(TRANSFORMERS_QWEN_REVISION).toBe("3e4136ea66ae6e07c110e64fe07da2e029517ab5");
        expect(TRANSFORMERS_QWEN_ARTIFACT_BYTES).toBe(1_534_532_835);
        expect(TRANSFORMERS_QWEN_ARTIFACTS).toHaveLength(13);
        expect(TRANSFORMERS_QWEN_ARTIFACTS).toContainEqual({
            path: "processor_config.json",
            bytes: 1_300,
            sha256: "14932921ca485d458a04dafd8069fbb0a4505622a48208d19ed247115801385b",
        });
        expect(TRANSFORMERS_QWEN_ARTIFACTS.reduce((sum, file) => sum + file.bytes, 0)).toBe(
            TRANSFORMERS_QWEN_ARTIFACT_BYTES,
        );
        expect(TRANSFORMERS_WEBGPU_CACHE_KEY).toContain("adreno-qk-f32-v1");
        expect(TRANSFORMERS_QWEN_DEVICE_MAP).toEqual({
            embed_tokens: "webgpu",
            vision_encoder: "webgpu",
            decoder_model_merged: "webgpu",
        });
        expect(TRANSFORMERS_WEBGPU_WORKER_PATH).toBe("/transformers_webgpu_worker.js");
        expect(TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON).toBe(
            "This browser could not provide a WebGPU adapter for the Qwen3-VL 2B runtime. The model remains selected; embeddings, vision, and decoder all require WebGPU. Retry on an up-to-date, hardware-accelerated Chrome device.",
        );
    });

    it("recognizes and reuses a complete verified Model Manager cache without network access", async () => {
        const responses = new Map(
            TRANSFORMERS_QWEN_ARTIFACTS.map((artifact) => [
                artifact.path,
                new Response(null, {
                    status: 200,
                    headers: {
                        "content-length": String(artifact.bytes),
                        "x-content-sha256": artifact.sha256,
                    },
                }),
            ]),
        );
        const cache: TransformersWebGpuArtifactCache = {
            match: vi.fn(async (request) => {
                const url = String(request);
                const artifact = TRANSFORMERS_QWEN_ARTIFACTS.find(({ path }) =>
                    url.endsWith(`/${path}`),
                );
                return artifact === undefined ? undefined : responses.get(artifact.path);
            }),
            put: vi.fn(async () => undefined),
            delete: vi.fn(async () => true),
        };
        const storage = { open: vi.fn(async () => cache) };
        const fetcher = vi.fn();
        const progress: { received: number; total: number }[] = [];

        await expect(
            preloadTransformersWebGpuModel({
                cacheStorage: storage,
                baseUrl: "https://phone.tailnet.test/",
                fetcher,
                onProgress: (received, total) => progress.push({ received, total }),
            }),
        ).resolves.toBeUndefined();
        await expect(
            transformersWebGpuModelDownloaded({
                cacheStorage: storage,
                baseUrl: "https://phone.tailnet.test/",
            }),
        ).resolves.toBe(true);
        expect(storage.open).toHaveBeenCalledWith(TRANSFORMERS_WEBGPU_CACHE_KEY);
        expect(fetcher).not.toHaveBeenCalled();
        expect(cache.put).not.toHaveBeenCalled();
        expect(progress.at(-1)).toEqual({
            received: TRANSFORMERS_QWEN_ARTIFACT_BYTES,
            total: TRANSFORMERS_QWEN_ARTIFACT_BYTES,
        });

        responses.delete(TRANSFORMERS_QWEN_ARTIFACTS[0].path);
        await expect(
            transformersWebGpuModelDownloaded({
                cacheStorage: storage,
                baseUrl: "https://phone.tailnet.test/",
            }),
        ).resolves.toBe(false);
    });

    it("admits only the explicit mobile image experiment with the matching selection", () => {
        const eligible = {
            enabled: true,
            mobile: true,
            selectedModelId: PHONE_QWEN3_VL_2B_MODEL_ID,
        };
        expect(shouldUseTransformersWebGpuSpike(IMAGE_REQUEST, eligible)).toBe(true);
        expect(shouldUseTransformersWebGpuSpike({ prompt: "text only" }, eligible)).toBe(false);
        expect(
            shouldUseTransformersWebGpuSpike(IMAGE_REQUEST, { ...eligible, enabled: false }),
        ).toBe(false);
        expect(
            shouldUseTransformersWebGpuSpike(IMAGE_REQUEST, { ...eligible, mobile: false }),
        ).toBe(false);
        expect(
            shouldUseTransformersWebGpuSpike(IMAGE_REQUEST, {
                ...eligible,
                selectedModelId: "some-other-model",
            }),
        ).toBe(false);
    });

    it("creates a one-shot worker lazily, transfers an exact image copy, and releases it on success", async () => {
        const worker = new FakeWorker();
        const factory = vi.fn(() => worker);
        const engine = createTransformersWebGpuEngine(factory, {
            available: () => ({ available: true }),
            timeoutMs: 10_000,
        });

        const pending = engine.infer(IMAGE_REQUEST);
        await vi.waitFor(() => expect(worker.sent).toHaveLength(1));
        const sent = worker.sent[0];
        expect(sent).toMatchObject({
            kind: "infer",
            prompt: "Return JSON",
            text: "Receipt note",
            maxTokens: 123,
        });
        expect(sent.kind === "infer" && [...new Uint8Array(sent.image)]).toEqual([1, 2, 3]);
        expect(worker.transfers[0]).toEqual([sent.kind === "infer" ? sent.image : undefined]);
        worker.respond({ kind: "result", requestId: sent.requestId, text: '{"amount":3}' });

        await expect(pending).resolves.toEqual({ kind: "ok", text: '{"amount":3}' });
        expect(factory).toHaveBeenCalledOnce();
        expect(worker.terminate).toHaveBeenCalledOnce();
        await engine.dispose();
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    it("uses a fresh worker after every successful image job", async () => {
        const first = new FakeWorker();
        const second = new FakeWorker();
        const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
        const engine = createTransformersWebGpuEngine(factory, {
            available: () => ({ available: true }),
            timeoutMs: 10_000,
        });

        const one = engine.infer(IMAGE_REQUEST);
        await vi.waitFor(() => expect(first.sent).toHaveLength(1));
        first.respond({
            kind: "result",
            requestId: first.sent[0].requestId,
            text: "first result",
        });
        await expect(one).resolves.toEqual({ kind: "ok", text: "first result" });
        expect(first.terminate).toHaveBeenCalledOnce();

        const two = engine.infer({ ...IMAGE_REQUEST, prompt: "second" });
        await vi.waitFor(() => expect(second.sent).toHaveLength(1));
        second.respond({
            kind: "result",
            requestId: second.sent[0].requestId,
            text: "second result",
        });
        await expect(two).resolves.toEqual({ kind: "ok", text: "second result" });
        expect(factory).toHaveBeenCalledTimes(2);
        expect(second.terminate).toHaveBeenCalledOnce();
        await engine.dispose();
    });

    it("serializes jobs and recovers with a new worker after a runtime error", async () => {
        const first = new FakeWorker();
        const second = new FakeWorker();
        const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
        const engine = createTransformersWebGpuEngine(factory, {
            available: () => ({ available: true }),
            timeoutMs: 10_000,
        });

        const one = engine.infer(IMAGE_REQUEST);
        const two = engine.infer({ ...IMAGE_REQUEST, prompt: "second" });
        await vi.waitFor(() => expect(first.sent).toHaveLength(1));
        expect(first.sent).toHaveLength(1);
        const firstId = first.sent[0].requestId;
        first.respond({ kind: "error", requestId: firstId, error: "GPU device was lost" });
        await expect(one).resolves.toEqual({ kind: "error", error: "GPU device was lost" });
        expect(first.terminate).toHaveBeenCalledOnce();

        await vi.waitFor(() => expect(second.sent).toHaveLength(1));
        const secondId = second.sent[0].requestId;
        second.respond({ kind: "result", requestId: secondId, text: "second result" });
        await expect(two).resolves.toEqual({ kind: "ok", text: "second result" });
        expect(factory).toHaveBeenCalledTimes(2);
        expect(second.terminate).toHaveBeenCalledOnce();
        await engine.dispose();
    });

    it("fails before worker creation when the browser cannot supply the required APIs", async () => {
        const factory = vi.fn();
        const engine = createTransformersWebGpuEngine(factory, {
            available: () => ({
                available: false,
                reason: "This browser could not provide a WebGPU adapter.",
            }),
        });

        await expect(engine.infer(IMAGE_REQUEST)).resolves.toEqual({
            kind: "unavailable",
            reason: "This browser could not provide a WebGPU adapter.",
        });
        expect(factory).not.toHaveBeenCalled();
        await engine.dispose();
    });
});
