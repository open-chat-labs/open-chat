import type {
    InferenceRequest,
    InferenceResult,
    ModelRuntime,
    OnDeviceInferenceCapability,
} from "@shared";
import { get } from "svelte/store";
import {
    infer as nativeInfer,
    inferenceRuntimeAvailable,
    listLocalModels,
} from "tauri-plugin-oc-api";
import { selectedModelId } from "../stores/onDeviceModels";
import {
    defaultModelCatalog,
    nativeModelInstallStatus,
    selectedNativeModelStatus,
} from "./modelCatalog";
import {
    ensureWebModelRestored,
    isWebInferenceReady,
    webInfer,
    webModelCatalogId,
    webModelLabel,
    webModelModalities,
} from "./webInference";
import {
    transformersWebGpuClientEnabled,
    transformersWebGpuSelectionCanHandle,
} from "./transformersWebGpuInference";

// Generic on-device inference facade: callers supply their own prompt/media and parse their own output.
// It routes to the selected browser runtime or native bridge. Explicit all-WebGPU selection stays on
// that runtime; unavailable capability and execution failures never trigger a CPU/provider fallback.

// Native bridge runtimes supported by the catalog contract. Availability also depends on the built
// Tauri plugin and compatible downloaded artifacts; explicitly enabled Android WebGPU bypasses IPC.
const SUPPORTED_RUNTIMES: ModelRuntime[] = ["llama-cpp"];
const MAX_PROMPT_BYTES = 64 * 1024;
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_SCHEMA_BYTES = 64 * 1024;
const MAX_OUTPUT_TOKENS = 4096;
export const NATIVE_INFERENCE_UPDATE_REQUIRED =
    "This OpenChat build does not include on-device inference. Update or reinstall OpenChat, then try again.";
export const NATIVE_MODEL_UPDATE_REQUIRED =
    "The selected on-device model has an update required. Open On-device models and update it before trying again.";
const encodedLength = (value: string): number => new TextEncoder().encode(value).byteLength;
let lastNativeInferenceRuntimeAvailable: boolean | undefined;
let lastNativeReadyModelId: string | undefined;

// Detect the Tauri bridge directly on mobile and desktop. Browser inference does not require it;
// explicitly enabled Android all-WebGPU also uses the browser runtime despite the bridge's presence.
export function isNativeClient(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Browser builds use the web runtime as before. A deliberately feature-flagged Android WebView also
 * uses it, so Qwen embeddings, vision and decoding all stay on WebGPU instead of entering llama.cpp.
 * Other native clients keep the existing native-runtime route.
 */
export function usesWebInferenceRuntime(): boolean {
    return !isNativeClient() || transformersWebGpuClientEnabled();
}

function webInferenceReadyForClient(): boolean {
    return (
        isWebInferenceReady() &&
        (!isNativeClient() || transformersWebGpuSelectionCanHandle(webModelCatalogId()))
    );
}

// Reports current selected-runtime readiness for callers. The browser facade supports an explicitly
// selected legacy GGUF runtime or enabled all-WebGPU; this check does not switch between them.
async function probeNativeInferenceRuntime(): Promise<boolean> {
    let available = false;
    try {
        available = await inferenceRuntimeAvailable();
    } catch {
        // A shell without the command predates the capability contract and must fail closed.
    }
    lastNativeInferenceRuntimeAvailable = available;
    return available;
}

export type OnDeviceInferenceReadiness = {
    available: boolean;
    reason?: string;
};

// Unlike the old synchronous bridge check, this asks the exact native binary whether its optional
// runtime exists. Model callers await it, so an old/dev shell cannot advertise inference
// during the gap before the actual infer command runs.
export async function onDeviceInferenceReadiness(): Promise<OnDeviceInferenceReadiness> {
    if (usesWebInferenceRuntime()) {
        await ensureWebModelRestored();
        const ready = webInferenceReadyForClient();
        return {
            available: ready,
            ...(isNativeClient() && !ready
                ? { reason: "no accelerated on-device model selected" }
                : {}),
        };
    }
    if (isNativeClient()) {
        lastNativeReadyModelId = undefined;
        if (!(await probeNativeInferenceRuntime())) {
            return { available: false, reason: NATIVE_INFERENCE_UPDATE_REQUIRED };
        }
        try {
            const selected = selectedNativeModelStatus(
                get(selectedModelId),
                await listLocalModels(),
            );
            if (selected.kind === "none") {
                return { available: false, reason: "no on-device model selected" };
            }
            if (selected.kind === "untrusted") {
                return {
                    available: false,
                    reason: "the selected model is not in the trusted catalog",
                };
            }
            if (selected.kind === "missing") {
                return { available: false, reason: "the selected model is not downloaded" };
            }
            if (selected.kind === "update_required") {
                return { available: false, reason: NATIVE_MODEL_UPDATE_REQUIRED };
            }
            lastNativeReadyModelId = selected.entry.id;
            return { available: true };
        } catch {
            return { available: false, reason: "could not read installed on-device models" };
        }
    }
    return { available: false };
}

export async function canInferOnDevice(): Promise<boolean> {
    return (await onDeviceInferenceReadiness()).available;
}

// The native llama.cpp backend is a single process-global (`LlamaBackend::init()` at the top of every
// inference) that is NOT re-entrant: two overlapping calls make the second fail with
// "BackendAlreadyInitialized", and each call also reloads the whole model. Several independent callers
// exist (message commands and other in-client consumers), so funnel every inference through one queue — at
// most one runs at a time; the rest await their turn. Failures don't break the chain.
let inferenceQueue: Promise<unknown> = Promise.resolve();

export function inferOnDevice(request: InferenceRequest): Promise<InferenceResult> {
    const run = inferenceQueue.then(() => runInference(request));
    inferenceQueue = run.catch(() => undefined);
    return run;
}

async function runInference(request: InferenceRequest): Promise<InferenceResult> {
    if (usesWebInferenceRuntime() || SUPPORTED_RUNTIMES.length === 0) {
        // Restore the persisted selection before checking it. webInfer owns runtime-specific media
        // handling and returns explicit errors/unavailability without selecting a replacement model.
        await ensureWebModelRestored();
        if (webInferenceReadyForClient()) {
            return webInfer(request);
        }
        return {
            kind: "unavailable",
            reason: isNativeClient()
                ? "no accelerated on-device model selected"
                : "on-device inference requires the native client",
        };
    }

    if (request.audio !== undefined || request.audioMimeType !== undefined) {
        return {
            kind: "unavailable",
            reason: "The selected native runtime does not support audio.",
        };
    }

    // A native bridge proves only that this is a Tauri shell, not that its optional llama.cpp feature
    // was compiled in. Probe before reading model metadata so old/dev shells fail with an actionable
    // update message and never enter an inference command they cannot execute. A missing command means
    // the shell predates this probe and therefore also needs an update.
    if (!(await probeNativeInferenceRuntime())) {
        return { kind: "unavailable", reason: NATIVE_INFERENCE_UPDATE_REQUIRED };
    }

    const modelId = request.modelId ?? get(selectedModelId);
    if (modelId === undefined || modelId === "") {
        return { kind: "unavailable", reason: "no on-device model selected" };
    }
    const catalogEntry = defaultModelCatalog.models.find((model) => model.id === modelId);
    if (catalogEntry === undefined || !SUPPORTED_RUNTIMES.includes(catalogEntry.runtime)) {
        return { kind: "unavailable", reason: "the selected model is not in the trusted catalog" };
    }
    if (
        request.prompt.length === 0 ||
        encodedLength(request.prompt) > MAX_PROMPT_BYTES ||
        (request.text !== undefined && encodedLength(request.text) > MAX_TEXT_BYTES) ||
        (request.image !== undefined && request.image.byteLength > MAX_IMAGE_BYTES) ||
        (request.maxTokens !== undefined &&
            (request.maxTokens < 1 ||
                request.maxTokens > MAX_OUTPUT_TOKENS ||
                !Number.isInteger(request.maxTokens)))
    ) {
        return { kind: "error", error: "inference request exceeds native safety limits" };
    }
    let responseSchema: string | undefined;
    try {
        responseSchema =
            request.responseSchema === undefined
                ? undefined
                : JSON.stringify(request.responseSchema);
    } catch {
        return { kind: "error", error: "response schema is not serializable" };
    }
    if (responseSchema !== undefined && encodedLength(responseSchema) > MAX_SCHEMA_BYTES) {
        return { kind: "error", error: "inference request exceeds native safety limits" };
    }

    try {
        const localModels = await listLocalModels();
        const installStatus = nativeModelInstallStatus(catalogEntry, localModels);
        if (installStatus === "missing") {
            return { kind: "unavailable", reason: "the selected model is not downloaded" };
        }
        if (installStatus === "update_required") {
            return {
                kind: "unavailable",
                reason: NATIVE_MODEL_UPDATE_REQUIRED,
            };
        }
        const local = localModels.find((model) => model.modelId === modelId)!;
        const res = await nativeInfer({
            modelId,
            runtime: local.runtime,
            prompt: request.prompt,
            image: request.image !== undefined ? Array.from(request.image) : undefined,
            text: request.text,
            maxTokens: request.maxTokens,
            responseSchema,
        });
        return { kind: "ok", text: res.text };
    } catch (err) {
        return { kind: "error", error: err instanceof Error ? err.message : String(err) };
    }
}

export function onDeviceInferenceCapability(): OnDeviceInferenceCapability {
    const selected = get(selectedModelId);
    // Modalities come from the catalog entry for the selected model (the native store doesn't track them).
    const entry = defaultModelCatalog.models.find((m) => m.id === selected);
    if (usesWebInferenceRuntime()) {
        const runtime: ModelRuntime = transformersWebGpuClientEnabled()
            ? "transformers-webgpu"
            : "llama-cpp";
        if (webInferenceReadyForClient()) {
            // Browser/Android-WebView model: ask the selected runtime what it can read. The explicit
            // runtime identity prevents the APK from advertising llama.cpp while Qwen is on WebGPU.
            return {
                available: true,
                runtimesSupported: [runtime],
                selectedModelId: webModelCatalogId() ?? webModelLabel(),
                selectedModalities: webModelModalities(),
            };
        }
        if (transformersWebGpuClientEnabled()) {
            return {
                available: false,
                runtimesSupported: [runtime],
                selectedModelId: webModelCatalogId() ?? webModelLabel(),
                selectedModalities: [],
            };
        }
    }
    return {
        available:
            isNativeClient() &&
            lastNativeInferenceRuntimeAvailable === true &&
            lastNativeReadyModelId === selected &&
            entry !== undefined &&
            SUPPORTED_RUNTIMES.includes(entry.runtime),
        runtimesSupported: SUPPORTED_RUNTIMES,
        selectedModelId: selected === "" ? undefined : selected,
        selectedModalities: entry?.modalities ?? [],
    };
}
