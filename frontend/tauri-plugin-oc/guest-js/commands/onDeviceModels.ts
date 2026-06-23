import { invoke } from "@tauri-apps/api/core";

// Native bridge for the generic on-device model manager + inference (design deliverable A).
// These wrap the Rust `plugin:oc|*` commands. They only resolve in the native (Tauri) client; the app
// feature-detects the native runtime before calling them and degrades to "unavailable" otherwise.

export type ModelFileSpec = {
    url: string;
    sha256: string;
    bytes: number;
};

export type DownloadModelRequest = {
    modelId: string;
    runtime: string;
    files: ModelFileSpec[];
};

export type LocalModel = {
    modelId: string;
    runtime: string;
    sizeBytes: number;
    path: string;
};

export type InferRequest = {
    modelId: string;
    runtime: string;
    prompt: string;
    // Raw image bytes for vision-capable models (serialised as a byte array over the Tauri IPC).
    image?: number[];
    text?: string;
    maxTokens?: number;
};

export type InferResponse = {
    text: string;
};

// Download (and verify) a model's files into the app's local model store. Idempotent per modelId.
export async function downloadModel(payload: DownloadModelRequest): Promise<void> {
    return await invoke<void>("plugin:oc|download_model", { payload });
}

export async function listLocalModels(): Promise<LocalModel[]> {
    return await invoke<LocalModel[]>("plugin:oc|list_local_models");
}

export async function deleteModel(modelId: string): Promise<void> {
    return await invoke<void>("plugin:oc|delete_model", { payload: { modelId } });
}

// Run the selected on-device model with a caller-supplied prompt. The native side loads the model into
// the matching runtime and returns the generated text.
export async function infer(payload: InferRequest): Promise<InferResponse> {
    return await invoke<InferResponse>("plugin:oc|infer", { payload });
}
