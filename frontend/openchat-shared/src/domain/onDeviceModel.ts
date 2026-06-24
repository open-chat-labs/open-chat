// On-device model manager + inference — a generic, bring-your-own-model capability.
//
// Nothing is bundled: the user browses a catalog, downloads/selects/removes models, and any in-client
// feature can run the selected model with its OWN prompt (text and/or image). Inference executes in the
// native client runtime; OpenChat has no opinion on a caller's prompt or how it parses the output.
//
// This module is the generic CONTRACT. The catalog is data (fetched from a configurable source); the
// runtime is pluggable (a catalog entry declares which native backend can load it); and the inference
// API is caller-driven. No model and no model-specific logic ships in OpenChat.

export type ModelModality = "text" | "image";

// Which native backend can load/run a given model. Pluggable — this is a named, extensible union so more
// backends can be added without changing the catalog or inference contract; a catalog entry declares its
// runtime so the client can match it against the backends the current build supports. Chosen runtime:
// llama.cpp via the `llama-cpp-2` crate, on BOTH desktop and mobile — Gemma 4 text+image via a GGUF model +
// an mmproj vision projector; it compiles uniformly into the Rust plugin (desktop MSVC, Android NDK, iOS
// XCFramework), so one runtime + one model format serves every platform.
export type ModelRuntime = "llama-cpp";

export interface ModelFile {
    // Publicly reachable download URL (the catalog is BYO-model — files are not hosted by OpenChat).
    url: string;
    // Hex-encoded SHA-256 of the file, verified after download.
    sha256: string;
    bytes: number;
}

// A catalog entry is pure data. Gemma-class multimodal models are example entries, not dependencies.
export interface ModelCatalogEntry {
    id: string;
    name: string;
    description?: string;
    modalities: ModelModality[];
    runtime: ModelRuntime;
    files: ModelFile[];
    // Shown to the user before download (e.g. a model's licence/terms they must accept).
    license: string;
    licenseUrl?: string;
    // Optional minimum client version required to run this model.
    minClientVersion?: string;
    // Total on-disk/download footprint, for display and storage budgeting.
    sizeBytes: number;
}

// A catalog is fetched from a configurable source (default: an OpenChat-hosted list). Versioned so the
// client can cache and detect updates.
export interface ModelCatalog {
    version: number;
    models: ModelCatalogEntry[];
}

export type ModelDownloadState =
    | { kind: "not_downloaded" }
    | { kind: "downloading"; receivedBytes: number; totalBytes: number }
    | { kind: "verifying" }
    | { kind: "downloaded"; sizeBytes: number }
    | { kind: "error"; message: string };

// The selected/installed state the manager persists.
export interface ManagedModel {
    entry: ModelCatalogEntry;
    download: ModelDownloadState;
}

// The generic inference request — the seam every in-client consumer calls through. The prompt is
// caller-supplied; OpenChat passes it (and any image/text) to the selected on-device model unchanged.
export interface InferenceRequest {
    // A model the user has downloaded and selected. If omitted, the manager's currently-selected model.
    modelId?: string;
    // CALLER-SUPPLIED prompt. OpenChat has no opinion on its content.
    prompt: string;
    // Optional image (e.g. extracted from a message) for vision-capable models.
    image?: Uint8Array;
    // Optional additional text context.
    text?: string;
    maxTokens?: number;
    // Best-effort: ask the runtime to constrain output to this JSON schema (not all runtimes support it).
    responseSchema?: object;
}

export type InferenceResult =
    | { kind: "ok"; text: string }
    // On-device inference is not available in this client (e.g. a plain web/PWA build with no native
    // runtime). Callers must degrade gracefully — there is no autonomous fallback.
    | { kind: "unavailable"; reason: string }
    | { kind: "error"; error: string };

// Capability descriptor the client reports so a consumer can decide whether to offer an AI action.
export interface OnDeviceInferenceCapability {
    // True only when a native runtime is present (native client) AND a compatible model is selected.
    available: boolean;
    runtimesSupported: ModelRuntime[];
    selectedModelId?: string;
    selectedModalities: ModelModality[];
}
