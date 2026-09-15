import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { createQwen3Vl2bVisionSession } from "../../transformersWebGpuQwenVisionSession.mjs";
import { createQwen3Vl2bVisionGeometryRuntime } from "../../transformersWebGpuQwenVisionGeometry.mjs";

type Values = Float32Array | BigInt64Array | "learned";
class Tensor {
    location = "cpu";
    dispose = vi.fn();
    constructor(
        public type: string,
        public value: Values,
        public dims: number[],
    ) {}
    get data(): Float32Array | BigInt64Array {
        if (this.value === "learned") throw new Error("Learned tensor data readback forbidden");
        return this.value;
    }
}
type Feeds = Record<string, Tensor>;
const names = ["image_features", ...[0, 1, 2].map((i) => `__openchat_deepstack_features_${i}`)];
function feeds(h = 16, w = 16): Feeds {
    return {
        pixel_values: new Tensor("float32", "learned", [h * w, 1536]),
        image_grid_thw: new Tensor("int64", BigInt64Array.from([1, h, w], BigInt), [1, 3]),
    };
}
function outputs(patches = 256): Feeds {
    return Object.fromEntries(
        names.map((name) => [name, new Tensor("float32", "learned", [patches / 4, 2048])]),
    );
}
function setup(h = 16, w = 16) {
    const geometry = createQwen3Vl2bVisionGeometryRuntime();
    const source = feeds(h, w),
        result = outputs(h * w);
    const inputMetadata = [
        { name: "pixel_values", type: "float32", shape: ["num_patches", 1536] },
        { name: "image_grid_thw", type: "int64", shape: ["num_images", 3] },
        ...geometry.inputMetadata,
    ].map((entry) => ({
        ...entry,
        isTensor: true,
        shape: [...entry.shape],
    }));
    const raw = {
        inputNames: inputMetadata.map((entry) => entry.name),
        inputMetadata,
        outputNames: [...names],
        outputMetadata: names.map((name) => ({
            name,
            type: "float32",
            isTensor: true,
            shape: ["num_features", 2048],
        })),
        config: {
            name: "vision_encoder",
            externalData: [{ path: "unchanged", data: "owned externally" }],
        },
        run: vi.fn(async (..._args: unknown[]): Promise<Feeds> => result),
        release: vi.fn(async () => undefined),
    };
    return { geometry, source, result, raw };
}
function controlsOf(
    geometry: ReturnType<typeof createQwen3Vl2bVisionGeometryRuntime>,
    augmented: Feeds,
): Tensor[] {
    return geometry.inputNames.map((name: string) => augmented[name]);
}

describe("Qwen vision-only geometry session facade", () => {
    it("keeps exactly two public inputs and all four outputs without changing external config", () => {
        const { raw, geometry } = setup();
        const facade = createQwen3Vl2bVisionSession(raw, geometry);
        expect(facade.inputNames).toEqual(["pixel_values", "image_grid_thw"]);
        expect(facade.inputMetadata).toEqual(raw.inputMetadata.slice(0, 2));
        expect(facade.inputMetadata[0]).not.toBe(raw.inputMetadata[0]);
        expect(facade.inputMetadata[0].shape).not.toBe(raw.inputMetadata[0].shape);
        expect(facade.outputNames).toEqual(names);
        expect(facade.outputMetadata).toEqual(raw.outputMetadata);
        expect(facade.config).toBe(raw.config);
        expect(Object.isFrozen(facade)).toBe(true);
        expect(Object.isFrozen(facade.inputMetadata[0].shape)).toBe(true);
        expect(raw.inputNames).toHaveLength(15);
        expect(raw.run).not.toHaveBeenCalled();
        expect(raw.release).not.toHaveBeenCalled();
    });

    it.each([
        [32, 20],
        [22, 28],
        [16, 16],
    ])("forwards original feeds and arguments with 13 exact controls at %i x %i", async (h, w) => {
        const { raw, geometry, source, result } = setup(h, w);
        const expected = geometry.makeControls(source),
            controls: Tensor[] = [];
        const fetches = ["image_features"],
            options = { tag: "unchanged" };
        raw.run.mockImplementation(async function (
            this: unknown,
            augmented: unknown,
            ...rest: unknown[]
        ) {
            expect(this).toBe(raw);
            const tensors = augmented as Feeds;
            expect(tensors.pixel_values).toBe(source.pixel_values);
            expect(tensors.image_grid_thw).toBe(source.image_grid_thw);
            expect(Object.keys(tensors)).toEqual(raw.inputNames);
            expect(rest).toEqual([fetches, options]);
            expect(rest[0]).toBe(fetches);
            expect(rest[1]).toBe(options);
            controls.push(...controlsOf(geometry, tensors));
            geometry.inputNames.forEach((name: string) => {
                const tensor = tensors[name],
                    control = expected[name];
                expect(tensor.type).toBe(control.type);
                expect(tensor.dims).toEqual(control.dims);
                expect(tensor.data).toEqual(control.data);
                expect(tensor.data).not.toBe(control.data);
                expect(tensor.dispose).not.toHaveBeenCalled();
            });
            return result;
        });
        const facade = createQwen3Vl2bVisionSession(raw, geometry);
        expect(await facade.run(source, fetches, options)).toBe(result);
        expect(controls).toHaveLength(13);
        expect(controls.every((tensor) => tensor.dispose.mock.calls.length === 1)).toBe(true);
        expect(
            [...Object.values(source), ...Object.values(result)].every(
                (tensor) => tensor.dispose.mock.calls.length === 0,
            ),
        ).toBe(true);
        await expect(facade.run(source)).rejects.toThrow(/Repeated/);
        await facade.release();
        expect(raw.release).toHaveBeenCalledTimes(1);
    });

    it("embeds as an import-free browser factory", async () => {
        const { raw, geometry, source, result } = setup();
        const create = runInNewContext(`(${createQwen3Vl2bVisionSession.toString()})`, {
            Float32Array,
            BigInt64Array,
            Uint8Array,
        });
        const facade = create(raw, geometry);
        expect(await facade.run(source)).toBe(result);
        await facade.release();
        expect(raw.release).toHaveBeenCalledOnce();
    });

    it.each([
        "private-name",
        "private-type",
        "private-shape",
        "private-tensor",
        "public-shape",
        "output-name",
        "output-shape",
        "output-count",
    ])("rejects changed raw metadata without acquiring session ownership: %s", (problem) => {
        const { raw, geometry } = setup();
        if (problem === "private-name") raw.inputNames[2] = "unexpected";
        if (problem === "private-type") raw.inputMetadata[2].type = "float32";
        if (problem === "private-shape") raw.inputMetadata[2].shape = [640];
        if (problem === "private-tensor") raw.inputMetadata[2].isTensor = false;
        if (problem === "public-shape") raw.inputMetadata[0].shape[1] = 2048;
        if (problem === "output-name") raw.outputNames[0] = "unexpected";
        if (problem === "output-shape") raw.outputMetadata[0].shape[0] = "other";
        if (problem === "output-count") raw.outputMetadata.pop();
        expect(() => createQwen3Vl2bVisionSession(raw, geometry)).toThrow();
        expect(raw.run).not.toHaveBeenCalled();
        expect(raw.release).not.toHaveBeenCalled();
    });

    it.each([
        "extra",
        "missing",
        "pixel-type",
        "pixel-shape",
        "grid-shape",
        "grid-gpu",
        "grid-values",
        "getter",
    ])("rejects invalid feeds before native execution and still releases: %s", async (problem) => {
        const { raw, geometry, source } = setup();
        if (problem === "extra") source.extra = source.pixel_values;
        if (problem === "missing") delete source.image_grid_thw;
        if (problem === "pixel-type") source.pixel_values.type = "float16";
        if (problem === "pixel-shape") source.pixel_values.dims[0]++;
        if (problem === "grid-shape") source.image_grid_thw.dims = [3];
        if (problem === "grid-gpu") source.image_grid_thw.location = "gpu-buffer";
        if (problem === "grid-values")
            source.image_grid_thw.value = BigInt64Array.from([1, 34, 22], BigInt);
        if (problem === "getter")
            Object.defineProperty(source, "pixel_values", {
                get: () => {
                    throw new Error("feed unavailable");
                },
                enumerable: true,
            });
        const facade = createQwen3Vl2bVisionSession(raw, geometry);
        await expect(facade.run(source)).rejects.toThrow();
        await expect(facade.run(feeds())).rejects.toThrow(/Repeated/);
        await facade.release();
        expect(raw.run).not.toHaveBeenCalled();
        expect(raw.release).toHaveBeenCalledOnce();
    });

    it.each([
        "type",
        "shape",
        "missing",
        "extra",
        "alias",
        "caller",
        "int64-control",
        "signed-zero-control",
    ])("cleans returned outputs and controls after %s failure", async (problem) => {
        const { raw, geometry, source, result } = setup(),
            controls: Tensor[] = [];
        raw.run.mockImplementation(async (value: unknown) => {
            controls.push(...controlsOf(geometry, value as Feeds));
            if (problem === "type") result.image_features.type = "float16";
            if (problem === "shape") result.image_features.dims = [256, 2048];
            if (problem === "missing") delete result[names[3]];
            if (problem === "extra") result.extra = new Tensor("float32", "learned", [1]);
            if (problem === "alias") result[names[3]] = result[names[2]];
            if (problem === "caller") result.image_features = source.pixel_values;
            if (problem === "int64-control") (controls[0].data as BigInt64Array)[0] = 99n;
            if (problem === "signed-zero-control") {
                const values = controls.find((tensor) => tensor.type === "float32")!
                    .data as Float32Array;
                expect(Object.is(values[0], 0)).toBe(true);
                values[0] = -0;
            }
            return result;
        });
        const facade = createQwen3Vl2bVisionSession(raw, geometry);
        await expect(facade.run(source)).rejects.toThrow();
        expect(controls.every((tensor) => tensor.dispose.mock.calls.length === 1)).toBe(true);
        for (const tensor of new Set(Object.values(result))) {
            expect(tensor.dispose).toHaveBeenCalledTimes(
                Object.values(source).includes(tensor) ? 0 : 1,
            );
        }
        expect(
            Object.values(source).every((tensor) => tensor.dispose.mock.calls.length === 0),
        ).toBe(true);
        await facade.release();
    });

    it("drains in-flight native execution and control/output cleanup before one idempotent release", async () => {
        const { raw, geometry, source, result } = setup(),
            controls: Tensor[] = [];
        let finish!: (result: Feeds) => void;
        raw.run.mockImplementation((value: unknown) => {
            controls.push(...controlsOf(geometry, value as Feeds));
            return new Promise((resolve) => {
                finish = resolve;
            });
        });
        raw.release.mockImplementation(async () => {
            expect(controls.every((tensor) => tensor.dispose.mock.calls.length === 1)).toBe(true);
            expect(
                Object.values(result).every((tensor) => tensor.dispose.mock.calls.length === 1),
            ).toBe(true);
        });
        const facade = createQwen3Vl2bVisionSession(raw, geometry),
            pending = facade.run(source);
        const failed = expect(pending).rejects.toThrow(/retired/);
        await expect(facade.run(source)).rejects.toThrow(/concurrent/);
        const first = facade.release(),
            second = facade.release();
        expect(second).toBe(first);
        await Promise.resolve();
        expect(raw.release).not.toHaveBeenCalled();
        expect(controls.every((tensor) => tensor.dispose.mock.calls.length === 0)).toBe(true);
        finish(result);
        await failed;
        await first;
        expect(raw.release).toHaveBeenCalledOnce();
        expect(facade.release()).toBe(first);
        await expect(facade.run(source)).rejects.toThrow(/retired/);
    });

    it("releases even before inference and preserves a raw release failure without retrying", async () => {
        const { raw, geometry, source } = setup(),
            failure = new Error("release failed");
        raw.release.mockRejectedValue(failure);
        const facade = createQwen3Vl2bVisionSession(raw, geometry),
            pending = facade.release();
        await expect(pending).rejects.toBe(failure);
        await expect(facade.release()).rejects.toBe(failure);
        await expect(facade.run(source)).rejects.toThrow(/retired/);
        expect(raw.release).toHaveBeenCalledOnce();
        expect(raw.run).not.toHaveBeenCalled();
    });

    it("cleans partially constructed controls and retains caller ownership", async () => {
        const { raw, geometry, source } = setup(),
            allocated: Tensor[] = [];
        class FailingTensor extends Tensor {
            constructor(type: string, value: Values, dims: number[]) {
                if (value !== "learned" && allocated.length === 3)
                    throw new Error("allocation failed");
                super(type, value, dims);
                if (value !== "learned") allocated.push(this);
            }
        }
        source.pixel_values = new FailingTensor("float32", "learned", [256, 1536]);
        const facade = createQwen3Vl2bVisionSession(raw, geometry);
        await expect(facade.run(source)).rejects.toThrow("allocation failed");
        expect(allocated).toHaveLength(3);
        expect(allocated.every((tensor) => tensor.dispose.mock.calls.length === 1)).toBe(true);
        expect(
            Object.values(source).every((tensor) => tensor.dispose.mock.calls.length === 0),
        ).toBe(true);
        await facade.release();
        expect(raw.run).not.toHaveBeenCalled();
    });

    it.each(
        [false, true].flatMap((nativeFails) =>
            [new Error("operation failed"), undefined, null, 0].map((failure) => ({
                nativeFails,
                failure,
            })),
        ),
    )(
        "preserves primary native errors and attempts every cleanup (native fails=%s)",
        async ({ nativeFails, failure }) => {
            const { raw, geometry, source, result } = setup(),
                controls: Tensor[] = [];
            const nativeError = failure,
                cleanupError = nativeFails ? new Error("control cleanup failed") : failure;
            raw.run.mockImplementation(async (value: unknown) => {
                controls.push(...controlsOf(geometry, value as Feeds));
                controls[0].dispose.mockImplementation(() => {
                    throw cleanupError;
                });
                if (nativeFails) throw nativeError;
                return result;
            });
            raw.release.mockRejectedValue(new Error("secondary release failed"));
            const facade = createQwen3Vl2bVisionSession(raw, geometry);
            await expect(facade.run(source)).rejects.toBe(nativeFails ? nativeError : cleanupError);
            expect(controls.every((tensor) => tensor.dispose.mock.calls.length === 1)).toBe(true);
            expect(
                Object.values(source).every((tensor) => tensor.dispose.mock.calls.length === 0),
            ).toBe(true);
            if (!nativeFails)
                expect(
                    Object.values(result).every((tensor) => tensor.dispose.mock.calls.length === 1),
                ).toBe(true);
            await expect(facade.release()).rejects.toBe(nativeFails ? nativeError : cleanupError);
            expect(raw.release).toHaveBeenCalledOnce();
        },
    );
});
