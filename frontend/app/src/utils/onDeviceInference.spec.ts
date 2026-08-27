import type { InferenceRequest } from "@shared";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InferResponse, LocalModel } from "tauri-plugin-oc-api";
import { infer as nativeInfer, listLocalModels } from "tauri-plugin-oc-api";
import { selectedModelId } from "../stores/onDeviceModels";
import { inferOnDevice, isNativeClient, onDeviceInferenceCapability } from "./onDeviceInference";
import { clearWebModel, useWebModelFromUrl, webInfer } from "./webInference";

const webRuntime = vi.hoisted(() => ({
    imageSupported: true,
    cached: [] as { url: string; bytes: Uint8Array }[],
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
    listLocalModels: vi.fn(),
}));

const mockInfer = vi.mocked(nativeInfer);
const mockListLocalModels = vi.mocked(listLocalModels);

const MODEL_ID = "gemma-4-e2b-it-q4";

function setNative(native: boolean): void {
    if (native) {
        (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    } else {
        delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    }
}

function localModel(overrides: Partial<LocalModel> = {}): LocalModel {
    return {
        modelId: MODEL_ID,
        runtime: "llama-cpp",
        sizeBytes: 4092392352,
        path: "/models/gemma-4-e2b-it-q4",
        ...overrides,
    };
}

beforeEach(() => {
    mockInfer.mockReset();
    mockListLocalModels.mockReset();
    // Default: no model downloaded and none selected — each test opts into what it needs.
    mockListLocalModels.mockResolvedValue([]);
    selectedModelId.set("");
    setNative(false);
    webRuntime.cached = [];
});

afterEach(() => {
    setNative(false);
    selectedModelId.set("");
});

describe("isNativeClient", () => {
    it("is false without the Tauri bridge, true with it", () => {
        setNative(false);
        expect(isNativeClient()).toBe(false);
        setNative(true);
        expect(isNativeClient()).toBe(true);
    });
});

describe("inferOnDevice — unavailable branches", () => {
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
    it("is available when native AND a model is selected, and reports catalog modalities", () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);

        const cap = onDeviceInferenceCapability();

        expect(cap.available).toBe(true);
        expect(cap.runtimesSupported).toEqual(["llama-cpp"]);
        expect(cap.selectedModelId).toBe(MODEL_ID);
        // Modalities come from the catalog entry for the selected model.
        expect(cap.selectedModalities).toEqual(["text", "image"]);
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

    it("rejects installed metadata that disagrees with the trusted catalog", async () => {
        setNative(true);
        selectedModelId.set(MODEL_ID);
        mockListLocalModels.mockResolvedValue([localModel({ sizeBytes: 1 })]);

        await expect(inferOnDevice({ prompt: "hi" })).resolves.toEqual({
            kind: "error",
            error: "installed model metadata does not match the trusted catalog",
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
