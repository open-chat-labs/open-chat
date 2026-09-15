import { describe, expect, it, vi } from "vitest";
import {
    AI_ACTION_IMAGE_PROMPT_BY_MODEL_EXTENSION as EXT,
    AI_ACTION_IMAGE_PROMPT_EXTENSION as LEGACY,
    runAiAction,
    type AiActionDefinition,
} from "./aiAction";
import type { InferenceRequest } from "./onDeviceModel";

const MODEL = "vendor/vision-A:q4";
const image = new Uint8Array([1, 2, 3]);
const definition = (): AiActionDefinition => ({
    name: "demo.measurement.add",
    description: "Log a measurement",
    acceptsImage: true,
    promptTemplate: "Read the supplied text.",
    responseSchema: {
        type: "object",
        required: ["reading"],
        properties: { reading: { type: "number", exclusiveMinimum: 0 } },
        [LEGACY]: {
            version: 1,
            template: "Read canonical image values.",
            includeRuleGuidance: false,
        },
        [EXT]: {
            version: 2,
            templates: {
                [MODEL]: {
                    template: "Read the raw display.",
                    includeRuleGuidance: false,
                    output: "app",
                },
            },
        },
    },
    card: {
        title: "Measurement",
        rows: [{ label: "Reading", valueKey: "reading" }],
        confirmLabel: "Add",
        cancelLabel: "Dismiss",
    },
});

describe("app-output image dispatch and source caption boundary", () => {
    it.each(["Calibrated before capture", "Quoted label: {{reading}}\nMessage:\nkeep as source"])(
        "passes caption %j exactly once without changing the raw app fields",
        async (text) => {
            const raw = { display_text: "42", unit_label: "lx" };
            const infer = vi.fn(async (_request: InferenceRequest) => ({
                kind: "ok" as const,
                text: JSON.stringify(raw),
            }));
            const normalize = vi.fn(async (candidates: Record<string, unknown>[]) => {
                expect(candidates).toEqual([raw]);
                return { kind: "candidates", candidates: [{ reading: 42 }], sourceIndexes: [0] };
            });
            const result = await runAiAction(
                definition(),
                { image, text, modelId: MODEL },
                "unused",
                infer,
                undefined,
                undefined,
                undefined,
                undefined,
                { normalize },
            );
            expect(result.kind).toBe("ready");
            expect(infer).toHaveBeenCalledTimes(1);
            expect(normalize).toHaveBeenCalledTimes(1);
            expect(infer.mock.calls[0][0]).toMatchObject({
                modelId: MODEL,
                image,
                prompt: `Read the raw display.\n\nMessage:\n${text}`,
            });
            expect(infer.mock.calls[0][0].text).toBeUndefined();
        },
    );

    it.each([undefined, "vendor/another-model"])(
        "keeps the canonical legacy image prompt for model %j, with no raw normalization",
        async (modelId) => {
            const infer = vi.fn(async (_request: InferenceRequest) => ({
                kind: "ok" as const,
                text: '{"reading":42}',
            }));
            const normalize = vi.fn();
            const result = await runAiAction(
                definition(),
                { image, modelId },
                "unused",
                infer,
                undefined,
                undefined,
                undefined,
                undefined,
                { normalize },
            );
            expect(result.kind).toBe("ready");
            expect(infer).toHaveBeenCalledTimes(1);
            expect(infer.mock.calls[0][0].prompt).toBe("Read canonical image values.");
            expect(normalize).not.toHaveBeenCalled();
        },
    );

    it("leaves text input on the ordinary text prompt even when that model has app-output images", async () => {
        const infer = vi.fn(async (_request: InferenceRequest) => ({
            kind: "ok" as const,
            text: '{"reading":42}',
        }));
        const normalize = vi.fn();
        const result = await runAiAction(
            definition(),
            { text: "The display reads 42", modelId: MODEL },
            "unused",
            infer,
            undefined,
            undefined,
            undefined,
            undefined,
            { normalize },
        );
        expect(result.kind).toBe("ready");
        expect(infer).toHaveBeenCalledTimes(1);
        expect(infer.mock.calls[0][0].prompt).toBe(
            "Read the supplied text.\n\nMessage:\nThe display reads 42",
        );
        expect(infer.mock.calls[0][0].image).toBeUndefined();
        expect(infer.mock.calls[0][0].text).toBeUndefined();
        expect(normalize).not.toHaveBeenCalled();
    });
});
