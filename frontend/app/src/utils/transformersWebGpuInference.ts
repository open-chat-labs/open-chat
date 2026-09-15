import { subscribeWebGpuModelCatalog } from "./webGpuModelCatalog";
import { isAndroidTauriApp, type InferenceRequest, type InferenceResult } from "@shared";
import { sha256 } from "@noble/hashes/sha2.js";
import {
    transformersWebGpuFeatureEnabled,
    transformersWebGpuProductionAssetsEnabled,
} from "../../transformersWebGpuFeatureFlag.mjs";
import { readTransformersWebGpuDevRuntimeVersion } from "./transformersWebGpuDevRuntimeVersion";
import {
    transformersWebGpuArtifactSourceHeaders,
    transformTransformersWebGpuArtifactResponse,
} from "./transformersWebGpuArtifactTransform";
import {
    decodeTransformersWebGpuAudio,
    TRANSFORMERS_WEBGPU_AUDIO_DECODE_TIMEOUT_MS,
    TRANSFORMERS_WEBGPU_AUDIO_SAMPLE_RATE,
    TRANSFORMERS_WEBGPU_MAX_ENCODED_AUDIO_BYTES,
} from "./transformersWebGpuAudio";
import {
    PHONE_GEMMA4_E2B_MODEL_ID,
    PHONE_QWEN3_VL_2B_MODEL_ID,
    TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON,
    TRANSFORMERS_WEBGPU_HUGGING_FACE_BASE,
    TRANSFORMERS_WEBGPU_MODEL_PROXY_BASE,
    TRANSFORMERS_WEBGPU_RUNTIME_ASSETS,
    transformersWebGpuModelSpec,
    type TransformersWebGpuArtifact,
    type TransformersWebGpuFromWorker,
    type TransformersWebGpuModelId,
    type TransformersWebGpuModelSpec,
    type TransformersWebGpuProgressPhase,
    type TransformersWebGpuToWorker,
} from "./transformersWebGpuProtocol";

export interface TransformersWebGpuWorker {
    onmessage: ((event: MessageEvent<TransformersWebGpuFromWorker>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    postMessage(message: TransformersWebGpuToWorker, transfer?: Transferable[]): void;
    terminate(): void;
}

export type TransformersWebGpuWorkerFactory = () => TransformersWebGpuWorker;

export type TransformersWebGpuRuntimeAvailability =
    | { available: true }
    | { available: false; reason: string };

export type TransformersWebGpuStatus = {
    phase: TransformersWebGpuProgressPhase | "idle";
    stage?: "text" | "image" | "audio";
    progress?: number;
    file?: string;
};

export type TransformersWebGpuEngine = {
    infer(request: InferenceRequest, modelId?: TransformersWebGpuModelId): Promise<InferenceResult>;
    dispose(): Promise<void>;
};

type SpikeEligibility = {
    enabled: boolean;
    mobile: boolean;
    selectedModelId: string | undefined;
};

const DEFAULT_JOB_TIMEOUT_MS = 15 * 60_000;
const DEFAULT_WORKER_SHUTDOWN_GRACE_MS = 30_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_TOKENS = 96;
const CACHE_DIGEST_HEADER = "x-content-sha256";
const RUNTIME_VERSION_HEADER = "x-openchat-runtime-version";
const RUNTIME_ASSET_HEADER = "x-openchat-runtime-asset";
const CACHED_HASH_UPDATE_MAX_BYTES = 64 * 1024;
const CACHED_HASH_TASK_MAX_BYTES = 4 * 1024 * 1024;
const CACHED_HASH_TASK_BUDGET_MS = 8;

const defaultCacheVerification = new Map<TransformersWebGpuModelId, Promise<boolean>>();
const defaultModelArtifactVerification = new Map<TransformersWebGpuModelId, Promise<boolean>>();
const defaultRuntimeOfflineVerification = new Map<TransformersWebGpuModelId, Promise<boolean>>();
const defaultAudioVerification = new Map<TransformersWebGpuModelId, Promise<boolean>>();
const defaultVerifiedAudioModels = new Set<TransformersWebGpuModelId>();

export const TRANSFORMERS_WEBGPU_MODEL_NOT_DOWNLOADED_MESSAGE =
    "The selected Qwen3-VL 2B model needs an update or its all-WebGPU download is incomplete. Open On-device models and tap Retry download before running an image.";

export const TRANSFORMERS_WEBGPU_GEMMA_MODEL_NOT_DOWNLOADED_MESSAGE =
    "The selected Gemma 4 E2B model needs an update or its all-WebGPU download is incomplete. Open On-device models and tap Retry download before processing this message.";

export const TRANSFORMERS_WEBGPU_GEMMA_AUDIO_NOT_DOWNLOADED_MESSAGE =
    "Gemma voice support is not installed. Open On-device models and download the optional voice-message add-on, then try again.";

export function transformersWebGpuModelNotDownloadedMessage(modelId: string | undefined): string {
    const spec = transformersWebGpuModelSpec(modelId);
    if (spec?.enabled === false)
        return "This model was removed or disabled in the catalog. Its download is retained; select an enabled model in On-device models.";
    if (
        modelId !== PHONE_QWEN3_VL_2B_MODEL_ID &&
        modelId !== PHONE_GEMMA4_E2B_MODEL_ID &&
        spec !== undefined
    ) {
        return `${spec.name} needs an update or its download is incomplete. Open On-device models and tap Retry download.`;
    }
    return modelId === PHONE_GEMMA4_E2B_MODEL_ID
        ? TRANSFORMERS_WEBGPU_GEMMA_MODEL_NOT_DOWNLOADED_MESSAGE
        : TRANSFORMERS_WEBGPU_MODEL_NOT_DOWNLOADED_MESSAGE;
}

export type TransformersWebGpuArtifactCache = Pick<Cache, "match" | "put" | "delete"> &
    Partial<Pick<Cache, "keys">>;
export type TransformersWebGpuArtifactCacheStorage = {
    open(name: string): Promise<TransformersWebGpuArtifactCache>;
};

export type TransformersWebGpuPreloadOptions = {
    signal?: AbortSignal;
    onProgress?: (received: number, total: number) => void;
    cacheStorage?: TransformersWebGpuArtifactCacheStorage;
    fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    baseUrl?: string;
    runtimeVersion?: string;
    /** Test seam. Production derives this from the Android Tauri bridge and feature flag. */
    packagedAndroid?: boolean;
    /** Test seam. Production always streams and hashes the stored response body. */
    cacheBodyVerifier?: (
        response: Response,
        bytes: number,
        sha256: string,
        signal?: AbortSignal,
    ) => Promise<boolean>;
};

function requiredSpec(modelId: string | undefined): TransformersWebGpuModelSpec {
    const spec = transformersWebGpuModelSpec(modelId);
    if (spec === undefined)
        throw new Error("This all-WebGPU model is not supported by this build.");
    return spec;
}

function resolveModelAndOptions<T extends object>(
    modelOrOptions: string | T | undefined,
    options: T | undefined,
): { spec: TransformersWebGpuModelSpec; options: T } {
    if (typeof modelOrOptions === "string") {
        return { spec: requiredSpec(modelOrOptions), options: (options ?? {}) as T };
    }
    return {
        spec: requiredSpec(PHONE_QWEN3_VL_2B_MODEL_ID),
        options: (modelOrOptions ?? {}) as T,
    };
}

function runtimeVersion(explicit?: string): string {
    const developmentGeneration = readTransformersWebGpuDevRuntimeVersion(
        typeof document === "undefined" ? undefined : document,
    );
    return explicit ?? developmentGeneration ?? import.meta.env.OC_WEBSITE_VERSION ?? "development";
}

function usesDefaultReadinessDependencies(
    options: Pick<
        TransformersWebGpuPreloadOptions,
        | "cacheStorage"
        | "baseUrl"
        | "runtimeVersion"
        | "cacheBodyVerifier"
        | "fetcher"
        | "packagedAndroid"
    >,
): boolean {
    return (
        options.cacheStorage === undefined &&
        options.baseUrl === undefined &&
        options.runtimeVersion === undefined &&
        options.cacheBodyVerifier === undefined &&
        options.fetcher === undefined &&
        options.packagedAndroid === undefined
    );
}

/** Invalidate the per-page proof when selection/cancellation changes the underlying cache. */
subscribeWebGpuModelCatalog(() => invalidateTransformersWebGpuReadiness());

function readinessKey(spec: TransformersWebGpuModelSpec): string {
    return JSON.stringify(spec);
}
export function invalidateTransformersWebGpuReadiness(_modelId?: TransformersWebGpuModelId): void {
    defaultCacheVerification.clear();
    defaultModelArtifactVerification.clear();
    defaultRuntimeOfflineVerification.clear();
    defaultAudioVerification.clear();
    defaultVerifiedAudioModels.clear();
}

function artifactUrl(
    spec: Pick<TransformersWebGpuModelSpec, "repository" | "revision">,
    path: string,
    baseUrl?: string,
): string {
    const base =
        baseUrl ??
        (typeof globalThis.location === "undefined"
            ? "http://localhost/"
            : globalThis.location.href);
    return new URL(
        `${TRANSFORMERS_WEBGPU_MODEL_PROXY_BASE}${spec.repository}/resolve/${spec.revision}/${path}`,
        base,
    ).href;
}

export function transformersWebGpuPackagedAndroidClient(): boolean {
    return transformersWebGpuClientEnabled() && isAndroidTauriApp();
}

/**
 * Source used only while Model Manager owns the pinned download. Cache identity remains the local
 * `/hf-model/...` URL consumed by the fail-closed worker. A packaged Android app has no Vite proxy,
 * so immutable Hub files are fetched directly while the two audited Adreno graphs come from the APK.
 * The production web contract uses the same sources, with those graphs served by the web bundle.
 */
export function transformersWebGpuArtifactDownloadUrl(
    path: string,
    options: Pick<TransformersWebGpuPreloadOptions, "baseUrl" | "packagedAndroid"> = {},
    modelId: string = PHONE_QWEN3_VL_2B_MODEL_ID,
): string {
    const spec = requiredSpec(modelId);
    const artifact = [...spec.artifacts, ...(spec.optionalAudio?.artifacts ?? [])].find(
        (artifact) => artifact.path === path,
    );
    if (artifact === undefined) {
        throw new Error("Only artifacts in the immutable model manifest may be downloaded.");
    }
    const packaged =
        options.packagedAndroid === true ||
        (options.packagedAndroid === undefined && transformersWebGpuPackagedAndroidClient());
    const productionAssets = transformersWebGpuProductionAssetsEnabled(
        transformersWebGpuBuildEnvironment(),
    );
    if (artifact.source !== undefined) {
        transformersWebGpuArtifactSourceHeaders(artifact);
        const source = artifact.source;
        return !packaged && !productionAssets
            ? artifactUrl(source, source.path, options.baseUrl)
            : new URL(
                  `${source.repository}/resolve/${source.revision}/${source.path}`,
                  TRANSFORMERS_WEBGPU_HUGGING_FACE_BASE,
              ).href;
    }
    if (spec.packagedModelBase !== undefined && spec.packagedArtifacts.includes(path)) {
        const base =
            options.baseUrl ??
            (typeof globalThis.location === "undefined"
                ? "http://tauri.localhost/"
                : globalThis.location.href);
        const hostedBase =
            !packaged && !productionAssets
                ? (spec.developmentModelBase ?? spec.packagedModelBase)
                : spec.packagedModelBase;
        return new URL(`${hostedBase}${path}`, base).href;
    }
    if (!packaged && !productionAssets) return artifactUrl(spec, path, options.baseUrl);
    return new URL(
        `${spec.repository}/resolve/${spec.revision}/${path}`,
        TRANSFORMERS_WEBGPU_HUGGING_FACE_BASE,
    ).href;
}

export function transformersWebGpuRuntimeAssetUrl(
    asset: (typeof TRANSFORMERS_WEBGPU_RUNTIME_ASSETS)[number],
    baseUrl?: string,
    explicitRuntimeVersion?: string,
): string {
    const base =
        baseUrl ??
        (typeof globalThis.location === "undefined"
            ? "http://localhost/"
            : globalThis.location.href);
    const url = new URL(asset.path, base);
    if (asset.kind === "worker") url.searchParams.set("v", runtimeVersion(explicitRuntimeVersion));
    return url.href;
}

function digestHex(digest: Uint8Array): string {
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function abortReason(signal: AbortSignal): unknown {
    return signal.reason ?? new DOMException("cancelled", "AbortError");
}

function cachedArtifactMatches(
    response: Response | undefined,
    artifact: TransformersWebGpuArtifact,
): boolean {
    if (response === undefined || !response.ok) return false;
    return (
        Number(response.headers.get("content-length")) === artifact.bytes &&
        response.headers.get(CACHE_DIGEST_HEADER)?.toLowerCase() === artifact.sha256
    );
}

async function openArtifactCache(
    storage: TransformersWebGpuArtifactCacheStorage | undefined,
    spec: TransformersWebGpuModelSpec,
): Promise<TransformersWebGpuArtifactCache> {
    const available = storage ?? globalThis.caches;
    if (available === undefined) {
        throw new Error("This browser cannot store the all-WebGPU model files.");
    }
    return available.open(spec.cacheKey);
}

type TransformersWebGpuDownloadedOptions = Pick<
    TransformersWebGpuPreloadOptions,
    | "cacheStorage"
    | "baseUrl"
    | "runtimeVersion"
    | "cacheBodyVerifier"
    | "signal"
    | "packagedAndroid"
>;

/**
 * Cheap, UI-only installed hint. This checks that every immutable model artifact has the pinned
 * metadata in this model's own revisioned cache, but deliberately does not stream multi-gigabyte
 * bodies. Activation still goes through `transformersWebGpuModelDownloaded`, which performs the
 * full body verification before inference. Keeping this separate lets Model Manager show cached,
 * inactive models without weakening the fail-closed runtime boundary.
 */
export async function transformersWebGpuModelArtifactsPresent(
    modelId: string,
    options: Pick<TransformersWebGpuDownloadedOptions, "cacheStorage" | "baseUrl"> = {},
): Promise<boolean> {
    const spec = requiredSpec(modelId);
    try {
        const cache = await openArtifactCache(options.cacheStorage, spec);
        for (const artifact of spec.artifacts) {
            const cached = await cache.match(artifactUrl(spec, artifact.path, options.baseUrl));
            if (!cachedArtifactMatches(cached, artifact)) return false;
        }
        return true;
    } catch {
        return false;
    }
}

/** True only when every immutable model artifact is present under the exact cache key and digest.
 * Runtime assets are deliberately separate: the APK worker URL changes with each client build,
 * while multi-gigabyte model weights remain the same pinned revision. */
export function transformersWebGpuModelArtifactsDownloaded(
    options?: TransformersWebGpuDownloadedOptions,
): Promise<boolean>;
export function transformersWebGpuModelArtifactsDownloaded(
    modelId: string,
    options?: TransformersWebGpuDownloadedOptions,
): Promise<boolean>;
export async function transformersWebGpuModelArtifactsDownloaded(
    modelOrOptions: string | TransformersWebGpuDownloadedOptions = {},
    maybeOptions: TransformersWebGpuDownloadedOptions = {},
): Promise<boolean> {
    const resolved = resolveModelAndOptions(modelOrOptions, maybeOptions);
    const { spec } = resolved;
    const options = resolved.options;
    const useMemo = usesDefaultReadinessDependencies(options);
    const memoized = defaultModelArtifactVerification.get(readinessKey(spec));
    if (useMemo && memoized !== undefined) return memoized;

    const verification = (async (): Promise<boolean> => {
        try {
            const cache = await openArtifactCache(options.cacheStorage, spec);
            const verifyBody = options.cacheBodyVerifier ?? cachedResponseBodyMatches;
            for (const artifact of spec.artifacts) {
                const url = artifactUrl(spec, artifact.path, options.baseUrl);
                const cached = await cache.match(url);
                if (
                    !cachedArtifactMatches(cached, artifact) ||
                    !(await verifyBody(cached!, artifact.bytes, artifact.sha256, options.signal))
                ) {
                    if (cached !== undefined) await cache.delete(url).catch(() => undefined);
                    return false;
                }
            }
            return true;
        } catch (error) {
            if (options.signal?.aborted === true) throw abortReason(options.signal);
            return false;
        }
    })();
    if (useMemo) defaultModelArtifactVerification.set(readinessKey(spec), verification);
    let verified: boolean;
    try {
        verified = await verification;
    } catch (error) {
        if (useMemo && defaultModelArtifactVerification.get(readinessKey(spec)) === verification) {
            defaultModelArtifactVerification.delete(readinessKey(spec));
        }
        throw error;
    }
    if (
        useMemo &&
        !verified &&
        defaultModelArtifactVerification.get(readinessKey(spec)) === verification
    ) {
        defaultModelArtifactVerification.delete(readinessKey(spec));
    }
    return verified;
}

/** True only when every pinned model input and the current build's runtime assets are verified. */
export function transformersWebGpuModelDownloaded(
    options?: TransformersWebGpuDownloadedOptions,
): Promise<boolean>;
export function transformersWebGpuModelDownloaded(
    modelId: string,
    options?: TransformersWebGpuDownloadedOptions,
): Promise<boolean>;
export async function transformersWebGpuModelDownloaded(
    modelOrOptions: string | TransformersWebGpuDownloadedOptions = {},
    maybeOptions: TransformersWebGpuDownloadedOptions = {},
): Promise<boolean> {
    const resolved = resolveModelAndOptions(modelOrOptions, maybeOptions);
    const { spec } = resolved;
    const options = resolved.options;
    const useMemo = usesDefaultReadinessDependencies(options);
    const memoized = defaultCacheVerification.get(readinessKey(spec));
    if (useMemo && memoized !== undefined) return memoized;

    const verification = (async (): Promise<boolean> => {
        try {
            if (!(await transformersWebGpuModelArtifactsDownloaded(spec.id, options))) return false;
            const cache = await openArtifactCache(options.cacheStorage, spec);
            const verifyBody = options.cacheBodyVerifier ?? cachedResponseBodyMatches;
            for (const asset of TRANSFORMERS_WEBGPU_RUNTIME_ASSETS) {
                const url = transformersWebGpuRuntimeAssetUrl(
                    asset,
                    options.baseUrl,
                    options.runtimeVersion,
                );
                const cached = await cache.match(url);
                if (
                    !(await cachedRuntimeAssetMatches(
                        cached,
                        asset,
                        options.runtimeVersion,
                        verifyBody,
                        options.signal,
                    ))
                ) {
                    if (cached !== undefined) await cache.delete(url).catch(() => undefined);
                    return false;
                }
            }
            return true;
        } catch (error) {
            if (options.signal?.aborted === true) throw abortReason(options.signal);
            return false;
        }
    })();
    if (useMemo) defaultCacheVerification.set(readinessKey(spec), verification);
    let verified: boolean;
    try {
        verified = await verification;
    } catch (error) {
        if (useMemo && defaultCacheVerification.get(readinessKey(spec)) === verification) {
            defaultCacheVerification.delete(readinessKey(spec));
        }
        throw error;
    }
    if (useMemo && !verified && defaultCacheVerification.get(readinessKey(spec)) === verification) {
        defaultCacheVerification.delete(readinessKey(spec));
    }
    return verified;
}

function signalAborted(signal: AbortSignal | undefined): boolean {
    return signal?.aborted === true;
}

async function runtimeResponseBytes(
    response: Response,
    asset: (typeof TRANSFORMERS_WEBGPU_RUNTIME_ASSETS)[number],
): Promise<{ bytes: Uint8Array; digest: string }> {
    if (!response.ok || response.body === null) {
        throw new Error(`Failed to download ${asset.path} (HTTP ${response.status}).`);
    }
    if (asset.kind === "worker") {
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (!contentType.includes("javascript")) {
            throw new Error("The all-WebGPU worker endpoint did not return JavaScript.");
        }
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const digest = digestHex(sha256(bytes));
    if (asset.kind === "pinned") {
        if (bytes.byteLength !== asset.bytes || digest !== asset.sha256) {
            throw new Error(`${asset.path} failed its pinned SHA-256 check.`);
        }
    } else if (bytes.byteLength < asset.minimumBytes || bytes.byteLength > asset.maximumBytes) {
        throw new Error("The all-WebGPU worker has an invalid byte count.");
    }
    return { bytes, digest };
}

async function fetchRuntimeAssetForSelection(
    fetcher: NonNullable<TransformersWebGpuPreloadOptions["fetcher"]>,
    url: string,
    signal: AbortSignal | undefined,
): Promise<{ response: Response; cacheOnly: boolean }> {
    // A cache-only lookup never reaches the network. On a miss, Model Manager or persisted-startup
    // restore owns the one reload fetch that primes the HTTP cache used by Worker construction and
    // ORT's module loader. Neither caller reaches model-weight URLs through this helper.
    try {
        const cached = await fetcher(url, {
            signal,
            cache: "only-if-cached",
            mode: "same-origin",
            credentials: "same-origin",
        });
        if (cached.ok) return { response: cached, cacheOnly: true };
    } catch {
        if (signal?.aborted === true) throw abortReason(signal);
    }
    return {
        response: await fetcher(url, {
            signal,
            cache: "reload",
            mode: "same-origin",
            credentials: "same-origin",
        }),
        cacheOnly: false,
    };
}

async function preloadTransformersWebGpuRuntimeAssets(
    cache: TransformersWebGpuArtifactCache,
    options: TransformersWebGpuPreloadOptions,
): Promise<void> {
    const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    const verifyBody = options.cacheBodyVerifier ?? cachedResponseBodyMatches;
    for (const asset of TRANSFORMERS_WEBGPU_RUNTIME_ASSETS) {
        if (options.signal?.aborted === true) throw abortReason(options.signal);
        const url = transformersWebGpuRuntimeAssetUrl(
            asset,
            options.baseUrl,
            options.runtimeVersion,
        );
        const selected = await fetchRuntimeAssetForSelection(fetcher, url, options.signal);
        let response = selected.response;
        let verified: Awaited<ReturnType<typeof runtimeResponseBytes>>;
        try {
            verified = await runtimeResponseBytes(response, asset);
        } catch (error) {
            if (!selected.cacheOnly || signalAborted(options.signal)) throw error;
            // A corrupt/stale HTTP-cache entry must not trap Retry/startup restore forever. This
            // runtime-only refresh happens before the model can become selectable; model-weight
            // downloads remain exclusively owned by Model Manager.
            response = await fetcher(url, {
                signal: options.signal,
                cache: "reload",
                mode: "same-origin",
                credentials: "same-origin",
            });
            verified = await runtimeResponseBytes(response, asset);
        }
        const { bytes, digest } = verified;
        const headers = new Headers(response.headers);
        headers.delete("content-encoding");
        headers.delete("transfer-encoding");
        headers.set("content-length", String(bytes.byteLength));
        headers.set(CACHE_DIGEST_HEADER, digest);
        headers.set(RUNTIME_ASSET_HEADER, asset.kind);
        headers.set(RUNTIME_VERSION_HEADER, runtimeVersion(options.runtimeVersion));
        const storedBytes = bytes.slice().buffer as ArrayBuffer;
        await cache.put(url, new Response(storedBytes, { status: 200, statusText: "OK", headers }));
        const stored = await cache.match(url);
        if (
            !cachedRuntimeAssetMetadataMatches(stored, asset, options.runtimeVersion) ||
            !(await verifyBody(stored!, bytes.byteLength, digest, options.signal))
        ) {
            await cache.delete(url).catch(() => undefined);
            throw new Error(`${asset.path} was not retained by browser storage.`);
        }
    }
    await pruneSupersededTransformersWebGpuWorkers(cache, options);
}

async function pruneSupersededTransformersWebGpuWorkers(
    cache: TransformersWebGpuArtifactCache,
    options: Pick<TransformersWebGpuPreloadOptions, "baseUrl" | "runtimeVersion">,
): Promise<void> {
    if (cache.keys === undefined) return;
    const worker = TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.find((asset) => asset.kind === "worker");
    if (worker === undefined) return;
    const current = new URL(
        transformersWebGpuRuntimeAssetUrl(worker, options.baseUrl, options.runtimeVersion),
    );
    let requests: readonly Request[];
    try {
        requests = await cache.keys();
    } catch {
        return;
    }
    await Promise.all(
        requests.map(async (request) => {
            let candidate: URL;
            try {
                candidate = new URL(request.url);
            } catch {
                return;
            }
            if (
                candidate.origin === current.origin &&
                candidate.pathname === current.pathname &&
                candidate.href !== current.href
            ) {
                await cache.delete(candidate.href).catch(() => undefined);
            }
        }),
    );
}

/** Refresh only the small worker/ORT payload owned by the current client build.
 *
 * This is the update path for a persisted, already-verified model revision. It never requests a
 * model URL, so an APK update does not turn the existing multi-gigabyte Qwen/Gemma install into a
 * second model download. Model Manager remains the only owner of model-weight downloads. */
export function refreshTransformersWebGpuRuntimeAssets(
    options?: TransformersWebGpuPreloadOptions,
): Promise<void>;
export function refreshTransformersWebGpuRuntimeAssets(
    modelId: string,
    options?: TransformersWebGpuPreloadOptions,
): Promise<void>;
export async function refreshTransformersWebGpuRuntimeAssets(
    modelOrOptions: string | TransformersWebGpuPreloadOptions = {},
    maybeOptions: TransformersWebGpuPreloadOptions = {},
): Promise<void> {
    const resolved = resolveModelAndOptions(modelOrOptions, maybeOptions);
    const { spec } = resolved;
    const options = resolved.options;
    if (usesDefaultReadinessDependencies(options)) {
        defaultCacheVerification.delete(readinessKey(spec));
        defaultRuntimeOfflineVerification.delete(readinessKey(spec));
    }
    const cache = await openArtifactCache(options.cacheStorage, spec);
    await preloadTransformersWebGpuRuntimeAssets(cache, options);
    if (
        !(await transformersWebGpuRuntimeAvailableOffline(spec.id, {
            fetcher: options.fetcher,
            cacheStorage: options.cacheStorage,
            baseUrl: options.baseUrl,
            runtimeVersion: options.runtimeVersion,
            packagedAndroid: options.packagedAndroid,
        }))
    ) {
        throw new Error("The current all-WebGPU worker and ORT files could not be restored.");
    }
}

/** Check the HTTP cache without permitting network access before starting an image-model worker. */
export async function transformersWebGpuRuntimeAvailableOffline(
    modelOrOptions:
        | string
        | Pick<
              TransformersWebGpuPreloadOptions,
              "fetcher" | "baseUrl" | "runtimeVersion" | "cacheStorage" | "packagedAndroid"
          > = {},
    maybeOptions: Pick<
        TransformersWebGpuPreloadOptions,
        "fetcher" | "baseUrl" | "runtimeVersion" | "cacheStorage" | "packagedAndroid"
    > = {},
): Promise<boolean> {
    const resolved = resolveModelAndOptions(modelOrOptions, maybeOptions);
    const { spec } = resolved;
    const options = resolved.options;
    const useMemo = usesDefaultReadinessDependencies(options);
    const memoized = defaultRuntimeOfflineVerification.get(readinessKey(spec));
    if (useMemo && memoized !== undefined) {
        return memoized;
    }
    const verification = (async (): Promise<boolean> => {
        const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
        const packaged =
            options.packagedAndroid === true ||
            (options.packagedAndroid === undefined && transformersWebGpuPackagedAndroidClient());
        try {
            const artifactCache = await openArtifactCache(options.cacheStorage, spec);
            for (const asset of TRANSFORMERS_WEBGPU_RUNTIME_ASSETS) {
                const url = transformersWebGpuRuntimeAssetUrl(
                    asset,
                    options.baseUrl,
                    options.runtimeVersion,
                );
                const selected = await artifactCache.match(url);
                if (!cachedRuntimeAssetMetadataMatches(selected, asset, options.runtimeVersion)) {
                    return false;
                }
                if (packaged) {
                    // Worker and ORT assets are immutable APK resources. CacheStorage body proof is
                    // enough here; unlike an HTTP deployment, Worker construction never needs a
                    // prior network response in the WebView's HTTP cache.
                    const verified = await runtimeResponseBytes(selected!.clone(), asset);
                    if (
                        verified.bytes.byteLength !==
                            Number(selected!.headers.get("content-length")) ||
                        verified.digest !==
                            selected!.headers.get(CACHE_DIGEST_HEADER)?.toLowerCase()
                    ) {
                        return false;
                    }
                    continue;
                }
                const response = await fetcher(url, {
                    cache: "only-if-cached",
                    mode: "same-origin",
                    credentials: "same-origin",
                });
                const verified = await runtimeResponseBytes(response, asset);
                if (
                    verified.bytes.byteLength !== Number(selected!.headers.get("content-length")) ||
                    verified.digest !== selected!.headers.get(CACHE_DIGEST_HEADER)?.toLowerCase()
                ) {
                    return false;
                }
            }
            return true;
        } catch {
            return false;
        }
    })();
    if (useMemo) defaultRuntimeOfflineVerification.set(readinessKey(spec), verification);
    const verified = await verification;
    if (
        useMemo &&
        !verified &&
        defaultRuntimeOfflineVerification.get(readinessKey(spec)) === verification
    ) {
        defaultRuntimeOfflineVerification.delete(readinessKey(spec));
    }
    return verified;
}

/** Stream the exact revision into the same Cache API entry the worker reads. Hashing happens while
 * CacheStorage consumes each body, so the 1.1 GB decoder shard is never materialized in memory. */
export function preloadTransformersWebGpuModel(
    options?: TransformersWebGpuPreloadOptions,
): Promise<void>;
export function preloadTransformersWebGpuModel(
    modelId: string,
    options?: TransformersWebGpuPreloadOptions,
): Promise<void>;
export async function preloadTransformersWebGpuModel(
    modelOrOptions: string | TransformersWebGpuPreloadOptions = {},
    maybeOptions: TransformersWebGpuPreloadOptions = {},
): Promise<void> {
    const resolved = resolveModelAndOptions(modelOrOptions, maybeOptions);
    const { spec } = resolved;
    const options = resolved.options;
    if (usesDefaultReadinessDependencies(options)) invalidateTransformersWebGpuReadiness(spec.id);
    const cache = await openArtifactCache(options.cacheStorage, spec);
    const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    const signal = options.signal;
    const onProgress = options.onProgress ?? (() => undefined);
    const verifyBody = options.cacheBodyVerifier ?? cachedResponseBodyMatches;
    let completed = 0;
    let lastPublishedAt = 0;

    try {
        await globalThis.navigator?.storage?.persist?.();
    } catch {
        // Persistence is best-effort; CacheStorage remains usable when the prompt is denied.
    }

    onProgress(0, spec.artifactBytes);
    for (const artifact of spec.artifacts) {
        if (signal?.aborted === true) throw abortReason(signal);
        const url = artifactUrl(spec, artifact.path, options.baseUrl);
        const cached = await cache.match(url);
        if (
            cachedArtifactMatches(cached, artifact) &&
            (await verifyBody(cached!, artifact.bytes, artifact.sha256, signal))
        ) {
            completed += artifact.bytes;
            onProgress(completed, spec.artifactBytes);
            continue;
        }
        if (cached !== undefined) await cache.delete(url);

        const downloadUrl = transformersWebGpuArtifactDownloadUrl(artifact.path, options, spec.id);
        let response = await fetcher(downloadUrl, {
            signal,
            cache: "no-store",
            credentials: "same-origin",
            headers: transformersWebGpuArtifactSourceHeaders(artifact),
        });
        if (artifact.source !== undefined) {
            response = await transformTransformersWebGpuArtifactResponse(
                response,
                artifact,
                signal,
            );
        }
        if (!response.ok || response.body === null) {
            throw new Error(`Failed to download ${artifact.path} (HTTP ${response.status}).`);
        }
        const declared = Number(response.headers.get("content-length") ?? "0");
        const encoding = response.headers.get("content-encoding");
        if (
            Number.isFinite(declared) &&
            declared > 0 &&
            (encoding === null || encoding === "identity") &&
            declared !== artifact.bytes
        ) {
            throw new Error(`${artifact.path} changed size upstream; retry later.`);
        }

        let received = 0;
        const digest = sha256.create();
        const counted = response.body.pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
                transform(chunk, controller) {
                    if (signal?.aborted === true) {
                        controller.error(abortReason(signal));
                        return;
                    }
                    received += chunk.byteLength;
                    if (received > artifact.bytes) {
                        controller.error(new Error(`${artifact.path} exceeded its pinned size.`));
                        return;
                    }
                    digest.update(chunk);
                    const now = Date.now();
                    if (now - lastPublishedAt >= 100) {
                        lastPublishedAt = now;
                        onProgress(completed + received, spec.artifactBytes);
                    }
                    controller.enqueue(chunk);
                },
            }),
        );
        const headers = new Headers(response.headers);
        headers.delete("content-encoding");
        headers.delete("transfer-encoding");
        headers.set("content-length", String(artifact.bytes));
        headers.set(CACHE_DIGEST_HEADER, artifact.sha256);
        headers.set("x-openchat-model-revision", spec.revision);

        try {
            await cache.put(url, new Response(counted, { status: 200, statusText: "OK", headers }));
        } catch (error) {
            await cache.delete(url).catch(() => undefined);
            throw error;
        }
        const got = digestHex(digest.digest());
        if (received !== artifact.bytes || got !== artifact.sha256) {
            await cache.delete(url);
            throw new Error(`${artifact.path} failed its pinned SHA-256 check.`);
        }
        const stored = await cache.match(url);
        if (
            !cachedArtifactMatches(stored, artifact) ||
            !(await verifyBody(stored!, artifact.bytes, artifact.sha256, signal))
        ) {
            await cache.delete(url);
            throw new Error(`${artifact.path} was not retained by browser storage.`);
        }
        completed += artifact.bytes;
        onProgress(completed, spec.artifactBytes);
    }
    // Selection is not complete until the worker plus both pinned ORT files are verified and the
    // browser HTTP cache is primed. Inference itself is cache-only and cannot download them.
    await preloadTransformersWebGpuRuntimeAssets(cache, options);
    if (
        !(await transformersWebGpuRuntimeAvailableOffline(spec.id, {
            fetcher: options.fetcher,
            cacheStorage: options.cacheStorage,
            baseUrl: options.baseUrl,
            runtimeVersion: options.runtimeVersion,
            packagedAndroid: options.packagedAndroid,
        }))
    ) {
        throw new Error(
            "The browser did not retain the all-WebGPU worker and ORT files. Retry download before running an image.",
        );
    }
    if (usesDefaultReadinessDependencies(options)) {
        // Every CacheStorage body and every cache-only runtime response was proved during this
        // selection attempt. Subsequent focused passes and inference jobs reuse that per-page proof.
        defaultModelArtifactVerification.set(readinessKey(spec), Promise.resolve(true));
        defaultCacheVerification.set(readinessKey(spec), Promise.resolve(true));
    }
}

/** Verify only the optional Gemma audio files. Base model and runtime readiness are independent. */
export async function transformersWebGpuAudioDownloaded(
    modelId: string,
    options: TransformersWebGpuDownloadedOptions = {},
): Promise<boolean> {
    const spec = requiredSpec(modelId);
    const addon = spec.optionalAudio;
    if (addon === undefined) return false;
    const useMemo = usesDefaultReadinessDependencies(options);
    const memoized = defaultAudioVerification.get(readinessKey(spec));
    if (useMemo && memoized !== undefined) return memoized;
    const verification = (async (): Promise<boolean> => {
        try {
            const cache = await openArtifactCache(options.cacheStorage, spec);
            const verifyBody = options.cacheBodyVerifier ?? cachedResponseBodyMatches;
            for (const artifact of addon.artifacts) {
                const url = artifactUrl(spec, artifact.path, options.baseUrl);
                const cached = await cache.match(url);
                if (
                    !cachedArtifactMatches(cached, artifact) ||
                    !(await verifyBody(cached!, artifact.bytes, artifact.sha256, options.signal))
                ) {
                    if (cached !== undefined) await cache.delete(url).catch(() => undefined);
                    return false;
                }
            }
            return true;
        } catch (error) {
            if (options.signal?.aborted === true) throw abortReason(options.signal);
            return false;
        }
    })();
    if (useMemo) defaultAudioVerification.set(readinessKey(spec), verification);
    let verified: boolean;
    try {
        verified = await verification;
    } catch (error) {
        if (useMemo && defaultAudioVerification.get(readinessKey(spec)) === verification) {
            defaultAudioVerification.delete(readinessKey(spec));
            defaultVerifiedAudioModels.delete(readinessKey(spec));
        }
        throw error;
    }
    if (useMemo) {
        if (verified) {
            defaultVerifiedAudioModels.add(readinessKey(spec));
        } else {
            defaultVerifiedAudioModels.delete(readinessKey(spec));
            if (defaultAudioVerification.get(readinessKey(spec)) === verification) {
                defaultAudioVerification.delete(readinessKey(spec));
            }
        }
    }
    return verified;
}

/** Synchronous capability state backed only by a successful default-cache verification. */
export function transformersWebGpuAudioReady(modelId: string | undefined): boolean {
    const spec = transformersWebGpuModelSpec(modelId);
    return spec?.optionalAudio !== undefined && defaultVerifiedAudioModels.has(readinessKey(spec));
}

/** Install only Gemma's optional voice encoder. Running a voice message never calls this function. */
export async function preloadTransformersWebGpuAudio(
    modelId: string,
    options: TransformersWebGpuPreloadOptions = {},
): Promise<void> {
    const spec = requiredSpec(modelId);
    const addon = spec.optionalAudio;
    if (addon === undefined) {
        throw new Error(`${spec.name} does not provide an optional voice-message add-on.`);
    }
    if (usesDefaultReadinessDependencies(options)) {
        defaultAudioVerification.delete(readinessKey(spec));
        defaultVerifiedAudioModels.delete(readinessKey(spec));
    }
    if (!(await transformersWebGpuModelDownloaded(spec.id, options))) {
        throw new Error(transformersWebGpuModelNotDownloadedMessage(spec.id));
    }
    const cache = await openArtifactCache(options.cacheStorage, spec);
    const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    const signal = options.signal;
    const onProgress = options.onProgress ?? (() => undefined);
    const verifyBody = options.cacheBodyVerifier ?? cachedResponseBodyMatches;
    let completed = 0;
    let lastPublishedAt = 0;

    onProgress(0, addon.artifactBytes);
    for (const artifact of addon.artifacts) {
        if (signal?.aborted === true) throw abortReason(signal);
        const url = artifactUrl(spec, artifact.path, options.baseUrl);
        const cached = await cache.match(url);
        if (
            cachedArtifactMatches(cached, artifact) &&
            (await verifyBody(cached!, artifact.bytes, artifact.sha256, signal))
        ) {
            completed += artifact.bytes;
            onProgress(completed, addon.artifactBytes);
            continue;
        }
        if (cached !== undefined) await cache.delete(url);

        const downloadUrl = transformersWebGpuArtifactDownloadUrl(artifact.path, options, spec.id);
        let response = await fetcher(downloadUrl, {
            signal,
            cache: "no-store",
            credentials: "same-origin",
            headers: transformersWebGpuArtifactSourceHeaders(artifact),
        });
        if (artifact.source !== undefined) {
            response = await transformTransformersWebGpuArtifactResponse(
                response,
                artifact,
                signal,
            );
        }
        if (!response.ok || response.body === null) {
            throw new Error(`Failed to download ${artifact.path} (HTTP ${response.status}).`);
        }
        const declared = Number(response.headers.get("content-length") ?? "0");
        const encoding = response.headers.get("content-encoding");
        if (
            Number.isFinite(declared) &&
            declared > 0 &&
            (encoding === null || encoding === "identity") &&
            declared !== artifact.bytes
        ) {
            throw new Error(`${artifact.path} changed size upstream; retry later.`);
        }

        let received = 0;
        const digest = sha256.create();
        const counted = response.body.pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
                transform(chunk, controller) {
                    if (signal?.aborted === true) {
                        controller.error(abortReason(signal));
                        return;
                    }
                    received += chunk.byteLength;
                    if (received > artifact.bytes) {
                        controller.error(new Error(`${artifact.path} exceeded its pinned size.`));
                        return;
                    }
                    digest.update(chunk);
                    const now = Date.now();
                    if (now - lastPublishedAt >= 100) {
                        lastPublishedAt = now;
                        onProgress(completed + received, addon.artifactBytes);
                    }
                    controller.enqueue(chunk);
                },
            }),
        );
        const headers = new Headers(response.headers);
        headers.delete("content-encoding");
        headers.delete("transfer-encoding");
        headers.set("content-length", String(artifact.bytes));
        headers.set(CACHE_DIGEST_HEADER, artifact.sha256);
        headers.set("x-openchat-model-revision", spec.revision);
        try {
            await cache.put(url, new Response(counted, { status: 200, statusText: "OK", headers }));
        } catch (error) {
            await cache.delete(url).catch(() => undefined);
            throw error;
        }
        const got = digestHex(digest.digest());
        if (received !== artifact.bytes || got !== artifact.sha256) {
            await cache.delete(url);
            throw new Error(`${artifact.path} failed its pinned SHA-256 check.`);
        }
        const stored = await cache.match(url);
        if (
            !cachedArtifactMatches(stored, artifact) ||
            !(await verifyBody(stored!, artifact.bytes, artifact.sha256, signal))
        ) {
            await cache.delete(url);
            throw new Error(`${artifact.path} was not retained by browser storage.`);
        }
        completed += artifact.bytes;
        onProgress(completed, addon.artifactBytes);
    }
    if (usesDefaultReadinessDependencies(options)) {
        // Every optional body was streamed and hash-verified above. Voice inference reuses this
        // proof instead of rereading 171.5 MB from CacheStorage for every message.
        defaultAudioVerification.set(readinessKey(spec), Promise.resolve(true));
        defaultVerifiedAudioModels.add(readinessKey(spec));
    }
}

export async function deleteTransformersWebGpuAudio(
    modelId: string,
    storage: TransformersWebGpuArtifactCacheStorage | undefined = globalThis.caches,
): Promise<void> {
    const spec = requiredSpec(modelId);
    if (spec.optionalAudio === undefined) return;
    defaultAudioVerification.delete(readinessKey(spec));
    defaultVerifiedAudioModels.delete(readinessKey(spec));
    if (storage === undefined) return;
    await disposeTransformersWebGpuInference();
    const cache = await openArtifactCache(storage, spec);
    // Delete sequentially so a rejected operation cannot race the caller's post-failure
    // verification while another deletion is still mutating the same add-on cache.
    for (const artifact of spec.optionalAudio.artifacts) {
        await cache.delete(artifactUrl(spec, artifact.path));
    }
}

function transformersWebGpuBuildEnvironment() {
    return {
        OC_BUILD_ENV: import.meta.env.OC_BUILD_ENV,
        OC_DFX_NETWORK: import.meta.env.OC_DFX_NETWORK,
        OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE: import.meta.env.OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE,
        OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY: import.meta.env
            .OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY,
    };
}

export function transformersWebGpuSpikeEnabled(): boolean {
    return transformersWebGpuFeatureEnabled(transformersWebGpuBuildEnvironment());
}

function mobileBrowser(): boolean {
    if (typeof navigator === "undefined") return false;
    const hint = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
        ?.mobile;
    return hint === true || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** Pure admission predicate, injectable in tests and reused by the facade and webInfer seam. */
export function shouldUseTransformersWebGpuSpike(
    _request: InferenceRequest,
    eligibility: SpikeEligibility,
): boolean {
    return (
        eligibility.enabled &&
        eligibility.mobile &&
        transformersWebGpuModelSpec(eligibility.selectedModelId) !== undefined
    );
}

/** True for a mobile browser or Android WebView in a deliberately enabled runtime build. */
export function transformersWebGpuClientEnabled(): boolean {
    if (!transformersWebGpuSpikeEnabled() || !mobileBrowser()) return false;
    const nativeWebView = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    // Browser builds remain eligible on supported mobile browsers. Native packaging intentionally
    // ships the all-WebGPU payload only for Android; a flagged iOS WebView must stay on its
    // native route because its bundle does not contain the accelerated browser runtime.
    return (
        !nativeWebView || (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent))
    );
}

function cachedRuntimeAssetMetadataMatches(
    response: Response | undefined,
    asset: (typeof TRANSFORMERS_WEBGPU_RUNTIME_ASSETS)[number],
    explicitRuntimeVersion?: string,
): boolean {
    if (response === undefined || !response.ok) return false;
    if (response.headers.get(RUNTIME_ASSET_HEADER) !== asset.kind) return false;
    const bytes = Number(response.headers.get("content-length"));
    const digest = response.headers.get(CACHE_DIGEST_HEADER)?.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(digest ?? "")) return false;
    if (asset.kind === "pinned") return bytes === asset.bytes && digest === asset.sha256;
    return (
        bytes >= asset.minimumBytes &&
        bytes <= asset.maximumBytes &&
        response.headers.get(RUNTIME_VERSION_HEADER) === runtimeVersion(explicitRuntimeVersion)
    );
}

async function cachedRuntimeAssetMatches(
    response: Response | undefined,
    asset: (typeof TRANSFORMERS_WEBGPU_RUNTIME_ASSETS)[number],
    explicitRuntimeVersion: string | undefined,
    verifier: NonNullable<TransformersWebGpuPreloadOptions["cacheBodyVerifier"]>,
    signal?: AbortSignal,
): Promise<boolean> {
    if (!cachedRuntimeAssetMetadataMatches(response, asset, explicitRuntimeVersion)) return false;
    const bytes = Number(response!.headers.get("content-length"));
    const digest = response!.headers.get(CACHE_DIGEST_HEADER)!;
    return verifier(response!, bytes, digest, signal);
}

async function cachedResponseBodyMatches(
    response: Response,
    expectedBytes: number,
    expectedSha256: string,
    signal?: AbortSignal,
): Promise<boolean> {
    if (response.body === null) return false;
    const digest = sha256.create();
    const reader = response.body.getReader();
    let received = 0;
    let taskBytes = 0;
    let taskHashMs = 0;
    try {
        while (true) {
            if (signal?.aborted === true) {
                await reader.cancel(abortReason(signal));
                throw abortReason(signal);
            }
            const { done, value } = await reader.read();
            if (done) break;
            received += value.byteLength;
            if (received > expectedBytes) {
                await reader.cancel();
                return false;
            }
            // Cache streams may queue all their chunks already; awaiting read() alone then
            // only yields microtasks. Bound each synchronous SHA update, including a single
            // oversized stream chunk, and give input/rendering/cancellation a real task.
            for (
                let offset = 0;
                offset < value.byteLength;
                offset += CACHED_HASH_UPDATE_MAX_BYTES
            ) {
                if (signal?.aborted) {
                    await reader.cancel(abortReason(signal));
                    throw abortReason(signal);
                }
                const chunk = value.subarray(offset, offset + CACHED_HASH_UPDATE_MAX_BYTES);
                const started = performance.now();
                digest.update(chunk);
                taskHashMs += performance.now() - started;
                taskBytes += chunk.byteLength;
                if (
                    taskHashMs >= CACHED_HASH_TASK_BUDGET_MS ||
                    taskBytes >= CACHED_HASH_TASK_MAX_BYTES
                ) {
                    await new Promise<void>((resolve) => setTimeout(resolve, 0));
                    taskHashMs = 0;
                    taskBytes = 0;
                }
            }
        }
    } catch (error) {
        if (signal?.aborted === true) throw abortReason(signal);
        return false;
    }
    return received === expectedBytes && digestHex(digest.digest()) === expectedSha256;
}

export function transformersWebGpuSelectionCanHandle(selectedModelId: string | undefined): boolean {
    return (
        transformersWebGpuClientEnabled() &&
        transformersWebGpuModelSpec(selectedModelId)?.enabled === true
    );
}

export function transformersWebGpuSpikeCanHandle(
    _request: InferenceRequest,
    selectedModelId: string | undefined,
): boolean {
    return transformersWebGpuSelectionCanHandle(selectedModelId);
}

export function transformersWebGpuRuntimeAvailability(
    requiresImageApis = true,
): TransformersWebGpuRuntimeAvailability {
    if (
        typeof Worker === "undefined" ||
        typeof WebAssembly === "undefined" ||
        typeof Blob === "undefined"
    ) {
        return {
            available: false,
            reason: "This OpenChat client cannot start the on-device WebGPU image-model worker.",
        };
    }
    if (
        requiresImageApis &&
        (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined")
    ) {
        return {
            available: false,
            reason: "This OpenChat client cannot decode images inside the on-device WebGPU model worker.",
        };
    }
    const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
    if (gpu === undefined) {
        return {
            available: false,
            reason: TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON,
        };
    }
    return { available: true };
}

function defaultWorkerFactory(): TransformersWebGpuWorker {
    const workerUrl = transformersWebGpuRuntimeAssetUrl(TRANSFORMERS_WEBGPU_RUNTIME_ASSETS[0]);
    return new Worker(new URL(workerUrl, import.meta.url), {
        type: "module",
        name: "openchat-transformers-webgpu",
    });
}

export function createTransformersWebGpuEngine(
    factory: TransformersWebGpuWorkerFactory = defaultWorkerFactory,
    options: {
        available?: (requiresImageApis?: boolean) => TransformersWebGpuRuntimeAvailability;
        timeoutMs?: number;
        shutdownGraceMs?: number;
        publishStatus?: (status: TransformersWebGpuStatus) => void;
        decodeAudio?: (encoded: Uint8Array, mimeType: string) => Promise<Float32Array>;
    } = {},
): TransformersWebGpuEngine {
    const available = options.available ?? transformersWebGpuRuntimeAvailability;
    const timeoutMs = options.timeoutMs ?? DEFAULT_JOB_TIMEOUT_MS;
    const shutdownGraceMs = options.shutdownGraceMs ?? DEFAULT_WORKER_SHUTDOWN_GRACE_MS;
    const publishStatus = options.publishStatus ?? (() => undefined);
    const decodeAudio = options.decodeAudio ?? decodeTransformersWebGpuAudio;

    let worker: TransformersWebGpuWorker | undefined;
    let nextRequestId = 0;
    let disposed = false;
    let queue: Promise<unknown> = Promise.resolve();
    let active:
        | {
              requestId: number;
              stage: "text" | "image" | "audio";
              timer: ReturnType<typeof setTimeout>;
              shutdownTimer?: ReturnType<typeof setTimeout>;
              terminalResult?: InferenceResult;
              settle: (result: InferenceResult) => void;
          }
        | undefined;

    const detachWorker = (candidate = worker): void => {
        if (candidate === undefined) return;
        if (worker === candidate) worker = undefined;
        candidate.onmessage = null;
        candidate.onerror = null;
        candidate.terminate();
        publishStatus({ phase: "idle" });
    };

    const settleActive = (
        candidate: TransformersWebGpuWorker,
        result: InferenceResult,
        resetRuntime: boolean,
    ): void => {
        if (worker !== candidate || active === undefined) return;
        const pending = active;
        active = undefined;
        clearTimeout(pending.timer);
        if (pending.shutdownTimer !== undefined) clearTimeout(pending.shutdownTimer);
        if (resetRuntime) detachWorker(candidate);
        else publishStatus({ phase: "idle" });
        pending.settle(result);
    };

    const requestWorkerShutdown = (
        candidate: TransformersWebGpuWorker,
        result: InferenceResult,
    ): void => {
        if (worker !== candidate || active === undefined) return;
        const pending = active;
        if (pending.terminalResult !== undefined) return;
        pending.terminalResult = result;
        clearTimeout(pending.timer);
        try {
            candidate.postMessage({ kind: "dispose", requestId: pending.requestId });
        } catch {
            settleActive(candidate, result, true);
            return;
        }
        if (active !== pending) return;
        pending.shutdownTimer = setTimeout(
            () => settleActive(candidate, result, true),
            Math.max(1, shutdownGraceMs),
        );
    };

    const getWorker = (): TransformersWebGpuWorker => {
        if (worker !== undefined) return worker;
        const candidate = factory();
        candidate.onmessage = (event) => {
            if (worker !== candidate) return;
            const message = event.data;
            if (message.kind === "runtime_error") {
                if (active !== undefined) {
                    settleActive(
                        candidate,
                        active.terminalResult ?? { kind: "error", error: message.error },
                        true,
                    );
                } else {
                    detachWorker(candidate);
                }
                return;
            }
            if (active === undefined || active.requestId !== message.requestId) return;
            switch (message.kind) {
                case "progress":
                    publishStatus({
                        phase: message.phase,
                        stage: active.stage,
                        progress: message.progress,
                        file: message.file,
                    });
                    return;
                case "result":
                    settleActive(
                        candidate,
                        active.terminalResult ??
                            (message.text.length === 0
                                ? { kind: "error", error: "browser model returned no text" }
                                : { kind: "ok", text: message.text }),
                        true,
                    );
                    return;
                case "unavailable":
                    settleActive(
                        candidate,
                        active.terminalResult ?? { kind: "unavailable", reason: message.reason },
                        true,
                    );
                    return;
                case "error":
                    settleActive(
                        candidate,
                        active.terminalResult ?? { kind: "error", error: message.error },
                        true,
                    );
                    return;
                case "disposed":
                    settleActive(
                        candidate,
                        active.terminalResult ?? {
                            kind: "error",
                            error: "The browser model stopped before returning a result.",
                        },
                        true,
                    );
                    return;
            }
        };
        candidate.onerror = (event) => {
            if (worker !== candidate) return;
            const error =
                event.message || "The on-device WebGPU image-model worker stopped unexpectedly.";
            if (active !== undefined) {
                settleActive(candidate, active.terminalResult ?? { kind: "error", error }, true);
            } else {
                detachWorker(candidate);
            }
        };
        worker = candidate;
        return candidate;
    };

    const inferOne = async (
        request: InferenceRequest,
        explicitModelId?: TransformersWebGpuModelId,
    ): Promise<InferenceResult> => {
        if (disposed) {
            return Promise.resolve({ kind: "error", error: "image-model worker was disposed" });
        }
        const deadline = Date.now() + timeoutMs;
        const readiness = available(request.image !== undefined);
        if (!readiness.available) {
            return Promise.resolve({ kind: "unavailable", reason: readiness.reason });
        }
        if (
            (request.image !== undefined &&
                (request.image.byteLength === 0 || request.image.byteLength > MAX_IMAGE_BYTES)) ||
            (request.audio !== undefined &&
                (request.audio.byteLength === 0 ||
                    request.audio.byteLength > TRANSFORMERS_WEBGPU_MAX_ENCODED_AUDIO_BYTES)) ||
            (request.audio === undefined) !== (request.audioMimeType === undefined) ||
            (request.audio !== undefined && request.image !== undefined) ||
            (request.maxTokens !== undefined &&
                (!Number.isInteger(request.maxTokens) ||
                    request.maxTokens < 1 ||
                    request.maxTokens > MAX_OUTPUT_TOKENS))
        ) {
            return {
                kind: "error",
                error: "all-WebGPU browser request exceeds safety limits",
            };
        }

        const spec = requiredSpec(explicitModelId ?? request.modelId ?? PHONE_QWEN3_VL_2B_MODEL_ID);
        if (!spec.enabled)
            return {
                kind: "unavailable",
                reason: "This model was disabled or removed from the catalog. Its download is retained. Select an enabled model in On-device models.",
            };
        const modality =
            request.audio !== undefined ? "audio" : request.image !== undefined ? "image" : "text";
        if (!spec.modalities.includes(modality))
            return { kind: "unavailable", reason: `${spec.name} does not support ${modality}.` };
        if (request.audio !== undefined && spec.optionalAudio === undefined) {
            return {
                kind: "unavailable",
                reason: `${spec.name} cannot process voice messages. Select a model with audio support.`,
            };
        }
        let audioSamples: ArrayBuffer | undefined;
        if (request.audio !== undefined && request.audioMimeType !== undefined) {
            try {
                const remaining = Math.min(
                    TRANSFORMERS_WEBGPU_AUDIO_DECODE_TIMEOUT_MS,
                    deadline - Date.now(),
                );
                if (remaining < 1)
                    throw new Error("Voice-message decoding timed out in this browser.");
                let decodeTimer: ReturnType<typeof setTimeout> | undefined;
                const decoded = await Promise.race([
                    decodeAudio(request.audio, request.audioMimeType),
                    new Promise<never>((_, reject) => {
                        decodeTimer = setTimeout(
                            () =>
                                reject(
                                    new Error("Voice-message decoding timed out in this browser."),
                                ),
                            remaining,
                        );
                    }),
                ]).finally(() => {
                    if (decodeTimer !== undefined) clearTimeout(decodeTimer);
                });
                audioSamples = decoded.buffer.slice(
                    decoded.byteOffset,
                    decoded.byteOffset + decoded.byteLength,
                ) as ArrayBuffer;
            } catch (error) {
                return {
                    kind: "error",
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        }
        if (disposed) {
            return { kind: "error", error: "image-model worker was disposed" };
        }
        const remaining = deadline - Date.now();
        if (remaining < 1) {
            return {
                kind: "error",
                error: "The isolated browser image model did not finish in time.",
            };
        }
        if (JSON.stringify(transformersWebGpuModelSpec(spec.id)) !== JSON.stringify(spec)) {
            return {
                kind: "error",
                error: "Model configuration changed. Retry with the current catalog.",
            };
        }
        const candidate = getWorker();
        const requestId = ++nextRequestId;
        const stage =
            request.audio !== undefined ? "audio" : request.image === undefined ? "text" : "image";
        const image = request.image?.slice().buffer as ArrayBuffer | undefined;
        publishStatus({ phase: "loading", stage });
        return new Promise<InferenceResult>((settle) => {
            const timer = setTimeout(() => {
                requestWorkerShutdown(candidate, {
                    kind: "error",
                    error: "The isolated browser image model did not finish in time.",
                });
            }, remaining);
            active = { requestId, stage, timer, settle };
            try {
                const message: TransformersWebGpuToWorker = {
                    kind: "infer",
                    requestId,
                    modelId: spec.id,
                    modelSpec: spec,
                    prompt: request.prompt,
                    text: request.text,
                    image,
                    audioSamples,
                    audioSampleRate:
                        audioSamples === undefined
                            ? undefined
                            : TRANSFORMERS_WEBGPU_AUDIO_SAMPLE_RATE,
                    maxTokens: request.maxTokens,
                };
                candidate.postMessage(
                    message,
                    [image, audioSamples].filter(
                        (value): value is ArrayBuffer => value !== undefined,
                    ),
                );
            } catch (error) {
                settleActive(
                    candidate,
                    {
                        kind: "error",
                        error: error instanceof Error ? error.message : String(error),
                    },
                    true,
                );
            }
        });
    };

    return {
        infer(request, modelId) {
            const run = queue.then(() => inferOne(request, modelId));
            queue = run.catch(() => undefined);
            return run;
        },
        async dispose() {
            disposed = true;
            if (active !== undefined && worker !== undefined) {
                requestWorkerShutdown(worker, {
                    kind: "error",
                    error: "image-model worker was disposed",
                });
            } else {
                detachWorker();
            }
            await queue.catch(() => undefined);
        },
    };
}

let defaultEngine: TransformersWebGpuEngine | undefined;
const defaultStatusListeners = new Set<(status: TransformersWebGpuStatus) => void>();

/** Observe the singleton all-WebGPU engine without exposing prompt, image, or generated content. */
export function subscribeTransformersWebGpuStatus(
    listener: (status: TransformersWebGpuStatus) => void,
): () => void {
    defaultStatusListeners.add(listener);
    listener({ phase: "idle" });
    return () => defaultStatusListeners.delete(listener);
}

function publishDefaultStatus(status: TransformersWebGpuStatus): void {
    for (const listener of defaultStatusListeners) listener(status);
}

export async function transformersWebGpuInfer(request: InferenceRequest): Promise<InferenceResult> {
    const spec = transformersWebGpuModelSpec(request.modelId ?? PHONE_QWEN3_VL_2B_MODEL_ID);
    if (spec === undefined || !spec.enabled) {
        return {
            kind: "unavailable",
            reason: "This all-WebGPU model is not enabled in the current catalog. Select an enabled model in On-device models.",
        };
    }
    if (!(await transformersWebGpuModelDownloaded(spec.id))) {
        return { kind: "error", error: transformersWebGpuModelNotDownloadedMessage(spec.id) };
    }
    if (request.audio !== undefined && !(await transformersWebGpuAudioDownloaded(spec.id))) {
        return { kind: "error", error: TRANSFORMERS_WEBGPU_GEMMA_AUDIO_NOT_DOWNLOADED_MESSAGE };
    }
    if (!(await transformersWebGpuRuntimeAvailableOffline(spec.id))) {
        return { kind: "error", error: transformersWebGpuModelNotDownloadedMessage(spec.id) };
    }
    if (JSON.stringify(transformersWebGpuModelSpec(spec.id)) !== JSON.stringify(spec)) {
        return {
            kind: "error",
            error: "Model configuration changed during verification. Retry with the current catalog.",
        };
    }
    defaultEngine ??= createTransformersWebGpuEngine(defaultWorkerFactory, {
        publishStatus: publishDefaultStatus,
    });
    return defaultEngine.infer(request, spec.id);
}

export async function disposeTransformersWebGpuInference(): Promise<void> {
    const engine = defaultEngine;
    defaultEngine = undefined;
    await engine?.dispose();
}

/** Remove the complete pinned runtime/model cache after the user explicitly removes Qwen. */
export function deleteTransformersWebGpuModel(
    storage?: Pick<CacheStorage, "delete">,
): Promise<void>;
export function deleteTransformersWebGpuModel(
    modelId: string,
    storage?: Pick<CacheStorage, "delete">,
): Promise<void>;
export async function deleteTransformersWebGpuModel(
    modelOrStorage: string | Pick<CacheStorage, "delete"> | undefined = PHONE_QWEN3_VL_2B_MODEL_ID,
    maybeStorage: Pick<CacheStorage, "delete"> | undefined = globalThis.caches,
): Promise<void> {
    const spec =
        typeof modelOrStorage === "string"
            ? requiredSpec(modelOrStorage)
            : requiredSpec(PHONE_QWEN3_VL_2B_MODEL_ID);
    const storage = typeof modelOrStorage === "string" ? maybeStorage : modelOrStorage;
    await disposeTransformersWebGpuInference();
    invalidateTransformersWebGpuReadiness(spec.id);
    if (storage !== undefined) await storage.delete(spec.cacheKey);
}
