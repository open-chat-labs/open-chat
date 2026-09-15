// @vitest-environment node
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { patchQwen3Vl2bDecoderGraph } from "../../transformersWebGpuDecoderGraph.mjs";
import {
    QWEN3_VL_2B_MROPE_ADDED_INITIALIZERS,
    QWEN3_VL_2B_MROPE_REPLACED_NODES,
    transformQwen3Vl2bInterleavedMrope,
} from "../../transformersWebGpuMropeGraph.mjs";

const require = createRequire(import.meta.url);
const modules = path.resolve(import.meta.dirname, "../../../node_modules");
const schema = require(
    path.join(modules, "onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js"),
).onnx;
const source = fs.readFileSync(
    path.resolve(
        import.meta.dirname,
        "../../model-overrides/qwen3vl2b/onnx/decoder_model_merged_q4.onnx",
    ),
);
const readSource = () => schema.ModelProto.decode(Buffer.from(source));
type Model = ReturnType<typeof readSource>;
type Named = { name: string };
type Node = Named & { input: string[]; output: string[] };
const encode = (model: Model) => Buffer.from(schema.ModelProto.encode(model).finish());
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const same = (
    type: { encode(value: unknown): { finish(): Uint8Array } },
    left: unknown,
    right: unknown,
) => Buffer.from(type.encode(left).finish()).equals(Buffer.from(type.encode(right).finish()));
const selector =
    /^\/model\/mrope_flattened_cache\/(cos|sin)\/(Split|chunk_[012]\/(Gather|Squeeze)|Concat)$/;

describe("Pinned Qwen3 interleaved mRoPE graph correction", () => {
    it("changes only the sixteen old selectors and adds five inline constants", () => {
        const original = readSource();
        const before = encode(original);
        const patched = transformQwen3Vl2bInterleavedMrope(original);
        expect(encode(original).equals(before)).toBe(true);
        expect(QWEN3_VL_2B_MROPE_REPLACED_NODES).toBe(16);
        expect(patched.graph.node.length).toBe(original.graph.node.length - 6);
        expect(patched.graph.initializer.length).toBe(
            original.graph.initializer.length + QWEN3_VL_2B_MROPE_ADDED_INITIALIZERS,
        );
        const unchanged = patched.graph.node.filter(
            (n: Named) => !n.name.startsWith("__openchat/mrope/"),
        );
        const expected = original.graph.node.filter((n: Named) => !selector.test(n.name));
        expect(same(schema.GraphProto, { node: unchanged }, { node: expected })).toBe(true);
        expect(
            same(
                schema.GraphProto,
                {
                    initializer: patched.graph.initializer.slice(
                        0,
                        original.graph.initializer.length,
                    ),
                },
                { initializer: original.graph.initializer },
            ),
        ).toBe(true);
        patched.graph.node = original.graph.node;
        patched.graph.initializer = original.graph.initializer;
        expect(encode(patched).equals(before)).toBe(true);
    });

    it("preserves tied embeddings, all weight ranges, rotary convention and public inputs", () => {
        const original = readSource();
        const patched = schema.ModelProto.decode(patchQwen3Vl2bDecoderGraph(source));
        const expected = transformQwen3Vl2bInterleavedMrope(original);
        for (const node of expected.graph.node) {
            node.input = node.input.map((name: string) =>
                name === "inputs_embeds" ? "__openchat_selected_input_embeddings" : name,
            );
        }
        expect(
            same(
                schema.GraphProto,
                { node: patched.graph.node.slice(3) },
                { node: expected.graph.node },
            ),
        ).toBe(true);
        expect(patched.graph.node.slice(0, 3).map((n: Named) => n.name)).toEqual([
            "__openchat/tied_embedding/Reshape",
            "__openchat/tied_embedding/GatherBlockQuantized",
            "__openchat/tied_embedding/Concat",
        ]);
        expect(patched.graph.input.slice(0, original.graph.input.length)).toEqual(
            original.graph.input,
        );
        expect(patched.graph.input.at(-1).name).toBe("__openchat_input_ids");
        expect(patched.graph.output).toEqual(original.graph.output);
        expect(
            same(
                schema.GraphProto,
                {
                    initializer: patched.graph.initializer.slice(
                        0,
                        original.graph.initializer.length,
                    ),
                },
                { initializer: original.graph.initializer },
            ),
        ).toBe(true);
        for (const node of original.graph.node) {
            if (node.opType !== "RotaryEmbedding") continue;
            expect(patched.graph.node.find((n: Named) => n.name === node.name)).toEqual(node);
            expect(Number(node.attribute.find((a: Named) => a.name === "interleaved").i)).toBe(0);
        }
        expect(digest(source)).toBe(
            "0b309c7423500f5226b07e1895adbecb245105a61abe065dedeb5ae136da335c",
        );
    });

    it("selects the official H/W frequency slots, changes43of64 axes, and retains the temporal tail", () => {
        const { graph } = transformQwen3Vl2bInterleavedMrope(readSource());
        const height = graph.initializer.find(
            (t: Named) => t.name === "__openchat_mrope_height_mask",
        );
        const width = graph.initializer.find(
            (t: Named) => t.name === "__openchat_mrope_width_mask",
        );
        for (const mask of [height, width]) {
            expect(mask.dataType).toBe(9);
            expect(mask.rawData.length).toBe(64);
            expect(mask.externalData).toEqual([]);
        }
        // Independent transcription of HF v4.57.1 apply_interleaved_mrope's slice assignment.
        const official = new Array<number>(64).fill(0);
        for (const axis of [1, 2]) for (let i = axis; i < 20 * 3; i += 3) official[i] = axis;
        const actual = Array.from({ length: 64 }, (_, i) =>
            width.rawData[i] ? 2 : height.rawData[i] ? 1 : 0,
        );
        const old = Array.from({ length: 64 }, (_, i) => (i < 24 ? 0 : i < 44 ? 1 : 2));
        expect(actual).toEqual(official);
        expect(actual.filter((a, i) => a !== old[i])).toHaveLength(43);
        expect([0, 1, 2].map((a) => actual.filter((x) => x === a).length)).toEqual([24, 20, 20]);
        expect(actual.slice(60)).toEqual([0, 0, 0, 0]);
    });

    const corruptions: Array<[string, (model: Model) => void]> = [
        [
            "selector node drift",
            (m) => {
                m.graph.node.find((n: Named) => n.name.endsWith("/cos/Split")).input[0] = "wrong";
            },
        ],
        [
            "missing selector",
            (m) => {
                m.graph.node = m.graph.node.filter((n: Named) => !n.name.endsWith("/sin/Concat"));
            },
        ],
        [
            "extra mRoPE node",
            (m) => {
                m.graph.node.push(
                    schema.NodeProto.create({
                        name: "/model/mrope_unreviewed",
                        opType: "Identity",
                        input: ["position_ids"],
                        output: ["bad"],
                    }),
                );
            },
        ],
        [
            "frequency drift",
            (m) => {
                m.graph.initializer.find((t: Named) => t.name === "model.inv_freq").rawData[7] ^= 1;
            },
        ],
        [
            "external frequency data",
            (m) => {
                m.graph.initializer
                    .find((t: Named) => t.name === "model.inv_freq")
                    .externalData.push({ key: "location", value: "weights" });
            },
        ],
        [
            "reserved initializer collision",
            (m) => {
                m.graph.initializer.push(
                    schema.TensorProto.create({
                        name: "__openchat_mrope_height_mask",
                        dataType: 9,
                        dims: [64],
                    }),
                );
            },
        ],
        [
            "reserved node collision",
            (m) => {
                m.graph.node.push(
                    schema.NodeProto.create({
                        name: "__openchat/mrope/other",
                        opType: "Identity",
                        input: ["position_ids"],
                        output: ["other"],
                    }),
                );
            },
        ],
        [
            "unexpected internal consumer",
            (m) => {
                m.graph.node.push(
                    schema.NodeProto.create({
                        name: "unexpected",
                        opType: "Identity",
                        input: ["/model/mrope_flattened_cache/cos/Split/output_0"],
                        output: ["other"],
                    }),
                );
            },
        ],
        [
            "exposed internal output",
            (m) => {
                m.graph.output.push(
                    schema.ValueInfoProto.create({
                        name: "/model/mrope_flattened_cache/sin/chunk_1/Gather/output_0",
                    }),
                );
            },
        ],
    ];
    it.each(corruptions)("rejects %s without mutating input", (_name, corrupt) => {
        const model = readSource();
        corrupt(model);
        const before = encode(model);
        expect(() => transformQwen3Vl2bInterleavedMrope(model)).toThrow(/Pinned Qwen mRoPE/);
        expect(encode(model).equals(before)).toBe(true);
    });

    it("rejects applying the transform twice", () => {
        const patched = transformQwen3Vl2bInterleavedMrope(readSource());
        expect(() => transformQwen3Vl2bInterleavedMrope(patched)).toThrow(/already transformed/);
    });

    it("executes the extracted old/new caches on the pinned WASM runtime without model weights", async () => {
        const model = readSource();
        model.graph.node = model.graph.node.filter((n: Named) =>
            n.name.startsWith("/model/mrope_"),
        );
        const required = new Set(model.graph.node.flatMap((n: Node) => n.input));
        model.graph.initializer = model.graph.initializer.filter((t: Named) =>
            required.has(t.name),
        );
        model.graph.input = model.graph.input.filter((v: Named) => v.name === "position_ids");
        model.graph.valueInfo = [];
        const names = ["cos", "sin"].map(
            (kind) => `/model/mrope_flattened_cache/${kind}_flat/Reshape/output_0`,
        );
        model.graph.output = names.map((name) =>
            schema.ValueInfoProto.create({
                name,
                type: {
                    tensorType: {
                        elemType: 1,
                        shape: { dim: [{ dimParam: "rows" }, { dimValue: 64 }] },
                    },
                },
            }),
        );
        const patched = transformQwen3Vl2bInterleavedMrope(model);
        const ort = require(
            path.join(modules, "onnxruntime-web"),
        ) as typeof import("onnxruntime-web");
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.proxy = false;
        ort.env.wasm.wasmBinary = fs.readFileSync(
            path.join(modules, "onnxruntime-web/dist/ort-wasm-simd-threaded.wasm"),
        );
        ort.env.wasm.wasmPaths = {
            mjs: pathToFileURL(
                path.join(modules, "onnxruntime-web/dist/ort-wasm-simd-threaded.mjs"),
            ).href,
        };
        const options = {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "disabled",
            logSeverityLevel: 3,
        } as const;
        const originalSession = await ort.InferenceSession.create(encode(model), options);
        let proposedSession: Awaited<ReturnType<typeof ort.InferenceSession.create>> | undefined;
        try {
            proposedSession = await ort.InferenceSession.create(encode(patched), options);
            const freq = Buffer.from(
                model.graph.initializer.find((t: Named) => t.name === "model.inv_freq").rawData,
            );
            for (const equal of [true, false]) {
                const positions = BigInt64Array.from(
                    equal ? [2n, 3n, 2n, 3n, 2n, 3n] : [2n, 3n, 5n, 7n, 11n, 13n],
                );
                const input = new ort.Tensor("int64", positions, [3, 1, 2]);
                const old = await originalSession.run({ position_ids: input });
                const next = await proposedSession.run({ position_ids: input });
                let negativeControl = 0;
                for (const [channel, kind] of ["cos", "sin"].entries()) {
                    const a = old[names[channel]],
                        b = next[names[channel]];
                    expect(b.dims).toEqual([2, 64]);
                    if (equal) expect(a.data).toEqual(b.data);
                    for (let row = 0; row < 2; row++)
                        for (let j = 0; j < 64; j++) {
                            const axis = j < 60 ? j % 3 : 0;
                            const angle = Math.fround(
                                Number(positions[axis * 2 + row]) * freq.readFloatLE(j * 4),
                            );
                            const want = Math.fround(
                                kind === "cos" ? Math.cos(angle) : Math.sin(angle),
                            );
                            const value = Number(b.data[row * 64 + j]);
                            expect(Math.abs(value - want)).toBeLessThanOrEqual(2e-6);
                            negativeControl = Math.max(
                                negativeControl,
                                Math.abs(Number(a.data[row * 64 + j]) - want),
                            );
                        }
                    a.dispose();
                    b.dispose();
                }
                input.dispose();
                if (!equal) expect(negativeControl).toBeGreaterThan(0.01);
            }
        } finally {
            await proposedSession?.release();
            await originalSession.release();
        }
    }, 15_000);
});
