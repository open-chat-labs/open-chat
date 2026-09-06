import { describe, expect, it } from "vitest";
import {
    createTransformersWebGpuDevRuntimeVersion,
    readTransformersWebGpuDevRuntimeVersion,
    TRANSFORMERS_WEBGPU_DEV_RUNTIME_VERSION_META,
} from "./transformersWebGpuDevRuntimeVersion";

describe("development all-WebGPU runtime version", () => {
    it("rotates the immutable worker URL generation after every successful rebuild", () => {
        const version = createTransformersWebGpuDevRuntimeVersion("1000.0.123");

        expect(version.current()).toBe("1000.0.123.webgpu.0");
        expect(version.rotate()).toBe("1000.0.123.webgpu.1");
        expect(version.rotate()).toBe("1000.0.123.webgpu.2");
        expect(version.current()).toBe("1000.0.123.webgpu.2");
    });

    it("reads only a non-empty generation from the development document", () => {
        const root = {
            querySelector: (selector: string) => {
                expect(selector).toBe(
                    `meta[name="${TRANSFORMERS_WEBGPU_DEV_RUNTIME_VERSION_META}"]`,
                );
                return { getAttribute: () => " 1000.0.123.webgpu.7 " };
            },
        };

        expect(readTransformersWebGpuDevRuntimeVersion(root)).toBe("1000.0.123.webgpu.7");
        expect(
            readTransformersWebGpuDevRuntimeVersion({
                querySelector: () => ({ getAttribute: () => " " }),
            }),
        ).toBeUndefined();
        expect(readTransformersWebGpuDevRuntimeVersion(undefined)).toBeUndefined();
    });
});
