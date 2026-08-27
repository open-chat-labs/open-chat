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
  const createSession = async (name, stagedExternalData = undefined) => {
    const cache_config = cache_sessions?.[name] ?? false;
    const configuredSessionOptions = options.session_options ?? {};
    const {
      openchat_get_staged_external_data: _stagedExternalDataLoader,
      openchat_wait_for_staged_webgpu_queue: _waitForStagedWebGpuQueue,
      ...cleanSessionOptions
    } = configuredSessionOptions;
    const cleanOptions =
      _stagedExternalDataLoader === undefined && _waitForStagedWebGpuQueue === undefined
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
    let loaded = await getSession(
      pretrained_model_name_or_path,
      names[name],
      sessionLoadOptions,
      cache_config,
      name,
    );
    let session;
    try {
      if (stagedExternalData !== undefined) {
        const externalData = loaded.session_options.externalData;
        if (!Array.isArray(externalData) || externalData.length !== stagedExternalData.length) {
          throw new Error("The staged Qwen external data was not preserved by Transformers.js.");
        }
        for (const file of externalData) {
          if (
            typeof file !== "object" ||
            file === null ||
            !(file.data instanceof Blob) ||
            file.data.size < 1
          ) {
            throw new Error("The staged Qwen external data is not a non-empty Blob.");
          }
        }
      }
      session = await createInferenceSession(
        loaded.buffer_or_path,
        loaded.session_options,
        loaded.session_config,
      );
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
    if (stagedQwen) {
      try {
        await _waitForStagedWebGpuQueue(name);
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
    typeof options.session_options?.openchat_wait_for_staged_webgpu_queue === "function";

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
      try { await initialEmbed?.release?.(); } catch {}
      try { await initialVision?.release?.(); } catch {}
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
          await vision.release?.();
          delete sessions.vision_encoder;
          await releaseInitialEmbed();
          console.info(${JSON.stringify(TRANSFORMERS_WEBGPU_STAGED_DECODER_MARKER)});
          // Give V8 an event-loop boundary after the large buffers become unreachable.
          await new Promise((resolve) => setTimeout(resolve, 0));
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
