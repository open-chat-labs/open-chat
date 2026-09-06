/**
 * The development flag alone never enables production. A production candidate must also select
 * the immutable distribution contract: same-origin patched graphs/ORT/worker, pinned Hub weights,
 * and cache-only inference. Release approval remains a separate CI/device acceptance gate.
 */
export const TRANSFORMERS_WEBGPU_IMMUTABLE_DELIVERY = "immutable-hub-v1";

export function transformersWebGpuProductionAssetsEnabled(environment) {
    return (
        environment?.OC_BUILD_ENV === "production" &&
        environment?.OC_DFX_NETWORK === "ic" &&
        environment?.OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE === "true" &&
        environment?.OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY ===
            TRANSFORMERS_WEBGPU_IMMUTABLE_DELIVERY
    );
}

export function transformersWebGpuFeatureEnabled(environment) {
    return (
        (environment?.OC_BUILD_ENV === "development" &&
            environment?.OC_DFX_NETWORK === "local" &&
            environment?.OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE === "true") ||
        transformersWebGpuProductionAssetsEnabled(environment)
    );
}
