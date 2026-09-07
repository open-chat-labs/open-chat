import type { InferenceRequest, InferenceResult, ModelModality } from "@shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    infer as nativeInfer,
    inferenceRuntimeAvailable,
    listLocalModels,
} from "tauri-plugin-oc-api";
import {
    canInferOnDevice,
    inferOnDevice,
    inferOnDeviceTextOnlyNoProjector,
    onDeviceInferenceCapability,
    usesWebInferenceRuntime,
} from "./onDeviceInference";
import { ensureWebModelRestored, webInfer } from "./webInference";

const runtime = vi.hoisted(() => ({
    enabled: true,
    ready: true,
    compatible: true,
    modelId: "gemma-4-e2b-it-q4",
    modalities: ["text", "image"] as ModelModality[],
}));

vi.mock("tauri-plugin-oc-api", () => ({
    infer: vi.fn(),
    inferenceRuntimeAvailable: vi.fn(),
    listLocalModels: vi.fn(),
}));
vi.mock("./transformersWebGpuInference", () => ({
    transformersWebGpuClientEnabled: () => runtime.enabled,
    transformersWebGpuSelectionCanHandle: (modelId: string | undefined) =>
        runtime.enabled && runtime.compatible && modelId === runtime.modelId,
}));
vi.mock("./webInference", () => ({
    ensureWebModelRestored: vi.fn(),
    isWebInferenceReady: () => runtime.ready,
    webInfer: vi.fn(),
    webModelCatalogId: () => runtime.modelId,
    webModelLabel: () => "Selected model",
    webModelModalities: () => runtime.modalities,
}));

const mockRestore = vi.mocked(ensureWebModelRestored);
const mockWebInfer = vi.mocked(webInfer);

beforeEach(() => {
    vi.clearAllMocks();
    runtime.enabled = true;
    runtime.ready = true;
    runtime.compatible = true;
    runtime.modelId = "gemma-4-e2b-it-q4";
    runtime.modalities = ["text", "image"];
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    mockRestore.mockReset().mockResolvedValue(undefined);
    mockWebInfer.mockReset().mockResolvedValue({ kind: "ok", text: "model output" });
});

afterEach(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    expect(nativeInfer).not.toHaveBeenCalled();
    expect(inferenceRuntimeAvailable).not.toHaveBeenCalled();
    expect(listLocalModels).not.toHaveBeenCalled();
});

describe("explicit Android all-WebGPU routing", () => {
    it("reports the accelerated runtime and only the selected model's installed modalities", async () => {
        expect(usesWebInferenceRuntime()).toBe(true);
        await expect(canInferOnDevice()).resolves.toBe(true);
        expect(onDeviceInferenceCapability()).toEqual({
            available: true,
            runtimesSupported: ["transformers-webgpu"],
            selectedModelId: "gemma-4-e2b-it-q4",
            selectedModalities: ["text", "image"],
        });
        runtime.modalities = ["text", "image", "audio"];
        expect(onDeviceInferenceCapability().selectedModalities).toEqual([
            "text",
            "image",
            "audio",
        ]);
    });

    it.each([
        { prompt: "Describe this image", image: new Uint8Array([1, 2, 3]) },
        {
            prompt: "Transcribe this voice message",
            audio: new Uint8Array([4, 5, 6]),
            audioMimeType: "audio/webm",
        },
    ] satisfies InferenceRequest[])(
        "restores then forwards exact caller media without native IPC",
        async (request) => {
            let restored = false;
            mockRestore.mockImplementation(async () => {
                restored = true;
            });
            mockWebInfer.mockImplementation(async (received) => {
                expect(restored).toBe(true);
                expect(received).toBe(request);
                return { kind: "ok", text: "model output" };
            });
            await expect(inferOnDevice(request)).resolves.toEqual({
                kind: "ok",
                text: "model output",
            });
            expect(mockRestore).toHaveBeenCalledTimes(1);
            expect(mockWebInfer).toHaveBeenCalledExactlyOnceWith(request, {
                requireProjectorAbsent: false,
            });
        },
    );

    it("preserves the explicit projector-absent requirement for text-only verification", async () => {
        const request = { prompt: "Verify the supplied text" };
        await expect(inferOnDeviceTextOnlyNoProjector(request)).resolves.toEqual({
            kind: "ok",
            text: "model output",
        });
        expect(mockRestore).toHaveBeenCalledTimes(1);
        expect(mockWebInfer).toHaveBeenCalledExactlyOnceWith(request, {
            requireProjectorAbsent: true,
        });
        expect(mockWebInfer.mock.calls[0][0]).toBe(request);
    });

    it("rejects image input to the projector-free entry point before restoring or invoking a runtime", async () => {
        await expect(
            inferOnDeviceTextOnlyNoProjector({
                prompt: "Read this image",
                image: new Uint8Array([1, 2, 3]),
            }),
        ).resolves.toEqual({
            kind: "error",
            error: "projector-free inference accepts text only",
        });
        expect(mockRestore).not.toHaveBeenCalled();
        expect(mockWebInfer).not.toHaveBeenCalled();
    });

    it.each(["not ready", "incompatible"])(
        "does not use the native runtime when selection is %s",
        async (condition) => {
            runtime.ready = condition !== "not ready";
            runtime.compatible = condition !== "incompatible";
            await expect(canInferOnDevice()).resolves.toBe(false);
            expect(onDeviceInferenceCapability()).toMatchObject({
                available: false,
                runtimesSupported: ["transformers-webgpu"],
                selectedModalities: [],
            });
            await expect(inferOnDevice({ prompt: "Read this" })).resolves.toEqual({
                kind: "unavailable",
                reason: "no accelerated on-device model selected",
            });
            expect(mockWebInfer).not.toHaveBeenCalled();
        },
    );

    it("preserves WebGPU device-loss failures without retrying another runtime", async () => {
        const failure: InferenceResult = {
            kind: "error",
            error: "WebGPU device was lost during decoding",
        };
        mockWebInfer.mockResolvedValue(failure);
        await expect(inferOnDevice({ prompt: "Read this" })).resolves.toBe(failure);
        expect(mockWebInfer).toHaveBeenCalledTimes(1);
    });

    it("serializes requests and allows the next request after a reported failure", async () => {
        let finishFirst!: (result: InferenceResult) => void;
        mockWebInfer.mockImplementationOnce(
            () => new Promise<InferenceResult>((resolve) => (finishFirst = resolve)),
        );
        const first = inferOnDevice({ prompt: "first" });
        const second = inferOnDevice({ prompt: "second" });
        await vi.waitFor(() => expect(mockWebInfer).toHaveBeenCalledTimes(1));
        finishFirst({ kind: "error", error: "device retired" });
        await expect(first).resolves.toEqual({ kind: "error", error: "device retired" });
        await expect(second).resolves.toEqual({ kind: "ok", text: "model output" });
        expect(mockWebInfer.mock.calls.map(([request]) => request.prompt)).toEqual([
            "first",
            "second",
        ]);
    });

    it.each([
        { prompt: "Listen", audio: new Uint8Array([1]) },
        { prompt: "Listen", audioMimeType: "audio/webm" },
    ] satisfies InferenceRequest[])(
        "fails closed on audio when the legacy native runtime is selected",
        async (request) => {
            runtime.enabled = false;
            expect(usesWebInferenceRuntime()).toBe(false);
            await expect(inferOnDevice(request)).resolves.toEqual({
                kind: "unavailable",
                reason: "The selected native runtime does not support audio.",
            });
            expect(mockRestore).not.toHaveBeenCalled();
            expect(mockWebInfer).not.toHaveBeenCalled();
        },
    );
});
