import type {
    InferenceRequest,
    InferenceResult,
    ModelRuntime,
    OnDeviceInferenceCapability,
} from "openchat-shared";
import { get } from "svelte/store";
import { infer as nativeInfer, listLocalModels } from "tauri-plugin-oc-api";
import { selectedModelId } from "../stores/onDeviceModels";
import { defaultModelCatalog } from "./modelCatalog";
import { isWebInferenceReady, webInfer, webModelLabel, webModelModalities } from "./webInference";

// Generic on-device inference facade (design deliverable A). This is the seam any in-client feature calls
// to run the user's selected model with its OWN prompt. It feature-detects the native runtime and degrades
// to "unavailable" in the plain web/PWA build — there is never an autonomous fallback.

// Native runtimes this build supports. The Tauri plugin integrates llama.cpp (via llama-cpp-2, the
// `inference` cargo feature) on every platform, so the facade reports the capability as available once a
// matching model is downloaded and selected.
const SUPPORTED_RUNTIMES: ModelRuntime[] = ["llama-cpp"];
const MAX_PROMPT_BYTES = 64 * 1024;
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_SCHEMA_BYTES = 64 * 1024;
const MAX_OUTPUT_TOKENS = 4096;
const encodedLength = (value: string): number => new TextEncoder().encode(value).byteLength;

// On-device inference runs wherever the Tauri native bridge is present (Android, iOS and desktop) — not
// just the mobile OS targets that `OpenChat.isNativeApp()` reports. Detect the bridge directly so the UI
// and this facade agree, and the plain web/PWA build (no bridge) degrades to "unavailable".
export function isNativeClient(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Can THIS client run an on-device inference right now — natively (Tauri + llama.cpp) or in the
// BROWSER (llama.cpp-WASM over a GGUF the user attached from disk; see webInference.ts)? This is
// the gate propose flows should use: a browser with a model attached runs the model exactly like
// the native app, and only clients with NEITHER degrade to the manual-extraction fallback.
export function canInferOnDevice(): boolean {
    return isNativeClient() || isWebInferenceReady();
}

// The native llama.cpp backend is a single process-global (`LlamaBackend::init()` at the top of every
// inference) that is NOT re-entrant: two overlapping calls make the second fail with
// "BackendAlreadyInitialized", and each call also reloads the whole model. Several independent callers
// exist (AI-action extraction, the /ai command, …), so funnel every inference through one queue — at
// most one runs at a time; the rest await their turn. Failures don't break the chain.
let inferenceQueue: Promise<unknown> = Promise.resolve();

export function inferOnDevice(request: InferenceRequest): Promise<InferenceResult> {
    const run = inferenceQueue.then(() => runInference(request));
    inferenceQueue = run.catch(() => undefined);
    return run;
}

async function runInference(request: InferenceRequest): Promise<InferenceResult> {
    if (!isNativeClient() || SUPPORTED_RUNTIMES.length === 0) {
        // Browser path: a GGUF (from disk or the catalog) runs via llama.cpp-WASM — text, and images
        // too when the attached model has a vision projector. A browser with no model attached still
        // degrades to "unavailable" exactly as before.
        if (isWebInferenceReady()) {
            return webInfer(request);
        }
        return { kind: "unavailable", reason: "on-device inference requires the native client" };
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
        const local = (await listLocalModels()).find((m) => m.modelId === modelId);
        if (local === undefined) {
            return { kind: "unavailable", reason: "the selected model is not downloaded" };
        }
        if (local.runtime !== catalogEntry.runtime || local.sizeBytes !== catalogEntry.sizeBytes) {
            return {
                kind: "error",
                error: "installed model metadata does not match the trusted catalog",
            };
        }
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
    if (!isNativeClient() && isWebInferenceReady()) {
        // Browser model: ask the model what it can read. This used to be hardcoded to ["text"], which
        // made every browser look image-blind no matter what was attached — the UI gate downstream
        // (imageUnsupportedReason) reads nothing else, so the hardcode WAS the ban on browser vision.
        return {
            available: true,
            runtimesSupported: ["llama-cpp"],
            selectedModelId: webModelLabel(),
            selectedModalities: webModelModalities(),
        };
    }
    return {
        available:
            isNativeClient() && entry !== undefined && SUPPORTED_RUNTIMES.includes(entry.runtime),
        runtimesSupported: SUPPORTED_RUNTIMES,
        selectedModelId: selected === "" ? undefined : selected,
        selectedModalities: entry?.modalities ?? [],
    };
}
