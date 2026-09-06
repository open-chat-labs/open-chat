import { describe, expect, it } from "vitest";
import {
    isTransformersWebGpuOrtRunFailure,
    transformersWebGpuOrtRunError,
} from "./transformersWebGpuOrtDiagnostics";

describe("Transformers WebGPU ORT diagnostics", () => {
    it("qualifies OrtRun failures with exact stage and feed contracts without tensor data", () => {
        const error = transformersWebGpuOrtRunError(
            "Gemma 4 E2B",
            "decoder_model_merged",
            "decoder_model_merged execution",
            {
                inputs_embeds: {
                    type: "float32",
                    dims: [1, 317, 1_536],
                    location: "cpu",
                    data: new Float32Array(317 * 1_536),
                },
                "past_key_values.0.key": {
                    type: "float16",
                    dims: [1, 1, 0, 256],
                    location: "gpu-buffer",
                },
            },
            new Error("failed to call OrtRun()."),
        );

        expect(error.message).toBe(
            "Gemma 4 E2B decoder_model_merged OrtRun failed during decoder_model_merged execution (inputs_embeds=float32[1x317x1536]@cpu, past_key_values.0.key=float16[1x1x0x256]@gpu-buffer): failed to call OrtRun().",
        );
        expect(error.message).not.toContain("0,0,0");
    });

    it("recognizes only raw OrtRun errors so custom WebGPU failures keep their own cause", () => {
        expect(isTransformersWebGpuOrtRunFailure(new Error("failed to call OrtRun()."))).toBe(true);
        expect(isTransformersWebGpuOrtRunFailure("FAILED TO CALL ORTRUN")).toBe(true);
        expect(isTransformersWebGpuOrtRunFailure(new Error("WebGPU device was lost"))).toBe(false);
    });

    it("reports malformed feeds without throwing while formatting the original failure", () => {
        expect(
            transformersWebGpuOrtRunError(
                "Gemma 4 E2B",
                "vision_encoder",
                "vision_encoder execution",
                undefined,
                "boom",
            ).message,
        ).toBe(
            "Gemma 4 E2B vision_encoder OrtRun failed during vision_encoder execution (invalid feeds): boom",
        );
    });
});
