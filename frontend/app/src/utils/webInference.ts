import { currentWebGpuModelCatalog, subscribeWebGpuModelCatalog } from "./webGpuModelCatalog";
// BROWSER on-device inference — the web half of the onDeviceInference facade.
//
// llama.cpp compiled to WASM (@wllama/wllama) runs a GGUF that the user picks from a NORMAL DISK
// LOCATION, or one downloaded from the catalog into browser storage. A disk file is read in place as
// a Blob (file input or the File System Access API) — nothing is uploaded anywhere and nothing is
// copied; the same folder the native app uses works. Multithreaded when the page is crossOriginIsolated
// (COOP/COEP headers on the dev server), single-thread otherwise.
//
// TEXT AND IMAGES. wllama has carried llama.cpp's multimodal stack since 3.0.0 (it runs llama-server's
// server-context, not a bespoke reimplementation), so a vision model here means what it means natively:
// weights + an mmproj projector, `{type:"image", data}` in the message content, and one media marker
// spliced into the prompt. What kept images out was three gates in OUR code, not the platform — this
// file held the last of them.
//
// Persistence: a FileSystemFileHandle (when the picker was used) is stored in IndexedDB so the model
// re-attaches across sessions without re-picking; a plain <input type=file> File lasts for the
// session only (there is no handle to persist) but is fully automatable in tests.

import type { InferenceRequest, InferenceResult, ModelFile, ModelModality } from "@shared";
import { sha256 } from "@noble/hashes/sha2.js";
import { writable } from "svelte/store";
import { resolveTransformersWebGpuMaxOutputTokens } from "../stores/transformersWebGpuSettings";
import { splitModelFiles, WEB_MODEL_MAX_BYTES } from "./modelCatalog";
import {
    transformersWebGpuModelSpec,
    type TransformersWebGpuModelId,
} from "./transformersWebGpuProtocol";
import {
    disposeTransformersWebGpuInference,
    deleteTransformersWebGpuModel,
    invalidateTransformersWebGpuReadiness,
    preloadTransformersWebGpuModel,
    refreshTransformersWebGpuRuntimeAssets,
    subscribeTransformersWebGpuStatus,
    transformersWebGpuAudioDownloaded,
    transformersWebGpuAudioReady,
    transformersWebGpuInfer,
    transformersWebGpuModelArtifactsDownloaded,
    transformersWebGpuModelArtifactsPresent,
    transformersWebGpuModelDownloaded,
    transformersWebGpuModelNotDownloadedMessage,
    transformersWebGpuSelectionCanHandle,
    transformersWebGpuSpikeCanHandle,
    transformersWebGpuRuntimeAvailableOffline,
    transformersWebGpuRuntimeAvailability,
    type TransformersWebGpuStatus,
} from "./transformersWebGpuInference";
import type { BrowserModelImageEvidence } from "./imageSemanticDuplicateGuard";

// Vite turns this into a served asset URL. wllama 3.x ships ONE unified wasm (esm/wasm/) and picks
// thread count itself from crossOriginIsolated + hardware concurrency.
import wllamaWasm from "@wllama/wllama/esm/wasm/wllama.wasm?url";

// How many tokens a single image may become. This is a CRASH GUARD, not a quality knob.
//
// Dynamic-resolution VLMs (Qwen3-VL and friends) turn more pixels into more patches, and past a
// threshold llama.cpp's WebGPU backend aborts inside the vision encoder — the whole wasm module dies
// with an emscripten `abort()`, which reached the user as the uninterpretable "Action failed:
// (ABORT)". The stack is unambiguous:
//     ggml_abort <- ggml_backend_webgpu_wait_queue <- ggml_backend_webgpu_synchronize
//                <- clip_image_batch_encode <- mtmd_encode_impl
// so it is the IMAGE ENCODE that fails, not the language model and not the context window.
//
// Measured on this machine (Chrome 150, Qwen3-VL 2B, a 12 MP photo of a receipt):
//     768 -> good accuracy with acceptable latency on typical documents
//    1024 -> ok, 22.4s, same answers
//    2048 -> ABORT
//    3072 -> ABORT
// 768 sits at less than half the observed threshold — headroom for a slower GPU or a different
// driver — is the fastest of the working values, and lost no accuracy even on the small print. The
// cap is why a phone-camera photo works at all: without it, anything past ~1500x2000 killed the
// runtime. Note `n_gpu_layers: 0` does NOT help; that governs the language model, while the vision
// encoder picks its own backend.
//
// Harmless to fixed-resolution models (SmolVLM tiles at a fixed size, so its token count does not
// track pixels — measured identical with and without the cap).
const WEB_IMAGE_MAX_TOKENS = 768;

const IDB_NAME = "openchat_web_model";
const IDB_STORE = "handles";
const IDB_KEY = "model_file_handle";

// Chosen catalog model (downloaded into the BROWSER cache by wllama's ModelManager, re-attached
// instantly on later visits). Distinct from the pick-a-file-from-disk path below.
const LS_URL_MODEL = "openchat_web_model_url";

type PersistedCatalogModel = {
    id: string;
    name: string;
    url: string;
    mmprojUrl?: string;
    modalities?: ModelModality[];
    files: ModelFile[];
    sizeBytes: number;
};

type PersistedTransformersWebGpuModel = {
    runtime: "transformers-webgpu";
    id: TransformersWebGpuModelId;
    name: string;
};

type WebModelState = {
    file?: File;
    handle?: FileSystemFileHandle;
    /** Catalog source: downloaded + cached in browser storage via wllama's ModelManager. */
    url?: string;
    /** Vision projector for `url`, when the catalog entry has one. Downloaded and cached alongside
     *  the weights, and handed to wllama as ModelSource.mmprojUrl. */
    mmprojUrl?: string;
    /** Immutable catalog integrity manifest. Required for every URL-backed model. */
    catalogFiles?: ModelFile[];
    /** True only after the current browser-cache contents matched `catalogFiles`. Restores start false. */
    catalogVerified?: boolean;
    /** Catalog entry id when the model came from the catalog (lets the chooser mark it "Current");
     *  undefined for disk-picked files, which have no catalog row. */
    id?: string;
    name?: string;
    /** What the CATALOG claims this model can read. A claim, not a measurement — superseded by
     *  `imageSupported` the moment the model is actually loaded. Absent for disk-picked files. */
    declaredModalities?: ModelModality[];
    /** What the LOADED model actually reports (wllama's supportInputModality). undefined until the
     *  weights are in wasm memory. */
    imageSupported?: boolean;
    status: "none" | "attached" | "downloading" | "verifying" | "loading" | "loaded" | "error";
    error?: string;
    progress?: { received: number; total: number };
    /** Ephemeral all-WebGPU engine progress. Prompt, image and generated content are never exposed. */
    generation?: {
        stage: "text" | "image" | "audio";
        phase: "loading" | "downloading" | "inference";
        progress?: number;
        file?: string;
    };
};

const state: WebModelState = { status: "none" };
let modelSelectionGeneration = 0;
const CATALOG_DOWNLOAD_STALL_MS = 90_000;

type CatalogModelSelection = {
    id: string;
    name: string;
    files: ModelFile[];
    sizeBytes: number;
    modalities?: ModelModality[];
};

type CatalogDownloadAttempt = {
    controller: AbortController;
    generation: number;
    selectionGeneration: number;
    previous: WebModelState;
    reason?: "cancelled" | "backgrounded" | "stalled";
    done: Promise<void>;
    resolveDone(): void;
};

let activeCatalogDownload: CatalogDownloadAttempt | undefined;
let catalogDownloadGeneration = 0;
let nextImageInferenceRequestId = 0;
const imageEvidenceByResult = new WeakMap<InferenceResult, BrowserModelImageEvidence>();

function sha256BytesHex(bytes: Uint8Array): string {
    return Array.from(sha256(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function webImageInferenceEvidence(
    result: InferenceResult,
): BrowserModelImageEvidence | undefined {
    return imageEvidenceByResult.get(result);
}

function attachImageInferenceEvidence(
    request: InferenceRequest,
    selectedModelId: string | undefined,
    result: InferenceResult,
): InferenceResult {
    if (request.image === undefined || result.kind !== "ok") return result;
    imageEvidenceByResult.set(result, {
        requestId: ++nextImageInferenceRequestId,
        selectionGeneration: modelSelectionGeneration,
        selectedModelId,
        structuredJsonAction: request.responseMode === "json",
        effectiveImageSha256: sha256BytesHex(request.image),
    });
    return result;
}

/** UI-facing snapshot: the attached model's catalog id + name + lifecycle status (+ download progress). */
export const webModelStatus = writable<{
    id?: string;
    name?: string;
    status: WebModelState["status"];
    error?: string;
    progress?: { received: number; total: number };
    generation?: WebModelState["generation"];
}>({ status: "none" });

export type WebModelInstallState = "checking" | "downloaded" | "not_downloaded";

/** Per-model CacheStorage presence for Model Manager. This is deliberately independent from the
 * one active model in `webModelStatus`: choosing Gemma must not make cached Qwen look absent (or
 * vice versa). A downloaded hint never authorizes inference; activation still performs the full
 * pinned body verification. */
export const webModelInstallStatus = writable<Readonly<Record<string, WebModelInstallState>>>({});
let webModelInstallStates: Record<string, WebModelInstallState> = {};
const webModelInstallGenerations = new Map<string, number>();

subscribeWebGpuModelCatalog(() => {
    // A download must not finish by activating metadata from a superseded catalog snapshot.
    cancelWebModelDownload();
    const spec = transformersWebGpuModelSpec(state.id);
    if (spec !== undefined) {
        state.name = spec.name;
        state.declaredModalities = [...spec.modalities];
        state.imageSupported = spec.modalities.includes("image");
        publish();
    }
    void refreshWebModelInstallStatus(currentWebGpuModelCatalog().models.map((m) => m.id)).catch(
        () => {
            /* Inference still requires a full verification before execution. */
        },
    );
});

function nextWebModelInstallGeneration(modelId: string): number {
    const generation = (webModelInstallGenerations.get(modelId) ?? 0) + 1;
    webModelInstallGenerations.set(modelId, generation);
    return generation;
}

function setWebModelInstallState(modelId: string, status: WebModelInstallState): void {
    nextWebModelInstallGeneration(modelId);
    webModelInstallStates = { ...webModelInstallStates, [modelId]: status };
    webModelInstallStatus.set(webModelInstallStates);
}

/** Refresh cheap per-model installed hints without reading multi-gigabyte cache bodies. */
export async function refreshWebModelInstallStatus(modelIds: readonly string[]): Promise<void> {
    const ids = [...new Set(modelIds)].filter(
        (id) => transformersWebGpuModelSpec(id) !== undefined,
    );
    const generations = new Map(ids.map((id) => [id, nextWebModelInstallGeneration(id)]));
    webModelInstallStates = {
        ...webModelInstallStates,
        ...Object.fromEntries(ids.map((id) => [id, "checking" as const])),
    };
    webModelInstallStatus.set(webModelInstallStates);
    const results = await Promise.all(
        ids.map(async (id) => ({
            id,
            downloaded: await transformersWebGpuModelArtifactsPresent(id),
        })),
    );
    const current = results.filter(
        ({ id }) => webModelInstallGenerations.get(id) === generations.get(id),
    );
    if (current.length === 0) return;
    webModelInstallStates = {
        ...webModelInstallStates,
        ...Object.fromEntries(
            current.map(({ id, downloaded }) => [
                id,
                downloaded ? ("downloaded" as const) : ("not_downloaded" as const),
            ]),
        ),
    };
    webModelInstallStatus.set(webModelInstallStates);
}

function publish(): void {
    webModelStatus.set({
        id: state.id,
        name: state.name,
        status: state.status,
        error: state.error,
        progress: state.progress,
        generation: state.generation,
    });
}

subscribeTransformersWebGpuStatus((status: TransformersWebGpuStatus) => {
    state.generation =
        status.phase === "idle"
            ? undefined
            : {
                  stage: status.stage ?? "image",
                  phase: status.phase,
                  progress: status.progress,
                  file: status.file,
              };
    publish();
});

/** Exact allow-list shared by both browser Model Manager surfaces. Only models with immutable
 * registry entries and an enabled all-WebGPU runtime can enter this path. */
export function allWebGpuCatalogModelSupported(modelId: string): boolean {
    return (
        transformersWebGpuModelSpec(modelId) !== undefined &&
        transformersWebGpuSelectionCanHandle(modelId)
    );
}

function cloneWebModelState(value: WebModelState): WebModelState {
    return {
        ...value,
        catalogFiles: value.catalogFiles?.map((file) => ({ ...file })),
        declaredModalities: value.declaredModalities?.slice(),
        progress: value.progress === undefined ? undefined : { ...value.progress },
        generation: value.generation === undefined ? undefined : { ...value.generation },
    };
}

function restoreState(snapshot: WebModelState): void {
    for (const key of Object.keys(state) as (keyof WebModelState)[]) {
        delete state[key];
    }
    Object.assign(state, cloneWebModelState(snapshot));
}

function stopCatalogDownload(
    attempt: CatalogDownloadAttempt,
    reason: CatalogDownloadAttempt["reason"],
): void {
    if (attempt.controller.signal.aborted) return;
    attempt.reason = reason;
    attempt.controller.abort(new DOMException(reason ?? "cancelled", "AbortError"));
}

/** Cancel only the currently owned preload attempt. A late completion cannot replace the selection. */
export function cancelWebModelDownload(): void {
    if (activeCatalogDownload !== undefined) {
        stopCatalogDownload(activeCatalogDownload, "cancelled");
    }
}

function catalogDownloadFailure(attempt: CatalogDownloadAttempt, error: unknown): string {
    switch (attempt.reason) {
        case "cancelled":
            return "Download cancelled. Tap Retry download when you are ready.";
        case "backgrounded":
            return "Download stopped when OpenChat went to the background. Keep it open and tap Retry download.";
        case "stalled":
            return "The download stopped making progress. Check the connection and tap Retry download.";
        default:
            return error instanceof Error ? error.message : String(error);
    }
}

// ── IndexedDB persistence for the picker handle (structured-cloneable) ─────────────────────────
function idb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function idbPut(value: unknown): Promise<void> {
    const db = await idb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(value, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
async function idbGet<T>(): Promise<T | undefined> {
    const db = await idb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}
async function idbDelete(): Promise<void> {
    const db = await idb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ── attach / detach ────────────────────────────────────────────────────────────────────────────

function validate(file: File): string | undefined {
    if (!/\.gguf$/i.test(file.name)) return "pick a .gguf model file";
    if (file.size > WEB_MODEL_MAX_BYTES) {
        const gb = (file.size / 1024 ** 3).toFixed(1);
        return `${gb} GB exceeds the browser's ~2 GB limit — use a smaller quant (≤2B parameters at Q4 works well), or the native app for this model`;
    }
    return undefined;
}

function catalogManifestError(files: ModelFile[], sizeBytes: number): string | undefined {
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > WEB_MODEL_MAX_BYTES) {
        return "the catalog model has an invalid download size";
    }
    if (files.length === 0 || files.length > 2) {
        return "the catalog model has an unsupported file layout";
    }
    const seen = new Set<string>();
    let total = 0;
    for (const file of files) {
        let parsed: URL;
        try {
            parsed = new URL(file.url);
        } catch {
            return "the catalog model contains an invalid file URL";
        }
        if (
            parsed.protocol !== "https:" ||
            parsed.username !== "" ||
            parsed.password !== "" ||
            parsed.hash !== ""
        ) {
            return "catalog model files must use credential-free HTTPS URLs without fragments";
        }
        if (seen.has(file.url)) return "the catalog model contains a duplicate file URL";
        seen.add(file.url);
        if (!/^[0-9a-f]{64}$/i.test(file.sha256)) {
            return "every catalog model file must have a valid SHA-256 digest";
        }
        if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0) {
            return "every catalog model file must have a positive byte size";
        }
        total += file.bytes;
        if (!Number.isSafeInteger(total) || total > WEB_MODEL_MAX_BYTES) {
            return "the catalog model exceeds the browser download limit";
        }
    }
    if (total !== sizeBytes) return "the catalog model's file sizes do not match its total size";
    const { weights, mmproj } = splitModelFiles(files);
    if (weights.length !== 1 || mmproj.length > 1) {
        return "this model's file layout isn't supported in the browser â€” use the desktop app for it";
    }
    return undefined;
}

function parsePersistedCatalogModel(raw: string): PersistedCatalogModel | undefined {
    const saved = JSON.parse(raw) as Partial<PersistedCatalogModel>;
    if (
        typeof saved.id !== "string" ||
        saved.id === "" ||
        typeof saved.name !== "string" ||
        saved.name === "" ||
        typeof saved.url !== "string" ||
        !Array.isArray(saved.files) ||
        typeof saved.sizeBytes !== "number" ||
        (saved.mmprojUrl !== undefined && typeof saved.mmprojUrl !== "string") ||
        (saved.modalities !== undefined &&
            (!Array.isArray(saved.modalities) ||
                saved.modalities.some((m) => m !== "text" && m !== "image")))
    ) {
        return undefined;
    }
    const files = saved.files as ModelFile[];
    if (catalogManifestError(files, saved.sizeBytes) !== undefined) return undefined;
    const { weights, mmproj } = splitModelFiles(files);
    if (saved.url !== weights[0].url || saved.mmprojUrl !== mmproj[0]?.url) return undefined;
    return {
        id: saved.id,
        name: saved.name,
        url: saved.url,
        mmprojUrl: saved.mmprojUrl,
        modalities: saved.modalities,
        files: files.map((file) => ({ ...file })),
        sizeBytes: saved.sizeBytes,
    };
}

function parsePersistedTransformersWebGpuModel(
    raw: string,
): PersistedTransformersWebGpuModel | undefined {
    const saved = JSON.parse(raw) as Partial<PersistedTransformersWebGpuModel>;
    const spec = transformersWebGpuModelSpec(saved.id);
    if (
        saved.runtime !== "transformers-webgpu" ||
        spec === undefined ||
        typeof saved.name !== "string" ||
        saved.name === ""
    ) {
        return undefined;
    }
    return {
        runtime: saved.runtime,
        id: spec.id,
        name: saved.name,
    };
}

/** Attach a session-scoped File (from `<input type=file>`). */
export async function setWebModelFile(file: File): Promise<string | undefined> {
    const err = validate(file);
    if (err) return err;
    modelSelectionGeneration += 1;
    const download = activeCatalogDownload;
    if (download !== undefined) stopCatalogDownload(download, "cancelled");
    await unloadWebModel();
    state.file = file;
    state.handle = undefined;
    state.url = undefined;
    state.mmprojUrl = undefined;
    state.catalogFiles = undefined;
    state.catalogVerified = undefined;
    state.id = undefined; // disk files have no catalog id
    state.declaredModalities = undefined; // no catalog row to claim anything
    state.imageSupported = undefined;
    state.name = file.name;
    state.status = "attached";
    state.error = undefined;
    publish();
    try {
        localStorage.removeItem(LS_URL_MODEL); // switching source: forget the catalog choice
    } catch {
        /* best-effort */
    }
    return undefined;
}

/** Attach via the File System Access picker; the handle persists across sessions (IndexedDB). */
export async function pickWebModelFromDisk(): Promise<string | undefined> {
    type Picker = (opts?: unknown) => Promise<FileSystemFileHandle[]>;
    const picker = (window as { showOpenFilePicker?: Picker }).showOpenFilePicker;
    if (picker === undefined)
        return "this browser has no file picker API — use the file input instead";
    let handle: FileSystemFileHandle;
    try {
        [handle] = await picker.call(window, {
            types: [
                { description: "GGUF model", accept: { "application/octet-stream": [".gguf"] } },
            ],
        });
    } catch {
        return undefined; // user cancelled — not an error
    }
    const file = await handle.getFile();
    const err = validate(file);
    if (err) return err;
    modelSelectionGeneration += 1;
    const download = activeCatalogDownload;
    if (download !== undefined) stopCatalogDownload(download, "cancelled");
    await unloadWebModel();
    state.file = file;
    state.handle = handle;
    state.url = undefined;
    state.mmprojUrl = undefined;
    state.catalogFiles = undefined;
    state.catalogVerified = undefined;
    state.id = undefined; // disk files have no catalog id
    state.declaredModalities = undefined;
    state.imageSupported = undefined;
    state.name = file.name;
    state.status = "attached";
    state.error = undefined;
    publish();
    await idbPut(handle).catch(() => undefined); // persistence is best-effort
    try {
        localStorage.removeItem(LS_URL_MODEL); // switching source: forget the catalog choice
    } catch {
        /* best-effort */
    }
    return undefined;
}

/** Hex SHA-256 of a blob, or undefined if this browser could not hold the whole file at once.
 *
 *  SubtleCrypto has no streaming digest, so the file has to be materialised as one ArrayBuffer. For
 *  the catalog's browser-eligible models (≤ 2 GB total, ~0.3 GB for SmolVLM 256M) that is a smaller
 *  allocation than loading the model itself. A failure is still fail-closed: the caller must reject
 *  the cached model because an expected digest that was not computed is not an integrity check. */
async function sha256Hex(blob: Blob): Promise<string | undefined> {
    try {
        const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
        return Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    } catch (err) {
        console.warn("[webInference] SHA-256 digest failed", err);
        return undefined;
    }
}

/** Check every downloaded file against the catalog's URL, byte-size and SHA-256 manifest. Returns an
 *  error message on any mismatch or unverifiable file, and undefined only when every file matched.
 *
 *  The BROWSER path had no integrity check at all before this — verification lived only in the native
 *  (Rust) downloader, so a catalog `sha256` was inert here. It matters more now, not less: an mmproj
 *  is parsed by the same llama.cpp code as the weights, and it arrives from a second URL. */
async function verifyCachedFiles(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: any,
    files: ModelFile[],
): Promise<string | undefined> {
    const expected = new Map(files.map((file) => [file.url, file]));
    // `files[i]` and `open()[i]` are the same cache entries in the same order (both walk Model.files).
    const blobs: Blob[] = await model.open();
    const entries: { metadata?: { originalURL?: string } }[] = model.files ?? [];
    if (blobs.length !== files.length || entries.length !== files.length) {
        return "The browser cache did not return every file in the catalog integrity manifest. The cached model has been discarded; try again.";
    }
    const seen = new Set<string>();
    for (let i = 0; i < blobs.length; i++) {
        const url = entries[i]?.metadata?.originalURL;
        if (url === undefined) {
            return "A cached model file had no source URL, so its integrity could not be verified. The cached model has been discarded; try again.";
        }
        const want = expected.get(url);
        if (want === undefined || seen.has(url)) {
            return "The browser cache returned a file outside the catalog integrity manifest. The cached model has been discarded; try again.";
        }
        seen.add(url);
        if (blobs[i].size !== want.bytes) {
            return `${url.split("/").pop() ?? "a model file"} has the wrong byte size. The cached model has been discarded; try again.`;
        }
        const got = await sha256Hex(blobs[i]);
        if (got === undefined) {
            return `${url.split("/").pop() ?? "a model file"} could not be SHA-256 verified in this browser. The cached model has been discarded; try again or use the native app.`;
        }
        if (got.toLowerCase() !== want.sha256.toLowerCase()) {
            return `${url.split("/").pop() ?? "a model file"} failed its SHA-256 check — the download is corrupt or the file changed upstream. It has been discarded; try again.`;
        }
    }
    if (seen.size !== expected.size) {
        return "The browser cache omitted a file from the catalog integrity manifest. The cached model has been discarded; try again.";
    }
    return undefined;
}

/** Attach a CATALOG model: wllama downloads its file(s) once into the browser cache (with progress)
 *  and re-attaches instantly on later visits. A vision entry brings a second file — the mmproj
 *  projector — which is downloaded, verified and loaded alongside the weights. Progress is reported
 *  across BOTH (wllama's Model.refresh sums the shards). The choice persists in localStorage. */
export async function useWebModelFromUrl(
    entry: CatalogModelSelection,
): Promise<string | undefined> {
    if (activeCatalogDownload !== undefined) {
        return "A model download is already in progress. Cancel it before choosing another model.";
    }
    const modelSpec = transformersWebGpuModelSpec(entry.id);
    const allWebGpu = modelSpec !== undefined;
    // The pinned Transformers selection is not a GGUF catalog download. Decide that first so stale
    // GGUF URLs, hashes, files, and prior browser cache entries are completely irrelevant.
    if (!allWebGpu) {
        const manifestError = catalogManifestError(entry.files, entry.sizeBytes);
        if (manifestError !== undefined) return manifestError;
        if (entry.sizeBytes > WEB_MODEL_MAX_BYTES) {
            return "this model exceeds the browser's ~2 GB limit — use the desktop app for it";
        }
    }
    const { weights, mmproj } = allWebGpu
        ? { weights: [] as ModelFile[], mmproj: [] as ModelFile[] }
        : splitModelFiles(entry.files);
    if (!allWebGpu && (weights.length !== 1 || mmproj.length > 1)) {
        return "this model's file layout isn't supported in the browser — use the desktop app for it";
    }
    // The explicit phone experiment owns a separate revision-keyed ONNX cache. Selecting this
    // model downloads that exact manifest in Model Manager; its GGUF/projector catalog pair belongs
    // to the normal Wllama route and must not be downloaded as an accidental fallback.
    if (modelSpec !== undefined) {
        if (!transformersWebGpuSelectionCanHandle(entry.id)) {
            const availability = transformersWebGpuRuntimeAvailability();
            return availability.available
                ? "The selected all-WebGPU runtime is not enabled in this browser."
                : availability.reason;
        }
        const previous = cloneWebModelState(state);
        const selectionGeneration = ++modelSelectionGeneration;
        let resolveDone: () => void = () => undefined;
        const done = new Promise<void>((resolve) => {
            resolveDone = resolve;
        });
        const attempt: CatalogDownloadAttempt = {
            controller: new AbortController(),
            generation: ++catalogDownloadGeneration,
            selectionGeneration,
            previous,
            done,
            resolveDone,
        };
        activeCatalogDownload = attempt;
        const isCurrentAttempt = () =>
            activeCatalogDownload === attempt &&
            attempt.generation === catalogDownloadGeneration &&
            attempt.selectionGeneration === modelSelectionGeneration &&
            !attempt.controller.signal.aborted;
        let stallTimer: ReturnType<typeof setTimeout> | undefined;
        const armStallTimer = () => {
            if (stallTimer !== undefined) clearTimeout(stallTimer);
            stallTimer = setTimeout(
                () => stopCatalogDownload(attempt, "stalled"),
                CATALOG_DOWNLOAD_STALL_MS,
            );
        };
        const onVisibilityChange = () => {
            if (document.hidden) stopCatalogDownload(attempt, "backgrounded");
        };
        const onPageHide = () => stopCatalogDownload(attempt, "backgrounded");
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("pagehide", onPageHide);

        state.file = undefined;
        state.handle = undefined;
        state.url = undefined;
        state.mmprojUrl = undefined;
        state.catalogFiles = undefined;
        state.catalogVerified = false;
        state.id = entry.id;
        state.name = entry.name;
        state.declaredModalities = [...modelSpec.modalities];
        state.imageSupported = true;
        const installed = webModelInstallStates[entry.id] === "downloaded";
        state.status = installed ? "verifying" : "downloading";
        state.error = undefined;
        state.progress = installed ? undefined : { received: 0, total: modelSpec.artifactBytes };
        state.generation = undefined;
        publish();
        try {
            // A previously verified model keeps its own revisioned cache when another model is
            // selected. Re-activating it is cache-only: reuse the per-page proof instead of entering
            // the downloader (which invalidates that proof and rehashes every model shard).
            const cachedArtifactsVerified =
                installed &&
                (await transformersWebGpuModelArtifactsDownloaded(entry.id, {
                    signal: attempt.controller.signal,
                }));
            if (!isCurrentAttempt()) throw attempt.controller.signal.reason;
            let cachedAndVerified =
                cachedArtifactsVerified &&
                (await transformersWebGpuModelDownloaded(entry.id, {
                    signal: attempt.controller.signal,
                }));
            if (!isCurrentAttempt()) throw attempt.controller.signal.reason;
            if (cachedArtifactsVerified && !cachedAndVerified) {
                // An inactive downloaded model may still have the previous build's worker.
                // Refresh only that runtime layer: full preload would invalidate the body
                // proof above and hash every unchanged multi-gigabyte model shard again.
                armStallTimer();
                await refreshTransformersWebGpuRuntimeAssets(entry.id, {
                    signal: attempt.controller.signal,
                });
                if (!isCurrentAttempt()) throw attempt.controller.signal.reason;
                cachedAndVerified = true;
            }
            if (!cachedAndVerified) {
                state.status = "downloading";
                state.progress = { received: 0, total: modelSpec.artifactBytes };
                publish();
                // The stall timeout belongs only to network/cache population. A cold local
                // verification can legitimately hash several gigabytes without progress events;
                // cancellation is carried by the AbortSignal passed to that verifier above.
                armStallTimer();
                await preloadTransformersWebGpuModel(entry.id, {
                    signal: attempt.controller.signal,
                    onProgress(received, total) {
                        if (!isCurrentAttempt()) return;
                        armStallTimer();
                        state.progress = { received, total };
                        publish();
                    },
                });
            }
            if (!isCurrentAttempt()) throw attempt.controller.signal.reason;
            state.status = "verifying";
            state.progress = undefined;
            publish();
            if (
                !(await transformersWebGpuModelDownloaded(entry.id, {
                    signal: attempt.controller.signal,
                }))
            ) {
                throw new Error("The completed all-WebGPU model could not be verified.");
            }
            if (!isCurrentAttempt()) throw attempt.controller.signal.reason;
            setWebModelInstallState(entry.id, "downloaded");
            if (modelSpec.optionalAudio !== undefined) {
                // Re-verify an already installed add-on without downloading it. A base-only Gemma
                // selection returns false immediately and remains fully usable for text/images.
                await transformersWebGpuAudioDownloaded(entry.id, {
                    signal: attempt.controller.signal,
                });
                if (!isCurrentAttempt()) throw attempt.controller.signal.reason;
            }

            // Downloading must not evict a usable resident model. Retire it only after the new
            // artifact is complete, and keep an already-loaded instance of this exact model.
            const preserveResident =
                previous.id === entry.id &&
                (previous.status === "attached" || previous.status === "loaded");
            if (!preserveResident) await unloadWebModel();
            if (!isCurrentAttempt()) throw attempt.controller.signal.reason;

            state.file = undefined;
            state.handle = undefined;
            state.url = undefined;
            state.mmprojUrl = undefined;
            state.catalogFiles = undefined;
            state.catalogVerified = true;
            state.id = entry.id;
            state.name = entry.name;
            state.declaredModalities = [...modelSpec.modalities];
            state.imageSupported = true;
            state.status = preserveResident ? previous.status : "attached";
            state.error = undefined;
            state.progress = undefined;
            publish();
            try {
                localStorage.setItem(
                    LS_URL_MODEL,
                    JSON.stringify({
                        runtime: "transformers-webgpu",
                        id: entry.id,
                        name: entry.name,
                    }),
                );
            } catch {
                /* persistence best-effort */
            }
            return undefined;
        } catch (err) {
            const failure = catalogDownloadFailure(attempt, err);
            if (
                activeCatalogDownload === attempt &&
                attempt.selectionGeneration === modelSelectionGeneration
            ) {
                restoreState(previous);
                publish();
            }
            return failure;
        } finally {
            if (stallTimer !== undefined) clearTimeout(stallTimer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("pagehide", onPageHide);
            if (activeCatalogDownload === attempt) activeCatalogDownload = undefined;
            attempt.resolveDone();
        }
    }
    modelSelectionGeneration += 1;
    await unloadWebModel();
    state.file = undefined;
    state.handle = undefined;
    const url = weights[0].url;
    const mmprojUrl = mmproj[0]?.url;
    state.url = url;
    state.mmprojUrl = mmprojUrl;
    state.catalogFiles = entry.files.map((file) => ({ ...file }));
    state.catalogVerified = false;
    state.id = entry.id;
    state.name = entry.name;
    state.declaredModalities = entry.modalities;
    state.imageSupported = undefined; // measured at load, not claimed here
    state.status = "downloading";
    state.error = undefined;
    state.progress = { received: 0, total: entry.sizeBytes };
    publish();
    try {
        const { ModelManager } = await import("@wllama/wllama/esm/index.js");
        const mgr = new ModelManager();
        const model = await mgr.getModelOrDownload(
            { url, mmprojUrl },
            {
                progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
                    state.progress = { received: loaded, total: total || entry.sizeBytes };
                    publish();
                },
            },
        );
        state.status = "verifying";
        state.progress = undefined;
        publish();
        let bad: string | undefined;
        try {
            bad = await verifyCachedFiles(model, entry.files);
        } catch (err) {
            await model.remove().catch(() => undefined);
            throw err;
        }
        if (bad !== undefined) {
            await model.remove().catch(() => undefined); // don't leave corrupt bytes cached
            state.status = "error";
            state.error = bad;
            publish();
            return bad;
        }
        state.catalogVerified = true;
        state.status = "attached"; // cached — the wasm load happens on first inference
        publish();
        try {
            localStorage.setItem(
                LS_URL_MODEL,
                JSON.stringify({
                    id: entry.id,
                    name: entry.name,
                    url: state.url,
                    mmprojUrl: state.mmprojUrl,
                    modalities: entry.modalities,
                    files: state.catalogFiles,
                    sizeBytes: entry.sizeBytes,
                }),
            );
        } catch {
            /* persistence best-effort */
        }
        return undefined;
    } catch (err) {
        state.status = "error";
        state.catalogVerified = false;
        state.error = err instanceof Error ? err.message : String(err);
        state.progress = undefined;
        publish();
        return state.error;
    }
}

/** Re-attach a previously picked model from the persisted handle (call once at startup). */
export async function restoreWebModel(): Promise<void> {
    // 1. A chosen catalog model (browser-cached download) restores instantly from localStorage.
    try {
        const raw = localStorage.getItem(LS_URL_MODEL);
        if (raw !== null) {
            const pinned = parsePersistedTransformersWebGpuModel(raw);
            const legacy = pinned === undefined ? parsePersistedCatalogModel(raw) : undefined;
            const saved = pinned ?? legacy;
            if (saved !== undefined) {
                const restoreGeneration = ++modelSelectionGeneration;
                let runtimeRefreshFailure: string | undefined;
                const modelSpec = transformersWebGpuModelSpec(saved.id);
                const allWebGpu = pinned !== undefined || modelSpec !== undefined;
                const transformers = allWebGpu && transformersWebGpuSelectionCanHandle(saved.id);
                let downloaded = !allWebGpu;
                if (allWebGpu && transformers) {
                    // Cold start only needs enough information to restore the user's selection.
                    // Streaming and hashing every cached model body here can read several GB on the
                    // main thread while chats are initialising. The cache metadata is pinned to the
                    // exact byte count and SHA written by Model Manager; inference still calls
                    // transformersWebGpuModelDownloaded and fully re-verifies every body before a
                    // worker can run.
                    const modelArtifactsPresent = await transformersWebGpuModelArtifactsPresent(
                        saved.id,
                    );
                    setWebModelInstallState(
                        saved.id,
                        modelArtifactsPresent ? "downloaded" : "not_downloaded",
                    );
                    downloaded =
                        modelArtifactsPresent &&
                        (await transformersWebGpuRuntimeAvailableOffline(saved.id));
                    if (modelArtifactsPresent && !downloaded) {
                        // APK updates rotate the worker URL with OC_WEBSITE_VERSION, but the pinned
                        // multi-gigabyte model revision has not changed. Refresh only the small
                        // build-owned worker/ORT payload at startup; inference remains cache-only
                        // and never becomes a hidden model-download trigger.
                        try {
                            await refreshTransformersWebGpuRuntimeAssets(saved.id);
                            downloaded = await transformersWebGpuRuntimeAvailableOffline(saved.id);
                            if (!downloaded) {
                                runtimeRefreshFailure =
                                    "Your downloaded model is intact, but OpenChat could not verify this build's refreshed all-WebGPU worker and ORT files. Restart or reload OpenChat and try again; reinstall the current app build if the error continues.";
                            }
                        } catch {
                            // Preserve the selected model and identify the small runtime layer as
                            // the failure. A transient packaged-asset/HTTP-cache failure must not
                            // forget or misdiagnose the user's already-verified model weights.
                            downloaded = false;
                            runtimeRefreshFailure =
                                "Your downloaded model is intact, but OpenChat could not refresh this build's all-WebGPU worker and ORT files. Restart or reload OpenChat and try again; reinstall the current app build if the error continues.";
                        }
                    }
                }
                if (downloaded && modelSpec?.optionalAudio !== undefined) {
                    // Restore voice capability only after its separate cache has been verified.
                    // Missing audio never prevents the base text/image model from attaching.
                    await transformersWebGpuAudioDownloaded(saved.id);
                }
                if (restoreGeneration !== modelSelectionGeneration) return;
                state.file = undefined;
                state.handle = undefined;
                state.url = allWebGpu ? undefined : legacy?.url;
                state.mmprojUrl = allWebGpu ? undefined : legacy?.mmprojUrl;
                state.catalogFiles = allWebGpu ? undefined : legacy?.files;
                // Pinned all-WebGPU bodies are intentionally not marked verified by cold restore;
                // the inference boundary performs that full proof immediately before worker use.
                state.catalogVerified = allWebGpu ? undefined : false;
                state.id = saved.id;
                state.name = saved.name;
                state.declaredModalities = allWebGpu
                    ? [...(modelSpec?.modalities ?? ["text", "image"])]
                    : legacy?.modalities;
                state.imageSupported = allWebGpu ? true : undefined;
                state.status = downloaded ? "attached" : "error";
                state.error = downloaded
                    ? undefined
                    : (runtimeRefreshFailure ??
                      (transformers
                          ? transformersWebGpuModelNotDownloadedMessage(saved.id)
                          : "The selected all-WebGPU runtime is not enabled in this browser."));
                publish();
                if (allWebGpu) {
                    try {
                        localStorage.setItem(
                            LS_URL_MODEL,
                            JSON.stringify({
                                runtime: "transformers-webgpu",
                                id: saved.id as TransformersWebGpuModelId,
                                name: saved.name,
                            } satisfies PersistedTransformersWebGpuModel),
                        );
                    } catch {
                        /* persistence best-effort */
                    }
                }
                return;
            }
            localStorage.removeItem(LS_URL_MODEL);
        }
    } catch {
        try {
            localStorage.removeItem(LS_URL_MODEL);
        } catch {
            /* best-effort */
        }
    }
    // 2. A picked disk file restores from its persisted FileSystemFileHandle.
    state.url = undefined;
    state.mmprojUrl = undefined;
    state.catalogFiles = undefined;
    state.catalogVerified = undefined;
    try {
        const handle = await idbGet<FileSystemFileHandle>();
        if (handle === undefined) return;
        type Perm = { queryPermission?: (d: { mode: string }) => Promise<string> };
        const q = await (handle as FileSystemFileHandle & Perm).queryPermission?.({ mode: "read" });
        if (q !== "granted") {
            // Permission needs a user gesture to re-request — surface as attachable, not silent.
            state.handle = handle;
            state.id = undefined;
            state.name = handle.name;
            state.status = "none";
            publish();
            return;
        }
        const file = await handle.getFile();
        if (validate(file) !== undefined) return;
        state.file = file;
        state.handle = handle;
        state.id = undefined; // disk files have no catalog id
        state.declaredModalities = undefined;
        state.imageSupported = undefined;
        state.name = file.name;
        state.status = "attached";
        publish();
    } catch {
        // best-effort: a missing/moved file just means no web model this session
    }
}

/** Drop the attached model, free the wasm runtime, and forget every persisted choice. */
export async function clearWebModel(): Promise<void> {
    const transformersModelId = transformersWebGpuModelSpec(state.id)?.id;
    modelSelectionGeneration += 1;
    // Explicit removal is target-specific. Do not discard another downloaded model's in-page
    // verification proof merely because the current model is being removed.
    if (transformersModelId !== undefined) {
        invalidateTransformersWebGpuReadiness(transformersModelId);
    }
    const download = activeCatalogDownload;
    if (download !== undefined) {
        stopCatalogDownload(download, "cancelled");
        await download.done;
    }
    await unloadWebModel();
    if (transformersModelId !== undefined) {
        // Do not forget the selection or claim the cache is absent when CacheStorage removal
        // fails. The caller surfaces this error and can retry the explicit Remove action.
        await deleteTransformersWebGpuModel(transformersModelId);
        setWebModelInstallState(transformersModelId, "not_downloaded");
    }
    state.file = undefined;
    state.handle = undefined;
    state.url = undefined;
    state.mmprojUrl = undefined;
    state.catalogFiles = undefined;
    state.catalogVerified = undefined;
    state.id = undefined;
    state.name = undefined;
    state.declaredModalities = undefined;
    state.imageSupported = undefined;
    state.status = "none";
    state.error = undefined;
    state.progress = undefined;
    state.generation = undefined;
    publish();
    await idbDelete().catch(() => undefined);
    try {
        localStorage.removeItem(LS_URL_MODEL);
    } catch {
        /* best-effort */
    }
}

/** True when a text inference can run in this browser right now (model attached or loaded). */
export function isWebInferenceReady(): boolean {
    return state.status === "attached" || state.status === "loaded" || state.status === "loading";
}

export function webModelLabel(): string | undefined {
    return state.name;
}

export function webModelCatalogId(): string | undefined {
    return state.id;
}

/**
 * What the attached browser model can READ — the browser half of `onDeviceInferenceCapability`, and
 * therefore what decides whether proposing on an image is offered at all (see imageUnsupportedReason).
 *
 * Answered from the strongest evidence available, in order:
 *   1. the LOADED model's own answer (wllama's `supportInputModality`), once the weights are in wasm;
 *   2. the catalog entry's declared modalities, for a model that is downloaded but not yet loaded —
 *      a claim, and the reason `webInfer` re-checks (1) before it ever sends image bytes;
 *   3. text, for a disk-picked file, which has no catalog row to ask. A disk VLM is under-reported
 *      until its first inference loads it; that costs one text-only propose, never a wrong answer.
 */
export function webModelModalities(): ModelModality[] {
    const modelSpec = transformersWebGpuModelSpec(state.id);
    if (modelSpec !== undefined && transformersWebGpuSelectionCanHandle(state.id)) {
        return modelSpec.modalities.filter(
            (modality) => modality !== "audio" || transformersWebGpuAudioReady(modelSpec.id),
        );
    }
    if (state.imageSupported !== undefined) {
        return state.imageSupported ? ["text", "image"] : ["text"];
    }
    return state.declaredModalities ?? ["text"];
}

let restoreInFlight: Promise<void> | undefined;

export async function ensureWebModelRestored(): Promise<void> {
    if (isWebInferenceReady()) return;
    restoreInFlight ??= restoreWebModel().finally(() => {
        restoreInFlight = undefined;
    });
    await restoreInFlight;
}

export type BrowserImageModelFirstReadiness =
    | { available: true }
    | { available: false; reason?: string };

export type BrowserImageModelFirstReadinessOptions = {
    retryAfterRecentFailure?: boolean;
};

/** Readiness for an app-declared OCR-evidence prompt. Unlike image readiness this requires only
 * the selected model's text decoder, but preserves stale/download/WebGPU reasons verbatim. */
export async function browserTextModelReadiness(): Promise<BrowserImageModelFirstReadiness> {
    await ensureWebModelRestored();
    const selected = webModelCatalogId();
    if (!isWebInferenceReady()) {
        return {
            available: false,
            reason:
                state.error ??
                (transformersWebGpuModelSpec(selected) !== undefined
                    ? transformersWebGpuModelNotDownloadedMessage(selected)
                    : "Select and download an on-device model before using the local image reader."),
        };
    }
    if (transformersWebGpuModelSpec(selected) !== undefined) {
        if (!transformersWebGpuSelectionCanHandle(selected)) {
            return {
                available: false,
                reason: "The selected all-WebGPU runtime is not enabled in this browser.",
            };
        }
        return transformersWebGpuRuntimeAvailability();
    }
    return { available: true };
}

export async function browserImageModelFirstReadiness(
    _options: BrowserImageModelFirstReadinessOptions = {},
): Promise<BrowserImageModelFirstReadiness> {
    await ensureWebModelRestored();
    const selected = webModelCatalogId();

    // A persisted all-WebGPU selection can survive a client/model revision update while its old
    // Cache API entries no longer satisfy the new pinned manifest. Keep that as a MODEL-UPDATE
    // failure. Falling through to the modality probe here made the error-state selection look like
    // an unselected/text-only model, so Propose incorrectly said that Qwen did not support images.
    // The Model Manager already owns the repair (Retry download); preserve its exact actionable
    // reason for the proposal flow instead of replacing it with an unrelated modality verdict.
    if (!isWebInferenceReady()) {
        return {
            available: false,
            reason:
                state.error ??
                (transformersWebGpuModelSpec(selected) !== undefined
                    ? transformersWebGpuModelNotDownloadedMessage(selected)
                    : undefined),
        };
    }
    if (
        transformersWebGpuSpikeCanHandle(
            { prompt: "image readiness", image: new Uint8Array([0]) },
            selected,
        )
    ) {
        return transformersWebGpuRuntimeAvailability();
    }
    return isWebInferenceReady() && webModelModalities().includes("image")
        ? { available: true }
        : { available: false };
}

export async function prepareBrowserImageModelFirst(
    options: BrowserImageModelFirstReadinessOptions = {},
): Promise<boolean> {
    return (await browserImageModelFirstReadiness(options)).available;
}

// ── inference ──────────────────────────────────────────────────────────────────────────────────

// Wllama instance is a singleton: loading is the expensive part (GB-scale weights into wasm
// memory), so keep the model resident between inferences, exactly like the native cache.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let runtime: any | undefined;
let runtimeHasProjector: boolean | undefined;

/** Exactly the image's bytes as a standalone ArrayBuffer. `.buffer` is not safe here: a Uint8Array
 *  is often a VIEW onto a larger pooled buffer, and wllama copies the whole buffer. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.slice().buffer as ArrayBuffer;
}

async function unloadWebModel(): Promise<void> {
    await disposeTransformersWebGpuInference();
    if (runtime !== undefined) {
        try {
            await runtime.exit();
        } catch {
            // freeing best-effort
        }
        runtime = undefined;
        runtimeHasProjector = undefined;
    }
    if (state.status === "loaded" || state.status === "loading") {
        state.status = state.file !== undefined || state.url !== undefined ? "attached" : "none";
    }
}

async function ensureLoaded(requireProjectorAbsent = false, needsImage = false): Promise<void> {
    if (runtime !== undefined && state.status === "loaded") {
        if (
            (requireProjectorAbsent && runtimeHasProjector === true) ||
            (needsImage && runtimeHasProjector !== true)
        ) {
            await unloadWebModel();
        } else {
            return;
        }
    }
    if (state.file === undefined && state.url === undefined)
        throw new Error("no browser model attached");
    state.status = "loading";
    publish();
    try {
        const { Wllama, ModelManager } = await import("@wllama/wllama/esm/index.js");
        // Source: a disk File (read in place), or a catalog model served from wllama's browser cache
        // — for a vision entry that Model carries BOTH blobs. wllama sorts weights from projector by
        // reading each GGUF's header (general.architecture == "clip"), so order here is irrelevant.
        let source: unknown;
        if (state.file !== undefined) {
            source = [state.file];
        } else {
            const manifest = state.catalogFiles;
            if (manifest === undefined) {
                throw new Error(
                    "the browser model has no catalog integrity manifest — remove it and download it again",
                );
            }
            const includeProjector = !requireProjectorAbsent;
            const model = await new ModelManager().getModelOrDownload(
                { url: state.url!, mmprojUrl: includeProjector ? state.mmprojUrl : undefined },
                {},
            );
            // Always verify the exact Model object handed to Wllama. Even a model verified when it
            // was first attached may have been evicted/re-fetched before this later load.
            state.status = "verifying";
            publish();
            let bad: string | undefined;
            try {
                bad = await verifyCachedFiles(
                    model,
                    includeProjector ? manifest : splitModelFiles(manifest).weights,
                );
            } catch (err) {
                await model.remove().catch(() => undefined);
                throw err;
            }
            if (bad !== undefined) {
                await model.remove().catch(() => undefined);
                throw new Error(bad);
            }
            state.catalogVerified = true;
            state.status = "loading";
            publish();
            source = model;
        }
        runtime = new Wllama({ default: wllamaWasm }, { suppressNativeLog: true });
        await runtime.loadModel(source, {
            n_ctx: 4096,
            // wllama picks threads from crossOriginIsolated + hardwareConcurrency on its own.
            image_max_tokens: WEB_IMAGE_MAX_TOKENS,
        });
        runtimeHasProjector = !requireProjectorAbsent && state.mmprojUrl !== undefined;
        // Replace the catalog's CLAIM about modalities with the loaded model's own answer. This is
        // what makes onDeviceInferenceCapability truthful in the browser.
        try {
            state.imageSupported =
                runtimeHasProjector === true && runtime.supportInputModality("image") === true;
        } catch {
            state.imageSupported = false; // older wllama, or the model declined to answer
        }
        state.status = "loaded";
        state.error = undefined;
        publish();
    } catch (err) {
        if (runtime !== undefined) {
            await runtime.exit().catch(() => undefined);
        }
        runtimeHasProjector = undefined;
        state.status = "error";
        state.error = err instanceof Error ? err.message : String(err);
        publish();
        runtime = undefined;
        throw err;
    }
}

export type WebInferOptions = {
    /** Private verification boundary: load weights only and reject image bytes. */
    requireProjectorAbsent?: boolean;
};

/** Run a text OR image inference against the attached browser model. Mirrors the native contract. */
export async function webInfer(
    request: InferenceRequest,
    options: WebInferOptions = {},
): Promise<InferenceResult> {
    const requireProjectorAbsent = options.requireProjectorAbsent === true;
    if (requireProjectorAbsent && request.image !== undefined) {
        return { kind: "error", error: "projector-free inference accepts text only" };
    }
    await ensureWebModelRestored();
    if (!isWebInferenceReady()) {
        return { kind: "unavailable", reason: "no browser model attached" };
    }
    const selected = state.id;
    if (request.modelId !== undefined && request.modelId !== selected) {
        return { kind: "error", error: "the selected browser model changed before inference" };
    }
    if (
        transformersWebGpuModelSpec(selected) !== undefined &&
        !transformersWebGpuSelectionCanHandle(selected)
    ) {
        return {
            kind: "unavailable",
            reason: "The selected all-WebGPU runtime is not enabled in this browser.",
        };
    }
    if (transformersWebGpuSelectionCanHandle(selected)) {
        if (!transformersWebGpuSpikeCanHandle(request, state.id)) {
            return {
                kind: "unavailable",
                reason: "The selected all-WebGPU runtime cannot handle this request.",
            };
        }
        // Wllama and Transformers own independent runtimes. Release any legacy resident decoder
        // before allocating the one-shot all-WebGPU worker on a constrained phone.
        await unloadWebModel();
        const result = await transformersWebGpuInfer({
            ...request,
            modelId: selected,
            maxTokens: resolveTransformersWebGpuMaxOutputTokens(request.maxTokens),
        });
        return attachImageInferenceEvidence(request, selected, result);
    }
    if (request.audio !== undefined || request.audioMimeType !== undefined) {
        return {
            kind: "unavailable",
            reason: "The selected browser runtime does not support audio.",
        };
    }
    try {
        await ensureLoaded(requireProjectorAbsent, request.image !== undefined);
        // Ask the LOADED model, never the catalog: an image sent to a model with no projector throws
        // "Media marker is undefined" from deep inside wllama, which is not an explanation anybody can
        // act on. `unavailable` is the same shape a browser with no model returns, so callers degrade
        // along a path they already handle.
        if (request.image !== undefined && state.imageSupported !== true) {
            return {
                kind: "unavailable",
                reason: `${state.name ?? "the attached browser model"} cannot read images — choose a vision model (one with an mmproj projector) in the model manager`,
            };
        }
        const prompt =
            request.text !== undefined ? `${request.prompt}\n\n${request.text}` : request.prompt;
        // Text stays a plain string (byte-identical to before). An image becomes OAI-style structured
        // content: wllama swaps each media part for the model's own media marker and ships the raw
        // FILE bytes (PNG/JPEG as sent — llama.cpp decodes them) beside the prompt. Image first is
        // what llama.cpp's own multimodal examples do; VLMs are trained with the picture ahead of the
        // question.
        const content =
            request.image !== undefined
                ? [
                      { type: "image" as const, data: toArrayBuffer(request.image) },
                      { type: "text" as const, text: prompt },
                  ]
                : prompt;
        // OAI-compat API: the non-stream overload returns a ChatCompletionResponse OBJECT — the text
        // lives at choices[0].message.content (returning the object raw broke downstream `.match`).
        // When the caller supplied a response schema, constrain decoding to valid JSON via wllama's
        // json_object response_format (grammar-enforced — stronger than prompt discipline alone).
        const res = await runtime.createChatCompletion({
            messages: [{ role: "user", content }],
            max_tokens: request.maxTokens ?? 512,
            temperature: 0, // deterministic-leaning extraction, same spirit as the native path
            ...(request.responseSchema !== undefined
                ? { response_format: { type: "json_object" } }
                : {}),
        });
        const text = res?.choices?.[0]?.message?.content;
        if (typeof text !== "string") {
            return { kind: "error", error: "browser model returned no text" };
        }
        return attachImageInferenceEvidence(request, selected, { kind: "ok", text });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // An emscripten abort kills the wasm module: every later inference on this runtime fails too,
        // so drop it and let the next call rebuild. Left resident, one oversized image poisoned the
        // model for the rest of the session.
        if (isWasmAbort(message)) {
            runtime = undefined;
            state.status = "attached";
            state.imageSupported = undefined; // unmeasured again until the rebuilt runtime answers
            publish();
            return {
                kind: "error",
                error:
                    request.image !== undefined
                        ? "the model ran out of room decoding that image — try a smaller or less detailed picture"
                        : "the browser model crashed and has been unloaded — try again",
            };
        }
        return { kind: "error", error: message };
    }
}

/** Did the wasm runtime abort? wllama surfaces emscripten's `abort()` as a bare "(ABORT)" — which
 *  reached users verbatim as "Action failed: (ABORT)", a string nobody can act on. */
function isWasmAbort(message: string): boolean {
    return /\babort\b|unreachable/i.test(message);
}
