import {
    env,
    Qwen2Tokenizer,
    Qwen2VLImageProcessor,
    Qwen3VLForConditionalGeneration,
    Qwen3VLProcessor,
    RawImage,
    Tensor,
} from "@huggingface/transformers";
import {
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
    TRANSFORMERS_WEBGPU_NORMALIZED_PROCESSOR_MARKER,
    transformersWebGpuProcessorConfig,
} from "../utils/transformersWebGpuProcessorConfig";

type LoadedRuntime = {
    processor: Qwen3VLProcessor;
    model: Awaited<ReturnType<typeof Qwen3VLForConditionalGeneration.from_pretrained>>;
};

type OnnxEnvironment = {
    wasm?: {
        wasmPaths?: { mjs: string; wasm: string };
        numThreads?: number;
        proxy?: boolean;
    };
    webgpu?: {
        adapter?: unknown;
        device?: {
            lost?: Promise<{ message?: string; reason?: string }>;
            queue?: { onSubmittedWorkDone(): Promise<void> };
        };
        powerPreference?: "high-performance" | "low-power";
    };
};

type RunnableSession = {
    run: (...args: unknown[]) => Promise<unknown>;
};

type WorkerNavigator = Navigator & {
    gpu?: {
        requestAdapter(options?: {
            powerPreference?: "high-performance" | "low-power";
        }): Promise<unknown | null>;
    };
};

class AdapterUnavailableError extends Error {}

const INPUT_IMAGE_WIDTH = 256;
const INPUT_IMAGE_HEIGHT = 448;
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

const workerScope = globalThis as unknown as DedicatedWorkerGlobalScope;
const onnx = env.backends.onnx as OnnxEnvironment;
let loadedRuntime: LoadedRuntime | undefined;
let runtimePromise: Promise<LoadedRuntime> | undefined;
let runtimeGeneration = 0;
let busy = false;
let activeGpuStage = "runtime initialization";

function post(message: TransformersWebGpuFromWorker): void {
    workerScope.postMessage(message);
}

function configureRuntimeAssets(): void {
    if (onnx.wasm === undefined || onnx.webgpu === undefined) {
        throw new Error("The pinned browser ONNX runtime did not initialize its WebGPU backend.");
    }
    // ORT's factory and WASM stay same-origin. Disabling the preload helper prevents its fetched
    // factory from being converted to a blob-module import, which would require weakening script-src.
    env.useWasmCache = false;
    env.useBrowserCache = true;
    // Keep the Adreno-safe ONNX graph revision isolated from caches populated before the
    // decoder/vision patches were served. Account/session storage is unaffected by this key.
    env.cacheKey = TRANSFORMERS_WEBGPU_CACHE_KEY;
    env.allowLocalModels = false;
    // Transformers.js validates that at least one source is enabled before it checks Cache Storage.
    // Keep remote resolution enabled only to build matching cache keys. Cache hits happen before
    // env.fetch; a cache miss reaches this fail-closed hook instead of downloading during inference.
    env.allowRemoteModels = true;
    env.fetch = async () => {
        throw new Error(
            "Qwen3-VL 2B is not fully downloaded. Open On-device models and tap Retry download.",
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
    onnx.webgpu.powerPreference = "high-performance";
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

async function requestAdapter(): Promise<unknown> {
    const gpu = (navigator as WorkerNavigator).gpu;
    if (gpu === undefined) throw new AdapterUnavailableError();
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    if (adapter === null) throw new AdapterUnavailableError();
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

async function disposeLoadedRuntime(expected = loadedRuntime): Promise<void> {
    if (expected === undefined || loadedRuntime !== expected) return;
    loadedRuntime = undefined;
    runtimePromise = undefined;
    runtimeGeneration++;
    await expected.model.dispose();
}

function watchDeviceLoss(runtime: LoadedRuntime, generation: number): void {
    const lost = onnx.webgpu?.device?.lost;
    if (lost === undefined) return;
    void lost.then((info) => {
        if (generation !== runtimeGeneration || loadedRuntime !== runtime) return;
        const disposing = disposeLoadedRuntime(runtime);
        const reason = info.reason === undefined ? "" : ` (${info.reason})`;
        post({
            kind: "runtime_error",
            error: `The WebGPU device was lost during ${activeGpuStage}${reason}${
                info.message ? `: ${info.message}` : "."
            }`,
        });
        void disposing.catch(() => undefined);
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
        session.run = async (...args) => {
            const started = performance.now();
            activeGpuStage = `${name} execution`;
            console.info(`[qwen-webgpu] ${name} started`);
            try {
                const result = await run(...args);
                activeGpuStage = `${name} completed`;
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
                    `[qwen-webgpu] ${name} completed in ${Math.round(performance.now() - started)} ms`,
                );
                return result;
            } catch (error) {
                activeGpuStage = `${name} failed`;
                throw error;
            }
        };
    }
}

async function loadRuntime(requestId: number): Promise<LoadedRuntime> {
    if (loadedRuntime !== undefined) return loadedRuntime;
    if (runtimePromise !== undefined) return runtimePromise;

    configureRuntimeAssets();
    const generation = ++runtimeGeneration;
    const progress_callback = progressFor(requestId);
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
        const getJson = async (name: string): Promise<any> => JSON.parse(await getText(name));
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
            } as never,
        } as const;
        const model = await Qwen3VLForConditionalGeneration.from_pretrained(
            TRANSFORMERS_QWEN_MODEL_ID,
            modelOptions,
        );
        const runtime: LoadedRuntime = { processor, model };
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
    return runtimePromise;
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

/** Decode directly into the fixed inference surface and close the browser ImageBitmap. The
 * Transformers.js RawImage Blob reader first retains a full-resolution RGBA copy and does not close
 * its ImageBitmap, which raises the phone's transient memory peak before the model even runs. */
async function decodeBoundedImage(bytes: ArrayBuffer): Promise<RawImage> {
    const blob = new Blob([bytes]);
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(blob, {
            resizeWidth: INPUT_IMAGE_WIDTH,
            resizeHeight: INPUT_IMAGE_HEIGHT,
            resizeQuality: "high",
        });
    } catch {
        // Older WebGPU-capable browsers may not implement decode-time resize. Drawing a regular
        // bitmap into the bounded canvas still avoids the full-resolution RGBA RawImage copy.
        bitmap = await createImageBitmap(blob);
    }
    try {
        const canvas = new OffscreenCanvas(INPUT_IMAGE_WIDTH, INPUT_IMAGE_HEIGHT);
        const context = canvas.getContext("2d");
        if (context === null) throw new Error("The image worker could not create a 2D canvas.");
        context.drawImage(bitmap, 0, 0, INPUT_IMAGE_WIDTH, INPUT_IMAGE_HEIGHT);
        const pixels = context.getImageData(0, 0, INPUT_IMAGE_WIDTH, INPUT_IMAGE_HEIGHT).data;
        return new RawImage(pixels, INPUT_IMAGE_WIDTH, INPUT_IMAGE_HEIGHT, 4);
    } finally {
        bitmap.close();
    }
}

async function infer(message: TransformersWebGpuToWorker): Promise<string> {
    const { processor, model } = await loadRuntime(message.requestId);
    post({ kind: "progress", requestId: message.requestId, phase: "inference" });

    const prompt =
        message.text === undefined ? message.prompt : `${message.prompt}\n\n${message.text}`;
    // Keep the portrait legible at the known-stable 448 raw patches. The 720-patch dispatch is
    // known to reset the SM8650 Adreno Vulkan queue on the physical phone.
    const image = await decodeBoundedImage(message.image);
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

workerScope.addEventListener("message", (event: MessageEvent<TransformersWebGpuToWorker>) => {
    const message = event.data;
    if (message?.kind !== "infer") return;
    if (busy) {
        post({
            kind: "error",
            requestId: message.requestId,
            error: "The isolated image-model worker is already busy.",
        });
        return;
    }
    busy = true;
    void (async () => {
        try {
            const text = await infer(message);
            try {
                await disposeLoadedRuntime();
            } catch (error) {
                // The main thread terminates this one-shot worker after receiving the result, so a
                // failed explicit release must not discard a completed extraction.
                console.warn("[qwen-webgpu] explicit model release failed", error);
            }
            post({ kind: "result", requestId: message.requestId, text });
        } catch (error) {
            try {
                await disposeLoadedRuntime();
            } catch (disposeError) {
                console.warn("[qwen-webgpu] model release after failure failed", disposeError);
            }
            if (error instanceof AdapterUnavailableError) {
                post({
                    kind: "unavailable",
                    requestId: message.requestId,
                    reason: TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON,
                });
                return;
            }
            post({
                kind: "error",
                requestId: message.requestId,
                error: error instanceof Error ? error.message : String(error),
            });
        } finally {
            busy = false;
        }
    })();
});
