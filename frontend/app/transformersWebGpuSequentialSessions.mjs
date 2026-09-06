const SOURCE_SESSION_MODULE_SUFFIX = "/@huggingface/transformers/src/models/session.js";
const DIST_SESSION_MODULE_SUFFIX = "/@huggingface/transformers/dist/transformers.web.js";

export const TRANSFORMERS_WEBGPU_SEQUENTIAL_SESSION_MARKER =
    "[qwen-webgpu] loading model sessions sequentially";

export const TRANSFORMERS_WEBGPU_STAGED_DECODER_MARKER =
    "[qwen-webgpu] loading decoder after releasing prompt sessions";

export const TRANSFORMERS_WEBGPU_TIED_EMBEDDING_MARKER =
    "[qwen-webgpu] reusing decoder tied embeddings for cached tokens";

export const TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT = "__openchat_input_ids";

const STAGED_QWEN_MODEL_ID = "onnx-community/Qwen3-VL-2B-Instruct-ONNX";
const STAGED_QWEN_REVISION = "3e4136ea66ae6e07c110e64fe07da2e029517ab5";
const STAGED_GEMMA_MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";
const STAGED_GEMMA_REVISION = "9f4bef82ea6e296bc69f8a2f5939f73af81b07a6";

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
 * matching tests parse both the audited source graph and transformed graph. The transform's one
 * private token-ID input is deliberately hidden from generic Transformers.js validation and is
 * injected only by the exact Qwen facade below.
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
      openchat_get_staged_external_data: _stagedExternalDataLoader,
      openchat_wait_for_staged_webgpu_queue: _waitForStagedWebGpuQueue,
      openchat_with_staged_webgpu_release: _withStagedWebGpuRelease,
      openchat_create_gemma_embed_session: _createGemmaEmbedSession,
      openchat_gemma_required_modality: _gemmaRequiredModality,
      openchat_report_staged_session: _reportStagedSession,
      ...cleanSessionOptions
    } = configuredSessionOptions;
    const cleanOptions =
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
      try {
        await _waitForStagedWebGpuQueue(name);
        _reportStagedSession?.(name, "queue-drained");
      } catch (error) {
        try { await session.release?.(); } catch {}
        throw error;
      }
    }
    return session;
  };
  const selected = (mapping, name) =>
    typeof mapping === "object" && mapping !== null ? mapping[name] : mapping;
  const nameKeys = Object.keys(names);
  const stagedQwen =
    pretrained_model_name_or_path === ${JSON.stringify(STAGED_QWEN_MODEL_ID)} &&
    options.revision === ${JSON.stringify(STAGED_QWEN_REVISION)} &&
    nameKeys.length === 3 &&
    names.embed_tokens === "embed_tokens" &&
    names.vision_encoder === "vision_encoder" &&
    names.decoder_model_merged === "decoder_model_merged" &&
    nameKeys.every((name) => selected(options.device, name) === "webgpu") &&
    nameKeys.every((name) => selected(options.dtype, name) === "q4") &&
    typeof options.session_options?.openchat_get_staged_external_data === "function" &&
    typeof options.session_options?.openchat_wait_for_staged_webgpu_queue === "function" &&
    typeof options.session_options?.openchat_with_staged_webgpu_release === "function";

  const stagedGemma =
    pretrained_model_name_or_path === ${JSON.stringify(STAGED_GEMMA_MODEL_ID)} &&
    options.revision === ${JSON.stringify(STAGED_GEMMA_REVISION)} &&
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

  if (stagedQwen) {
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
        embedTransitionRelease = Promise.resolve(session?.release?.());
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
        !inputIds.dims.every((dimension) => Number.isSafeInteger(dimension) && dimension >= 0)
      ) {
        throw new Error("The staged Qwen embedding facade received invalid int64 input_ids.");
      }
      return inputIds;
    };
    sessions.embed_tokens = {
      ...embedMetadata,
      run: async (...args) => {
        if (embedReleased) throw new Error("The staged Qwen embedding facade was released.");
        const inputIds = checkedInputIds(args[0]);
        if (!promptEmbeddingCompleted) {
          if (embedSession === undefined) {
            throw new Error("The initial staged Qwen embedding session is unavailable.");
          }
          const result = await embedSession.run(...args);
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
          promptEmbeddingCompleted = true;
          // This is the only standalone embedding run. The decoder reuses the same tied q4 bytes
          // internally for every cached step, so this WebGPU session must never be recreated.
          await releaseInitialEmbed();
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
      },
      release: async () => {
        if (embedReleased) return;
        embedReleased = true;
        pendingAutoregressiveInputIds = undefined;
        await releaseInitialEmbed();
      },
    };

    let visionCompleted = false;
    const visionRun = initialVision.run.bind(initialVision);
    const visionRelease = initialVision.release?.bind(initialVision);
    let visionReleasePromise;
    initialVision.release = async () => {
      visionReleasePromise ??= Promise.resolve(visionRelease?.());
      await visionReleasePromise;
    };
    initialVision.run = async (...args) => {
      const result = await visionRun(...args);
      if (result?.image_features?.location !== "cpu") {
        throw new Error("Qwen staging requires CPU-owned image features.");
      }
      visionCompleted = true;
      return result;
    };
    sessions.vision_encoder = initialVision;

    const decoderInputMetadata = ${JSON.stringify(TRANSFORMERS_QWEN_DECODER_INPUT_METADATA)};
    let decoderSession;
    let decoderPromise;
    let decoderReleased = false;
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
          if (!Array.isArray(decoderExternalData) || decoderExternalData.length !== 1) {
            throw new Error("The staged Qwen decoder external-data loader returned no exact shard.");
          }
          const session = await createSession("decoder_model_merged", decoderExternalData);
          const expectedInputNames = [
            ...decoderInputMetadata.map((entry) => entry.name),
            ${JSON.stringify(TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT)},
          ];
          if (
            JSON.stringify(session.inputNames) !== JSON.stringify(expectedInputNames) ||
            session.inputMetadata.length !== expectedInputNames.length
          ) {
            await session.release?.();
            throw new Error(
              "The transformed Qwen decoder private input contract does not match its facade.",
            );
          }
          const privateMetadata = session.inputMetadata[session.inputMetadata.length - 1];
          if (
            privateMetadata.type !== "int64" ||
            !Array.isArray(privateMetadata.shape) ||
            privateMetadata.shape.length !== 2 ||
            privateMetadata.shape[0] !== "batch_size" ||
            privateMetadata.shape[1] !== "openchat_token_sequence_length"
          ) {
            await session.release?.();
            throw new Error("The transformed Qwen decoder private input metadata changed.");
          }
          if (decoderReleased) {
            await session.release?.();
            throw new Error("The staged Qwen decoder session was released.");
          }
          decoderSession = session;
          return session;
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

        let inputIds;
        const cachedStep = promptDecoderCompleted;
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

        const decoderFeeds = {
          ...feeds,
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
        try {
          const result = await (await loadDecoder()).run(decoderFeeds, ...args.slice(1));
          if (!cachedStep) promptDecoderCompleted = true;
          return result;
        } finally {
          if (cachedStep) pendingAutoregressiveInputIds = undefined;
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
