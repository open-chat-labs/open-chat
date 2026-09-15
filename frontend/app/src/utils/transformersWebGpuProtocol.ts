import defaultCatalog from "../../public/model-catalog.json";
import { currentWebGpuModelSpec } from "./webGpuModelCatalog";
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
export type TransformersWebGpuModelId = string;
export const TRANSFORMERS_QWEN_MODEL_ID = "onnx-community/Qwen3-VL-2B-Instruct-ONNX";
export const TRANSFORMERS_QWEN_REVISION = "3e4136ea66ae6e07c110e64fe07da2e029517ab5";
export const TRANSFORMERS_GEMMA_MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";
export const TRANSFORMERS_GEMMA_REVISION = "9f4bef82ea6e296bc69f8a2f5939f73af81b07a6";
export {
    TRANSFORMERS_WEBGPU_WORKER_PATH,
    TRANSFORMERS_WEBGPU_ORT_ASSET_BASE,
    TRANSFORMERS_WEBGPU_RUNTIME_ASSETS,
} from "./transformersWebGpuRuntimeAssets";
export const TRANSFORMERS_WEBGPU_MODEL_PROXY_BASE = "/hf-model/";
export const TRANSFORMERS_WEBGPU_HUGGING_FACE_BASE = "https://huggingface.co/";
export const TRANSFORMERS_WEBGPU_PACKAGED_MODEL_BASE = "/assets/transformers-webgpu/qwen3vl2b/";
// These two transformed graphs differ from the pinned Hub revision and must come from the
// audited application payload. The mRoPE/DeepStack corrections still require phone qualification.
// The remaining immutable files are downloaded from the Hub, verified against
// TRANSFORMERS_QWEN_ARTIFACTS, then stored under the same local cache keys the worker already reads.
export const TRANSFORMERS_WEBGPU_PACKAGED_MODEL_ARTIFACTS = [
    "onnx/decoder_model_merged_q4.onnx",
    "onnx/vision_encoder_q4.onnx",
] as const;
export const TRANSFORMERS_WEBGPU_CACHE_KEY =
    "codex-qwen3vl2b-all-webgpu-v4.2.0-q4-adreno-qk-f32-v1";
export const TRANSFORMERS_GEMMA_CACHE_KEY = "codex-gemma4-e2b-all-webgpu-v4.2.0-q4f16-row-embed-v1";

export const TRANSFORMERS_WEBGPU_ADAPTER_UNAVAILABLE_REASON =
    "This device could not provide a WebGPU adapter for the Qwen3-VL 2B runtime. The model remains selected; embeddings, vision, and decoder all require WebGPU. Retry after updating Android System WebView and enabling hardware acceleration.";
// Transformers.js 4.2.0 resolves an object-valued `device` option by exact ONNX session/file name.
// The 2B runtime requires every session to stay on WebGPU. There is deliberately no CPU/WASM
// decoder fallback; model selection must not silently change the requested execution backend.
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

// Compatibility exports for existing callers, never positional catalog entries.
// Removing a bundled model is valid; runtime selection uses the live catalog.
export const TRANSFORMERS_QWEN_ARTIFACTS = (defaultCatalog.models.find(
    (model) => model.id === PHONE_QWEN3_VL_2B_MODEL_ID,
)?.artifacts ?? []) as readonly TransformersWebGpuArtifact[];

// Pinned session artifacts, losslessly restored vision features, and all processor/config files.
export const TRANSFORMERS_QWEN_ARTIFACT_BYTES = TRANSFORMERS_QWEN_ARTIFACTS.reduce(
    (total, artifact) => total + artifact.bytes,
    0,
);

/** Exact immutable Gemma text/image install. Audio is deliberately excluded and managed as an
 * optional add-on, so selecting Gemma never downloads audio weights the user did not ask for. */
export const TRANSFORMERS_GEMMA_ARTIFACTS = (defaultCatalog.models.find(
    (model) => model.id === PHONE_GEMMA4_E2B_MODEL_ID,
)?.artifacts ?? []) as readonly TransformersWebGpuArtifact[];

export const TRANSFORMERS_GEMMA_ARTIFACT_BYTES = TRANSFORMERS_GEMMA_ARTIFACTS.reduce(
    (total, artifact) => total + artifact.bytes,
    0,
);

/** Optional voice-message encoder. Base Gemma readiness and selection never require these files. */
export const TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS = (defaultCatalog.models.find(
    (model) => model.id === PHONE_GEMMA4_E2B_MODEL_ID,
)?.optionalAudio?.artifacts ?? []) as readonly TransformersWebGpuArtifact[];

export const TRANSFORMERS_GEMMA_AUDIO_ARTIFACT_BYTES = TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS.reduce(
    (total, artifact) => total + artifact.bytes,
    0,
);

/** A bounded immutable source for a derived artifact. Both source and cached bytes are pinned. */
export type TransformersWebGpuArtifactSource = {
    readonly repository: string;
    readonly revision: string;
    readonly path: string;
    readonly range: {
        readonly start: number;
        readonly end: number;
        readonly totalBytes: number;
    };
    readonly bytes: number;
    readonly sha256: string;
    readonly transform: "bf16-le-to-f32-le";
};

export type TransformersWebGpuArtifact = {
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
    readonly source?: TransformersWebGpuArtifactSource;
};

export type TransformersWebGpuModelSpec = {
    readonly id: TransformersWebGpuModelId;
    readonly name: string;
    readonly description: string;
    readonly repository: string;
    readonly revision: string;
    readonly dtype: "q4" | "q4f16" | "fp16" | "fp32";
    readonly enabled: boolean;
    readonly adapter: "qwen3-vl-2b-staged-v1" | "gemma4-e2b-row-v1";
    readonly sessionDtypes: Readonly<Record<string, "q4" | "q4f16" | "fp16" | "fp32">>;
    readonly externalData: Readonly<Record<string, readonly { path: string; name: string }[]>>;
    readonly generation: {
        readonly maxOutputTokens: number;
        readonly doSample: boolean;
        readonly temperature: number;
        readonly topP: number;
        readonly topK: number;
        readonly repetitionPenalty: number;
    };
    readonly cacheKey: string;
    readonly artifacts: readonly TransformersWebGpuArtifact[];
    readonly artifactBytes: number;
    readonly modalities: readonly ("text" | "image" | "audio")[];
    readonly packagedModelBase?: string;
    readonly developmentModelBase?: string;
    readonly packagedArtifacts: readonly string[];
    readonly optionalAudio?: {
        readonly artifacts: readonly TransformersWebGpuArtifact[];
        readonly artifactBytes: number;
    };
};

/** Bundled defaults for build tooling; runtime consumers use the validated catalog. */
export const TRANSFORMERS_WEBGPU_MODEL_SPECS: Readonly<
    Record<string, TransformersWebGpuModelSpec>
> = Object.fromEntries(
    defaultCatalog.models.map((model) => [model.id, model as TransformersWebGpuModelSpec]),
);

export function transformersWebGpuModelSpec(
    modelId: string | undefined,
): TransformersWebGpuModelSpec | undefined {
    return currentWebGpuModelSpec(modelId);
}

export type TransformersWebGpuProgressPhase = "loading" | "downloading" | "inference";

export type TransformersWebGpuToWorker =
    | {
          kind: "infer";
          requestId: number;
          modelId: TransformersWebGpuModelId;
          modelSpec: TransformersWebGpuModelSpec;
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
