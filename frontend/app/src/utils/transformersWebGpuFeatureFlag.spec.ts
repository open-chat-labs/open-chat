import {
    transformersWebGpuFeatureEnabled,
    transformersWebGpuProductionAssetsEnabled,
} from "../../transformersWebGpuFeatureFlag.mjs";

describe("all-WebGPU build feature flag", () => {
    const production = {
        OC_BUILD_ENV: "production",
        OC_DFX_NETWORK: "ic",
        OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE: "true",
        OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY: "immutable-hub-v1",
    };

    it("admits only the explicitly selected immutable production asset contract", () => {
        expect(transformersWebGpuFeatureEnabled(production)).toBe(true);
        expect(transformersWebGpuProductionAssetsEnabled(production)).toBe(true);
    });

    it.each([undefined, "", "hf-proxy", "immutable-hub-v2", "IMMUTABLE-HUB-V1"])(
        "rejects unimplemented production delivery %s",
        (delivery) => {
            expect(
                transformersWebGpuFeatureEnabled({
                    ...production,
                    OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY: delivery,
                }),
            ).toBe(false);
        },
    );

    it.each([
        { OC_BUILD_ENV: "test" },
        { OC_DFX_NETWORK: "local" },
        { OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE: "false" },
    ])("cannot use the production contract with incompatible configuration %j", (change) => {
        expect(transformersWebGpuFeatureEnabled({ ...production, ...change })).toBe(false);
    });
    it("allows the explicitly enabled local development phone build", () => {
        expect(
            transformersWebGpuFeatureEnabled({
                OC_BUILD_ENV: "development",
                OC_DFX_NETWORK: "local",
                OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE: "true",
            }),
        ).toBe(true);
    });

    it("keeps production disabled even when the development flag is exported", () => {
        expect(
            transformersWebGpuFeatureEnabled({
                OC_BUILD_ENV: "production",
                OC_DFX_NETWORK: "ic",
                OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE: "true",
            }),
        ).toBe(false);
    });

    it.each([undefined, "", "false", "TRUE"])(
        "keeps local development disabled when the explicit flag is %s",
        (flag) => {
            expect(
                transformersWebGpuFeatureEnabled({
                    OC_BUILD_ENV: "development",
                    OC_DFX_NETWORK: "local",
                    OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE: flag,
                }),
            ).toBe(false);
        },
    );

    it.each([
        ["development", "ic"],
        ["production", "local"],
        [undefined, "local"],
        ["development", undefined],
    ])("rejects the unsupported build/network pair %s/%s", (build, network) => {
        expect(
            transformersWebGpuFeatureEnabled({
                OC_BUILD_ENV: build,
                OC_DFX_NETWORK: network,
                OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE: "true",
            }),
        ).toBe(false);
    });
});
