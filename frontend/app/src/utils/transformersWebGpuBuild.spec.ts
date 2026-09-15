import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
    patchQwen3Vl2bDecoderGraph,
    QWEN3_VL_2B_DECODER_PATCHED_BYTES,
    QWEN3_VL_2B_DECODER_PATCHED_SHA256,
    QWEN3_VL_2B_DECODER_SOURCE_BYTES,
    QWEN3_VL_2B_DECODER_SOURCE_SHA256,
    QWEN3_VL_2B_DECODER_TOKEN_IDS_INPUT as GRAPH_TOKEN_IDS_INPUT,
    QWEN3_VL_2B_TIED_EMBEDDING_EXTERNAL_DATA,
} from "../../transformersWebGpuDecoderGraph.mjs";
import { patchQwen3Vl2bDeepStackDecoderGraph } from "../../transformersWebGpuDeepStackGraph.mjs";
import {
    patchQwen3Vl2bGenerationGraph,
    QWEN3_VL_2B_GENERATION_BYTES,
    QWEN3_VL_2B_GENERATION_SHA256,
} from "../../transformersWebGpuQwenGenerationGraph.mjs";
import { createQwen3Vl2bGenerationRuntime } from "../../transformersWebGpuQwenGenerationRuntime.mjs";
import { createQwen3Vl2bVisionGeometryRuntime } from "../../transformersWebGpuQwenVisionGeometry.mjs";
import {
    patchTransformersWebGpuSessionSource,
    TRANSFORMERS_QWEN_DECODER_INPUT_METADATA,
    TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT,
    TRANSFORMERS_WEBGPU_SEQUENTIAL_SESSION_MARKER,
    TRANSFORMERS_WEBGPU_STAGED_DECODER_MARKER,
    TRANSFORMERS_WEBGPU_TIED_EMBEDDING_MARKER,
} from "../../transformersWebGpuSequentialSessions.mjs";
import { TRANSFORMERS_QWEN_ARTIFACTS } from "./transformersWebGpuProtocol";

const APP_DIR = path.resolve(import.meta.dirname, "../..");
const FRONTEND_DIR = path.resolve(APP_DIR, "..");
const nodeRequire = createRequire(import.meta.url);

describe("Transformers.js WebGPU build isolation", () => {
    it("pins the stable runtime and emits a separate model worker", () => {
        const packageJson = JSON.parse(
            fs.readFileSync(path.join(FRONTEND_DIR, "package.json"), "utf8"),
        ) as {
            dependencies: Record<string, string>;
            overrides: Record<string, string>;
        };
        const packageLock = JSON.parse(
            fs.readFileSync(path.join(FRONTEND_DIR, "package-lock.json"), "utf8"),
        ) as {
            packages: Record<string, { version?: string; resolved?: string; integrity?: string }>;
        };
        const onnxRuntimePackage = JSON.parse(
            fs.readFileSync(
                path.join(FRONTEND_DIR, "node_modules/onnxruntime-web/package.json"),
                "utf8",
            ),
        ) as {
            version: string;
            exports: Record<string, { import?: Record<string, string> }>;
        };
        const onnxRuntimeWasmCore = fs.readFileSync(
            path.join(FRONTEND_DIR, "node_modules/onnxruntime-web/lib/wasm/wasm-core-impl.ts"),
            "utf8",
        );
        const transformersOnnxBackend = fs.readFileSync(
            path.join(FRONTEND_DIR, "node_modules/@huggingface/transformers/src/backends/onnx.js"),
            "utf8",
        );
        const workers = fs.readFileSync(path.join(APP_DIR, "build-workers.mjs"), "utf8");
        const appBuild = fs.readFileSync(path.join(APP_DIR, "rollup.config.mjs"), "utf8");
        const modelWorker = fs.readFileSync(
            path.join(APP_DIR, "src/workers/transformersWebGpuInference.worker.ts"),
            "utf8",
        );
        const protocol = fs.readFileSync(
            path.join(APP_DIR, "src/utils/transformersWebGpuProtocol.ts"),
            "utf8",
        );
        const runtimeAssets = fs.readFileSync(
            path.join(APP_DIR, "src/utils/transformersWebGpuRuntimeAssets.ts"),
            "utf8",
        );
        const assetPolicy = fs.readFileSync(path.join(APP_DIR, ".ic-assets.json5"), "utf8");
        const sessionPatch = fs.readFileSync(
            path.join(APP_DIR, "transformersWebGpuSequentialSessions.mjs"),
            "utf8",
        );

        expect(packageJson.dependencies["@huggingface/transformers"]).toBe("4.2.0");
        expect(packageJson.dependencies["onnxruntime-web"]).toBe("1.29.0-dev.20260723-1b1e1db7bc");
        expect(packageJson.overrides["onnxruntime-web"]).toBe("$onnxruntime-web");
        expect(packageLock.packages["node_modules/onnxruntime-web"]).toMatchObject({
            version: "1.29.0-dev.20260723-1b1e1db7bc",
            resolved:
                "https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.29.0-dev.20260723-1b1e1db7bc.tgz",
            integrity:
                "sha512-I5v9h+LYg98gEzwIa2B09M9SNihMpUfPHLs6fCrZcQVi1D9WQ7e3AdBlO6+mYMXkmHeAjJenDcXm3x4A+tj/Pw==",
        });
        expect(packageLock.packages["node_modules/onnxruntime-common"].version).toBe("1.24.3");
        expect(
            packageLock.packages["node_modules/onnxruntime-web/node_modules/onnxruntime-common"]
                .version,
        ).toBe("1.29.0-dev.20260723-1b1e1db7bc");
        expect(transformersOnnxBackend).toContain("return x instanceof ONNX.Tensor");
        expect(onnxRuntimePackage.version).toBe("1.29.0-dev.20260723-1b1e1db7bc");
        expect(
            onnxRuntimePackage.exports["./jspi"].import?.["onnxruntime-web-use-extern-wasm"],
        ).toBe("./dist/ort.jspi.min.mjs");
        expect(onnxRuntimeWasmCore).toContain(
            "if (BUILD_DEFS.ENABLE_JSPI && data instanceof Blob)",
        );
        expect(onnxRuntimeWasmCore).toContain("wasm.mountExternalData(path, data)");
        for (const asset of [
            "ort-wasm-simd-threaded.jspi.mjs",
            "ort-wasm-simd-threaded.jspi.wasm",
        ]) {
            expect(
                fs.statSync(path.join(FRONTEND_DIR, "node_modules/onnxruntime-web/dist", asset))
                    .size,
            ).toBeGreaterThan(0);
        }
        expect(workers).toContain("transformersWebGpuInference.worker.ts");
        expect(appBuild).toContain('"./localReplicaImageProxy.ts"');
        expect(workers).toContain('fileName: "transformers_webgpu_worker.js"');
        expect(workers).toContain('conditions: ["onnxruntime-web-use-extern-wasm"]');
        expect(workers).toContain('find: "onnxruntime-web/webgpu"');
        expect(workers).toContain('replacement: "onnxruntime-web/jspi"');
        expect(workers).toContain("transformersWebGpuSpikeEnabled");
        expect(modelWorker).toContain("device: TRANSFORMERS_QWEN_DEVICE_MAP");
        expect(modelWorker).not.toContain('device: "webgpu"');
        expect(modelWorker).not.toContain('powerPreference = "high-performance"');
        expect(modelWorker).toContain("const adapter = await gpu.requestAdapter()");
        expect(modelWorker).toContain("env.allowRemoteModels = true");
        expect(modelWorker).toContain("env.fetch = async () =>");
        expect(modelWorker).toContain("ort-wasm-simd-threaded.jspi.mjs");
        expect(modelWorker).toContain("ort-wasm-simd-threaded.jspi.wasm");
        expect(modelWorker).not.toContain("ort-wasm-simd-threaded.asyncify");
        expect(runtimeAssets).toContain("ort-1.29.0-dev.20260723-1b1e1db7bc");
        expect(protocol).toContain('from "./transformersWebGpuRuntimeAssets"');
        expect(appBuild).toContain('"./src/utils/transformersWebGpuRuntimeAssets.ts"');
        expect(assetPolicy).toContain("{*.css,*.js,*.mjs,*.wasm,*.traineddata.gz}");
        expect(modelWorker).toContain("tap Retry download");
        expect(modelWorker).not.toContain("env.allowRemoteModels = false");
        expect(modelWorker).toContain(
            "transformersWebGpuImageLayout(dimensions.width, dimensions.height)",
        );
        expect(modelWorker).toContain("TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES");
        expect(modelWorker).toContain("image_grid_thw");
        expect(modelWorker).toContain('imageOrientation: "from-image"');
        expect(modelWorker).toContain('getJson("processor_config.json")');
        expect(modelWorker).toContain("transformersWebGpuProcessorConfig(");
        expect(modelWorker).toContain("TRANSFORMERS_WEBGPU_NORMALIZED_PROCESSOR_MARKER");
        expect(modelWorker).toContain("new Qwen2VLImageProcessor(unifiedImageProcessorConfig)");
        expect(modelWorker).toContain("decodeBoundedImage(message.image)");
        expect(modelWorker).toContain("bitmap.close()");
        expect(modelWorker).toContain("await disposeLoadedRuntime()");
        expect(modelWorker).toContain("releaseAndRetireWebGpuDevice(");
        expect(modelWorker).toContain('withStagedWebGpuRelease("decoder teardown"');
        expect(modelWorker).toContain("openchat_with_staged_webgpu_release");
        expect(modelWorker).toContain("runtimeDisposalPromise");
        expect(modelWorker).toContain("const lossStage = activeGpuStage");
        expect(modelWorker).not.toContain("explicit model release failed");
        expect(modelWorker).not.toContain("RawImage.read(");
        expect(modelWorker).toContain("instrumentGpuSessions(runtime, generation)");
        expect(modelWorker).toContain("embed_tokens cached CPU facade started");
        expect(modelWorker).toContain('name === "decoder_model_merged"');
        const instrumentation = modelWorker.slice(
            modelWorker.indexOf("function instrumentGpuSessions"),
            modelWorker.indexOf("async function loadRuntime"),
        );
        expect(instrumentation.indexOf("const result = await run(...args)")).toBeLessThan(
            instrumentation.indexOf("watchDeviceLoss(runtime, generation)"),
        );
        const runtimeCompletion = modelWorker.slice(
            modelWorker.indexOf("const runtime: LoadedRuntime"),
            modelWorker.indexOf(
                "return runtime;",
                modelWorker.indexOf("const runtime: LoadedRuntime"),
            ),
        );
        expect(runtimeCompletion).not.toContain("watchDeviceLoss(runtime, generation)");
        expect(modelWorker).toContain("caches.open(spec.cacheKey)");
        expect(modelWorker).toContain("spec.externalData[sessionName]");
        expect(modelWorker).toContain("revision: spec.revision");
        expect(modelWorker).toContain("dtype: spec.sessionDtypes");
        expect(modelWorker).toContain("validateWebGpuModelSpec(message.modelSpec)");
        expect(modelWorker).toContain(
            "webGpuGenerationOptions(message.modelSpec, message.maxTokens)",
        );
        expect(workers).toContain("transformersWebGpuSequentialSessionsPlugin()");
        expect(sessionPatch).toContain("for (const name of Object.keys(names))");
    });

    it("patches the actual pinned browser bundle to construct model sessions sequentially", () => {
        const distPath = path.join(
            FRONTEND_DIR,
            "node_modules/@huggingface/transformers/dist/transformers.web.js",
        );
        const upstream = fs.readFileSync(distPath, "utf8");
        const patched = patchTransformersWebGpuSessionSource(upstream, distPath);

        expect(patched).not.toBeNull();
        if (patched === null) throw new Error("sequential session patch was not applied");
        const marker = patched.indexOf(TRANSFORMERS_WEBGPU_SEQUENTIAL_SESSION_MARKER);
        const constructStart = patched.lastIndexOf("async function constructSessions", marker);
        const nextFunction = patched.indexOf("function replaceTensors", marker);
        const constructSessions = patched.slice(constructStart, nextFunction);
        expect(marker).toBeGreaterThanOrEqual(0);
        expect(constructStart).toBeGreaterThanOrEqual(0);
        expect(nextFunction).toBeGreaterThan(marker);
        expect(constructSessions).toContain("for (const name of Object.keys(names))");
        expect(constructSessions).not.toContain("Object.keys(names).map(async (name)");
        expect(constructSessions).toContain("await session.release?.()");
        expect(patched).toContain(TRANSFORMERS_WEBGPU_STAGED_DECODER_MARKER);
        expect(patched).toContain(TRANSFORMERS_WEBGPU_TIED_EMBEDDING_MARKER);
        expect(patched).toContain(
            'initialVision = await createSession("vision_encoder", visionExternalData)',
        );
        expect(patched).toContain(
            'initialEmbed = await createSession("embed_tokens", embedExternalData)',
        );
        expect(constructSessions).toContain("await _waitForStagedWebGpuQueue(name)");
        expect(constructSessions).toContain("_withStagedWebGpuRelease");
        expect(constructSessions).toContain(
            'openchat_with_staged_webgpu_release(\n            "prompt-to-decoder transition"',
        );
        expect(constructSessions).toContain("try { await session.release?.(); } catch {}");
        expect(patched).toContain("await vision.release?.()");
        expect(patched).toContain("await releaseInitialEmbed()");
        expect(patched).toContain('createSession("decoder_model_merged", decoderExternalData)');
        expect(constructSessions.match(/createSession\("embed_tokens"/g)).toHaveLength(1);
        expect(constructSessions).toContain(TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT);
        expect(constructSessions).toContain(
            "pinnedOrtTensorConstructor = result.inputs_embeds.constructor",
        );
        expect(constructSessions).toContain("new pinnedOrtTensorConstructor(");
        expect(constructSessions).not.toContain("new inputIds.constructor(");
        expect(constructSessions).toContain("use_external_data_format: false");
        expect(constructSessions).toContain("file.data instanceof Blob");
        expect(constructSessions).not.toContain("URL.createObjectURL");
        expect(constructSessions).not.toContain("URL.revokeObjectURL");
        expect(constructSessions).not.toContain("blob.arrayBuffer()");
        expect(patched).toContain("loaded.session_options.externalData = void 0");
        expect(patched).toContain("loaded = void 0");
    });

    it("releases every prompt WebGPU session before materializing the deferred decoder", async () => {
        const distPath = path.join(
            FRONTEND_DIR,
            "node_modules/@huggingface/transformers/dist/transformers.web.js",
        );
        const upstream = fs.readFileSync(distPath, "utf8");
        const patched = patchTransformersWebGpuSessionSource(upstream, distPath);
        if (patched === null) throw new Error("staged session patch was not applied");
        const start = patched.indexOf("async function constructSessions");
        const end = patched.indexOf("\nfunction replaceTensors", start);
        const constructSource = patched.slice(start, end);

        type FakeSession = {
            inputNames: string[];
            inputMetadata: Array<{
                name: string;
                isTensor: boolean;
                type: string;
                shape: Array<string | number>;
            }>;
            outputNames: string[];
            outputMetadata: Array<{
                name: string;
                isTensor: boolean;
                type: string;
                shape: Array<string | number>;
            }>;
            config: { device: string; dtype: string };
            run: (...args: unknown[]) => Promise<Record<string, unknown>>;
            release: () => Promise<void>;
        };
        type ConstructSessions = (
            model: string,
            names: Record<string, string>,
            options: Record<string, unknown>,
            cacheSessions: Record<string, boolean>,
        ) => Promise<Record<string, FakeSession>>;

        const events: string[] = [];
        const geometry = createQwen3Vl2bVisionGeometryRuntime();
        const generation = createQwen3Vl2bGenerationRuntime();
        const visionOutputs = [
            "image_features",
            ...[0, 1, 2].map((index) => `__openchat_deepstack_features_${index}`),
        ];
        const cacheNames = Array.from({ length: 28 }, (_, layer) =>
            ["key", "value"].map((kind) => `past_key_values.${layer}.${kind}`),
        ).flat();
        const presentNames = cacheNames.map((name) => name.replace("past_key_values.", "present."));
        const patches = 256;
        const features = patches / 4;
        const promptLength = features + 3;
        let activeSessions = 0;
        class FakeBlob {
            constructor(readonly size: number) {}
        }
        class FakeOrtTensor {
            readonly location = "cpu";
            dispose = vi.fn();
            constructor(
                readonly type: string,
                readonly data: Float32Array | BigInt64Array,
                readonly dims: number[],
            ) {}
        }
        // Mirrors the real dependency split: token IDs arrive from the app's root common package,
        // while actual session outputs use the pinned onnxruntime-web/common constructor.
        class FakeInputOrtTensor extends FakeOrtTensor {}
        class FakePinnedOrtTensor extends FakeOrtTensor {}
        type FakeExternalData = {
            path: string;
            data?: Uint8Array | FakeBlob | string;
        };
        const getSession = async (
            _model: string,
            fileName: string,
            loadOptions: {
                use_external_data_format?: boolean;
                session_options?: {
                    externalData?: FakeExternalData[];
                    openchat_get_staged_external_data?: unknown;
                    openchat_wait_for_staged_webgpu_queue?: unknown;
                    openchat_with_staged_webgpu_release?: unknown;
                };
            },
        ): Promise<{
            buffer_or_path: Uint8Array;
            session_options: {
                externalData?: FakeExternalData[];
            };
            session_config: { name: string; device: string; dtype: string };
        }> => {
            events.push(`get:${fileName}:active=${activeSessions}`);
            expect(loadOptions.session_options?.openchat_get_staged_external_data).toBeUndefined();
            expect(
                loadOptions.session_options?.openchat_wait_for_staged_webgpu_queue,
            ).toBeUndefined();
            expect(
                loadOptions.session_options?.openchat_with_staged_webgpu_release,
            ).toBeUndefined();
            const supplied = loadOptions.session_options?.externalData;
            if (supplied !== undefined) {
                expect(loadOptions.use_external_data_format).toBe(false);
            }
            return {
                buffer_or_path: new Uint8Array(1),
                session_options: {
                    externalData: supplied?.map((entry) => ({ ...entry })) ?? [
                        { path: `${fileName}.data`, data: new Uint8Array(1) },
                    ],
                },
                session_config: { name: fileName, device: "webgpu", dtype: "q4" },
            };
        };
        const createInferenceSession = async (
            _buffer: Uint8Array,
            sessionOptions: {
                externalData?: FakeExternalData[];
                openchat_get_staged_external_data?: unknown;
                openchat_wait_for_staged_webgpu_queue?: unknown;
                openchat_with_staged_webgpu_release?: unknown;
            },
            config: { name: string; device: string; dtype: string },
        ): Promise<FakeSession> => {
            expect(sessionOptions.openchat_get_staged_external_data).toBeUndefined();
            expect(sessionOptions.openchat_wait_for_staged_webgpu_queue).toBeUndefined();
            expect(sessionOptions.openchat_with_staged_webgpu_release).toBeUndefined();
            expect(sessionOptions).toMatchObject({
                executionProviders: [{ name: "webgpu", preferredLayout: "NCHW" }],
                graphOptimizationLevel: "disabled",
                extra: {
                    session: { disable_cpu_ep_fallback: "1" },
                    "ep.webgpuexecutionprovider.enableInt64": "1",
                },
            });
            const externalNames: Record<string, string> = {
                vision_encoder: "vision_encoder_q4.onnx_data",
                embed_tokens: "embed_tokens_q4.onnx_data",
                decoder_model_merged: "decoder_model_merged_q4.onnx_data",
            };
            expect(sessionOptions.externalData).toEqual([
                {
                    path: externalNames[config.name],
                    data: expect.any(FakeBlob),
                },
                ...(config.name === "vision_encoder"
                    ? [
                          {
                              path: "vision_encoder_q4_deepstack.onnx_data",
                              data: expect.any(FakeBlob),
                          },
                      ]
                    : []),
            ]);
            activeSessions += 1;
            events.push(`create:${config.name}:active=${activeSessions}`);
            let released = false;
            const metadata =
                config.name === "decoder_model_merged"
                    ? [
                          ...TRANSFORMERS_QWEN_DECODER_INPUT_METADATA.map((entry) => ({
                              ...entry,
                              shape: [...entry.shape],
                          })),
                          {
                              name: TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT,
                              isTensor: true,
                              type: "int64",
                              shape: ["batch_size", "openchat_token_sequence_length"],
                          },
                          ...[0, 1, 2].map((index) => ({
                              name: `__openchat_deepstack_${index}`,
                              isTensor: true,
                              type: "float32",
                              shape: ["batch_size", "sequence_length", 2048],
                          })),
                          ...generation.inputMetadata.map((entry) => ({
                              ...entry,
                              isTensor: true,
                              shape: [...entry.shape],
                          })),
                      ]
                    : config.name === "vision_encoder"
                      ? [
                            {
                                name: "pixel_values",
                                isTensor: true,
                                type: "float32",
                                shape: ["num_patches", 1536],
                            },
                            {
                                name: "image_grid_thw",
                                isTensor: true,
                                type: "int64",
                                shape: ["num_images", 3],
                            },
                            ...geometry.inputMetadata.map((entry) => ({
                                ...entry,
                                isTensor: true,
                                shape: [...entry.shape],
                            })),
                        ]
                      : [
                            {
                                name: "input_ids",
                                isTensor: true,
                                type: "int64",
                                shape: ["batch_size", "sequence_length"],
                            },
                        ];
            const outputMetadata =
                config.name === "vision_encoder"
                    ? visionOutputs.map((name) => ({
                          name,
                          isTensor: true,
                          type: "float32",
                          shape: ["num_features", 2048],
                      }))
                    : config.name === "decoder_model_merged"
                      ? [
                            {
                                name: "logits",
                                isTensor: true,
                                type: "float32",
                                shape: ["batch_size", 1, 151936],
                            },
                            ...presentNames.map((name) => ({
                                name,
                                isTensor: true,
                                type: "float32",
                                shape: ["batch_size", 8, "total_sequence_length", 128],
                            })),
                        ]
                      : [
                            {
                                name: "inputs_embeds",
                                isTensor: true,
                                type: "float32",
                                shape: ["batch_size", "sequence_length", 2048],
                            },
                        ];
            return {
                inputNames: metadata.map(({ name }) => name),
                inputMetadata: metadata,
                outputNames: outputMetadata.map(({ name }) => name),
                outputMetadata,
                config,
                run: async (...args) => {
                    events.push(`run:${config.name}:active=${activeSessions}`);
                    const feeds = args[0] as Record<string, FakeOrtTensor>;
                    if (config.name === "embed_tokens") {
                        const ids = feeds.input_ids;
                        return {
                            inputs_embeds: new FakePinnedOrtTensor(
                                "float32",
                                new Float32Array(ids.dims[0] * ids.dims[1] * 2048),
                                [ids.dims[0], ids.dims[1], 2048],
                            ),
                        };
                    }
                    if (config.name === "vision_encoder") {
                        expect(Object.keys(feeds)).toEqual(metadata.map(({ name }) => name));
                        expect(Object.keys(feeds)).toHaveLength(15);
                        return {
                            image_features: new FakePinnedOrtTensor(
                                "float32",
                                new Float32Array(features * 2048),
                                [features, 2048],
                            ),
                            ...Object.fromEntries(
                                [0, 1, 2].map((index) => [
                                    `__openchat_deepstack_features_${index}`,
                                    new FakePinnedOrtTensor(
                                        "float32",
                                        new Float32Array(features * 2048).fill(index + 1),
                                        [features, 2048],
                                    ),
                                ]),
                            ),
                        };
                    }
                    expect(Object.keys(feeds).sort()).toEqual(
                        metadata.map(({ name }) => name).sort(),
                    );
                    expect(Object.keys(feeds)).toHaveLength(71);
                    const privateIds = feeds[TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT];
                    expect(feeds.inputs_embeds).toBeInstanceOf(FakePinnedOrtTensor);
                    events.push(`decoder-embeds:${feeds.inputs_embeds.dims.join("x")}`);
                    events.push(`decoder-ids:${privateIds.dims.join("x")}`);
                    const sequence = feeds.inputs_embeds.dims[1] + privateIds.dims[1];
                    const total = feeds[cacheNames[0]].dims[2] + sequence;
                    // This lifecycle test checks learned output metadata, not numerical inference.
                    // Keep the 56 cache values unreadable instead of allocating learned buffers.
                    const learned = (dims: number[]) => {
                        const tensor = new FakePinnedOrtTensor(
                            "float32",
                            new Float32Array(0),
                            dims,
                        );
                        Object.defineProperty(tensor, "data", {
                            get() {
                                throw new Error("Learned output data must not be read");
                            },
                        });
                        return tensor;
                    };
                    return {
                        logits: learned([1, 1, 151936]),
                        ...Object.fromEntries(
                            presentNames.map((name) => [name, learned([1, 8, total, 128])]),
                        ),
                    };
                },
                release: async () => {
                    if (released) return;
                    released = true;
                    activeSessions -= 1;
                    events.push(`release:${config.name}:active=${activeSessions}`);
                },
            };
        };
        const construct = new Function(
            "getSession",
            "createInferenceSession",
            "Blob",
            `${constructSource}; return constructSessions;`,
        )(getSession, createInferenceSession, FakeBlob) as ConstructSessions;
        const externalArtifacts = {
            vision_encoder: { path: "vision_encoder_q4.onnx_data", bytes: 217_952_256 },
            embed_tokens: { path: "embed_tokens_q4.onnx_data", bytes: 199_340_032 },
            decoder_model_merged: {
                path: "decoder_model_merged_q4.onnx_data",
                bytes: 1_102_630_912,
            },
        } as const;
        const getStagedExternalData = vi.fn(async (name: keyof typeof externalArtifacts) => {
            const artifact = externalArtifacts[name];
            return [
                {
                    path: artifact.path,
                    data: new FakeBlob(artifact.bytes),
                },
                ...(name === "vision_encoder"
                    ? [
                          {
                              path: "vision_encoder_q4_deepstack.onnx_data",
                              data: new FakeBlob(302_161_920),
                          },
                      ]
                    : []),
            ];
        });
        const waitForStagedWebGpuQueue = vi.fn(async (name: string) => {
            events.push(`drain:${name}:active=${activeSessions}`);
        });
        const withStagedWebGpuRelease = vi.fn(
            async (stage: string, release: () => Promise<void>) => {
                events.push(`retire-start:${stage}:active=${activeSessions}`);
                await release();
                events.push(`retire-end:${stage}:active=${activeSessions}`);
            },
        );
        const sessions = await construct(
            "onnx-community/Qwen3-VL-2B-Instruct-ONNX",
            {
                embed_tokens: "embed_tokens",
                decoder_model_merged: "decoder_model_merged",
                vision_encoder: "vision_encoder",
            },
            {
                revision: "3e4136ea66ae6e07c110e64fe07da2e029517ab5",
                config: { image_token_id: 151655 },
                device: {
                    embed_tokens: "webgpu",
                    decoder_model_merged: "webgpu",
                    vision_encoder: "webgpu",
                },
                dtype: {
                    embed_tokens: "q4",
                    decoder_model_merged: "q4",
                    vision_encoder: "q4",
                },
                session_options: {
                    openchat_runtime_adapter: "qwen3-vl-2b-staged-v1",
                    openchat_get_staged_external_data: getStagedExternalData,
                    openchat_wait_for_staged_webgpu_queue: waitForStagedWebGpuQueue,
                    openchat_with_staged_webgpu_release: withStagedWebGpuRelease,
                },
            },
            { decoder_model_merged: true },
        );

        expect(activeSessions).toBe(2);
        expect(sessions.decoder_model_merged.inputNames).toEqual(
            TRANSFORMERS_QWEN_DECODER_INPUT_METADATA.map(({ name }) => name),
        );
        expect(sessions.decoder_model_merged.inputNames).not.toContain(
            TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT,
        );
        expect(events.some((event) => event.startsWith("get:decoder_model_merged"))).toBe(false);
        const promptIds = new FakeInputOrtTensor(
            "int64",
            new BigInt64Array([1n, ...Array<bigint>(features).fill(151655n), 3n, 4n]),
            [1, promptLength],
        );
        const promptEmbeds = await sessions.embed_tokens.run({ input_ids: promptIds });
        expect(promptEmbeds.inputs_embeds).toBeInstanceOf(FakePinnedOrtTensor);
        expect((promptEmbeds.inputs_embeds as FakeOrtTensor).dims).toEqual([1, promptLength, 2048]);
        expect(activeSessions).toBe(1);
        expect(sessions.vision_encoder.inputNames).toEqual(["pixel_values", "image_grid_thw"]);
        await sessions.vision_encoder.run({
            pixel_values: new FakePinnedOrtTensor("float32", new Float32Array(patches * 1536), [
                patches,
                1536,
            ]),
            image_grid_thw: new FakePinnedOrtTensor(
                "int64",
                new BigInt64Array([1n, 16n, 16n]),
                [1, 3],
            ),
        });
        const decoderFeeds = (
            embeds: Record<string, unknown>,
            previous?: Record<string, unknown>,
        ): Record<string, unknown> => {
            const sequence = (embeds.inputs_embeds as FakeOrtTensor).dims[1];
            const past = (previous?.[presentNames[0]] as FakeOrtTensor | undefined)?.dims[2] ?? 0;
            return {
                ...embeds,
                attention_mask: new FakeInputOrtTensor(
                    "int64",
                    new BigInt64Array(past + sequence).fill(1n),
                    [1, past + sequence],
                ),
                position_ids: new FakeInputOrtTensor("int64", new BigInt64Array(3 * sequence), [
                    3,
                    1,
                    sequence,
                ]),
                ...Object.fromEntries(
                    cacheNames.map((name, index) => [
                        name,
                        previous?.[presentNames[index]] ??
                            new FakeInputOrtTensor("float32", new Float32Array(0), [1, 8, 0, 128]),
                    ]),
                ),
            };
        };
        const promptResult = await sessions.decoder_model_merged.run(decoderFeeds(promptEmbeds));
        expect(Object.keys(promptResult)).toHaveLength(57);
        expect(events).toContain("release:embed_tokens:active=1");
        expect(events).toContain("release:vision_encoder:active=0");
        expect(events).toContain("retire-start:prompt-to-decoder transition:active=1");
        expect(events).toContain("retire-end:prompt-to-decoder transition:active=0");
        expect(events).toContain("get:decoder_model_merged:active=0");
        expect(events.indexOf("release:vision_encoder:active=0")).toBeLessThan(
            events.indexOf("get:decoder_model_merged:active=0"),
        );
        expect(events.indexOf("retire-end:prompt-to-decoder transition:active=0")).toBeLessThan(
            events.indexOf("get:decoder_model_merged:active=0"),
        );
        expect(events).toContain("decoder-ids:1x0");
        expect(events).toContain(`decoder-embeds:1x${promptLength}x2048`);
        expect(getStagedExternalData.mock.calls.map(([name]) => name)).toEqual([
            "vision_encoder",
            "embed_tokens",
            "decoder_model_merged",
        ]);

        const cachedIds = new FakeInputOrtTensor("int64", new BigInt64Array([5n]), [1, 1]);
        const cachedEmbeds = await sessions.embed_tokens.run({ input_ids: cachedIds });
        // Transformers.js sees a normal token-length shape. The facade swaps this to the graph's
        // empty selector branch only after sessionRun has completed its generic bookkeeping.
        expect((cachedEmbeds.inputs_embeds as FakeOrtTensor).dims).toEqual([1, 1, 2048]);
        expect(cachedEmbeds.inputs_embeds).toBeInstanceOf(FakePinnedOrtTensor);
        expect(cachedEmbeds.inputs_embeds).not.toBeInstanceOf(FakeInputOrtTensor);
        const cachedFeeds = decoderFeeds(cachedEmbeds, promptResult);
        for (const [index, name] of cacheNames.entries()) {
            expect(cachedFeeds[name]).toBe(promptResult[presentNames[index]]);
        }
        const cachedResult = await sessions.decoder_model_merged.run(cachedFeeds);
        expect(Object.keys(cachedResult)).toHaveLength(57);
        expect(events).toContain("decoder-ids:1x1");
        expect(events).toContain("decoder-embeds:1x0x2048");
        expect(events.filter((event) => event.startsWith("get:embed_tokens"))).toHaveLength(1);
        expect(events.filter((event) => event.startsWith("create:embed_tokens"))).toHaveLength(1);
        expect(activeSessions).toBe(1);
        expect(waitForStagedWebGpuQueue.mock.calls.map(([name]) => name)).toEqual([
            "vision_encoder",
            "embed_tokens",
            "decoder_model_merged",
        ]);
        for (const [index, event] of events.entries()) {
            if (!event.startsWith("create:")) continue;
            const name = event.split(":")[1];
            const drainIndex = events.findIndex(
                (candidate, candidateIndex) =>
                    candidateIndex > index && candidate.startsWith(`drain:${name}:`),
            );
            const nextCreateOrRun = events.findIndex(
                (candidate, candidateIndex) =>
                    candidateIndex > index &&
                    (candidate.startsWith("create:") || candidate.startsWith("run:")),
            );
            expect(drainIndex).toBeGreaterThan(index);
            if (nextCreateOrRun !== -1) expect(drainIndex).toBeLessThan(nextCreateOrRun);
        }
        await sessions.embed_tokens.release();
        await sessions.decoder_model_merged.release();
        expect(activeSessions).toBe(0);
    });

    it("derives deferred decoder metadata from the exact pinned ONNX graph", () => {
        const graphPath = path.join(
            APP_DIR,
            "model-overrides/qwen3vl2b/onnx/decoder_model_merged_q4.onnx",
        );
        const schema = nodeRequire(
            path.join(
                FRONTEND_DIR,
                "node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js",
            ),
        ) as {
            onnx: {
                ModelProto: {
                    decode(bytes: Uint8Array): {
                        graph: {
                            input: Array<{
                                name: string;
                                type: {
                                    tensorType: {
                                        elemType: number;
                                        shape: {
                                            dim: Array<{
                                                dimParam?: string;
                                                dimValue?: number | string | { toNumber(): number };
                                            }>;
                                        };
                                    };
                                };
                            }>;
                        };
                    };
                };
            };
        };
        const graph = schema.onnx.ModelProto.decode(fs.readFileSync(graphPath)).graph;
        const typeNames: Record<number, string> = { 1: "float32", 7: "int64" };
        const actual = graph.input.map((input) => {
            const tensor = input.type.tensorType;
            const type = typeNames[tensor.elemType];
            if (type === undefined)
                throw new Error(`unsupported decoder input type ${tensor.elemType}`);
            return {
                name: input.name,
                isTensor: true,
                type,
                shape: tensor.shape.dim.map((dim) => {
                    if (typeof dim.dimParam === "string" && dim.dimParam !== "")
                        return dim.dimParam;
                    const value = dim.dimValue;
                    if (typeof value === "number") return value;
                    if (typeof value === "string") return Number(value);
                    if (value !== undefined) return value.toNumber();
                    throw new Error(
                        `decoder input ${input.name} contains an unspecified dimension`,
                    );
                }),
            };
        });

        expect(actual).toEqual(TRANSFORMERS_QWEN_DECODER_INPUT_METADATA);
        expect(actual).toHaveLength(59);
    });

    it("builds an exact tied-embedding decoder without duplicating model weights", () => {
        const graphPath = path.join(
            APP_DIR,
            "model-overrides/qwen3vl2b/onnx/decoder_model_merged_q4.onnx",
        );
        const source = fs.readFileSync(graphPath);
        expect(source.byteLength).toBe(QWEN3_VL_2B_DECODER_SOURCE_BYTES);
        expect(createHash("sha256").update(source).digest("hex")).toBe(
            QWEN3_VL_2B_DECODER_SOURCE_SHA256,
        );
        const drifted = Uint8Array.from(source);
        drifted[drifted.length - 1] ^= 1;
        expect(() => patchQwen3Vl2bDecoderGraph(drifted)).toThrow(
            "Pinned Qwen decoder source changed",
        );

        const patched = patchQwen3Vl2bDecoderGraph(source);
        expect(patched.byteLength).toBe(QWEN3_VL_2B_DECODER_PATCHED_BYTES);
        expect(createHash("sha256").update(patched).digest("hex")).toBe(
            QWEN3_VL_2B_DECODER_PATCHED_SHA256,
        );
        expect(GRAPH_TOKEN_IDS_INPUT).toBe(TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT);
        expect(
            TRANSFORMERS_QWEN_ARTIFACTS.find(
                ({ path: artifactPath }) => artifactPath === "onnx/decoder_model_merged_q4.onnx",
            ),
        ).toMatchObject({
            bytes: QWEN3_VL_2B_GENERATION_BYTES,
            sha256: QWEN3_VL_2B_GENERATION_SHA256,
        });
        const delivered = patchQwen3Vl2bGenerationGraph(
            patchQwen3Vl2bDeepStackDecoderGraph(patched),
            {
                scope: "generation-only",
            },
        );
        expect(delivered.byteLength).toBe(QWEN3_VL_2B_GENERATION_BYTES);
        expect(createHash("sha256").update(delivered).digest("hex")).toBe(
            QWEN3_VL_2B_GENERATION_SHA256,
        );

        const schema = nodeRequire(
            path.join(
                FRONTEND_DIR,
                "node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js",
            ),
        ) as {
            onnx: {
                ModelProto: {
                    decode(bytes: Uint8Array): {
                        graph: {
                            input: unknown[];
                            initializer: Array<{
                                name: string;
                                dataLocation: number;
                                externalData: Array<{ key: string; value: string }>;
                            }>;
                            node: Array<{
                                attribute: Array<{
                                    name: string;
                                    i: number | { toString(): string };
                                }>;
                            }>;
                        };
                    };
                };
            };
        };
        const sourceGraph = schema.onnx.ModelProto.decode(source).graph;
        const graph = schema.onnx.ModelProto.decode(patched).graph;
        expect(graph.input).toHaveLength(sourceGraph.input.length + 1);
        expect(graph.initializer).toHaveLength(sourceGraph.initializer.length + 6);
        expect(graph.initializer.filter(({ dataLocation }) => dataLocation === 1)).toHaveLength(
            sourceGraph.initializer.filter(({ dataLocation }) => dataLocation === 1).length,
        );
        expect(graph.input.at(-1)).toMatchObject({
            name: TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT,
            type: { tensorType: { elemType: 7 } },
        });

        const [reshape, gather, concat] = graph.node;
        expect(reshape).toMatchObject({
            name: "__openchat/tied_embedding/Reshape",
            opType: "Reshape",
            input: ["lm_head_MatMul_weight_quant", "__openchat_tied_embedding_shape"],
            output: ["__openchat_tied_embedding_quant_2d"],
        });
        expect(gather).toMatchObject({
            name: "__openchat/tied_embedding/GatherBlockQuantized",
            opType: "GatherBlockQuantized",
            domain: "com.microsoft",
            input: [
                "__openchat_tied_embedding_quant_2d",
                TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT,
                "lm_head_MatMul_weight_scales",
                "lm_head_MatMul_weight_zp",
            ],
        });
        expect(
            Object.fromEntries(gather.attribute.map(({ name, i }) => [name, Number(i)])),
        ).toEqual({ bits: 4, block_size: 32, gather_axis: 0, quantize_axis: 1 });
        expect(concat).toMatchObject({
            name: "__openchat/tied_embedding/Concat",
            opType: "Concat",
            input: ["inputs_embeds", "__openchat_tied_token_embeddings"],
            output: ["__openchat_selected_input_embeddings"],
        });
        expect(Number(concat.attribute.find(({ name }) => name === "axis")?.i)).toBe(1);

        const external = (name: string) => {
            const initializer = graph.initializer.find((entry) => entry.name === name);
            if (initializer === undefined) throw new Error(`Missing initializer: ${name}`);
            return Object.fromEntries(
                initializer.externalData.map(({ key, value }) => [key, value]),
            );
        };
        expect(external("lm_head_MatMul_weight_quant")).toMatchObject({
            location: QWEN3_VL_2B_TIED_EMBEDDING_EXTERNAL_DATA.location,
            offset: String(QWEN3_VL_2B_TIED_EMBEDDING_EXTERNAL_DATA.offset),
            length: "155582464",
        });
        expect(external("lm_head_MatMul_weight_zp")).toMatchObject({
            offset: "1097768960",
            length: "4861952",
        });
        expect(
            TRANSFORMERS_QWEN_ARTIFACTS.find(
                ({ path: artifactPath }) => artifactPath === "onnx/embed_tokens_q4.onnx_data",
            )?.sha256,
        ).toBe(QWEN3_VL_2B_TIED_EMBEDDING_EXTERNAL_DATA.sha256);

        const concatAxisOne = <T>(left: T[], right: T[]): T[] => [...left, ...right];
        const promptEmbeddings = ["merged-text", "merged-image"];
        const cachedEmbedding = ["tied-token"];
        expect(concatAxisOne(promptEmbeddings, [])).toEqual(promptEmbeddings);
        expect(concatAxisOne([], cachedEmbedding)).toEqual(cachedEmbedding);
    });

    it("preserves the standalone q4 embedding layout through the tied decoder reshape", () => {
        const vocabularySize = 151_936;
        const hiddenSize = 2_048;
        const blockSize = 32;
        const blocksPerRow = hiddenSize / blockSize;
        const packedBytesPerBlock = blockSize / 2;
        const packedBytesPerRow = hiddenSize / 2;

        // The standalone embed graph stores UINT8-packed q4 as [V, 1024]. The LM head stores
        // the byte-identical range as MatMulNBits [V, 64, 16]. Reshape is row-major, so every
        // logical q4 coordinate must address the same byte and nibble in both representations.
        expect([vocabularySize, blocksPerRow, packedBytesPerBlock]).toEqual([151_936, 64, 16]);
        expect(blocksPerRow * packedBytesPerBlock).toBe(packedBytesPerRow);
        expect(packedBytesPerRow * 2).toBe(hiddenSize);

        const standaloneDataAddress = (token: number, hidden: number) => ({
            byte: token * packedBytesPerRow + Math.floor(hidden / 2),
            shift: (hidden % 2) * 4,
        });
        const tiedDataAddress = (token: number, hidden: number) => {
            const block = Math.floor(hidden / blockSize);
            const withinBlock = hidden % blockSize;
            return {
                byte:
                    token * blocksPerRow * packedBytesPerBlock +
                    block * packedBytesPerBlock +
                    Math.floor(withinBlock / 2),
                shift: (withinBlock % 2) * 4,
            };
        };
        const standaloneScaleAddress = (token: number, hidden: number) =>
            token * blocksPerRow + Math.floor(hidden / blockSize);
        const tiedScaleAddress = (token: number, hidden: number) =>
            token * blocksPerRow + Math.floor(hidden / blockSize);
        const standaloneZeroPointAddress = (token: number, hidden: number) => {
            const block = Math.floor(hidden / blockSize);
            return {
                byte: token * (blocksPerRow / 2) + Math.floor(block / 2),
                shift: (block % 2) * 4,
            };
        };
        const tiedZeroPointAddress = (token: number, hidden: number) => {
            const logicalZeroPoint = token * blocksPerRow + Math.floor(hidden / blockSize);
            return {
                byte: Math.floor(logicalZeroPoint / 2),
                shift: (logicalZeroPoint % 2) * 4,
            };
        };

        for (const token of [0, 1, 31, 32, 1_024, 65_535, vocabularySize - 1]) {
            for (let hidden = 0; hidden < hiddenSize; hidden += 1) {
                expect(tiedDataAddress(token, hidden)).toEqual(
                    standaloneDataAddress(token, hidden),
                );
                expect(tiedScaleAddress(token, hidden)).toBe(standaloneScaleAddress(token, hidden));
                expect(tiedZeroPointAddress(token, hidden)).toEqual(
                    standaloneZeroPointAddress(token, hidden),
                );
            }
        }

        const last = tiedDataAddress(vocabularySize - 1, hiddenSize - 1);
        expect(last).toEqual({
            byte: vocabularySize * packedBytesPerRow - 1,
            shift: 4,
        });
        expect(last.byte + 1).toBe(155_582_464);
    });

    it("serves exact same-origin ORT files and keeps routing behind an explicit build flag", () => {
        const vite = fs.readFileSync(path.join(APP_DIR, "vite.config.ts"), "utf8");
        const rollup = fs.readFileSync(path.join(APP_DIR, "rollup.config.mjs"), "utf8");
        const workers = fs.readFileSync(path.join(APP_DIR, "build-workers.mjs"), "utf8");

        for (const source of [vite, rollup]) {
            expect(source).toContain("ort-1.29.0-dev.20260723-1b1e1db7bc");
            expect(source).toContain("ort-wasm-simd-threaded.jspi.mjs");
            expect(source).toContain("ort-wasm-simd-threaded.jspi.wasm");
            expect(source).not.toContain("ort-wasm-simd-threaded.asyncify");
        }
        expect(vite).toContain('find: "onnxruntime-web/webgpu"');
        expect(vite).toContain('replacement: "onnxruntime-web/jspi"');
        expect(vite).toContain('"./src/utils/transformersWebGpuDeviceRetirement.ts"');
        expect(vite).toContain('"/hf-model"');
        expect(vite).toContain("QWEN3_VL_2B_MODEL_ROUTE_PREFIX");
        expect(vite).toContain("qwen3-vl-2b-adreno-model-overrides");
        expect(vite).toContain("model-overrides/qwen3vl2b/onnx");
        expect(vite).toContain("devTransformersWebGpuRuntimeVersion.rotate()");
        expect(vite).toContain("TRANSFORMERS_WEBGPU_DEV_RUNTIME_VERSION_META");
        expect(vite.indexOf("devTransformersWebGpuRuntimeVersion.rotate()")).toBeLessThan(
            vite.indexOf('server.ws.send({ type: "full-reload" })'),
        );
        expect(rollup).toContain("OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE");
        for (const source of [vite, rollup, workers]) {
            expect(source).toContain("transformersWebGpuFeatureEnabled(process.env)");
        }
        expect(rollup).not.toMatch(
            /const transformersWebGpuSpikeEnabled\s*=\s*process\.env\.OC_BUILD_ENV/,
        );
        expect(workers).not.toMatch(
            /const transformersWebGpuSpikeEnabled\s*=\s*process\.env\.OC_BUILD_ENV/,
        );
        expect(rollup).toContain(
            "!transformersWebGpuSpikeEnabled || (isNativeApp && !isNativeAndroid)",
        );
        expect(rollup).toContain("packagedAndroidTransformersGraphs");
        expect(rollup).toContain("patchQwen3Vl2bDecoderGraph");
        expect(rollup).toContain(
            "assets/transformers-webgpu/qwen3vl2b/onnx/decoder_model_merged_q4.onnx",
        );
        expect(rollup).toContain(
            "assets/transformers-webgpu/qwen3vl2b/onnx/vision_encoder_q4.onnx",
        );
        expect(rollup).toContain('src: "../openchat-worker/lib/worker.js*"');

        const tauri = fs.readFileSync(path.join(FRONTEND_DIR, "src-tauri/src/lib.rs"), "utf8");
        const tauriCargo = fs.readFileSync(path.join(FRONTEND_DIR, "src-tauri/Cargo.toml"), "utf8");
        const inference = fs.readFileSync(
            path.join(APP_DIR, "src/utils/transformersWebGpuInference.ts"),
            "utf8",
        );
        const workerSource = fs.readFileSync(
            path.join(APP_DIR, "src/workers/transformersWebGpuInference.worker.ts"),
            "utf8",
        );
        expect(tauri).not.toContain('option_env!("OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE")');
        expect(tauriCargo).toContain("transformers-webgpu-android = []");
        expect(workerSource).toContain("onnx.wasm.numThreads = 1");
        expect(inference).not.toContain("globalThis.crossOriginIsolated");
    });

    it("pins the exact checked-in decoder source and vision graph rewrites", () => {
        const expected = new Map([
            [
                "decoder_model_merged_q4.onnx",
                "0b309c7423500f5226b07e1895adbecb245105a61abe065dedeb5ae136da335c",
            ],
            [
                "vision_encoder_q4.onnx",
                "9e4585fdc96e118b27412133e3a37dca85f1abd471015accad9e76bc9959e6c3",
            ],
        ]);
        for (const [fileName, sha256] of expected) {
            const bytes = fs.readFileSync(
                path.join(APP_DIR, "model-overrides/qwen3vl2b/onnx", fileName),
            );
            expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha256);
        }
    });
});
