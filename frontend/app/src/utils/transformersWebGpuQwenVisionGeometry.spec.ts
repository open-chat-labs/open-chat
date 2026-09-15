// @vitest-environment node
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { createQwen3Vl2bVisionGeometryRuntime } from "../../transformersWebGpuQwenVisionGeometry.mjs";

type NativeGeometryCase = {
    grid: number[];
    patches: number;
    controls: {
        type: "int64" | "float32";
        dims: number[];
        bytes: number;
        sha256: string;
    }[];
};
const fixture = JSON.parse(
    readFileSync(
        path.resolve(import.meta.dirname, "fixtures/qwenVisionGeometry.native.json"),
        "utf8",
    ),
);
const nativeCases: NativeGeometryCase[] = fixture.cases;
const hash = (data: ArrayBufferView) =>
    createHash("sha256")
        .update(Buffer.from(data.buffer, data.byteOffset, data.byteLength))
        .digest("hex");
const feeds = (grid = [1, 32, 20]): any => ({
    pixel_values: {
        type: "float32",
        dims: [grid[1] * grid[2], 1536],
        get data() {
            throw new Error("Pixel/learned data read forbidden");
        },
        get location() {
            throw new Error("Pixel location read unnecessary");
        },
        getData() {
            throw new Error("No GPU readback");
        },
    },
    image_grid_thw: {
        type: "int64",
        dims: [1, 3],
        location: "cpu",
        data: BigInt64Array.from(grid, BigInt),
    },
});
const runtime = createQwen3Vl2bVisionGeometryRuntime();

describe("Qwen vision fixed geometry (no model runtime)", () => {
    it("retains independently recorded native provenance and all 55 admitted grids", () => {
        expect(fixture.provenance.receiptSha256).toBe(
            "0e1696d26a286a768cf6f12989a260ac4f8c471f1ae67f116a4c89abd17a5b12",
        );
        expect(fixture.provenance.originalGeometryGraphSha256).toBe(
            "9bf6a1b6311458154eaf5a11d6ebe95bd7f449036958737d4c3ee677e16a7755",
        );
        expect(fixture.provenance.comparison).toEqual({
            absoluteTolerance: 0,
            relativeTolerance: 0,
            elementwiseExact: true,
            byteEquality: true,
            cases: 55,
            tensors: 715,
        });
        const admitted = [];
        for (let h = 16; h <= 32; h += 2)
            for (let w = 16; w <= 32; w += 2) if (h * w <= 640) admitted.push([1, h, w]);
        expect(fixture.cases.map((item: any) => item.grid)).toEqual(admitted);
        expect(runtime.inputMetadata).toEqual(fixture.boundary);
        expect(runtime.inputNames).toEqual(fixture.boundary.map((item: any) => item.name));
        expect(runtime.inputNames.length).toBe(13);
    });

    it.each(nativeCases)("matches every native boundary byte for grid $grid", (expected) => {
        const source = feeds(expected.grid),
            gridBefore = source.image_grid_thw.data.slice();
        const admission = runtime.inspectDimensions(source);
        expect(admission).toEqual({
            grid: expected.grid,
            patches: expected.patches,
            pixelDims: [expected.patches, 1536],
        });
        const controls = runtime.makeControls(source);
        expect(Object.keys(controls)).toEqual(runtime.inputNames);
        let bytes = 0;
        for (const [index, name] of runtime.inputNames.entries()) {
            const actual = controls[name],
                reference = expected.controls[index];
            expect(actual.type).toBe(reference.type);
            expect(actual.dims).toEqual(reference.dims);
            expect(actual.data.byteLength).toBe(reference.bytes);
            expect(hash(actual.data)).toBe(reference.sha256);
            expect(actual.data).toBeInstanceOf(
                actual.type === "int64" ? BigInt64Array : Float32Array,
            );
            bytes += actual.data.byteLength;
        }
        const p = expected.patches;
        expect(bytes).toBe(4 * p * p + 72 * p + 4 * Math.max(...expected.grid));
        expect(controls[runtime.inputNames[4]].dims).toEqual([1, 1, p, p]);
        expect(controls[runtime.inputNames[4]].data.every((v: number) => v === 0)).toBe(true);
        expect(source.image_grid_thw.data).toEqual(gridBefore);
    });

    it("is a self-contained browser factory without protobuf, imports, downloads or external closures", () => {
        const sandbox = runInNewContext(
            "(" + createQwen3Vl2bVisionGeometryRuntime.toString() + ")()",
            {
                BigInt64Array,
                Float32Array,
                Uint8Array,
                DataView,
            },
        );
        const result = sandbox.makeControls(feeds());
        expect(sandbox.inputNames).toEqual(runtime.inputNames);
        expect(hash(result[runtime.inputNames[4]].data)).toBe(
            fixture.cases.at(-1).controls[4].sha256,
        );
        expect(Object.isFrozen(sandbox)).toBe(true);
        expect(Object.isFrozen(sandbox.inputNames)).toBe(true);
        expect(
            sandbox.inputMetadata.every(
                (item: any) => Object.isFrozen(item) && Object.isFrozen(item.shape),
            ),
        ).toBe(true);
    });

    it("owns fresh output arrays, preserves full frame order and cannot be poisoned by previous outputs", () => {
        const source = feeds(),
            a = runtime.makeControls(source);
        const pristine = Object.fromEntries(
            Object.entries(a).map(([name, t]: any) => [name, hash(t.data)]),
        );
        Object.values(a).forEach((t: any) => {
            t.data.fill(t.type === "int64" ? 999n : 999);
            t.dims.fill(1);
        });
        const b = runtime.makeControls(source),
            c = createQwen3Vl2bVisionGeometryRuntime().makeControls(source);
        runtime.inputNames.forEach((name: string) => {
            expect(b[name].data).not.toBe(a[name].data);
            expect(b[name].data).not.toBe(c[name].data);
            expect(hash(b[name].data)).toBe(pristine[name]);
            expect(hash(c[name].data)).toBe(pristine[name]);
        });
        expect(Array.from(b[runtime.inputNames[3]].data)).toEqual(
            Array.from({ length: 640 }, (_, i) => BigInt(i)),
        );
        const other = feeds([1, 20, 32]);
        expect(hash(runtime.makeControls(other)[runtime.inputNames[0]].data)).not.toBe(
            pristine[runtime.inputNames[0]],
        );
    });

    it.each([
        (x: any) => {
            x.pixel_values.type = "float16";
        },
        (x: any) => {
            x.pixel_values.dims = [640, 1535];
        },
        (x: any) => {
            x.pixel_values.dims = [639, 1536];
        },
        (x: any) => {
            x.pixel_values.dims = [-0, 1536];
        },
        (x: any) => {
            x.pixel_values.dims = [NaN, 1536];
        },
        (x: any) => {
            x.image_grid_thw.type = "int32";
        },
        (x: any) => {
            x.image_grid_thw.dims = [3];
        },
        (x: any) => {
            x.image_grid_thw.dims = [2, 3];
        },
        (x: any) => {
            x.image_grid_thw.data = new BigInt64Array([2n, 32n, 20n]);
        },
        (x: any) => {
            x.image_grid_thw.data = new BigInt64Array([1n, 34n, 22n]);
            x.pixel_values.dims[0] = 748;
        },
        (x: any) => {
            x.image_grid_thw.data = new BigInt64Array([1n, 32n, 32n]);
            x.pixel_values.dims[0] = 1024;
        },
        (x: any) => {
            x.image_grid_thw.data = new BigInt64Array([1n, 31n, 20n]);
        },
        (x: any) => {
            x.image_grid_thw.data = new BigInt64Array([1n, 14n, 20n]);
        },
        (x: any) => {
            x.image_grid_thw.data = new BigInt64Array([1n, 32n, 20n, 0n]);
        },
        (x: any) => {
            x.image_grid_thw.data = [1n, 32n, 20n];
        },
        (x: any) => {
            x.image_grid_thw.data = new Int32Array([1, 32, 20]);
        },
        (x: any) => {
            x.image_grid_thw.location = "gpu-buffer";
        },
        (x: any) => {
            delete x.pixel_values;
        },
        (x: any) => {
            x.extra = {};
        },
        (x: any) => {
            x[runtime.inputNames[0]] = {};
        },
    ])("rejects unqualified feed metadata before producing controls", (mutate) => {
        const source = feeds();
        mutate(source);
        expect(() => runtime.inspectDimensions(source)).toThrow();
        expect(() => runtime.makeControls(source)).toThrow();
    });

    it("refuses a GPU grid before touching its data and permits already CPU-pinned metadata", () => {
        const source = feeds();
        source.image_grid_thw.location = "gpu-buffer";
        Object.defineProperty(source.image_grid_thw, "data", {
            get: () => {
                throw new Error("Unexpected data read");
            },
        });
        expect(() => runtime.makeControls(source)).toThrow(/already be CPU/);
        const pinned = feeds();
        pinned.image_grid_thw.location = "cpu-pinned";
        expect(runtime.inspectDimensions(pinned).patches).toBe(640);
    });
});
