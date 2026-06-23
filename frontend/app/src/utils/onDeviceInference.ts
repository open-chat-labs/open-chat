import type {
    InferenceRequest,
    InferenceResult,
    ModelRuntime,
    OnDeviceInferenceCapability,
} from "openchat-shared";
import { get } from "svelte/store";
import { infer as nativeInfer, listLocalModels } from "tauri-plugin-oc-api";
import { selectedModelId } from "../stores/onDeviceModels";

// Generic on-device inference facade (design deliverable A). This is the seam any in-client feature calls
// to run the user's selected model with its OWN prompt. It feature-detects the native runtime and degrades
// to "unavailable" in the plain web/PWA build — there is never an autonomous fallback.

// Native runtimes this build supports. Empty until a backend (MediaPipe/LiteRT or llama.cpp) is integrated
// into the Tauri plugin, at which point the facade starts reporting the capability as available.
const SUPPORTED_RUNTIMES: ModelRuntime[] = [];

function isNativeClient(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function inferOnDevice(request: InferenceRequest): Promise<InferenceResult> {
    if (!isNativeClient() || SUPPORTED_RUNTIMES.length === 0) {
        return { kind: "unavailable", reason: "on-device inference requires the native client" };
    }

    const modelId = request.modelId ?? get(selectedModelId);
    if (modelId === undefined || modelId === "") {
        return { kind: "unavailable", reason: "no on-device model selected" };
    }

    try {
        const local = (await listLocalModels()).find((m) => m.modelId === modelId);
        if (local === undefined) {
            return { kind: "unavailable", reason: "the selected model is not downloaded" };
        }

        const res = await nativeInfer({
            modelId,
            runtime: local.runtime,
            prompt: request.prompt,
            image: request.image !== undefined ? Array.from(request.image) : undefined,
            text: request.text,
            maxTokens: request.maxTokens,
        });
        return { kind: "ok", text: res.text };
    } catch (err) {
        return { kind: "error", error: err instanceof Error ? err.message : String(err) };
    }
}

export function onDeviceInferenceCapability(): OnDeviceInferenceCapability {
    const selected = get(selectedModelId);
    return {
        available: isNativeClient() && SUPPORTED_RUNTIMES.length > 0 && selected !== "",
        runtimesSupported: SUPPORTED_RUNTIMES,
        selectedModelId: selected === "" ? undefined : selected,
        selectedModalities: [],
    };
}
