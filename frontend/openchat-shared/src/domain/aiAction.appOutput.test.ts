import { describe, expect, it, vi } from "vitest";
import {
    AI_ACTION_APP_NORMALIZATION_TIMEOUT_MS,
    AI_ACTION_IMAGE_PROMPT_BY_MODEL_EXTENSION as EXT,
    AI_ACTION_IMAGE_PROMPT_EXTENSION as LEGACY,
    AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION as FOCUSED,
    cloneBoundedAppActionCandidates,
    imagePromptTemplateForModel,
    parseCompleteAppActionOutput,
    runAiAction,
    type AiActionDefinition,
} from "./aiAction";
import type { InferenceRequest } from "./onDeviceModel";

const MODEL = "vendor/vision-A:q4";
const variant = (output: "app" | "canonical" = "app") => ({
    template: "Read the instrument fields.",
    includeRuleGuidance: false,
    output,
});
const def = (): AiActionDefinition => ({
    name: "demo.measurement.add",
    description: "Log a measurement",
    acceptsImage: true,
    promptTemplate: "Legacy text prompt.",
    responseSchema: {
        type: "object",
        required: ["reading"],
        properties: {
            reading: { type: "number", exclusiveMinimum: 0 },
            unit: { type: "string", default: "lx" },
        },
        [LEGACY]: { version: 1, template: "Legacy image prompt.", includeRuleGuidance: false },
        [EXT]: { version: 2, templates: { [MODEL]: variant() } },
    },
    card: {
        title: "Measurement",
        rows: [{ label: "Reading", valueKey: "reading" }],
        confirmLabel: "Add",
        cancelLabel: "Dismiss",
    },
});
const image = new Uint8Array([1, 2, 3]);
const normalized = (
    candidates: unknown[] = [{ reading: 42 }],
    sourceIndexes = candidates.map((_, i) => i),
) => ({ kind: "candidates", candidates, sourceIndexes });
async function run(
    raw: string,
    normalize?: (candidates: Record<string, unknown>[]) => Promise<unknown>,
    definition = def(),
    input = { image, modelId: MODEL },
) {
    const infer = vi.fn(async (_request: InferenceRequest) => ({ kind: "ok" as const, text: raw }));
    const result = await runAiAction(
        definition,
        input,
        "unused",
        infer,
        undefined,
        undefined,
        undefined,
        undefined,
        normalize === undefined ? undefined : { normalize },
    );
    return { result, infer };
}

describe("atomic app-output prompt selection", () => {
    it("requires explicit v2 output on every entry; v1 never opts into app normalization", () => {
        expect(imagePromptTemplateForModel(def().responseSchema, MODEL)).toEqual(variant());
        for (const bad of [
            { version: 1, templates: { [MODEL]: variant() } },
            { version: 2, templates: { [MODEL]: { template: "Raw", includeRuleGuidance: false } } },
            {
                version: 2,
                templates: { [MODEL]: variant(), invalid: { ...variant(), output: "unknown" } },
            },
        ]) {
            expect(imagePromptTemplateForModel({ [EXT]: bad }, MODEL)).toBeUndefined();
        }
    });
    it("rejects missing capability before any image inference", async () => {
        const { result, infer } = await run('{"reading_text":"42"}');
        expect(result).toMatchObject({ kind: "error" });
        expect(infer).not.toHaveBeenCalled();
    });
    it("keeps canonical v2 and text input on their ordinary paths", async () => {
        const normalize = vi.fn(async () => normalized()),
            d = def();
        (d.responseSchema as Record<string, unknown>)[EXT] = {
            version: 2,
            templates: { [MODEL]: variant("canonical") },
        };
        expect((await run('{"reading":42}', normalize, d)).result.kind).toBe("ready");
        const infer = vi.fn(async (_request: InferenceRequest) => ({
            kind: "ok" as const,
            text: '{"reading":42}',
        }));
        expect(
            (
                await runAiAction(
                    def(),
                    { text: "42", modelId: MODEL },
                    "unused",
                    infer,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    { normalize },
                )
            ).kind,
        ).toBe("ready");
        expect(normalize).not.toHaveBeenCalled();
        expect(infer.mock.calls[0][0].prompt).toContain("Legacy text prompt.");
    });
    it("refuses incompatible focused passes before inference", async () => {
        const d = def();
        (d.responseSchema as Record<string, unknown>)[FOCUSED] = {
            version: 1,
            primaryFields: ["reading"],
            primaryMaxTokens: 64,
            passes: [
                {
                    fields: ["unit"],
                    template: "Read unit.",
                    includeRuleGuidance: false,
                    includeMessage: false,
                    maxTokens: 32,
                },
            ],
        };
        const normalize = vi.fn(async () => normalized());
        const { result, infer } = await run('{"reading_text":"42"}', normalize, d);
        expect(result).toMatchObject({ kind: "error" });
        expect(infer).not.toHaveBeenCalled();
        expect(normalize).not.toHaveBeenCalled();
    });
});

describe("complete app-output parsing", () => {
    it.each(['{"raw":"42"}', '[{"raw":"42"}]', '```json\n{"raw":"42"}\n```'])(
        "accepts complete envelope %j",
        (raw) => {
            expect(parseCompleteAppActionOutput(raw)).toEqual([{ raw: "42" }]);
        },
    );
    it.each([
        'preface {"raw":"42"}',
        '{"raw":"42"} trailing',
        '{"raw":"42"}{"raw":"43"}',
        '[{"raw":"42"},',
        '{"raw":"42"',
        '[{"raw":"42"},false]',
        "[]",
        "null",
        '"{\\"raw\\":42}"',
        '{"raw":1,"r\\u0061w":2}',
        '[{"raw":{"a":1,"a":2}}]',
        '{"raw":1e400}',
        '{"__proto__":{"raw":42}}',
        '{"raw":"' + "x".repeat(65537) + '"}',
    ])("rejects incomplete, ambiguous or unsafe output without recovery: %j", (raw) => {
        expect(parseCompleteAppActionOutput(raw)).toBeUndefined();
    });
    it("preserves opaque nested objects without unwrapping an app field", () => {
        expect(parseCompleteAppActionOutput('{"records":[{"raw":"42"}]}')).toEqual([
            { records: [{ raw: "42" }] },
        ]);
    });
    it("clones plain JSON without invoking accessors or retaining mutable references", () => {
        const value = [{ raw: { labels: ["fern", "moss"] } }],
            copy = cloneBoundedAppActionCandidates(value);
        expect(copy).toEqual(value);
        expect(copy).not.toBe(value);
        expect(copy?.[0]).not.toBe(value[0]);
        let called = false;
        const accessor = Object.defineProperty({}, "raw", {
            enumerable: true,
            get() {
                called = true;
                return 42;
            },
        });
        for (const bad of [
            [accessor],
            [new Date()],
            [{ raw: Infinity }],
            [{ raw: undefined }],
            [Object.assign({}, { [Symbol("field")]: 42 })],
            Array(2),
        ])
            expect(cloneBoundedAppActionCandidates(bad)).toBeUndefined();
        expect(called).toBe(false);
    });
});

describe("app normalization before canonical conformance", () => {
    it("passes raw non-schema fields once and builds the card only from normalized canonical fields", async () => {
        const normalize = vi.fn(async (candidates: Record<string, unknown>[]) => {
            expect(candidates).toEqual([{ reading_text: "42", context: { specimen: "fern" } }]);
            return normalized();
        });
        const { result, infer } = await run(
            '{"reading_text":"42","context":{"specimen":"fern"}}',
            normalize,
        );
        expect(result).toMatchObject({ kind: "ready", extracted: { reading: 42, unit: "lx" } });
        expect(infer).toHaveBeenCalledOnce();
        expect(normalize).toHaveBeenCalledOnce();
        if (result.kind === "ready")
            expect(JSON.parse(new TextDecoder().decode(result.card.confirmPayload))).toEqual({
                reading: 42,
                unit: "lx",
            });
    });
    it("retains required fields and fails an entire incomplete multi-row result", async () => {
        const normalize = vi.fn(async () => normalized([{ reading: 42 }, { reading: 0 }]));
        const { result, infer } = await run('[{"raw":"42"},{"raw":"0"}]', normalize);
        expect(result).toMatchObject({
            kind: "incomplete_extraction",
            missingFields: ["reading"],
            candidateCount: 2,
            validCandidateCount: 1,
        });
        expect(infer).toHaveBeenCalledOnce();
        expect(normalize).toHaveBeenCalledOnce();
        expect(result).not.toHaveProperty("card");
    });
    it.each([
        normalized([], []),
        normalized([{ reading: 42 }, { reading: 43 }]),
        normalized([{ reading: 42 }], [1]),
        { kind: "candidates", candidates: [{ reading: 42 }] },
        normalized([{ reading: Infinity }]),
        { kind: "error", error: "sensitive app details" },
    ])(
        "rejects unsafe/count-changing/unbound normalization without a second read: %j",
        async (returned) => {
            const normalize = vi.fn(async () => returned);
            const { result, infer } = await run('{"raw":"42"}', normalize);
            expect(result).toMatchObject({ kind: "error" });
            expect(JSON.stringify(result)).not.toContain("sensitive app details");
            expect(infer).toHaveBeenCalledOnce();
            expect(normalize).toHaveBeenCalledOnce();
        },
    );
    it("rejects reordered row bindings even with unchanged count", async () => {
        expect(
            (
                await run('[{"raw":"42"},{"raw":"43"}]', async () =>
                    normalized([{ reading: 43 }, { reading: 42 }], [1, 0]),
                )
            ).result.kind,
        ).toBe("error");
    });
    it.each(["none", "ambiguous"])("preserves %s as no extraction", async (kind) => {
        const normalize = vi.fn(async () => ({ kind }));
        const { result, infer } = await run('{"raw":"42"}', normalize);
        expect(result).toEqual({ kind: "no_extraction", raw: "" });
        expect(infer).toHaveBeenCalledOnce();
        expect(normalize).toHaveBeenCalledOnce();
    });
    it("contains thrown failures and times out a stalled normalizer", async () => {
        expect(
            (
                await run('{"raw":"42"}', async () => {
                    throw new Error("private token");
                })
            ).result,
        ).toMatchObject({ kind: "error" });
        vi.useFakeTimers();
        try {
            const pending = run('{"raw":"42"}', () => new Promise(() => {}));
            await vi.advanceTimersByTimeAsync(AI_ACTION_APP_NORMALIZATION_TIMEOUT_MS);
            expect((await pending).result).toMatchObject({ kind: "error" });
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });
    it("does not send malformed model JSON to an app or perform a second inference", async () => {
        const normalize = vi.fn(async () => normalized());
        const { result, infer } = await run('{"raw":"42"', normalize);
        expect(result.kind).toBe("no_extraction");
        expect(normalize).not.toHaveBeenCalled();
        expect(infer).toHaveBeenCalledOnce();
    });
});
