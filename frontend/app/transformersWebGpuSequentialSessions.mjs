import { createQwen3Vl2bGenerationRuntime } from "./transformersWebGpuQwenGenerationRuntime.mjs";
import { createQwen3Vl2bVisionGeometryRuntime } from "./transformersWebGpuQwenVisionGeometry.mjs";
import { createQwen3Vl2bVisionSession } from "./transformersWebGpuQwenVisionSession.mjs";

const SOURCE_SESSION_MODULE_SUFFIX = "/@huggingface/transformers/src/models/session.js";
const DIST_SESSION_MODULE_SUFFIX = "/@huggingface/transformers/dist/transformers.web.js";

export const TRANSFORMERS_WEBGPU_SEQUENTIAL_SESSION_MARKER =
    "[qwen-webgpu] loading model sessions sequentially";

export const TRANSFORMERS_WEBGPU_STAGED_DECODER_MARKER =
    "[qwen-webgpu] loading decoder after releasing prompt sessions";

export const TRANSFORMERS_WEBGPU_TIED_EMBEDDING_MARKER =
    "[qwen-webgpu] reusing decoder tied embeddings for cached tokens";

export const TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT = "__openchat_input_ids";

// This function is embedded into the pinned upstream module below. It performs only
// validation and bit-preserving tensor placement, never model arithmetic on the CPU.
function createQwenDeepStackTransport(imageTokenId) {
    if (imageTokenId !== 151655) {
        throw new Error("The pinned Qwen image-token configuration changed.");
    }
    const outputNames = [0, 1, 2].map((i) => "__openchat_deepstack_features_" + i);
    const inputNames = [0, 1, 2].map((i) => "__openchat_deepstack_" + i);
    let promptIds;
    let features;
    let TensorConstructor;
    let failed = false;
    const clearPrompt = () => {
        promptIds = undefined;
        features = undefined;
    };
    const check = () => {
        if (failed) throw new Error("The Qwen DeepStack transport failed or was released.");
    };
    const bindConstructor = (tensor) => {
        if (
            typeof tensor.constructor !== "function" ||
            (TensorConstructor !== undefined && TensorConstructor !== tensor.constructor)
        ) {
            throw new Error("Qwen DeepStack features use a different ORT Tensor constructor.");
        }
        TensorConstructor = tensor.constructor;
    };
    const checkedFeatures = (tensor, count) => {
        if (
            tensor?.location !== "cpu" ||
            tensor.type !== "float32" ||
            !(tensor.data instanceof Float32Array) ||
            !Array.isArray(tensor.dims) ||
            tensor.dims.length !== 2 ||
            tensor.dims[1] !== 2048 ||
            !Number.isSafeInteger(tensor.dims[0]) ||
            tensor.dims[0] < 1 ||
            (count !== undefined && tensor.dims[0] !== count) ||
            tensor.data.length !== tensor.dims[0] * 2048 ||
            !tensor.data.every(Number.isFinite)
        ) {
            throw new Error("Qwen DeepStack requires exact CPU-owned float32 feature rows.");
        }
        bindConstructor(tensor);
        return tensor;
    };
    const makeFeeds = (dims, positions) => {
        const feeds = {};
        try {
            for (let stage = 0; stage < 3; stage++) {
                const data = new Float32Array(dims[0] * dims[1] * 2048);
                if (positions !== undefined) {
                    positions.forEach((position, row) => {
                        data.set(
                            features[stage].subarray(row * 2048, (row + 1) * 2048),
                            position * 2048,
                        );
                    });
                }
                feeds[inputNames[stage]] = new TensorConstructor("float32", data, [...dims]);
            }
            return feeds;
        } catch (error) {
            for (const tensor of Object.values(feeds)) {
                try {
                    tensor.dispose?.();
                } catch {
                    /* Preserve the allocation failure. */
                }
            }
            throw error;
        }
    };
    return {
        inputNames,
        check,
        clearPrompt,
        fail: () => {
            failed = true;
            clearPrompt();
            TensorConstructor = undefined;
        },
        capturePromptIds: (inputIds) => {
            check();
            if (
                promptIds !== undefined ||
                inputIds.location !== "cpu" ||
                !(inputIds.data instanceof BigInt64Array) ||
                inputIds.dims[0] !== 1 ||
                inputIds.dims[1] < 1 ||
                inputIds.data.length !== inputIds.dims[1]
            ) {
                throw new Error("Qwen DeepStack requires one exact CPU int64 input_ids batch.");
            }
            // Upstream owns this tensor and may subsequently reshape or dispose it.
            promptIds = new BigInt64Array(inputIds.data);
        },
        captureEmbedding: (tensor) => {
            check();
            bindConstructor(tensor);
        },
        captureVision: (result) => {
            const owned = result && typeof result === "object" ? Object.values(result) : [];
            let accepted = false;
            let failed = false;
            let capturedResult;
            let cleanupFailed = false;
            let cleanupError;
            try {
                check();
                if (
                    features !== undefined ||
                    !result ||
                    JSON.stringify(Object.keys(result).sort()) !==
                        JSON.stringify(["image_features", ...outputNames].sort()) ||
                    new Set(owned).size !== 4
                ) {
                    throw new Error("The Qwen DeepStack vision output contract changed.");
                }
                const image = checkedFeatures(result.image_features);
                const captured = outputNames.map((name) => {
                    const tensor = checkedFeatures(result[name], image.dims[0]);
                    return new Float32Array(tensor.data);
                });
                features = captured;
                accepted = true;
                // Upstream encode_image intentionally returns only image_features. Keep our
                // owned copies and dispose the extra raw ORT outputs before it drops them.
                capturedResult = { image_features: image };
            } catch (error) {
                failed = true;
                throw error;
            } finally {
                for (const tensor of new Set(owned)) {
                    if (!accepted || tensor !== result.image_features) {
                        try {
                            tensor?.dispose?.();
                        } catch (error) {
                            if (!cleanupFailed) cleanupError = error;
                            cleanupFailed = true;
                        }
                    }
                }
                if (cleanupFailed && accepted) {
                    // Returning an image failed with the extra-output cleanup; ownership never
                    // reaches Transformers.js, so discard that output too.
                    try {
                        result.image_features?.dispose?.();
                    } catch {
                        // Preserve the first cleanup error while still attempting image disposal.
                    }
                }
            }
            if (cleanupFailed && !failed) throw cleanupError;
            return capturedResult;
        },
        promptFeeds: (embeddings) => {
            check();
            try {
                if (
                    promptIds === undefined ||
                    features === undefined ||
                    embeddings.dims[0] !== 1 ||
                    embeddings.dims[1] !== promptIds.length ||
                    embeddings.constructor !== TensorConstructor
                ) {
                    throw new Error(
                        "Qwen DeepStack prompt features or original input_ids are unavailable.",
                    );
                }
                const positions = [];
                for (let i = 0; i < promptIds.length; i++)
                    if (promptIds[i] === 151655n) positions.push(i);
                if (positions.length !== features[0].length / 2048) {
                    throw new Error("Qwen DeepStack image-token and feature counts do not match.");
                }
                return makeFeeds(embeddings.dims, positions);
            } finally {
                clearPrompt();
            }
        },
        cachedFeeds: (embeddings) => {
            check();
            if (
                promptIds !== undefined ||
                features !== undefined ||
                embeddings.dims[0] !== 1 ||
                embeddings.constructor !== TensorConstructor
            ) {
                throw new Error("Qwen DeepStack cached-step state is inconsistent.");
            }
            return makeFeeds(embeddings.dims);
        },
    };
}

/**
 * Force the pinned Gemma GQA nodes onto ORT's decomposed WebGPU attention path without changing
 * their 512-token sliding window. ORT uses smooth_softmax=1 as a routing condition; the matching
 * device wrapper removes that sentinel from the generated softmax WGSL before compilation.
 *
 * This fixed-size protobuf rewrite deliberately replaces the redundant rotary_interleaved=0
 * attribute. Unknown zero-valued fields occupy the four spare bytes so every enclosing protobuf
 * length and every external-data offset remains unchanged.
 */
export function patchGemma4DecoderForStandardSoftmaxRouting(model) {
    let input;
    if (model instanceof Uint8Array) {
        input = model;
    } else if (model instanceof ArrayBuffer) {
        input = new Uint8Array(model);
    } else if (ArrayBuffer.isView(model)) {
        input = new Uint8Array(model.buffer, model.byteOffset, model.byteLength);
    } else {
        throw new TypeError("The pinned Gemma decoder graph was not loaded as bytes.");
    }
    const bytes = new Uint8Array(input);
    const original = Uint8Array.of(
        0x2a,
        0x19,
        0x0a,
        0x12,
        114,
        111,
        116,
        97,
        114,
        121,
        95,
        105,
        110,
        116,
        101,
        114,
        108,
        101,
        97,
        118,
        101,
        100,
        0x18,
        0x00,
        0xa0,
        0x01,
        0x02,
    );
    const replacement = Uint8Array.of(
        0x2a,
        0x19,
        0x0a,
        0x0e,
        115,
        109,
        111,
        111,
        116,
        104,
        95,
        115,
        111,
        102,
        116,
        109,
        97,
        120,
        0x78,
        0x00,
        0x78,
        0x00,
        0x18,
        0x01,
        0xa0,
        0x01,
        0x02,
    );
    const matches = (pattern) => {
        const offsets = [];
        for (let offset = 0; offset <= bytes.length - pattern.length; offset++) {
            let matched = true;
            for (let index = 0; index < pattern.length; index++) {
                if (bytes[offset + index] !== pattern[index]) {
                    matched = false;
                    break;
                }
            }
            if (matched) {
                offsets.push(offset);
                offset += pattern.length - 1;
            }
        }
        return offsets;
    };
    const originalOffsets = matches(original);
    const replacementOffsets = matches(replacement);
    if (originalOffsets.length === 0 && replacementOffsets.length === 12) return bytes;
    if (originalOffsets.length !== 12 || replacementOffsets.length !== 0) {
        throw new Error(
            "The pinned Gemma decoder attention graph changed; refusing an unverified FlashAttention bypass.",
        );
    }
    for (const offset of originalOffsets) bytes.set(replacement, offset);
    return bytes;
}

export const TRANSFORMERS_GEMMA_DECODER_INPUT_METADATA = Object.freeze([
    {
        name: "inputs_embeds",
        isTensor: true,
        type: "float32",
        shape: ["batch_size", "sequence_length", 1536],
    },
    {
        name: "attention_mask",
        isTensor: true,
        type: "int64",
        shape: ["batch_size", "total_sequence_length"],
    },
    {
        name: "position_ids",
        isTensor: true,
        type: "int64",
        shape: ["batch_size", "sequence_length"],
    },
    { name: "num_logits_to_keep", isTensor: true, type: "int64", shape: [] },
    {
        name: "per_layer_inputs",
        isTensor: true,
        type: "float32",
        shape: ["batch_size", "sequence_length", 35, 256],
    },
    ...Array.from({ length: 15 }, (_, layer) => [
        {
            name: `past_key_values.${layer}.key`,
            isTensor: true,
            type: "float16",
            shape: [
                "batch_size",
                1,
                "past_sequence_length",
                [4, 9, 14].includes(layer) ? 512 : 256,
            ],
        },
        {
            name: `past_key_values.${layer}.value`,
            isTensor: true,
            type: "float16",
            shape: [
                "batch_size",
                1,
                "past_sequence_length",
                [4, 9, 14].includes(layer) ? 512 : 256,
            ],
        },
    ]).flat(),
]);

/**
 * Public metadata read synchronously by Transformers.js before the decoder's first run. The
 * matching tests parse both the audited source graph and transformed graph. The private token-ID
 * and three DeepStack inputs plus eight geometry controls are hidden from generic validation and
 * injected by the Qwen facade. Learned tensor arithmetic remains in the WebGPU graph.
 */
export const TRANSFORMERS_QWEN_DECODER_INPUT_METADATA = Object.freeze([
    {
        name: "inputs_embeds",
        isTensor: true,
        type: "float32",
        shape: ["batch_size", "sequence_length", 2048],
    },
    {
        name: "attention_mask",
        isTensor: true,
        type: "int64",
        shape: ["batch_size", "total_sequence_length"],
    },
    {
        name: "position_ids",
        isTensor: true,
        type: "int64",
        shape: [3, "batch_size", "sequence_length"],
    },
    ...Array.from({ length: 28 }, (_, layer) => [
        {
            name: `past_key_values.${layer}.key`,
            isTensor: true,
            type: "float32",
            shape: ["batch_size", 8, "past_sequence_length", 128],
        },
        {
            name: `past_key_values.${layer}.value`,
            isTensor: true,
            type: "float32",
            shape: ["batch_size", 8, "past_sequence_length", 128],
        },
    ]).flat(),
]);

const UPSTREAM_CONSTRUCT_SESSIONS = `export async function constructSessions(pretrained_model_name_or_path, names, options, cache_sessions = undefined) {
    return Object.fromEntries(
        await Promise.all(
            Object.keys(names).map(async (name) => {
                const cache_config = cache_sessions?.[name] ?? false;
                const { buffer_or_path, session_options, session_config } = await getSession(
                    pretrained_model_name_or_path,
                    names[name],
                    options,
                    cache_config,
                    name,
                );
                const session = await createInferenceSession(buffer_or_path, session_options, session_config);
                return [name, session];
            }),
        ),
    );
}`;

function stagedConstructSessionsSource(exported) {
    return `${exported ? "export " : ""}async function constructSessions(pretrained_model_name_or_path, names, options, cache_sessions = undefined) {
${patchGemma4DecoderForStandardSoftmaxRouting.toString()}
${createQwenDeepStackTransport.toString()}
${createQwen3Vl2bGenerationRuntime.toString()}
${createQwen3Vl2bVisionGeometryRuntime.toString()}
${createQwen3Vl2bVisionSession.toString()}
  const createSession = async (name, stagedExternalData = undefined) => {
    // Transformers.js 4.2 omits cache_sessions for Gemma4 even though its decoder exposes the
    // standard present.* outputs. Keep those tensors GPU-resident or every generated token would
    // download and upload the complete 15-layer KV cache.
    const cache_config =
      stagedGemma && name === "decoder_model_merged"
        ? true
        : cache_sessions?.[name] ?? false;
    const configuredSessionOptions = options.session_options ?? {};
    const {
      openchat_runtime_adapter: _runtimeAdapter,
      openchat_get_staged_external_data: _stagedExternalDataLoader,
      openchat_wait_for_staged_webgpu_queue: _waitForStagedWebGpuQueue,
      openchat_with_staged_webgpu_release: _withStagedWebGpuRelease,
      openchat_create_gemma_embed_session: _createGemmaEmbedSession,
      openchat_gemma_required_modality: _gemmaRequiredModality,
      openchat_report_staged_session: _reportStagedSession,
      ...cleanSessionOptions
    } = configuredSessionOptions;
    const cleanOptions =
      _runtimeAdapter === undefined &&
      _stagedExternalDataLoader === undefined &&
      _waitForStagedWebGpuQueue === undefined &&
      _withStagedWebGpuRelease === undefined &&
      _createGemmaEmbedSession === undefined &&
      _gemmaRequiredModality === undefined &&
      _reportStagedSession === undefined
        ? options
        : { ...options, session_options: cleanSessionOptions };
    const sessionLoadOptions =
      stagedExternalData === undefined
        ? cleanOptions
        : {
            ...cleanOptions,
            // The exact q4 data is already a verified CacheStorage Blob. Prevent Transformers.js
            // from independently reading the same response as a large Uint8Array.
            use_external_data_format: false,
            session_options: {
              ...cleanSessionOptions,
              externalData: stagedExternalData,
            },
          };
    _reportStagedSession?.(name, "metadata-start");
    let loaded = await getSession(
      pretrained_model_name_or_path,
      names[name],
      sessionLoadOptions,
      cache_config,
      name,
    );
    _reportStagedSession?.(name, "metadata-done");
    let session;
    // Until this function returns, it owns any successfully created native session, including
    // failures in reporting, external-data cleanup or the post-create queue barrier.
    try {
    try {
      if (stagedExternalData !== undefined) {
        const externalData = loaded.session_options.externalData;
        if (!Array.isArray(externalData) || externalData.length !== stagedExternalData.length) {
            throw new Error("The staged external data was not preserved by Transformers.js.");
        }
        for (const file of externalData) {
          if (
            typeof file !== "object" ||
            file === null ||
            !(file.data instanceof Blob) ||
            file.data.size < 1
          ) {
            throw new Error("The staged external data is not a non-empty Blob.");
          }
        }
      }
      _reportStagedSession?.(name, "compile-start");
      const sessionModel =
        stagedGemma && name === "decoder_model_merged"
          ? patchGemma4DecoderForStandardSoftmaxRouting(loaded.buffer_or_path)
          : loaded.buffer_or_path;
      if (stagedQwen) {
        // These exact settings qualify the pinned Qwen graphs. Never silently move a learned
        // operation onto the CPU; the INT64 option must reach ORT before provider creation.
        const configured = loaded.session_options;
        loaded.session_options = {
          ...configured,
          executionProviders: [{ name: "webgpu", preferredLayout: "NCHW" }],
          graphOptimizationLevel: "disabled",
          extra: {
            ...configured.extra,
            session: { ...configured.extra?.session, disable_cpu_ep_fallback: "1" },
            "ep.webgpuexecutionprovider.enableInt64": "1",
          },
        };
      }
      session = await createInferenceSession(
        sessionModel,
        loaded.session_options,
        loaded.session_config,
      );
      _reportStagedSession?.(name, "compile-done");
    } finally {
      // The pinned JSPI build mounts Blob external data directly and unmounts it before create
      // resolves. Drop the references immediately instead of retaining the 1.1 GB cache Blob.
      loaded.buffer_or_path = void 0;
      const externalData = loaded.session_options.externalData;
      if (Array.isArray(externalData)) {
        for (const file of externalData) {
          if (typeof file === "object" && file !== null && "data" in file) {
            file.data = void 0;
          }
        }
        loaded.session_options.externalData = void 0;
      }
      if (Array.isArray(stagedExternalData)) {
        for (const file of stagedExternalData) {
          if (typeof file === "object" && file !== null && "data" in file) {
            file.data = void 0;
          }
        }
      }
      loaded = void 0;
    }
    if (stagedQwen || stagedGemma) {
      await _waitForStagedWebGpuQueue(name);
      _reportStagedSession?.(name, "queue-drained");
    }
    return session;
    } catch (error) {
      try { await session?.release?.(); } catch {}
      throw error;
    }
  };
  const selected = (mapping, name) =>
    typeof mapping === "object" && mapping !== null ? mapping[name] : mapping;
  const nameKeys = Object.keys(names);
  const stagedQwen =
    options.session_options?.openchat_runtime_adapter === "qwen3-vl-2b-staged-v1" &&
    nameKeys.length === 3 &&
    names.embed_tokens === "embed_tokens" &&
    names.vision_encoder === "vision_encoder" &&
    names.decoder_model_merged === "decoder_model_merged" &&
    nameKeys.every((name) => selected(options.device, name) === "webgpu") &&
    nameKeys.every((name) => ["q4", "fp16", "fp32"].includes(selected(options.dtype, name))) &&
    typeof options.session_options?.openchat_get_staged_external_data === "function" &&
    typeof options.session_options?.openchat_wait_for_staged_webgpu_queue === "function" &&
    typeof options.session_options?.openchat_with_staged_webgpu_release === "function";

  const stagedGemma =
    options.session_options?.openchat_runtime_adapter === "gemma4-e2b-row-v1" &&
    nameKeys.length === 4 &&
    names.embed_tokens === "embed_tokens" &&
    names.audio_encoder === "audio_encoder" &&
    names.vision_encoder === "vision_encoder" &&
    names.decoder_model_merged === "decoder_model_merged" &&
    nameKeys.every((name) => selected(options.device, name) === "webgpu") &&
    nameKeys.every((name) => selected(options.dtype, name) === "q4f16") &&
    typeof options.session_options?.openchat_get_staged_external_data === "function" &&
    typeof options.session_options?.openchat_wait_for_staged_webgpu_queue === "function" &&
    typeof options.session_options?.openchat_with_staged_webgpu_release === "function" &&
    typeof options.session_options?.openchat_create_gemma_embed_session === "function" &&
    ["text", "image", "audio"].includes(
      options.session_options?.openchat_gemma_required_modality,
    );

  if (options.session_options?.openchat_runtime_adapter !== undefined && !stagedQwen && !stagedGemma) {
    throw new Error("Unsupported catalog adapter session configuration; no fallback is permitted.");
  }
  if (stagedQwen) {
    const deepStack = createQwenDeepStackTransport(options.config?.image_token_id);
    const generationRuntime = createQwen3Vl2bGenerationRuntime();
    const visionGeometry = createQwen3Vl2bVisionGeometryRuntime();
    console.info(${JSON.stringify(TRANSFORMERS_WEBGPU_STAGED_DECODER_MARKER)});
    const sessions = {};
    let initialVision;
    let initialEmbed;
    try {
      // Load the larger prompt session first, then the embedding session. Each verified shard is
      // handed to JSPI as a disk-backed Blob and discarded before the next one is materialized.
      const visionExternalData =
        await options.session_options.openchat_get_staged_external_data("vision_encoder");
      initialVision = await createSession("vision_encoder", visionExternalData);
      // The admitted facade owns the raw session. Keep a mutable outer shell for staged
      // lifetime tracking and the worker's generic GPU instrumentation.
      initialVision = { ...createQwen3Vl2bVisionSession(initialVision, visionGeometry) };
      const embedExternalData =
        await options.session_options.openchat_get_staged_external_data("embed_tokens");
      initialEmbed = await createSession("embed_tokens", embedExternalData);
    } catch (error) {
      try {
        await options.session_options.openchat_with_staged_webgpu_release(
          "prompt load failure",
          async () => {
            try { await initialEmbed?.release?.(); } finally { await initialVision?.release?.(); }
          },
        );
      } catch {}
      throw error;
    }

    let embedSession = initialEmbed;
    let embedReleased = false;
    let embedTransitionRelease;
    let embedRunning = false;
    let embedDrained = Promise.resolve();
    let embedReleasePromise;
    let promptEmbeddingCompleted = false;
    let promptDecoderCompleted = false;
    let pendingAutoregressiveInputIds;
    let pinnedOrtTensorConstructor;
    let tiedEmbeddingMarkerLogged = false;
    const embedMetadata = {
      inputNames: [...initialEmbed.inputNames],
      inputMetadata: initialEmbed.inputMetadata.map((entry) => ({
        ...entry,
        shape: [...entry.shape],
      })),
      outputNames: [...initialEmbed.outputNames],
      outputMetadata: initialEmbed.outputMetadata.map((entry) => ({
        ...entry,
        shape: [...entry.shape],
      })),
      config: initialEmbed.config,
    };
    const releaseInitialEmbed = async () => {
      if (embedTransitionRelease === undefined) {
        const session = embedSession;
        embedSession = undefined;
        embedTransitionRelease = Promise.resolve().then(() => session?.release?.());
      }
      await embedTransitionRelease;
    };
    const checkedInputIds = (feeds) => {
      const inputIds = feeds?.input_ids;
      if (
        typeof inputIds !== "object" ||
        inputIds === null ||
        inputIds.type !== "int64" ||
        !Array.isArray(inputIds.dims) ||
        inputIds.dims.length !== 2 ||
        !inputIds.dims.every((dimension) => Number.isSafeInteger(dimension) && dimension > 0) ||
        inputIds.dims[0] !== 1 || inputIds.location !== "cpu" ||
        !(inputIds.data instanceof BigInt64Array) || inputIds.data.length !== inputIds.dims[1]
      ) {
        throw new Error("The staged Qwen embedding facade received invalid int64 input_ids.");
      }
      return inputIds;
    };
    sessions.embed_tokens = {
      ...embedMetadata,
      run: async (...args) => {
        deepStack.check();
        if (embedRunning) throw new Error("The staged Qwen embedding facade is already running.");
        if (embedReleased) throw new Error("The staged Qwen embedding facade was released.");
        embedRunning = true;
        let settleEmbed;
        embedDrained = new Promise((resolve) => { settleEmbed = resolve; });
        let initialEmbeddingOutput;
        try {
        const inputIds = checkedInputIds(args[0]);
        if (!promptEmbeddingCompleted) {
          if (embedSession === undefined) {
            throw new Error("The initial staged Qwen embedding session is unavailable.");
          }
          deepStack.capturePromptIds(inputIds);
          const result = await embedSession.run(...args);
          initialEmbeddingOutput = result?.inputs_embeds;
          if (embedReleased) throw new Error("The staged Qwen embedding facade was released during execution.");
          if (
            result?.inputs_embeds?.location !== "cpu" ||
            result.inputs_embeds.type !== "float32" ||
            !Array.isArray(result.inputs_embeds.dims) ||
            result.inputs_embeds.dims.length !== 3 ||
            result.inputs_embeds.dims[0] !== inputIds.dims[0] ||
            result.inputs_embeds.dims[1] !== inputIds.dims[1] ||
            result.inputs_embeds.dims[2] !== 2048
          ) {
            throw new Error("Qwen staging requires exact CPU-owned prompt token embeddings.");
          }
          if (typeof result.inputs_embeds.constructor !== "function") {
            throw new Error("The pinned Qwen embedding output has no ORT Tensor constructor.");
          }
          // The app contains another onnxruntime-common copy. Capture the constructor that created
          // a real pinned-WebGPU output so replaceTensors/isONNXTensor recognizes synthetic cached
          // embeddings after the standalone embedding session has been permanently released.
          pinnedOrtTensorConstructor = result.inputs_embeds.constructor;
          deepStack.captureEmbedding(result.inputs_embeds);
          promptEmbeddingCompleted = true;
          // This is the only standalone embedding run. The decoder reuses the same tied q4 bytes
          // internally for every cached step, so this WebGPU session must never be recreated.
          await releaseInitialEmbed();
          if (embedReleased) throw new Error("The staged Qwen embedding facade was released during execution.");
          initialEmbeddingOutput = undefined;
          return result;
        }
        if (!promptDecoderCompleted) {
          throw new Error("Qwen refused a second embedding call before its prompt decoder run.");
        }
        if (pendingAutoregressiveInputIds !== undefined) {
          throw new Error("Qwen has unconsumed cached-step input_ids.");
        }
        if (inputIds.dims[1] < 1) {
          throw new Error("Qwen cached-step input_ids cannot be empty.");
        }
        if (typeof pinnedOrtTensorConstructor !== "function") {
          throw new Error("The pinned Qwen ORT Tensor constructor is unavailable.");
        }
        pendingAutoregressiveInputIds = inputIds;
        if (!tiedEmbeddingMarkerLogged) {
          tiedEmbeddingMarkerLogged = true;
          console.info(${JSON.stringify(TRANSFORMERS_WEBGPU_TIED_EMBEDDING_MARKER)});
        }
        return {
          inputs_embeds: new pinnedOrtTensorConstructor(
            "float32",
            new Float32Array(inputIds.dims[0] * inputIds.dims[1] * 2048),
            [inputIds.dims[0], inputIds.dims[1], 2048],
          ),
        };
        } catch (error) {
          try { initialEmbeddingOutput?.dispose?.(); } catch {}
          pendingAutoregressiveInputIds = undefined;
          deepStack.fail();
          throw error;
        } finally {
          embedRunning = false;
          settleEmbed();
        }
      },
      release: () => {
        if (embedReleasePromise !== undefined) return embedReleasePromise;
        embedReleased = true;
        deepStack.fail();
        embedReleasePromise = (async () => {
          await embedDrained;
          pendingAutoregressiveInputIds = undefined;
          await releaseInitialEmbed();
        })();
        return embedReleasePromise;
      },
    };

    let visionCompleted = false;
    let visionRunning = false;
    let visionDrained = Promise.resolve();
    const visionRun = initialVision.run.bind(initialVision);
    const visionRelease = initialVision.release?.bind(initialVision);
    let visionReleasePromise;
    initialVision.release = () => {
      if (visionReleasePromise === undefined) {
        visionReleasePromise = (async () => {
          await visionDrained;
          try { await visionRelease?.(); } finally { deepStack.clearPrompt(); }
        })();
      }
      return visionReleasePromise;
    };
    initialVision.run = async (...args) => {
      deepStack.check();
      if (visionRunning) throw new Error("The Qwen DeepStack vision session is already running.");
      visionRunning = true;
      let settleVision;
      visionDrained = new Promise((resolve) => { settleVision = resolve; });
      try {
        if (visionReleasePromise !== undefined || visionCompleted) {
          throw new Error("The Qwen DeepStack vision session was released or already used.");
        }
        const result = await visionRun(...args);
        if (visionReleasePromise !== undefined) {
          for (const tensor of new Set(Object.values(result))) {
            try { tensor?.dispose?.(); } catch {}
          }
          throw new Error("The Qwen DeepStack vision session was released during execution.");
        }
        const captured = deepStack.captureVision(result);
        visionCompleted = true;
        return captured;
      } catch (error) {
        deepStack.fail();
        throw error;
      } finally {
        visionRunning = false;
        settleVision();
      }
    };
    sessions.vision_encoder = initialVision;

    const decoderInputMetadata = ${JSON.stringify(TRANSFORMERS_QWEN_DECODER_INPUT_METADATA)};
    let decoderSession;
    let decoderPromise;
    let decoderReleased = false;
    let decoderRunning = false;
    let decoderDrained = Promise.resolve();
    let decoderReleasePromise;
    const loadDecoder = async () => {
      if (decoderReleased) throw new Error("The staged Qwen decoder session was released.");
      if (decoderSession !== undefined) return decoderSession;
      if (!visionCompleted) {
        throw new Error(
          "Qwen decoder loading was refused before successful WebGPU vision execution.",
        );
      }
      if (!promptEmbeddingCompleted) {
        throw new Error(
          "Qwen decoder loading was refused before successful WebGPU prompt embedding.",
        );
      }
      if (decoderPromise === undefined) {
        decoderPromise = (async () => {
          // The prompt embedding and image feature outputs are CPU tensors. Releasing both WebGPU
          // sessions makes ORT's active session count reach zero, destroying its storage cache
          // before the 1.1 GB decoder external data is materialized.
          const vision = sessions.vision_encoder;
          if (vision === undefined) {
            throw new Error("The staged Qwen vision session is unavailable.");
          }
          await options.session_options.openchat_with_staged_webgpu_release(
            "prompt-to-decoder transition",
            async () => {
              await vision.release?.();
              delete sessions.vision_encoder;
              await releaseInitialEmbed();
            },
          );
          console.info(${JSON.stringify(TRANSFORMERS_WEBGPU_STAGED_DECODER_MARKER)});
          const decoderExternalData =
            await options.session_options.openchat_get_staged_external_data(
              "decoder_model_merged",
            );
          if (!Array.isArray(decoderExternalData) || decoderExternalData.length < 1 || decoderExternalData.length > 16 ||
              decoderExternalData.some((file) => typeof file.path !== "string" || !(file.data instanceof Blob) || file.data.size < 1) ||
              new Set(decoderExternalData.map((file) => file.path)).size !== decoderExternalData.length) {
            throw new Error("The staged Qwen decoder external-data loader returned no exact shard.");
          }
          const session = await createSession("decoder_model_merged", decoderExternalData);
          try {
          const expectedInputNames = [
            ...decoderInputMetadata.map((entry) => entry.name),
            ${JSON.stringify(TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT)},
            ...deepStack.inputNames,
            ...generationRuntime.inputNames,
          ];
          if (
            JSON.stringify(session.inputNames) !== JSON.stringify(expectedInputNames) ||
            !Array.isArray(session.inputMetadata) ||
            session.inputMetadata.length !== expectedInputNames.length
          ) {
            throw new Error(
              "The transformed Qwen decoder private input contract does not match its facade.",
            );
          }
          const expectedMetadata = [
            ...decoderInputMetadata,
            { name: ${JSON.stringify(TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT)}, type: "int64", shape: ["batch_size", "openchat_token_sequence_length"] },
            ...deepStack.inputNames.map((name) => ({ name, type: "float32", shape: ["batch_size", "sequence_length", 2048] })),
            ...generationRuntime.inputMetadata,
          ];
          if (session.inputMetadata.some((entry, i) => entry?.name !== expectedMetadata[i].name ||
              entry.isTensor !== true || entry.type !== expectedMetadata[i].type ||
              JSON.stringify(entry.shape) !== JSON.stringify(expectedMetadata[i].shape))) {
            throw new Error("The transformed Qwen decoder private input metadata changed.");
          }
          if (decoderReleased) {
            throw new Error("The staged Qwen decoder session was released.");
          }
          decoderSession = session;
          return session;
          } catch (error) {
            try { await session.release?.(); } catch {}
            throw error;
          }
        })();
      }
      return decoderPromise;
    };
    sessions.decoder_model_merged = {
      inputNames: decoderInputMetadata.map((entry) => entry.name),
      inputMetadata: decoderInputMetadata,
      outputNames: [],
      outputMetadata: [],
      config: { device: "webgpu", dtype: "q4" },
      run: async (...args) => {
        deepStack.check();
        if (decoderRunning) throw new Error("The Qwen DeepStack decoder is already running.");
        if (decoderReleased) throw new Error("The staged Qwen decoder session was released.");
        decoderRunning = true;
        let settleDecoder;
        decoderDrained = new Promise((resolve) => { settleDecoder = resolve; });
        let privateFeeds;
        let decoderFeeds;
        let inputIds;
        let cachedStep = false;
        let result;
        let failure = false;
        const discardResult = () => {
          for (const tensor of new Set(Object.values(result ?? {}))) {
            try { tensor?.dispose?.(); } catch {}
          }
          result = undefined;
        };
        try {
        const feeds = args[0];
        const inputsEmbeds = feeds?.inputs_embeds;
        if (
          typeof feeds !== "object" ||
          feeds === null ||
          typeof inputsEmbeds !== "object" ||
          inputsEmbeds === null ||
          inputsEmbeds.type !== "float32" ||
          !Array.isArray(inputsEmbeds.dims) ||
          inputsEmbeds.dims.length !== 3 ||
          !inputsEmbeds.dims.every(
            (dimension) => Number.isSafeInteger(dimension) && dimension >= 0,
          ) ||
          inputsEmbeds.dims[2] !== 2048
        ) {
          throw new Error("The staged Qwen decoder facade received invalid inputs_embeds.");
        }

        cachedStep = promptDecoderCompleted;
        if (!cachedStep) {
          if (!promptEmbeddingCompleted || inputsEmbeds.dims[1] < 1) {
            throw new Error("The staged Qwen decoder received an invalid multimodal prompt.");
          }
          if (pendingAutoregressiveInputIds !== undefined) {
            throw new Error("Qwen cached input_ids appeared before the prompt decoder run.");
          }
          inputIds = new inputsEmbeds.constructor(
            "int64",
            new BigInt64Array(0),
            [inputsEmbeds.dims[0], 0],
          );
        } else {
          inputIds = pendingAutoregressiveInputIds;
          if (
            inputIds === undefined ||
            inputIds.dims[0] !== inputsEmbeds.dims[0] ||
            inputIds.dims[1] !== inputsEmbeds.dims[1] ||
            inputsEmbeds.constructor !== pinnedOrtTensorConstructor
          ) {
            throw new Error("The staged Qwen decoder received mismatched cached-step inputs.");
          }
        }

        privateFeeds = cachedStep ? deepStack.cachedFeeds(inputsEmbeds) : deepStack.promptFeeds(inputsEmbeds);
        decoderFeeds = {
          ...feeds,
          ...privateFeeds,
          // Generic Transformers.js generation must observe a normal [B, T, 2048] tensor through
          // its cached-step bookkeeping. Replace that shape carrier only at the raw ORT boundary;
          // the transformed decoder selects its tied GatherBlockQuantized branch with [B, 0, 2048].
          inputs_embeds: cachedStep
            ? new pinnedOrtTensorConstructor(
                "float32",
                new Float32Array(0),
                [inputsEmbeds.dims[0], 0, 2048],
              )
            : inputsEmbeds,
          [${JSON.stringify(TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT)}]: inputIds,
        };
          const loadedDecoder = await loadDecoder();
          deepStack.check();
          result = await generationRuntime.run(
            decoderFeeds, loadedDecoder.run.bind(loadedDecoder), args.slice(1),
          );
          if (decoderReleased) {
            throw new Error("The Qwen DeepStack decoder was released during execution.");
          }
          if (!cachedStep) promptDecoderCompleted = true;
          return result;
        } catch (error) {
          failure = true;
          discardResult();
          deepStack.fail();
          throw error;
        } finally {
          // Dispose every outer-owned feed before publishing the drain signal. In particular,
          // a throwing dispose must not free the native session early or strand release forever.
          let cleanupError;
          let cleanupFailed = false;
          const owned = [
            ...Object.values(privateFeeds ?? {}),
            ...(!cachedStep && inputIds !== undefined ? [inputIds] : []),
            ...(cachedStep && decoderFeeds !== undefined ? [decoderFeeds.inputs_embeds] : []),
          ];
          for (const tensor of owned) {
            try { tensor.dispose?.(); } catch (error) {
              if (!cleanupFailed) cleanupError = error;
              cleanupFailed = true;
            }
          }
          if (cleanupFailed) {
            deepStack.fail();
            generationRuntime.retire();
            if (!failure) discardResult();
          }
          if (cachedStep) pendingAutoregressiveInputIds = undefined;
          decoderRunning = false;
          settleDecoder();
          if (cleanupFailed && !failure) throw cleanupError;
        }
      },
      release: () => {
        if (decoderReleasePromise !== undefined) return decoderReleasePromise;
        decoderReleased = true;
        deepStack.fail();
        const runtimeDrained = generationRuntime.retire();
        decoderReleasePromise = (async () => {
          await runtimeDrained;
          await decoderDrained;
          pendingAutoregressiveInputIds = undefined;
          const session = decoderSession;
          const pending = decoderPromise;
          decoderSession = undefined;
          decoderPromise = undefined;
          if (session !== undefined) {
            await session.release?.();
          } else if (pending !== undefined) {
            // A load cancelled before admission releases its own raw session exactly once.
            const loaded = await pending.catch(() => undefined);
            await loaded?.release?.();
          }
        })();
        return decoderReleasePromise;
      },
    };
    return sessions;
  }

  if (stagedGemma) {
    const sessions = {};
    const modality = options.session_options.openchat_gemma_required_modality;
    const encoderName = modality === "image" ? "vision_encoder" :
      modality === "audio" ? "audio_encoder" : undefined;
    let encoderSession;
    let encoderCompleted = encoderName === undefined;
    try {
      if (encoderName !== undefined) {
        const encoderExternalData =
          await options.session_options.openchat_get_staged_external_data(encoderName);
        encoderSession = await createSession(encoderName, encoderExternalData);
        const encoderRun = encoderSession.run.bind(encoderSession);
        encoderSession.run = async (...args) => {
          const result = await encoderRun(...args);
          const output = modality === "image" ? result?.image_features : result?.audio_features;
          if (output?.location !== "cpu" || output.type !== "float32") {
            throw new Error(
              "Gemma staging requires CPU-owned " + modality + " encoder features.",
            );
          }
          encoderCompleted = true;
          return result;
        };
        sessions[encoderName] = encoderSession;
      }
      sessions.embed_tokens =
        await options.session_options.openchat_create_gemma_embed_session();
    } catch (error) {
      try { await encoderSession?.release?.(); } catch {}
      throw error;
    }

    const decoderInputMetadata = ${JSON.stringify(TRANSFORMERS_GEMMA_DECODER_INPUT_METADATA)};
    let decoderSession;
    let decoderPromise;
    let decoderReleased = false;
    const createDecoder = async () => {
      const decoderExternalData =
        await options.session_options.openchat_get_staged_external_data("decoder_model_merged");
      const session = await createSession("decoder_model_merged", decoderExternalData);
      const expectedInputNames = decoderInputMetadata.map((entry) => entry.name);
      if (
        JSON.stringify(session.inputNames) !== JSON.stringify(expectedInputNames) ||
        session.inputMetadata.length !== expectedInputNames.length
      ) {
        await session.release?.();
        throw new Error("The pinned Gemma decoder input contract changed.");
      }
      return session;
    };
    const loadDecoder = async () => {
      if (decoderReleased) throw new Error("The staged Gemma decoder was released.");
      if (decoderSession !== undefined) return decoderSession;
      if (!encoderCompleted) {
        throw new Error("Gemma decoder loading was refused before its WebGPU encoder completed.");
      }
      if (decoderPromise === undefined) {
        decoderPromise = (async () => {
          if (encoderName !== undefined) {
            const encoder = sessions[encoderName];
            if (encoder === undefined) {
              throw new Error("The staged Gemma encoder is unavailable.");
            }
            await options.session_options.openchat_with_staged_webgpu_release(
              modality + "-to-decoder transition",
              async () => {
                await encoder.release?.();
                delete sessions[encoderName];
              },
            );
          }
          console.info(${JSON.stringify(TRANSFORMERS_WEBGPU_STAGED_DECODER_MARKER)});
          const session = await createDecoder();
          if (decoderReleased) {
            await session.release?.();
            throw new Error("The staged Gemma decoder was released.");
          }
          decoderSession = session;
          return session;
        })();
      }
      return decoderPromise;
    };

    // Text has no prompt encoder to create ORT's WebGPU device. Load only the decoder up front;
    // the row-streamed embedding facade then uses that same device without a second weight session.
    if (modality === "text") {
      decoderSession = await createDecoder();
    }
    sessions.decoder_model_merged = {
      inputNames: decoderInputMetadata.map((entry) => entry.name),
      inputMetadata: decoderInputMetadata,
      outputNames: [],
      outputMetadata: [],
      config: { device: "webgpu", dtype: "q4f16" },
      run: async (...args) => {
        const feeds = args[0];
        if (
          typeof feeds !== "object" ||
          feeds === null ||
          typeof feeds.inputs_embeds !== "object" ||
          feeds.inputs_embeds === null ||
          typeof feeds.inputs_embeds.constructor !== "function"
        ) {
          throw new Error("The staged Gemma decoder facade received invalid inputs_embeds.");
        }
        // decoder_forward in Transformers.js 4.2 currently authors scalar zero and drops the
        // caller's generation option. Override it at the raw-session boundary so the 262k-vocab
        // decoder materializes only the final-token logits on every prompt/cached step.
        const keep = new feeds.inputs_embeds.constructor(
          "int64",
          new BigInt64Array([1n]),
          [],
        );
        try {
          return await (await loadDecoder()).run(
            { ...feeds, num_logits_to_keep: keep },
            ...args.slice(1),
          );
        } finally {
          keep.dispose?.();
        }
      },
      release: async () => {
        if (decoderReleased) return;
        decoderReleased = true;
        const session = decoderSession;
        const pending = decoderPromise;
        decoderSession = undefined;
        decoderPromise = undefined;
        if (session !== undefined) {
          await session.release?.();
        } else if (pending !== undefined) {
          const loaded = await pending.catch(() => undefined);
          await loaded?.release?.();
        }
      },
    };
    return sessions;
  }

  const entries = [];
  console.info(${JSON.stringify(TRANSFORMERS_WEBGPU_SEQUENTIAL_SESSION_MARKER)});
  try {
    for (const name of Object.keys(names)) {
      const session = await createSession(name);
      entries.push([name, session]);
    }
    return Object.fromEntries(entries);
  } catch (error) {
    for (const [, session] of entries) {
      try { await session.release?.(); } catch {}
    }
    throw error;
  }
}`;
}

const SEQUENTIAL_CONSTRUCT_SESSIONS = stagedConstructSessionsSource(true);

const UPSTREAM_DIST_CONSTRUCT_SESSIONS = `async function constructSessions(pretrained_model_name_or_path, names, options, cache_sessions = void 0) {
  return Object.fromEntries(
    await Promise.all(
      Object.keys(names).map(async (name) => {
        const cache_config = cache_sessions?.[name] ?? false;
        const { buffer_or_path, session_options, session_config } = await getSession(
          pretrained_model_name_or_path,
          names[name],
          options,
          cache_config,
          name
        );
        const session = await createInferenceSession(buffer_or_path, session_options, session_config);
        return [name, session];
      })
    )
  );
}`;

const SEQUENTIAL_DIST_CONSTRUCT_SESSIONS = stagedConstructSessionsSource(false);

function transformersSessionModuleKind(id) {
    const normalized = id.split("?", 1)[0].replaceAll("\\", "/");
    if (normalized.endsWith(SOURCE_SESSION_MODULE_SUFFIX)) return "source";
    if (normalized.endsWith(DIST_SESSION_MODULE_SUFFIX)) return "dist";
    return null;
}

/**
 * Transformers.js 4.2 serializes InferenceSession.create, but starts getSession for every graph
 * concurrently. For Qwen3-VL that transiently materializes the 1.1 GB decoder data alongside the
 * embedding and vision data. Patch only the pinned upstream helper: generic models load one graph
 * at a time, while the exact pinned Qwen path stages prompt sessions, clears them at an ORT
 * zero-session boundary, and only then materializes the decoder.
 */
export function patchTransformersWebGpuSessionSource(source, id) {
    const kind = transformersSessionModuleKind(id);
    if (kind === null) return null;
    const upstream =
        kind === "source" ? UPSTREAM_CONSTRUCT_SESSIONS : UPSTREAM_DIST_CONSTRUCT_SESSIONS;
    const replacement =
        kind === "source" ? SEQUENTIAL_CONSTRUCT_SESSIONS : SEQUENTIAL_DIST_CONSTRUCT_SESSIONS;
    const first = source.indexOf(upstream);
    const last = source.lastIndexOf(upstream);
    if (first < 0 || first !== last) {
        throw new Error(
            "Pinned Transformers.js constructSessions source changed; refusing to build the all-WebGPU worker without its staged-session guard.",
        );
    }
    return source.replace(upstream, replacement);
}

export function transformersWebGpuSequentialSessionsPlugin() {
    let applied = false;
    return {
        name: "openchat-transformers-webgpu-sequential-sessions",
        enforce: "pre",
        transform(source, id) {
            const code = patchTransformersWebGpuSessionSource(source, id);
            if (code === null) return null;
            applied = true;
            return { code, map: null };
        },
        buildEnd(error) {
            if (error === undefined && !applied) {
                throw new Error(
                    "The all-WebGPU worker did not include the Transformers.js staged-session patch.",
                );
            }
        },
    };
}
