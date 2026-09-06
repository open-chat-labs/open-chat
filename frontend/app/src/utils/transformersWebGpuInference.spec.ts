import type { InferenceRequest } from "@shared";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
    createTransformersWebGpuEngine,
    deleteTransformersWebGpuAudio,
    deleteTransformersWebGpuModel,
    invalidateTransformersWebGpuReadiness,
    preloadTransformersWebGpuAudio,
    preloadTransformersWebGpuModel,
    refreshTransformersWebGpuRuntimeAssets,
    shouldUseTransformersWebGpuSpike,
    transformersWebGpuArtifactDownloadUrl,
    transformersWebGpuAudioDownloaded,
    transformersWebGpuModelArtifactsDownloaded,
    transformersWebGpuModelArtifactsPresent,
    transformersWebGpuModelDownloaded,
    transformersWebGpuRuntimeAvailability,
    transformersWebGpuRuntimeAvailableOffline,
    transformersWebGpuRuntimeAssetUrl,
    transformersWebGpuClientEnabled,
    type TransformersWebGpuArtifactCache,
    type TransformersWebGpuWorker,
} from "./transformersWebGpuInference";
import {
    PHONE_GEMMA4_E2B_MODEL_ID,
    PHONE_QWEN3_VL_2B_MODEL_ID,
    TRANSFORMERS_GEMMA_ARTIFACTS,
    TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS,
    TRANSFORMERS_GEMMA_CACHE_KEY,
    TRANSFORMERS_QWEN_ARTIFACT_BYTES,
    TRANSFORMERS_QWEN_ARTIFACTS,
    TRANSFORMERS_QWEN_DEVICE_MAP,
    TRANSFORMERS_QWEN_MODEL_ID,
    TRANSFORMERS_QWEN_REVISION,
    TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON,
    TRANSFORMERS_WEBGPU_CACHE_KEY,
    TRANSFORMERS_WEBGPU_PACKAGED_MODEL_ARTIFACTS,
    TRANSFORMERS_WEBGPU_RUNTIME_ASSETS,
    TRANSFORMERS_WEBGPU_WORKER_PATH,
    type TransformersWebGpuFromWorker,
    type TransformersWebGpuToWorker,
} from "./transformersWebGpuProtocol";

function runtimeBytes(asset: (typeof TRANSFORMERS_WEBGPU_RUNTIME_ASSETS)[number]): Uint8Array {
    return asset.kind === "worker"
        ? new Uint8Array(asset.minimumBytes)
        : new Uint8Array(
              readFileSync(
                  resolve(
                      import.meta.dirname,
                      "../../../node_modules/onnxruntime-web/dist",
                      basename(asset.path),
                  ),
              ),
          );
}

function runtimeResponse(
    asset: (typeof TRANSFORMERS_WEBGPU_RUNTIME_ASSETS)[number],
    bytes = runtimeBytes(asset),
): Response {
    const body = bytes.slice().buffer as ArrayBuffer;
    return new Response(body, {
        status: 200,
        headers: {
            "content-length": String(bytes.byteLength),
            "content-type": asset.path.endsWith(".wasm") ? "application/wasm" : "text/javascript",
        },
    });
}

function runtimeCacheResponse(
    asset: (typeof TRANSFORMERS_WEBGPU_RUNTIME_ASSETS)[number],
    bytes = runtimeBytes(asset),
): Response {
    const url = new URL(transformersWebGpuRuntimeAssetUrl(asset));
    const digest = createHash("sha256").update(bytes).digest("hex");
    return new Response(bytes.slice().buffer as ArrayBuffer, {
        status: 200,
        headers: {
            "content-length": String(bytes.byteLength),
            "content-type": asset.path.endsWith(".wasm") ? "application/wasm" : "text/javascript",
            "x-content-sha256": digest,
            "x-openchat-runtime-asset": asset.kind,
            "x-openchat-runtime-version": url.searchParams.get("v") ?? "development",
        },
    });
}

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
    maxTokens: 96,
};

describe("Transformers.js Qwen WebGPU spike", () => {
    it("admits the single-threaded ORT WebGPU runtime without page-level isolation", () => {
        vi.stubGlobal("crossOriginIsolated", false);
        vi.stubGlobal("SharedArrayBuffer", undefined);
        vi.stubGlobal("Worker", class TestWorker {});
        vi.stubGlobal("navigator", { gpu: {} });
        try {
            expect(transformersWebGpuRuntimeAvailability(false)).toEqual({ available: true });
        } finally {
            vi.unstubAllGlobals();
        }
    });

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
            "This device could not provide a WebGPU adapter for the Qwen3-VL 2B runtime. The model remains selected; embeddings, vision, and decoder all require WebGPU. Retry after updating Android System WebView and enabling hardware acceleration.",
        );
    });

    it("uses packaged Adreno graphs and pinned direct Hub sources in an Android APK", () => {
        for (const path of TRANSFORMERS_WEBGPU_PACKAGED_MODEL_ARTIFACTS) {
            expect(
                transformersWebGpuArtifactDownloadUrl(path, {
                    baseUrl: "http://tauri.localhost/chats",
                    packagedAndroid: true,
                }),
            ).toBe(`http://tauri.localhost/assets/transformers-webgpu/qwen3vl2b/${path}`);
        }
        expect(
            transformersWebGpuArtifactDownloadUrl("config.json", {
                baseUrl: "http://tauri.localhost/chats",
                packagedAndroid: true,
            }),
        ).toBe(
            `https://huggingface.co/${TRANSFORMERS_QWEN_MODEL_ID}/resolve/${TRANSFORMERS_QWEN_REVISION}/config.json`,
        );
        expect(
            transformersWebGpuArtifactDownloadUrl("config.json", {
                baseUrl: "https://phone.tailnet.test/chats",
                packagedAndroid: false,
            }),
        ).toBe(
            `https://phone.tailnet.test/hf-model/${TRANSFORMERS_QWEN_MODEL_ID}/resolve/${TRANSFORMERS_QWEN_REVISION}/config.json`,
        );
    });

    it("removes the complete pinned cache by its revisioned key", async () => {
        const remove = vi.fn(async () => true);

        await deleteTransformersWebGpuModel({ delete: remove });

        expect(remove).toHaveBeenCalledWith(TRANSFORMERS_WEBGPU_CACHE_KEY);
    });

    it("production web downloads every declared artifact without a development proxy", () => {
        vi.stubEnv("OC_BUILD_ENV", "production");
        vi.stubEnv("OC_DFX_NETWORK", "ic");
        vi.stubEnv("OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE", "true");
        vi.stubEnv("OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY", "immutable-hub-v1");
        try {
            const baseUrl = "https://oc.app/chat/example";
            for (const [modelId, artifacts] of [
                [PHONE_QWEN3_VL_2B_MODEL_ID, TRANSFORMERS_QWEN_ARTIFACTS],
                [
                    PHONE_GEMMA4_E2B_MODEL_ID,
                    [...TRANSFORMERS_GEMMA_ARTIFACTS, ...TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS],
                ],
            ] as const) {
                for (const artifact of artifacts) {
                    const url = new URL(
                        transformersWebGpuArtifactDownloadUrl(
                            artifact.path,
                            { baseUrl, packagedAndroid: false },
                            modelId,
                        ),
                    );
                    expect(url.pathname).not.toContain("/hf-model/");
                    if (
                        modelId === PHONE_QWEN3_VL_2B_MODEL_ID &&
                        TRANSFORMERS_WEBGPU_PACKAGED_MODEL_ARTIFACTS.some(
                            (path) => path === artifact.path,
                        )
                    ) {
                        expect(url.href).toBe(
                            `https://oc.app/assets/transformers-webgpu/qwen3vl2b/${artifact.path}`,
                        );
                    } else {
                        expect(url.origin).toBe("https://huggingface.co");
                        expect(url.pathname).toMatch(/\/resolve\/[a-f0-9]{40}\//);
                        expect(url.pathname.endsWith(`/${artifact.path}`)).toBe(true);
                    }
                }
            }
        } finally {
            vi.unstubAllEnvs();
        }
    });

    it.each([
        "../config.json",
        "https://example.invalid/weights",
        "onnx/unreviewed.onnx",
        "config.json?revision=main",
        "%2e%2e/config.json",
    ])("refuses a download outside the exact artifact manifest: %s", (path) => {
        expect(() =>
            transformersWebGpuArtifactDownloadUrl(path, { packagedAndroid: true }),
        ).toThrow(/immutable model manifest/);
    });

    it("tracks model caches independently and explicit removal deletes only its target", async () => {
        const baseUrl = globalThis.location.href;
        const cacheEntries = new Map<string, Map<string, Response>>([
            [TRANSFORMERS_WEBGPU_CACHE_KEY, new Map()],
            [TRANSFORMERS_GEMMA_CACHE_KEY, new Map()],
        ]);
        const installMetadata = (
            cacheKey: string,
            modelId: string,
            artifacts: readonly { path: string; bytes: number; sha256: string }[],
        ) => {
            const entries = cacheEntries.get(cacheKey)!;
            for (const artifact of artifacts) {
                entries.set(
                    transformersWebGpuArtifactDownloadUrl(
                        artifact.path,
                        { baseUrl, packagedAndroid: false },
                        modelId,
                    ),
                    new Response(null, {
                        status: 200,
                        headers: {
                            "content-length": String(artifact.bytes),
                            "x-content-sha256": artifact.sha256,
                        },
                    }),
                );
            }
        };
        installMetadata(
            TRANSFORMERS_WEBGPU_CACHE_KEY,
            PHONE_QWEN3_VL_2B_MODEL_ID,
            TRANSFORMERS_QWEN_ARTIFACTS,
        );
        installMetadata(
            TRANSFORMERS_GEMMA_CACHE_KEY,
            PHONE_GEMMA4_E2B_MODEL_ID,
            TRANSFORMERS_GEMMA_ARTIFACTS,
        );
        const storage = {
            open: vi.fn(async (name: string) => {
                const entries = cacheEntries.get(name);
                if (entries === undefined) throw new Error(`unknown cache ${name}`);
                return {
                    match: async (request: RequestInfo | URL) =>
                        entries.get(String(request))?.clone(),
                    put: async () => undefined,
                    delete: async (request: RequestInfo | URL) => entries.delete(String(request)),
                } satisfies TransformersWebGpuArtifactCache;
            }),
            delete: vi.fn(async (name: string) => cacheEntries.delete(name)),
        };

        await expect(
            transformersWebGpuModelArtifactsPresent(PHONE_QWEN3_VL_2B_MODEL_ID, {
                cacheStorage: storage,
                baseUrl,
            }),
        ).resolves.toBe(true);
        await expect(
            transformersWebGpuModelArtifactsPresent(PHONE_GEMMA4_E2B_MODEL_ID, {
                cacheStorage: storage,
                baseUrl,
            }),
        ).resolves.toBe(true);

        await deleteTransformersWebGpuModel(PHONE_QWEN3_VL_2B_MODEL_ID, storage);

        expect(storage.delete).toHaveBeenCalledTimes(1);
        expect(storage.delete).toHaveBeenCalledWith(TRANSFORMERS_WEBGPU_CACHE_KEY);
        expect(cacheEntries.has(TRANSFORMERS_GEMMA_CACHE_KEY)).toBe(true);
    });

    it("installs, verifies, and removes only Gemma's optional audio cache entries", async () => {
        const baseUrl = globalThis.location.href;
        const entries = new Map<string, Response>();
        const modelUrl = (path: string) =>
            transformersWebGpuArtifactDownloadUrl(
                path,
                { baseUrl, packagedAndroid: false },
                PHONE_GEMMA4_E2B_MODEL_ID,
            );
        const cachedArtifact = (artifact: { bytes: number; sha256: string }) =>
            new Response(null, {
                status: 200,
                headers: {
                    "content-length": String(artifact.bytes),
                    "x-content-sha256": artifact.sha256,
                },
            });
        for (const artifact of TRANSFORMERS_GEMMA_ARTIFACTS) {
            entries.set(modelUrl(artifact.path), cachedArtifact(artifact));
        }
        for (const asset of TRANSFORMERS_WEBGPU_RUNTIME_ASSETS) {
            entries.set(
                transformersWebGpuRuntimeAssetUrl(asset, baseUrl),
                runtimeCacheResponse(asset),
            );
        }
        const deleted: string[] = [];
        const cache: TransformersWebGpuArtifactCache = {
            match: vi.fn(async (request) => entries.get(String(request))?.clone()),
            put: vi.fn(async (request, response) => {
                entries.set(
                    String(request),
                    new Response(await response.arrayBuffer(), { headers: response.headers }),
                );
            }),
            delete: vi.fn(async (request) => {
                deleted.push(String(request));
                return entries.delete(String(request));
            }),
        };
        const storage = {
            open: vi.fn(async (name: string) => {
                expect(name).toBe(TRANSFORMERS_GEMMA_CACHE_KEY);
                return cache;
            }),
        };
        const fetcher = vi.fn(async () => {
            throw new Error("the optional-audio cache test must not fetch");
        });
        const options = {
            cacheStorage: storage,
            baseUrl,
            fetcher,
            cacheBodyVerifier: async () => true,
        };

        await expect(
            transformersWebGpuModelDownloaded(PHONE_GEMMA4_E2B_MODEL_ID, options),
        ).resolves.toBe(true);
        await expect(
            transformersWebGpuAudioDownloaded(PHONE_GEMMA4_E2B_MODEL_ID, options),
        ).resolves.toBe(false);

        for (const artifact of TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS) {
            entries.set(modelUrl(artifact.path), cachedArtifact(artifact));
        }
        await expect(
            preloadTransformersWebGpuAudio(PHONE_GEMMA4_E2B_MODEL_ID, options),
        ).resolves.toBeUndefined();
        await expect(
            transformersWebGpuAudioDownloaded(PHONE_GEMMA4_E2B_MODEL_ID, options),
        ).resolves.toBe(true);
        expect(fetcher).not.toHaveBeenCalled();

        await deleteTransformersWebGpuAudio(PHONE_GEMMA4_E2B_MODEL_ID, storage);

        expect(deleted).toEqual(
            TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS.map((artifact) => modelUrl(artifact.path)),
        );
        await expect(
            transformersWebGpuAudioDownloaded(PHONE_GEMMA4_E2B_MODEL_ID, options),
        ).resolves.toBe(false);
        await expect(
            transformersWebGpuModelDownloaded(PHONE_GEMMA4_E2B_MODEL_ID, options),
        ).resolves.toBe(true);
        for (const artifact of TRANSFORMERS_GEMMA_ARTIFACTS) {
            expect(entries.has(modelUrl(artifact.path))).toBe(true);
        }
    });

    it("surfaces optional-audio cache deletion failures", async () => {
        const removalError = new Error("CacheStorage refused the audio deletion");
        const cache: TransformersWebGpuArtifactCache = {
            match: vi.fn(async () => undefined),
            put: vi.fn(async () => undefined),
            delete: vi.fn(async () => {
                throw removalError;
            }),
        };
        const storage = {
            open: vi.fn(async (name: string) => {
                expect(name).toBe(TRANSFORMERS_GEMMA_CACHE_KEY);
                return cache;
            }),
        };

        await expect(
            deleteTransformersWebGpuAudio(PHONE_GEMMA4_E2B_MODEL_ID, storage),
        ).rejects.toThrow("CacheStorage refused the audio deletion");
        expect(cache.delete).toHaveBeenCalledTimes(1);
    });

    it("uses the current document's rotated development generation for the worker URL", () => {
        const meta = document.createElement("meta");
        meta.name = "openchat-transformers-webgpu-runtime-version";
        meta.content = "1000.0.123.webgpu.9";
        document.head.append(meta);
        try {
            const worker = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find(
                (asset) => asset.kind === "worker",
            )!;
            const url = new URL(
                transformersWebGpuRuntimeAssetUrl(worker, "https://phone.tailnet.test/"),
            );
            expect(url.searchParams.get("v")).toBe("1000.0.123.webgpu.9");
        } finally {
            meta.remove();
        }
    });

    it("refreshes a rotated APK worker without requesting the already-pinned model weights", async () => {
        const baseUrl = "http://tauri.localhost/";
        const runtimeVersion = "new-apk-build";
        const entries = new Map(
            TRANSFORMERS_QWEN_ARTIFACTS.map((artifact) => [
                `${baseUrl}hf-model/${TRANSFORMERS_QWEN_MODEL_ID}/resolve/${TRANSFORMERS_QWEN_REVISION}/${artifact.path}`,
                new Response(null, {
                    status: 200,
                    headers: {
                        "content-length": String(artifact.bytes),
                        "x-content-sha256": artifact.sha256,
                    },
                }),
            ]),
        );
        const worker = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find((asset) => asset.kind === "worker")!;
        const previousWorkerUrl = transformersWebGpuRuntimeAssetUrl(
            worker,
            baseUrl,
            "previous-apk-build",
        );
        entries.set(previousWorkerUrl, runtimeResponse(worker));
        const cache: TransformersWebGpuArtifactCache = {
            match: vi.fn(async (request) => entries.get(String(request))?.clone()),
            put: vi.fn(async (request, response) => {
                entries.set(
                    String(request),
                    new Response(await response.arrayBuffer(), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                    }),
                );
            }),
            delete: vi.fn(async (request) => entries.delete(String(request))),
            keys: vi.fn(async () => Array.from(entries.keys(), (url) => new Request(url))),
        };
        const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(String(input)).not.toContain("/hf-model/");
            expect(String(input)).not.toContain("huggingface.co");
            const asset = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find(({ path }) =>
                String(input).includes(path),
            );
            if (asset === undefined) throw new Error(`unexpected runtime fetch: ${String(input)}`);
            if (asset.kind === "worker" && init?.cache === "only-if-cached") {
                throw new TypeError("current versioned worker is absent from the HTTP cache");
            }
            return runtimeResponse(asset);
        });
        const cacheBodyVerifier = vi.fn(async () => true);
        const options = {
            cacheStorage: { open: async () => cache },
            baseUrl,
            runtimeVersion,
            packagedAndroid: true,
            fetcher,
            cacheBodyVerifier,
        };

        await expect(transformersWebGpuModelArtifactsDownloaded(options)).resolves.toBe(true);
        expect(cacheBodyVerifier).toHaveBeenCalledTimes(TRANSFORMERS_QWEN_ARTIFACTS.length);
        for (const artifact of TRANSFORMERS_QWEN_ARTIFACTS) {
            expect(cacheBodyVerifier).toHaveBeenCalledWith(
                expect.any(Response),
                artifact.bytes,
                artifact.sha256,
                undefined,
            );
        }
        await expect(transformersWebGpuModelDownloaded(options)).resolves.toBe(false);

        await expect(refreshTransformersWebGpuRuntimeAssets(options)).resolves.toBeUndefined();
        await expect(transformersWebGpuModelDownloaded(options)).resolves.toBe(true);
        expect(fetcher).toHaveBeenCalledTimes(TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.length + 1);
        expect(
            fetcher.mock.calls
                .filter(([input]) => String(input).includes(worker.path))
                .map(([, init]) => init?.cache),
        ).toEqual(["only-if-cached", "reload"]);
        expect(cache.put).toHaveBeenCalledTimes(TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.length);
        expect(cache.delete).toHaveBeenCalledWith(previousWorkerUrl);
        expect(entries.has(previousWorkerUrl)).toBe(false);
        expect(
            entries.has(transformersWebGpuRuntimeAssetUrl(worker, baseUrl, runtimeVersion)),
        ).toBe(true);
    });

    it("finishes Model Manager selection only after the worker and both ORT files are cached", async () => {
        const entries = new Map(
            TRANSFORMERS_QWEN_ARTIFACTS.map((artifact) => [
                `https://phone.tailnet.test/hf-model/${TRANSFORMERS_QWEN_MODEL_ID}/resolve/${TRANSFORMERS_QWEN_REVISION}/${artifact.path}`,
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
            match: vi.fn(async (request) => entries.get(String(request))?.clone()),
            put: vi.fn(async (request, response) => {
                const bytes = await response.arrayBuffer();
                entries.set(
                    String(request),
                    new Response(bytes, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                    }),
                );
            }),
            delete: vi.fn(async (request) => entries.delete(String(request))),
        };
        const storage = { open: vi.fn(async () => cache) };
        const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const asset = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find(({ path }) =>
                String(input).includes(path),
            );
            if (asset === undefined) throw new Error(`unexpected fetch: ${String(input)}`);
            expect(init?.cache).toBe("only-if-cached");
            return runtimeResponse(asset);
        });
        const progress: { received: number; total: number }[] = [];
        const trustPrepopulatedModelBodies = vi.fn(async () => true);

        await expect(
            preloadTransformersWebGpuModel({
                cacheStorage: storage,
                baseUrl: "https://phone.tailnet.test/",
                fetcher,
                runtimeVersion: "runtime-test",
                cacheBodyVerifier: trustPrepopulatedModelBodies,
                onProgress: (received, total) => progress.push({ received, total }),
            }),
        ).resolves.toBeUndefined();
        await expect(
            transformersWebGpuModelDownloaded({
                cacheStorage: storage,
                baseUrl: "https://phone.tailnet.test/",
                runtimeVersion: "runtime-test",
                cacheBodyVerifier: trustPrepopulatedModelBodies,
            }),
        ).resolves.toBe(true);
        expect(storage.open).toHaveBeenCalledWith(TRANSFORMERS_WEBGPU_CACHE_KEY);
        expect(fetcher).toHaveBeenCalledTimes(TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.length * 2);
        expect(cache.put).toHaveBeenCalledTimes(TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.length);
        expect(
            fetcher.mock.calls.map(
                ([input]) =>
                    TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find(({ path }) =>
                        String(input).includes(path),
                    )?.path,
            ),
        ).toEqual([
            ...TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.map(({ path }) => path),
            ...TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.map(({ path }) => path),
        ]);
        expect(progress.at(-1)).toEqual({
            received: TRANSFORMERS_QWEN_ARTIFACT_BYTES,
            total: TRANSFORMERS_QWEN_ARTIFACT_BYTES,
        });

        const firstModelUrl = [...entries.keys()].find((url) =>
            url.endsWith(`/${TRANSFORMERS_QWEN_ARTIFACTS[0].path}`),
        );
        expect(firstModelUrl).toBeDefined();
        entries.delete(firstModelUrl!);
        await expect(
            transformersWebGpuModelDownloaded({
                cacheStorage: storage,
                baseUrl: "https://phone.tailnet.test/",
                runtimeVersion: "runtime-test",
                cacheBodyVerifier: trustPrepopulatedModelBodies,
            }),
        ).resolves.toBe(false);
    });

    it("does not complete selection when a downloaded runtime file is absent from the HTTP cache", async () => {
        const entries = new Map(
            TRANSFORMERS_QWEN_ARTIFACTS.map((artifact) => [
                `https://phone.tailnet.test/hf-model/${TRANSFORMERS_QWEN_MODEL_ID}/resolve/${TRANSFORMERS_QWEN_REVISION}/${artifact.path}`,
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
            match: vi.fn(async (request) => entries.get(String(request))?.clone()),
            put: vi.fn(async (request, response) => {
                entries.set(
                    String(request),
                    new Response(await response.arrayBuffer(), { headers: response.headers }),
                );
            }),
            delete: vi.fn(async (request) => entries.delete(String(request))),
        };
        let runtimeFetches = 0;
        const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const asset = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find(({ path }) =>
                String(input).includes(path),
            );
            if (asset === undefined) throw new Error("unexpected model fetch");
            runtimeFetches += 1;
            if (
                runtimeFetches > TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.length &&
                init?.cache === "only-if-cached"
            ) {
                throw new TypeError("HTTP cache miss");
            }
            return runtimeResponse(asset);
        });

        await expect(
            preloadTransformersWebGpuModel({
                cacheStorage: { open: async () => cache },
                baseUrl: "https://phone.tailnet.test/",
                runtimeVersion: "runtime-test",
                fetcher,
                cacheBodyVerifier: async () => true,
            }),
        ).rejects.toThrow("did not retain the all-WebGPU worker and ORT files");
        expect(runtimeFetches).toBe(TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.length + 1);
    });

    it("replaces same-size corrupt cached model bytes within one selection attempt", async () => {
        const target = TRANSFORMERS_QWEN_ARTIFACTS.find(
            ({ path }) => path === "onnx/vision_encoder_q4.onnx",
        )!;
        const replacement = new Uint8Array(
            readFileSync(
                resolve(
                    import.meta.dirname,
                    "../../model-overrides/qwen3vl2b/onnx/vision_encoder_q4.onnx",
                ),
            ),
        );
        expect(replacement.byteLength).toBe(target.bytes);
        expect(createHash("sha256").update(replacement).digest("hex")).toBe(target.sha256);

        const entries = new Map<string, Response>();
        for (const artifact of TRANSFORMERS_QWEN_ARTIFACTS) {
            const url = `https://phone.tailnet.test/hf-model/${TRANSFORMERS_QWEN_MODEL_ID}/resolve/${TRANSFORMERS_QWEN_REVISION}/${artifact.path}`;
            entries.set(
                url,
                new Response(
                    artifact.path === target.path ? new Uint8Array(artifact.bytes) : null,
                    {
                        status: 200,
                        headers: {
                            "content-length": String(artifact.bytes),
                            "x-content-sha256": artifact.sha256,
                        },
                    },
                ),
            );
        }
        const deleteCached = vi.fn(async (request: RequestInfo | URL) =>
            entries.delete(String(request)),
        );
        const cache: TransformersWebGpuArtifactCache = {
            match: vi.fn(async (request) => entries.get(String(request))?.clone()),
            put: vi.fn(async (request, response) => {
                entries.set(
                    String(request),
                    new Response(await response.arrayBuffer(), { headers: response.headers }),
                );
            }),
            delete: deleteCached,
        };
        let modelFetches = 0;
        const fetcher = vi.fn(async (input: RequestInfo | URL) => {
            if (String(input).endsWith(`/${target.path}`)) {
                modelFetches += 1;
                return new Response(replacement.slice().buffer as ArrayBuffer, {
                    status: 200,
                    headers: { "content-length": String(replacement.byteLength) },
                });
            }
            const runtime = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find(({ path }) =>
                String(input).includes(path),
            );
            if (runtime === undefined) throw new Error(`unexpected fetch: ${String(input)}`);
            return runtimeResponse(runtime);
        });
        const verifyCachedBody = async (
            response: Response,
            bytes: number,
            sha256: string,
        ): Promise<boolean> => {
            if (bytes !== target.bytes || sha256 !== target.sha256) return true;
            const body = new Uint8Array(await response.arrayBuffer());
            return (
                body.byteLength === bytes &&
                createHash("sha256").update(body).digest("hex") === sha256
            );
        };

        await expect(
            preloadTransformersWebGpuModel({
                cacheStorage: { open: async () => cache },
                baseUrl: "https://phone.tailnet.test/",
                runtimeVersion: "runtime-test",
                fetcher,
                cacheBodyVerifier: verifyCachedBody,
            }),
        ).resolves.toBeUndefined();
        await expect(
            transformersWebGpuModelDownloaded({
                cacheStorage: { open: async () => cache },
                baseUrl: "https://phone.tailnet.test/",
                runtimeVersion: "runtime-test",
                cacheBodyVerifier: verifyCachedBody,
            }),
        ).resolves.toBe(true);
        expect(modelFetches).toBe(1);
        expect(
            deleteCached.mock.calls.some(([request]) =>
                String(request).endsWith(`/${target.path}`),
            ),
        ).toBe(true);
    });

    it("rejects and evicts same-size cached model corruption even when metadata claims the pinned digest", async () => {
        const artifact = TRANSFORMERS_QWEN_ARTIFACTS[0];
        const corrupt = new Response(new Uint8Array(artifact.bytes), {
            status: 200,
            headers: {
                "content-length": String(artifact.bytes),
                "x-content-sha256": artifact.sha256,
            },
        });
        const deleteCached = vi.fn(async (_request: RequestInfo | URL) => true);
        const cache: TransformersWebGpuArtifactCache = {
            match: vi.fn(async () => corrupt.clone()),
            put: vi.fn(async () => undefined),
            delete: deleteCached,
        };

        await expect(
            transformersWebGpuModelDownloaded({
                cacheStorage: { open: async () => cache },
                baseUrl: "https://phone.tailnet.test/",
            }),
        ).resolves.toBe(false);

        expect(deleteCached).toHaveBeenCalledOnce();
        expect(String(deleteCached.mock.calls[0][0])).toContain(artifact.path);
    });

    it("stops a large cached-body verification as soon as its owned download is backgrounded", async () => {
        const artifact = TRANSFORMERS_QWEN_ARTIFACTS[0];
        const controller = new AbortController();
        const backgrounded = new Error("backgrounded");
        const cancelled = vi.fn();
        const body = new ReadableStream<Uint8Array>({
            pull(stream) {
                stream.enqueue(new Uint8Array([1]));
                controller.abort(backgrounded);
            },
            cancel: cancelled,
        });
        const cached = new Response(body, {
            status: 200,
            headers: {
                "content-length": String(artifact.bytes),
                "x-content-sha256": artifact.sha256,
            },
        });
        const cache: TransformersWebGpuArtifactCache = {
            match: vi.fn(async () => cached),
            put: vi.fn(async () => undefined),
            delete: vi.fn(async () => true),
        };

        await expect(
            transformersWebGpuModelDownloaded({
                cacheStorage: { open: async () => cache },
                baseUrl: "https://phone.tailnet.test/",
                signal: controller.signal,
            }),
        ).rejects.toBe(backgrounded);
        expect(cancelled).toHaveBeenCalledOnce();
    });

    it("memoizes the per-page offline runtime proof and never permits a network fetch", async () => {
        invalidateTransformersWebGpuReadiness();
        const runtimeCache: TransformersWebGpuArtifactCache = {
            match: vi.fn(async (request) => {
                const asset = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find(({ path }) =>
                    String(request).includes(path),
                );
                return asset === undefined ? undefined : runtimeCacheResponse(asset);
            }),
            put: vi.fn(async () => undefined),
            delete: vi.fn(async () => true),
        };
        const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            expect(init).toMatchObject({
                cache: "only-if-cached",
                mode: "same-origin",
                credentials: "same-origin",
            });
            return runtimeResponse(
                TRANSFORMERS_WEBGPU_RUNTIME_ASSETS[fetcher.mock.calls.length - 1],
            );
        });
        vi.stubGlobal("fetch", fetcher);
        vi.stubGlobal("caches", { open: vi.fn(async () => runtimeCache) });

        try {
            await expect(transformersWebGpuRuntimeAvailableOffline()).resolves.toBe(true);
            await expect(transformersWebGpuRuntimeAvailableOffline()).resolves.toBe(true);
            expect(fetcher).toHaveBeenCalledTimes(TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.length);
            expect(fetcher.mock.calls.every(([, init]) => init?.cache !== "reload")).toBe(true);
        } finally {
            invalidateTransformersWebGpuReadiness();
            vi.unstubAllGlobals();
        }
    });

    it("proves packaged runtime assets from CacheStorage without an HTTP-cache fetch", async () => {
        const runtimeCache: TransformersWebGpuArtifactCache = {
            match: vi.fn(async (request) => {
                const asset = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find(({ path }) =>
                    String(request).includes(path),
                );
                return asset === undefined ? undefined : runtimeCacheResponse(asset);
            }),
            put: vi.fn(async () => undefined),
            delete: vi.fn(async () => true),
        };
        const fetcher = vi.fn(async () => {
            throw new Error("packaged runtime must not need the network cache");
        });

        await expect(
            transformersWebGpuRuntimeAvailableOffline({
                cacheStorage: { open: async () => runtimeCache },
                baseUrl: "http://tauri.localhost/",
                packagedAndroid: true,
                fetcher,
            }),
        ).resolves.toBe(true);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it("rejects a same-size worker HTTP-cache body that differs from the selection-time digest", async () => {
        const worker = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS[0];
        const selectedWorker = runtimeBytes(worker);
        const staleWorker = selectedWorker.slice();
        staleWorker[staleWorker.byteLength - 1] = 1;
        const runtimeCache: TransformersWebGpuArtifactCache = {
            match: vi.fn(async (request) => {
                const asset = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find(({ path }) =>
                    String(request).includes(path),
                );
                return asset === undefined
                    ? undefined
                    : runtimeCacheResponse(
                          asset,
                          asset.kind === "worker" ? selectedWorker : runtimeBytes(asset),
                      );
            }),
            put: vi.fn(async () => undefined),
            delete: vi.fn(async () => true),
        };
        const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(init?.cache).toBe("only-if-cached");
            const asset = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find(({ path }) =>
                String(input).includes(path),
            );
            if (asset === undefined) throw new Error("unexpected runtime URL");
            return runtimeResponse(
                asset,
                asset.kind === "worker" ? staleWorker : runtimeBytes(asset),
            );
        });

        await expect(
            transformersWebGpuRuntimeAvailableOffline({
                cacheStorage: { open: async () => runtimeCache },
                baseUrl: "https://phone.tailnet.test/",
                fetcher,
            }),
        ).resolves.toBe(false);
        expect(fetcher).toHaveBeenCalledOnce();
    });

    it("admits image and text only for the explicit mobile all-WebGPU selection", () => {
        const eligible = {
            enabled: true,
            mobile: true,
            selectedModelId: PHONE_QWEN3_VL_2B_MODEL_ID,
        };
        expect(shouldUseTransformersWebGpuSpike(IMAGE_REQUEST, eligible)).toBe(true);
        expect(shouldUseTransformersWebGpuSpike({ prompt: "text only" }, eligible)).toBe(true);
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

    it("admits mobile browsers and Android WebViews but excludes native iOS", () => {
        const originalUserAgent = navigator.userAgent;
        vi.stubEnv("OC_BUILD_ENV", "development");
        vi.stubEnv("OC_DFX_NETWORK", "local");
        vi.stubEnv("OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE", "true");
        try {
            Object.defineProperty(navigator, "userAgent", {
                configurable: true,
                value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile",
            });
            delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
            expect(transformersWebGpuClientEnabled()).toBe(true);

            (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
            expect(transformersWebGpuClientEnabled()).toBe(false);

            Object.defineProperty(navigator, "userAgent", {
                configurable: true,
                value: "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/150 Mobile",
            });
            expect(transformersWebGpuClientEnabled()).toBe(true);
        } finally {
            delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
            Object.defineProperty(navigator, "userAgent", {
                configurable: true,
                value: originalUserAgent,
            });
            vi.unstubAllEnvs();
        }
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
            maxTokens: 96,
        });
        expect(sent.kind === "infer" && [...new Uint8Array(sent.image!)]).toEqual([1, 2, 3]);
        expect(worker.transfers[0]).toEqual([sent.kind === "infer" ? sent.image : undefined]);
        worker.respond({ kind: "result", requestId: sent.requestId, text: '{"amount":3}' });

        await expect(pending).resolves.toEqual({ kind: "ok", text: '{"amount":3}' });
        expect(factory).toHaveBeenCalledOnce();
        expect(worker.terminate).toHaveBeenCalledOnce();
        await engine.dispose();
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    it("sends text without caller pixels so the worker can author its neutral vision frame", async () => {
        const worker = new FakeWorker();
        const statuses: unknown[] = [];
        const engine = createTransformersWebGpuEngine(() => worker, {
            available: () => ({ available: true }),
            timeoutMs: 10_000,
            publishStatus: (status) => statuses.push(status),
        });

        const pending = engine.infer({ prompt: "verify text only", maxTokens: 32 });
        await vi.waitFor(() => expect(worker.sent).toHaveLength(1));
        const sent = worker.sent[0];
        expect(sent).toMatchObject({
            kind: "infer",
            prompt: "verify text only",
            image: undefined,
        });
        expect(worker.transfers[0]).toEqual([]);
        expect(statuses).toContainEqual({ phase: "loading", stage: "text" });
        worker.respond({ kind: "progress", requestId: sent.requestId, phase: "inference" });
        expect(statuses).toContainEqual({
            phase: "inference",
            stage: "text",
            progress: undefined,
            file: undefined,
        });
        worker.respond({ kind: "result", requestId: sent.requestId, text: "verified" });
        await expect(pending).resolves.toEqual({ kind: "ok", text: "verified" });
    });

    it("decodes Gemma voice bytes once and transfers only exact 16 kHz PCM to the worker", async () => {
        const worker = new FakeWorker();
        const decodeAudio = vi.fn(async () => new Float32Array([0.125, -0.25, 0.5]));
        const encoded = new Uint8Array([9, 8, 7, 6]);
        const engine = createTransformersWebGpuEngine(() => worker, {
            available: () => ({ available: true }),
            timeoutMs: 10_000,
            decodeAudio,
        });

        const pending = engine.infer({
            modelId: PHONE_GEMMA4_E2B_MODEL_ID,
            prompt: "Transcribe this voice message",
            audio: encoded,
            audioMimeType: "audio/webm;codecs=opus",
            maxTokens: 32,
        });
        await vi.waitFor(() => expect(worker.sent).toHaveLength(1));

        expect(decodeAudio).toHaveBeenCalledOnce();
        expect(decodeAudio).toHaveBeenCalledWith(encoded, "audio/webm;codecs=opus");
        const sent = worker.sent[0];
        expect(sent).toMatchObject({
            kind: "infer",
            modelId: PHONE_GEMMA4_E2B_MODEL_ID,
            audioSampleRate: 16_000,
            image: undefined,
        });
        expect("audio" in sent).toBe(false);
        expect(sent.kind === "infer" && [...new Float32Array(sent.audioSamples!)]).toEqual([
            0.125, -0.25, 0.5,
        ]);
        expect(worker.transfers[0]).toEqual([
            sent.kind === "infer" ? sent.audioSamples : undefined,
        ]);

        worker.respond({ kind: "result", requestId: sent.requestId, text: "voice result" });
        await expect(pending).resolves.toEqual({ kind: "ok", text: "voice result" });
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    it("includes audio decoding in the bounded job deadline", async () => {
        vi.useFakeTimers();
        const factory = vi.fn(() => new FakeWorker());
        const engine = createTransformersWebGpuEngine(factory, {
            available: () => ({ available: true }),
            timeoutMs: 20,
            decodeAudio: () => new Promise<Float32Array>(() => undefined),
        });
        const pending = engine.infer({
            modelId: PHONE_GEMMA4_E2B_MODEL_ID,
            prompt: "Transcribe",
            audio: new Uint8Array([1]),
            audioMimeType: "audio/webm",
            maxTokens: 32,
        });

        await vi.advanceTimersByTimeAsync(20);
        await expect(pending).resolves.toEqual({
            kind: "error",
            error: "Voice-message decoding timed out in this browser.",
        });
        expect(factory).not.toHaveBeenCalled();
        await engine.dispose();
        vi.useRealTimers();
    });

    it("waits for worker GPU-retirement acknowledgement after an inference timeout", async () => {
        vi.useFakeTimers();
        const worker = new FakeWorker();
        const engine = createTransformersWebGpuEngine(() => worker, {
            available: () => ({ available: true }),
            timeoutMs: 20,
            shutdownGraceMs: 30,
        });
        const pending = engine.infer(IMAGE_REQUEST);
        await vi.advanceTimersByTimeAsync(0);
        expect(worker.sent[0]).toMatchObject({ kind: "infer" });

        await vi.advanceTimersByTimeAsync(20);
        expect(worker.sent[1]).toMatchObject({
            kind: "dispose",
            requestId: worker.sent[0].requestId,
        });
        expect(worker.terminate).not.toHaveBeenCalled();
        worker.respond({ kind: "disposed", requestId: worker.sent[0].requestId });
        await expect(pending).resolves.toEqual({
            kind: "error",
            error: "The isolated browser image model did not finish in time.",
        });
        expect(worker.terminate).toHaveBeenCalledOnce();
        await engine.dispose();
        vi.useRealTimers();
    });

    it("force-terminates only after the bounded GPU-retirement grace period", async () => {
        vi.useFakeTimers();
        const worker = new FakeWorker();
        const engine = createTransformersWebGpuEngine(() => worker, {
            available: () => ({ available: true }),
            timeoutMs: 20,
            shutdownGraceMs: 30,
        });
        const pending = engine.infer(IMAGE_REQUEST);
        await vi.advanceTimersByTimeAsync(20);
        expect(worker.sent.at(-1)).toMatchObject({ kind: "dispose" });
        expect(worker.terminate).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(29);
        expect(worker.terminate).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toMatchObject({ kind: "error" });
        expect(worker.terminate).toHaveBeenCalledOnce();
        await engine.dispose();
        vi.useRealTimers();
    });

    it("requests orderly GPU retirement when disposed during active inference", async () => {
        const worker = new FakeWorker();
        const engine = createTransformersWebGpuEngine(() => worker, {
            available: () => ({ available: true }),
            timeoutMs: 10_000,
            shutdownGraceMs: 100,
        });
        const pending = engine.infer(IMAGE_REQUEST);
        await vi.waitFor(() => expect(worker.sent).toHaveLength(1));
        const disposing = engine.dispose();
        expect(worker.sent[1]).toMatchObject({
            kind: "dispose",
            requestId: worker.sent[0].requestId,
        });
        expect(worker.terminate).not.toHaveBeenCalled();
        worker.respond({ kind: "disposed", requestId: worker.sent[0].requestId });
        await expect(pending).resolves.toEqual({
            kind: "error",
            error: "image-model worker was disposed",
        });
        await disposing;
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
