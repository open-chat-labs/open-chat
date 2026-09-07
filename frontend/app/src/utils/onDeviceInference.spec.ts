import type { InferenceRequest } from "@shared";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InferResponse, LocalModel } from "tauri-plugin-oc-api";
import {
    infer as nativeInfer,
    inferenceRuntimeAvailable,
    listLocalModels,
} from "tauri-plugin-oc-api";
import { browserImageActionMode } from "../stores/browserImageActionMode";
import { selectedModelId } from "../stores/onDeviceModels";
import {
    inferOnDevice,
    isNativeClient,
    NATIVE_INFERENCE_UPDATE_REQUIRED,
    NATIVE_MODEL_UPDATE_REQUIRED,
    onDeviceInferenceCapability,
    onDeviceInferenceReadiness,
    usesWebInferenceRuntime,
} from "./onDeviceInference";
import { defaultModelCatalog } from "./modelCatalog";
import { clearWebModel, useWebModelFromUrl, webInfer } from "./webInference";

const webRuntime = vi.hoisted(() => ({
    imageSupported: true,
    cached: [] as { url: string; bytes: Uint8Array }[],
}));
const localReaderRuntime = vi.hoisted(() => ({ available: false }));

vi.mock("./browserOcr", () => ({
    browserOcrAvailable: () => localReaderRuntime.available,
}));

vi.mock("@wllama/wllama/esm/index.js", () => {
    class Wllama {
        async loadModel() {}
        supportInputModality(modality: string): boolean {
            return modality === "image" ? webRuntime.imageSupported : false;
        }
        async createChatCompletion() {
            return { choices: [{ message: { content: "ok" } }] };
        }
        async exit() {}
    }
    class ModelManager {
        async getModelOrDownload(source: { url: string; mmprojUrl?: string }) {
            return {
                files: webRuntime.cached.map((file) => ({
                    metadata: { originalURL: file.url },
                })),
                open: async () =>
                    webRuntime.cached.map(
                        (file) => new Blob([file.bytes.slice().buffer as ArrayBuffer]),
                    ),
                remove: async () => {},
                source,
            };
        }
    }
    return { Wllama, ModelManager };
});

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

async function hashOf(bytes: Uint8Array): Promise<string> {
    const digest = await webcrypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

// The native bridge is the ONLY external dependency of the facade. Stub it so no real Tauri IPC (and no
// network / model load) is ever touched — every test is deterministic.
vi.mock("tauri-plugin-oc-api", () => ({
    infer: vi.fn(),
    inferenceRuntimeAvailable: vi.fn(),
    listLocalModels: vi.fn(),
}));

const mockInfer = vi.mocked(nativeInfer);
const mockInferenceRuntimeAvailable = vi.mocked(inferenceRuntimeAvailable);
const mockListLocalModels = vi.mocked(listLocalModels);

const MODEL_ID = "gemma-4-e2b-it-q4";
const TRUSTED_MODEL = defaultModelCatalog.models.find((model) => model.id === MODEL_ID)!;
const DEFAULT_USER_AGENT = navigator.userAgent;

function setNative(native: boolean): void {
    if (native) {
        (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    } else {
        delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    }
}

function setUserAgent(value: string): void {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value });
}

function enableLocalAndroidWebGpu(): void {
    setNative(true);
    setUserAgent("Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/150 Mobile");
    vi.stubEnv("OC_BUILD_ENV", "development");
    vi.stubEnv("OC_DFX_NETWORK", "local");
    vi.stubEnv("OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE", "true");
}

function localModel(overrides: Partial<LocalModel> = {}): LocalModel {
    return {
        modelId: MODEL_ID,
        runtime: "llama-cpp",
        sizeBytes: 4092392352,
        files: TRUSTED_MODEL.files.map((file) => ({ ...file })),
        path: "/models/gemma-4-e2b-it-q4",
        ...overrides,
    };
}

beforeEach(async () => {
    mockInfer.mockReset();
    mockListLocalModels.mockReset();
    // Reset the facade's measured native capability through the actual probe boundary.
    setNative(true);
    mockInferenceRuntimeAvailable.mockReset().mockResolvedValue(false);
    await onDeviceInferenceReadiness();
    mockInferenceRuntimeAvailable.mockReset().mockResolvedValue(true);
    // Default: no model downloaded and none selected — each test opts into what it needs.
    mockListLocalModels.mockResolvedValue([]);
    selectedModelId.set("");
    browserImageActionMode.set("model_only");
    setNative(false);
    setUserAgent(DEFAULT_USER_AGENT);
    webRuntime.cached = [];
    localReaderRuntime.available = false;
});

afterEach(() => {
    setNative(false);
    setUserAgent(DEFAULT_USER_AGENT);
    vi.unstubAllEnvs();
    selectedModelId.set("");
    browserImageActionMode.set("model_only");
});

describe("isNativeClient", () => {
    it("is false without the Tauri bridge, true with it", () => {
        setNative(false);
        expect(isNativeClient()).toBe(false);
        setNative(true);
        expect(isNativeClient()).toBe(true);
    });
});

describe("legacy native audio boundary", () => {
    it.each([
        { prompt: "Listen", audio: new Uint8Array([1]) },
        { prompt: "Listen", audioMimeType: "audio/webm" },
    ])("rejects supplied audio instead of invoking text-only native inference", async (request) => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel()]);
        await expect(inferOnDevice(request)).resolves.toEqual({
            kind: "unavailable",
            reason: "The selected native runtime does not support audio.",
        });
        expect(mockInferenceRuntimeAvailable).not.toHaveBeenCalled();
        expect(mockListLocalModels).not.toHaveBeenCalled();
        expect(mockInfer).not.toHaveBeenCalled();
    });
});

describe("onDeviceInferenceReadiness", () => {
    it("requires the accelerated model in a feature-flagged Android WebView without probing llama.cpp", async () => {
        enableLocalAndroidWebGpu();
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel()]);

        expect(usesWebInferenceRuntime()).toBe(true);
        await expect(onDeviceInferenceReadiness()).resolves.toEqual({
            available: false,
            reason: "no accelerated on-device model selected",
        });
        expect(mockInferenceRuntimeAvailable).not.toHaveBeenCalled();
        expect(mockListLocalModels).not.toHaveBeenCalled();
        expect(onDeviceInferenceCapability()).toEqual({
            available: false,
            runtimesSupported: ["transformers-webgpu"],
            selectedModelId: undefined,
            selectedModalities: [],
        });
    });

    it.each(["local_reader_only", "model_with_local_verification"] as const)(
        "still requires a selected decoder in explicit %s mode",
        async (mode) => {
            enableLocalAndroidWebGpu();
            browserImageActionMode.set(mode);
            localReaderRuntime.available = true;

            await expect(onDeviceInferenceReadiness()).resolves.toEqual({
                available: false,
                reason: "no accelerated on-device model selected",
            });
            expect(mockInferenceRuntimeAvailable).not.toHaveBeenCalled();
            expect(mockListLocalModels).not.toHaveBeenCalled();
        },
    );

    it("does not advertise APK OCR readiness in model-only mode", async () => {
        enableLocalAndroidWebGpu();
        browserImageActionMode.set("model_only");
        localReaderRuntime.available = true;

        await expect(onDeviceInferenceReadiness()).resolves.toEqual({
            available: false,
            reason: "no accelerated on-device model selected",
        });
    });

    it("does not treat a Tauri bridge as proof that the runtime was compiled in", async () => {
        setNative(true);
        browserImageActionMode.set("local_reader_only");
        localReaderRuntime.available = true;
        mockInferenceRuntimeAvailable.mockResolvedValue(false);

        await expect(onDeviceInferenceReadiness()).resolves.toEqual({
            available: false,
            reason: "This OpenChat build does not include on-device inference. Update or reinstall OpenChat, then try again.",
        });
    });

    it("is ready only when the selected install matches the trusted built-in metadata", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel()]);

        await expect(onDeviceInferenceReadiness()).resolves.toEqual({ available: true });
        expect(onDeviceInferenceCapability().available).toBe(true);
    });

    it("requires an update for a stale selected install and never advertises it as ready", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel({ sizeBytes: 4092390336 })]);

        await expect(onDeviceInferenceReadiness()).resolves.toEqual({
            available: false,
            reason: NATIVE_MODEL_UPDATE_REQUIRED,
        });
        expect(onDeviceInferenceCapability().available).toBe(false);
        expect(mockInfer).not.toHaveBeenCalled();
    });

    it("does not make an unselected stale install ready", async () => {
        setNative(true);
        selectedModelId.set("");
        mockListLocalModels.mockResolvedValue([localModel({ sizeBytes: 4092390336 })]);

        await expect(onDeviceInferenceReadiness()).resolves.toEqual({
            available: false,
            reason: "no on-device model selected",
        });
        expect(onDeviceInferenceCapability().available).toBe(false);
    });
});

describe("focused inference image bounds", () => {
    it.each(["lower_half", "detail_card", "lower_detail_rows"] as const)(
        "rejects an oversized original for %s before attempting a region decode",
        async (imageRegion) => {
            const oversized = new Uint8Array(20 * 1024 * 1024 + 1);
            oversized.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            const decode = vi.fn();
            vi.stubGlobal("createImageBitmap", decode);

            await expect(
                inferOnDevice({
                    prompt: "read labelled detail",
                    image: oversized,
                    imageRegion,
                }),
            ).resolves.toEqual({ kind: "error", error: "inference image region is invalid" });
            expect(decode).not.toHaveBeenCalled();
        },
    );

    it("rejects an image region outside the closed shared enum", async () => {
        await expect(
            inferOnDevice({
                prompt: "read labelled detail",
                image: new Uint8Array([1]),
                imageRegion: "arbitrary_box" as never,
            }),
        ).resolves.toEqual({ kind: "error", error: "inference image region is invalid" });
    });
});

describe("inferOnDevice — unavailable branches", () => {
    it("requires an update before touching models when this native build omitted inference", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockInferenceRuntimeAvailable.mockResolvedValue(false);
        mockListLocalModels.mockResolvedValue([localModel()]);

        const res = await inferOnDevice({ prompt: "hi" });

        expect(res).toEqual({
            kind: "unavailable",
            reason: "This OpenChat build does not include on-device inference. Update or reinstall OpenChat, then try again.",
        });
        expect(mockListLocalModels).not.toHaveBeenCalled();
        expect(mockInfer).not.toHaveBeenCalled();
    });

    it("treats a missing runtime probe command as an old build that requires an update", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockInferenceRuntimeAvailable.mockRejectedValue(new Error("command not found"));

        const res = await inferOnDevice({ prompt: "hi" });

        expect(res).toEqual({
            kind: "unavailable",
            reason: "This OpenChat build does not include on-device inference. Update or reinstall OpenChat, then try again.",
        });
        expect(mockListLocalModels).not.toHaveBeenCalled();
        expect(mockInfer).not.toHaveBeenCalled();
    });

    it("is unavailable (not the native client) when the bridge is absent", async () => {
        setNative(false);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel()]);

        const res = await inferOnDevice({ prompt: "hi" });

        expect(res).toEqual({
            kind: "unavailable",
            reason: "on-device inference requires the native client",
        });
        // The facade must short-circuit before ever touching the bridge.
        expect(mockListLocalModels).not.toHaveBeenCalled();
        expect(mockInfer).not.toHaveBeenCalled();
    });

    it("is unavailable (no model selected) when neither the request nor the store resolves a modelId", async () => {
        setNative(true);
        selectedModelId.set("");

        const res = await inferOnDevice({ prompt: "hi" });

        expect(res).toEqual({ kind: "unavailable", reason: "no on-device model selected" });
        expect(mockInfer).not.toHaveBeenCalled();
    });

    it("is unavailable (not downloaded) when the selected model is not in listLocalModels", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([]);

        const res = await inferOnDevice({ prompt: "hi" });

        expect(res).toEqual({
            kind: "unavailable",
            reason: "the selected model is not downloaded",
        });
        expect(mockInfer).not.toHaveBeenCalled();
    });

    it("is unavailable (not downloaded) when only a DIFFERENT model is downloaded", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel({ modelId: "some-other-model" })]);

        const res = await inferOnDevice({ prompt: "hi" });

        expect(res).toEqual({
            kind: "unavailable",
            reason: "the selected model is not downloaded",
        });
        expect(mockInfer).not.toHaveBeenCalled();
    });
});

describe("inferOnDevice — modelId resolution", () => {
    it("prefers the request.modelId over the store selection", async () => {
        setNative(true);
        selectedModelId.set("stale-store-selection");
        mockListLocalModels.mockResolvedValue([localModel()]);
        mockInfer.mockResolvedValue({ text: "ok" } satisfies InferResponse);

        const res = await inferOnDevice({ modelId: MODEL_ID, prompt: "hi" });

        expect(res).toEqual({ kind: "ok", text: "ok" });
        expect(mockInfer).toHaveBeenCalledWith(expect.objectContaining({ modelId: MODEL_ID }));
    });

    it("falls back to the store selection when request.modelId is omitted", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel()]);
        mockInfer.mockResolvedValue({ text: "ok" } satisfies InferResponse);

        const res = await inferOnDevice({ prompt: "hi" });

        expect(res).toEqual({ kind: "ok", text: "ok" });
        expect(mockInfer).toHaveBeenCalledWith(expect.objectContaining({ modelId: MODEL_ID }));
    });
});

describe("inferOnDevice — ok path + payload shape", () => {
    it("returns ok and maps the payload exactly (image -> number[], responseSchema -> JSON string)", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel()]);
        mockInfer.mockResolvedValue({ text: "generated answer" } satisfies InferResponse);

        const schema = { type: "object", properties: { amount: { type: "number" } } };
        const request: InferenceRequest = {
            modelId: MODEL_ID,
            prompt: "extract the amount",
            image: new Uint8Array([1, 2, 3, 255]),
            text: "some context",
            maxTokens: 64,
            responseSchema: schema,
        };

        const res = await inferOnDevice(request);

        expect(res).toEqual({ kind: "ok", text: "generated answer" });

        // The exact IPC payload: runtime comes from the LOCAL model (not the request), the image
        // Uint8Array is converted to a plain number[], and the schema object is JSON-stringified.
        expect(mockInfer).toHaveBeenCalledTimes(1);
        expect(mockInfer).toHaveBeenCalledWith({
            modelId: MODEL_ID,
            runtime: "llama-cpp",
            prompt: "extract the amount",
            image: [1, 2, 3, 255],
            text: "some context",
            maxTokens: 64,
            responseSchema: JSON.stringify(schema),
        });

        // Pin the image conversion: a plain array, not a Uint8Array.
        const payload = mockInfer.mock.calls[0][0];
        expect(Array.isArray(payload.image)).toBe(true);
        expect(payload.image).not.toBeInstanceOf(Uint8Array);
        expect(typeof payload.responseSchema).toBe("string");
    });

    it("leaves optional fields undefined when the request omits them", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel()]);
        mockInfer.mockResolvedValue({ text: "ok" } satisfies InferResponse);

        await inferOnDevice({ modelId: MODEL_ID, prompt: "just text" });

        expect(mockInfer).toHaveBeenCalledWith({
            modelId: MODEL_ID,
            runtime: "llama-cpp",
            prompt: "just text",
            image: undefined,
            text: undefined,
            maxTokens: undefined,
            responseSchema: undefined,
        });
    });

    it("forwards the runtime declared by the downloaded model", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel({ runtime: "llama-cpp" })]);
        mockInfer.mockResolvedValue({ text: "ok" } satisfies InferResponse);

        await inferOnDevice({ modelId: MODEL_ID, prompt: "hi" });

        expect(mockInfer).toHaveBeenCalledWith(expect.objectContaining({ runtime: "llama-cpp" }));
    });
});

describe("inferOnDevice — error path (thrown -> error, NOT unavailable)", () => {
    it("maps a native infer rejection (e.g. build without the inference feature) to kind:error", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel()]);
        mockInfer.mockRejectedValue(new Error("inference feature not built"));

        const res = await inferOnDevice({ modelId: MODEL_ID, prompt: "hi" });

        // Intended mapping in THIS repo: a thrown error is {kind:'error'}, never {kind:'unavailable'}.
        expect(res).toEqual({ kind: "error", error: "inference feature not built" });
    });

    it("stringifies a non-Error rejection", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel()]);
        mockInfer.mockRejectedValue("boom");

        const res = await inferOnDevice({ modelId: MODEL_ID, prompt: "hi" });

        expect(res).toEqual({ kind: "error", error: "boom" });
    });

    it("maps a listLocalModels rejection (bridge failure) to kind:error, not unavailable", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockRejectedValue(new Error("bridge down"));

        const res = await inferOnDevice({ modelId: MODEL_ID, prompt: "hi" });

        expect(res).toEqual({ kind: "error", error: "bridge down" });
        expect(mockInfer).not.toHaveBeenCalled();
    });
});

describe("onDeviceInferenceCapability", () => {
    it("is available after probing the native runtime and verified selected install", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel()]);
        await expect(onDeviceInferenceReadiness()).resolves.toEqual({ available: true });

        const cap = onDeviceInferenceCapability();

        expect(cap.available).toBe(true);
        expect(cap.runtimesSupported).toEqual(["llama-cpp"]);
        expect(cap.selectedModelId).toBe(MODEL_ID);
        // Modalities come from the catalog entry for the selected model.
        expect(cap.selectedModalities).toEqual(["text", "image"]);
    });

    it("is NOT available when a native shell omitted the inference runtime", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockInferenceRuntimeAvailable.mockResolvedValue(false);
        await onDeviceInferenceReadiness();

        expect(onDeviceInferenceCapability().available).toBe(false);
    });

    it("is NOT available when not the native client (even with a model selected)", () => {
        setNative(false);
        selectedModelId.set(MODEL_ID);

        const cap = onDeviceInferenceCapability();

        expect(cap.available).toBe(false);
        expect(cap.runtimesSupported).toEqual(["llama-cpp"]);
        expect(cap.selectedModelId).toBe(MODEL_ID);
    });

    it("is NOT available and reports no model when nothing is selected", () => {
        setNative(true);
        selectedModelId.set("");

        const cap = onDeviceInferenceCapability();

        expect(cap.available).toBe(false);
        expect(cap.selectedModelId).toBeUndefined();
        expect(cap.selectedModalities).toEqual([]);
    });

    it("fails closed when a restored selection is not in the trusted catalog", () => {
        setNative(true);
        selectedModelId.set("unknown-model-not-in-catalog");

        const cap = onDeviceInferenceCapability();

        expect(cap.available).toBe(false);
        expect(cap.selectedModelId).toBe("unknown-model-not-in-catalog");
        expect(cap.selectedModalities).toEqual([]);
    });

    it("does not invoke native IPC for an unknown restored model id", async () => {
        setNative(true);
        selectedModelId.set("unknown-model-not-in-catalog");
        mockListLocalModels.mockResolvedValue([
            localModel({ modelId: "unknown-model-not-in-catalog" }),
        ]);

        await expect(inferOnDevice({ prompt: "hi" })).resolves.toEqual({
            kind: "unavailable",
            reason: "the selected model is not in the trusted catalog",
        });
        expect(mockListLocalModels).not.toHaveBeenCalled();
        expect(mockInfer).not.toHaveBeenCalled();
    });

    it.each([
        { prompt: "" },
        { prompt: "x".repeat(64 * 1024 + 1) },
        { prompt: "é".repeat(32 * 1024 + 1) },
        { prompt: "ok", text: "x".repeat(1024 * 1024 + 1) },
        { prompt: "ok", image: new Uint8Array(20 * 1024 * 1024 + 1) },
        { prompt: "ok", maxTokens: 0 },
        { prompt: "ok", maxTokens: 1.5 },
        { prompt: "ok", maxTokens: 4097 },
        {
            prompt: "ok",
            responseSchema: { value: "x".repeat(64 * 1024 + 1) },
        },
    ])("rejects oversized or invalid inference input before native IPC", async (request) => {
        setNative(true);
        selectedModelId.set(MODEL_ID);

        await expect(inferOnDevice(request)).resolves.toEqual({
            kind: "error",
            error: "inference request exceeds native safety limits",
        });
        expect(mockListLocalModels).not.toHaveBeenCalled();
        expect(mockInfer).not.toHaveBeenCalled();
    });

    it("rejects a cyclic response schema before native IPC", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;

        await expect(inferOnDevice({ prompt: "ok", responseSchema: cyclic })).resolves.toEqual({
            kind: "error",
            error: "response schema is not serializable",
        });
        expect(mockListLocalModels).not.toHaveBeenCalled();
        expect(mockInfer).not.toHaveBeenCalled();
    });

    it("fails closed with update guidance when installed metadata disagrees with the trusted catalog", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel({ sizeBytes: 1 })]);

        await expect(inferOnDevice({ prompt: "hi" })).resolves.toEqual({
            kind: "unavailable",
            reason: NATIVE_MODEL_UPDATE_REQUIRED,
        });
        expect(mockInfer).not.toHaveBeenCalled();
    });
});

describe("native runtime availability", () => {
    it.each(["not compiled", "old binary"])(
        "fails closed for a runtime %s before reading models",
        async (scenario) => {
            setNative(true);
            selectedModelId.set(MODEL_ID);
            if (scenario === "old binary") {
                mockInferenceRuntimeAvailable.mockRejectedValue(new Error("unknown command"));
            } else {
                mockInferenceRuntimeAvailable.mockResolvedValue(false);
            }
            await expect(onDeviceInferenceReadiness()).resolves.toEqual({
                available: false,
                reason: NATIVE_INFERENCE_UPDATE_REQUIRED,
            });
            await expect(inferOnDevice({ prompt: "Read this" })).resolves.toEqual({
                kind: "unavailable",
                reason: NATIVE_INFERENCE_UPDATE_REQUIRED,
            });
            expect(onDeviceInferenceCapability().available).toBe(false);
            expect(mockListLocalModels).not.toHaveBeenCalled();
            expect(mockInfer).not.toHaveBeenCalled();
        },
    );

    it("does not advertise the bridge before measuring runtime and selected artifact readiness", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel()]);
        expect(onDeviceInferenceCapability().available).toBe(false);
        await expect(onDeviceInferenceReadiness()).resolves.toEqual({ available: true });
        expect(onDeviceInferenceCapability().available).toBe(true);
        selectedModelId.set("qwen3-vl-2b-instruct-q4");
        expect(onDeviceInferenceCapability().available).toBe(false);
    });

    it("requires an update for a stale installed file identity even when sizes still match", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        const installed = localModel();
        mockListLocalModels.mockResolvedValue([
            {
                ...installed,
                files: installed.files.map((file, index) =>
                    index === 0 ? { ...file, sha256: "0".repeat(64) } : file,
                ),
            },
        ]);
        await expect(onDeviceInferenceReadiness()).resolves.toEqual({
            available: false,
            reason: NATIVE_MODEL_UPDATE_REQUIRED,
        });
        await expect(inferOnDevice({ prompt: "Read this" })).resolves.toEqual({
            kind: "unavailable",
            reason: NATIVE_MODEL_UPDATE_REQUIRED,
        });
        expect(mockInfer).not.toHaveBeenCalled();
    });
});

const WEB_VISION_WEIGHTS_URL = "https://host/models/smolvlm.gguf";
const WEB_VISION_PROJECTOR_URL = "https://host/models/mmproj-smolvlm.gguf";

async function attachWebVisionModel(modalities: ("text" | "image")[]) {
    const weights = new Uint8Array([1, 2, 3, 4]);
    const projector = new Uint8Array([5, 6, 7]);
    webRuntime.cached = [
        { url: WEB_VISION_WEIGHTS_URL, bytes: weights },
        { url: WEB_VISION_PROJECTOR_URL, bytes: projector },
    ];
    return useWebModelFromUrl({
        id: "smolvlm-256m-instruct-q8",
        name: "SmolVLM 256M (vision)",
        files: [
            { url: WEB_VISION_WEIGHTS_URL, sha256: await hashOf(weights), bytes: weights.length },
            {
                url: WEB_VISION_PROJECTOR_URL,
                sha256: await hashOf(projector),
                bytes: projector.length,
            },
        ],
        sizeBytes: 7,
        modalities,
    });
}

describe("onDeviceInferenceCapability in a browser", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
        webRuntime.imageSupported = true;
    });

    it("reports unavailable with no model attached", () => {
        const cap = onDeviceInferenceCapability();
        expect(cap.available).toBe(false);
        expect(cap.selectedModalities).toEqual([]);
    });

    it("reports image support for an attached vision model", async () => {
        await attachWebVisionModel(["text", "image"]);
        const cap = onDeviceInferenceCapability();
        expect(cap.available).toBe(true);
        expect(cap.selectedModalities).toEqual(["text", "image"]);
        expect(cap.selectedModelId).toBe("smolvlm-256m-instruct-q8");
    });

    it("rejects a legacy non-WebGPU browser model in Android and never falls back to native IPC", async () => {
        enableLocalAndroidWebGpu();
        await attachWebVisionModel(["text", "image"]);

        await expect(
            inferOnDevice({ prompt: "read receipt", image: new Uint8Array([1, 2, 3]) }),
        ).resolves.toEqual({
            kind: "unavailable",
            reason: "no accelerated on-device model selected",
        });
        expect(mockInferenceRuntimeAvailable).not.toHaveBeenCalled();
        expect(mockListLocalModels).not.toHaveBeenCalled();
        expect(mockInfer).not.toHaveBeenCalled();
        expect(onDeviceInferenceCapability()).toEqual({
            available: false,
            runtimesSupported: ["transformers-webgpu"],
            selectedModelId: "smolvlm-256m-instruct-q8",
            selectedModalities: [],
        });
    });

    it("still reports text-only for a text model", async () => {
        const weights = new Uint8Array([1, 2, 3, 4]);
        const url = "https://host/models/qwen.gguf";
        webRuntime.cached = [{ url, bytes: weights }];
        await useWebModelFromUrl({
            id: "qwen2.5-0.5b-instruct-q4",
            name: "Qwen2.5 0.5B (instruct)",
            files: [{ url, sha256: await hashOf(weights), bytes: weights.length }],
            sizeBytes: weights.length,
            modalities: ["text"],
        });
        expect(onDeviceInferenceCapability().selectedModalities).toEqual(["text"]);
    });

    it("uses the loaded model's measured modalities over its catalog claim", async () => {
        webRuntime.imageSupported = false;
        await attachWebVisionModel(["text", "image"]);
        expect(onDeviceInferenceCapability().selectedModalities).toEqual(["text", "image"]);
        await webInfer({ prompt: "hi" });
        expect(onDeviceInferenceCapability().selectedModalities).toEqual(["text"]);
    });
});
