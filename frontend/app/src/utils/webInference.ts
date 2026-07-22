// BROWSER on-device inference — the web half of the onDeviceInference facade.
//
// llama.cpp compiled to WASM (@wllama/wllama) runs a GGUF that the user picks from a NORMAL DISK
// LOCATION. The file is read in place as a Blob (file input or the File System Access API) — nothing
// is uploaded anywhere and nothing is copied into browser storage; the same folder the native app
// uses works. Multithreaded when the page is crossOriginIsolated (COOP/COEP headers on the dev
// server), single-thread otherwise. TEXT-ONLY: the vision (mmproj) path stays native — callers get
// "unavailable" for image requests and degrade exactly as before.
//
// Persistence: a FileSystemFileHandle (when the picker was used) is stored in IndexedDB so the model
// re-attaches across sessions without re-picking; a plain <input type=file> File lasts for the
// session only (there is no handle to persist) but is fully automatable in tests.

import type { InferenceRequest, InferenceResult } from "openchat-shared";
import { writable } from "svelte/store";

// Vite turns this into a served asset URL. wllama 3.x ships ONE unified wasm (esm/wasm/) and picks
// thread count itself from crossOriginIsolated + hardware concurrency.
import wllamaWasm from "@wllama/wllama/esm/wasm/wllama.wasm?url";

// The practical wasm32 envelope: address space is 4GB and llama.cpp needs headroom for KV cache +
// compute buffers on top of the weights. Refuse anything bigger with a clear reason instead of an
// opaque OOM half a minute into loading.
const MAX_WEB_MODEL_BYTES = 2_147_483_648; // 2 GB

const IDB_NAME = "openchat_web_model";
const IDB_STORE = "handles";
const IDB_KEY = "model_file_handle";

// Chosen catalog model (downloaded into the BROWSER cache by wllama's ModelManager, re-attached
// instantly on later visits). Distinct from the pick-a-file-from-disk path below.
const LS_URL_MODEL = "openchat_web_model_url"; // JSON {id, name, url}

type WebModelState = {
    file?: File;
    handle?: FileSystemFileHandle;
    /** Catalog source: downloaded + cached in browser storage via wllama's ModelManager. */
    url?: string;
    name?: string;
    status: "none" | "attached" | "downloading" | "loading" | "loaded" | "error";
    error?: string;
    progress?: { received: number; total: number };
};

const state: WebModelState = { status: "none" };

/** UI-facing snapshot: the attached model's name + lifecycle status (+ download progress). */
export const webModelStatus = writable<{
    name?: string;
    status: WebModelState["status"];
    error?: string;
    progress?: { received: number; total: number };
}>({ status: "none" });

function publish(): void {
    webModelStatus.set({ name: state.name, status: state.status, error: state.error, progress: state.progress });
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
    if (file.size > MAX_WEB_MODEL_BYTES) {
        const gb = (file.size / 1024 ** 3).toFixed(1);
        return `${gb} GB exceeds the browser's ~2 GB limit — use a smaller quant (≤2B parameters at Q4 works well), or the native app for this model`;
    }
    return undefined;
}

/** Attach a session-scoped File (from `<input type=file>`). */
export async function setWebModelFile(file: File): Promise<string | undefined> {
    const err = validate(file);
    if (err) return err;
    await unloadWebModel();
    state.file = file;
    state.handle = undefined;
    state.url = undefined;
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
    if (picker === undefined) return "this browser has no file picker API — use the file input instead";
    let handle: FileSystemFileHandle;
    try {
        [handle] = await picker.call(window, {
            types: [{ description: "GGUF model", accept: { "application/octet-stream": [".gguf"] } }],
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

/** Attach a CATALOG model by URL: wllama downloads it once into the browser cache (with progress)
 *  and re-attaches instantly on later visits. The choice persists in localStorage. */
export async function useWebModelFromUrl(entry: { id: string; name: string; url: string; sizeBytes: number }): Promise<string | undefined> {
    if (entry.sizeBytes > MAX_WEB_MODEL_BYTES) {
        return "this model exceeds the browser's ~2 GB limit — use the desktop app for it";
    }
    await unloadWebModel();
    state.file = undefined;
    state.handle = undefined;
    state.url = entry.url;
    state.name = entry.name;
    state.status = "downloading";
    state.error = undefined;
    state.progress = { received: 0, total: entry.sizeBytes };
    publish();
    try {
        const { ModelManager } = await import("@wllama/wllama");
        const mgr = new ModelManager();
        await mgr.getModelOrDownload(
            { url: entry.url },
            {
                progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
                    state.progress = { received: loaded, total: total || entry.sizeBytes };
                    publish();
                },
            },
        );
        state.status = "attached"; // cached — the wasm load happens on first inference
        state.progress = undefined;
        publish();
        try {
            localStorage.setItem(LS_URL_MODEL, JSON.stringify({ id: entry.id, name: entry.name, url: entry.url }));
        } catch {
            /* persistence best-effort */
        }
        return undefined;
    } catch (err) {
        state.status = "error";
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
            const saved = JSON.parse(raw) as { id: string; name: string; url: string };
            state.url = saved.url;
            state.name = saved.name;
            state.status = "attached"; // wllama's cache serves the bytes on first load
            publish();
            return;
        }
    } catch {
        /* fall through to the disk-handle path */
    }
    // 2. A picked disk file restores from its persisted FileSystemFileHandle.
    try {
        const handle = await idbGet<FileSystemFileHandle>();
        if (handle === undefined) return;
        type Perm = { queryPermission?: (d: { mode: string }) => Promise<string> };
        const q = await (handle as FileSystemFileHandle & Perm).queryPermission?.({ mode: "read" });
        if (q !== "granted") {
            // Permission needs a user gesture to re-request — surface as attachable, not silent.
            state.handle = handle;
            state.name = handle.name;
            state.status = "none";
            publish();
            return;
        }
        const file = await handle.getFile();
        if (validate(file) !== undefined) return;
        state.file = file;
        state.handle = handle;
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
    state.name = undefined;
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

// ── inference ──────────────────────────────────────────────────────────────────────────────────

// Wllama instance is a singleton: loading is the expensive part (GB-scale weights into wasm
// memory), so keep the model resident between inferences, exactly like the native cache.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let runtime: any | undefined;

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
    if (state.file === undefined && state.url === undefined) throw new Error("no browser model attached");
    state.status = "loading";
    publish();
    try {
        const { Wllama, ModelManager } = await import("@wllama/wllama");
        runtime = new Wllama({ default: wllamaWasm }, { suppressNativeLog: true });
        // Source: a disk File (read in place), or a catalog model served from wllama's browser cache.
        const source =
            state.file !== undefined
                ? [state.file]
                : await new ModelManager().getModelOrDownload({ url: state.url! }, {});
        await runtime.loadModel(source, {
            n_ctx: 4096,
            // wllama picks threads from crossOriginIsolated + hardwareConcurrency on its own.
        });
        state.status = "loaded";
        state.error = undefined;
        publish();
    } catch (err) {
        state.status = "error";
        state.error = err instanceof Error ? err.message : String(err);
        publish();
        runtime = undefined;
        throw err;
    }
}

/** Run a text inference against the attached disk model. Mirrors the native contract. */
export async function webInfer(request: InferenceRequest): Promise<InferenceResult> {
    if (request.image !== undefined) {
        return { kind: "unavailable", reason: "browser inference is text-only — use the native app for images" };
    }
    if (!isWebInferenceReady()) {
        return { kind: "unavailable", reason: "no browser model attached" };
    }
    try {
        await ensureLoaded();
        const content = request.text !== undefined ? `${request.prompt}\n\n${request.text}` : request.prompt;
        const text: string = await runtime.createChatCompletion({
            messages: [{ role: "user", content }],
            nPredict: request.maxTokens ?? 512,
            sampling: { temp: 0 }, // deterministic-leaning extraction, same spirit as the native path
        });
        return { kind: "ok", text };
    } catch (err) {
        return { kind: "error", error: err instanceof Error ? err.message : String(err) };
    }
}
