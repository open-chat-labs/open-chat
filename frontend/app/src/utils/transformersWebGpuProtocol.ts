/**
 * Wire contract and immutable artifact identity for the explicitly feature-flagged all-WebGPU
 * Transformers.js runtime. The flag defaults off, but may be enabled by a deliberate development
 * or production phone build.
 *
 * This is deliberately separate from the GGUF catalog. Model Manager preloads this exact manifest
 * into Transformers.js' revision-keyed browser Cache API entry; the worker never reads or mutates
 * Wllama's GGUF cache.
 */
export const PHONE_QWEN3_VL_2B_MODEL_ID = "qwen3-vl-2b-instruct-q4";
export const PHONE_GEMMA4_E2B_MODEL_ID = "gemma-4-e2b-it-q4";
export type TransformersWebGpuModelId =
    | typeof PHONE_QWEN3_VL_2B_MODEL_ID
    | typeof PHONE_GEMMA4_E2B_MODEL_ID;
export const TRANSFORMERS_QWEN_MODEL_ID = "onnx-community/Qwen3-VL-2B-Instruct-ONNX";
export const TRANSFORMERS_QWEN_REVISION = "3e4136ea66ae6e07c110e64fe07da2e029517ab5";
export const TRANSFORMERS_GEMMA_MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";
export const TRANSFORMERS_GEMMA_REVISION = "9f4bef82ea6e296bc69f8a2f5939f73af81b07a6";
export const TRANSFORMERS_WEBGPU_WORKER_PATH = "/transformers_webgpu_worker.js";
export const TRANSFORMERS_WEBGPU_ORT_ASSET_BASE =
    "/assets/transformers-webgpu/ort-1.29.0-dev.20260723-1b1e1db7bc";
export const TRANSFORMERS_WEBGPU_MODEL_PROXY_BASE = "/hf-model/";
export const TRANSFORMERS_WEBGPU_HUGGING_FACE_BASE = "https://huggingface.co/";
export const TRANSFORMERS_WEBGPU_PACKAGED_MODEL_BASE = "/assets/transformers-webgpu/qwen3vl2b/";
// These two Adreno-qualified graphs differ from the pinned Hub revision and must come from the
// audited APK payload. The remaining immutable files are downloaded from the Hub, verified against
// TRANSFORMERS_QWEN_ARTIFACTS, then stored under the same local cache keys the worker already reads.
export const TRANSFORMERS_WEBGPU_PACKAGED_MODEL_ARTIFACTS = [
    "onnx/decoder_model_merged_q4.onnx",
    "onnx/vision_encoder_q4.onnx",
] as const;
export const TRANSFORMERS_WEBGPU_CACHE_KEY =
    "codex-qwen3vl2b-all-webgpu-v4.2.0-q4-adreno-qk-f32-v1";
export const TRANSFORMERS_GEMMA_CACHE_KEY = "codex-gemma4-e2b-all-webgpu-v4.2.0-q4f16-row-embed-v1";

/**
 * Application runtime files needed before Transformers.js can open the three ONNX sessions.
 *
 * The ORT files are package-pinned and therefore have exact byte/digest identities. The worker is
 * produced by the current OpenChat build, so its identity is the website version in its URL plus a
 * digest recorded after Model Manager or persisted-startup restore has consumed the complete response.
 */
export const TRANSFORMERS_WEBGPU_RUNTIME_ASSETS = [
    {
        kind: "worker",
        path: TRANSFORMERS_WEBGPU_WORKER_PATH,
        minimumBytes: 64 * 1024,
        maximumBytes: 32 * 1024 * 1024,
    },
    {
        kind: "pinned",
        path: `${TRANSFORMERS_WEBGPU_ORT_ASSET_BASE}/ort-wasm-simd-threaded.jspi.mjs`,
        bytes: 46_313,
        sha256: "630c7cbb6eedffdd465f815d14051918ad4c9c6c7cc221190ca2fbe560b289eb",
    },
    {
        kind: "pinned",
        path: `${TRANSFORMERS_WEBGPU_ORT_ASSET_BASE}/ort-wasm-simd-threaded.jspi.wasm`,
        bytes: 15_580_557,
        sha256: "a4aebeebccc554f21641e348b76135a2b7a06151765fa71fd40a38bbb249962e",
    },
] as const;
export const TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON =
    "This device could not provide a WebGPU adapter for the Qwen3-VL 2B runtime. The model remains selected; embeddings, vision, and decoder all require WebGPU. Retry after updating Android System WebView and enabling hardware acceleration.";
// Transformers.js 4.2.0 resolves an object-valued `device` option by exact ONNX session/file name.
// The Adreno-qualified 2B artifacts require every session to stay on WebGPU. There is deliberately
// no CPU/WASM decoder fallback because it produces a different, incorrect extraction.
export const TRANSFORMERS_QWEN_DEVICE_MAP = {
    embed_tokens: "webgpu",
    vision_encoder: "webgpu",
    decoder_model_merged: "webgpu",
} as const;

export const TRANSFORMERS_GEMMA_DEVICE_MAP = {
    embed_tokens: "webgpu",
    vision_encoder: "webgpu",
    audio_encoder: "webgpu",
    decoder_model_merged: "webgpu",
} as const;

export const TRANSFORMERS_QWEN_ARTIFACTS = [
    {
        path: "config.json",
        bytes: 1_961,
        sha256: "85a783d2fc70cfaa46a7ea5fbed1ea0ad06ec120a3165bd75d464a77f566ab18",
    },
    {
        path: "generation_config.json",
        bytes: 276,
        sha256: "bf25bd273e561fe1196a04a35e9806c8f66bf260ae030d88b51dc9c76c37e797",
    },
    {
        path: "tokenizer.json",
        bytes: 9_117_036,
        sha256: "40ae5d1ee027b985684a3bbeef4ee16b2b5697d1d90658bec5bc5d2a73018bd7",
    },
    {
        path: "tokenizer_config.json",
        bytes: 6_200,
        sha256: "0364a2cb734b560ab69d4884ef694c8cbd36cbd3d8642c41013105524e41bb41",
    },
    {
        path: "preprocessor_config.json",
        bytes: 336,
        sha256: "6a970fd06f30e6943b3e2c14d5d3b42d49b06cf99b99103d56689bef462d90f8",
    },
    {
        path: "processor_config.json",
        bytes: 1_300,
        sha256: "14932921ca485d458a04dafd8069fbb0a4505622a48208d19ed247115801385b",
    },
    {
        path: "chat_template.jinja",
        bytes: 5_292,
        sha256: "3636d0f0bd6bef02654cdffdc447b79cb2cef8ab02cc75267345946291a489e4",
    },
    {
        path: "onnx/decoder_model_merged_q4.onnx",
        bytes: 5_087_381,
        sha256: "1c7b80033889ec7e5168e3d35942041e0aafcbb259a417f378da0432b434e04d",
    },
    {
        path: "onnx/decoder_model_merged_q4.onnx_data",
        bytes: 1_102_630_912,
        sha256: "35b8960257384ebe1eb293646f52fdec8d5d25177f37edfb116d63a90f92756c",
    },
    {
        path: "onnx/embed_tokens_q4.onnx",
        bytes: 857,
        sha256: "9499fcdba2e1cbbc172913fb2fb950d9b53de54b6a9338997b0956feb035bbad",
    },
    {
        path: "onnx/embed_tokens_q4.onnx_data",
        bytes: 199_340_032,
        sha256: "6c3b078ca20e4233f27de203812ba74c6b29d5ae4208932857886582ec6aa50d",
    },
    {
        path: "onnx/vision_encoder_q4.onnx",
        bytes: 388_996,
        sha256: "9e4585fdc96e118b27412133e3a37dca85f1abd471015accad9e76bc9959e6c3",
    },
    {
        path: "onnx/vision_encoder_q4.onnx_data",
        bytes: 217_952_256,
        sha256: "4582e91d7221675fb1593ab2f13115aa8403f601be2d9826bb0a84619e62af5a",
    },
] as const;

// Six q4 session artifacts plus every pinned tokenizer/processor/config file the worker reads.
export const TRANSFORMERS_QWEN_ARTIFACT_BYTES = 1_534_532_835;

/** Exact immutable Gemma text/image install. Audio is deliberately excluded and managed as an
 * optional add-on, so selecting Gemma never downloads audio weights the user did not ask for. */
export const TRANSFORMERS_GEMMA_ARTIFACTS = [
    {
        path: "config.json",
        bytes: 5_549,
        sha256: "5494e6677d9e150ea20ba3101ae8a32b0f141004626f052725d8bf48991b9faa",
    },
    {
        path: "generation_config.json",
        bytes: 238,
        sha256: "e6a0b50de21a511f15ac4857b7f227f68ee60ecb1f11255d07b75e0bdc60e155",
    },
    {
        path: "tokenizer.json",
        bytes: 19_439_251,
        sha256: "47bd35616c7c782aaca6ccf48c75f3461d5877170984b8836b375107d0a9f566",
    },
    {
        path: "tokenizer_config.json",
        bytes: 18_807,
        sha256: "06afbf54e228050cba79c4a0afd83543cc89070a2d62b8337d0aa8b4cdc348c3",
    },
    {
        path: "processor_config.json",
        bytes: 1_689,
        sha256: "32bdf45d2ad4cc29a0822ddd157a182de76644f0419a6228d151495256e9813c",
    },
    {
        path: "preprocessor_config.json",
        bytes: 43,
        sha256: "4457c6e8a09070d7d5d1cd983fbfb67ebafe602bd98120c3543a024f5d07056b",
    },
    {
        path: "chat_template.jinja",
        bytes: 16_317,
        sha256: "781d10940fbc44be40064b5d43a056fc486c84ceaa55538226368b57314132bf",
    },
    {
        path: "onnx/decoder_model_merged_q4f16.onnx",
        bytes: 673_231,
        sha256: "73c0f1fe04f9a3a048fb3319c0671b6cf0346bf33a3a8624c853bcffe01c24a4",
    },
    {
        path: "onnx/decoder_model_merged_q4f16.onnx_data",
        bytes: 1_519_700_992,
        sha256: "3b27245a7396cb7039a4e4118bd2a8aa35106bae381522edf7c4867b5f22bb10",
    },
    {
        path: "onnx/embed_tokens_q4f16.onnx",
        bytes: 5_621,
        sha256: "d7ca53f6a169471b5699b2f57ee4c7aa2c73732b0152f3909e64b71384444825",
    },
    {
        path: "onnx/embed_tokens_q4f16.onnx_data",
        bytes: 1_590_689_792,
        sha256: "024b199e6358ed42970f807686add5f9430d7e254ca7ce22fc9c83f015b9c517",
    },
    {
        path: "onnx/vision_encoder_q4f16.onnx",
        bytes: 189_124,
        sha256: "e0a4e48e519ade4eeddbb4cdadb812a7251aea871f7fb5f50576615fd3af22a3",
    },
    {
        path: "onnx/vision_encoder_q4f16.onnx_data",
        bytes: 99_189_440,
        sha256: "0835071d2c79c105f8e1b549b7f8dd8c9af07fa95f01ead2e7add280602d3c6d",
    },
] as const;

export const TRANSFORMERS_GEMMA_ARTIFACT_BYTES = 3_229_930_094;

/** Optional voice-message encoder. Base Gemma readiness and selection never require these files. */
export const TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS = [
    {
        path: "onnx/audio_encoder_q4f16.onnx",
        bytes: 260_446,
        sha256: "5e0deb22791685c792d4b8e089deef9670fa4a4cecde434213d6a742e58fc3fa",
    },
    {
        path: "onnx/audio_encoder_q4f16.onnx_data",
        bytes: 171_258_112,
        sha256: "df58e61a00bafa9449ee5fd52895ce952f158bbdd1fe38df8a68f48f36842e62",
    },
] as const;

export const TRANSFORMERS_GEMMA_AUDIO_ARTIFACT_BYTES = 171_518_558;

export type TransformersWebGpuArtifact = {
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
};

export type TransformersWebGpuModelSpec = {
    readonly id: TransformersWebGpuModelId;
    readonly name: string;
    readonly description: string;
    readonly repository: string;
    readonly revision: string;
    readonly dtype: "q4" | "q4f16";
    readonly cacheKey: string;
    readonly artifacts: readonly TransformersWebGpuArtifact[];
    readonly artifactBytes: number;
    readonly modalities: readonly ("text" | "image" | "audio")[];
    readonly packagedModelBase?: string;
    readonly packagedArtifacts: readonly string[];
    readonly optionalAudio?: {
        readonly artifacts: readonly TransformersWebGpuArtifact[];
        readonly artifactBytes: number;
    };
};

export const TRANSFORMERS_WEBGPU_MODEL_SPECS: Readonly<
    Record<TransformersWebGpuModelId, TransformersWebGpuModelSpec>
> = {
    [PHONE_QWEN3_VL_2B_MODEL_ID]: {
        id: PHONE_QWEN3_VL_2B_MODEL_ID,
        name: "Qwen3-VL 2B (vision)",
        description:
            "Pinned Qwen3-VL 2B text and image model. Embeddings, vision, and decoding all run on WebGPU.",
        repository: TRANSFORMERS_QWEN_MODEL_ID,
        revision: TRANSFORMERS_QWEN_REVISION,
        dtype: "q4",
        cacheKey: TRANSFORMERS_WEBGPU_CACHE_KEY,
        artifacts: TRANSFORMERS_QWEN_ARTIFACTS,
        artifactBytes: TRANSFORMERS_QWEN_ARTIFACT_BYTES,
        modalities: ["text", "image"],
        packagedModelBase: TRANSFORMERS_WEBGPU_PACKAGED_MODEL_BASE,
        packagedArtifacts: TRANSFORMERS_WEBGPU_PACKAGED_MODEL_ARTIFACTS,
    },
    [PHONE_GEMMA4_E2B_MODEL_ID]: {
        id: PHONE_GEMMA4_E2B_MODEL_ID,
        name: "Gemma 4 E2B (multimodal)",
        description:
            "Pinned Gemma 4 E2B text and image model. Voice messages are available as a separate optional download.",
        repository: TRANSFORMERS_GEMMA_MODEL_ID,
        revision: TRANSFORMERS_GEMMA_REVISION,
        dtype: "q4f16",
        cacheKey: TRANSFORMERS_GEMMA_CACHE_KEY,
        artifacts: TRANSFORMERS_GEMMA_ARTIFACTS,
        artifactBytes: TRANSFORMERS_GEMMA_ARTIFACT_BYTES,
        modalities: ["text", "image", "audio"],
        packagedArtifacts: [],
        optionalAudio: {
            artifacts: TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS,
            artifactBytes: TRANSFORMERS_GEMMA_AUDIO_ARTIFACT_BYTES,
        },
    },
};

export function transformersWebGpuModelSpec(
    modelId: string | undefined,
): TransformersWebGpuModelSpec | undefined {
    return modelId === PHONE_QWEN3_VL_2B_MODEL_ID || modelId === PHONE_GEMMA4_E2B_MODEL_ID
        ? TRANSFORMERS_WEBGPU_MODEL_SPECS[modelId]
        : undefined;
}

export type TransformersWebGpuProgressPhase = "loading" | "downloading" | "inference";

export type TransformersWebGpuToWorker =
    | {
          kind: "infer";
          requestId: number;
          modelId: TransformersWebGpuModelId;
          prompt: string;
          text?: string;
          /** Omitted for text-only requests. The worker supplies its own neutral vision frame because
           * the pinned staged Qwen decoder requires one vision pass; no caller image bytes cross that seam. */
          image?: ArrayBuffer;
          /** Decoded, mono PCM. Encoded chat audio is decoded and resampled before it crosses the worker
           * boundary, while feature extraction and the audio encoder remain local to the Gemma worker. */
          audioSamples?: ArrayBuffer;
          audioSampleRate?: 16_000;
          maxTokens?: number;
      }
    | {
          /** Best-effort cancellation followed by the same bounded GPU retirement barrier used on
           * successful inference. The main thread waits for `disposed` before terminating. */
          kind: "dispose";
          requestId: number;
      };

export type TransformersWebGpuFromWorker =
    | {
          kind: "progress";
          requestId: number;
          phase: TransformersWebGpuProgressPhase;
          progress?: number;
          file?: string;
      }
    | { kind: "result"; requestId: number; text: string }
    | { kind: "unavailable"; requestId: number; reason: string }
    | { kind: "error"; requestId: number; error: string }
    | { kind: "disposed"; requestId: number }
    | { kind: "runtime_error"; error: string };
