export interface TransformersWebGpuBuildEnvironment {
    readonly [key: string]: string | undefined;
    readonly OC_BUILD_ENV?: string;
    readonly OC_DFX_NETWORK?: string;
    readonly OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE?: string;
    readonly OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY?: string;
}

export const TRANSFORMERS_WEBGPU_IMMUTABLE_DELIVERY: "immutable-hub-v1";

export function transformersWebGpuFeatureEnabled(
    environment: TransformersWebGpuBuildEnvironment | undefined,
): boolean;

export function transformersWebGpuProductionAssetsEnabled(
    environment: TransformersWebGpuBuildEnvironment | undefined,
): boolean;
