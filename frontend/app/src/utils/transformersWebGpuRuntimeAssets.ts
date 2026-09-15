// Build-owned runtime identities. Keep this module independent of model selection and browser state.
export const TRANSFORMERS_WEBGPU_WORKER_PATH = "/transformers_webgpu_worker.js";
export const TRANSFORMERS_WEBGPU_ORT_ASSET_BASE =
    "/assets/transformers-webgpu/ort-1.29.0-dev.20260723-1b1e1db7bc";

/**
 * Application runtime files needed before Transformers.js can open the three ONNX sessions.
 *
 * The ORT files are package-pinned and therefore have exact byte/digest identities. The worker is
 * produced by the current OpenChat build, so its identity is the website version in its URL plus a
 * digest recorded after Model Manager or persisted-startup restore has consumed the complete response.
 */
export const TRANSFORMERS_WEBGPU_RUNTIME_ASSETS = [
    {
        kind: "worker",
        path: TRANSFORMERS_WEBGPU_WORKER_PATH,
        minimumBytes: 64 * 1024,
        maximumBytes: 32 * 1024 * 1024,
    },
    {
        kind: "pinned",
        path: `${TRANSFORMERS_WEBGPU_ORT_ASSET_BASE}/ort-wasm-simd-threaded.jspi.mjs`,
        bytes: 46_313,
        sha256: "630c7cbb6eedffdd465f815d14051918ad4c9c6c7cc221190ca2fbe560b289eb",
    },
    {
        kind: "pinned",
        path: `${TRANSFORMERS_WEBGPU_ORT_ASSET_BASE}/ort-wasm-simd-threaded.jspi.wasm`,
        bytes: 15_580_557,
        sha256: "a4aebeebccc554f21641e348b76135a2b7a06151765fa71fd40a38bbb249962e",
    },
] as const;
