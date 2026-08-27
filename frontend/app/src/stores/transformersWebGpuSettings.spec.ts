import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SETTINGS_KEY = "openchat_transformers_webgpu_runtime_settings_v1";

describe("Transformers WebGPU runtime settings", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.resetModules();
    });

    it("defaults to the worker's deterministic 96-token ceiling", async () => {
        const settings = await import("./transformersWebGpuSettings");

        expect(get(settings.transformersWebGpuMaxOutputTokens)).toBe(96);
        expect(settings.resolveTransformersWebGpuMaxOutputTokens(undefined)).toBe(96);
    });

    it("persists and clamps the editable output cap to the worker range", async () => {
        const settings = await import("./transformersWebGpuSettings");

        expect(settings.updateTransformersWebGpuMaxOutputTokens(48)).toBe(48);
        expect(get(settings.transformersWebGpuMaxOutputTokens)).toBe(48);
        expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual({
            version: 1,
            maxOutputTokens: 48,
        });
        expect(settings.updateTransformersWebGpuMaxOutputTokens(0)).toBe(1);
        expect(settings.updateTransformersWebGpuMaxOutputTokens(500)).toBe(96);
    });

    it("caps larger callers without expanding a smaller request", async () => {
        const settings = await import("./transformersWebGpuSettings");
        settings.updateTransformersWebGpuMaxOutputTokens(48);

        expect(settings.resolveTransformersWebGpuMaxOutputTokens(256)).toBe(48);
        expect(settings.resolveTransformersWebGpuMaxOutputTokens(24)).toBe(24);
        expect(settings.resolveTransformersWebGpuMaxOutputTokens(undefined)).toBe(48);
    });

    it("loads valid persisted settings and ignores malformed state", async () => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, maxOutputTokens: 40 }));
        let settings = await import("./transformersWebGpuSettings");
        expect(get(settings.transformersWebGpuMaxOutputTokens)).toBe(40);

        localStorage.setItem(SETTINGS_KEY, "{broken");
        vi.resetModules();
        settings = await import("./transformersWebGpuSettings");
        expect(get(settings.transformersWebGpuMaxOutputTokens)).toBe(96);
    });
});
