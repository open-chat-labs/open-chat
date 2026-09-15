import { describe, expect, it, vi } from "vitest";
import {
    AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION,
    AI_ACTION_IMAGE_PROMPT_BY_MODEL_EXTENSION as EXTENSION,
    AI_ACTION_IMAGE_PROMPT_EXTENSION as LEGACY,
    AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION,
    MAX_AI_ACTION_IMAGE_PROMPT_BY_MODEL_BYTES,
    MAX_AI_ACTION_IMAGE_PROMPT_BYTES,
    MAX_AI_ACTION_IMAGE_PROMPT_MODEL_ID_CHARS,
    MAX_AI_ACTION_IMAGE_PROMPT_MODELS,
    PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER,
    PRIVATE_IMAGE_SEMANTIC_VALUES_PLACEHOLDER,
    imagePromptTemplateConfig,
    imagePromptTemplateForModel,
    runAiAction,
    type AiActionDefinition,
} from "./aiAction";
import type { InferenceRequest } from "./onDeviceModel";

const MODEL = "vendor/vision-A:q4";
const SECOND_MODEL = "vision-B";
const variant = (template = "Read visible measurements.", includeRuleGuidance = false) => ({
    template,
    includeRuleGuidance,
});
const extension = () => ({
    version: 1,
    templates: {
        [MODEL]: variant(),
        [SECOND_MODEL]: variant("Return visible readings as JSON.", true),
    },
});
const schema = (value: unknown = extension()) => ({
    type: "object",
    [EXTENSION]: value,
    [LEGACY]: { version: 1, ...variant("  Original image template.\n", true) },
    properties: {
        reading: { type: "number", exclusiveMinimum: 0 },
        annotation: { type: "string" },
    },
    required: ["reading"],
});
const definition = (responseSchema: object = schema()): AiActionDefinition => ({
    name: "demo.measurement.add",
    description: "Log a measurement",
    acceptsImage: true,
    promptTemplate: "Original text prompt.",
    responseSchema,
    card: {
        title: "Measurement",
        rows: [{ label: "Reading", valueKey: "reading" }],
        confirmLabel: "Add",
        cancelLabel: "Dismiss",
    },
    consumerPublicKey: "unused",
});
const image = new Uint8Array([1, 2, 3]);
async function requestFor(def: AiActionDefinition, input: Parameters<typeof runAiAction>[1]) {
    const requests: InferenceRequest[] = [];
    await runAiAction(def, input, "unused", async (request) => {
        requests.push(request);
        return { kind: "unavailable", reason: "Capture request only; not model inference." };
    });
    expect(requests).toHaveLength(1);
    return requests[0];
}

describe("app-authored image prompts selected by opaque model ID", () => {
    it("selects exact own IDs without mutating or trimming the registered strings", () => {
        const input = schema();
        const saved = JSON.stringify(input);
        expect(imagePromptTemplateForModel(input, MODEL)).toEqual(variant());
        expect(imagePromptTemplateForModel(input, SECOND_MODEL)).toEqual(
            variant("Return visible readings as JSON.", true),
        );
        expect(imagePromptTemplateConfig(input)).toEqual(
            variant("  Original image template.\n", true),
        );
        for (const id of [undefined, "unknown", MODEL.toLowerCase(), ` ${MODEL}`, "toString"]) {
            expect(imagePromptTemplateForModel(input, id)).toBeUndefined();
        }
        expect(
            imagePromptTemplateForModel(input, new String(MODEL) as unknown as string),
        ).toBeUndefined();
        expect(JSON.stringify(input)).toBe(saved);
    });

    it("bounds entry count and IDs without recognizing any specific model family", () => {
        const templates = Object.fromEntries(
            Array.from({ length: MAX_AI_ACTION_IMAGE_PROMPT_MODELS }, (_, i) => [
                `model-${i}`,
                variant(),
            ]),
        );
        expect(imagePromptTemplateForModel(schema({ version: 1, templates }), "model-0")).toEqual(
            variant(),
        );
        templates.extra = variant();
        expect(
            imagePromptTemplateForModel(schema({ version: 1, templates }), "model-0"),
        ).toBeUndefined();
        const longest = "a".repeat(MAX_AI_ACTION_IMAGE_PROMPT_MODEL_ID_CHARS);
        expect(
            imagePromptTemplateForModel(
                schema({ version: 1, templates: { [longest]: variant() } }),
                longest,
            ),
        ).toEqual(variant());
        for (const id of [
            "",
            longest + "a",
            "spaced model",
            "wildcard*",
            "__proto__",
            "غير-معروف",
            "line\nbreak",
        ]) {
            expect(
                imagePromptTemplateForModel(
                    schema({ version: 1, templates: { [id]: variant() } }),
                    id,
                ),
            ).toBeUndefined();
        }
    });

    it("counts UTF-8 per-template bytes and preserves ordinary multilingual formatting", () => {
        const exact = "ع".repeat(MAX_AI_ACTION_IMAGE_PROMPT_BYTES / 2);
        expect(
            imagePromptTemplateForModel(
                schema({ version: 1, templates: { [MODEL]: variant(exact) } }),
                MODEL,
            )?.template,
        ).toBe(exact);
        const multilingual = "اقرأ القيم كما هي.\n\r\t👩‍💻️";
        expect(
            imagePromptTemplateForModel(
                schema({ version: 1, templates: { [MODEL]: variant(multilingual) } }),
                MODEL,
            )?.template,
        ).toBe(multilingual);
        for (const text of [exact + "a", " ", "a\0b", "a\u202eb", "a\ud800b", "a\u200bb"]) {
            const value = extension();
            value.templates[SECOND_MODEL].template = text;
            // A bad unselected entry also rejects the extension.
            expect(imagePromptTemplateForModel(schema(value), MODEL)).toBeUndefined();
        }
    });

    it("bounds serialized aggregate UTF-8 bytes including JSON keys and escapes", () => {
        const value = {
            version: 1,
            templates: Object.fromEntries(
                Array.from({ length: 4 }, (_, i) => [`m${i}`, variant("x".repeat(4000))]),
            ),
        };
        const encoder = new TextEncoder();
        let remaining =
            MAX_AI_ACTION_IMAGE_PROMPT_BY_MODEL_BYTES -
            encoder.encode(JSON.stringify(value)).byteLength;
        for (const config of Object.values(value.templates)) {
            const added = Math.min(
                remaining,
                MAX_AI_ACTION_IMAGE_PROMPT_BYTES - config.template.length,
            );
            config.template += "x".repeat(added);
            remaining -= added;
        }
        expect(remaining).toBe(0);
        expect(value.templates.m3.template.length).toBeLessThanOrEqual(
            MAX_AI_ACTION_IMAGE_PROMPT_BYTES,
        );
        expect(encoder.encode(JSON.stringify(value))).toHaveLength(
            MAX_AI_ACTION_IMAGE_PROMPT_BY_MODEL_BYTES,
        );
        expect(imagePromptTemplateForModel(schema(value), "m0")).toEqual(value.templates.m0);
        value.templates.m3.template += "x";
        expect(imagePromptTemplateForModel(schema(value), "m0")).toBeUndefined();
        for (const config of Object.values(value.templates)) config.template = '"'.repeat(3000);
        expect(imagePromptTemplateForModel(schema(value), "m0")).toBeUndefined();
    });

    it("rejects malformed shapes and unknown versions rather than partially accepting a map", () => {
        for (const value of [
            null,
            [],
            "prompt",
            {},
            { version: 2, templates: extension().templates },
            { ...extension(), extra: true },
            { version: 1, templates: {} },
            { version: 1, templates: [] },
            { version: 1, templates: { [MODEL]: null } },
            { version: 1, templates: { [MODEL]: { template: "Read." } } },
            { version: 1, templates: { [MODEL]: { ...variant(), extra: true } } },
            { version: 1, templates: { [MODEL]: { ...variant(), includeRuleGuidance: "false" } } },
        ])
            expect(imagePromptTemplateForModel(schema(value), MODEL)).toBeUndefined();
        expect(imagePromptTemplateForModel(undefined, MODEL)).toBeUndefined();
    });

    it("rejects inherited/accessor/symbol/hidden fields without invoking getters", () => {
        const getter = vi.fn(() => {
            throw new Error("Getter must not execute");
        });
        const root = schema();
        Object.defineProperty(root, EXTENSION, { get: getter });
        expect(imagePromptTemplateForModel(root, MODEL)).toBeUndefined();
        const inherited = Object.create({ [EXTENSION]: extension() });
        expect(imagePromptTemplateForModel(inherited, MODEL)).toBeUndefined();
        for (const at of ["version", "templates", "entry", "template", "includeRuleGuidance"]) {
            const value = extension();
            const owner =
                at === "entry"
                    ? value.templates
                    : at === "template" || at === "includeRuleGuidance"
                      ? value.templates[MODEL]
                      : value;
            Object.defineProperty(owner, at === "entry" ? MODEL : at, { get: getter });
            expect(imagePromptTemplateForModel(schema(value), MODEL)).toBeUndefined();
        }
        for (const customize of [
            (obj: object) => Object.setPrototypeOf(obj, { inherited: true }),
            (obj: object) => Object.defineProperty(obj, "hidden", { value: true }),
            (obj: object) => Object.defineProperty(obj, Symbol("extra"), { value: true }),
        ]) {
            for (const level of ["extension", "templates", "entry"]) {
                const value = extension();
                customize(
                    level === "extension"
                        ? value
                        : level === "templates"
                          ? value.templates
                          : value.templates[MODEL],
                );
                expect(imagePromptTemplateForModel(schema(value), MODEL)).toBeUndefined();
            }
        }
        expect(getter).not.toHaveBeenCalled();
        const hostile = new Proxy(
            {},
            {
                getOwnPropertyDescriptor: () => {
                    throw new Error("denied");
                },
            },
        );
        expect(imagePromptTemplateForModel(hostile, MODEL)).toBeUndefined();
        const nullPrototype = Object.assign(Object.create(null), extension());
        expect(imagePromptTemplateForModel(schema(nullPrototype), MODEL)).toEqual(variant());
    });

    it("uses only the selected prompt, caption once and the same model; no extra call or schema", async () => {
        const def = definition();
        def.rules = [{ kind: "instruction", text: "Optional guidance." }];
        const first = await requestFor(def, { image, modelId: MODEL, text: "sensor caption" });
        expect(first).toMatchObject({
            prompt: "Read visible measurements.\n\nMessage:\nsensor caption",
            modelId: MODEL,
            image,
            maxTokens: 256,
        });
        expect(first.text).toBeUndefined();
        expect(first.responseSchema).toBeUndefined();
        const second = await requestFor(def, { image, modelId: SECOND_MODEL });
        expect(second.prompt).toBe(
            "Return visible readings as JSON.\n\nRules:\n- Optional guidance.",
        );
    });

    it("preserves fallback bytes and supports an explicit map without a v1 template", async () => {
        for (const modelId of [undefined, "unknown"]) {
            expect((await requestFor(definition(), { image, modelId })).prompt).toBe(
                "  Original image template.\n",
            );
        }
        expect(
            (await requestFor(definition(schema({ version: 99 })), { image, modelId: MODEL }))
                .prompt,
        ).toBe("  Original image template.\n");
        const noLegacy = schema() as Record<string, unknown>;
        delete noLegacy[LEGACY];
        expect((await requestFor(definition(noLegacy), { image, modelId: MODEL })).prompt).toBe(
            variant().template,
        );
        expect((await requestFor(definition(noLegacy), { image, modelId: "unknown" })).prompt).toBe(
            "Original text prompt.",
        );
    });

    it("does not alter text/OCR input or private-image verification requests", async () => {
        const withMap = schema();
        const withoutMap = { ...withMap } as Record<string, unknown>;
        delete withoutMap[EXTENSION];
        const textInput = { text: "reader-produced text", modelId: MODEL };
        expect(await requestFor(definition(withMap), textInput)).toEqual(
            await requestFor(definition(withoutMap), textInput),
        );
        const verifier = {
            version: 1,
            promptTemplate: `Verify ${PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER}\n${PRIVATE_IMAGE_SEMANTIC_VALUES_PLACEHOLDER}`,
            requiredFields: ["reading"],
            optionalFields: [],
            semanticFields: [],
        };
        const privateInput = { modelId: MODEL, privateImageEvidence: { primaryText: "Sensor 42" } };
        const a = await requestFor(
            definition({ ...withMap, [AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION]: verifier }),
            privateInput,
        );
        const b = await requestFor(
            definition({ ...withoutMap, [AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION]: verifier }),
            privateInput,
        );
        expect(a).toEqual(b);
        expect(a.image).toBeUndefined();
        expect(a.prompt).toBe('Verify "Sensor 42"\nnull');
    });

    it("retains app post-rules and required-field validation", async () => {
        const def = definition();
        def.rules = [{ kind: "from_message", field: "annotation" }];
        const run = (reading: number) =>
            runAiAction(
                def,
                { image, modelId: MODEL, text: "source caption" },
                "unused",
                async () => ({ kind: "ok", text: JSON.stringify({ reading }) }),
            );
        const valid = await run(42);
        expect(valid.kind).toBe("ready");
        if (valid.kind === "ready")
            expect(valid.extracted).toMatchObject({ reading: 42, annotation: "source caption" });
        expect((await run(0)).kind).not.toBe("ready");
    });

    it("keeps declared focused passes separate and requires v1 for their existing admission", async () => {
        const responseSchema: Record<string, unknown> = {
            ...schema(),
            [AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION]: {
                version: 1,
                primaryFields: ["reading"],
                primaryMaxTokens: 32,
                passes: [
                    {
                        template: "Read annotation only.",
                        fields: ["annotation"],
                        includeRuleGuidance: false,
                        includeMessage: false,
                        maxTokens: 24,
                    },
                ],
            },
        };
        const capture = async (singleImagePass = false) => {
            const requests: InferenceRequest[] = [];
            await runAiAction(
                definition(responseSchema),
                { image, modelId: MODEL, singleImagePass },
                "unused",
                async (request) => {
                    requests.push(request);
                    return {
                        kind: "ok",
                        text:
                            requests.length === 1
                                ? '{"reading":42}'
                                : '{"annotation":"source words"}',
                    };
                },
            );
            return requests;
        };
        const requests = await capture();
        expect(
            requests.map(({ prompt, maxTokens, modelId }) => ({ prompt, maxTokens, modelId })),
        ).toEqual([
            { prompt: variant().template, maxTokens: 32, modelId: MODEL },
            { prompt: "Read annotation only.", maxTokens: 24, modelId: MODEL },
        ]);
        expect(await capture(true)).toHaveLength(1);
        delete responseSchema[LEGACY];
        const withoutLegacy = await capture();
        expect(withoutLegacy).toHaveLength(1);
        expect(withoutLegacy[0].prompt).toBe(variant().template);
        expect(withoutLegacy[0].maxTokens).toBe(256);
    });
});
