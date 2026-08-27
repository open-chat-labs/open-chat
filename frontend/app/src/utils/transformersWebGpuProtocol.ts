/**
 * Wire contract and immutable artifact identity for the development-only Transformers.js spike.
 *
 * This is deliberately separate from the GGUF catalog. Model Manager preloads this exact manifest
 * into Transformers.js' revision-keyed browser Cache API entry; the worker never reads or mutates
 * Wllama's GGUF cache.
 */
export const PHONE_QWEN3_VL_2B_MODEL_ID = "qwen3-vl-2b-instruct-q4";
export const TRANSFORMERS_QWEN_MODEL_ID = "onnx-community/Qwen3-VL-2B-Instruct-ONNX";
export const TRANSFORMERS_QWEN_REVISION = "3e4136ea66ae6e07c110e64fe07da2e029517ab5";
export const TRANSFORMERS_WEBGPU_WORKER_PATH = "/transformers_webgpu_worker.js";
export const TRANSFORMERS_WEBGPU_ORT_ASSET_BASE =
    "/assets/transformers-webgpu/ort-1.29.0-dev.20260723-1b1e1db7bc";
export const TRANSFORMERS_WEBGPU_MODEL_PROXY_BASE = "/hf-model/";
export const TRANSFORMERS_WEBGPU_CACHE_KEY =
    "codex-qwen3vl2b-all-webgpu-v4.2.0-q4-adreno-qk-f32-v1";
export const TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON =
    "This browser could not provide a WebGPU adapter for the Qwen3-VL 2B runtime. The model remains selected; embeddings, vision, and decoder all require WebGPU. Retry on an up-to-date, hardware-accelerated Chrome device.";
// Transformers.js 4.2.0 resolves an object-valued `device` option by exact ONNX session/file name.
// The Adreno-qualified 2B artifacts require every session to stay on WebGPU. There is deliberately
// no CPU/WASM decoder fallback because it produces a different, incorrect extraction.
export const TRANSFORMERS_QWEN_DEVICE_MAP = {
    embed_tokens: "webgpu",
    vision_encoder: "webgpu",
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

export type TransformersWebGpuProgressPhase = "loading" | "downloading" | "inference";

export type TransformersWebGpuToWorker = {
    kind: "infer";
    requestId: number;
    prompt: string;
    text?: string;
    image: ArrayBuffer;
    maxTokens?: number;
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
    | { kind: "runtime_error"; error: string };
