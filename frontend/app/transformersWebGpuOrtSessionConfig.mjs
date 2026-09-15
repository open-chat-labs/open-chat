import { createHash } from "node:crypto";

// This JSPI wrapper currently forwards generic extra options after provider creation.
// WebGPU reads enableInt64 during creation, so forward an explicitly requested "1"
// beforehand as well. Leave the native WASM and normal late option handling unchanged.
export const TRANSFORMERS_WEBGPU_ORT_CONFIG_SOURCE_SHA256 =
    "07276362c127e70cbe13a7c46e08679039d4da6a368cea11d8c425533f0a7a28";
export const TRANSFORMERS_WEBGPU_ORT_CONFIG_PATCHED_SHA256 =
    "26076268149f814b9bd6f2ee7cf78077c3d6b3d694a8807dfa168546ad6eb0cc";
const MODULE_SUFFIX = "/onnxruntime-web/dist/ort.jspi.min.mjs";
const BEFORE = "n.executionProviders&&await pn(r,n,o)";
const AFTER =
    'n.extra?.["ep.webgpuexecutionprovider.enableInt64"]==="1"&&Ee(r,"ep.webgpuexecutionprovider.enableInt64","1",o),n.executionProviders&&await pn(r,n,o)';
const sha256 = (source) => createHash("sha256").update(source).digest("hex");

export function patchTransformersWebGpuOrtSessionConfig(source, id) {
    if (typeof id !== "string" || !id.replaceAll("\\", "/").endsWith(MODULE_SUFFIX)) return null;
    if (
        typeof source !== "string" ||
        sha256(source) !== TRANSFORMERS_WEBGPU_ORT_CONFIG_SOURCE_SHA256 ||
        source.split(BEFORE).length !== 2
    ) {
        throw new Error("The pinned ORT JSPI session configuration source changed.");
    }
    const patched = source.replace(BEFORE, AFTER);
    if (
        patched.replace(AFTER, BEFORE) !== source ||
        sha256(patched) !== TRANSFORMERS_WEBGPU_ORT_CONFIG_PATCHED_SHA256
    ) {
        throw new Error("The ORT JSPI configuration patch changed unexpected code.");
    }
    return patched;
}

// Install only on the model worker's build. Other workers and non-JSPI runtime modules
// are not targets. Missing or repeated application is a build failure, not a fallback.
export function transformersWebGpuOrtSessionConfigPlugin() {
    let applied = 0;
    return {
        name: "openchat-transformers-webgpu-early-session-config",
        enforce: "pre",
        buildStart() {
            applied = 0;
        },
        transform(source, id) {
            const code = patchTransformersWebGpuOrtSessionConfig(source, id);
            if (code === null) return null;
            if (++applied !== 1)
                throw new Error("ORT JSPI configuration patch applied more than once.");
            return { code, map: null };
        },
        buildEnd(error) {
            if (!error && applied !== 1)
                throw new Error("The model worker did not apply its ORT JSPI configuration patch.");
        },
    };
}
