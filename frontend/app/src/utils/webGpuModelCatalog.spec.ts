import { afterEach, describe, expect, it, vi } from "vitest";
import defaults from "../../public/model-catalog.json";
import {
    applyWebGpuModelCatalog,
    currentWebGpuModelCatalog,
    currentWebGpuModelSpec,
    parseWebGpuModelCatalog,
    refreshWebGpuModelCatalog,
    subscribeWebGpuModelCatalog,
    webGpuGenerationOptions,
} from "./webGpuModelCatalog";
import {
    createTransformersWebGpuEngine,
    type TransformersWebGpuWorker,
} from "./transformersWebGpuInference";
import type { TransformersWebGpuToWorker } from "./transformersWebGpuProtocol";

function candidate() {
    return structuredClone(defaults);
}
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    applyWebGpuModelCatalog(defaults, false);
    localStorage.clear();
});

describe("configurable all-WebGPU catalog", () => {
    it("applies configured generation values without expanding the caller's output cap", () => {
        const c = candidate();
        Object.assign(c.models[0].generation, {
            maxOutputTokens: 72,
            doSample: true,
            temperature: 0.4,
            topP: 0.8,
            topK: 20,
            repetitionPenalty: 1.2,
        });
        const spec = parseWebGpuModelCatalog(c).models[0];
        expect(webGpuGenerationOptions(spec, 32)).toEqual({
            max_new_tokens: 32,
            do_sample: true,
            temperature: 0.4,
            top_p: 0.8,
            top_k: 20,
            repetition_penalty: 1.2,
        });
        expect(webGpuGenerationOptions(spec, 96).max_new_tokens).toBe(72);
        expect(webGpuGenerationOptions(spec, 1000).max_new_tokens).toBe(72);
        expect(() => webGpuGenerationOptions(spec, 0)).toThrow();
    });
    it("preserves the bundled exact manifests, optional audio and generation defaults", () => {
        const parsed = parseWebGpuModelCatalog(defaults);
        expect(parsed.models.map((m) => m.artifacts)).toEqual(
            defaults.models.map((m) => m.artifacts),
        );
        expect(parsed.models[0].optionalAudio).toBeUndefined();
        expect(parsed.models[1].optionalAudio?.artifactBytes).toBe(171518558);
        expect(
            parsed.models.every(
                (m) => !m.generation.doSample && m.generation.maxOutputTokens === 96,
            ),
        ).toBe(true);
        expect(Object.isFrozen(parsed.models[0].generation)).toBe(true);
    });
    it("adds a compatible model, changes generation config and atomically removes built-ins", () => {
        const c = candidate();
        c.models = [c.models[0]];
        Object.assign(c.models[0], {
            id: "custom-qwen",
            repository: "example/custom-qwen",
            revision: "1".repeat(40),
            cacheKey: "openchat-model-custom-qwen",
        });
        c.models[0].generation.maxOutputTokens = 72;
        c.models[0].generation.temperature = 0.3;
        const notify = vi.fn();
        const unsubscribe = subscribeWebGpuModelCatalog(notify);
        applyWebGpuModelCatalog(c);
        expect(currentWebGpuModelCatalog().models.map((m) => m.id)).toEqual(["custom-qwen"]);
        expect(currentWebGpuModelSpec("custom-qwen")?.generation.maxOutputTokens).toBe(72);
        expect(currentWebGpuModelSpec(defaults.models[0].id)?.enabled).toBe(false);
        expect(notify).toHaveBeenCalledTimes(1);
        unsubscribe();
    });
    it("allows an empty catalog without resurrecting defaults or deleting weights", () => {
        const remove = vi.fn();
        vi.stubGlobal("caches", { delete: remove });
        applyWebGpuModelCatalog({ ...defaults, models: [] });
        expect(currentWebGpuModelCatalog().models).toEqual([]);
        expect(currentWebGpuModelSpec(defaults.models[1].id)?.enabled).toBe(false);
        expect(remove).not.toHaveBeenCalled();
    });
    it("allows new artifact identities only in a different cache namespace", () => {
        const c = candidate();
        c.models[0].revision = "2".repeat(40);
        expect(() => applyWebGpuModelCatalog(c)).toThrow("new cacheKey");
        c.models[0].cacheKey = "openchat-model-updated-qwen";
        applyWebGpuModelCatalog(c);
        expect(currentWebGpuModelSpec(c.models[0].id)?.revision).toBe("2".repeat(40));
    });
    it("does not apply or publish an invalid catalog or a storage failure", () => {
        const before = currentWebGpuModelCatalog();
        expect(() => applyWebGpuModelCatalog("{")).toThrow();
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("quota");
        });
        expect(() => applyWebGpuModelCatalog({ ...defaults, models: [] })).toThrow("quota");
        expect(currentWebGpuModelCatalog()).toBe(before);
    });
    it("restores the last validated catalog offline without fetching or restoring removed defaults", async () => {
        applyWebGpuModelCatalog({ ...defaults, version: "offline-empty", models: [] });
        const fetcher = vi.fn();
        vi.stubGlobal("fetch", fetcher);
        vi.resetModules();
        const restored = await import("./webGpuModelCatalog");
        expect(restored.currentWebGpuModelCatalog().version).toBe("offline-empty");
        expect(restored.currentWebGpuModelCatalog().models).toEqual([]);
        expect(restored.currentWebGpuModelSpec(defaults.models[0].id)?.enabled).toBe(false);
        expect(fetcher).not.toHaveBeenCalled();
    });
    it("ignores an invalid persisted snapshot as a whole", async () => {
        localStorage.setItem(
            "openchat_webgpu_catalog_v1",
            JSON.stringify({
                catalog: { ...defaults, version: "bad", models: [] },
                history: [{}],
            }),
        );
        vi.resetModules();
        const restored = await import("./webGpuModelCatalog");
        expect(restored.currentWebGpuModelCatalog().version).toBe(defaults.version);
        expect(restored.currentWebGpuModelCatalog().models).toHaveLength(2);
    });
    it.each([
        ["adapter", "other-runtime"],
        ["revision", "main"],
        ["cacheKey", "openchat-account-data"],
        ["repository", "../escape"],
        ["dtype", "wasm"],
        ["packagedModelBase", "http://evil.test/"],
        ["packagedModelBase", "https://user:secret@example.test/"],
        ["enabled", "yes"],
        ["prompt", "app-specific prompt"],
    ])("rejects unsupported/unsafe %s", (key, value) => {
        const c = candidate();
        Object.assign(c.models[0], { [key]: value });
        expect(() => parseWebGpuModelCatalog(c)).toThrow();
    });
    it.each([
        ["maxOutputTokens", 97],
        ["maxOutputTokens", 0],
        ["doSample", "yes"],
        ["temperature", 0],
        ["topP", 2],
        ["topK", 1.5],
        ["repetitionPenalty", 3],
    ])("rejects unsafe generation %s", (key, value) => {
        const c = candidate();
        Object.assign(c.models[0].generation, { [key]: value });
        expect(() => parseWebGpuModelCatalog(c)).toThrow();
    });
    it("rejects duplicate identities, unsafe paths, and missing shard declarations", () => {
        const c = candidate();
        c.models.push(c.models[0]);
        expect(() => parseWebGpuModelCatalog(c)).toThrow("duplicate");
        const d = candidate();
        d.models[0].artifacts[0].path = "../config.json";
        expect(() => parseWebGpuModelCatalog(d)).toThrow();
        const e = candidate();
        e.models[0].externalData.decoder_model_merged[0].path = "onnx/undeclared.bin";
        expect(() => parseWebGpuModelCatalog(e)).toThrow("missing");
    });
    it("rejects making the optional audio shard a mandatory decoder dependency", () => {
        const c = candidate();
        c.models[1].externalData.decoder_model_merged[0].path =
            "onnx/audio_encoder_q4f16.onnx_data";
        expect(() => parseWebGpuModelCatalog(c)).toThrow("missing");
    });
    it("refreshes a bounded remote catalog and retains it after a failed refresh", async () => {
        const c = { ...defaults, version: "remote-2", models: [] };
        const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(c)));
        vi.stubGlobal("fetch", fetcher);
        await refreshWebGpuModelCatalog("https://catalog.example.test/models.json");
        expect(currentWebGpuModelCatalog().version).toBe("remote-2");
        expect(fetcher.mock.calls[0][1]).toMatchObject({
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
        });
        fetcher.mockResolvedValue(new Response("broken json"));
        await expect(refreshWebGpuModelCatalog()).rejects.toThrow();
        expect(currentWebGpuModelCatalog().version).toBe("remote-2");
    });
    it("rejects oversized streaming input and insecure external catalog URLs", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(" ".repeat(512 * 1024 + 1))));
        await expect(
            refreshWebGpuModelCatalog("https://catalog.example.test/models.json"),
        ).rejects.toThrow("512 KiB");
        await expect(
            refreshWebGpuModelCatalog("http://external.example/models.json"),
        ).rejects.toThrow("HTTPS");
        expect(currentWebGpuModelCatalog().version).toBe(defaults.version);
    });
    it("sends a new catalog model and its exact settings through the real host worker boundary", async () => {
        const c = candidate();
        c.models = [c.models[0]];
        Object.assign(c.models[0], {
            id: "configured-host-model",
            repository: "custom/model",
            cacheKey: "openchat-model-host-test",
        });
        c.models[0].generation.maxOutputTokens = 48;
        applyWebGpuModelCatalog(c, false);
        const sent: TransformersWebGpuToWorker[] = [];
        const worker: TransformersWebGpuWorker = {
            onmessage: null,
            onerror: null,
            terminate: vi.fn(),
            postMessage(message) {
                sent.push(message);
                queueMicrotask(() =>
                    worker.onmessage?.({
                        data:
                            message.kind === "dispose"
                                ? { kind: "disposed", requestId: message.requestId }
                                : { kind: "result", requestId: message.requestId, text: "result" },
                    } as never),
                );
            },
        };
        const engine = createTransformersWebGpuEngine(() => worker, {
            available: () => ({ available: true }),
        });
        const result = await engine.infer({
            modelId: c.models[0].id,
            prompt: "Application-owned prompt",
            maxTokens: 32,
        });
        expect(result.kind).toBe("ok");
        expect(sent[0]).toMatchObject({
            kind: "infer",
            modelId: "configured-host-model",
            prompt: "Application-owned prompt",
            maxTokens: 32,
            modelSpec: {
                repository: "custom/model",
                adapter: "qwen3-vl-2b-staged-v1",
                generation: { maxOutputTokens: 48 },
            },
        });
        await engine.dispose();
    });
    it("blocks disabled models before creating a worker and never substitutes another model", async () => {
        const c = candidate();
        c.models[0].enabled = false;
        applyWebGpuModelCatalog(c, false);
        const factory = vi.fn();
        const engine = createTransformersWebGpuEngine(factory, {
            available: () => ({ available: true }),
        });
        const result = await engine.infer({ modelId: c.models[0].id, prompt: "test" });
        expect(result.kind).toBe("unavailable");
        expect(factory).not.toHaveBeenCalled();
        await engine.dispose();
    });
});
