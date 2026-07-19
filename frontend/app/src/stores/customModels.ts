import type { ModelCatalogEntry, ModelModality, ModelRuntime } from "openchat-shared";
import { get, writable } from "svelte/store";
import { configKeys } from "../utils/config";

// Device-local "add a model from a URL" store (PR-cat-3).
//
// Custom models are stored per-device in localStorage and NEVER synced — they point at files the user
// chose. Each entry is shaped like a catalog entry so the Model Manager renders it in the same list, plus
// provenance (`sourceUrl`) and a trust-on-first-use file whose `sha256` is unknown until the first
// download records it (see recordDownloadedHashes).

export interface CustomModelFile {
    url: string;
    // Absent until the first successful download fills in the observed hash (trust-on-first-use).
    sha256?: string;
    bytes: number;
    // Optional on-disk filename override — used to force a projector to contain "mmproj" so the native
    // runtime's find_mmproj/find_gguf classify a custom multimodal model's files correctly.
    filename?: string;
}

export interface CustomModelEntry {
    id: string;
    name: string;
    description?: string;
    modalities: ModelModality[];
    runtime: ModelRuntime;
    files: CustomModelFile[];
    license: string;
    licenseUrl?: string;
    sizeBytes: number;
    custom: true;
    sourceUrl: string;
    addedAt: number;
}

// The uniform shape the Model Manager list renders: a curated/registry entry OR a custom one. sha256 is
// optional here because a custom file may not have one yet; `custom`/`sourceUrl` mark user-added entries.
export interface DisplayModel {
    id: string;
    name: string;
    description?: string;
    modalities: ModelModality[];
    runtime: ModelRuntime;
    files: CustomModelFile[];
    license: string;
    licenseUrl?: string;
    sizeBytes: number;
    custom?: boolean;
    sourceUrl?: string;
}

// A curated/registry catalog entry, widened to the uniform DisplayModel (its required sha256 files satisfy
// the optional-sha256 shape).
export function toDisplay(entry: ModelCatalogEntry): DisplayModel {
    return { ...entry };
}

// Guardrail: cap how many custom models can accumulate in localStorage (each is small metadata, but keep
// the list bounded and the UI sane). The actual disk cost is gated per-download by the suitability check.
export const MAX_CUSTOM_MODELS = 20;

const STORAGE_KEY = configKeys.customModels;

function isValidEntry(value: unknown): value is CustomModelEntry {
    if (typeof value !== "object" || value === null) return false;
    const e = value as Record<string, unknown>;
    return (
        typeof e.id === "string" &&
        e.id.length > 0 &&
        typeof e.name === "string" &&
        Array.isArray(e.files) &&
        e.custom === true &&
        typeof e.sourceUrl === "string"
    );
}

function load(): CustomModelEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null || raw === "") return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
    } catch {
        return [];
    }
}

const store = writable<CustomModelEntry[]>(load());

// Write localStorage FIRST and only advance the in-memory store if it succeeded. Mutations reload their
// working list from localStorage (the source of truth), so if a write fails we must NOT let the store move
// ahead of it — otherwise the next mutation would reload the stale localStorage and silently drop the
// change. Returns whether the write succeeded.
function persist(list: CustomModelEntry[]): boolean {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
        return false;
    }
    store.set(list);
    return true;
}

// Reactive list of the user's custom models (read-only view).
export const customModels = { subscribe: store.subscribe };

export function getCustomModels(): CustomModelEntry[] {
    return get(store);
}

export type AddResult = { ok: true } | { ok: false; error: string };

export function addCustomModel(entry: CustomModelEntry): AddResult {
    const list = load();
    if (list.some((m) => m.id === entry.id)) {
        return { ok: false, error: "That model has already been added." };
    }
    if (list.length >= MAX_CUSTOM_MODELS) {
        return {
            ok: false,
            error: `You can add at most ${MAX_CUSTOM_MODELS} custom models — remove one first.`,
        };
    }
    if (!persist([...list, entry])) {
        return { ok: false, error: "Couldn't save the model — this device's storage may be full." };
    }
    return { ok: true };
}

export function removeCustomModel(id: string): void {
    persist(load().filter((m) => m.id !== id));
}

// After a (first) successful download, record the observed per-file hashes so a later re-download can be
// integrity-checked. Matches by URL; leaves files without a reported hash untouched.
export function recordDownloadedHashes(
    id: string,
    files: { url: string; sha256: string }[],
): void {
    if (files.length === 0) return;
    const byUrl = new Map(files.map((f) => [f.url, f.sha256]));
    persist(
        load().map((m) =>
            m.id !== id
                ? m
                : {
                      ...m,
                      files: m.files.map((f) => {
                          const sha = byUrl.get(f.url);
                          return sha !== undefined && sha !== "" ? { ...f, sha256: sha } : f;
                      }),
                  },
        ),
    );
}

// --- Pure id/slug helpers (exported for testing) ---

// The last path segment of a URL (the filename), minus any query/fragment, and excluding the host.
export function fileNameFromUrl(url: string): string {
    const lastSegment = (path: string): string =>
        path
            .split("/")
            .filter((s) => s.length > 0)
            .pop() ?? "";
    try {
        // pathname excludes scheme/host/query, so "https://host/" → "/" → "".
        return lastSegment(new URL(url).pathname);
    } catch {
        // Not an absolute URL — fall back to the query-stripped tail.
        return lastSegment(url.split(/[?#]/, 1)[0]);
    }
}

// A filesystem-safe, lowercase slug (matches the native store key charset [A-Za-z0-9._-]); bounded length.
export function slug(value: string): string {
    const s = value
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "")
        .slice(0, 40);
    return s.length > 0 ? s : "model";
}

// A short, stable, order-independent hash of a string (djb2 → base36). Not cryptographic — only used to
// disambiguate two custom models with the same filename from different sources.
export function shortHash(value: string): string {
    let h = 5381;
    for (let i = 0; i < value.length; i++) {
        h = ((h << 5) + h + value.charCodeAt(i)) >>> 0;
    }
    return h.toString(36).padStart(6, "0").slice(0, 8);
}

// Build a stable, filesystem-safe id for a custom model: slug(filename)-hash(url). The hash keeps two
// same-named files from different URLs distinct (and re-adding the same URL yields the same id → dedupe).
export function makeCustomModelId(url: string): string {
    const filename = fileNameFromUrl(url);
    const base = slug(filename.replace(/\.gguf$/i, ""));
    return `${base}-${shortHash(url)}`;
}
