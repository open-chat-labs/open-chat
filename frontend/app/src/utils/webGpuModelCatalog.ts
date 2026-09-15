import defaults from "../../public/model-catalog.json";
import type {
    TransformersWebGpuArtifact,
    TransformersWebGpuModelSpec,
} from "./transformersWebGpuProtocol";

export type WebGpuModelCatalog = {
    schemaVersion: 1;
    version: string;
    models: readonly TransformersWebGpuModelSpec[];
};
export const WEB_GPU_CATALOG_MAX_BYTES = 512 * 1024;
const STORAGE_KEY = "openchat_webgpu_catalog_v1";
const SOURCE_KEY = "openchat_webgpu_catalog_source_v1";
const listeners = new Set<() => void>();

function fail(message: string): never {
    throw new Error(`Invalid model catalog: ${message}`);
}
function object(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        fail("expected object");
    return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]): void {
    if (Object.keys(value).some((key) => !allowed.includes(key)))
        fail("unknown configuration field");
}
function string(value: unknown, pattern?: RegExp, max = 200): string {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > max ||
        (pattern !== undefined && !pattern.test(value))
    )
        fail("invalid string");
    return value;
}
function number(value: unknown, min: number, max: number, integer = true): number {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < min ||
        value > max ||
        (integer && !Number.isSafeInteger(value))
    )
        fail("number outside supported bounds");
    return value;
}
function boolean(value: unknown): boolean {
    if (typeof value !== "boolean") fail("expected boolean");
    return value;
}
const safePath = /^[a-zA-Z0-9_-]+(?:[./][a-zA-Z0-9_-]+)*$/u;
const repository = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/u;
const digest = /^[a-f0-9]{64}$/u;
const revision = /^[a-f0-9]{40}$/u;
function artifact(value: unknown): TransformersWebGpuArtifact {
    const a = object(value);
    keys(a, ["path", "bytes", "sha256", "source"]);
    string(a.path, safePath);
    number(a.bytes, 1, 8 * 1024 ** 3);
    string(a.sha256, digest);
    if (a.source !== undefined) {
        const s = object(a.source);
        keys(s, ["repository", "revision", "path", "range", "bytes", "sha256", "transform"]);
        string(s.repository, repository);
        string(s.revision, revision);
        string(s.path, safePath);
        string(s.sha256, digest);
        number(s.bytes, 1, 8 * 1024 ** 3);
        if (s.transform !== "bf16-le-to-f32-le") fail("unsupported artifact transform");
        const r = object(s.range);
        keys(r, ["start", "end", "totalBytes"]);
        const total = number(r.totalBytes, 1, 32 * 1024 ** 3);
        const start = number(r.start, 0, total - 1);
        const end = number(r.end, start, total - 1);
        if (end - start + 1 !== s.bytes || Number(s.bytes) * 2 !== a.bytes || Number(s.bytes) % 2) {
            fail("inconsistent artifact range");
        }
    }
    return a as TransformersWebGpuArtifact;
}
function artifacts(value: unknown): readonly TransformersWebGpuArtifact[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > 64)
        fail("invalid artifact list");
    const result = value.map(artifact);
    if (new Set(result.map((a) => a.path)).size !== result.length) fail("duplicate artifact path");
    return result;
}
function freeze<T>(value: T): T {
    if (typeof value === "object" && value !== null) {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

/** Declarative data only. Adapter code, GPU-only routing, tensor layouts and safety ceilings are build-owned. */
export function validateWebGpuModelSpec(value: unknown): TransformersWebGpuModelSpec {
    const m = object(value);
    keys(m, [
        "id",
        "name",
        "description",
        "repository",
        "revision",
        "dtype",
        "cacheKey",
        "artifacts",
        "artifactBytes",
        "modalities",
        "packagedModelBase",
        "developmentModelBase",
        "packagedArtifacts",
        "optionalAudio",
        "enabled",
        "adapter",
        "sessionDtypes",
        "externalData",
        "generation",
    ]);
    string(m.id, /^[a-z0-9][a-z0-9_-]{0,99}$/u);
    string(m.name);
    string(m.description, undefined, 2000);
    string(m.repository, repository);
    string(m.revision, revision);
    string(m.cacheKey, /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,159}$/u);
    if (
        !String(m.cacheKey).startsWith("openchat-model-") &&
        !defaults.models.some((model) => model.cacheKey === m.cacheKey)
    )
        fail("cacheKey must start with openchat-model-");
    boolean(m.enabled);
    const qwen = m.adapter === "qwen3-vl-2b-staged-v1";
    if (!qwen && m.adapter !== "gemma4-e2b-row-v1") fail("unsupported runtime adapter");
    const precisions = qwen ? ["q4", "fp16", "fp32"] : ["q4f16"];
    if (!precisions.includes(String(m.dtype))) fail("unsupported adapter precision");
    const base = artifacts(m.artifacts);
    const audio = m.optionalAudio === undefined ? undefined : object(m.optionalAudio);
    if (audio !== undefined) keys(audio, ["artifacts", "artifactBytes"]);
    const audioArtifacts = audio === undefined ? [] : artifacts(audio.artifacts);
    const all = [...base, ...audioArtifacts];
    if (new Set(all.map((a) => a.path)).size !== all.length) fail("duplicate base/audio artifacts");
    if (qwen && audio !== undefined) fail("this adapter has no audio encoder");
    if (
        !Array.isArray(m.modalities) ||
        !m.modalities.includes("text") ||
        new Set(m.modalities).size !== m.modalities.length ||
        m.modalities.some((modality) => !["text", "image", "audio"].includes(modality)) ||
        m.modalities.includes("audio") !== (audio !== undefined)
    )
        fail("unsupported modalities");
    const sessions = [
        "embed_tokens",
        "vision_encoder",
        "decoder_model_merged",
        ...(!qwen ? ["audio_encoder"] : []),
    ];
    const dtypes = object(m.sessionDtypes);
    const external = object(m.externalData);
    keys(dtypes, sessions);
    keys(external, sessions);
    for (const session of sessions) {
        if (!precisions.includes(String(dtypes[session]))) fail("unsupported session precision");
        const files = external[session];
        if (!Array.isArray(files) || files.length < 1 || files.length > 16)
            fail("invalid session shards");
        const names = new Set<string>();
        for (const file of files) {
            const entry = object(file);
            keys(entry, ["path", "name"]);
            const path = string(entry.path, safePath);
            const name = string(entry.name, safePath);
            if (names.has(name)) fail("duplicate session shard name");
            names.add(name);
            // Base sessions must not accidentally depend on the optional download.
            const manifest = session === "audio_encoder" ? audioArtifacts : base;
            if (session === "audio_encoder" && audio === undefined) continue;
            if (!manifest.some((a) => a.path === path)) fail("session shard missing from manifest");
        }
        if (session !== "audio_encoder" || audio !== undefined) {
            const manifest = session === "audio_encoder" ? audioArtifacts : base;
            const suffix = dtypes[session] === "fp32" ? "" : `_${dtypes[session]}`;
            if (!manifest.some((a) => a.path === `onnx/${session}${suffix}.onnx`))
                fail("session graph missing");
        }
    }
    if (
        !qwen &&
        !base.some((a) => a.path === "onnx/embed_tokens_q4f16.onnx_data" && a.bytes === 1590689792)
    ) {
        fail("Gemma row adapter requires the supported E2B embedding layout");
    }
    for (const required of [
        "config.json",
        "generation_config.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "processor_config.json",
        "chat_template.jinja",
        ...(qwen ? ["preprocessor_config.json"] : []),
    ]) {
        if (!base.some((a) => a.path === required)) fail(`missing ${required}`);
    }
    if (
        !Array.isArray(m.packagedArtifacts) ||
        m.packagedArtifacts.some(
            (path) => typeof path !== "string" || !base.some((a) => a.path === path),
        )
    )
        fail("unknown hosted artifact");
    if (m.packagedArtifacts.length > 0 && m.packagedModelBase === undefined)
        fail("hosted artifact base missing");
    for (const base of [m.packagedModelBase, m.developmentModelBase]) {
        if (base === undefined) continue;
        const url = string(base, undefined, 2000);
        if (
            !url.endsWith("/") ||
            (!url.startsWith("/assets/") &&
                !url.startsWith("/hf-model/") &&
                !url.startsWith("https://")) ||
            url.includes("..") ||
            url.includes("?") ||
            url.includes("#") ||
            url.includes("\\")
        )
            fail("unsafe artifact base");
        if (url.startsWith("https://")) {
            const parsed = new URL(url);
            if (parsed.username || parsed.password) fail("artifact credentials are not allowed");
        }
    }
    const g = object(m.generation);
    keys(g, ["maxOutputTokens", "doSample", "temperature", "topP", "topK", "repetitionPenalty"]);
    number(g.maxOutputTokens, 1, 96);
    boolean(g.doSample);
    number(g.temperature, 0.01, 2, false);
    number(g.topP, 0.01, 1, false);
    number(g.topK, 1, 100);
    number(g.repetitionPenalty, 0.5, 2, false);
    const total = base.reduce((sum, a) => sum + a.bytes, 0);
    if (total > 16 * 1024 ** 3) fail("model exceeds download safety limit");
    return freeze({
        ...m,
        artifacts: base,
        artifactBytes: total,
        ...(audio === undefined
            ? {}
            : {
                  optionalAudio: {
                      artifacts: audioArtifacts,
                      artifactBytes: audioArtifacts.reduce((sum, a) => sum + a.bytes, 0),
                  },
              }),
    } as TransformersWebGpuModelSpec);
}

export function parseWebGpuModelCatalog(input: string | unknown): WebGpuModelCatalog {
    const serialized = typeof input === "string" ? input : JSON.stringify(input);
    if (new TextEncoder().encode(serialized).length > WEB_GPU_CATALOG_MAX_BYTES)
        fail("catalog too large");
    const c = object(JSON.parse(serialized));
    keys(c, ["schemaVersion", "version", "models"]);
    if (c.schemaVersion !== 1) fail("unsupported schema version");
    string(c.version);
    if (!Array.isArray(c.models) || c.models.length > 32) fail("invalid model count");
    const models = c.models.map(validateWebGpuModelSpec);
    if (
        new Set(models.map((m) => m.id)).size !== models.length ||
        new Set(models.map((m) => m.cacheKey)).size !== models.length
    )
        fail("duplicate model/cache identity");
    return freeze({ schemaVersion: 1, version: c.version as string, models });
}

let current = parseWebGpuModelCatalog(defaults);
const history = new Map(current.models.map((m) => [m.cacheKey, m]));
function storage(): Storage | undefined {
    try {
        return globalThis.localStorage;
    } catch {
        return undefined;
    }
}
function cacheIdentity(model: TransformersWebGpuModelSpec): string {
    const identities = (files: readonly TransformersWebGpuArtifact[]) =>
        files
            .map(({ path, bytes, sha256 }) => [path, bytes, sha256])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return JSON.stringify([
        model.id,
        model.repository,
        model.revision,
        identities(model.artifacts),
        identities(model.optionalAudio?.artifacts ?? []),
    ]);
}
/** Atomic replace, never append built-ins to a remotely removed list and never delete weight caches. */
export function applyWebGpuModelCatalog(
    input: string | unknown,
    persist = true,
): WebGpuModelCatalog {
    const next = parseWebGpuModelCatalog(input);
    for (const model of next.models) {
        for (const old of history.values()) {
            if (old.cacheKey === model.cacheKey && cacheIdentity(old) !== cacheIdentity(model)) {
                fail("changed artifacts require a new cacheKey");
            }
        }
    }
    const nextHistory = new Map(history);
    for (const model of next.models) nextHistory.set(model.cacheKey, model);
    if (nextHistory.size > 128)
        fail("this device has reached the 128-version catalog history limit");
    const snapshot = JSON.stringify({ catalog: next, history: [...nextHistory.values()] });
    if (snapshot.length > 4 * 1024 * 1024)
        fail("catalog history exceeds the offline storage limit");
    if (persist) {
        const target = storage();
        if (target === undefined)
            throw new Error("Catalog storage is unavailable; changes were not applied.");
        // One storage transaction: a quota failure cannot leave a partially updated catalog/history.
        target.setItem(STORAGE_KEY, snapshot);
    }
    current = next;
    for (const model of next.models) history.set(model.cacheKey, model);
    for (const notify of listeners) notify();
    return current;
}
// Synchronous offline restore precedes selected-model restoration and never delays chat startup.
try {
    const saved = storage()?.getItem(STORAGE_KEY);
    if (saved && saved.length <= 4 * 1024 * 1024) {
        const snapshot = object(JSON.parse(saved));
        const catalog = parseWebGpuModelCatalog(snapshot.catalog);
        if (!Array.isArray(snapshot.history) || snapshot.history.length > 128)
            fail("invalid history");
        // Validate every entry before mutating any live registry state.
        const restored = snapshot.history.map(validateWebGpuModelSpec);
        if (
            new Set([...current.models, ...restored, ...catalog.models].map((m) => m.cacheKey))
                .size > 128
        )
            fail("saved history exceeds the version limit");
        const identities = new Map(
            [...current.models, ...restored, ...catalog.models].map((m) => [
                m.cacheKey,
                cacheIdentity(m),
            ]),
        );
        for (const m of [...current.models, ...restored, ...catalog.models]) {
            if (identities.get(m.cacheKey) !== cacheIdentity(m))
                fail("conflicting saved cache identity");
        }
        for (const m of restored) history.set(m.cacheKey, m);
        applyWebGpuModelCatalog(catalog, false);
    }
} catch {
    /* Keep the bundled catalog if persisted configuration is invalid. */
}

export function currentWebGpuModelCatalog(): WebGpuModelCatalog {
    return current;
}
/** The operator may remove old downloads explicitly; catalog updates themselves never do so. */
export function retainedWebGpuModelCaches(): readonly TransformersWebGpuModelSpec[] {
    const enabled = new Set(current.models.filter((m) => m.enabled).map((m) => m.cacheKey));
    return [...history.values()].filter((m) => !enabled.has(m.cacheKey));
}
export async function removeRetainedWebGpuModelCache(cacheKey: string): Promise<void> {
    if (!retainedWebGpuModelCaches().some((m) => m.cacheKey === cacheKey)) {
        throw new Error("Only a retained, inactive model cache can be removed here.");
    }
    if (globalThis.caches === undefined) throw new Error("Model cache storage is unavailable.");
    await globalThis.caches.delete(cacheKey);
    // Keep one disabled identity per removed id for persisted-selection routing, while permitting
    // obsolete revisions to be forgotten without accumulating unbounded configuration history.
    const model = history.get(cacheKey)!;
    if ([...history.values()].some((m) => m.id === model.id && m.cacheKey !== cacheKey)) {
        history.delete(cacheKey);
    }
    storage()?.setItem(
        STORAGE_KEY,
        JSON.stringify({ catalog: current, history: [...history.values()] }),
    );
    for (const notify of listeners) notify();
}

export function webGpuGenerationOptions(spec: TransformersWebGpuModelSpec, requested?: number) {
    if (requested !== undefined) number(requested, 1, Number.MAX_SAFE_INTEGER);
    const g = spec.generation;
    return {
        max_new_tokens: Math.min(requested ?? g.maxOutputTokens, g.maxOutputTokens, 96),
        do_sample: g.doSample,
        temperature: g.temperature,
        top_p: g.topP,
        top_k: g.topK,
        repetition_penalty: g.repetitionPenalty,
    };
}
export function currentWebGpuModelSpec(
    id: string | undefined,
): TransformersWebGpuModelSpec | undefined {
    if (id === undefined) return undefined;
    const listed = current.models.find((m) => m.id === id);
    if (listed) return listed;
    const old = [...history.values()].findLast((model) => model.id === id);
    return old === undefined ? undefined : freeze({ ...old, enabled: false });
}
export function subscribeWebGpuModelCatalog(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
export function modelCatalogSource(): string {
    try {
        return storage()?.getItem(SOURCE_KEY) ?? "";
    } catch {
        return "";
    }
}
export async function refreshWebGpuModelCatalog(
    source = modelCatalogSource(),
): Promise<WebGpuModelCatalog> {
    const url = new URL(
        source || "/model-catalog.json",
        globalThis.location?.href ?? "https://localhost/",
    );
    if (url.protocol !== "https:" && !(url.origin === globalThis.location?.origin)) {
        throw new Error("Use an HTTPS model catalog or a same-origin local development URL.");
    }
    if (url.username || url.password || url.hash)
        throw new Error("Catalog URL must not contain credentials or a fragment.");
    const response = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
        throw new Error(`Catalog request failed (${response.status}). Existing catalog retained.`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Catalog response has no body.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.length;
            if (length > WEB_GPU_CATALOG_MAX_BYTES)
                throw new Error("Model catalog exceeds 512 KiB.");
            chunks.push(value);
        }
    } finally {
        await reader.cancel();
        reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    const parsed = parseWebGpuModelCatalog(new TextDecoder().decode(bytes));
    const oldSource = storage()?.getItem(SOURCE_KEY);
    storage()?.setItem(SOURCE_KEY, source);
    try {
        return applyWebGpuModelCatalog(parsed);
    } catch (error) {
        if (oldSource === null || oldSource === undefined) storage()?.removeItem(SOURCE_KEY);
        else storage()?.setItem(SOURCE_KEY, oldSource);
        throw error;
    }
}
