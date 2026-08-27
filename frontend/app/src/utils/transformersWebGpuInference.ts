import type { InferenceRequest, InferenceResult } from "@shared";
import { sha256 } from "@noble/hashes/sha2.js";
import {
    PHONE_QWEN3_VL_2B_MODEL_ID,
    TRANSFORMERS_QWEN_ARTIFACT_BYTES,
    TRANSFORMERS_QWEN_ARTIFACTS,
    TRANSFORMERS_QWEN_MODEL_ID,
    TRANSFORMERS_QWEN_REVISION,
    TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON,
    TRANSFORMERS_WEBGPU_CACHE_KEY,
    TRANSFORMERS_WEBGPU_MODEL_PROXY_BASE,
    TRANSFORMERS_WEBGPU_WORKER_PATH,
    type TransformersWebGpuFromWorker,
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
    progress?: number;
    file?: string;
};

export type TransformersWebGpuEngine = {
    infer(request: InferenceRequest): Promise<InferenceResult>;
    dispose(): Promise<void>;
};

type SpikeEligibility = {
    enabled: boolean;
    mobile: boolean;
    selectedModelId: string | undefined;
};

const DEFAULT_JOB_TIMEOUT_MS = 15 * 60_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_TOKENS = 512;
const CACHE_DIGEST_HEADER = "x-content-sha256";

export const TRANSFORMERS_WEBGPU_MODEL_NOT_DOWNLOADED_MESSAGE =
    "Qwen3-VL 2B is selected but its all-WebGPU files are not completely downloaded. Open On-device models and tap Retry download before running an image.";

export type TransformersWebGpuArtifactCache = Pick<Cache, "match" | "put" | "delete">;
export type TransformersWebGpuArtifactCacheStorage = {
    open(name: string): Promise<TransformersWebGpuArtifactCache>;
};

export type TransformersWebGpuPreloadOptions = {
    signal?: AbortSignal;
    onProgress?: (received: number, total: number) => void;
    cacheStorage?: TransformersWebGpuArtifactCacheStorage;
    fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    baseUrl?: string;
};

function artifactUrl(path: string, baseUrl?: string): string {
    const base =
        baseUrl ??
        (typeof globalThis.location === "undefined"
            ? "http://localhost/"
            : globalThis.location.href);
    return new URL(
        `${TRANSFORMERS_WEBGPU_MODEL_PROXY_BASE}${TRANSFORMERS_QWEN_MODEL_ID}/resolve/${TRANSFORMERS_QWEN_REVISION}/${path}`,
        base,
    ).href;
}

function digestHex(digest: Uint8Array): string {
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function abortReason(signal: AbortSignal): unknown {
    return signal.reason ?? new DOMException("cancelled", "AbortError");
}

function cachedArtifactMatches(
    response: Response | undefined,
    artifact: (typeof TRANSFORMERS_QWEN_ARTIFACTS)[number],
): boolean {
    if (response === undefined || !response.ok) return false;
    return (
        Number(response.headers.get("content-length")) === artifact.bytes &&
        response.headers.get(CACHE_DIGEST_HEADER)?.toLowerCase() === artifact.sha256
    );
}

async function openArtifactCache(
    storage: TransformersWebGpuArtifactCacheStorage | undefined,
): Promise<TransformersWebGpuArtifactCache> {
    const available = storage ?? globalThis.caches;
    if (available === undefined) {
        throw new Error("This browser cannot store the all-WebGPU model files.");
    }
    return available.open(TRANSFORMERS_WEBGPU_CACHE_KEY);
}

/** True only when every pinned worker input is present under the exact cache key and digest. */
export async function transformersWebGpuModelDownloaded(
    options: Pick<TransformersWebGpuPreloadOptions, "cacheStorage" | "baseUrl"> = {},
): Promise<boolean> {
    try {
        const cache = await openArtifactCache(options.cacheStorage);
        for (const artifact of TRANSFORMERS_QWEN_ARTIFACTS) {
            const cached = await cache.match(artifactUrl(artifact.path, options.baseUrl));
            if (!cachedArtifactMatches(cached, artifact)) return false;
        }
        return true;
    } catch {
        return false;
    }
}

/** Stream the exact revision into the same Cache API entry the worker reads. Hashing happens while
 * CacheStorage consumes each body, so the 1.1 GB decoder shard is never materialized in memory. */
export async function preloadTransformersWebGpuModel(
    options: TransformersWebGpuPreloadOptions = {},
): Promise<void> {
    const cache = await openArtifactCache(options.cacheStorage);
    const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    const signal = options.signal;
    const onProgress = options.onProgress ?? (() => undefined);
    let completed = 0;
    let lastPublishedAt = 0;

    try {
        await globalThis.navigator?.storage?.persist?.();
    } catch {
        // Persistence is best-effort; CacheStorage remains usable when the prompt is denied.
    }

    onProgress(0, TRANSFORMERS_QWEN_ARTIFACT_BYTES);
    for (const artifact of TRANSFORMERS_QWEN_ARTIFACTS) {
        if (signal?.aborted === true) throw abortReason(signal);
        const url = artifactUrl(artifact.path, options.baseUrl);
        const cached = await cache.match(url);
        if (cachedArtifactMatches(cached, artifact)) {
            completed += artifact.bytes;
            onProgress(completed, TRANSFORMERS_QWEN_ARTIFACT_BYTES);
            continue;
        }
        if (cached !== undefined) await cache.delete(url);

        const response = await fetcher(url, {
            signal,
            cache: "no-store",
            credentials: "same-origin",
        });
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
                        onProgress(completed + received, TRANSFORMERS_QWEN_ARTIFACT_BYTES);
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
        headers.set("x-openchat-model-revision", TRANSFORMERS_QWEN_REVISION);

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
        if (!cachedArtifactMatches(stored, artifact)) {
            await cache.delete(url);
            throw new Error(`${artifact.path} was not retained by browser storage.`);
        }
        completed += artifact.bytes;
        onProgress(completed, TRANSFORMERS_QWEN_ARTIFACT_BYTES);
    }
}

export function transformersWebGpuSpikeEnabled(): boolean {
    return (
        import.meta.env.DEV === true &&
        import.meta.env.OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE === "true"
    );
}

function mobileBrowser(): boolean {
    if (typeof navigator === "undefined") return false;
    const hint = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
        ?.mobile;
    return hint === true || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** Pure admission predicate, injectable in tests and reused by the facade and webInfer seam. */
export function shouldUseTransformersWebGpuSpike(
    request: InferenceRequest,
    eligibility: SpikeEligibility,
): boolean {
    return (
        eligibility.enabled &&
        eligibility.mobile &&
        eligibility.selectedModelId === PHONE_QWEN3_VL_2B_MODEL_ID &&
        request.image !== undefined
    );
}

export function transformersWebGpuSelectionCanHandle(selectedModelId: string | undefined): boolean {
    return (
        transformersWebGpuSpikeEnabled() &&
        mobileBrowser() &&
        selectedModelId === PHONE_QWEN3_VL_2B_MODEL_ID
    );
}

export function transformersWebGpuSpikeCanHandle(
    request: InferenceRequest,
    selectedModelId: string | undefined,
): boolean {
    return transformersWebGpuSelectionCanHandle(selectedModelId) && request.image !== undefined;
}

export function transformersWebGpuRuntimeAvailability(): TransformersWebGpuRuntimeAvailability {
    if (globalThis.crossOriginIsolated !== true) {
        return {
            available: false,
            reason: "Accelerated image inference needs a newly opened cross-origin-isolated tab.",
        };
    }
    if (
        typeof Worker === "undefined" ||
        typeof WebAssembly === "undefined" ||
        typeof Blob === "undefined"
    ) {
        return {
            available: false,
            reason: "This browser cannot start the isolated image-model worker.",
        };
    }
    if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") {
        return {
            available: false,
            reason: "This browser cannot decode images inside the isolated model worker.",
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
    const version = encodeURIComponent(import.meta.env.OC_WEBSITE_VERSION ?? "development");
    const workerUrl = `${TRANSFORMERS_WEBGPU_WORKER_PATH}?v=${version}`;
    return new Worker(new URL(workerUrl, import.meta.url), {
        type: "module",
        name: "openchat-transformers-webgpu",
    });
}

export function createTransformersWebGpuEngine(
    factory: TransformersWebGpuWorkerFactory = defaultWorkerFactory,
    options: {
        available?: () => TransformersWebGpuRuntimeAvailability;
        timeoutMs?: number;
        publishStatus?: (status: TransformersWebGpuStatus) => void;
    } = {},
): TransformersWebGpuEngine {
    const available = options.available ?? transformersWebGpuRuntimeAvailability;
    const timeoutMs = options.timeoutMs ?? DEFAULT_JOB_TIMEOUT_MS;
    const publishStatus = options.publishStatus ?? (() => undefined);

    let worker: TransformersWebGpuWorker | undefined;
    let nextRequestId = 0;
    let disposed = false;
    let queue: Promise<unknown> = Promise.resolve();
    let active:
        | {
              requestId: number;
              timer: ReturnType<typeof setTimeout>;
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
        if (resetRuntime) detachWorker(candidate);
        else publishStatus({ phase: "idle" });
        pending.settle(result);
    };

    const getWorker = (): TransformersWebGpuWorker => {
        if (worker !== undefined) return worker;
        const candidate = factory();
        candidate.onmessage = (event) => {
            if (worker !== candidate) return;
            const message = event.data;
            if (message.kind === "runtime_error") {
                if (active !== undefined) {
                    settleActive(candidate, { kind: "error", error: message.error }, true);
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
                        progress: message.progress,
                        file: message.file,
                    });
                    return;
                case "result":
                    settleActive(
                        candidate,
                        message.text.length === 0
                            ? { kind: "error", error: "browser model returned no text" }
                            : { kind: "ok", text: message.text },
                        true,
                    );
                    return;
                case "unavailable":
                    settleActive(candidate, { kind: "unavailable", reason: message.reason }, true);
                    return;
                case "error":
                    settleActive(candidate, { kind: "error", error: message.error }, true);
                    return;
            }
        };
        candidate.onerror = (event) => {
            if (worker !== candidate) return;
            const error = event.message || "The isolated image-model worker stopped unexpectedly.";
            if (active !== undefined) {
                settleActive(candidate, { kind: "error", error }, true);
            } else {
                detachWorker(candidate);
            }
        };
        worker = candidate;
        return candidate;
    };

    const inferOne = (request: InferenceRequest): Promise<InferenceResult> => {
        if (disposed) {
            return Promise.resolve({ kind: "error", error: "image-model worker was disposed" });
        }
        const readiness = available();
        if (!readiness.available) {
            return Promise.resolve({ kind: "unavailable", reason: readiness.reason });
        }
        if (
            request.image === undefined ||
            request.image.byteLength === 0 ||
            request.image.byteLength > MAX_IMAGE_BYTES ||
            (request.maxTokens !== undefined &&
                (!Number.isInteger(request.maxTokens) ||
                    request.maxTokens < 1 ||
                    request.maxTokens > MAX_OUTPUT_TOKENS))
        ) {
            return Promise.resolve({
                kind: "error",
                error: "experimental browser image request exceeds safety limits",
            });
        }

        const candidate = getWorker();
        const requestId = ++nextRequestId;
        const image = request.image.slice().buffer as ArrayBuffer;
        publishStatus({ phase: "loading" });
        return new Promise<InferenceResult>((settle) => {
            const timer = setTimeout(() => {
                settleActive(
                    candidate,
                    {
                        kind: "error",
                        error: "The isolated browser image model did not finish in time.",
                    },
                    true,
                );
            }, timeoutMs);
            active = { requestId, timer, settle };
            try {
                candidate.postMessage(
                    {
                        kind: "infer",
                        requestId,
                        prompt: request.prompt,
                        text: request.text,
                        image,
                        maxTokens: request.maxTokens,
                    },
                    [image],
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
        infer(request) {
            const run = queue.then(() => inferOne(request));
            queue = run.catch(() => undefined);
            return run;
        },
        async dispose() {
            disposed = true;
            if (active !== undefined && worker !== undefined) {
                settleActive(
                    worker,
                    { kind: "error", error: "image-model worker was disposed" },
                    true,
                );
            } else {
                detachWorker();
            }
            await queue.catch(() => undefined);
        },
    };
}

let defaultEngine: TransformersWebGpuEngine | undefined;

export async function transformersWebGpuInfer(request: InferenceRequest): Promise<InferenceResult> {
    if (!(await transformersWebGpuModelDownloaded())) {
        return { kind: "error", error: TRANSFORMERS_WEBGPU_MODEL_NOT_DOWNLOADED_MESSAGE };
    }
    defaultEngine ??= createTransformersWebGpuEngine();
    return defaultEngine.infer(request);
}

export async function disposeTransformersWebGpuInference(): Promise<void> {
    const engine = defaultEngine;
    defaultEngine = undefined;
    await engine?.dispose();
}
