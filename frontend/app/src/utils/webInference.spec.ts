import type { ModelFile, ModelModality } from "@shared";
import { webcrypto } from "node:crypto";
import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    resetTransformersWebGpuMaxOutputTokens,
    updateTransformersWebGpuMaxOutputTokens,
} from "../stores/transformersWebGpuSettings";
import {
    allWebGpuCatalogModelSupported,
    browserImageModelFirstReadiness,
    clearWebModel,
    cancelWebModelDownload,
    ensureWebModelRestored,
    refreshWebModelInstallStatus,
    restoreWebModel,
    setWebModelFile,
    useWebModelFromUrl,
    webInfer,
    webModelModalities,
    webModelInstallStatus,
    webModelStatus,
} from "./webInference";

// Pins the id-tracking contract the always-visible browser chooser relies on: webModelStatus carries
// the CATALOG id of the attached model (so the chooser can mark it "Current"), and the id is cleared
// whenever the source is not a catalog entry (disk file) or the model is removed.
//
// And the VISION contract: what reaches wllama for an image, what happens when the attached model has
// no projector, and how a weights+mmproj pair is downloaded and verified.

const LS_URL_MODEL = "openchat_web_model_url";

// ── wllama double ──────────────────────────────────────────────────────────────────────────────
// Records what webInference hands the runtime, and lets each test dictate what the runtime answers.
const wl = vi.hoisted(() => ({
    imageSupported: true,
    completion: "extracted" as string | undefined,
    throwOnInfer: undefined as string | undefined,
    // captured
    loadedSource: undefined as unknown,
    loadParams: undefined as Record<string, unknown> | undefined,
    loadCount: 0,
    lastMessages: undefined as { role: string; content: unknown }[] | undefined,
    modelSource: undefined as { url: string; mmprojUrl?: string } | undefined,
    progressSeen: [] as { loaded: number; total: number }[],
    removed: false,
    omitMetadata: false,
    // the cached files getModelOrDownload resolves to
    cached: [] as { url: string; bytes: Uint8Array }[],
}));

const transformers = vi.hoisted(() => ({
    enabled: false,
    downloaded: false,
    downloadedModelIds: new Set<string>(),
    modelDownloadedImpl: undefined as
        | ((modelId: string, options: { signal?: AbortSignal }) => Promise<boolean>)
        | undefined,
    modelDownloadedCalls: 0,
    modelDownloadedSignals: [] as AbortSignal[],
    artifactsDownloaded: false,
    artifactPresenceImpl: undefined as ((modelId: string) => Promise<boolean>) | undefined,
    audioReady: false,
    audioChecks: 0,
    preloadCalls: 0,
    runtimeRefreshCalls: 0,
    runtimeOfflineChecks: 0,
    runtimeRefreshError: undefined as string | undefined,
    runtimeRefreshGate: undefined as Promise<void> | undefined,
    preloadModelIds: [] as string[],
    disposeCalls: 0,
    deleteCalls: 0,
    deleteModelIds: [] as string[],
    deleteError: undefined as string | undefined,
    requests: [] as { prompt: string; image?: Uint8Array; maxTokens?: number }[],
    preloadSignals: [] as AbortSignal[],
    preloadImpl: undefined as
        | ((options: {
              signal?: AbortSignal;
              onProgress?: (received: number, total: number) => void;
          }) => Promise<void>)
        | undefined,
    statusListener: undefined as
        | ((status: {
              phase: "idle" | "loading" | "downloading" | "inference";
              stage?: "text" | "image";
              progress?: number;
              file?: string;
          }) => void)
        | undefined,
}));

vi.mock("./transformersWebGpuInference", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./transformersWebGpuInference")>();
    const selected = (id: string | undefined) =>
        transformers.enabled && (id === "qwen3-vl-2b-instruct-q4" || id === "gemma-4-e2b-it-q4");
    return {
        ...actual,
        transformersWebGpuSelectionCanHandle: selected,
        transformersWebGpuSpikeCanHandle: (
            _request: { image?: Uint8Array },
            id: string | undefined,
        ) => selected(id),
        transformersWebGpuModelDownloaded: vi.fn(
            async (modelId: string, options: { signal?: AbortSignal } = {}) => {
                transformers.modelDownloadedCalls += 1;
                if (options.signal !== undefined) {
                    transformers.modelDownloadedSignals.push(options.signal);
                }
                if (transformers.modelDownloadedImpl !== undefined) {
                    return transformers.modelDownloadedImpl(modelId, options);
                }
                return (
                    transformers.downloaded &&
                    (transformers.downloadedModelIds.size === 0 ||
                        transformers.downloadedModelIds.has(modelId))
                );
            },
        ),
        transformersWebGpuModelArtifactsDownloaded: vi.fn(
            async () => transformers.artifactsDownloaded,
        ),
        transformersWebGpuModelArtifactsPresent: vi.fn(async (modelId: string) => {
            if (transformers.artifactPresenceImpl !== undefined) {
                return transformers.artifactPresenceImpl(modelId);
            }
            return (
                transformers.artifactsDownloaded &&
                (transformers.downloadedModelIds.size === 0 ||
                    transformers.downloadedModelIds.has(modelId))
            );
        }),
        transformersWebGpuRuntimeAvailableOffline: vi.fn(async () => {
            transformers.runtimeOfflineChecks += 1;
            return transformers.downloaded;
        }),
        transformersWebGpuAudioDownloaded: vi.fn(async () => {
            transformers.audioChecks += 1;
            return transformers.audioReady;
        }),
        transformersWebGpuAudioReady: vi.fn(() => transformers.audioReady),
        preloadTransformersWebGpuModel: vi.fn(
            async (
                _modelId: string,
                options: {
                    signal?: AbortSignal;
                    onProgress?: (received: number, total: number) => void;
                } = {},
            ) => {
                transformers.preloadCalls += 1;
                transformers.preloadModelIds.push(_modelId);
                if (options.signal !== undefined) transformers.preloadSignals.push(options.signal);
                if (transformers.preloadImpl !== undefined) {
                    await transformers.preloadImpl(options);
                    return;
                }
                transformers.downloaded = true;
                transformers.artifactsDownloaded = true;
                transformers.downloadedModelIds.add(_modelId);
                const total = _modelId === "gemma-4-e2b-it-q4" ? 3_229_930_094 : 1_534_532_835;
                options?.onProgress?.(total, total);
            },
        ),
        refreshTransformersWebGpuRuntimeAssets: vi.fn(async () => {
            transformers.runtimeRefreshCalls += 1;
            await transformers.runtimeRefreshGate;
            if (transformers.runtimeRefreshError !== undefined) {
                throw new Error(transformers.runtimeRefreshError);
            }
            transformers.downloaded = true;
        }),
        subscribeTransformersWebGpuStatus: vi.fn((listener) => {
            transformers.statusListener = listener;
            listener({ phase: "idle" });
            return () => {
                if (transformers.statusListener === listener) {
                    transformers.statusListener = undefined;
                }
            };
        }),
        transformersWebGpuInfer: vi.fn(async (request) => {
            transformers.requests.push(request);
            return { kind: "ok", text: "all-webgpu result" };
        }),
        disposeTransformersWebGpuInference: vi.fn(async () => {
            transformers.disposeCalls += 1;
        }),
        deleteTransformersWebGpuModel: vi.fn(async (modelId: string) => {
            transformers.deleteCalls += 1;
            transformers.deleteModelIds.push(modelId);
            if (transformers.deleteError !== undefined) {
                throw new Error(transformers.deleteError);
            }
            transformers.downloadedModelIds.delete(modelId);
        }),
    };
});

vi.mock("@wllama/wllama/esm/index.js", () => {
    class Wllama {
        async loadModel(source: unknown, params?: Record<string, unknown>) {
            wl.loadedSource = source;
            wl.loadParams = params;
            wl.loadCount += 1;
        }
        supportInputModality(modality: string): boolean {
            return modality === "image" ? wl.imageSupported : false;
        }
        async createChatCompletion(opts: { messages: { role: string; content: unknown }[] }) {
            wl.lastMessages = opts.messages;
            if (wl.throwOnInfer !== undefined) throw new Error(wl.throwOnInfer);
            return { choices: [{ message: { content: wl.completion } }] };
        }
        async exit() {}
    }
    class ModelManager {
        async getModelOrDownload(
            source: { url: string; mmprojUrl?: string },
            opts?: { progressCallback?: (p: { loaded: number; total: number }) => void },
        ) {
            wl.modelSource = source;
            const total = wl.cached.reduce((acc, f) => acc + f.bytes.length, 0);
            opts?.progressCallback?.({ loaded: total, total });
            wl.progressSeen.push({ loaded: total, total });
            return {
                files: wl.cached.map((f) =>
                    wl.omitMetadata ? {} : { metadata: { originalURL: f.url } },
                ),
                open: async () =>
                    wl.cached.map((f) => new Blob([f.bytes.slice().buffer as ArrayBuffer])),
                remove: async () => {
                    wl.removed = true;
                },
            };
        }
    }
    return { Wllama, ModelManager };
});

// Two jsdom gaps, not product gaps: it ships no SubtleCrypto, and its Blob has no arrayBuffer()
// (every browser has had it since 2019). Fill both so the REAL verification code runs here.
vi.stubGlobal("crypto", webcrypto);
if (Blob.prototype.arrayBuffer === undefined) {
    Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(this);
        });
    };
}

function file(url: string, sha256: string, bytes: number): ModelFile {
    return { url, sha256, bytes };
}

async function hashOf(bytes: Uint8Array): Promise<string> {
    const digest = await webcrypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function resetWllama() {
    wl.imageSupported = true;
    wl.completion = "extracted";
    wl.throwOnInfer = undefined;
    wl.loadedSource = undefined;
    wl.loadParams = undefined;
    wl.loadCount = 0;
    wl.lastMessages = undefined;
    wl.modelSource = undefined;
    wl.progressSeen = [];
    wl.removed = false;
    wl.omitMetadata = false;
    wl.cached = [];
}

const SAVED_TEXT_BYTES = new Uint8Array([9, 8, 7, 6]);

async function persistCatalogTextModel(
    id = "qwen2.5-0.5b-instruct-q4",
    name = "Qwen2.5 0.5B (instruct)",
): Promise<void> {
    const url = "https://host/models/qwen2.5-0.5b.gguf";
    localStorage.setItem(
        LS_URL_MODEL,
        JSON.stringify({
            id,
            name,
            url,
            files: [file(url, await hashOf(SAVED_TEXT_BYTES), SAVED_TEXT_BYTES.length)],
            sizeBytes: SAVED_TEXT_BYTES.length,
            modalities: ["text"],
        }),
    );
}

describe("webModelStatus id tracking", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
    });

    it("restoreWebModel publishes the saved catalog id so the chooser can mark the current model", async () => {
        await persistCatalogTextModel();
        await restoreWebModel();
        const status = get(webModelStatus);
        expect(status.status).toBe("attached");
        expect(status.name).toBe("Qwen2.5 0.5B (instruct)");
        expect(status.id).toBe("qwen2.5-0.5b-instruct-q4");
    });

    it("attaching a session disk file clears the catalog id (disk files have no catalog row)", async () => {
        await persistCatalogTextModel();
        await restoreWebModel();
        const err = await setWebModelFile(new File([new Uint8Array(8)], "local-model.gguf"));
        expect(err).toBeUndefined();
        const status = get(webModelStatus);
        expect(status.status).toBe("attached");
        expect(status.name).toBe("local-model.gguf");
        expect(status.id).toBeUndefined();
    });

    it("clearWebModel clears the id along with the rest of the state", async () => {
        await persistCatalogTextModel("gemma-3-1b-it-q4", "Gemma 3 1B");
        await restoreWebModel();
        expect(get(webModelStatus).id).toBe("gemma-3-1b-it-q4");
        await clearWebModel();
        const status = get(webModelStatus);
        expect(status.status).toBe("none");
        expect(status.id).toBeUndefined();
        expect(status.name).toBeUndefined();
    });

    it("rejects a legacy URL-only restore that has no integrity manifest", async () => {
        localStorage.setItem(
            LS_URL_MODEL,
            JSON.stringify({
                id: "legacy",
                name: "Legacy",
                url: "https://host/models/legacy.gguf",
            }),
        );
        await restoreWebModel();
        expect(get(webModelStatus).status).toBe("none");
        expect(localStorage.getItem(LS_URL_MODEL)).toBeNull();
    });
});

// ── the vision path ────────────────────────────────────────────────────────────────────────────

const WEIGHTS = new Uint8Array([1, 2, 3, 4]);
const PROJ = new Uint8Array([5, 6, 7]);
const WEIGHTS_URL = "https://host/models/smolvlm.gguf";
const PROJ_URL = "https://host/models/mmproj-smolvlm.gguf";
const PIXELS = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // a PNG magic number, as bytes

/** Attach a catalog vision entry (weights + projector) with its immutable integrity manifest. */
async function attachVisionModel(sha?: { weights: string; proj: string }) {
    const expected = sha ?? {
        weights: await hashOf(WEIGHTS),
        proj: await hashOf(PROJ),
    };
    wl.cached = [
        { url: WEIGHTS_URL, bytes: WEIGHTS },
        { url: PROJ_URL, bytes: PROJ },
    ];
    return useWebModelFromUrl({
        id: "smolvlm-256m-instruct-q8",
        name: "SmolVLM 256M (vision)",
        files: [
            file(WEIGHTS_URL, expected.weights, WEIGHTS.length),
            file(PROJ_URL, expected.proj, PROJ.length),
        ],
        sizeBytes: WEIGHTS.length + PROJ.length,
        modalities: ["text", "image"],
    });
}

describe("webInfer", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
        resetWllama();
    });

    it.each([
        { prompt: "Listen", audio: new Uint8Array([1]) },
        { prompt: "Listen", audioMimeType: "audio/webm" },
    ])(
        "does not silently drop audio when the selected legacy browser runtime cannot handle it",
        async (request) => {
            await attachVisionModel();
            await expect(webInfer(request)).resolves.toEqual({
                kind: "unavailable",
                reason: "The selected browser runtime does not support audio.",
            });
            expect(wl.loadCount).toBe(0);
            expect(wl.lastMessages).toBeUndefined();
        },
    );

    it("a TEXT request still sends a plain string prompt — the vision path changes nothing here", async () => {
        await setWebModelFile(new File([new Uint8Array(8)], "local-model.gguf"));
        const res = await webInfer({ prompt: "extract this", text: "Total: £12" });
        expect(res).toEqual({ kind: "ok", text: "extracted" });
        expect(wl.lastMessages).toEqual([{ role: "user", content: "extract this\n\nTotal: £12" }]);
    });

    it("an IMAGE request sends the raw file bytes as OAI image content, picture before question", async () => {
        // This is the whole feature: it used to return `unavailable` before ever reaching wllama.
        await attachVisionModel();
        const res = await webInfer({ prompt: "read this receipt", image: PIXELS });
        expect(res).toEqual({ kind: "ok", text: "extracted" });

        const content = wl.lastMessages?.[0].content as {
            type: string;
            data?: ArrayBuffer;
            text?: string;
        }[];
        expect(content.map((c) => c.type)).toEqual(["image", "text"]); // VLMs are trained image-first
        expect(new Uint8Array(content[0].data!)).toEqual(PIXELS);
        expect(content[1].text).toBe("read this receipt");
    });

    it("the image ArrayBuffer is exactly the image, not the pooled buffer a view sits in", async () => {
        // A Uint8Array is usually a WINDOW onto a bigger buffer; wllama copies the whole buffer, so
        // passing `.buffer` would ship neighbouring bytes into the model.
        await attachVisionModel();
        const pool = new Uint8Array([9, 9, 0x89, 0x50, 0x4e, 0x47, 9, 9]);
        const view = pool.subarray(2, 6);
        await webInfer({ prompt: "read", image: view });
        const content = wl.lastMessages?.[0].content as { data?: ArrayBuffer }[];
        expect(content[0].data!.byteLength).toBe(4);
        expect(new Uint8Array(content[0].data!)).toEqual(PIXELS);
    });

    it("an image against a model with NO projector is 'unavailable' and names the remedy", async () => {
        // The loaded model is asked, not the catalog — so a mislabelled entry degrades cleanly instead
        // of throwing "Media marker is undefined" from inside wllama.
        wl.imageSupported = false;
        await attachVisionModel();
        const res = await webInfer({ prompt: "read this", image: PIXELS });
        expect(res.kind).toBe("unavailable");
        expect(res.kind === "unavailable" && res.reason).toMatch(/vision model|mmproj/);
        expect(wl.lastMessages).toBeUndefined(); // never reached the model
    });

    it("keeps the projector absent for private verification on legacy Wllama", async () => {
        await attachVisionModel();
        // The projector-free reload requests and verifies only the model weights.
        wl.cached = [{ url: WEIGHTS_URL, bytes: WEIGHTS }];

        await expect(
            webInfer(
                {
                    modelId: "smolvlm-256m-instruct-q8",
                    prompt: "verify bounded OCR text",
                },
                { requireProjectorAbsent: true },
            ),
        ).resolves.toEqual({ kind: "ok", text: "extracted" });
        expect(wl.modelSource).toEqual({ url: WEIGHTS_URL, mmprojUrl: undefined });
        expect(wl.loadCount).toBe(1);
        expect(wl.lastMessages?.[0].content).toBe("verify bounded OCR text");
    });

    it("with no model attached an image is still 'unavailable', exactly as before", async () => {
        const res = await webInfer({ prompt: "read this", image: PIXELS });
        expect(res).toEqual({ kind: "unavailable", reason: "no browser model attached" });
    });
});

// Reported from real use: proposing on a photo died with "Action failed: (ABORT)". The cause was
// llama.cpp's WebGPU backend aborting inside clip_image_batch_encode once a dynamic-resolution VLM
// turned a large photo into too many patches — measured threshold between 1024 and 2048 image
// tokens on Qwen3-VL. Two defects, two fixes, both pinned here.
describe("oversized-image crash", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
        resetWllama();
    });

    it("caps image tokens at load time — the guard that stops the encoder aborting at all", async () => {
        await attachVisionModel();
        await webInfer({ prompt: "hi" });
        // The VALUE is a measured crash threshold, not a preference: 768 passed a 12 MP photo with
        // full accuracy, 2048 aborted. Assert it is set and safely under the observed limit.
        expect(wl.loadParams?.image_max_tokens).toBeDefined();
        expect(wl.loadParams?.image_max_tokens as number).toBeLessThan(2048);
    });

    it("a wasm abort is reported in words a user can act on, not as '(ABORT)'", async () => {
        await attachVisionModel();
        wl.throwOnInfer = "(ABORT) ";
        const res = await webInfer({ prompt: "read this", image: PIXELS });
        expect(res.kind).toBe("error");
        expect(res.kind === "error" && res.error).toMatch(/image/i);
        expect(res.kind === "error" && res.error).not.toMatch(/ABORT/);
    });

    it("a wasm abort DROPS the runtime, so the next inference isn't poisoned too", async () => {
        // An emscripten abort kills the module: every later call on that instance fails as well.
        // Leaving it resident turned one bad image into a dead model for the rest of the session.
        await attachVisionModel();
        await webInfer({ prompt: "hi" });
        expect(wl.loadCount).toBe(1);

        wl.throwOnInfer = "(ABORT) ";
        expect((await webInfer({ prompt: "read", image: PIXELS })).kind).toBe("error");

        wl.throwOnInfer = undefined;
        const after = await webInfer({ prompt: "hi again" });
        expect(after).toEqual({ kind: "ok", text: "extracted" });
        expect(wl.loadCount).toBe(2); // rebuilt, not reused
    });

    it("a non-abort error is passed through untouched", async () => {
        await attachVisionModel();
        wl.throwOnInfer = "kv cache full";
        const res = await webInfer({ prompt: "hi" });
        expect(res).toEqual({ kind: "error", error: "kv cache full" });
    });
});

describe("useWebModelFromUrl with a projector", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
        resetWllama();
    });

    it("downloads weights AND mmproj as one ModelSource, and loads the pair together", async () => {
        expect(await attachVisionModel()).toBeUndefined();
        expect(wl.modelSource).toEqual({ url: WEIGHTS_URL, mmprojUrl: PROJ_URL });
        expect(get(webModelStatus).status).toBe("attached");
        await webInfer({ prompt: "hi" }); // forces the load
        expect((wl.loadedSource as { files: unknown[] }).files.length).toBe(2);
    });

    it("progress covers the PAIR, so the bar doesn't stall at the weights' share", async () => {
        await attachVisionModel();
        expect(wl.progressSeen.at(-1)).toEqual({
            loaded: WEIGHTS.length + PROJ.length,
            total: WEIGHTS.length + PROJ.length,
        });
    });

    it("persists the projector URL so the model re-attaches whole on the next visit", async () => {
        await attachVisionModel();
        const saved = JSON.parse(localStorage.getItem(LS_URL_MODEL)!);
        expect(saved.url).toBe(WEIGHTS_URL);
        expect(saved.mmprojUrl).toBe(PROJ_URL);
        expect(saved.modalities).toEqual(["text", "image"]);
        expect(saved.sizeBytes).toBe(WEIGHTS.length + PROJ.length);
        expect(saved.files).toEqual([
            file(WEIGHTS_URL, await hashOf(WEIGHTS), WEIGHTS.length),
            file(PROJ_URL, await hashOf(PROJ), PROJ.length),
        ]);

        await clearWebModel();
        localStorage.setItem(LS_URL_MODEL, JSON.stringify(saved));
        await restoreWebModel();
        resetWllama();
        wl.cached = [
            { url: WEIGHTS_URL, bytes: WEIGHTS },
            { url: PROJ_URL, bytes: PROJ },
        ];
        await webInfer({ prompt: "hi" });
        expect(wl.modelSource).toEqual({ url: WEIGHTS_URL, mmprojUrl: PROJ_URL });
    });

    it("verifies BOTH files against the catalog SHA-256 and accepts a matching pair", async () => {
        const err = await attachVisionModel({
            weights: await hashOf(WEIGHTS),
            proj: await hashOf(PROJ),
        });
        expect(err).toBeUndefined();
        expect(wl.removed).toBe(false);
        expect(get(webModelStatus).status).toBe("attached");
    });

    it("a corrupt PROJECTOR is caught, discarded and named — not just the weights", async () => {
        const err = await attachVisionModel({
            weights: await hashOf(WEIGHTS),
            proj: "0".repeat(64),
        });
        expect(err).toMatch(/mmproj-smolvlm\.gguf/);
        expect(err).toMatch(/SHA-256/);
        expect(wl.removed).toBe(true); // corrupt bytes don't stay in the cache
        expect(get(webModelStatus).status).toBe("error");
    });

    it("fails closed when a cached file has no source URL metadata", async () => {
        wl.omitMetadata = true;
        const err = await attachVisionModel();
        expect(err).toMatch(/source URL|integrity/i);
        expect(wl.removed).toBe(true);
        expect(get(webModelStatus).status).toBe("error");
    });

    it("fails closed when this browser cannot compute an expected SHA-256", async () => {
        const expected = {
            weights: await hashOf(WEIGHTS),
            proj: await hashOf(PROJ),
        };
        const digest = vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(new Error("oom"));
        const err = await attachVisionModel(expected);
        digest.mockRestore();
        expect(err).toMatch(/could not be SHA-256 verified/i);
        expect(wl.removed).toBe(true);
        expect(get(webModelStatus).status).toBe("error");
    });

    it("re-verifies restored cache bytes against the persisted manifest before loading", async () => {
        await attachVisionModel();
        const saved = localStorage.getItem(LS_URL_MODEL)!;
        await clearWebModel();
        localStorage.setItem(LS_URL_MODEL, saved);
        resetWllama();
        wl.cached = [
            { url: WEIGHTS_URL, bytes: new Uint8Array([4, 3, 2, 1]) },
            { url: PROJ_URL, bytes: PROJ },
        ];
        await restoreWebModel();

        const result = await webInfer({ prompt: "hi" });
        expect(result.kind).toBe("error");
        expect(result.kind === "error" && result.error).toMatch(/SHA-256/);
        expect(wl.removed).toBe(true);
        expect(wl.loadCount).toBe(0);
    });

    it("re-verifies a cache replacement between initial attach and first inference", async () => {
        await attachVisionModel();
        resetWllama();
        wl.cached = [
            { url: WEIGHTS_URL, bytes: new Uint8Array([4, 3, 2, 1]) },
            { url: PROJ_URL, bytes: PROJ },
        ];

        const result = await webInfer({ prompt: "hi" });
        expect(result.kind).toBe("error");
        expect(result.kind === "error" && result.error).toMatch(/SHA-256/);
        expect(wl.removed).toBe(true);
        expect(wl.loadCount).toBe(0);
    });

    it("refuses a layout the browser can't load, before spending a byte of bandwidth", async () => {
        const err = await useWebModelFromUrl({
            id: "sharded",
            name: "Sharded",
            files: [
                file("https://host/m-00001-of-00002.gguf", "0".repeat(64), 10),
                file("https://host/m-00002-of-00002.gguf", "1".repeat(64), 10),
            ],
            sizeBytes: 20,
        });
        expect(err).toMatch(/file layout/);
        expect(wl.modelSource).toBeUndefined();
    });
});

describe("webModelModalities", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
        resetWllama();
    });

    it("reports nothing readable with no model attached", () => {
        expect(webModelModalities()).toEqual(["text"]);
    });

    it("a disk-picked file is text until a load proves otherwise", async () => {
        await setWebModelFile(new File([new Uint8Array(8)], "local-model.gguf"));
        expect(webModelModalities()).toEqual(["text"]);
    });

    it("a downloaded catalog vision entry claims image BEFORE the weights are in memory", async () => {
        // The propose gate runs before any inference, so an attached-but-not-yet-loaded model has to
        // answer from the catalog — otherwise the first propose on an image is always refused.
        await attachVisionModel();
        expect(webModelModalities()).toEqual(["text", "image"]);
    });

    it("the LOADED model overrides the catalog's claim when the catalog is wrong", async () => {
        wl.imageSupported = false;
        await attachVisionModel(); // entry claims ["text","image"]
        expect(webModelModalities()).toEqual(["text", "image"]); // claim, pre-load
        await webInfer({ prompt: "hi" }); // loads, and measures
        expect(webModelModalities()).toEqual(["text"]); // measurement wins
    });

    it("a loaded vision model reports image from the runtime, not the catalog", async () => {
        await attachVisionModel();
        await webInfer({ prompt: "hi" });
        expect(webModelModalities()).toEqual(["text", "image"]);
    });
});

describe("pinned all-WebGPU model integration", () => {
    const weightsUrl = "https://host/models/Qwen3VL-2B-Instruct-Q4_K_M.gguf";
    const projectorUrl = "https://host/models/mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf";
    const entry = {
        id: "qwen3-vl-2b-instruct-q4",
        name: "Qwen3-VL 2B (vision)",
        files: [file(weightsUrl, "1".repeat(64), 4), file(projectorUrl, "2".repeat(64), 3)],
        sizeBytes: 7,
        modalities: ["text", "image"] as ModelModality[],
    };

    beforeEach(async () => {
        transformers.deleteError = undefined;
        transformers.enabled = false;
        await clearWebModel();
        localStorage.clear();
        resetTransformersWebGpuMaxOutputTokens();
        transformers.enabled = true;
        transformers.downloaded = false;
        transformers.downloadedModelIds.clear();
        transformers.modelDownloadedImpl = undefined;
        transformers.modelDownloadedCalls = 0;
        transformers.modelDownloadedSignals = [];
        transformers.artifactsDownloaded = false;
        transformers.artifactPresenceImpl = undefined;
        transformers.audioReady = false;
        transformers.audioChecks = 0;
        transformers.preloadCalls = 0;
        transformers.runtimeRefreshCalls = 0;
        transformers.runtimeOfflineChecks = 0;
        transformers.runtimeRefreshError = undefined;
        transformers.runtimeRefreshGate = undefined;
        transformers.preloadModelIds = [];
        transformers.preloadSignals = [];
        transformers.preloadImpl = undefined;
        transformers.disposeCalls = 0;
        transformers.deleteCalls = 0;
        transformers.deleteModelIds = [];
        transformers.requests = [];
        resetWllama();
    });

    it("downloads and verifies the ONNX manifest during model selection without touching Wllama", async () => {
        await expect(useWebModelFromUrl(entry)).resolves.toBeUndefined();

        expect(transformers.preloadCalls).toBe(1);
        expect(transformers.downloaded).toBe(true);
        expect(wl.modelSource).toBeUndefined();
        expect(get(webModelStatus)).toMatchObject({
            id: entry.id,
            name: entry.name,
            status: "attached",
        });
    });

    it("dispatches the original image to the all-WebGPU worker with the configured output cap", async () => {
        await useWebModelFromUrl(entry);
        updateTransformersWebGpuMaxOutputTokens(48);
        const image = new Uint8Array([21, 22, 23]);

        await expect(webInfer({ prompt: "read receipt", image })).resolves.toEqual({
            kind: "ok",
            text: "all-webgpu result",
        });
        expect(transformers.requests).toEqual([
            {
                prompt: "read receipt",
                image,
                maxTokens: 48,
                modelId: "qwen3-vl-2b-instruct-q4",
            },
        ]);
        expect(wl.loadCount).toBe(0);
    });

    it("routes normal text through the all-WebGPU worker instead of replaying the catalog GGUF", async () => {
        await useWebModelFromUrl(entry);

        await expect(webInfer({ prompt: "text only" })).resolves.toEqual({
            kind: "ok",
            text: "all-webgpu result",
        });
        expect(transformers.requests).toEqual([expect.objectContaining({ prompt: "text only" })]);
        expect(transformers.requests[0].image).toBeUndefined();
        expect(wl.loadCount).toBe(0);
    });

    it("ignores obsolete GGUF metadata and persists only the pinned Transformers runtime", async () => {
        await expect(
            useWebModelFromUrl({
                ...entry,
                files: [],
                sizeBytes: 0,
            }),
        ).resolves.toBeUndefined();

        expect(wl.modelSource).toBeUndefined();
        expect(transformers.preloadCalls).toBe(1);
        expect(JSON.parse(localStorage.getItem(LS_URL_MODEL)!)).toEqual({
            runtime: "transformers-webgpu",
            id: entry.id,
            name: entry.name,
        });
    });

    it("deletes the pinned CacheStorage payload when the user removes Qwen", async () => {
        await useWebModelFromUrl(entry);

        await clearWebModel();

        expect(transformers.deleteCalls).toBe(1);
        expect(transformers.deleteModelIds).toEqual([entry.id]);
        expect(get(webModelStatus)).toMatchObject({ status: "none", id: undefined });
        expect(localStorage.getItem(LS_URL_MODEL)).toBeNull();
    });

    it("migrates the previous GGUF-shaped Qwen selection after exact ONNX cache verification", async () => {
        transformers.downloaded = true;
        transformers.artifactsDownloaded = true;
        localStorage.setItem(
            LS_URL_MODEL,
            JSON.stringify({
                id: entry.id,
                name: entry.name,
                url: weightsUrl,
                mmprojUrl: projectorUrl,
                modalities: entry.modalities,
                files: entry.files,
                sizeBytes: entry.sizeBytes,
            }),
        );

        await restoreWebModel();

        expect(get(webModelStatus)).toMatchObject({ id: entry.id, status: "attached" });
        expect(JSON.parse(localStorage.getItem(LS_URL_MODEL)!)).toEqual({
            runtime: "transformers-webgpu",
            id: entry.id,
            name: entry.name,
        });
        expect(wl.modelSource).toBeUndefined();
    });

    it("allow-lists both pinned phone artifacts supported by the current engine", () => {
        expect(allWebGpuCatalogModelSupported(entry.id)).toBe(true);
        expect(allWebGpuCatalogModelSupported("gemma-4-e2b-it-q4")).toBe(true);
        expect(allWebGpuCatalogModelSupported("qwen3.5-0.8b-instruct-q4")).toBe(false);
        expect(allWebGpuCatalogModelSupported("smolvlm-256m-instruct-q8")).toBe(false);
    });

    it("selects Gemma from its pinned base manifest without requiring the optional audio add-on", async () => {
        const gemma = {
            id: "gemma-4-e2b-it-q4",
            name: "Gemma 4 E2B (multimodal)",
            files: [],
            sizeBytes: 0,
            modalities: ["text", "image", "audio"] as ModelModality[],
        };

        await expect(useWebModelFromUrl(gemma)).resolves.toBeUndefined();

        expect(transformers.preloadModelIds).toEqual([gemma.id]);
        expect(get(webModelStatus)).toMatchObject({
            id: gemma.id,
            status: "attached",
        });
        expect(transformers.audioChecks).toBe(1);
        expect(webModelModalities()).toEqual(["text", "image"]);
        expect(JSON.parse(localStorage.getItem(LS_URL_MODEL)!)).toEqual({
            runtime: "transformers-webgpu",
            id: gemma.id,
            name: gemma.name,
        });
    });

    it("advertises Gemma audio only after the separate add-on verifies", async () => {
        transformers.audioReady = true;
        const gemma = {
            id: "gemma-4-e2b-it-q4",
            name: "Gemma 4 E2B (multimodal)",
            files: [],
            sizeBytes: 0,
            modalities: ["text", "image", "audio"] as ModelModality[],
        };

        await expect(useWebModelFromUrl(gemma)).resolves.toBeUndefined();

        expect(transformers.audioChecks).toBe(1);
        expect(webModelModalities()).toEqual(["text", "image", "audio"]);
    });

    it("never downloads the Qwen GGUF when the all-WebGPU trial is unavailable", async () => {
        transformers.enabled = false;

        await expect(useWebModelFromUrl(entry)).resolves.toMatch(
            /all-WebGPU phone trial|WebGPU|accelerated image inference/i,
        );
        expect(transformers.preloadCalls).toBe(0);
        expect(wl.modelSource).toBeUndefined();
        expect(wl.loadCount).toBe(0);
    });

    it.each(["qwen3-vl-2b-instruct-q4", "gemma-4-e2b-it-q4"])(
        "routes ordinary text through selected all-WebGPU model %s without a projector-free option",
        async (modelId) => {
            const model =
                modelId === entry.id
                    ? entry
                    : {
                          id: modelId,
                          name: "Gemma 4 E2B (multimodal)",
                          files: [],
                          sizeBytes: 0,
                          modalities: ["text", "image", "audio"] as ModelModality[],
                      };
            await useWebModelFromUrl(model);

            await expect(webInfer({ modelId, prompt: "read this text" })).resolves.toEqual({
                kind: "ok",
                text: "all-webgpu result",
            });
            expect(transformers.requests).toEqual([
                expect.objectContaining({ modelId, prompt: "read this text" }),
            ]);
            expect(transformers.requests[0].image).toBeUndefined();
            expect(wl.loadCount).toBe(0);
        },
    );

    it("rejects ordinary text inference when the pinned model selection changed", async () => {
        await useWebModelFromUrl({
            id: "gemma-4-e2b-it-q4",
            name: "Gemma 4 E2B (multimodal)",
            files: [],
            sizeBytes: 0,
            modalities: ["text", "image", "audio"] as ModelModality[],
        });

        await expect(
            webInfer({ modelId: entry.id, prompt: "must reject a changed selection" }),
        ).resolves.toEqual({
            kind: "error",
            error: "the selected browser model changed before inference",
        });
        expect(transformers.requests).toEqual([]);
    });

    it("routes projector-absent verification through all-WebGPU with no caller image bytes", async () => {
        await useWebModelFromUrl(entry);

        await expect(
            webInfer({ prompt: "verify bounded OCR text" }, { requireProjectorAbsent: true }),
        ).resolves.toEqual({ kind: "ok", text: "all-webgpu result" });
        expect(transformers.requests).toEqual([
            expect.objectContaining({
                prompt: "verify bounded OCR text",
            }),
        ]);
        expect(transformers.requests[0].image).toBeUndefined();
        expect(wl.loadCount).toBe(0);
    });

    it("routes Gemma private verification through the selected all-WebGPU model", async () => {
        const gemma = {
            id: "gemma-4-e2b-it-q4",
            name: "Gemma 4 E2B (multimodal)",
            files: [],
            sizeBytes: 0,
            modalities: ["text", "image", "audio"] as ModelModality[],
        };
        await useWebModelFromUrl(gemma);

        await expect(
            webInfer(
                { modelId: gemma.id, prompt: "verify bounded OCR text" },
                { requireProjectorAbsent: true },
            ),
        ).resolves.toEqual({ kind: "ok", text: "all-webgpu result" });
        expect(transformers.requests).toEqual([
            expect.objectContaining({
                modelId: gemma.id,
                prompt: "verify bounded OCR text",
            }),
        ]);
        expect(transformers.requests[0].image).toBeUndefined();
        expect(wl.loadCount).toBe(0);
    });

    it("rejects private verification when the pinned model selection changed", async () => {
        const gemma = {
            id: "gemma-4-e2b-it-q4",
            name: "Gemma 4 E2B (multimodal)",
            files: [],
            sizeBytes: 0,
            modalities: ["text", "image", "audio"] as ModelModality[],
        };
        await useWebModelFromUrl(gemma);

        await expect(
            webInfer(
                { modelId: entry.id, prompt: "must reject a changed selection" },
                { requireProjectorAbsent: true },
            ),
        ).resolves.toEqual({
            kind: "error",
            error: "the selected browser model changed before inference",
        });
        expect(transformers.requests).toEqual([]);
    });

    it("keeps the projector-absent boundary closed to supplied image bytes", async () => {
        await useWebModelFromUrl(entry);

        await expect(
            webInfer(
                { prompt: "must reject", image: new Uint8Array([1]) },
                { requireProjectorAbsent: true },
            ),
        ).resolves.toEqual({ kind: "error", error: "projector-free inference accepts text only" });
        expect(transformers.requests).toEqual([]);
    });

    it("owns each preload with an AbortSignal and restores the prior state after cancellation", async () => {
        transformers.preloadImpl = ({ signal }) =>
            new Promise<void>((_resolve, reject) => {
                signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
            });
        const pending = useWebModelFromUrl(entry);
        await vi.waitFor(() => expect(transformers.preloadSignals).toHaveLength(1));
        expect(get(webModelStatus).status).toBe("downloading");

        cancelWebModelDownload();

        await expect(pending).resolves.toMatch(/cancelled|Retry download/i);
        expect(transformers.preloadSignals[0].aborted).toBe(true);
        expect(get(webModelStatus)).toMatchObject({ status: "none", id: undefined });
    });

    it("rejects a concurrent selection while the first owner is unresolved", async () => {
        transformers.preloadImpl = ({ signal }) =>
            new Promise<void>((_resolve, reject) => {
                signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
            });
        const first = useWebModelFromUrl(entry);
        await vi.waitFor(() => expect(get(webModelStatus).status).toBe("downloading"));

        await expect(useWebModelFromUrl(entry)).resolves.toMatch(/already in progress/i);
        cancelWebModelDownload();
        await first;
    });

    it("cannot commit a late preload after clear invalidates its owner generation", async () => {
        let finishPreload: () => void = () => undefined;
        transformers.preloadImpl = ({ signal }) =>
            new Promise<void>((resolve) => {
                finishPreload = () => {
                    transformers.downloaded = true;
                    resolve();
                };
                // Deliberately ignore abort to exercise the generation check after a stale provider
                // resolves. The real preloader observes this signal while streaming every chunk.
                expect(signal).toBeDefined();
            });
        const selection = useWebModelFromUrl(entry);
        await vi.waitFor(() => expect(transformers.preloadSignals).toHaveLength(1));

        const clearing = clearWebModel();
        finishPreload();

        await expect(selection).resolves.toMatch(/cancelled|Retry download/i);
        await clearing;
        expect(get(webModelStatus)).toMatchObject({ status: "none", id: undefined });
        expect(localStorage.getItem(LS_URL_MODEL)).toBeNull();
    });

    it("cancels a preload when the page is backgrounded and leaves Retry available", async () => {
        transformers.preloadImpl = ({ signal }) =>
            new Promise<void>((_resolve, reject) => {
                signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
            });
        const pending = useWebModelFromUrl(entry);
        await vi.waitFor(() => expect(transformers.preloadSignals).toHaveLength(1));
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));

        await expect(pending).resolves.toMatch(/background|Retry download/i);
        expect(get(webModelStatus).status).toBe("none");
        Object.defineProperty(document, "hidden", { configurable: true, value: false });
    });

    it("cancels a stalled preload and reports a retryable connection error", async () => {
        vi.useFakeTimers();
        try {
            transformers.preloadImpl = ({ signal }) =>
                new Promise<void>((_resolve, reject) => {
                    signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
                });
            const pending = useWebModelFromUrl(entry);
            await Promise.resolve();
            expect(transformers.preloadSignals).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(90_000);

            await expect(pending).resolves.toMatch(/stopped making progress|Retry download/i);
            expect(transformers.preloadSignals[0].aborted).toBe(true);
            expect(get(webModelStatus).status).toBe("none");
        } finally {
            vi.useRealTimers();
        }
    });

    it("does not evict an already-attached exact runtime when its cached preload is rechecked", async () => {
        await useWebModelFromUrl(entry);
        const disposals = transformers.disposeCalls;

        await useWebModelFromUrl(entry);

        expect(transformers.disposeCalls).toBe(disposals);
        expect(get(webModelStatus)).toMatchObject({ id: entry.id, status: "attached" });
    });

    it("keeps both model downloads and switches back cache-only without deletion", async () => {
        const gemma = {
            id: "gemma-4-e2b-it-q4",
            name: "Gemma 4 E2B (multimodal)",
            files: [],
            sizeBytes: 0,
            modalities: ["text", "image", "audio"] as ModelModality[],
        };

        await useWebModelFromUrl(entry);
        await useWebModelFromUrl(gemma);
        const preloadCallsAfterBothDownloads = transformers.preloadCalls;

        await useWebModelFromUrl(entry);

        expect(transformers.preloadModelIds).toEqual([entry.id, gemma.id]);
        expect(transformers.preloadCalls).toBe(preloadCallsAfterBothDownloads);
        expect(transformers.deleteCalls).toBe(0);
        expect(transformers.downloadedModelIds).toEqual(new Set([entry.id, gemma.id]));
        expect(get(webModelInstallStatus)).toMatchObject({
            [entry.id]: "downloaded",
            [gemma.id]: "downloaded",
        });
        expect(get(webModelStatus)).toMatchObject({ id: entry.id, status: "attached" });
    });

    it("reports inactive cached models independently from the current selection", async () => {
        transformers.artifactsDownloaded = true;
        transformers.downloadedModelIds.add(entry.id);
        transformers.downloadedModelIds.add("gemma-4-e2b-it-q4");

        await refreshWebModelInstallStatus([entry.id, "gemma-4-e2b-it-q4"]);

        expect(get(webModelInstallStatus)).toMatchObject({
            [entry.id]: "downloaded",
            "gemma-4-e2b-it-q4": "downloaded",
        });
    });

    it("merges a refresh per model when a concurrent selection updates one model", async () => {
        const gemmaId = "gemma-4-e2b-it-q4";
        const resolvers = new Map<string, (downloaded: boolean) => void>();
        transformers.artifactPresenceImpl = (modelId) =>
            new Promise<boolean>((resolve) => resolvers.set(modelId, resolve));
        const refresh = refreshWebModelInstallStatus([entry.id, gemmaId]);
        await vi.waitFor(() => expect(resolvers.size).toBe(2));

        await useWebModelFromUrl(entry);
        resolvers.get(entry.id)!(false);
        resolvers.get(gemmaId)!(true);
        await refresh;

        expect(get(webModelInstallStatus)).toMatchObject({
            [entry.id]: "downloaded",
            [gemmaId]: "downloaded",
        });
    });

    it("merges a refresh per model when explicit removal updates one model", async () => {
        const gemmaId = "gemma-4-e2b-it-q4";
        await useWebModelFromUrl(entry);
        const resolvers = new Map<string, (downloaded: boolean) => void>();
        transformers.artifactPresenceImpl = (modelId) =>
            new Promise<boolean>((resolve) => resolvers.set(modelId, resolve));
        const refresh = refreshWebModelInstallStatus([entry.id, gemmaId]);
        await vi.waitFor(() => expect(resolvers.size).toBe(2));

        await clearWebModel();
        resolvers.get(entry.id)!(true);
        resolvers.get(gemmaId)!(true);
        await refresh;

        expect(get(webModelInstallStatus)).toMatchObject({
            [entry.id]: "not_downloaded",
            [gemmaId]: "downloaded",
        });
    });

    it("does not apply the network stall timer while verifying a cached model and remains cancellable", async () => {
        vi.useFakeTimers();
        try {
            const gemma = {
                id: "gemma-4-e2b-it-q4",
                name: "Gemma 4 E2B (multimodal)",
                files: [],
                sizeBytes: 0,
                modalities: ["text", "image", "audio"] as ModelModality[],
            };
            await useWebModelFromUrl(entry);
            await useWebModelFromUrl(gemma);
            const preloads = transformers.preloadCalls;
            transformers.modelDownloadedSignals = [];
            let verificationStarted!: () => void;
            const started = new Promise<void>((resolve) => {
                verificationStarted = resolve;
            });
            transformers.modelDownloadedImpl = async (_modelId, { signal }) =>
                new Promise<boolean>((_resolve, reject) => {
                    verificationStarted();
                    signal?.addEventListener("abort", () => reject(signal.reason), {
                        once: true,
                    });
                });

            const switching = useWebModelFromUrl(entry);
            await started;
            expect(transformers.modelDownloadedSignals).toHaveLength(1);
            await vi.advanceTimersByTimeAsync(90_000);
            expect(transformers.modelDownloadedSignals[0].aborted).toBe(false);

            cancelWebModelDownload();
            await expect(switching).resolves.toMatch(/cancelled|Retry download/i);
            expect(transformers.modelDownloadedSignals[0].aborted).toBe(true);
            expect(transformers.preloadCalls).toBe(preloads);
            expect(get(webModelStatus)).toMatchObject({ id: gemma.id, status: "attached" });
        } finally {
            vi.useRealTimers();
        }
    });

    it("keeps the selected model and downloaded status when explicit cache deletion fails", async () => {
        await useWebModelFromUrl(entry);
        const persisted = localStorage.getItem(LS_URL_MODEL);
        transformers.deleteError = "CacheStorage removal failed";

        await expect(clearWebModel()).rejects.toThrow("CacheStorage removal failed");

        expect(get(webModelStatus)).toMatchObject({ id: entry.id, status: "attached" });
        expect(get(webModelInstallStatus)).toMatchObject({ [entry.id]: "downloaded" });
        expect(localStorage.getItem(LS_URL_MODEL)).toBe(persisted);
        expect(transformers.downloadedModelIds.has(entry.id)).toBe(true);
        transformers.deleteError = undefined;
    });

    it("publishes content-free all-WebGPU engine progress for message status labels", async () => {
        await useWebModelFromUrl(entry);
        transformers.statusListener?.({
            phase: "loading",
            stage: "text",
            progress: 0.25,
            file: "decoder_model_merged",
        });
        expect(get(webModelStatus).generation).toEqual({
            phase: "loading",
            stage: "text",
            progress: 0.25,
            file: "decoder_model_merged",
        });

        transformers.statusListener?.({ phase: "idle" });
        expect(get(webModelStatus).generation).toBeUndefined();
    });

    it("restores a persisted model across an APK worker rotation without downloading weights", async () => {
        await useWebModelFromUrl(entry);
        const modelDownloads = transformers.preloadCalls;
        transformers.artifactsDownloaded = true;
        transformers.downloaded = false;

        await restoreWebModel();

        expect(transformers.runtimeRefreshCalls).toBe(1);
        expect(transformers.preloadCalls).toBe(modelDownloads);
        expect(get(webModelStatus)).toMatchObject({
            id: entry.id,
            status: "attached",
            error: undefined,
        });
        expect(get(webModelInstallStatus)).toMatchObject({ [entry.id]: "downloaded" });
        expect(localStorage.getItem(LS_URL_MODEL)).not.toBeNull();

        await expect(webInfer({ prompt: "cache-only after startup" })).resolves.toEqual({
            kind: "ok",
            text: "all-webgpu result",
        });
        expect(transformers.runtimeRefreshCalls).toBe(1);
        expect(transformers.preloadCalls).toBe(modelDownloads);
    });

    it("restores a persisted selection without streaming multi-gigabyte model bodies at startup", async () => {
        localStorage.setItem(
            LS_URL_MODEL,
            JSON.stringify({
                runtime: "transformers-webgpu",
                id: entry.id,
                name: entry.name,
            }),
        );
        transformers.artifactsDownloaded = true;
        transformers.downloaded = true;

        await restoreWebModel();

        expect(transformers.modelDownloadedCalls).toBe(0);
        expect(transformers.runtimeOfflineChecks).toBe(1);
        expect(get(webModelStatus)).toMatchObject({ id: entry.id, status: "attached" });
    });

    it("coalesces concurrent startup and Model Manager runtime restores", async () => {
        localStorage.setItem(
            LS_URL_MODEL,
            JSON.stringify({
                runtime: "transformers-webgpu",
                id: entry.id,
                name: entry.name,
            }),
        );
        transformers.artifactsDownloaded = true;
        transformers.downloaded = false;
        let releaseRuntimeRefresh!: () => void;
        transformers.runtimeRefreshGate = new Promise((resolve) => {
            releaseRuntimeRefresh = resolve;
        });

        const startupRestore = ensureWebModelRestored();
        await vi.waitFor(() => expect(transformers.runtimeRefreshCalls).toBe(1));
        const managerRestore = ensureWebModelRestored();
        await Promise.resolve();
        expect(transformers.runtimeRefreshCalls).toBe(1);

        releaseRuntimeRefresh();
        await Promise.all([startupRestore, managerRestore]);
        expect(transformers.runtimeRefreshCalls).toBe(1);
        expect(get(webModelStatus)).toMatchObject({ id: entry.id, status: "attached" });
    });

    it("keeps the persisted selection retryable when its runtime-only refresh fails", async () => {
        await useWebModelFromUrl(entry);
        const persisted = localStorage.getItem(LS_URL_MODEL);
        const modelDownloads = transformers.preloadCalls;
        transformers.artifactsDownloaded = true;
        transformers.downloaded = false;
        transformers.runtimeRefreshError = "packaged worker unavailable";

        await restoreWebModel();

        expect(transformers.runtimeRefreshCalls).toBe(1);
        expect(transformers.preloadCalls).toBe(modelDownloads);
        expect(get(webModelStatus)).toMatchObject({
            id: entry.id,
            status: "error",
            error: expect.stringContaining("downloaded model is intact"),
        });
        expect(get(webModelInstallStatus)).toMatchObject({ [entry.id]: "downloaded" });
        expect(get(webModelStatus).error).not.toContain("needs an update");
        expect(localStorage.getItem(LS_URL_MODEL)).toBe(persisted);
    });

    it("reports a persisted selection as unavailable when its pinned ONNX cache is incomplete", async () => {
        await useWebModelFromUrl(entry);
        transformers.artifactsDownloaded = false;
        transformers.downloaded = false;

        await restoreWebModel();

        expect(get(webModelStatus)).toMatchObject({
            id: entry.id,
            status: "error",
            error: expect.stringContaining("needs an update"),
        });
        expect(get(webModelInstallStatus)).toMatchObject({ [entry.id]: "not_downloaded" });
        await expect(browserImageModelFirstReadiness()).resolves.toEqual({
            available: false,
            reason: expect.stringContaining("needs an update"),
        });
        expect(transformers.runtimeRefreshCalls).toBe(0);
    });
});
