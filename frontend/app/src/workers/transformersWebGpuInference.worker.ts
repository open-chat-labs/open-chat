import {
    env,
    Gemma4AudioFeatureExtractor,
    Gemma4ForConditionalGeneration,
    Gemma4ImageProcessor,
    Gemma4Processor,
    GemmaTokenizer,
    Qwen2Tokenizer,
    Qwen2VLImageProcessor,
    Qwen3VLForConditionalGeneration,
    Qwen3VLProcessor,
    RawImage,
    Tensor,
} from "@huggingface/transformers";
import {
    PHONE_GEMMA4_E2B_MODEL_ID,
    PHONE_QWEN3_VL_2B_MODEL_ID,
    TRANSFORMERS_GEMMA_ARTIFACTS,
    TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS,
    TRANSFORMERS_GEMMA_CACHE_KEY,
    TRANSFORMERS_GEMMA_DEVICE_MAP,
    TRANSFORMERS_GEMMA_MODEL_ID,
    TRANSFORMERS_GEMMA_REVISION,
    TRANSFORMERS_QWEN_MODEL_ID,
    TRANSFORMERS_QWEN_ARTIFACTS,
    TRANSFORMERS_QWEN_DEVICE_MAP,
    TRANSFORMERS_QWEN_REVISION,
    TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON,
    TRANSFORMERS_WEBGPU_CACHE_KEY,
    TRANSFORMERS_WEBGPU_MODEL_PROXY_BASE,
    TRANSFORMERS_WEBGPU_ORT_ASSET_BASE,
    type TransformersWebGpuFromWorker,
    type TransformersWebGpuToWorker,
} from "../utils/transformersWebGpuProtocol";
import {
    assertGemma4PromptTokenCount,
    createGemma4WebGpuEmbeddingSession,
    GEMMA4_EMBEDDING_SHARD_BYTES,
} from "../utils/gemma4WebGpuEmbedding";
import {
    TRANSFORMERS_WEBGPU_NORMALIZED_PROCESSOR_MARKER,
    transformersWebGpuProcessorConfig,
} from "../utils/transformersWebGpuProcessorConfig";
import {
    GEMMA4_WEBGPU_MAX_SOFT_TOKENS,
    gemma4WebGpuImageTarget,
    TRANSFORMERS_WEBGPU_FALLBACK_IMAGE_LAYOUT,
    TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES,
    transformersWebGpuImageGridPatchCount,
    transformersWebGpuImageLayout,
} from "../utils/transformersWebGpuImageLayout";
import { intrinsicImageDimensions } from "../utils/imageDimensions";
import {
    releaseAndRetireWebGpuDevice,
    type RetirableWebGpuDevice,
} from "../utils/transformersWebGpuDeviceRetirement";
import {
    installSerializedWebGpuPipelineCompilation,
    setOrtWebGpuStandardSoftmaxRouting,
} from "../utils/transformersWebGpuPipelineCompilation";
import {
    TRANSFORMERS_WEBGPU_MAX_AUDIO_SAMPLES,
    TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES,
} from "../utils/transformersWebGpuAudio";
import {
    isTransformersWebGpuOrtRunFailure,
    transformersWebGpuOrtRunError,
} from "../utils/transformersWebGpuOrtDiagnostics";

type QwenLoadedRuntime = {
    kind: "qwen";
    processor: Qwen3VLProcessor;
    model: Awaited<ReturnType<typeof Qwen3VLForConditionalGeneration.from_pretrained>>;
};

type GemmaLoadedRuntime = {
    kind: "gemma";
    processor: Gemma4Processor;
    model: Awaited<ReturnType<typeof Gemma4ForConditionalGeneration.from_pretrained>>;
};

type LoadedRuntime = QwenLoadedRuntime | GemmaLoadedRuntime;
type TransformersWebGpuInferRequest = Extract<TransformersWebGpuToWorker, { kind: "infer" }>;

type OnnxEnvironment = {
    wasm?: {
        wasmPaths?: { mjs: string; wasm: string };
        numThreads?: number;
        proxy?: boolean;
    };
    webgpu?: {
        adapter?: unknown;
        device?: RetirableWebGpuDevice;
    };
};

type RunnableSession = {
    run: (...args: unknown[]) => Promise<unknown>;
};

type ModelJsonConfig = Record<string, unknown> & {
    image_processor?: Record<string, unknown>;
};

type WorkerNavigator = Navigator & {
    gpu?: {
        requestAdapter(): Promise<{
            features?: { has(feature: string): boolean };
        } | null>;
    };
};

class AdapterUnavailableError extends Error {}

const CACHE_DIGEST_HEADER = "x-content-sha256";
const STAGED_EXTERNAL_DATA = {
    decoder_model_merged: {
        path: "onnx/decoder_model_merged_q4.onnx_data",
        name: "decoder_model_merged_q4.onnx_data",
    },
    embed_tokens: {
        path: "onnx/embed_tokens_q4.onnx_data",
        name: "embed_tokens_q4.onnx_data",
    },
    vision_encoder: {
        path: "onnx/vision_encoder_q4.onnx_data",
        name: "vision_encoder_q4.onnx_data",
    },
} as const;

const GEMMA_STAGED_EXTERNAL_DATA = {
    decoder_model_merged: {
        path: "onnx/decoder_model_merged_q4f16.onnx_data",
        name: "decoder_model_merged_q4f16.onnx_data",
    },
    vision_encoder: {
        path: "onnx/vision_encoder_q4f16.onnx_data",
        name: "vision_encoder_q4f16.onnx_data",
    },
    audio_encoder: {
        path: "onnx/audio_encoder_q4f16.onnx_data",
        name: "audio_encoder_q4f16.onnx_data",
    },
} as const;

const workerScope = globalThis as unknown as DedicatedWorkerGlobalScope;
const onnx = env.backends.onnx as OnnxEnvironment;
let loadedRuntime: LoadedRuntime | undefined;
let runtimePromise: Promise<LoadedRuntime> | undefined;
let runtimeDisposalPromise: Promise<void> | undefined;
let runtimeGeneration = 0;
let busy = false;
let requestedDisposeId: number | undefined;
let activeGpuStage = "runtime initialization";

function post(message: TransformersWebGpuFromWorker): void {
    workerScope.postMessage(message);
}

function configureRuntimeAssets(cacheKey: string, modelName: string): void {
    if (onnx.wasm === undefined || onnx.webgpu === undefined) {
        throw new Error("The pinned browser ONNX runtime did not initialize its WebGPU backend.");
    }
    // ORT's factory and WASM stay same-origin. Disabling the preload helper prevents its fetched
    // factory from being converted to a blob-module import, which would require weakening script-src.
    env.useWasmCache = false;
    env.useBrowserCache = true;
    // Keep the Adreno-safe ONNX graph revision isolated from caches populated before the
    // decoder/vision patches were served. Account/session storage is unaffected by this key.
    env.cacheKey = cacheKey;
    env.allowLocalModels = false;
    // Transformers.js validates that at least one source is enabled before it checks Cache Storage.
    // Keep remote resolution enabled only to build matching cache keys. Cache hits happen before
    // env.fetch; a cache miss reaches this fail-closed hook instead of downloading during inference.
    env.allowRemoteModels = true;
    env.fetch = async () => {
        throw new Error(
            `${modelName} is not fully downloaded. Open On-device models and tap Retry download.`,
        );
    };
    env.remoteHost = TRANSFORMERS_WEBGPU_MODEL_PROXY_BASE;
    env.remotePathTemplate = "{model}/resolve/{revision}/";
    onnx.wasm.wasmPaths = {
        mjs: `${TRANSFORMERS_WEBGPU_ORT_ASSET_BASE}/ort-wasm-simd-threaded.jspi.mjs`,
        wasm: `${TRANSFORMERS_WEBGPU_ORT_ASSET_BASE}/ort-wasm-simd-threaded.jspi.wasm`,
    };
    // WASM remains configured because ORT initializes both browser backends, but the exact device map
    // below assigns all three Qwen3-VL sessions to WebGPU and does not permit a decoder fallback.
    onnx.wasm.numThreads = 1;
    onnx.wasm.proxy = false;
}

function progressFor(requestId: number): (update: unknown) => void {
    return (update) => {
        if (typeof update !== "object" || update === null) return;
        const data = update as Record<string, unknown>;
        const rawProgress = typeof data.progress === "number" ? data.progress : undefined;
        const progress =
            rawProgress === undefined || !Number.isFinite(rawProgress)
                ? undefined
                : Math.max(0, Math.min(1, rawProgress > 1 ? rawProgress / 100 : rawProgress));
        post({
            kind: "progress",
            requestId,
            phase: data.status === "progress" ? "downloading" : "loading",
            progress,
            file: typeof data.file === "string" ? data.file : undefined,
        });
    };
}

function stagedSessionProgressFor(
    requestId: number,
    modelName: string,
): (sessionName: string, stage: string) => void {
    return (sessionName, stage) => {
        activeGpuStage = `${sessionName} ${stage}`;
        post({
            kind: "progress",
            requestId,
            phase: "loading",
            file: `${modelName}: ${sessionName} ${stage}`,
        });
    };
}

async function requestAdapter(requireShaderF16 = false): Promise<unknown> {
    const gpu = (navigator as WorkerNavigator).gpu;
    if (gpu === undefined) throw new AdapterUnavailableError();
    setOrtWebGpuStandardSoftmaxRouting(requireShaderF16);
    // ORT's pinned JSPI bridge requests another adapter directly from navigator.gpu. Install the
    // wrapper on that shared boundary before our preflight so both requests receive serialized
    // devices. Wrapping only env.webgpu.adapter does not reach the bridge's native pipeline calls.
    installSerializedWebGpuPipelineCompilation(gpu);
    // Use the browser's default adapter policy. WebGPU warns that forcing the high-performance
    // preference on portable devices makes power-switch device loss more likely.
    const adapter = await gpu.requestAdapter();
    if (adapter === null) throw new AdapterUnavailableError();
    if (requireShaderF16 && adapter.features?.has("shader-f16") !== true) {
        throw new Error(
            "Gemma 4 E2B requires the WebGPU shader-f16 feature on this device; no CPU or q4 fallback was used.",
        );
    }
    return adapter;
}

async function waitForStagedWebGpuQueue(sessionName: string): Promise<void> {
    const queue = onnx.webgpu?.device?.queue;
    if (queue === undefined) {
        throw new Error(`The WebGPU queue is unavailable after loading ${sessionName}.`);
    }
    activeGpuStage = `${sessionName} upload drain`;
    await queue.onSubmittedWorkDone();
}

async function withStagedWebGpuRelease(
    stage: string,
    release: () => Promise<unknown>,
): Promise<void> {
    const device = onnx.webgpu?.device;
    if (device === undefined) {
        await release();
        throw new Error(`The WebGPU device is unavailable before ${stage}.`);
    }
    console.info(`[qwen-webgpu] ${stage} retirement started`);
    await releaseAndRetireWebGpuDevice(device, release, {
        stage,
        currentDevice: () => onnx.webgpu?.device,
        clearCurrentDevice: (retired) => {
            if (onnx.webgpu?.device === retired) delete onnx.webgpu.device;
        },
        onPhase: (phase) => {
            activeGpuStage = `${stage} ${phase}`;
        },
    });
    console.info(`[qwen-webgpu] ${stage} retirement completed`);
}

async function disposeLoadedRuntime(expected = loadedRuntime): Promise<void> {
    if (runtimeDisposalPromise !== undefined) {
        await runtimeDisposalPromise;
        return;
    }
    if (expected === undefined || loadedRuntime !== expected) return;
    loadedRuntime = undefined;
    runtimePromise = undefined;
    runtimeGeneration++;
    const disposal = withStagedWebGpuRelease("decoder teardown", () => expected.model.dispose());
    runtimeDisposalPromise = disposal;
    try {
        await disposal;
    } finally {
        if (runtimeDisposalPromise === disposal) runtimeDisposalPromise = undefined;
    }
}

function watchDeviceLoss(runtime: LoadedRuntime, generation: number): void {
    const lost = onnx.webgpu?.device?.lost;
    if (lost === undefined) return;
    void lost.then(async (info) => {
        if (generation !== runtimeGeneration || loadedRuntime !== runtime) return;
        const lossStage = activeGpuStage;
        let cleanupFailure: unknown;
        try {
            // Do not let the main thread terminate this worker until the bounded retirement path
            // has released the sessions and acknowledged device loss.
            await disposeLoadedRuntime(runtime);
        } catch (error) {
            cleanupFailure = error;
        }
        const reason = info.reason === undefined ? "" : ` (${info.reason})`;
        const cleanup =
            cleanupFailure === undefined
                ? ""
                : ` Cleanup did not complete: ${
                      cleanupFailure instanceof Error
                          ? cleanupFailure.message
                          : String(cleanupFailure)
                  }`;
        post({
            kind: "runtime_error",
            error: `The WebGPU device was lost during ${lossStage}${reason}${
                info.message ? `: ${info.message}.` : "."
            }${cleanup}`,
        });
    });
}

function instrumentGpuSessions(runtime: LoadedRuntime, generation: number): void {
    const model = runtime.model;
    const sessions = (
        model as unknown as {
            sessions?: Record<string, RunnableSession>;
        }
    ).sessions;
    if (sessions === undefined) return;
    let decoderDeviceWatcherArmed = false;
    for (const [name, session] of Object.entries(sessions)) {
        const run = session.run.bind(session);
        let invocation = 0;
        session.run = async (...args) => {
            const started = performance.now();
            // Qwen's staged loader replaces later embedding calls with a CPU-side cache facade.
            // Gemma's row-streamed embedding facade executes on WebGPU on every call, so never hide
            // its stage from device-loss diagnostics.
            const cachedEmbeddingFacade =
                runtime.kind === "qwen" && name === "embed_tokens" && invocation > 0;
            invocation++;
            if (cachedEmbeddingFacade) {
                console.info("[qwen-webgpu] embed_tokens cached CPU facade started");
            } else {
                activeGpuStage = `${name} execution`;
                console.info(`[qwen-webgpu] ${name} started`);
            }
            try {
                const result = await run(...args);
                if (!cachedEmbeddingFacade) activeGpuStage = `${name} completed`;
                if (name === "decoder_model_merged" && !decoderDeviceWatcherArmed) {
                    decoderDeviceWatcherArmed = true;
                    // The staged loader deliberately releases the last prompt session before it
                    // creates the decoder. Pinned ORT destroys that old device at the zero-session
                    // boundary and publishes a fresh device when the decoder session is created.
                    // Arm loss monitoring only after that rollover; a failure during the first
                    // decoder run already rejects run() and is reported through the request path.
                    watchDeviceLoss(runtime, generation);
                }
                console.info(
                    cachedEmbeddingFacade
                        ? `[qwen-webgpu] embed_tokens cached CPU facade completed in ${Math.round(performance.now() - started)} ms`
                        : `[qwen-webgpu] ${name} completed in ${Math.round(performance.now() - started)} ms`,
                );
                return result;
            } catch (error) {
                const failedStage = activeGpuStage;
                if (!cachedEmbeddingFacade) activeGpuStage = `${name} failed`;
                if (isTransformersWebGpuOrtRunFailure(error)) {
                    throw transformersWebGpuOrtRunError(
                        runtime.kind === "gemma" ? "Gemma 4 E2B" : "Qwen3-VL 2B",
                        name,
                        failedStage,
                        args[0],
                        error,
                    );
                }
                throw error;
            }
        };
    }
}

async function loadQwenRuntime(requestId: number): Promise<QwenLoadedRuntime> {
    if (loadedRuntime?.kind === "qwen") return loadedRuntime;
    if (runtimePromise !== undefined) {
        return runtimePromise.then((runtime) => {
            if (runtime.kind !== "qwen") throw new Error("A different model runtime is loading.");
            return runtime;
        });
    }

    configureRuntimeAssets(TRANSFORMERS_WEBGPU_CACHE_KEY, "Qwen3-VL 2B");
    const generation = ++runtimeGeneration;
    const progress_callback = progressFor(requestId);
    const reportStagedSession = stagedSessionProgressFor(requestId, "Qwen3-VL 2B");
    runtimePromise = (async () => {
        const adapter = await requestAdapter();
        if (onnx.webgpu === undefined)
            throw new Error("WebGPU runtime configuration is unavailable.");
        // Reuse the preflight adapter so ORT does not conflate an adapter-policy failure with model
        // loading. GPUDevice creation and every model session remain inside this dedicated worker.
        onnx.webgpu.adapter = adapter;
        // Transformers.js 4.2's generic tokenizer metadata probe does not forward the configured
        // same-origin model proxy. Construct the official Qwen components from the same immutable
        // revision so phone loading remains same-origin and deterministic.
        const modelBase = `${TRANSFORMERS_WEBGPU_MODEL_PROXY_BASE}${TRANSFORMERS_QWEN_MODEL_ID}/resolve/${TRANSFORMERS_QWEN_REVISION}/`;
        const artifactCache = await caches.open(TRANSFORMERS_WEBGPU_CACHE_KEY);
        const getArtifactUrl = (name: string): string =>
            new URL(`${modelBase}${name}`, workerScope.location.href).href;
        const getText = async (name: string): Promise<string> => {
            const url = getArtifactUrl(name);
            const response = await artifactCache.match(url);
            if (response === undefined || !response.ok) {
                throw new Error(`${name} is not present in the selected model download.`);
            }
            return response.text();
        };
        const getStagedExternalData = async (
            sessionName: string,
        ): Promise<Array<{ path: string; data: Blob }>> => {
            const external = STAGED_EXTERNAL_DATA[sessionName as keyof typeof STAGED_EXTERNAL_DATA];
            if (external === undefined) {
                throw new Error(`Unexpected staged external-data request for ${sessionName}.`);
            }
            const artifact = TRANSFORMERS_QWEN_ARTIFACTS.find(
                (candidate) => candidate.path === external.path,
            );
            if (artifact === undefined) {
                throw new Error(
                    `The pinned Qwen ${sessionName} external-data manifest is unavailable.`,
                );
            }
            const response = await artifactCache.match(getArtifactUrl(artifact.path));
            if (
                response === undefined ||
                !response.ok ||
                Number(response.headers.get("content-length")) !== artifact.bytes ||
                response.headers.get(CACHE_DIGEST_HEADER)?.toLowerCase() !== artifact.sha256 ||
                response.headers.get("x-openchat-model-revision") !== TRANSFORMERS_QWEN_REVISION
            ) {
                throw new Error(
                    `The cached Qwen ${sessionName} external data failed its pinned metadata check. Open On-device models and tap Retry download.`,
                );
            }
            // CacheStorage can expose the disk-backed response as a Blob without constructing the
            // corresponding V8 ArrayBuffer. The staged loader uses this for prompt sessions as well
            // as the 1.1 GB decoder, then drops the Blob immediately after ORT's JSPI handoff.
            const data = await response.blob();
            if (data.size !== artifact.bytes) {
                throw new Error(
                    `The cached Qwen ${sessionName} external data has the wrong byte size. Open On-device models and tap Retry download.`,
                );
            }
            return [{ path: external.name, data }];
        };
        const getJson = async (name: string): Promise<ModelJsonConfig> =>
            JSON.parse(await getText(name)) as ModelJsonConfig;
        const [tokenizerJson, tokenizerConfig, preprocessorConfig, processorConfig, chatTemplate] =
            await Promise.all([
                getJson("tokenizer.json"),
                getJson("tokenizer_config.json"),
                getJson("preprocessor_config.json"),
                getJson("processor_config.json"),
                getText("chat_template.jinja"),
            ]);
        const tokenizer = new Qwen2Tokenizer(tokenizerJson, tokenizerConfig);
        const unifiedImageProcessorConfig = transformersWebGpuProcessorConfig(
            preprocessorConfig,
            processorConfig,
        );
        console.info(TRANSFORMERS_WEBGPU_NORMALIZED_PROCESSOR_MARKER);
        const imageProcessor = new Qwen2VLImageProcessor(unifiedImageProcessorConfig);
        const processor = new Qwen3VLProcessor(
            {},
            { image_processor: imageProcessor, tokenizer },
            chatTemplate,
        );
        const modelOptions = {
            revision: TRANSFORMERS_QWEN_REVISION,
            // This exact map is fail-closed in v4.2: each ImageTextToText session name is
            // present, so no session takes the loader's implicit/default device.
            device: TRANSFORMERS_QWEN_DEVICE_MAP,
            // q4 is explicit for every session; device and dtype maps share exact session keys.
            dtype: {
                embed_tokens: "q4",
                vision_encoder: "q4",
                decoder_model_merged: "q4",
            },
            progress_callback,
            // from_pretrained keeps session_options while dropping unknown top-level options.
            // The exact-model build patch consumes and removes this private hook before any
            // session options reach ORT.
            session_options: {
                openchat_get_staged_external_data: getStagedExternalData,
                openchat_wait_for_staged_webgpu_queue: waitForStagedWebGpuQueue,
                openchat_with_staged_webgpu_release: withStagedWebGpuRelease,
                openchat_report_staged_session: reportStagedSession,
            } as never,
        } as const;
        const model = await Qwen3VLForConditionalGeneration.from_pretrained(
            TRANSFORMERS_QWEN_MODEL_ID,
            modelOptions,
        );
        const runtime: QwenLoadedRuntime = { kind: "qwen", processor, model };
        if (generation !== runtimeGeneration) {
            await model.dispose();
            throw new Error("The browser image runtime was restarted.");
        }
        loadedRuntime = runtime;
        instrumentGpuSessions(runtime, generation);
        return runtime;
    })().catch((error) => {
        if (generation === runtimeGeneration) runtimePromise = undefined;
        throw error;
    });
    return runtimePromise.then((runtime) => {
        if (runtime.kind !== "qwen") throw new Error("A different model runtime was loaded.");
        return runtime;
    });
}

async function loadGemmaRuntime(
    message: TransformersWebGpuInferRequest,
): Promise<GemmaLoadedRuntime> {
    if (loadedRuntime?.kind === "gemma") return loadedRuntime;
    if (runtimePromise !== undefined) {
        return runtimePromise.then((runtime) => {
            if (runtime.kind !== "gemma") throw new Error("A different model runtime is loading.");
            return runtime;
        });
    }

    const modality =
        message.audioSamples !== undefined
            ? "audio"
            : message.image !== undefined
              ? "image"
              : "text";
    if (message.audioSamples !== undefined && message.image !== undefined) {
        throw new Error(
            "Gemma accepts one image or one voice message per local inference request.",
        );
    }
    configureRuntimeAssets(TRANSFORMERS_GEMMA_CACHE_KEY, "Gemma 4 E2B");
    const generation = ++runtimeGeneration;
    runtimePromise = (async () => {
        const adapter = await requestAdapter(true);
        if (onnx.webgpu === undefined) {
            throw new Error("WebGPU runtime configuration is unavailable.");
        }
        onnx.webgpu.adapter = adapter;
        const modelBase = `${TRANSFORMERS_WEBGPU_MODEL_PROXY_BASE}${TRANSFORMERS_GEMMA_MODEL_ID}/resolve/${TRANSFORMERS_GEMMA_REVISION}/`;
        const artifactCache = await caches.open(TRANSFORMERS_GEMMA_CACHE_KEY);
        const getArtifactUrl = (name: string): string =>
            new URL(`${modelBase}${name}`, workerScope.location.href).href;
        const getCachedResponse = async (name: string): Promise<Response> => {
            const response = await artifactCache.match(getArtifactUrl(name));
            if (response === undefined || !response.ok) {
                throw new Error(`${name} is not present in the selected Gemma download.`);
            }
            return response;
        };
        const getText = async (name: string): Promise<string> =>
            (await getCachedResponse(name)).text();
        const getJson = async (name: string): Promise<ModelJsonConfig> =>
            JSON.parse(await getText(name)) as ModelJsonConfig;
        const exactExternalBlob = async (
            path: string,
            name: string,
        ): Promise<Array<{ path: string; data: Blob }>> => {
            const artifact = [
                ...TRANSFORMERS_GEMMA_ARTIFACTS,
                ...TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS,
            ].find((candidate) => candidate.path === path);
            if (artifact === undefined) {
                throw new Error(`The pinned Gemma external-data manifest is missing ${path}.`);
            }
            const response = await getCachedResponse(path);
            if (
                Number(response.headers.get("content-length")) !== artifact.bytes ||
                response.headers.get(CACHE_DIGEST_HEADER)?.toLowerCase() !== artifact.sha256 ||
                response.headers.get("x-openchat-model-revision") !== TRANSFORMERS_GEMMA_REVISION
            ) {
                throw new Error(
                    `The cached Gemma ${path} failed its pinned metadata check. Open On-device models and retry the download.`,
                );
            }
            const data = await response.blob();
            if (data.size !== artifact.bytes) {
                throw new Error(`The cached Gemma ${path} has the wrong byte size.`);
            }
            return [{ path: name, data }];
        };
        const getStagedExternalData = async (
            sessionName: string,
        ): Promise<Array<{ path: string; data: Blob }>> => {
            const external =
                GEMMA_STAGED_EXTERNAL_DATA[sessionName as keyof typeof GEMMA_STAGED_EXTERNAL_DATA];
            if (external === undefined) {
                throw new Error(`Unexpected Gemma external-data request for ${sessionName}.`);
            }
            return exactExternalBlob(external.path, external.name);
        };
        const createEmbeddingSession = async () => {
            const artifact = TRANSFORMERS_GEMMA_ARTIFACTS.find(
                (candidate) => candidate.path === "onnx/embed_tokens_q4f16.onnx_data",
            );
            if (artifact === undefined || artifact.bytes !== GEMMA4_EMBEDDING_SHARD_BYTES) {
                throw new Error("The pinned Gemma embedding manifest changed.");
            }
            const response = await getCachedResponse(artifact.path);
            if (
                Number(response.headers.get("content-length")) !== artifact.bytes ||
                response.headers.get(CACHE_DIGEST_HEADER)?.toLowerCase() !== artifact.sha256 ||
                response.headers.get("x-openchat-model-revision") !== TRANSFORMERS_GEMMA_REVISION
            ) {
                throw new Error(
                    "The cached Gemma embedding shard failed its pinned metadata check.",
                );
            }
            return createGemma4WebGpuEmbeddingSession(
                await response.blob(),
                () => onnx.webgpu?.device,
            );
        };

        const [tokenizerJson, tokenizerConfig, processorConfig, chatTemplate] = await Promise.all([
            getJson("tokenizer.json"),
            getJson("tokenizer_config.json"),
            getJson("processor_config.json"),
            getText("chat_template.jinja"),
        ]);
        const tokenizer = new GemmaTokenizer(tokenizerJson, tokenizerConfig);
        const components: {
            tokenizer: GemmaTokenizer;
            image_processor?: Gemma4ImageProcessor;
            feature_extractor?: Gemma4AudioFeatureExtractor;
        } = { tokenizer };
        if (modality === "image") {
            components.image_processor = new Gemma4ImageProcessor({
                ...processorConfig.image_processor,
                // Official supported OCR setting. Transformers.js 4.2 reads the instance config,
                // not per-call options, so pin it here rather than pretending an ignored option works.
                max_soft_tokens: GEMMA4_WEBGPU_MAX_SOFT_TOKENS,
            });
        }
        if (modality === "audio") {
            components.feature_extractor = new Gemma4AudioFeatureExtractor(
                processorConfig.feature_extractor,
            );
        }
        const processor = new Gemma4Processor(processorConfig, components, chatTemplate);
        const modelOptions = {
            revision: TRANSFORMERS_GEMMA_REVISION,
            device: TRANSFORMERS_GEMMA_DEVICE_MAP,
            dtype: {
                embed_tokens: "q4f16",
                vision_encoder: "q4f16",
                audio_encoder: "q4f16",
                decoder_model_merged: "q4f16",
            },
            session_options: {
                openchat_get_staged_external_data: getStagedExternalData,
                openchat_wait_for_staged_webgpu_queue: waitForStagedWebGpuQueue,
                openchat_with_staged_webgpu_release: withStagedWebGpuRelease,
                openchat_create_gemma_embed_session: createEmbeddingSession,
                openchat_gemma_required_modality: modality,
                openchat_report_staged_session: stagedSessionProgressFor(
                    message.requestId,
                    "Gemma 4 E2B",
                ),
            } as never,
        } as const;
        const model = await Gemma4ForConditionalGeneration.from_pretrained(
            TRANSFORMERS_GEMMA_MODEL_ID,
            modelOptions,
        );
        const runtime: GemmaLoadedRuntime = { kind: "gemma", processor, model };
        if (generation !== runtimeGeneration) {
            await model.dispose();
            throw new Error("The browser Gemma runtime was restarted.");
        }
        loadedRuntime = runtime;
        instrumentGpuSessions(runtime, generation);
        return runtime;
    })().catch((error) => {
        if (generation === runtimeGeneration) runtimePromise = undefined;
        throw error;
    });
    return runtimePromise.then((runtime) => {
        if (runtime.kind !== "gemma") throw new Error("A different model runtime was loaded.");
        return runtime;
    });
}

function disposeTensors(values: Iterable<unknown>): void {
    const disposed = new Set<Tensor>();
    for (const value of values) {
        if (value instanceof Tensor && !disposed.has(value)) {
            disposed.add(value);
            try {
                value.dispose();
            } catch {
                // A failed request may already have released an ORT-owned tensor.
            }
        }
    }
}

/** Decode directly into an aspect-preserving, patch-bounded inference surface and close the
 * browser ImageBitmap. Common raster dimensions are read without decoding a full-size RGBA copy;
 * unknown formats fail closed instead of being silently stretched.
 *
 * Transformers.js RawImage Blob reader first retains a full-resolution RGBA copy and does not close
 * its ImageBitmap, which raises the phone's transient memory peak before the model even runs. */
async function decodeBoundedImage(bytes: ArrayBuffer): Promise<RawImage> {
    const blob = new Blob([bytes]);
    const dimensions = intrinsicImageDimensions(bytes);
    if (dimensions === undefined) {
        throw new Error("The browser model could not verify this image's encoded dimensions.");
    }
    const layout = transformersWebGpuImageLayout(dimensions.width, dimensions.height);
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(blob, {
            imageOrientation: "from-image",
            resizeWidth: layout.drawWidth,
            resizeHeight: layout.drawHeight,
            resizeQuality: "high",
        });
    } catch {
        // Older WebGPU-capable browsers may not implement decode-time resize. Drawing a regular
        // bitmap into the bounded canvas still avoids the full-resolution RGBA RawImage copy.
        bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    }
    try {
        const canvas = new OffscreenCanvas(layout.frameWidth, layout.frameHeight);
        const context = canvas.getContext("2d");
        if (context === null) throw new Error("The image worker could not create a 2D canvas.");
        // Neutral opaque padding avoids introducing black/transparent edges as artificial visual
        // evidence while preserving the source aspect ratio.
        context.fillStyle = "rgb(127, 127, 127)";
        context.fillRect(0, 0, layout.frameWidth, layout.frameHeight);
        context.drawImage(bitmap, layout.drawX, layout.drawY, layout.drawWidth, layout.drawHeight);
        const pixels = context.getImageData(0, 0, layout.frameWidth, layout.frameHeight).data;
        return new RawImage(pixels, layout.frameWidth, layout.frameHeight, 4);
    } finally {
        bitmap.close();
    }
}

/** Decode once at Gemma4's native, aspect-preserving patch target. This path deliberately does
 * not pass through Qwen's smaller 640-patch frame, which made small receipt dates unreadable. */
async function decodeGemmaImage(bytes: ArrayBuffer): Promise<RawImage> {
    const dimensions = intrinsicImageDimensions(bytes);
    if (dimensions === undefined) {
        throw new Error("The browser model could not verify this image's encoded dimensions.");
    }
    const target = gemma4WebGpuImageTarget(dimensions.width, dimensions.height);
    const blob = new Blob([bytes]);
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(blob, {
            imageOrientation: "from-image",
            resizeWidth: target.width,
            resizeHeight: target.height,
            resizeQuality: "high",
        });
    } catch {
        bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    }
    try {
        const canvas = new OffscreenCanvas(target.width, target.height);
        const context = canvas.getContext("2d");
        if (context === null) throw new Error("The image worker could not create a 2D canvas.");
        context.drawImage(bitmap, 0, 0, target.width, target.height);
        const pixels = context.getImageData(0, 0, target.width, target.height).data;
        return new RawImage(pixels, target.width, target.height, 4);
    } finally {
        bitmap.close();
    }
}

/** Qwen's staged all-WebGPU decoder is exercised through the same one-vision-pass graph for text
 * verification. This frame is worker-authored and contains no caller pixels. */
function syntheticNeutralImage(): RawImage {
    const { frameWidth, frameHeight } = TRANSFORMERS_WEBGPU_FALLBACK_IMAGE_LAYOUT;
    const pixels = new Uint8ClampedArray(frameWidth * frameHeight * 4);
    for (let index = 0; index < pixels.length; index += 4) {
        pixels[index] = 127;
        pixels[index + 1] = 127;
        pixels[index + 2] = 127;
        pixels[index + 3] = 255;
    }
    return new RawImage(pixels, frameWidth, frameHeight, 4);
}

async function inferQwen(message: TransformersWebGpuInferRequest): Promise<string> {
    const { processor, model } = await loadQwenRuntime(message.requestId);
    post({ kind: "progress", requestId: message.requestId, phase: "inference" });

    const prompt =
        message.text === undefined ? message.prompt : `${message.prompt}\n\n${message.text}`;
    // Keep small receipt text legible in an aspect-preserving frame of at most 640 raw patches while
    // staying below the 720-patch dispatch known to reset the SM8650 Adreno Vulkan queue.
    const image =
        message.image === undefined
            ? syntheticNeutralImage()
            : await decodeBoundedImage(message.image);
    const conversation = [
        {
            role: "user" as const,
            content: [{ type: "image" as const }, { type: "text" as const, text: prompt }],
        },
    ];
    // Transformers.js forwards unknown top-level options into the Jinja context, but its current
    // declaration omits Qwen's enable_thinking variable. A named object preserves that supported
    // runtime behavior without weakening the processor type.
    const templateOptions = {
        add_generation_prompt: true,
        tokenize: false,
        enable_thinking: false,
    } as const;
    const formatted = processor.apply_chat_template(conversation, templateOptions);
    if (typeof formatted !== "string") throw new Error("Qwen processor returned no prompt text.");

    const inputs = await processor(formatted, image);
    let outputs: Tensor | undefined;
    let completion: Tensor | undefined;
    try {
        const inputIds = inputs.input_ids;
        if (!(inputIds instanceof Tensor)) throw new Error("Qwen processor returned no input IDs.");
        const imageGrid = inputs.image_grid_thw;
        if (!(imageGrid instanceof Tensor)) {
            throw new Error("Qwen processor returned no image patch grid.");
        }
        const patchCount = transformersWebGpuImageGridPatchCount(
            imageGrid.data as Iterable<number | bigint>,
        );
        if (patchCount === undefined || patchCount > TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES) {
            throw new Error("Qwen image preprocessing exceeded the mobile WebGPU patch limit.");
        }
        const generated = await model.generate({
            ...inputs,
            max_new_tokens: Math.min(message.maxTokens ?? 96, 96),
            do_sample: false,
        });
        if (!(generated instanceof Tensor))
            throw new Error("Qwen returned no generated token tensor.");
        outputs = generated;
        const inputLength = inputIds.dims.at(-1);
        if (inputLength === undefined) throw new Error("Qwen returned an invalid input shape.");
        completion = outputs.slice(null, [inputLength, outputs.dims[1]]);
        return processor.batch_decode(completion, { skip_special_tokens: true })[0]?.trim() ?? "";
    } finally {
        completion?.dispose();
        outputs?.dispose();
        disposeTensors(Object.values(inputs));
    }
}

async function inferGemma(message: TransformersWebGpuInferRequest): Promise<string> {
    const { processor, model } = await loadGemmaRuntime(message);
    post({ kind: "progress", requestId: message.requestId, phase: "inference" });
    const prompt =
        message.text === undefined ? message.prompt : `${message.prompt}\n\n${message.text}`;
    const image = message.image === undefined ? null : await decodeGemmaImage(message.image);
    let waveform: Float32Array | null = null;
    if (message.audioSamples !== undefined) {
        if (message.audioSampleRate !== 16_000) {
            throw new Error("Gemma voice input must be decoded to exactly 16 kHz PCM.");
        }
        waveform = new Float32Array(message.audioSamples);
        if (
            waveform.length < TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES ||
            waveform.length > TRANSFORMERS_WEBGPU_MAX_AUDIO_SAMPLES
        ) {
            throw new Error(
                "Gemma voice input must be at least 161 samples and no longer than 30 seconds at 16 kHz.",
            );
        }
        if (!waveform.every(Number.isFinite)) {
            throw new Error("Gemma voice input contains a non-finite PCM sample.");
        }
    }
    const content: Array<Record<string, string>> = [];
    if (image !== null) content.push({ type: "image" });
    if (waveform !== null) content.push({ type: "audio" });
    content.push({ type: "text", text: prompt });
    const conversation = [{ role: "user", content }];
    const formatted = processor.apply_chat_template(
        conversation as never,
        {
            add_generation_prompt: true,
            tokenize: false,
            enable_thinking: false,
        } as never,
    );
    if (typeof formatted !== "string") throw new Error("Gemma processor returned no prompt text.");

    const inputs = await processor(formatted, image, waveform, {
        add_special_tokens: false,
    } as never);
    let outputs: Tensor | undefined;
    let completion: Tensor | undefined;
    try {
        const inputIds = inputs.input_ids;
        if (!(inputIds instanceof Tensor))
            throw new Error("Gemma processor returned no input IDs.");
        const inputLength = inputIds.dims.at(-1);
        if (inputLength === undefined) throw new Error("Gemma returned an invalid input shape.");
        const maxStorageBufferBindingSize = (
            onnx.webgpu?.device as
                | { readonly limits?: { readonly maxStorageBufferBindingSize?: number } }
                | undefined
        )?.limits?.maxStorageBufferBindingSize;
        assertGemma4PromptTokenCount(inputLength, maxStorageBufferBindingSize);
        const generated = await model.generate({
            ...inputs,
            max_new_tokens: Math.min(message.maxTokens ?? 96, 96),
            do_sample: false,
            num_logits_to_keep: 1,
        } as never);
        if (!(generated instanceof Tensor))
            throw new Error("Gemma returned no generated token tensor.");
        outputs = generated;
        completion = outputs.slice(null, [inputLength, outputs.dims[1]]);
        return processor.batch_decode(completion, { skip_special_tokens: true })[0]?.trim() ?? "";
    } finally {
        completion?.dispose();
        outputs?.dispose();
        disposeTensors(Object.values(inputs));
    }
}

async function infer(message: TransformersWebGpuInferRequest): Promise<string> {
    switch (message.modelId) {
        case PHONE_QWEN3_VL_2B_MODEL_ID:
            if (message.audioSamples !== undefined) {
                throw new Error("Qwen3-VL 2B does not support voice messages.");
            }
            return inferQwen(message);
        case PHONE_GEMMA4_E2B_MODEL_ID:
            return inferGemma(message);
        default:
            throw new Error("The requested all-WebGPU model is not supported by this worker.");
    }
}

workerScope.addEventListener("message", (event: MessageEvent<TransformersWebGpuToWorker>) => {
    const message = event.data;
    if (message?.kind === "dispose") {
        requestedDisposeId = message.requestId;
        if (!busy) {
            busy = true;
            void (async () => {
                try {
                    await disposeLoadedRuntime();
                    if (requestedDisposeId === message.requestId) requestedDisposeId = undefined;
                    post({ kind: "disposed", requestId: message.requestId });
                } catch (error) {
                    post({
                        kind: "error",
                        requestId: message.requestId,
                        error: `The model worker could not retire its WebGPU device: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    });
                } finally {
                    busy = false;
                }
            })();
        }
        return;
    }
    if (message?.kind !== "infer") return;
    if (busy) {
        post({
            kind: "error",
            requestId: message.requestId,
            error: "The on-device WebGPU image-model worker is already busy.",
        });
        return;
    }
    busy = true;
    void (async () => {
        let terminal: TransformersWebGpuFromWorker;
        try {
            const text = await infer(message);
            terminal = { kind: "result", requestId: message.requestId, text };
        } catch (error) {
            if (error instanceof AdapterUnavailableError) {
                terminal = {
                    kind: "unavailable",
                    requestId: message.requestId,
                    reason: TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON,
                };
            } else {
                terminal = {
                    kind: "error",
                    requestId: message.requestId,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        }

        let cleanupFailure: unknown;
        try {
            // No terminal result is ready for handoff until the bounded retirement barrier has
            // released every session and acknowledged device destruction.
            await disposeLoadedRuntime();
        } catch (error) {
            cleanupFailure = error;
            console.warn("[qwen-webgpu] model release after inference failed", error);
        }

        const disposeRequestId = requestedDisposeId;
        if (disposeRequestId !== undefined && cleanupFailure === undefined) {
            requestedDisposeId = undefined;
            post({ kind: "disposed", requestId: disposeRequestId });
        } else if (cleanupFailure !== undefined) {
            post({
                kind: "error",
                requestId: message.requestId,
                error: `${
                    terminal.kind === "error" ? `${terminal.error} ` : ""
                }The model worker could not retire its WebGPU device: ${
                    cleanupFailure instanceof Error
                        ? cleanupFailure.message
                        : String(cleanupFailure)
                }`,
            });
        } else {
            post(terminal);
        }
        busy = false;
    })();
});
