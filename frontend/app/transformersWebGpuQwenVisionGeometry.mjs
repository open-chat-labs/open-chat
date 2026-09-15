// Fixed geometry controls for the pinned Qwen3-VL 2B vision graph.
// This module is intentionally not connected to model delivery yet.
// Native ONNX CPU reference qualified these exact 91 operators / 16 inline constants
// at all 55 admitted grids, byte-for-byte (715 boundary tensors). See the test fixture.
// Only deterministic geometry runs here; frequency/trig, learned position weights,
// image inference and all four learned outputs stay in the WebGPU graph.
// Keep the factory self-contained so it can be embedded without protobuf or Node imports.
export function createQwen3Vl2bVisionGeometryRuntime() {
    const assert = (condition, message = "Fixed geometry invariant failed") => {
        if (!condition) throw new Error("Qwen vision geometry: " + message);
    };
    assert.equal = (actual, expected, message) => assert(actual === expected, message);
    assert.deepEqual = (actual, expected, message) => {
        const equal = (a, b) =>
            Array.isArray(a) && Array.isArray(b)
                ? a.length === b.length && a.every((v, i) => equal(v, b[i]))
                : a === b;
        assert(equal(actual, expected), message);
    };
    assert.fail = (message) => {
        throw new Error("Qwen vision geometry: " + message);
    };
    const size = (dims) => dims.reduce((n, d) => n * d, 1);
    const MIN64 = -(1n << 63n),
        MAX64 = (1n << 63n) - 1n;
    const f32 = Math.fround;
    const inputMetadata = Object.freeze(
        [
            {
                name: "/model/vision_rope/h_ids/Add/output_0",
                type: "int64",
                shape: ["num_patches"],
            },
            {
                name: "/model/vision_rope/w_ids/Add/output_0",
                type: "int64",
                shape: ["num_patches"],
            },
            {
                name: "/model/vision_rope/max_range/Unsqueeze/output_0",
                type: "float32",
                shape: ["max_hw", 1],
            },
            {
                name: "/model/vision_rope/pos_ids/Unsqueeze/output_0",
                type: "int64",
                shape: [1, "num_tokens"],
            },
            {
                name: "/model/vision_rope/attn_mask/UnsqueezeBatchHead/output_0",
                type: "float32",
                shape: [1, 1, "num_patches", "num_patches"],
            },
            { name: "/model/pos_embed/idx_00/output_0", type: "int64", shape: ["num_patches"] },
            { name: "/model/pos_embed/idx_01/output_0", type: "int64", shape: ["num_patches"] },
            { name: "/model/pos_embed/idx_10/output_0", type: "int64", shape: ["num_patches"] },
            { name: "/model/pos_embed/idx_11/output_0", type: "int64", shape: ["num_patches"] },
            {
                name: "/model/pos_embed/w00_2d/output_0",
                type: "float32",
                shape: ["num_patches", 1],
            },
            {
                name: "/model/pos_embed/w01_2d/output_0",
                type: "float32",
                shape: ["num_patches", 1],
            },
            {
                name: "/model/pos_embed/w10_2d/output_0",
                type: "float32",
                shape: ["num_patches", 1],
            },
            {
                name: "/model/pos_embed/w11_2d/output_0",
                type: "float32",
                shape: ["num_patches", 1],
            },
        ].map((item) => Object.freeze({ ...item, shape: Object.freeze(item.shape) })),
    );
    const inputNames = Object.freeze(inputMetadata.map((item) => item.name));
    // Source NodeProto SHA256 d5f436653de94d90b19e708a019bcec9aadd19182e41fdddc18f5f42ce6fd450.
    // This is a closed program, not an evaluator API for supplied graphs or arbitrary operators.
    const program = [
        {
            name: "/model/vision_rope/t_vec/Slice",
            opType: "Slice",
            input: [
                "image_grid_thw",
                "/model/constants/INT64/[0]",
                "/model/constants/INT64/[1]",
                "/model/constants/INT64/[1]",
            ],
            output: "/model/vision_rope/t_vec/Slice/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/h_vec/Slice",
            opType: "Slice",
            input: [
                "image_grid_thw",
                "/model/constants/INT64/[1]",
                "/model/constants/INT64/[2]",
                "/model/constants/INT64/[1]",
            ],
            output: "/model/vision_rope/h_vec/Slice/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/w_vec/Slice",
            opType: "Slice",
            input: [
                "image_grid_thw",
                "/model/constants/INT64/[2]",
                "/model/constants/INT64/[3]",
                "/model/constants/INT64/[1]",
            ],
            output: "/model/vision_rope/w_vec/Slice/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/t_vec/Squeeze",
            opType: "Squeeze",
            input: ["/model/vision_rope/t_vec/Slice/output_0", "/model/constants/INT64/[1]"],
            output: "/model/vision_rope/t_vec/Squeeze/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/h_vec/Squeeze",
            opType: "Squeeze",
            input: ["/model/vision_rope/h_vec/Slice/output_0", "/model/constants/INT64/[1]"],
            output: "/model/vision_rope/h_vec/Squeeze/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/w_vec/Squeeze",
            opType: "Squeeze",
            input: ["/model/vision_rope/w_vec/Slice/output_0", "/model/constants/INT64/[1]"],
            output: "/model/vision_rope/w_vec/Squeeze/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/hw_vec/Mul",
            opType: "Mul",
            input: [
                "/model/vision_rope/h_vec/Squeeze/output_0",
                "/model/vision_rope/w_vec/Squeeze/output_0",
            ],
            output: "/model/vision_rope/hw_vec/Mul/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/patches_per_image/Mul",
            opType: "Mul",
            input: [
                "/model/vision_rope/t_vec/Squeeze/output_0",
                "/model/vision_rope/hw_vec/Mul/output_0",
            ],
            output: "/model/vision_rope/patches_per_image/Mul/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/offsets/CumSum",
            opType: "CumSum",
            input: [
                "/model/vision_rope/patches_per_image/Mul/output_0",
                "/model/constants/INT64/0",
            ],
            output: "/model/vision_rope/offsets/CumSum/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/offsets_sliced/Slice",
            opType: "Slice",
            input: [
                "/model/vision_rope/offsets/CumSum/output_0",
                "/model/constants/INT64/[0]",
                "/model/constants/INT64/[-1]",
                "/model/constants/INT64/[0]",
            ],
            output: "/model/vision_rope/offsets_sliced/Slice/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/starts/Concat",
            opType: "Concat",
            input: [
                "/model/constants/INT64/[0]",
                "/model/vision_rope/offsets_sliced/Slice/output_0",
            ],
            output: "/model/vision_rope/starts/Concat/output_0",
            attribute: [{ name: "axis", i: 0 }],
        },
        {
            name: "/model/vision_rope/pixel_values/Shape",
            opType: "Shape",
            input: ["pixel_values"],
            output: "/model/vision_rope/pixel_values/Shape/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/pixel_values/Gather_0",
            opType: "Gather",
            input: ["/model/vision_rope/pixel_values/Shape/output_0", "/model/constants/INT64/0"],
            output: "/model/vision_rope/pixel_values/Gather_0/output_0",
            attribute: [{ name: "axis", i: 0 }],
        },
        {
            name: "/model/vision_rope/all_p/Range",
            opType: "Range",
            input: [
                "/model/constants/INT64/0",
                "/model/vision_rope/pixel_values/Gather_0/output_0",
                "/model/constants/INT64/1",
            ],
            output: "/model/vision_rope/all_p/Range/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/all_p/Col/Unsqueeze",
            opType: "Unsqueeze",
            input: ["/model/vision_rope/all_p/Range/output_0", "/model/constants/INT64/[1]"],
            output: "/model/vision_rope/all_p/Col/Unsqueeze/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/offsets/Row/Unsqueeze",
            opType: "Unsqueeze",
            input: ["/model/vision_rope/offsets/CumSum/output_0", "/model/constants/INT64/[0]"],
            output: "/model/vision_rope/offsets/Row/Unsqueeze/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/indicator/GreaterOrEqual",
            opType: "GreaterOrEqual",
            input: [
                "/model/vision_rope/all_p/Col/Unsqueeze/output_0",
                "/model/vision_rope/offsets/Row/Unsqueeze/output_0",
            ],
            output: "/model/vision_rope/indicator/GreaterOrEqual/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/indicator/Cast",
            opType: "Cast",
            input: ["/model/vision_rope/indicator/GreaterOrEqual/output_0"],
            output: "/model/vision_rope/indicator/Cast/output_0",
            attribute: [{ name: "to", i: 7 }],
        },
        {
            name: "/model/vision_rope/image_idx/ReduceSum",
            opType: "ReduceSum",
            input: ["/model/vision_rope/indicator/Cast/output_0", "/model/constants/INT64/[1]"],
            output: "/model/vision_rope/image_idx/ReduceSum/output_0",
            attribute: [{ name: "keepdims", i: 0 }],
        },
        {
            name: "/model/vision_rope/local_start/Gather",
            opType: "Gather",
            input: [
                "/model/vision_rope/starts/Concat/output_0",
                "/model/vision_rope/image_idx/ReduceSum/output_0",
            ],
            output: "/model/vision_rope/local_start/Gather/output_0",
            attribute: [{ name: "axis", i: 0 }],
        },
        {
            name: "/model/vision_rope/local_pos/Sub",
            opType: "Sub",
            input: [
                "/model/vision_rope/all_p/Range/output_0",
                "/model/vision_rope/local_start/Gather/output_0",
            ],
            output: "/model/vision_rope/local_pos/Sub/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/h_per_patch/Gather",
            opType: "Gather",
            input: [
                "/model/vision_rope/h_vec/Squeeze/output_0",
                "/model/vision_rope/image_idx/ReduceSum/output_0",
            ],
            output: "/model/vision_rope/h_per_patch/Gather/output_0",
            attribute: [{ name: "axis", i: 0 }],
        },
        {
            name: "/model/vision_rope/w_per_patch/Gather",
            opType: "Gather",
            input: [
                "/model/vision_rope/w_vec/Squeeze/output_0",
                "/model/vision_rope/image_idx/ReduceSum/output_0",
            ],
            output: "/model/vision_rope/w_per_patch/Gather/output_0",
            attribute: [{ name: "axis", i: 0 }],
        },
        {
            name: "/model/vision_rope/hw_per_patch/Gather",
            opType: "Gather",
            input: [
                "/model/vision_rope/hw_vec/Mul/output_0",
                "/model/vision_rope/image_idx/ReduceSum/output_0",
            ],
            output: "/model/vision_rope/hw_per_patch/Gather/output_0",
            attribute: [{ name: "axis", i: 0 }],
        },
        {
            name: "/model/vision_rope/spatial_pos/Mod",
            opType: "Mod",
            input: [
                "/model/vision_rope/local_pos/Sub/output_0",
                "/model/vision_rope/hw_per_patch/Gather/output_0",
            ],
            output: "/model/vision_rope/spatial_pos/Mod/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/w_div_pp/Div",
            opType: "Div",
            input: ["/model/vision_rope/w_per_patch/Gather/output_0", "/model/constants/INT64/2"],
            output: "/model/vision_rope/w_div_pp/Div/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/merge_w/Mod",
            opType: "Mod",
            input: ["/model/vision_rope/spatial_pos/Mod/output_0", "/model/constants/INT64/2"],
            output: "/model/vision_rope/merge_w/Mod/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/sp_div_m/Div",
            opType: "Div",
            input: ["/model/vision_rope/spatial_pos/Mod/output_0", "/model/constants/INT64/2"],
            output: "/model/vision_rope/sp_div_m/Div/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/merge_h/Mod",
            opType: "Mod",
            input: ["/model/vision_rope/sp_div_m/Div/output_0", "/model/constants/INT64/2"],
            output: "/model/vision_rope/merge_h/Mod/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/sp_div_msq/Div",
            opType: "Div",
            input: ["/model/vision_rope/spatial_pos/Mod/output_0", "/model/constants/INT64/4"],
            output: "/model/vision_rope/sp_div_msq/Div/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/w_div/Mod",
            opType: "Mod",
            input: [
                "/model/vision_rope/sp_div_msq/Div/output_0",
                "/model/vision_rope/w_div_pp/Div/output_0",
            ],
            output: "/model/vision_rope/w_div/Mod/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/msq_wdiv/Mul",
            opType: "Mul",
            input: ["/model/constants/INT64/4", "/model/vision_rope/w_div_pp/Div/output_0"],
            output: "/model/vision_rope/msq_wdiv/Mul/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/h_div/Div",
            opType: "Div",
            input: [
                "/model/vision_rope/spatial_pos/Mod/output_0",
                "/model/vision_rope/msq_wdiv/Mul/output_0",
            ],
            output: "/model/vision_rope/h_div/Div/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/h_div_sc/Mul",
            opType: "Mul",
            input: ["/model/vision_rope/h_div/Div/output_0", "/model/constants/INT64/2"],
            output: "/model/vision_rope/h_div_sc/Mul/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/h_ids/Add",
            opType: "Add",
            input: [
                "/model/vision_rope/h_div_sc/Mul/output_0",
                "/model/vision_rope/merge_h/Mod/output_0",
            ],
            output: "/model/vision_rope/h_ids/Add/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/w_div_sc/Mul",
            opType: "Mul",
            input: ["/model/vision_rope/w_div/Mod/output_0", "/model/constants/INT64/2"],
            output: "/model/vision_rope/w_div_sc/Mul/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/w_ids/Add",
            opType: "Add",
            input: [
                "/model/vision_rope/w_div_sc/Mul/output_0",
                "/model/vision_rope/merge_w/Mod/output_0",
            ],
            output: "/model/vision_rope/w_ids/Add/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/max_h/ReduceMax",
            opType: "ReduceMax",
            input: ["/model/vision_rope/h_vec/Squeeze/output_0", "/model/constants/INT64/[0]"],
            output: "/model/vision_rope/max_h/ReduceMax/output_0",
            attribute: [{ name: "keepdims", i: 0 }],
        },
        {
            name: "/model/vision_rope/max_w/ReduceMax",
            opType: "ReduceMax",
            input: ["/model/vision_rope/w_vec/Squeeze/output_0", "/model/constants/INT64/[0]"],
            output: "/model/vision_rope/max_w/ReduceMax/output_0",
            attribute: [{ name: "keepdims", i: 0 }],
        },
        {
            name: "/model/vision_rope/max_hw/Max",
            opType: "Max",
            input: [
                "/model/vision_rope/max_h/ReduceMax/output_0",
                "/model/vision_rope/max_w/ReduceMax/output_0",
            ],
            output: "/model/vision_rope/max_hw/Max/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/max_range/Range",
            opType: "Range",
            input: [
                "/model/constants/INT64/0",
                "/model/vision_rope/max_hw/Max/output_0",
                "/model/constants/INT64/1",
            ],
            output: "/model/vision_rope/max_range/Range/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/max_range/Cast",
            opType: "Cast",
            input: ["/model/vision_rope/max_range/Range/output_0"],
            output: "/model/vision_rope/max_range/Cast/output_0",
            attribute: [{ name: "to", i: 1 }],
        },
        {
            name: "/model/vision_rope/max_range/Unsqueeze",
            opType: "Unsqueeze",
            input: ["/model/vision_rope/max_range/Cast/output_0", "/model/constants/INT64/[1]"],
            output: "/model/vision_rope/max_range/Unsqueeze/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/pos_ids/Unsqueeze",
            opType: "Unsqueeze",
            input: ["/model/vision_rope/all_p/Range/output_0", "/model/constants/INT64/[0]"],
            output: "/model/vision_rope/pos_ids/Unsqueeze/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/window_ids/Row/Unsqueeze",
            opType: "Unsqueeze",
            input: [
                "/model/vision_rope/image_idx/ReduceSum/output_0",
                "/model/constants/INT64/[1]",
            ],
            output: "/model/vision_rope/window_ids/Row/Unsqueeze/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/window_ids/Col/Unsqueeze",
            opType: "Unsqueeze",
            input: [
                "/model/vision_rope/image_idx/ReduceSum/output_0",
                "/model/constants/INT64/[0]",
            ],
            output: "/model/vision_rope/window_ids/Col/Unsqueeze/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/num_patches/Unsqueeze",
            opType: "Unsqueeze",
            input: [
                "/model/vision_rope/pixel_values/Gather_0/output_0",
                "/model/constants/INT64/[0]",
            ],
            output: "/model/vision_rope/num_patches/Unsqueeze/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/pair_shape/Concat",
            opType: "Concat",
            input: [
                "/model/vision_rope/num_patches/Unsqueeze/output_0",
                "/model/vision_rope/num_patches/Unsqueeze/output_0",
            ],
            output: "/model/vision_rope/pair_shape/Concat/output_0",
            attribute: [{ name: "axis", i: 0 }],
        },
        {
            name: "/model/vision_rope/window_ids/Row/Expand",
            opType: "Expand",
            input: [
                "/model/vision_rope/window_ids/Row/Unsqueeze/output_0",
                "/model/vision_rope/pair_shape/Concat/output_0",
            ],
            output: "/model/vision_rope/window_ids/Row/Expand/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/window_ids/Col/Expand",
            opType: "Expand",
            input: [
                "/model/vision_rope/window_ids/Col/Unsqueeze/output_0",
                "/model/vision_rope/pair_shape/Concat/output_0",
            ],
            output: "/model/vision_rope/window_ids/Col/Expand/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/same_window/Equal",
            opType: "Equal",
            input: [
                "/model/vision_rope/window_ids/Row/Expand/output_0",
                "/model/vision_rope/window_ids/Col/Expand/output_0",
            ],
            output: "/model/vision_rope/same_window/Equal/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/attn_mask/Where",
            opType: "Where",
            input: [
                "/model/vision_rope/same_window/Equal/output_0",
                "/model/constants/FLOAT/0.0",
                "/model/constants/FLOAT/-10000.0",
            ],
            output: "/model/vision_rope/attn_mask/Where/output_0",
            attribute: [],
        },
        {
            name: "/model/vision_rope/attn_mask/UnsqueezeBatchHead",
            opType: "Unsqueeze",
            input: ["/model/vision_rope/attn_mask/Where/output_0", "/model/constants/INT64/[0, 1]"],
            output: "/model/vision_rope/attn_mask/UnsqueezeBatchHead/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/h_ids/Float",
            opType: "Cast",
            input: ["/model/vision_rope/h_ids/Add/output_0"],
            output: "/model/pos_embed/h_ids/Float/output_0",
            attribute: [{ name: "to", i: 1 }],
        },
        {
            name: "/model/pos_embed/w_ids/Float",
            opType: "Cast",
            input: ["/model/vision_rope/w_ids/Add/output_0"],
            output: "/model/pos_embed/w_ids/Float/output_0",
            attribute: [{ name: "to", i: 1 }],
        },
        {
            name: "/model/pos_embed/h_pp/Float",
            opType: "Cast",
            input: ["/model/vision_rope/h_per_patch/Gather/output_0"],
            output: "/model/pos_embed/h_pp/Float/output_0",
            attribute: [{ name: "to", i: 1 }],
        },
        {
            name: "/model/pos_embed/w_pp/Float",
            opType: "Cast",
            input: ["/model/vision_rope/w_per_patch/Gather/output_0"],
            output: "/model/pos_embed/w_pp/Float/output_0",
            attribute: [{ name: "to", i: 1 }],
        },
        {
            name: "/model/pos_embed/h_minus_1",
            opType: "Sub",
            input: ["/model/pos_embed/h_pp/Float/output_0", "/model/constants/FLOAT/1.0"],
            output: "/model/pos_embed/h_minus_1/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/h_minus_1_clamp",
            opType: "Max",
            input: ["/model/pos_embed/h_minus_1/output_0", "/model/constants/FLOAT/1.0"],
            output: "/model/pos_embed/h_minus_1_clamp/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/h_scale",
            opType: "Div",
            input: ["/model/constants/FLOAT/47.0", "/model/pos_embed/h_minus_1_clamp/output_0"],
            output: "/model/pos_embed/h_scale/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/h_cont",
            opType: "Mul",
            input: ["/model/pos_embed/h_ids/Float/output_0", "/model/pos_embed/h_scale/output_0"],
            output: "/model/pos_embed/h_cont/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w_minus_1",
            opType: "Sub",
            input: ["/model/pos_embed/w_pp/Float/output_0", "/model/constants/FLOAT/1.0"],
            output: "/model/pos_embed/w_minus_1/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w_minus_1_clamp",
            opType: "Max",
            input: ["/model/pos_embed/w_minus_1/output_0", "/model/constants/FLOAT/1.0"],
            output: "/model/pos_embed/w_minus_1_clamp/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w_scale",
            opType: "Div",
            input: ["/model/constants/FLOAT/47.0", "/model/pos_embed/w_minus_1_clamp/output_0"],
            output: "/model/pos_embed/w_scale/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w_cont",
            opType: "Mul",
            input: ["/model/pos_embed/w_ids/Float/output_0", "/model/pos_embed/w_scale/output_0"],
            output: "/model/pos_embed/w_cont/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/h_floor_f",
            opType: "Floor",
            input: ["/model/pos_embed/h_cont/output_0"],
            output: "/model/pos_embed/h_floor_f/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w_floor_f",
            opType: "Floor",
            input: ["/model/pos_embed/w_cont/output_0"],
            output: "/model/pos_embed/w_floor_f/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/h_floor",
            opType: "Cast",
            input: ["/model/pos_embed/h_floor_f/output_0"],
            output: "/model/pos_embed/h_floor/output_0",
            attribute: [{ name: "to", i: 7 }],
        },
        {
            name: "/model/pos_embed/w_floor",
            opType: "Cast",
            input: ["/model/pos_embed/w_floor_f/output_0"],
            output: "/model/pos_embed/w_floor/output_0",
            attribute: [{ name: "to", i: 7 }],
        },
        {
            name: "/model/pos_embed/h_ceil_raw",
            opType: "Add",
            input: ["/model/pos_embed/h_floor/output_0", "/model/constants/INT64/1"],
            output: "/model/pos_embed/h_ceil_raw/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/h_ceil",
            opType: "Min",
            input: ["/model/pos_embed/h_ceil_raw/output_0", "/model/constants/INT64/47"],
            output: "/model/pos_embed/h_ceil/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w_ceil_raw",
            opType: "Add",
            input: ["/model/pos_embed/w_floor/output_0", "/model/constants/INT64/1"],
            output: "/model/pos_embed/w_ceil_raw/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w_ceil",
            opType: "Min",
            input: ["/model/pos_embed/w_ceil_raw/output_0", "/model/constants/INT64/47"],
            output: "/model/pos_embed/w_ceil/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/dh",
            opType: "Sub",
            input: ["/model/pos_embed/h_cont/output_0", "/model/pos_embed/h_floor_f/output_0"],
            output: "/model/pos_embed/dh/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/dw",
            opType: "Sub",
            input: ["/model/pos_embed/w_cont/output_0", "/model/pos_embed/w_floor_f/output_0"],
            output: "/model/pos_embed/dw/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/h_floor_ng",
            opType: "Mul",
            input: ["/model/pos_embed/h_floor/output_0", "/model/constants/INT64/48"],
            output: "/model/pos_embed/h_floor_ng/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/h_ceil_ng",
            opType: "Mul",
            input: ["/model/pos_embed/h_ceil/output_0", "/model/constants/INT64/48"],
            output: "/model/pos_embed/h_ceil_ng/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/idx_00",
            opType: "Add",
            input: ["/model/pos_embed/h_floor_ng/output_0", "/model/pos_embed/w_floor/output_0"],
            output: "/model/pos_embed/idx_00/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/idx_01",
            opType: "Add",
            input: ["/model/pos_embed/h_floor_ng/output_0", "/model/pos_embed/w_ceil/output_0"],
            output: "/model/pos_embed/idx_01/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/idx_10",
            opType: "Add",
            input: ["/model/pos_embed/h_ceil_ng/output_0", "/model/pos_embed/w_floor/output_0"],
            output: "/model/pos_embed/idx_10/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/idx_11",
            opType: "Add",
            input: ["/model/pos_embed/h_ceil_ng/output_0", "/model/pos_embed/w_ceil/output_0"],
            output: "/model/pos_embed/idx_11/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/1_minus_dh",
            opType: "Sub",
            input: ["/model/constants/FLOAT/1.0", "/model/pos_embed/dh/output_0"],
            output: "/model/pos_embed/1_minus_dh/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/1_minus_dw",
            opType: "Sub",
            input: ["/model/constants/FLOAT/1.0", "/model/pos_embed/dw/output_0"],
            output: "/model/pos_embed/1_minus_dw/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w00",
            opType: "Mul",
            input: ["/model/pos_embed/1_minus_dh/output_0", "/model/pos_embed/1_minus_dw/output_0"],
            output: "/model/pos_embed/w00/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w01",
            opType: "Mul",
            input: ["/model/pos_embed/1_minus_dh/output_0", "/model/pos_embed/dw/output_0"],
            output: "/model/pos_embed/w01/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w10",
            opType: "Mul",
            input: ["/model/pos_embed/dh/output_0", "/model/pos_embed/1_minus_dw/output_0"],
            output: "/model/pos_embed/w10/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w11",
            opType: "Mul",
            input: ["/model/pos_embed/dh/output_0", "/model/pos_embed/dw/output_0"],
            output: "/model/pos_embed/w11/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w00_2d",
            opType: "Unsqueeze",
            input: ["/model/pos_embed/w00/output_0", "/model/constants/INT64/[1]"],
            output: "/model/pos_embed/w00_2d/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w01_2d",
            opType: "Unsqueeze",
            input: ["/model/pos_embed/w01/output_0", "/model/constants/INT64/[1]"],
            output: "/model/pos_embed/w01_2d/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w10_2d",
            opType: "Unsqueeze",
            input: ["/model/pos_embed/w10/output_0", "/model/constants/INT64/[1]"],
            output: "/model/pos_embed/w10_2d/output_0",
            attribute: [],
        },
        {
            name: "/model/pos_embed/w11_2d",
            opType: "Unsqueeze",
            input: ["/model/pos_embed/w11/output_0", "/model/constants/INT64/[1]"],
            output: "/model/pos_embed/w11_2d/output_0",
            attribute: [],
        },
    ];
    // Source TensorProto SHA256 7f4e2210888b2f0fddf70502c9d2cd57b58115a2e01f8d7767d6f1c3d893f3b6.
    const inlineConstants = [
        { name: "/model/constants/INT64/[0]", type: "int64", dims: [1], hex: "0000000000000000" },
        { name: "/model/constants/INT64/[1]", type: "int64", dims: [1], hex: "0100000000000000" },
        { name: "/model/constants/INT64/[2]", type: "int64", dims: [1], hex: "0200000000000000" },
        { name: "/model/constants/INT64/[3]", type: "int64", dims: [1], hex: "0300000000000000" },
        { name: "/model/constants/INT64/0", type: "int64", dims: [], hex: "0000000000000000" },
        { name: "/model/constants/INT64/[-1]", type: "int64", dims: [1], hex: "ffffffffffffffff" },
        { name: "/model/constants/INT64/1", type: "int64", dims: [], hex: "0100000000000000" },
        { name: "/model/constants/INT64/2", type: "int64", dims: [], hex: "0200000000000000" },
        { name: "/model/constants/INT64/4", type: "int64", dims: [], hex: "0400000000000000" },
        { name: "/model/constants/FLOAT/0.0", type: "float32", dims: [], hex: "00000000" },
        { name: "/model/constants/FLOAT/-10000.0", type: "float32", dims: [], hex: "00401cc6" },
        {
            name: "/model/constants/INT64/[0, 1]",
            type: "int64",
            dims: [2],
            hex: "00000000000000000100000000000000",
        },
        { name: "/model/constants/FLOAT/1.0", type: "float32", dims: [], hex: "0000803f" },
        { name: "/model/constants/FLOAT/47.0", type: "float32", dims: [], hex: "00003c42" },
        { name: "/model/constants/INT64/47", type: "int64", dims: [], hex: "2f00000000000000" },
        { name: "/model/constants/INT64/48", type: "int64", dims: [], hex: "3000000000000000" },
    ];
    function tensor(type, dims, values) {
        assert(["float32", "int64", "bool"].includes(type));
        assert(
            dims.every((d) => Number.isSafeInteger(d) && d >= 0 && d <= 640) && dims.length <= 4,
        );
        const count = size(dims);
        assert(count <= 640 ** 2 && values.length === count, "Unbounded/wrong tensor size");
        if (type === "int64")
            assert(
                Array.from(values).every((v) => typeof v === "bigint" && v >= MIN64 && v <= MAX64),
                "INT64 overflow",
            );
        if (type === "float32")
            assert(Array.from(values).every(Number.isFinite), "Nonfinite geometry float");
        if (type === "bool")
            assert(
                Array.from(values).every((v) => v === 0 || v === 1),
                "Invalid boolean",
            );
        const Class =
            type === "float32" ? Float32Array : type === "int64" ? BigInt64Array : Uint8Array;
        return {
            type,
            dims: [...dims],
            data: values instanceof Class ? values : Class.from(values),
        };
    }
    function allocate(type, count) {
        return type === "float32"
            ? new Float32Array(count)
            : type === "int64"
              ? new BigInt64Array(count)
              : new Uint8Array(count);
    }
    function offset(index, inputDims, outputDims) {
        let result = 0,
            stride = 1;
        for (let axis = outputDims.length - 1; axis >= 0; axis--) {
            const coordinate = index % outputDims[axis];
            index = Math.floor(index / outputDims[axis]);
            const inputAxis = axis - (outputDims.length - inputDims.length);
            if (inputAxis >= 0) {
                if (inputDims[inputAxis] !== 1) result += coordinate * stride;
                stride *= inputDims[inputAxis];
            }
        }
        return result;
    }
    function broadcast(a, b) {
        const rank = Math.max(a.length, b.length),
            dims = [];
        for (let i = 0; i < rank; i++) {
            const x = a[i - rank + a.length] ?? 1,
                y = b[i - rank + b.length] ?? 1;
            assert(x === y || x === 1 || y === 1, "Invalid broadcast");
            dims.push(x === 1 ? y : x);
        }
        return dims;
    }
    function binary(a, b, op) {
        assert.equal(a.type, b.type);
        const dims = broadcast(a.dims, b.dims),
            bool = ["Equal", "GreaterOrEqual"].includes(op);
        const type = bool ? "bool" : a.type,
            out = allocate(type, size(dims));
        for (let i = 0; i < out.length; i++) {
            const x = a.data[offset(i, a.dims, dims)],
                y = b.data[offset(i, b.dims, dims)];
            let value;
            if (op === "Add") value = x + y;
            else if (op === "Sub") value = x - y;
            else if (op === "Mul") value = x * y;
            else if (op === "Div") {
                assert(y !== 0 && y !== 0n, "Division by zero");
                value = x / y;
            } else if (op === "Mod") {
                assert(a.type === "int64" && y !== 0n);
                value = x % y;
                if (value !== 0n && value < 0n !== y < 0n) value += y;
            } else if (op === "Min") value = x < y ? x : y;
            else if (op === "Max") value = x > y ? x : y;
            else if (op === "Equal") value = Number(x === y);
            else if (op === "GreaterOrEqual") value = Number(x >= y);
            else assert.fail(`Unreviewed binary op ${op}`);
            if (type === "int64")
                assert(value >= MIN64 && value <= MAX64, "INT64 arithmetic overflow");
            out[i] = type === "float32" ? f32(value) : value;
        }
        return tensor(type, dims, out);
    }
    function integerValues(t) {
        assert.equal(t.type, "int64");
        return Array.from(t.data, (x) => {
            assert(x >= -640n && x <= 640n);
            return Number(x);
        });
    }
    function attr(n, name, fallback) {
        const a = n.attribute.find((a) => a.name === name);
        return a ? Number(a.i) : fallback;
    }
    function evaluateNode(n, inputs, admission) {
        const [a, b] = inputs,
            op = n.opType;
        if (op === "Shape") {
            assert.deepEqual(n.input, ["pixel_values"]);
            return tensor("int64", [2], admission.pixelDims.map(BigInt));
        }
        assert(inputs.every(Boolean), "Unknown/pixel/weight dependency");
        if (
            ["Add", "Sub", "Mul", "Div", "Mod", "Min", "Max", "Equal", "GreaterOrEqual"].includes(
                op,
            )
        )
            return binary(a, b, op);
        if (op === "Cast") {
            const to = attr(n, "to"),
                type = to === 1 ? "float32" : to === 7 ? "int64" : assert.fail("Unreviewed cast");
            return tensor(
                type,
                a.dims,
                Array.from(a.data, (x) =>
                    type === "float32"
                        ? f32(Number(x))
                        : BigInt(typeof x === "number" ? Math.trunc(x) : x),
                ),
            );
        }
        if (op === "Floor") {
            assert.equal(a.type, "float32");
            return tensor(
                "float32",
                a.dims,
                Array.from(a.data, (x) => f32(Math.floor(x))),
            );
        }
        if (op === "Squeeze" || op === "Unsqueeze") {
            const rank = a.dims.length + (op === "Unsqueeze" ? b.data.length : 0);
            const axes = integerValues(b).map((x) => (x < 0 ? x + rank : x));
            assert(new Set(axes).size === axes.length && axes.every((x) => x >= 0 && x < rank));
            let dims;
            if (op === "Squeeze") {
                assert(axes.every((axis) => a.dims[axis] === 1));
                dims = a.dims.filter((_, axis) => !axes.includes(axis));
            } else {
                let i = 0;
                dims = Array.from({ length: rank }, (_, axis) =>
                    axes.includes(axis) ? 1 : a.dims[i++],
                );
            }
            return tensor(a.type, dims, a.data);
        }
        if (op === "Slice") {
            const starts = integerValues(b),
                ends = integerValues(inputs[2]),
                axes = integerValues(inputs[3]);
            assert.equal(inputs.length, 4);
            assert.equal(starts.length, ends.length);
            assert.equal(starts.length, axes.length);
            const begin = a.dims.map(() => 0),
                dims = [...a.dims];
            for (let i = 0; i < axes.length; i++) {
                const axis = axes[i] < 0 ? axes[i] + dims.length : axes[i],
                    d = a.dims[axis];
                assert(Number.isSafeInteger(d));
                begin[axis] = Math.max(0, Math.min(d, starts[i] < 0 ? d + starts[i] : starts[i]));
                dims[axis] = Math.max(
                    0,
                    Math.max(0, Math.min(d, ends[i] < 0 ? d + ends[i] : ends[i])) - begin[axis],
                );
            }
            const out = allocate(a.type, size(dims));
            for (let i = 0; i < out.length; i++) {
                let remaining = i,
                    source = 0,
                    stride = 1;
                for (let axis = dims.length - 1; axis >= 0; axis--) {
                    source += ((remaining % dims[axis]) + begin[axis]) * stride;
                    remaining = Math.floor(remaining / dims[axis]);
                    stride *= a.dims[axis];
                }
                out[i] = a.data[source];
            }
            return tensor(a.type, dims, out);
        }
        if (op === "Gather") {
            assert.equal(attr(n, "axis", 0), 0);
            assert.equal(a.dims.length, 1);
            return tensor(
                a.type,
                b.dims,
                Array.from(b.data, (x) => {
                    let i = Number(x);
                    if (i < 0) i += a.dims[0];
                    assert(Number.isSafeInteger(i) && i >= 0 && i < a.dims[0]);
                    return a.data[i];
                }),
            );
        }
        if (op === "Range") {
            assert(inputs.every((t) => t.type === "int64" && t.dims.length === 0));
            const [start, end, delta] = inputs.map((t) => t.data[0]);
            assert(delta > 0n);
            const length = Number((end - start + delta - 1n) / delta);
            assert(length >= 0 && length <= 640);
            return tensor(
                "int64",
                [length],
                Array.from({ length }, (_, i) => start + BigInt(i) * delta),
            );
        }
        if (op === "CumSum") {
            assert.equal(a.type, "int64");
            assert.equal(a.dims.length, 1);
            assert.equal(b.data[0], 0n);
            assert.equal(attr(n, "exclusive", 0), 0);
            assert.equal(attr(n, "reverse", 0), 0);
            let sum = 0n;
            return tensor(
                "int64",
                a.dims,
                Array.from(a.data, (x) => (sum += x)),
            );
        }
        if (op === "Concat") {
            assert.equal(attr(n, "axis", 0), 0);
            assert(inputs.every((t) => t.type === a.type && t.dims.length === 1));
            return tensor(
                a.type,
                [inputs.reduce((sum, t) => sum + t.data.length, 0)],
                inputs.flatMap((t) => Array.from(t.data)),
            );
        }
        if (op === "ReduceMax") {
            assert.equal(a.type, "int64");
            assert.equal(a.dims.length, 1);
            assert.deepEqual(integerValues(b), [0]);
            assert.equal(attr(n, "keepdims", 1), 0);
            return tensor("int64", [], [Array.from(a.data).reduce((x, y) => (x > y ? x : y))]);
        }
        if (op === "ReduceSum") {
            assert.equal(a.type, "int64");
            assert.equal(a.dims.length, 2);
            assert.deepEqual(integerValues(b), [1]);
            assert.equal(attr(n, "keepdims", 1), 0);
            return tensor(
                "int64",
                [a.dims[0]],
                Array.from({ length: a.dims[0] }, (_, row) => {
                    let sum = 0n;
                    for (let col = 0; col < a.dims[1]; col++) sum += a.data[row * a.dims[1] + col];
                    return sum;
                }),
            );
        }
        if (op === "Expand") {
            const dims = integerValues(b);
            assert.deepEqual(broadcast(a.dims, dims), dims);
            const out = allocate(a.type, size(dims));
            for (let i = 0; i < out.length; i++) out[i] = a.data[offset(i, a.dims, dims)];
            return tensor(a.type, dims, out);
        }
        if (op === "Where") {
            assert.equal(a.type, "bool");
            const yes = b,
                no = inputs[2];
            assert.equal(yes.type, no.type);
            const dims = broadcast(a.dims, broadcast(yes.dims, no.dims)),
                out = allocate(yes.type, size(dims));
            for (let i = 0; i < out.length; i++) {
                const chosen = a.data[offset(i, a.dims, dims)] ? yes : no;
                out[i] = chosen.data[offset(i, chosen.dims, dims)];
            }
            return tensor(yes.type, dims, out);
        }
        assert.fail(`Unreviewed geometry operator: ${op}`);
    }

    const constants = new Map(
        inlineConstants.map((item) => {
            const bytes = Uint8Array.from(item.hex.match(/../g) ?? [], (hex) =>
                Number.parseInt(hex, 16),
            );
            const view = new DataView(bytes.buffer);
            const width = item.type === "float32" ? 4 : 8;
            assert.equal(bytes.length, size(item.dims) * width);
            const values = Array.from({ length: size(item.dims) }, (_, i) =>
                item.type === "float32"
                    ? view.getFloat32(i * width, true)
                    : view.getBigInt64(i * width, true),
            );
            return [item.name, tensor(item.type, item.dims, values)];
        }),
    );
    const inspectDimensions = (feeds) => {
        assert(
            feeds !== null && typeof feeds === "object" && !Array.isArray(feeds),
            "Named raw feeds required",
        );
        assert.deepEqual(
            Object.keys(feeds).sort(),
            ["image_grid_thw", "pixel_values"],
            "Unexpected or missing input",
        );
        const pixels = feeds.pixel_values,
            gridTensor = feeds.image_grid_thw;
        assert(pixels && pixels.type === "float32", "Pixel dtype must be float32");
        const pixelDims = pixels.dims;
        assert(
            Array.isArray(pixelDims) &&
                pixelDims.length === 2 &&
                pixelDims.every((n) => Number.isSafeInteger(n) && n > 0 && !Object.is(n, -0)) &&
                pixelDims[1] === 1536,
            "Pixel dimensions must be [P,1536]",
        );
        assert(gridTensor && gridTensor.type === "int64", "Grid dtype must be int64");
        assert.deepEqual(gridTensor.dims, [1, 3], "Exactly one image/frame required");
        assert(
            gridTensor.location === "cpu" || gridTensor.location === "cpu-pinned",
            "Grid must already be CPU metadata",
        );
        // Never access pixel data, getData(), a GPU buffer, or external learned weights.
        const data = gridTensor.data;
        assert(
            data instanceof BigInt64Array && data.length === 3,
            "Exactly three INT64 grid values required",
        );
        assert(
            data[0] === 1n &&
                data[1] >= 16n &&
                data[1] <= 32n &&
                data[1] % 2n === 0n &&
                data[2] >= 16n &&
                data[2] <= 32n &&
                data[2] % 2n === 0n,
            "Grid must be [1,even16..32,even16..32]",
        );
        const grid = Array.from(data, Number),
            patches = grid[1] * grid[2];
        assert(
            patches <= 640 && pixelDims[0] === patches,
            "Grid/P mismatch or 640-patch budget exceeded",
        );
        return { grid, patches, pixelDims: pixelDims.slice() };
    };
    const makeControls = (feeds) => {
        const admission = inspectDimensions(feeds),
            values = new Map(constants);
        values.set("image_grid_thw", tensor("int64", [1, 3], admission.grid.map(BigInt)));
        for (const node of program) {
            const inputs = node.input.map((name) => {
                if (name === "pixel_values") {
                    assert.equal(node.name, "/model/vision_rope/pixel_values/Shape");
                    return undefined;
                }
                assert(values.has(name), "Unknown dependency in fixed geometry program");
                return values.get(name);
            });
            values.set(node.output, evaluateNode(node, inputs, admission));
        }
        const bindings = {
            num_patches: admission.patches,
            num_tokens: admission.patches,
            max_hw: Math.max(admission.grid[1], admission.grid[2]),
        };
        return Object.fromEntries(
            inputMetadata.map((item) => {
                const value = values.get(item.name);
                assert.equal(value.type, item.type);
                assert.deepEqual(
                    value.dims,
                    item.shape.map((d) => (typeof d === "number" ? d : bindings[d])),
                );
                return [
                    item.name,
                    { type: value.type, dims: value.dims.slice(), data: value.data.slice() },
                ];
            }),
        );
    };
    return Object.freeze({ inputNames, inputMetadata, inspectDimensions, makeControls });
}
