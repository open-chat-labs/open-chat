import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { createQwen3Vl2bGenerationRuntime } from "../../transformersWebGpuQwenGenerationRuntime.mjs";

class Tensor {
    dispose = vi.fn();
    constructor(
        public type: string,
        public value: BigInt64Array | "learned",
        public dims: number[],
    ) {}
    get data() {
        if (this.value === "learned") throw new Error("Learned tensor readback forbidden");
        return this.value;
    }
}
type Feeds = Record<string, Tensor>;
type GenerationControl = { type: string; dims: number[]; data: BigInt64Array };
type InputMetadata = { name: string; type: string; shape: readonly (string | number)[] };
function feeds(embeddingSequence = 604, tokenSequence = 0, past = 0): Feeds {
    const sequence = embeddingSequence + tokenSequence;
    const result: Feeds = {
        inputs_embeds: new Tensor("float32", "learned", [1, embeddingSequence, 2048]),
        __openchat_input_ids: new Tensor("int64", "learned", [1, tokenSequence]),
        attention_mask: new Tensor("int64", "learned", [1, past + sequence]),
        position_ids: new Tensor("int64", "learned", [3, 1, sequence]),
    };
    for (let layer = 0; layer < 28; layer++)
        for (const kind of ["key", "value"]) {
            result[`past_key_values.${layer}.${kind}`] = new Tensor("float32", "learned", [
                1,
                8,
                past,
                128,
            ]);
        }
    for (let stage = 0; stage < 3; stage++) {
        result[`__openchat_deepstack_${stage}`] = new Tensor("float32", "learned", [
            1,
            sequence,
            2048,
        ]);
    }
    return result;
}
function outputs(total: number): Feeds {
    const result: Feeds = { logits: new Tensor("float32", "learned", [1, 1, 151936]) };
    for (let layer = 0; layer < 28; layer++)
        for (const kind of ["key", "value"]) {
            result[`present.${layer}.${kind}`] = new Tensor("float32", "learned", [
                1,
                8,
                total,
                128,
            ]);
        }
    return result;
}

describe("Qwen generation-only host metadata", () => {
    it.each([
        [1, 0, 0],
        [604, 0, 0],
        [631, 0, 0],
        [0, 1, 604],
        [0, 1, 1023],
    ])(
        "creates exact current-call controls E=%i I=%i P=%i without learned data reads",
        (E, I, P) => {
            const runtime = createQwen3Vl2bGenerationRuntime(),
                source = feeds(E, I, P);
            const controls = runtime.makeControls(source),
                S = E + I,
                T = P + S;
            expect(Object.keys(controls)).toEqual(runtime.inputNames);
            const expected = [
                [[4], [3, 1, 64, 1]],
                [[4], [1, 1, S, T]],
                [[1, S], Array.from({ length: S }, (_, index) => index)],
                [[1], [T]],
                [[2], [P, 0]],
                [[2], [T, T]],
                [[8], [0, 0, 0, 0, 0, 0, 0, 1024 - T]],
                [[8], [0, 0, 0, 0, 0, 0, 1024 - T, 0]],
            ];
            Object.values(controls).forEach((control: GenerationControl, index) => {
                expect(control.type).toBe("int64");
                expect(control.dims).toEqual(expected[index][0]);
                expect(Array.from(control.data, Number)).toEqual(expected[index][1]);
            });
            const again = runtime.makeControls(source);
            runtime.inputNames.forEach((name: string) =>
                expect(again[name].data).not.toBe(controls[name].data),
            );
            expect(
                Object.values(source).every((tensor) => tensor.dispose.mock.calls.length === 0),
            ).toBe(true);
        },
    );

    it("embeds as a self-contained browser factory without imports, networking or external closures", () => {
        const runtime = runInNewContext(`(${createQwen3Vl2bGenerationRuntime.toString()})()`, {
            BigInt64Array,
        });
        expect(runtime.inputNames.length).toBe(8);
        expect(
            Array.from(runtime.makeControls(feeds()).__openchat_hostmeta_total_vector.data),
        ).toEqual([604n]);
        expect(Object.isFrozen(runtime)).toBe(true);
        expect(
            runtime.inputMetadata.every(
                (item: InputMetadata) => Object.isFrozen(item) && Object.isFrozen(item.shape),
            ),
        ).toBe(true);
    });

    it("forwards all original tensor objects and run arguments, then disposes only its eight controls", async () => {
        const runtime = createQwen3Vl2bGenerationRuntime(),
            allControls: Tensor[] = [];
        for (const [E, I, P] of [
            [604, 0, 0],
            [0, 1, 604],
            [0, 1, 605],
        ]) {
            const source = feeds(E, I, P),
                result = outputs(E + I + P),
                args = { tag: "unchanged" };
            const returned = await runtime.run(
                source,
                async (augmented: Feeds, forwarded: unknown) => {
                    expect(forwarded).toBe(args);
                    expect(Object.keys(augmented).length).toBe(71);
                    for (const [name, value] of Object.entries(source))
                        expect(augmented[name]).toBe(value);
                    allControls.push(...runtime.inputNames.map((name: string) => augmented[name]));
                    return result;
                },
                [args],
            );
            expect(returned).toBe(result);
            expect(
                Object.values(result).every((tensor) => tensor.dispose.mock.calls.length === 0),
            ).toBe(true);
            expect(
                Object.values(source).every((tensor) => tensor.dispose.mock.calls.length === 0),
            ).toBe(true);
        }
        expect(allControls.length).toBe(24);
        expect(allControls.every((tensor) => tensor.dispose.mock.calls.length === 1)).toBe(true);
    });

    it.each([
        (source: Feeds) => {
            source.inputs_embeds.dims[0] = 2;
        },
        (source: Feeds) => {
            source.inputs_embeds.dims[1] = 0;
        },
        (source: Feeds) => {
            source.inputs_embeds.dims[1] = 1025;
        },
        (source: Feeds) => {
            source.inputs_embeds.dims[1] = -0;
        },
        (source: Feeds) => {
            source.attention_mask.dims[1]--;
        },
        (source: Feeds) => {
            source.position_ids.type = "float32";
        },
        (source: Feeds) => {
            source["past_key_values.27.value"].dims[2] = 1;
        },
        (source: Feeds) => {
            delete source["past_key_values.17.key"];
        },
        (source: Feeds) => {
            delete source.__openchat_deepstack_2;
        },
        (source: Feeds) => {
            source.__openchat_hostmeta_total_vector = new Tensor(
                "int64",
                new BigInt64Array([604n]),
                [1],
            );
        },
    ])(
        "rejects invalid actual feeds before calling native code and latches failure",
        async (mutate) => {
            const runtime = createQwen3Vl2bGenerationRuntime(),
                source = feeds(),
                execute = vi.fn();
            mutate(source);
            await expect(runtime.run(source, execute)).rejects.toThrow();
            await expect(runtime.run(feeds(), execute)).rejects.toThrow(/failed/);
            expect(execute).not.toHaveBeenCalled();
            expect(
                Object.values(source).every((tensor) => tensor.dispose.mock.calls.length === 0),
            ).toBe(true);
        },
    );

    it("rejects cached-first, stale cache, non-single-token decode and different tensor constructors", async () => {
        for (const bad of [feeds(0, 1, 0), feeds(0, 1, 604)]) {
            await expect(createQwen3Vl2bGenerationRuntime().run(bad, vi.fn())).rejects.toThrow(
                /prefill/,
            );
        }
        for (const bad of [feeds(0, 1, 603), feeds(0, 2, 604), feeds(1, 0, 604)]) {
            const runtime = createQwen3Vl2bGenerationRuntime();
            await runtime.run(feeds(), async () => outputs(604));
            const execute = vi.fn();
            await expect(runtime.run(bad, execute)).rejects.toThrow(/continuity/);
            expect(execute).not.toHaveBeenCalled();
        }
        const runtime = createQwen3Vl2bGenerationRuntime();
        await runtime.run(feeds(), async () => outputs(604));
        const source = feeds(0, 1, 604);
        class DifferentTensor extends Tensor {}
        source.inputs_embeds = new DifferentTensor("float32", "learned", [1, 0, 2048]);
        await expect(runtime.run(source, vi.fn())).rejects.toThrow(/constructor/);
    });

    it.each([
        "logits-shape",
        "logits-type",
        "cache-shape",
        "extra-output",
        "aliased-output",
        "mutated-control",
    ])("fails and cleans up returned outputs for %s", async (problem) => {
        const runtime = createQwen3Vl2bGenerationRuntime(),
            source = feeds(),
            result = outputs(604);
        const retained = Object.values(result),
            controls: Tensor[] = [];
        const native = async (augmented: Feeds) => {
            controls.push(...runtime.inputNames.map((name: string) => augmented[name]));
            if (problem === "logits-shape") result.logits.dims[1] = 604;
            if (problem === "logits-type") result.logits.type = "float16";
            if (problem === "cache-shape") result["present.27.value"].dims[2]--;
            if (problem === "extra-output")
                result.unexpected = new Tensor("float32", "learned", [1]);
            if (problem === "aliased-output") result.logits = source.inputs_embeds;
            if (problem === "mutated-control") controls[0].data[0] = 0n;
            return result;
        };
        await expect(runtime.run(source, native)).rejects.toThrow();
        expect(controls.every((tensor) => tensor.dispose.mock.calls.length === 1)).toBe(true);
        for (const tensor of Object.values(result)) {
            expect(tensor.dispose).toHaveBeenCalledTimes(
                Object.values(source).includes(tensor) ? 0 : 1,
            );
        }
        // The fake callback retains an output it did not return; ownership never transferred.
        if (problem === "aliased-output") expect(retained[0].dispose).not.toHaveBeenCalled();
        await expect(runtime.run(feeds(), vi.fn())).rejects.toThrow(/failed/);
    });

    it("does not release native inputs early when retired during an in-flight call", async () => {
        const runtime = createQwen3Vl2bGenerationRuntime(),
            result = outputs(604),
            controls: Tensor[] = [];
        let finish!: (value: Feeds) => void;
        const gate = new Promise<Feeds>((resolve) => {
            finish = resolve;
        });
        const pending = runtime.run(feeds(), (augmented: Feeds) => {
            controls.push(...runtime.inputNames.map((name: string) => augmented[name]));
            return gate;
        });
        await expect(runtime.run(feeds(), vi.fn())).rejects.toThrow(/Concurrent/);
        let retirementFinished = false;
        const retirement = runtime.retire().then(() => {
            retirementFinished = true;
        });
        await Promise.resolve();
        expect(retirementFinished).toBe(false);
        expect(controls.every((tensor) => tensor.dispose.mock.calls.length === 0)).toBe(true);
        finish(result);
        await expect(pending).rejects.toThrow(/retired/);
        await retirement;
        expect(retirementFinished).toBe(true);
        expect(controls.every((tensor) => tensor.dispose.mock.calls.length === 1)).toBe(true);
        expect(
            Object.values(result).every((tensor) => tensor.dispose.mock.calls.length === 1),
        ).toBe(true);
    });

    it("settles retirement after invalid feed getters throw, without calling native code", async () => {
        const runtime = createQwen3Vl2bGenerationRuntime(),
            source = feeds(),
            execute = vi.fn();
        Object.defineProperty(source, "inputs_embeds", {
            get: () => {
                throw new Error("feed unavailable");
            },
            enumerable: true,
        });
        await expect(runtime.run(source, execute)).rejects.toThrow("feed unavailable");
        await expect(runtime.retire()).resolves.toBeUndefined();
        expect(execute).not.toHaveBeenCalled();
    });

    it("cleans partially constructed controls without touching caller tensors", async () => {
        const runtime = createQwen3Vl2bGenerationRuntime(),
            source = feeds();
        const constructed: Tensor[] = [];
        class FailingTensor extends Tensor {
            constructor(type: string, value: BigInt64Array | "learned", dims: number[]) {
                if (value !== "learned" && constructed.length === 3)
                    throw new Error("allocation failed");
                super(type, value, dims);
                if (value !== "learned") constructed.push(this);
            }
        }
        source.inputs_embeds = new FailingTensor("float32", "learned", [1, 604, 2048]);
        const execute = vi.fn();
        await expect(runtime.run(source, execute)).rejects.toThrow("allocation failed");
        expect(execute).not.toHaveBeenCalled();
        expect(constructed).toHaveLength(3);
        expect(constructed.every((tensor) => tensor.dispose.mock.calls.length === 1)).toBe(true);
        expect(
            Object.values(source).every((tensor) => tensor.dispose.mock.calls.length === 0),
        ).toBe(true);
        await expect(runtime.run(feeds(), execute)).rejects.toThrow(/failed/);
    });

    it.each([new Error("native failed"), undefined, null, 0])(
        "preserves a native error while attempting every owned cleanup: %s",
        async (primary) => {
            const runtime = createQwen3Vl2bGenerationRuntime(),
                source = feeds(),
                controls: Tensor[] = [];
            await expect(
                runtime.run(source, async (augmented: Feeds) => {
                    controls.push(...runtime.inputNames.map((name: string) => augmented[name]));
                    controls[0].dispose.mockImplementation(() => {
                        throw new Error("cleanup failed");
                    });
                    throw primary;
                }),
            ).rejects.toBe(primary);
            expect(controls.every((tensor) => tensor.dispose.mock.calls.length === 1)).toBe(true);
            expect(
                Object.values(source).every((tensor) => tensor.dispose.mock.calls.length === 0),
            ).toBe(true);
        },
    );

    it.each([new Error("cleanup failed"), undefined, null, 0])(
        "rejects cleanup failure even after a native success and discards the unusable outputs: %s",
        async (cleanupFailure) => {
            const runtime = createQwen3Vl2bGenerationRuntime(),
                result = outputs(604),
                controls: Tensor[] = [];
            await expect(
                runtime.run(feeds(), async (augmented: Feeds) => {
                    controls.push(...runtime.inputNames.map((name: string) => augmented[name]));
                    controls[0].dispose.mockImplementation(() => {
                        throw cleanupFailure;
                    });
                    return result;
                }),
            ).rejects.toBe(cleanupFailure);
            expect(controls.every((tensor) => tensor.dispose.mock.calls.length === 1)).toBe(true);
            expect(
                Object.values(result).every((tensor) => tensor.dispose.mock.calls.length === 1),
            ).toBe(true);
            await expect(runtime.run(feeds(), vi.fn())).rejects.toThrow(/failed/);
        },
    );

    it("enforces the existing 96-call output cap without shrinking the 1024 context", async () => {
        const runtime = createQwen3Vl2bGenerationRuntime();
        await runtime.run(feeds(929, 0, 0), async () => outputs(929));
        for (let index = 0; index < 95; index++) {
            await runtime.run(feeds(0, 1, 929 + index), async () => outputs(930 + index));
        }
        await expect(runtime.run(feeds(0, 1, 1024), vi.fn())).rejects.toThrow(/exhausted/);
        await expect(
            createQwen3Vl2bGenerationRuntime().run(feeds(1025), vi.fn()),
        ).rejects.toThrow();
    });
});
