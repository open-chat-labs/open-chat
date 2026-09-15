// Embedded into the pinned Transformers module. This factory must remain self-contained.
// Ownership of rawSession transfers only after successful construction; the constructor's
// caller must release it if metadata admission fails.
export function createQwen3Vl2bVisionSession(rawSession, geometryRuntime) {
    const check = (condition, message) => {
        if (!condition) throw new Error("Qwen vision session: " + message);
    };
    const same = (actual, expected, label) => {
        check(
            Array.isArray(actual) &&
                actual.length === expected.length &&
                actual.every((value, index) => value === expected[index]),
            label,
        );
    };
    const publicInputs = [
        { name: "pixel_values", type: "float32", shape: ["num_patches", 1536] },
        { name: "image_grid_thw", type: "int64", shape: ["num_images", 3] },
    ];
    const outputNames = [
        "image_features",
        ...[0, 1, 2].map((index) => "__openchat_deepstack_features_" + index),
    ];
    check(
        rawSession &&
            typeof rawSession.run === "function" &&
            typeof rawSession.release === "function",
        "A native session is required",
    );
    check(
        geometryRuntime &&
            typeof geometryRuntime.inspectDimensions === "function" &&
            typeof geometryRuntime.makeControls === "function",
        "Geometry runtime missing",
    );
    const privateNames = geometryRuntime.inputNames;
    check(
        Array.isArray(privateNames) &&
            privateNames.length === 13 &&
            new Set(privateNames).size === 13 &&
            privateNames.every(
                (name) =>
                    typeof name === "string" &&
                    name.length > 0 &&
                    !publicInputs.some((input) => input.name === name),
            ),
        "Geometry input names changed",
    );
    const geometryMetadata = geometryRuntime.inputMetadata;
    check(
        Array.isArray(geometryMetadata) && geometryMetadata.length === 13,
        "Geometry metadata missing",
    );
    const privateMetadata = geometryMetadata.map((entry, index) => {
        check(
            entry &&
                entry.name === privateNames[index] &&
                ["float32", "int64"].includes(entry.type) &&
                Array.isArray(entry.shape) &&
                entry.shape.every(
                    (dim) =>
                        (Number.isSafeInteger(dim) && dim > 0) ||
                        ["num_patches", "num_tokens", "max_hw"].includes(dim),
                ),
            "Geometry metadata changed",
        );
        return { name: entry.name, type: entry.type, shape: [...entry.shape] };
    });
    const expectedInputs = [...publicInputs, ...privateMetadata];
    same(
        rawSession.inputNames,
        expectedInputs.map((entry) => entry.name),
        "Native input names changed",
    );
    check(
        Array.isArray(rawSession.inputMetadata) && rawSession.inputMetadata.length === 15,
        "Native input metadata changed",
    );
    const admitMetadata = (actual, expected) => {
        check(
            actual &&
                actual.name === expected.name &&
                actual.isTensor === true &&
                actual.type === expected.type,
            "Native tensor metadata changed",
        );
        same(actual.shape, expected.shape, "Native tensor shape changed");
    };
    rawSession.inputMetadata.forEach((entry, index) => admitMetadata(entry, expectedInputs[index]));
    same(rawSession.outputNames, outputNames, "Native output names changed");
    check(
        Array.isArray(rawSession.outputMetadata) && rawSession.outputMetadata.length === 4,
        "Native output metadata changed",
    );
    rawSession.outputMetadata.forEach((entry, index) =>
        admitMetadata(entry, {
            name: outputNames[index],
            type: "float32",
            shape: ["num_features", 2048],
        }),
    );
    const cloneMetadata = (entry) =>
        Object.freeze({ ...entry, shape: Object.freeze([...entry.shape]) });
    const inputMetadata = Object.freeze(rawSession.inputMetadata.slice(0, 2).map(cloneMetadata));
    const outputMetadata = Object.freeze(rawSession.outputMetadata.map(cloneMetadata));
    const ownedBytes = (tensor, expected) => {
        check(tensor && tensor.type === expected.type, "Control dtype changed");
        same(tensor.dims, expected.dims, "Control shape changed");
        const data = tensor.data;
        check(
            expected.type === "float32"
                ? data instanceof Float32Array
                : data instanceof BigInt64Array,
            "Control representation changed",
        );
        check(data.length === expected.dims.reduce((a, b) => a * b, 1), "Control length changed");
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    };
    let used = false,
        retired = false,
        drained = Promise.resolve(),
        releasePromise;
    let runFailed = false,
        primaryError;
    const run = async (feeds, ...args) => {
        check(!used && !retired, "Repeated, concurrent or retired vision inference");
        used = true;
        let settleRun;
        drained = new Promise((resolve) => {
            settleRun = resolve;
        });
        const owned = [],
            callers = new Set();
        let outputs,
            failed = false,
            cleanupFailed = false,
            cleanupError;
        const discardOutputs = () => {
            let values;
            try {
                values = Object.values(outputs ?? {});
            } catch {
                return;
            }
            for (const tensor of new Set(values)) {
                if (callers.has(tensor) || owned.includes(tensor)) continue;
                try {
                    tensor?.dispose?.();
                } catch {
                    /* Preserve the primary failure. */
                }
            }
        };
        try {
            check(
                feeds && typeof feeds === "object" && !Array.isArray(feeds),
                "Named feeds are required",
            );
            same(
                Object.keys(feeds).sort(),
                ["image_grid_thw", "pixel_values"],
                "Public feed names changed",
            );
            const dimensions = geometryRuntime.inspectDimensions(feeds);
            const { grid, patches, pixelDims } = dimensions;
            check(
                Array.isArray(grid) &&
                    grid.length === 3 &&
                    grid[0] === 1 &&
                    grid
                        .slice(1)
                        .every(
                            (n) => Number.isSafeInteger(n) && n >= 16 && n <= 32 && n % 2 === 0,
                        ) &&
                    patches === grid[1] * grid[2] &&
                    patches <= 640,
                "Unsupported vision dimensions",
            );
            same(pixelDims, [patches, 1536], "Geometry pixel dimensions changed");
            for (const tensor of Object.values(feeds)) callers.add(tensor);
            const augmented = { ...feeds };
            const Tensor = feeds.pixel_values.constructor;
            check(typeof Tensor === "function", "Tensor constructor missing");
            const controls = geometryRuntime.makeControls(feeds);
            check(
                controls && typeof controls === "object" && !Array.isArray(controls),
                "Controls missing",
            );
            same(
                Object.keys(controls),
                privateMetadata.map((entry) => entry.name),
                "Control names changed",
            );
            const expected = [];
            for (const metadata of privateMetadata) {
                const control = controls[metadata.name];
                const dims = metadata.shape.map((dim) =>
                    typeof dim === "number"
                        ? dim
                        : dim === "max_hw"
                          ? Math.max(grid[1], grid[2])
                          : patches,
                );
                const descriptor = { type: metadata.type, dims };
                const bytes = ownedBytes(control, descriptor);
                if (metadata.type === "float32") {
                    check(control.data.every(Number.isFinite), "Nonfinite geometry control");
                }
                const before = bytes.slice();
                const tensor = new Tensor(control.type, control.data, control.dims);
                check(
                    !callers.has(tensor) && !owned.includes(tensor),
                    "Control ownership mismatch",
                );
                owned.push(tensor);
                augmented[metadata.name] = tensor;
                const actual = ownedBytes(tensor, descriptor);
                check(
                    actual.length === before.length &&
                        actual.every((value, index) => value === before[index]),
                    "Constructed control data changed",
                );
                expected.push({ ...descriptor, bytes: before });
            }
            // No race/timeout disposes inputs while the native operation is still running.
            outputs = await rawSession.run(augmented, ...args);
            check(!retired, "Vision session retired during execution");
            check(
                outputs && typeof outputs === "object" && !Array.isArray(outputs),
                "Vision outputs missing",
            );
            same(
                Object.keys(outputs).sort(),
                [...outputNames].sort(),
                "Vision output names changed",
            );
            const values = Object.values(outputs);
            check(
                new Set(values).size === 4 &&
                    values.every((value) => !callers.has(value) && !owned.includes(value)),
                "Vision output ownership mismatch",
            );
            for (const name of outputNames) {
                const tensor = outputs[name];
                check(tensor && tensor.type === "float32", "Vision output dtype changed");
                same(tensor.dims, [patches / 4, 2048], "Vision output shape changed");
            }
            owned.forEach((tensor, index) => {
                const bytes = ownedBytes(tensor, expected[index]),
                    before = expected[index].bytes;
                check(
                    bytes.length === before.length &&
                        bytes.every((value, i) => value === before[i]),
                    "Control data changed during vision execution",
                );
            });
        } catch (error) {
            failed = runFailed = true;
            primaryError = error;
            discardOutputs();
            throw error;
        } finally {
            for (const tensor of owned) {
                try {
                    tensor.dispose();
                } catch (error) {
                    if (!cleanupFailed) cleanupError = error;
                    cleanupFailed = true;
                }
            }
            if (cleanupFailed && !failed) {
                runFailed = true;
                primaryError = cleanupError;
                discardOutputs();
            }
            settleRun();
        }
        if (cleanupFailed && !failed) throw cleanupError;
        return outputs;
    };
    const release = () => {
        retired = true;
        if (releasePromise === undefined) {
            releasePromise = (async () => {
                await drained;
                try {
                    await rawSession.release();
                } catch (error) {
                    if (runFailed) throw primaryError;
                    throw error;
                }
            })();
        }
        return releasePromise;
    };
    return Object.freeze({
        inputNames: Object.freeze(publicInputs.map((entry) => entry.name)),
        inputMetadata,
        outputNames: Object.freeze([...outputNames]),
        outputMetadata,
        config: rawSession.config,
        run,
        release,
    });
}
