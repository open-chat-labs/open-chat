// Embedded into the pinned Transformers session module. Keep this factory self-contained:
// only dimension-derived control tensors are computed here, never learned model values.
export function createQwen3Vl2bGenerationRuntime() {
    const check = (condition, message) => {
        if (!condition) throw new Error("Qwen generation metadata: " + message);
    };
    const cacheNames = Array.from({ length: 28 }, (_, layer) =>
        ["key", "value"].map((kind) => `past_key_values.${layer}.${kind}`),
    ).flat();
    const deepStackNames = [0, 1, 2].map((index) => `__openchat_deepstack_${index}`);
    const requiredNames = [
        "inputs_embeds",
        "__openchat_input_ids",
        "attention_mask",
        "position_ids",
        ...cacheNames,
    ];
    const inputNames = Object.freeze(
        [
            "rotary_expand_shape",
            "attention_bias_shape",
            "rotary_positions",
            "total_vector",
            "causal_starts",
            "causal_ends",
            "key_score_pads",
            "value_pads",
        ].map((name) => "__openchat_hostmeta_" + name),
    );
    const shapes = [[4], [4], ["batch_size", "sequence_length"], [1], [2], [2], [8], [8]];
    const inputMetadata = Object.freeze(
        inputNames.map((name, index) =>
            Object.freeze({
                name,
                type: "int64",
                shape: Object.freeze(shapes[index]),
            }),
        ),
    );
    const dimensions = (feeds, name, type, rank) => {
        const value = feeds[name];
        check(value !== null && typeof value === "object", `Missing tensor ${name}`);
        check(value.type === type, `Unexpected dtype for ${name}`);
        const dims = value.dims;
        check(Array.isArray(dims) && dims.length === rank, `Unexpected rank for ${name}`);
        check(
            dims.every((n) => Number.isSafeInteger(n) && n >= 0 && !Object.is(n, -0)),
            `Invalid dimensions for ${name}`,
        );
        return dims.slice();
    };
    const same = (actual, expected, name) => {
        check(
            actual.length === expected.length && actual.every((n, i) => n === expected[i]),
            `Incompatible dimensions for ${name}`,
        );
    };
    const inspectDimensions = (feeds) => {
        check(
            feeds !== null && typeof feeds === "object" && !Array.isArray(feeds),
            "Named raw feeds are required",
        );
        const allowed = [...requiredNames, ...deepStackNames];
        check(
            Object.keys(feeds).every((name) => allowed.includes(name)),
            "Unexpected or already-injected input",
        );
        check(
            requiredNames.every((name) => Object.hasOwn(feeds, name)),
            "A required feed is missing",
        );
        const embeds = dimensions(feeds, "inputs_embeds", "float32", 3);
        const ids = dimensions(feeds, "__openchat_input_ids", "int64", 2);
        const batch = embeds[0],
            embeddingSequence = embeds[1],
            tokenSequence = ids[1];
        const sequence = embeddingSequence + tokenSequence;
        check(
            batch === 1 && embeds[2] === 2048 && ids[0] === batch,
            "Only batch one and hidden width 2048 are supported",
        );
        check(
            embeddingSequence <= 1024 &&
                tokenSequence <= 1024 &&
                Number.isSafeInteger(sequence) &&
                sequence > 0 &&
                sequence <= 1024,
            "Invalid current sequence length",
        );
        const past = dimensions(feeds, cacheNames[0], "float32", 4)[2],
            total = past + sequence;
        check(
            Number.isSafeInteger(total) && total <= 1024,
            "Past plus current sequence exceeds 1024",
        );
        for (const name of cacheNames)
            same(dimensions(feeds, name, "float32", 4), [batch, 8, past, 128], name);
        same(dimensions(feeds, "attention_mask", "int64", 2), [batch, total], "attention_mask");
        same(dimensions(feeds, "position_ids", "int64", 3), [3, batch, sequence], "position_ids");
        const providedDeepStack = deepStackNames.filter((name) => Object.hasOwn(feeds, name));
        check(
            providedDeepStack.length === 0 || providedDeepStack.length === 3,
            "Partial DeepStack inputs",
        );
        for (const name of providedDeepStack)
            same(dimensions(feeds, name, "float32", 3), [batch, sequence, 2048], name);
        return { batch, embeddingSequence, tokenSequence, sequence, past, total };
    };
    const makeControls = (feeds) => {
        const { batch, sequence, past, total } = inspectDimensions(feeds);
        const B = BigInt(batch),
            S = BigInt(sequence),
            P = BigInt(past),
            T = BigInt(total);
        // Select rows from the current call's flattened cosine/sine cache. Do not replace
        // position_ids with these indices: its actual values can include the past offset.
        const rotary = new BigInt64Array(batch * sequence);
        for (let i = 0; i < rotary.length; i++) rotary[i] = BigInt(i);
        const descriptor = (dims, values) => ({
            type: "int64",
            dims,
            data: values instanceof BigInt64Array ? values : BigInt64Array.from(values),
        });
        const controls = [
            descriptor([4], [3n, B, 64n, 1n]),
            descriptor([4], [B, 1n, S, T]),
            descriptor([batch, sequence], rotary),
            descriptor([1], [T]),
            descriptor([2], [P, 0n]),
            descriptor([2], [T, T]),
            descriptor([8], [0n, 0n, 0n, 0n, 0n, 0n, 0n, 1024n - T]),
            descriptor([8], [0n, 0n, 0n, 0n, 0n, 0n, 1024n - T, 0n]),
        ];
        return Object.fromEntries(inputNames.map((name, index) => [name, controls[index]]));
    };

    let active = false,
        failed = false,
        retired = false,
        calls = 0,
        previous,
        Tensor;
    let drained = Promise.resolve();
    const run = async (feeds, execute, rest = []) => {
        check(
            !active && !failed && !retired && calls < 96,
            "Concurrent, failed, retired or exhausted generation",
        );
        check(typeof execute === "function" && Array.isArray(rest), "Invalid decoder callback");
        active = true;
        calls++;
        let settleRun;
        drained = new Promise((resolve) => {
            settleRun = resolve;
        });
        const owned = [],
            callerTensors = new Set();
        let outputs,
            failure = false,
            cleanupError,
            cleanupFailed = false;
        const discardOutputs = () => {
            let values;
            try {
                values = Object.values(outputs ?? {});
            } catch {
                return;
            }
            for (const tensor of new Set(values)) {
                // Even an invalid callback cannot transfer ownership of the caller's feeds.
                if (!callerTensors.has(tensor) && !owned.includes(tensor)) {
                    try {
                        tensor?.dispose?.();
                    } catch {
                        /* Preserve the primary failure. */
                    }
                }
            }
        };
        try {
            const current = inspectDimensions(feeds);
            for (const tensor of Object.values(feeds)) callerTensors.add(tensor);
            const augmented = { ...feeds };
            check(
                deepStackNames.every((name) => Object.hasOwn(feeds, name)),
                "Missing private DeepStack feeds",
            );
            if (previous === undefined) {
                check(
                    current.past === 0 &&
                        current.embeddingSequence === current.sequence &&
                        current.tokenSequence === 0,
                    "First call must be prefill",
                );
            } else {
                check(
                    current.past === previous.total &&
                        current.embeddingSequence === 0 &&
                        current.tokenSequence === 1 &&
                        current.sequence === 1,
                    "Decode cache continuity mismatch",
                );
            }
            const Constructor = feeds.inputs_embeds.constructor;
            check(
                typeof Constructor === "function" &&
                    (Tensor === undefined || Tensor === Constructor),
                "Tensor constructor changed",
            );
            Tensor = Constructor;
            const controls = makeControls(feeds),
                expected = [];
            for (const name of inputNames) {
                const control = controls[name];
                const tensor = new Tensor(control.type, control.data, control.dims);
                owned.push(tensor);
                augmented[name] = tensor;
                expected.push({ dims: [...control.dims], data: new BigInt64Array(control.data) });
            }
            // Await the real native operation, including failure, before disposing any controls.
            outputs = await execute(augmented, ...rest);
            check(!retired, "Generation retired during execution");
            check(
                outputs && typeof outputs === "object" && !Array.isArray(outputs),
                "Decoder outputs missing",
            );
            const expectedOutputs = [
                "logits",
                ...cacheNames.map((name) => name.replace("past_key_values.", "present.")),
            ];
            check(
                Object.keys(outputs).length === expectedOutputs.length &&
                    expectedOutputs.every((name) => Object.hasOwn(outputs, name)),
                "Decoder output contract changed",
            );
            check(
                new Set(Object.values(outputs)).size === expectedOutputs.length &&
                    Object.values(outputs).every(
                        (value) => !callerTensors.has(value) && !owned.includes(value),
                    ),
                "Decoder output ownership mismatch",
            );
            same(
                dimensions(outputs, "logits", "float32", 3),
                [current.batch, 1, 151936],
                "generation logits",
            );
            for (const name of expectedOutputs.slice(1)) {
                same(
                    dimensions(outputs, name, "float32", 4),
                    [current.batch, 8, current.total, 128],
                    name,
                );
            }
            for (const [index, tensor] of owned.entries()) {
                check(tensor.type === "int64", "Control dtype changed");
                same(tensor.dims, expected[index].dims, "control");
                const data = tensor.data;
                check(
                    data instanceof BigInt64Array &&
                        data.length === expected[index].data.length &&
                        data.every((n, i) => n === expected[index].data[i]),
                    "Control data changed during execution",
                );
            }
            previous = current;
        } catch (error) {
            failed = true;
            failure = true;
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
            if (cleanupFailed) {
                failed = true;
                if (!failure) discardOutputs();
            }
            active = false;
            settleRun();
        }
        if (cleanupFailed && !failure) throw cleanupError;
        return outputs;
    };
    return Object.freeze({
        inputNames,
        inputMetadata,
        inspectDimensions,
        makeControls,
        run,
        retire: () => {
            retired = true;
            // The owner must await this before releasing the native session/device. Never
            // race native execution against disposal or free its input controls early.
            return drained;
        },
    });
}
