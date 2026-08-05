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
import { writable } from "svelte/store";
import { splitModelFiles, WEB_MODEL_MAX_BYTES } from "./modelCatalog";

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
};

const state: WebModelState = { status: "none" };

/** UI-facing snapshot: the attached model's catalog id + name + lifecycle status (+ download progress). */
export const webModelStatus = writable<{
    id?: string;
    name?: string;
    status: WebModelState["status"];
    error?: string;
    progress?: { received: number; total: number };
}>({ status: "none" });

function publish(): void {
    webModelStatus.set({
        id: state.id,
        name: state.name,
        status: state.status,
        error: state.error,
        progress: state.progress,
    });
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

/** Attach a session-scoped File (from `<input type=file>`). */
export async function setWebModelFile(file: File): Promise<string | undefined> {
    const err = validate(file);
    if (err) return err;
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
export async function useWebModelFromUrl(entry: {
    id: string;
    name: string;
    files: ModelFile[];
    sizeBytes: number;
    modalities?: ModelModality[];
}): Promise<string | undefined> {
    const manifestError = catalogManifestError(entry.files, entry.sizeBytes);
    if (manifestError !== undefined) return manifestError;
    // The budget is the TOTAL: weights and projector share one wasm heap (see WEB_MODEL_MAX_BYTES).
    if (entry.sizeBytes > WEB_MODEL_MAX_BYTES) {
        return "this model exceeds the browser's ~2 GB limit — use the desktop app for it";
    }
    const { weights, mmproj } = splitModelFiles(entry.files);
    if (weights.length !== 1 || mmproj.length > 1) {
        return "this model's file layout isn't supported in the browser — use the desktop app for it";
    }
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
        const { ModelManager } = await import("@wllama/wllama");
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
            const saved = parsePersistedCatalogModel(raw);
            if (saved !== undefined) {
                state.file = undefined;
                state.handle = undefined;
                state.url = saved.url;
                state.mmprojUrl = saved.mmprojUrl;
                state.catalogFiles = saved.files;
                state.catalogVerified = false; // the cache is re-hashed before the first load
                state.id = saved.id;
                state.name = saved.name;
                state.declaredModalities = saved.modalities;
                state.imageSupported = undefined;
                state.status = "attached";
                publish();
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
    await unloadWebModel();
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
    if (state.imageSupported !== undefined) {
        return state.imageSupported ? ["text", "image"] : ["text"];
    }
    return state.declaredModalities ?? ["text"];
}

// ── inference ──────────────────────────────────────────────────────────────────────────────────

// Wllama instance is a singleton: loading is the expensive part (GB-scale weights into wasm
// memory), so keep the model resident between inferences, exactly like the native cache.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let runtime: any | undefined;

/** Exactly the image's bytes as a standalone ArrayBuffer. `.buffer` is not safe here: a Uint8Array
 *  is often a VIEW onto a larger pooled buffer, and wllama copies the whole buffer. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.slice().buffer as ArrayBuffer;
}

async function unloadWebModel(): Promise<void> {
    if (runtime !== undefined) {
        try {
            await runtime.exit();
        } catch {
            // freeing best-effort
        }
        runtime = undefined;
    }
    if (state.status === "loaded" || state.status === "loading") {
        state.status = state.file !== undefined ? "attached" : "none";
    }
}

async function ensureLoaded(): Promise<void> {
    if (runtime !== undefined && state.status === "loaded") return;
    if (state.file === undefined && state.url === undefined)
        throw new Error("no browser model attached");
    state.status = "loading";
    publish();
    try {
        const { Wllama, ModelManager } = await import("@wllama/wllama");
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
            const model = await new ModelManager().getModelOrDownload(
                { url: state.url!, mmprojUrl: state.mmprojUrl },
                {},
            );
            // Always verify the exact Model object handed to Wllama. Even a model verified when it
            // was first attached may have been evicted/re-fetched before this later load.
            state.status = "verifying";
            publish();
            let bad: string | undefined;
            try {
                bad = await verifyCachedFiles(model, manifest);
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
        // Replace the catalog's CLAIM about modalities with the loaded model's own answer. This is
        // what makes onDeviceInferenceCapability truthful in the browser.
        try {
            state.imageSupported = runtime.supportInputModality("image") === true;
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
        state.status = "error";
        state.error = err instanceof Error ? err.message : String(err);
        publish();
        runtime = undefined;
        throw err;
    }
}

/** Run a text OR image inference against the attached browser model. Mirrors the native contract. */
export async function webInfer(request: InferenceRequest): Promise<InferenceResult> {
    if (!isWebInferenceReady()) {
        return { kind: "unavailable", reason: "no browser model attached" };
    }
    try {
        await ensureLoaded();
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
        return { kind: "ok", text };
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
