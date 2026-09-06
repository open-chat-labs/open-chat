// On-device model manager + inference — a generic, bring-your-own-model capability.
//
// The user downloads/selects/removes model weights. Enabled builds package the compatible runtime,
// supporting graphs and notices; weights remain separately downloaded and verified. Any in-client
// feature supplies its OWN prompt and optional media and owns parsing the model's output.
//
// This module is the generic CONTRACT. The catalog is data (fetched from a configurable source); the
// runtime is pluggable (native llama.cpp or the explicitly enabled all-WebGPU runtime), and the
// inference API is caller-driven. Runtime/model compatibility code is generic, not app-domain logic.

export type ModelModality = "text" | "image" | "audio";

// A build matches a model to its supported runtime and artifact format. Native llama.cpp uses GGUF
// and optional projectors; explicitly enabled browser/Android acceleration uses pinned ONNX graphs
// with Transformers.js. Selecting all-WebGPU does not enable an automatic CPU/native fallback.
export type ModelRuntime = "llama-cpp" | "transformers-webgpu";

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
// caller-supplied; OpenChat passes it (and any image/audio/text) to the selected on-device model
// unchanged. Media bytes remain optional because a runtime may support only a subset of modalities.
export interface InferenceRequest {
    // A model the user has downloaded and selected. If omitted, the manager's currently-selected model.
    modelId?: string;
    // CALLER-SUPPLIED prompt. OpenChat has no opinion on its content.
    prompt: string;
    // Optional image (e.g. extracted from a message) for vision-capable models.
    image?: Uint8Array;
    // Optional encoded audio (e.g. an OpenChat voice message) for audio-capable models. The MIME
    // type describes these exact bytes; callers must provide both fields together.
    audio?: Uint8Array;
    audioMimeType?: string;
    // Optional additional text context.
    text?: string;
    maxTokens?: number;
    // Best-effort: ask the runtime to constrain output to this JSON schema (not all runtimes support it).
    responseSchema?: object;
}

export type InferenceResult =
    | { kind: "ok"; text: string }
    // A compatible runtime/model is not ready in this client. The caller receives the reason and
    // owns the next interaction; there is no automatic fallback to another runtime or provider.
    | { kind: "unavailable"; reason: string }
    | { kind: "error"; error: string };

// Capability descriptor the client reports so a consumer can decide whether to offer an AI action.
export interface OnDeviceInferenceCapability {
    // Whether the selected runtime/model reports ready in this client; execution can still fail.
    available: boolean;
    runtimesSupported: ModelRuntime[];
    selectedModelId?: string;
    selectedModalities: ModelModality[];
}
