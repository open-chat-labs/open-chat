import { describe, expect, it, vi } from "vitest";
import {
    type AiActionDefinition,
    type AiActionDefinitionWire,
    type AiActionRule,
    type AiAppManifestWire,
    aiActionDefinitionFromWire,
    aiAppCardChatContext,
    aiAppManifestFromWire,
    applyRulesPostPass,
    buildActionCardContent,
    buildMultiActionCardContent,
    chatKeyFor,
    AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION,
    AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION,
    AI_ACTION_IMAGE_PROMPT_EXTENSION,
    imageModelPassesConfig,
    imagePromptTemplateConfig,
    MAX_AI_ACTION_IMAGE_MODEL_PASSES,
    MAX_AI_ACTION_IMAGE_PROMPT_BYTES,
    MAX_AI_ACTION_PRIVATE_IMAGE_VERIFIER_PROMPT_BYTES,
    MAX_PRIVATE_IMAGE_EVIDENCE_BYTES,
    MAX_AI_ACTION_CARD_ROW_VALUE_CHARS,
    MAX_AI_ACTION_CARD_TITLE_CHARS,
    MAX_AI_ACTION_CANDIDATES,
    MAX_AI_APP_CONFIRM_PAYLOAD_BYTES,
    multiActionCardBoundsError,
    compileRules,
    formatLocalCalendarDate,
    missingRequired,
    parseExtraction,
    parseExtractionList,
    postProcessAiActionCandidate,
    PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER,
    PRIVATE_IMAGE_SEMANTIC_VALUES_PLACEHOLDER,
    privateImageVerifierConfig,
    rulesFromWire,
    runAiAction,
} from "./aiAction";
import type { InferenceRequest, InferenceResult } from "./onDeviceModel";

const DEF: AiActionDefinition = {
    name: "demo.measurement.add",
    description: "Log measurement",
    promptTemplate: "extract the record as JSON",
    responseSchema: { type: "object" },
    card: {
        title: "Log measurement",
        rows: [
            { label: "Reading", valueKey: "reading" },
            { label: "Unit", valueKey: "unit" },
            { label: "Annotation", valueKey: "annotation" },
        ],
        confirmLabel: "Add",
        cancelLabel: "Dismiss",
    },
    consumerPublicKey: "-----BEGIN PUBLIC KEY-----\nMFk\n-----END PUBLIC KEY-----\n",
};

const RECIPIENT = "-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----\n";

// A definition whose schema requires a POSITIVE reading — used by the multi-entry tests so a
// degenerate element (reading 0) is dropped by the same viability gate the single-entry path uses.
const MULTI_DEF: AiActionDefinition = {
    ...DEF,
    responseSchema: {
        type: "object",
        properties: {
            kind: { type: "string" },
            reading: { type: "number", exclusiveMinimum: 0 },
            unit: { type: "string" },
            annotation: { type: "string" },
        },
        required: ["reading"],
    },
};

// Synthetic multilingual model output exercises complete scalar and duplicate-key recovery.
const TRUNCATED_MODEL_RECORD_WITH_DUPLICATES =
    '{"records":[{"reading":12345,"unit":"HPA","kind":"observed",' +
    '"orientation":"east","annotation":"قراءة الجهاز","message":"تم تسجيل القراءة",' +
    '"date":"14 Aug 2026","annotation":"حساس الضوء","message":"تم تسجيل القراءة",' +
    '"date":"14 Aug ';
const TRUNCATED_MODEL_RECORD_AT_BOUNDARY =
    '{"records":[{"reading":12345,"unit":"HPA","kind":"observed",' +
    '"orientation":"east","annotation":"قراءة الجهاز","message":"تم تسجيل القراءة",' +
    '"date":"14 Aug 2026",';

describe("parseExtractionList", () => {
    it("wraps a single bare object in a one-element list", () => {
        expect(parseExtractionList('{"reading":20,"unit":"LUX"}')).toEqual([
            { reading: 20, unit: "LUX" },
        ]);
    });
    it("parses a bare JSON array of objects", () => {
        expect(parseExtractionList('[{"reading":20},{"reading":30}]')).toEqual([
            { reading: 20 },
            { reading: 30 },
        ]);
    });
    it("unwraps a one-item records array before schema validation", () => {
        expect(
            parseExtractionList('{"records":[{"reading":9757,"unit":"HPA","kind":"observed"}]}'),
        ).toEqual([{ reading: 9757, unit: "HPA", kind: "observed" }]);
    });
    it("parses an array wrapped in prose + ```json fences", () => {
        const text = 'Sure!\n```json\n[{"reading":20},{"reading":30}]\n```\ndone';
        expect(parseExtractionList(text)).toEqual([{ reading: 20 }, { reading: 30 }]);
    });
    it("keeps only object elements of the array, dropping scalars", () => {
        expect(parseExtractionList('[1, {"reading":5}, "x"]')).toEqual([{ reading: 5 }]);
    });
    // A small on-device model routinely fails to close its JSON. Before the balanced-object scan,
    // ANY of these fell through to parseExtraction, which slices first-"{" .. last-"}" — for a
    // multi-object emission that is `{a},{b}`, invalid JSON — so the whole message extracted to
    // NOTHING and the user got "The model found no action in this message" after a long wait.
    it("salvages the complete objects of a TRUNCATED array (no closing bracket)", () => {
        const text =
            '[{"reading":20,"annotation":"light"},{"reading":30,"annotation":"pressure"},{"reading":40,"not';
        expect(parseExtractionList(text)).toEqual([
            { reading: 20, annotation: "light" },
            { reading: 30, annotation: "pressure" },
        ]);
    });
    it("survives a stray '[' in prose ahead of the JSON", () => {
        const text = 'Records [see below]:\n{"reading":20}\n{"reading":30}';
        expect(parseExtractionList(text)).toEqual([{ reading: 20 }, { reading: 30 }]);
    });
    it("survives a trailing comma between elements", () => {
        expect(parseExtractionList('[{"reading":20},{"reading":30},]')).toEqual([
            { reading: 20 },
            { reading: 30 },
        ]);
    });
    it("does not split on a brace inside a quoted string", () => {
        const text =
            '[{"reading":20,"annotation":"measured 50 } later"},{"reading":30,"annotation":"a { b"}';
        expect(parseExtractionList(text)).toEqual([
            { reading: 20, annotation: "measured 50 } later" },
            { reading: 30, annotation: "a { b" },
        ]);
    });
    it("does not split on an ESCAPED quote inside a string", () => {
        const text = '[{"annotation":"say \\"hi\\" }","reading":20},{"reading":30}';
        expect(parseExtractionList(text)).toEqual([
            { annotation: 'say "hi" }', reading: 20 },
            { reading: 30 },
        ]);
    });
    it("skips ONE malformed object without losing the others", () => {
        const text = '[{"reading":20},{"reading":},{"reading":30}]';
        expect(parseExtractionList(text)).toEqual([{ reading: 20 }, { reading: 30 }]);
    });
    it("still returns undefined for an array with no object elements", () => {
        expect(parseExtractionList("[1, 2, 3]")).toBeUndefined();
    });
    it("returns undefined when there is no JSON at all", () => {
        expect(parseExtractionList("no json here")).toBeUndefined();
    });

    it.each([
        ["conflicting scalar", '{"reading":12,"reading":12345}'],
        ["identical scalar", '{"reading":12,"reading":12}'],
        ["optional scalar", '{"reading":12,"unit":"HPA","unit":"LUX"}'],
        ["escaped equivalent name", '{"reading":12,"read\\u0069ng":12345}'],
        ["nested object", '{"reading":12,"details":{"unit":"HPA","unit":"LUX"}}'],
        ["nested array", '{"reading":12,"details":[{"unit":"HPA","unit":"LUX"}]}'],
        ["array envelope", '{"records":[{"reading":12,"reading":12345}]}'],
        ["duplicate envelope key", '{"records":[{"reading":12}],"records":[{"reading":20}]}'],
        ["duplicate before valid record", '[{"reading":12,"reading":12345},{"reading":20}]'],
        ["duplicate after valid record", '[{"reading":20},{"reading":12,"reading":12345}]'],
        [
            "separate fenced blocks",
            '```json\n{"reading":20}\n```\n```json\n{"reading":12,"reading":12345}\n```',
        ],
        ["unclosed fence", '```json\n{"reading":12,"reading":12345}'],
        ["unclosed wrapper with conflicting child", '{"records":[{"reading":12,"reading":12345}]'],
        ["unclosed wrapper with identical child", '{"records":[{"reading":12,"reading":12},'],
        [
            "unclosed wrapper with valid and duplicate children",
            '{"records":[{"reading":20},{"reading":12,"reading":12345}]',
        ],
        [
            "single-object fallback after unclosed prose quote",
            'Result "below: {"reading":12,"reading":12345}',
        ],
    ])(
        "rejects balanced duplicate names without fallback or partial batch acceptance: %s",
        (_label, raw) => {
            expect(parseExtractionList(raw)).toBeUndefined();
        },
    );

    it("keeps property-name scopes separate and ignores key-like text inside values", () => {
        const entries = [
            {
                reading: 12,
                Reading: 13,
                details: { reading: 14 },
                annotation: 'a { brace } and "reading": 99',
            },
            { reading: 20, details: [{ reading: 21 }, { reading: 22 }] },
        ];
        expect(parseExtractionList(JSON.stringify(entries))).toEqual(entries);
    });

    it("checks deeply nested objects without recursive property traversal", () => {
        const depth = 2_000;
        const wrap = (leaf: string) =>
            '{"reading":12,"details":' + '{"unit":'.repeat(depth) + leaf + "}".repeat(depth + 1);
        expect(parseExtractionList(wrap("1"))?.[0].reading).toBe(12);
        expect(parseExtractionList(wrap('{"unit":1,"unit":2}'))).toBeUndefined();
    });

    it("salvages only the complete scalar prefix of a truncated wrapped object", () => {
        expect(parseExtractionList(TRUNCATED_MODEL_RECORD_AT_BOUNDARY)).toEqual([
            {
                reading: 12_345,
                unit: "HPA",
                kind: "observed",
                orientation: "east",
                annotation: "قراءة الجهاز",
                message: "تم تسجيل القراءة",
                date: "14 Aug 2026",
            },
        ]);
    });

    it("tombstones ambiguous duplicates while coalescing identical complete scalars", () => {
        expect(
            parseExtractionList(
                '{"reading":12,"unit":"HPA","kind":"observed","orientation":"east","reading":12345',
            ),
        ).toEqual([
            {
                reading: undefined,
                unit: "HPA",
                kind: "observed",
                orientation: "east",
            },
        ]);
        expect(parseExtractionList('{"reading":12,"reading":12,"unit":"HPA",')).toEqual([
            { reading: 12, unit: "HPA" },
        ]);
        expect(parseExtractionList('{"reading":12,"unit":"HPA","reading":"trunc')).toEqual([
            { reading: undefined, unit: "HPA" },
        ]);
    });

    it("does not salvage a truncated prefix containing unsafe, nested, or malformed members", () => {
        expect(
            parseExtractionList(
                '{"records":[{"reading":12345,"__proto__":"poison","annotation":"truncated',
            ),
        ).toBeUndefined();
        expect(
            parseExtractionList(
                '{"records":[{"reading":12345,"details":{"unit":"HPA"},"annotation":"truncated',
            ),
        ).toBeUndefined();
        expect(parseExtractionList('{"reading":12345 unit')).toBeUndefined();
        expect(parseExtractionList('{"reading":12345,,')).toBeUndefined();
        expect(parseExtractionList('{"reading":1,"reading":1.e')).toBeUndefined();
        expect(parseExtractionList('{"reading":12')).toBeUndefined();
        expect(parseExtractionList('{"reading":12345,"annotation":"trunc')).toBeUndefined();
        expect(parseExtractionList('{"reading":12345,"no')).toBeUndefined();
    });

    it.each([31, 32])(
        "posts the valid %i-candidate boundary as one exact multi-entry card",
        async (count) => {
            const raw = JSON.stringify(
                Array.from({ length: count }, (_, i) => ({
                    reading: i + 1,
                    annotation: `entry-${i}`,
                })),
            );
            expect(parseExtractionList(raw)).toHaveLength(count);
            const result = await runAiAction(MULTI_DEF, { text: "many" }, RECIPIENT, async () => ({
                kind: "ok",
                text: raw,
            }));
            expect(result.kind).toBe("ready_multi");
            if (result.kind === "ready_multi") {
                expect(result.extracted).toHaveLength(count);
                expect(result.card.rows).toHaveLength(count);
                expect(JSON.parse(new TextDecoder().decode(result.card.confirmPayload!))).toEqual(
                    JSON.parse(raw),
                );
                expect(result.card.rows.some((row) => row.label.startsWith("__oc_"))).toBe(false);
            }
        },
    );

    it("stops at a 33rd overflow sentinel and rejects before per-candidate work", async () => {
        const entries = Array.from({ length: MAX_AI_ACTION_CANDIDATES + 1 }, (_, i) => ({
            reading: i + 1,
        }));
        const raw = JSON.stringify({ records: entries });
        expect(parseExtractionList(raw)).toHaveLength(MAX_AI_ACTION_CANDIDATES + 1);
        const result = await runAiAction(MULTI_DEF, { text: "many" }, RECIPIENT, async () => ({
            kind: "ok",
            text: raw,
        }));
        expect(result).toEqual({
            kind: "error",
            error: `The model returned more than ${MAX_AI_ACTION_CANDIDATES} action candidates.`,
        });
    });

    it("rejects oversized model output without scanning it", () => {
        expect(parseExtractionList(`{"reading":1}${" ".repeat(131_072)}`)).toBeUndefined();
    });
});

describe("parseExtraction", () => {
    it("parses a bare JSON object", () => {
        expect(parseExtraction('{"reading":20,"unit":"LUX"}')).toEqual({
            reading: 20,
            unit: "LUX",
        });
    });
    it("parses JSON wrapped in prose + ```json fences", () => {
        const text = 'Sure!\n```json\n{"reading": 20, "unit": "LUX"}\n```\nHope that helps.';
        expect(parseExtraction(text)).toEqual({ reading: 20, unit: "LUX" });
    });
    it("returns undefined when there is no JSON object", () => {
        expect(parseExtraction("no json here")).toBeUndefined();
    });
    it.each([
        '{"reading":12,"reading":12345}',
        '{"reading":12,"reading":12}',
        '{"reading":12,"read\\u0069ng":12345}',
        '```json\n{"reading":12,"details":{"unit":"HPA","unit":"LUX"}}\n```',
    ])("rejects duplicate names in the single-object entry point: %s", (raw) => {
        expect(parseExtraction(raw)).toBeUndefined();
    });
});

describe("buildActionCardContent", () => {
    it("maps template rows from the extraction and sets the inbox routing", () => {
        const extracted = { reading: 20, unit: "LUX", annotation: "lunch" };
        const card = buildActionCardContent(DEF, extracted, RECIPIENT);
        expect(card.kind).toBe("action_card_content");
        expect(card.actionId).toBe("demo.measurement.add");
        expect(card.rows).toEqual([
            { label: "Reading", value: "20" },
            { label: "Unit", value: "LUX" },
            { label: "Annotation", value: "lunch" },
        ]);
        expect(card.recipientPublicKey).toBe(RECIPIENT);
        // confirmPayload is the verbatim JSON of the extraction — what the consumer decrypts + parses.
        expect(JSON.parse(new TextDecoder().decode(card.confirmPayload!))).toEqual(extracted);
    });
    it("drops rows whose value is missing/empty", () => {
        const card = buildActionCardContent(DEF, { reading: 20, unit: "LUX" }, RECIPIENT);
        expect(card.rows.map((r) => r.label)).toEqual(["Reading", "Unit"]);
    });
    it("threads the optional per-app inbox onto the card, undefined when omitted", () => {
        const withInbox = buildActionCardContent(
            DEF,
            { reading: 1, unit: "LUX" },
            RECIPIENT,
            "aaaaa-aa",
        );
        expect(withInbox.inboxCanisterId).toBe("aaaaa-aa");
        const withoutInbox = buildActionCardContent(DEF, { reading: 1, unit: "LUX" }, RECIPIENT);
        expect(withoutInbox.inboxCanisterId).toBeUndefined();
    });
    it("fan-out: carries additional recipient keys, dropping empties and the primary key", () => {
        const card = buildActionCardContent(
            DEF,
            { reading: 1, unit: "LUX" },
            RECIPIENT,
            undefined,
            [
                "OTHER_KEY_PEM",
                "", // empty entries are dropped
                RECIPIENT, // the primary key never repeats in the fan-out list
                "SECOND_OTHER_KEY_PEM",
            ],
        );
        expect(card.recipientPublicKey).toBe(RECIPIENT);
        expect(card.recipientPublicKeys).toEqual(["OTHER_KEY_PEM", "SECOND_OTHER_KEY_PEM"]);
    });
    it("fan-out: recipientPublicKeys is undefined when no additional keys are supplied", () => {
        const card = buildActionCardContent(DEF, { reading: 1, unit: "LUX" }, RECIPIENT);
        expect(card.recipientPublicKeys).toBeUndefined();
    });
    it("single-entry card carries no reserved transport row", () => {
        const card = buildActionCardContent(
            DEF,
            { reading: 20, unit: "LUX", annotation: "lunch" },
            RECIPIENT,
        );
        expect(card.rows.some((r) => r.label.startsWith("__oc_"))).toBe(false);
    });
    it("bakes the owning appId onto the card (undefined when omitted)", () => {
        const withApp = buildActionCardContent(
            DEF,
            { reading: 1, unit: "LUX" },
            RECIPIENT,
            undefined,
            undefined,
            42,
        );
        expect(withApp.appId).toBe(42);
        const withoutApp = buildActionCardContent(DEF, { reading: 1, unit: "LUX" }, RECIPIENT);
        expect(withoutApp.appId).toBeUndefined();
    });
});

describe("runAiAction", () => {
    const okInfer =
        (text: string) =>
        async (_req: InferenceRequest): Promise<InferenceResult> => ({ kind: "ok", text });

    describe("app-declared private image verifier contract", () => {
        const promptTemplate =
            "VERIFY_ARBITRARY_MEASUREMENT\nSOURCE=" +
            PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER +
            "\nTAGS=" +
            PRIVATE_IMAGE_SEMANTIC_VALUES_PLACEHOLDER;
        const responseSchema = {
            type: "object",
            [AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION]: {
                version: 1,
                promptTemplate,
                requiredFields: ["reading", "unit_code", "classification", "orientation"],
                optionalFields: ["observed_on"],
                semanticFields: ["classification", "orientation"],
            },
            properties: {
                reading: { type: "number" },
                unit_code: { type: "string" },
                classification: { type: "string", enum: ["nominal", "alert"] },
                orientation: { type: "string", enum: ["west", "east"] },
                observed_on: { type: "string" },
                annotation: { type: "string" },
            },
            required: ["reading", "unit_code", "classification", "orientation"],
        };
        const def: AiActionDefinition = {
            ...DEF,
            name: "demo.measurement.capture",
            acceptsImage: true,
            responseSchema,
            rules: [],
            card: {
                ...DEF.card,
                rows: [
                    { label: "Reading", valueKey: "reading" },
                    { label: "Unit", valueKey: "unit_code" },
                    { label: "Class", valueKey: "classification" },
                    { label: "Axis", valueKey: "orientation" },
                    { label: "Observed", valueKey: "observed_on" },
                ],
            },
        };

        it("forwards the exact bounded app prompt and filters to its declared output fields", async () => {
            const primaryText = "METER 42 ZX\nOBSERVED 2026-09-03";
            const semanticValues = {
                classification: ["nominal"],
                orientation: ["west"],
            };
            let seen: InferenceRequest | undefined;
            const result = await runAiAction(
                def,
                { privateImageEvidence: { primaryText, semanticValues } },
                RECIPIENT,
                async (request) => {
                    seen = request;
                    return {
                        kind: "ok",
                        text: '{"reading":42,"unit_code":"ZX","classification":"nominal","orientation":"west","observed_on":"2026-09-03","annotation":"MODEL_ONLY","unknown":"DROP"}',
                    };
                },
            );

            expect(seen).toMatchObject({
                prompt: promptTemplate
                    .replace(
                        PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER,
                        JSON.stringify(primaryText),
                    )
                    .replace(
                        PRIVATE_IMAGE_SEMANTIC_VALUES_PLACEHOLDER,
                        JSON.stringify(semanticValues),
                    ),
                responseMode: "json",
                maxTokens: 256,
            });
            expect(seen?.image).toBeUndefined();
            expect(seen?.text).toBeUndefined();
            expect(result).toMatchObject({
                kind: "ready",
                extracted: {
                    reading: 42,
                    unit_code: "ZX",
                    classification: "nominal",
                    orientation: "west",
                    observed_on: "2026-09-03",
                },
            });
            expect(JSON.stringify(result)).not.toContain("MODEL_ONLY");
            expect(JSON.stringify(result)).not.toContain("unknown");
        });

        it("rejects absent or malformed verifier declarations before inference", async () => {
            expect(privateImageVerifierConfig(responseSchema)).toEqual({
                promptTemplate,
                requiredFields: ["reading", "unit_code", "classification", "orientation"],
                optionalFields: ["observed_on"],
                semanticFields: ["classification", "orientation"],
                ocrProfiles: ["eng"],
            });

            const multilingualSchema = {
                ...structuredClone(responseSchema),
                [AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION]: {
                    ...structuredClone(responseSchema[AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION]),
                    version: 2,
                    ocrProfiles: ["eng", "ara+eng"],
                },
            };
            expect(privateImageVerifierConfig(multilingualSchema)?.ocrProfiles).toEqual([
                "eng",
                "ara+eng",
            ]);
            for (const ocrProfiles of [[], ["fra"], ["eng", "eng"], ["eng", "ara+eng", "eng"]]) {
                const invalidProfiles = structuredClone(multilingualSchema);
                invalidProfiles[AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION].ocrProfiles =
                    ocrProfiles;
                expect(privateImageVerifierConfig(invalidProfiles)).toBeUndefined();
            }

            const malformedSchema = structuredClone(responseSchema);
            malformedSchema[AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION].promptTemplate =
                PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER +
                PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER +
                PRIVATE_IMAGE_SEMANTIC_VALUES_PLACEHOLDER;
            expect(privateImageVerifierConfig(malformedSchema)).toBeUndefined();

            const infer = vi.fn(okInfer("{}"));
            for (const invalidSchema of [
                { type: "object", properties: responseSchema.properties },
                malformedSchema,
            ]) {
                await expect(
                    runAiAction(
                        { ...def, responseSchema: invalidSchema },
                        { privateImageEvidence: { primaryText: "METER 42 ZX" } },
                        RECIPIENT,
                        infer,
                    ),
                ).resolves.toEqual({
                    kind: "error",
                    error: "The private image evidence is invalid.",
                });
            }
            expect(infer).not.toHaveBeenCalled();
        });
    });

    describe("private image evidence", () => {
        const compact = "Extract the visible record as strict JSON.";
        const verifierTemplate =
            "APP_DEFINED_VERIFIER_SENTINEL\nPRIMARY=" +
            PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER +
            "\nSEMANTIC=" +
            PRIVATE_IMAGE_SEMANTIC_VALUES_PLACEHOLDER;
        const privateDef: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                [AI_ACTION_IMAGE_PROMPT_EXTENSION]: {
                    version: 1,
                    template: compact,
                    includeRuleGuidance: true,
                },
                [AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION]: {
                    version: 1,
                    promptTemplate: verifierTemplate,
                    requiredFields: ["reading", "unit", "kind", "orientation"],
                    optionalFields: ["date"],
                    semanticFields: ["kind", "orientation"],
                },
                properties: {
                    reading: { type: "number", minimum: 0.005 },
                    unit: {
                        type: "string",
                        minLength: 3,
                        maxLength: 3,
                        format: "ascii-uppercase",
                    },
                    kind: { type: "string", enum: ["observed", "scheduled"] },
                    orientation: {
                        type: "string",
                        enum: ["east", "west"],
                        "x-openchat-default-for-image-only": "east",
                    },
                    date: { type: "string" },
                    message: {
                        type: "string",
                        maxLength: 200,
                        format: "utf8-no-nul",
                        "x-openchat-omit-for-image-only": true,
                    },
                    device: { type: "string", maxLength: 200, format: "utf8-no-nul" },
                },
                required: ["reading", "unit", "kind", "orientation"],
            },
            rules: [
                {
                    kind: "instruction",
                    text: "APP_RULE_GUIDANCE_MUST_NOT_ENTER_PRIVATE_VERIFIER",
                },
                { kind: "from_message", field: "message", maxLength: 200 },
            ],
        };
        const primaryText = "12,345 HPA\nSensor Reading\n14 Aug 2026\nDEVICE_SENTINEL_987654321";
        const semanticValues = { kind: ["observed"], orientation: ["east"] };

        it("uses only compact-v2 verifier policy without pixels or private OCR in the card", async () => {
            let seen: InferenceRequest | undefined;
            const result = await runAiAction(
                privateDef,
                { privateImageEvidence: { primaryText, semanticValues } },
                RECIPIENT,
                async (request) => {
                    seen = request;
                    return {
                        kind: "ok",
                        text: '{"reading":1500,"unit":"LUX","kind":"observed","orientation":"east","message":"DEVICE_SENTINEL_987654321","device":"DEVICE_SENTINEL_987654321","echo":"SEMANTIC_SENTINEL"}',
                    };
                },
            );

            expect(new TextEncoder().encode(verifierTemplate).byteLength).toBeLessThanOrEqual(
                MAX_AI_ACTION_PRIVATE_IMAGE_VERIFIER_PROMPT_BYTES,
            );
            expect(seen?.prompt).toBe(
                verifierTemplate
                    .replace(
                        PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER,
                        JSON.stringify(primaryText),
                    )
                    .replace(
                        PRIVATE_IMAGE_SEMANTIC_VALUES_PLACEHOLDER,
                        JSON.stringify(semanticValues),
                    ),
            );
            expect(seen?.prompt).not.toContain(compact);
            expect(seen?.prompt).not.toContain(DEF.promptTemplate);
            expect(seen?.prompt).not.toContain("Rules:");
            expect(seen?.prompt).not.toContain("APP_RULE_GUIDANCE_MUST_NOT_ENTER_PRIVATE_VERIFIER");
            expect(seen?.prompt).not.toContain("Message:\n");
            expect(seen?.image).toBeUndefined();
            expect(seen?.text).toBeUndefined();
            expect(result).toMatchObject({
                kind: "ready",
                extracted: {
                    reading: 1500,
                    unit: "LUX",
                    kind: "observed",
                    orientation: "east",
                },
            });
            const serialized = JSON.stringify(result);
            expect(serialized).not.toContain("DEVICE_SENTINEL");
            expect(serialized).not.toContain("SEMANTIC_SENTINEL");
            if (result.kind === "ready") {
                const payload = new TextDecoder().decode(result.card.confirmPayload);
                expect(payload).not.toContain("DEVICE_SENTINEL");
                expect(payload).not.toContain("SEMANTIC_SENTINEL");
            }
        });

        it("scrubs model output from no-extraction and incomplete private-image results", async () => {
            const noExtraction = await runAiAction(
                privateDef,
                { privateImageEvidence: { primaryText, semanticValues } },
                RECIPIENT,
                okInfer("DEVICE_SENTINEL_987654321"),
            );
            expect(noExtraction).toEqual({ kind: "no_extraction", raw: "" });

            const incomplete = await runAiAction(
                privateDef,
                { privateImageEvidence: { primaryText, semanticValues } },
                RECIPIENT,
                okInfer('{"message":"DEVICE_SENTINEL_987654321"}'),
            );
            expect(incomplete).toMatchObject({
                kind: "incomplete_extraction",
                raw: "",
                missingFields: ["kind", "orientation", "reading", "unit"],
            });
            expect(JSON.stringify(incomplete)).not.toContain("DEVICE_SENTINEL");

            const defaultableDirection = await runAiAction(
                privateDef,
                { privateImageEvidence: { primaryText, semanticValues } },
                RECIPIENT,
                okInfer('{"reading":12345,"unit":"HPA","kind":"observed","date":"2026-08-14"}'),
            );
            expect(defaultableDirection).toMatchObject({
                kind: "incomplete_extraction",
                raw: "",
                missingFields: ["orientation"],
                validCandidateCount: 0,
            });

            const unavailable = await runAiAction(
                privateDef,
                { privateImageEvidence: { primaryText, semanticValues } },
                RECIPIENT,
                async () => ({
                    kind: "unavailable",
                    reason: "runtime echoed DEVICE_SENTINEL_987654321",
                }),
            );
            expect(unavailable).toEqual({
                kind: "unavailable",
                reason: "The private image verification model is unavailable.",
            });

            const error = await runAiAction(
                privateDef,
                { privateImageEvidence: { primaryText, semanticValues } },
                RECIPIENT,
                async () => ({
                    kind: "error",
                    error: "runtime echoed DEVICE_SENTINEL_987654321",
                }),
            );
            expect(error).toEqual({
                kind: "error",
                error: "Private image verification inference failed.",
            });
            expect(JSON.stringify([unavailable, error])).not.toContain("DEVICE_SENTINEL");
        });

        it("rejects mixed, empty, NUL-bearing, or oversized private evidence before inference", async () => {
            const infer = vi.fn(okInfer("{}"));
            const invalidInputs: Parameters<typeof runAiAction>[1][] = [
                {
                    image: new Uint8Array([1]),
                    privateImageEvidence: { primaryText },
                },
                { text: "ordinary text", privateImageEvidence: { primaryText } },
                { privateImageEvidence: { primaryText: "" } },
                { privateImageEvidence: { primaryText: "12,345 HPA\u0000secret" } },
                {
                    privateImageEvidence: {
                        primaryText: "x".repeat(MAX_PRIVATE_IMAGE_EVIDENCE_BYTES + 1),
                    },
                },
                {
                    privateImageEvidence: {
                        primaryText,
                        semanticValues: { kind: ["observed\u0000"] },
                    },
                },
                {
                    privateImageEvidence: {
                        primaryText,
                        semanticValues: { undeclared_field: ["value"] },
                    },
                },
            ];

            for (const input of invalidInputs) {
                await expect(runAiAction(privateDef, input, RECIPIENT, infer)).resolves.toEqual({
                    kind: "error",
                    error: "The private image evidence is invalid.",
                });
            }
            expect(infer).not.toHaveBeenCalled();
        });
    });

    it("runs the model, parses, and builds a ready card", async () => {
        const r = await runAiAction(
            DEF,
            { text: "I measured $20 LUX for lunch" },
            RECIPIENT,
            okInfer('{"reading":20,"unit":"LUX","annotation":"lunch"}'),
        );
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            expect(r.card.rows[0]).toEqual({ label: "Reading", value: "20" });
            expect(r.extracted.unit).toBe("LUX");
            expect(ArrayBuffer.isView(r.card.confirmPayload)).toBe(true);
        }
    });

    it("turns a destroyed native inference context into a bounded sanitized model error", async () => {
        const infer = vi.fn(async (): Promise<InferenceResult> => {
            throw new Error(`device\u0000lost?token=do-not-show&mode=test ${"x".repeat(400)}`);
        });

        const result = await runAiAction(DEF, { text: "I measured 20 LUX" }, RECIPIENT, infer);

        expect(result.kind).toBe("error");
        if (result.kind === "error") {
            expect(result.error).toContain("device lost?token=[redacted]&mode=test");
            expect(result.error).not.toContain("do-not-show");
            expect(result.error).not.toContain("\u0000");
            expect(result.error.endsWith("…")).toBe(true);
            expect(result.error.length).toBeLessThanOrEqual(240);
        }
        expect(infer).toHaveBeenCalledOnce();
    });

    it("bounds an error-shaped native bridge result before returning it to the UI", async () => {
        const infer = vi.fn(
            async (): Promise<InferenceResult> => ({
                kind: "error",
                error: `load failed?key=do-not-show&stage=model ${"y".repeat(400)}`,
            }),
        );

        const result = await runAiAction(DEF, { text: "I measured 20 LUX" }, RECIPIENT, infer);

        expect(result.kind).toBe("error");
        if (result.kind === "error") {
            expect(result.error).toContain("load failed?key=[redacted]&stage=model");
            expect(result.error).not.toContain("do-not-show");
            expect(result.error.endsWith("…")).toBe(true);
            expect(result.error.length).toBeLessThanOrEqual(240);
        }
    });

    it("builds an image card from Qwen's exact duplicated truncated reply without a second inference", async () => {
        const reportDef: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                properties: {
                    kind: {
                        type: "string",
                        enum: ["observed", "scheduled"],
                        "x-openchat-require-explicit-for-image-only": true,
                    },
                    reading: { type: "number", minimum: 0.005 },
                    unit: {
                        type: "string",
                        minLength: 3,
                        maxLength: 3,
                        format: "ascii-uppercase",
                    },
                    orientation: {
                        type: "string",
                        enum: ["east", "west"],
                        "x-openchat-default-for-image-only": "east",
                    },
                    date: {
                        type: "string",
                        format: "date",
                    },
                    annotation: { type: "string", maxLength: 4_096, format: "utf8-no-nul" },
                    message: {
                        type: "string",
                        maxLength: 200,
                        format: "utf8-no-nul",
                        "x-openchat-omit-for-image-only": true,
                    },
                },
                required: ["reading", "kind", "orientation"],
            },
        };
        const infer = vi.fn(okInfer(TRUNCATED_MODEL_RECORD_WITH_DUPLICATES));

        const result = await runAiAction(
            reportDef,
            { image: new Uint8Array([1, 2, 3]) },
            RECIPIENT,
            infer,
        );

        expect(infer).toHaveBeenCalledOnce();
        expect(result.kind).toBe("ready");
        if (result.kind === "ready") {
            expect(result.extracted).toEqual({
                reading: 12_345,
                unit: "HPA",
                kind: "observed",
                orientation: "east",
            });
        }
    });
    it("rejects balanced duplicate names but keeps truncated duplicate tombstones", async () => {
        const reportDef: AiActionDefinition = {
            ...MULTI_DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number", minimum: 0.005 },
                    unit: { type: "string", minLength: 3, maxLength: 3 },
                    kind: { type: "string", enum: ["observed", "scheduled"] },
                    orientation: { type: "string", enum: ["east", "west"] },
                },
                required: ["reading", "kind", "orientation"],
            },
        };
        const balanced =
            '{"reading":12,"unit":"HPA","kind":"observed","orientation":"east","reading":12345}';
        const correctedButTruncated = balanced.slice(0, -1);

        const balancedInfer = vi.fn(okInfer(balanced));
        const balancedResult = await runAiAction(
            reportDef,
            { image: new Uint8Array([1]) },
            RECIPIENT,
            balancedInfer,
        );
        expect(balancedInfer).toHaveBeenCalledOnce();
        // Balanced JSON used to let JSON.parse silently choose the last value. A model's later
        // duplicate is not evidence of a correction, so ambiguity must not become a ready card.
        expect(balancedResult.kind).toBe("no_extraction");

        const truncatedInfer = vi.fn(okInfer(correctedButTruncated));
        const truncatedResult = await runAiAction(
            reportDef,
            { image: new Uint8Array([1]) },
            RECIPIENT,
            truncatedInfer,
        );
        expect(truncatedInfer).toHaveBeenCalledOnce();
        expect(truncatedResult).toMatchObject({
            kind: "incomplete_extraction",
            missingFields: ["reading"],
            candidateCount: 1,
            validCandidateCount: 0,
        });
    });
    it("maps an opted-in image property alias before schema validation", async () => {
        const aliasDef: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number" },
                    date: {
                        type: "string",
                        format: "date",

                        "x-openchat-property-aliases": ["recorded_on"],
                    },
                },
                required: ["reading"],
            },
        };
        const infer = vi.fn(okInfer('{"reading":350,"recorded_on":"2026-07-04"}'));
        const result = await runAiAction(
            aliasDef,
            { image: new Uint8Array([1, 2, 3]) },
            RECIPIENT,
            infer,
        );

        expect(infer).toHaveBeenCalledOnce();
        expect(result.kind).toBe("ready");
        if (result.kind === "ready") {
            expect(result.extracted).toEqual({ reading: 350, date: "2026-07-04" });
            expect(result.extracted).not.toHaveProperty("recorded_on");
        }
    });
    // The browser backend appends request.text to request.prompt, and the prompt ALREADY carries the
    // message (the native runtime reads only `prompt`). Passing both captured the model the same message
    // twice and it extracted some records twice — "scan me 300 pressure 150 light" came back with 300
    // repeated. Native never saw it, so it read like small-model flakiness.
    it("sends the message EXACTLY ONCE — inlined in the prompt, never also as `text`", async () => {
        const seen: InferenceRequest[] = [];
        const capture = async (req: InferenceRequest): Promise<InferenceResult> => {
            seen.push(req);
            return { kind: "ok", text: '{"reading":20,"unit":"LUX","annotation":"lunch"}' };
        };
        const message = "scan me 300 pressure 150 light";
        await runAiAction(DEF, { text: message }, RECIPIENT, capture);

        expect(seen).toHaveLength(1);
        // No `text` field at all: anything that concatenates prompt+text cannot double the message.
        expect(seen[0].text).toBeUndefined();
        expect(seen[0].prompt).toContain(message);
        expect(seen[0].prompt.split(message).length - 1).toBe(1);
    });

    it("does not add undeclared date context to text input", async () => {
        let seen: InferenceRequest | undefined;
        await runAiAction(DEF, { text: "measured 20 today" }, RECIPIENT, async (req) => {
            seen = req;
            return { kind: "ok", text: '{"reading":20,"unit":"LUX"}' };
        });

        expect(seen?.prompt).toBe(`${DEF.promptTemplate}\n\nMessage:\nmeasured 20 today`);
        expect(seen?.prompt).not.toContain("Today is ");
    });

    it("propagates unavailable (no autonomous fallback)", async () => {
        const r = await runAiAction(DEF, {}, RECIPIENT, async () => ({
            kind: "unavailable",
            reason: "no native runtime",
        }));
        expect(r.kind).toBe("unavailable");
    });
    it("reports no_extraction when the model returns no JSON", async () => {
        const infer = vi.fn(okInfer("I couldn't find a record."));
        const r = await runAiAction(DEF, { text: "hello" }, RECIPIENT, infer);
        expect(r.kind).toBe("no_extraction");
        expect(infer).toHaveBeenCalledTimes(2);
    });
    it("repairs one non-JSON response with a bounded JSON-only retry", async () => {
        const seen: InferenceRequest[] = [];
        const outputs = [
            "I found three measurements but cannot format them.",
            '[{"reading":200,"annotation":"pressure"},{"reading":400,"annotation":"light"},{"reading":250,"annotation":"order"}]',
        ];
        const r = await runAiAction(
            DEF,
            { text: "scan me 200 pressure 400 light 250 order" },
            RECIPIENT,
            async (request) => {
                seen.push(request);
                return { kind: "ok", text: outputs.shift() ?? "" };
            },
        );

        expect(r.kind).toBe("ready_multi");
        expect(seen).toHaveLength(2);
        expect(seen[0].maxTokens).toBe(256);
        expect(seen[1].prompt).toContain("Return ONLY valid JSON");
        expect(seen[1].prompt).toContain("scan me 200 pressure 400 light 250 order");
        expect(seen[1].text).toBeUndefined();
        expect(seen[1].maxTokens).toBe(256);
    });

    describe("image-specific prompt extension", () => {
        const compact = "Read the image and return only the supported record fields as JSON.";

        function schemaWith(extension: unknown): object {
            return {
                type: "object",
                [AI_ACTION_IMAGE_PROMPT_EXTENSION]: extension,
                properties: {
                    reading: { type: "number" },
                    kind: { type: "string", enum: ["scheduled", "observed"] },
                    annotation: { type: "string" },
                },
                required: ["reading", "kind"],
            };
        }

        it("uses the compact prompt only for images and can omit only model-facing rule guidance", async () => {
            const def: AiActionDefinition = {
                ...DEF,
                acceptsImage: true,
                responseSchema: schemaWith({
                    version: 1,
                    template: compact,
                    includeRuleGuidance: false,
                }),
                rules: [
                    {
                        kind: "instruction",
                        text: "This guidance must stay out of the compact prompt.",
                    },
                    {
                        kind: "keyword_map",
                        field: "kind",
                        mode: "override",
                        map: [{ value: "observed", keywords: ["measured"] }],
                    },
                ],
            };
            const seen: InferenceRequest[] = [];
            const imageResult = await runAiAction(
                def,
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                async (request) => {
                    seen.push(request);
                    return {
                        kind: "ok",
                        text: '{"reading":20,"kind":"scheduled","annotation":"measured"}',
                    };
                },
            );
            await runAiAction(def, { text: "measured 20" }, RECIPIENT, async (request) => {
                seen.push(request);
                return { kind: "ok", text: '{"reading":20,"kind":"observed"}' };
            });

            expect(seen[0].prompt).toBe(compact);
            expect(seen[0].prompt).not.toContain("Rules:");
            expect(seen[1].prompt).toBe(
                `${DEF.promptTemplate}\n\n` +
                    `Rules:\n` +
                    `- This guidance must stay out of the compact prompt.\n` +
                    `- Set "kind" to "observed" when the message mentions any of: measured\n\n` +
                    `Message:\nmeasured 20`,
            );
            expect(imageResult.kind).toBe("ready");
            if (imageResult.kind === "ready") {
                // With no caption/source text, model-authored strings are not authoritative evidence
                // for a deterministic keyword override.
                expect(imageResult.extracted.kind).toBe("scheduled");
            }
        });

        it("retains an attached image caption without restoring omitted rule guidance", async () => {
            const def: AiActionDefinition = {
                ...DEF,
                acceptsImage: true,
                responseSchema: schemaWith({
                    version: 1,
                    template: compact,
                    includeRuleGuidance: false,
                }),
                rules: [
                    { kind: "instruction", text: "Do not append this line." },
                    { kind: "from_message", field: "annotation" },
                ],
            };
            let seen: InferenceRequest | undefined;
            const result = await runAiAction(
                def,
                { image: new Uint8Array([1]), text: "Dinner with Mickey" },
                RECIPIENT,
                async (request) => {
                    seen = request;
                    return { kind: "ok", text: '{"reading":20,"kind":"scheduled"}' };
                },
            );

            expect(seen?.prompt).toBe(`${compact}\n\nMessage:\nDinner with Mickey`);
            expect(seen?.prompt).not.toContain("Rules:");
            expect(result.kind).toBe("ready");
            if (result.kind === "ready") {
                expect(result.extracted.annotation).toBe("Dinner with Mickey");
            }
        });

        it("accepts only the exact bounded extension shape and otherwise uses the legacy prompt", async () => {
            expect(
                imagePromptTemplateConfig(
                    schemaWith({ version: 1, template: compact, includeRuleGuidance: true }),
                ),
            ).toEqual({ template: compact, includeRuleGuidance: true });
            const multilingual = "اقرأ الصورة كما هي.\n\r\tأعد 👩‍💻️ JSON فقط.";
            expect(
                imagePromptTemplateConfig(
                    schemaWith({
                        version: 1,
                        template: multilingual,
                        includeRuleGuidance: false,
                    }),
                ),
            ).toEqual({ template: multilingual, includeRuleGuidance: false });
            const exactUtf8Limit = "ع".repeat(MAX_AI_ACTION_IMAGE_PROMPT_BYTES / 2);
            expect(new TextEncoder().encode(exactUtf8Limit)).toHaveLength(
                MAX_AI_ACTION_IMAGE_PROMPT_BYTES,
            );
            expect(
                imagePromptTemplateConfig(
                    schemaWith({
                        version: 1,
                        template: exactUtf8Limit,
                        includeRuleGuidance: false,
                    }),
                )?.template,
            ).toBe(exactUtf8Limit);

            const invalid = [
                undefined,
                null,
                compact,
                { version: 2, template: compact, includeRuleGuidance: false },
                { version: 1, template: " ", includeRuleGuidance: false },
                {
                    version: 1,
                    template: `${exactUtf8Limit}ع`,
                    includeRuleGuidance: false,
                },
                { version: 1, template: "read\u0000image", includeRuleGuidance: false },
                { version: 1, template: "read\u0001image", includeRuleGuidance: false },
                { version: 1, template: "read\u202eimage", includeRuleGuidance: false },
                { version: 1, template: "read\ud800image", includeRuleGuidance: false },
                { version: 1, template: compact, includeRuleGuidance: "no" },
                { version: 1, template: compact },
                { template: compact, includeRuleGuidance: false },
                {
                    version: 1,
                    template: compact,
                    includeRuleGuidance: false,
                    extra: true,
                },
            ];

            for (const extension of invalid) {
                expect(imagePromptTemplateConfig(schemaWith(extension))).toBeUndefined();
            }

            const def: AiActionDefinition = {
                ...DEF,
                acceptsImage: true,
                responseSchema: schemaWith({
                    version: 1,
                    template: compact,
                    includeRuleGuidance: false,
                    extra: true,
                }),
                rules: [{ kind: "instruction", text: "Legacy guidance." }],
            };
            let seen: InferenceRequest | undefined;
            await runAiAction(def, { image: new Uint8Array([1]) }, RECIPIENT, async (request) => {
                seen = request;
                return { kind: "ok", text: '{"reading":20,"kind":"scheduled"}' };
            });
            expect(seen?.prompt).toBe(`${DEF.promptTemplate}\n\nRules:\n- Legacy guidance.`);
        });

        it("appends rule guidance to a compact image prompt only when explicitly requested", async () => {
            const def: AiActionDefinition = {
                ...DEF,
                acceptsImage: true,
                responseSchema: schemaWith({
                    version: 1,
                    template: compact,
                    includeRuleGuidance: true,
                }),
                rules: [{ kind: "instruction", text: "Keep this guidance." }],
            };
            let seen: InferenceRequest | undefined;
            await runAiAction(def, { image: new Uint8Array([1]) }, RECIPIENT, async (request) => {
                seen = request;
                return { kind: "ok", text: '{"reading":20,"kind":"scheduled"}' };
            });

            expect(seen?.prompt).toBe(`${compact}\n\nRules:\n- Keep this guidance.`);
        });

        it("keeps the August 13 mobile regression in a bounded model-only date pass", async () => {
            const corePrompt = "Read only reading, unit, and record status.";
            const datePrompt = "Read only the printed record date.";
            const responseSchema = {
                type: "object",
                [AI_ACTION_IMAGE_PROMPT_EXTENSION]: {
                    version: 1,
                    template: corePrompt,
                    includeRuleGuidance: false,
                },
                [AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION]: {
                    version: 3,
                    primaryFields: ["reading", "unit", "kind"],
                    primaryMaxTokens: 64,
                    passes: [
                        {
                            template: datePrompt,
                            fields: ["date"],
                            includeRuleGuidance: false,
                            includeMessage: false,
                            maxTokens: 24,
                            imageRegion: "detail_card",
                        },
                    ],
                },
                properties: {
                    reading: { type: "number" },
                    unit: { type: "string" },
                    kind: { type: "string", enum: ["scheduled", "observed"] },
                    date: {
                        type: "string",
                        format: "date",
                        "x-openchat-property-aliases": ["recorded_on"],
                    },
                    orientation: { type: "string", enum: ["east", "west"] },
                },
                required: ["reading", "kind"],
            };
            const def: AiActionDefinition = { ...DEF, acceptsImage: true, responseSchema };
            const seen: InferenceRequest[] = [];
            const responses = [
                '{"reading":13500,"unit":"HPA","kind":"observed","date":"2022-06-14","orientation":"east"}',
                '{"recorded_on":"2026-08-13","reading":1500}',
            ];

            const result = await runAiAction(
                def,
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                async (request) => {
                    seen.push(request);
                    return { kind: "ok", text: responses[seen.length - 1] };
                },
            );

            expect(seen).toHaveLength(2);
            expect(
                seen.map(({ prompt, maxTokens, imageRegion }) => ({
                    prompt,
                    maxTokens,
                    imageRegion,
                })),
            ).toEqual([
                { prompt: corePrompt, maxTokens: 64, imageRegion: undefined },
                { prompt: datePrompt, maxTokens: 24, imageRegion: "detail_card" },
            ]);
            expect(seen.every((request) => request.image?.byteLength === 3)).toBe(true);
            expect(result.kind).toBe("ready");
            if (result.kind === "ready") {
                expect(result.extracted).toMatchObject({
                    reading: 13500,
                    unit: "HPA",
                    kind: "observed",
                    date: "2026-08-13",
                });
                expect(result.extracted).not.toHaveProperty("orientation");
            }
        });

        it("forwards the version-4 lower detail rows only to its focused pass", async () => {
            const responseSchema = {
                type: "object",
                [AI_ACTION_IMAGE_PROMPT_EXTENSION]: {
                    version: 1,
                    template: "Read reading only.",
                    includeRuleGuidance: false,
                },
                [AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION]: {
                    version: 4,
                    primaryFields: ["reading"],
                    primaryMaxTokens: 32,
                    passes: [
                        {
                            template: "Read the printed date only.",
                            fields: ["date"],
                            includeRuleGuidance: false,
                            includeMessage: false,
                            maxTokens: 24,
                            imageRegion: "lower_detail_rows",
                        },
                    ],
                },
                properties: {
                    reading: { type: "number" },
                    date: { type: "string", format: "date" },
                },
                required: ["reading"],
            };
            const requests: InferenceRequest[] = [];
            const result = await runAiAction(
                { ...DEF, acceptsImage: true, responseSchema },
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                async (request) => {
                    requests.push(request);
                    return {
                        kind: "ok",
                        text: requests.length === 1 ? '{"reading":12345}' : '{"date":"2026-08-14"}',
                    };
                },
            );

            expect(requests.map(({ imageRegion }) => imageRegion)).toEqual([
                undefined,
                "lower_detail_rows",
            ]);
            expect(result.kind).toBe("ready");
            if (result.kind === "ready") {
                expect(result.extracted).toMatchObject({ reading: 12345, date: "2026-08-14" });
            }
        });

        it("propagates a focused-pass device failure instead of hiding it", async () => {
            const responseSchema = {
                type: "object",
                [AI_ACTION_IMAGE_PROMPT_EXTENSION]: {
                    version: 1,
                    template: "Read reading and kind.",
                    includeRuleGuidance: false,
                },
                [AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION]: {
                    version: 1,
                    primaryFields: ["reading", "kind"],
                    primaryMaxTokens: 32,
                    passes: [
                        {
                            template: "Read date only.",
                            fields: ["date"],
                            includeRuleGuidance: false,
                            includeMessage: false,
                            maxTokens: 24,
                        },
                    ],
                },
                properties: {
                    reading: { type: "number" },
                    kind: { type: "string", enum: ["scheduled", "observed"] },
                    date: { type: "string", format: "date" },
                },
                required: ["reading", "kind"],
            };
            const def: AiActionDefinition = { ...DEF, acceptsImage: true, responseSchema };
            let call = 0;
            const result = await runAiAction(
                def,
                { image: new Uint8Array([1]) },
                RECIPIENT,
                async () =>
                    ++call === 1
                        ? {
                              kind: "ok",
                              text: '{"reading":12345,"kind":"observed","date":"2022-06-14"}',
                          }
                        : { kind: "error", error: "device lost" },
            );

            expect(result).toEqual({ kind: "error", error: "device lost" });
        });

        it("accepts a valid empty focused object and leaves its optional field absent", async () => {
            const responseSchema = {
                type: "object",
                [AI_ACTION_IMAGE_PROMPT_EXTENSION]: {
                    version: 1,
                    template: "Read reading and kind.",
                    includeRuleGuidance: false,
                },
                [AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION]: {
                    version: 1,
                    primaryFields: ["reading", "kind"],
                    primaryMaxTokens: 32,
                    passes: [
                        {
                            template: "Read date only.",
                            fields: ["date"],
                            includeRuleGuidance: false,
                            includeMessage: false,
                            maxTokens: 24,
                        },
                    ],
                },
                properties: {
                    reading: { type: "number" },
                    kind: { type: "string", enum: ["scheduled", "observed"] },
                    date: { type: "string", format: "date" },
                },
                required: ["reading", "kind"],
            };
            const def: AiActionDefinition = { ...DEF, acceptsImage: true, responseSchema };
            let call = 0;
            const result = await runAiAction(
                def,
                { image: new Uint8Array([1]) },
                RECIPIENT,
                async () => ({
                    kind: "ok",
                    text:
                        ++call === 1
                            ? '{"reading":12345,"kind":"observed","date":"2022-06-14"}'
                            : "{}",
                }),
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") expect(result.extracted).not.toHaveProperty("date");
        });

        it("accepts only disjoint, declared, bounded focused passes", () => {
            const make = (passes: unknown[]) => ({
                type: "object",
                [AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION]: {
                    version: 1,
                    primaryFields: ["reading"],
                    primaryMaxTokens: 32,
                    passes,
                },
                properties: {
                    reading: { type: "number" },
                    date: { type: "string" },
                },
            });
            const validPass = {
                template: "Read date.",
                fields: ["date"],
                includeRuleGuidance: false,
                includeMessage: false,
                maxTokens: 16,
            };
            expect(imageModelPassesConfig(make([validPass]))).toEqual({
                primaryFields: ["reading"],
                primaryMaxTokens: 32,
                passes: [validPass],
            });
            expect(
                imageModelPassesConfig(make([{ ...validPass, fields: ["reading"] }])),
            ).toBeUndefined();
            expect(
                imageModelPassesConfig(make([{ ...validPass, fields: ["undeclared"] }])),
            ).toBeUndefined();
            expect(
                imageModelPassesConfig(
                    make(
                        Array.from({ length: MAX_AI_ACTION_IMAGE_MODEL_PASSES }, (_, index) => ({
                            ...validPass,
                            fields: [index === 0 ? "date" : "reading"],
                        })),
                    ),
                ),
            ).toBeUndefined();
            expect(imageModelPassesConfig(make([{ ...validPass, maxTokens: 97 }]))).toBeUndefined();

            const makeV2 = (passes: unknown[]) => ({
                ...make(passes),
                [AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION]: {
                    version: 2,
                    primaryFields: ["reading"],
                    primaryMaxTokens: 32,
                    passes,
                },
            });
            const regionPass = { ...validPass, imageRegion: "lower_half" };
            expect(imageModelPassesConfig(makeV2([regionPass]))).toEqual({
                primaryFields: ["reading"],
                primaryMaxTokens: 32,
                passes: [regionPass],
            });
            expect(imageModelPassesConfig(makeV2([validPass]))).toBeUndefined();
            expect(
                imageModelPassesConfig(makeV2([{ ...regionPass, imageRegion: "tiny_box" }])),
            ).toBeUndefined();
            expect(
                imageModelPassesConfig(makeV2([{ ...regionPass, imageRegion: "detail_card" }])),
            ).toBeUndefined();

            const makeV3 = (passes: unknown[]) => ({
                ...make(passes),
                [AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION]: {
                    version: 3,
                    primaryFields: ["reading"],
                    primaryMaxTokens: 32,
                    passes,
                },
            });
            const detailCardPass = { ...validPass, imageRegion: "detail_card" };
            expect(imageModelPassesConfig(makeV3([detailCardPass]))).toEqual({
                primaryFields: ["reading"],
                primaryMaxTokens: 32,
                passes: [detailCardPass],
            });
            expect(imageModelPassesConfig(makeV3([regionPass]))).toEqual({
                primaryFields: ["reading"],
                primaryMaxTokens: 32,
                passes: [regionPass],
            });
            expect(
                imageModelPassesConfig(makeV3([{ ...regionPass, imageRegion: "tiny_box" }])),
            ).toBeUndefined();
            // Version 3 stays frozen: the new lower rows band is accepted only by version 4.
            expect(
                imageModelPassesConfig(
                    makeV3([{ ...regionPass, imageRegion: "lower_detail_rows" }]),
                ),
            ).toBeUndefined();

            const makeV4 = (passes: unknown[]) => ({
                ...make(passes),
                [AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION]: {
                    version: 4,
                    primaryFields: ["reading"],
                    primaryMaxTokens: 32,
                    passes,
                },
            });
            const lowerDetailRowsPass = {
                ...validPass,
                imageRegion: "lower_detail_rows",
            };
            expect(imageModelPassesConfig(makeV4([lowerDetailRowsPass]))).toEqual({
                primaryFields: ["reading"],
                primaryMaxTokens: 32,
                passes: [lowerDetailRowsPass],
            });
            expect(imageModelPassesConfig(makeV4([detailCardPass]))).toEqual({
                primaryFields: ["reading"],
                primaryMaxTokens: 32,
                passes: [detailCardPass],
            });
            expect(
                imageModelPassesConfig(
                    makeV4([{ ...lowerDetailRowsPass, imageRegion: "tiny_box" }]),
                ),
            ).toBeUndefined();
            expect(
                imageModelPassesConfig(make([{ ...validPass, imageRegion: "lower_half" }])),
            ).toBeUndefined();
        });
    });

    it("omits from_message guidance for image-only input while retaining applicable rules", async () => {
        const def: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            rules: [
                { kind: "instruction", text: "Return one object." },
                { kind: "from_message", field: "annotation" },
                {
                    kind: "keyword_map",
                    field: "category",
                    mode: "override",
                    map: [{ value: "travel", keywords: ["sensor"] }],
                },
            ],
        };
        let seen: InferenceRequest | undefined;
        await runAiAction(def, { image: new Uint8Array([1, 2, 3]) }, RECIPIENT, async (req) => {
            seen = req;
            return { kind: "ok", text: '{"reading":20,"unit":"LUX"}' };
        });

        expect(seen?.prompt).toContain("Return one object.");
        expect(seen?.prompt).toContain(
            'Set "category" to "travel" when the message mentions any of: sensor',
        );
        expect(seen?.prompt).not.toContain(
            'Set "annotation" to a short phrase taken from the message.',
        );
    });

    it.each([
        ["text", { text: "sensor report" }],
        ["mixed image + text", { image: new Uint8Array([1, 2, 3]), text: "sensor report" }],
    ])("retains from_message guidance for %s input", async (_label, input) => {
        const def: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            rules: [{ kind: "from_message", field: "annotation" }],
        };
        let seen: InferenceRequest | undefined;
        await runAiAction(def, input, RECIPIENT, async (req) => {
            seen = req;
            return { kind: "ok", text: '{"reading":20,"unit":"LUX"}' };
        });

        expect(seen?.prompt).toContain(
            'Set "annotation" to a short phrase taken from the message.',
        );
    });

    it("never retries an image plus caption as a text-only format repair", async () => {
        const pixels = new Uint8Array([7, 8, 9]);
        const def: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
        };
        const infer = vi.fn(
            async (_req: InferenceRequest): Promise<InferenceResult> => ({
                kind: "ok",
                text: "not parseable JSON",
            }),
        );

        const result = await runAiAction(
            def,
            { image: pixels, text: "the user's exact caption" },
            RECIPIENT,
            infer,
        );

        expect(result).toEqual({ kind: "no_extraction", raw: "not parseable JSON" });
        expect(infer).toHaveBeenCalledTimes(1);
        expect(infer.mock.calls[0][0]).toMatchObject({ image: pixels });
    });

    it("adds declared date context to mixed image + nonempty text input", async () => {
        const def: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            rules: [{ kind: "context", provide: ["today"] }],
        };
        let seen: InferenceRequest | undefined;
        await runAiAction(
            def,
            { image: new Uint8Array([1, 2, 3]), text: "pending tomorrow" },
            RECIPIENT,
            async (req) => {
                seen = req;
                return { kind: "ok", text: '{"reading":20,"unit":"LUX"}' };
            },
        );

        const today = formatLocalCalendarDate(new Date());
        expect(seen?.prompt).toBe(
            `${DEF.promptTemplate}\n\nToday is ${today}.\n\nMessage:\npending tomorrow`,
        );
        expect(seen?.image).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("formats the user's local calendar components without a UTC conversion", () => {
        expect(
            formatLocalCalendarDate({
                getFullYear: () => 2026,
                getMonth: () => 7,
                getDate: () => 9,
            }),
        ).toBe("2026-08-09");
    });

    it.each([undefined, "", "   "])(
        "does not add declared date context without nonempty text (%s)",
        async (text) => {
            const def: AiActionDefinition = {
                ...DEF,
                acceptsImage: true,
                rules: [{ kind: "context", provide: ["today"] }],
            };
            let seen: InferenceRequest | undefined;
            await runAiAction(
                def,
                { image: new Uint8Array([1, 2, 3]), text },
                RECIPIENT,
                async (req) => {
                    seen = req;
                    return { kind: "ok", text: '{"reading":20,"unit":"LUX"}' };
                },
            );

            expect(seen?.prompt).toBe(DEF.promptTemplate);
            expect(seen?.prompt).not.toContain("Today is ");
        },
    );

    it("interpolates the Rules lines, Today line and Message block into the prompt", async () => {
        const def: AiActionDefinition = {
            ...DEF,
            rules: [
                { kind: "instruction", text: "Amounts are in the device unit." },
                {
                    kind: "keyword_map",
                    field: "category",
                    mode: "hint",
                    map: [{ value: "travel", keywords: ["flight", "sensor"] }],
                },
                { kind: "from_message", field: "annotation" },
                // normalize is deterministic and context is emitted separately: neither adds a
                // Rules-block prompt line.
                { kind: "normalize", field: "reading", ops: ["k_m_suffix"] },
                { kind: "context", provide: ["today"] },
            ],
        };
        let seen: InferenceRequest | undefined;
        await runAiAction(def, { text: "measured for a flight" }, RECIPIENT, async (req) => {
            seen = req;
            return { kind: "ok", text: "{}" };
        });
        const today = formatLocalCalendarDate(new Date());
        expect(seen?.prompt).toBe(
            `${DEF.promptTemplate}\n\n` +
                `Rules:\n` +
                `- Amounts are in the device unit.\n` +
                `- Set "category" to "travel" when the message mentions any of: flight, sensor\n` +
                `- Set "annotation" to a short phrase taken from the message.\n\n` +
                `Today is ${today}.\n\n` +
                `Message:\nmeasured for a flight`,
        );
    });

    it("keyword_map override wins over the model output using the message text", async () => {
        const def: AiActionDefinition = {
            ...DEF,
            rules: [
                {
                    kind: "keyword_map",
                    field: "category",
                    mode: "override",
                    map: [
                        { value: "travel", keywords: ["flight", "sensor"] },
                        { value: "light", keywords: ["lunch", "dinner"] },
                    ],
                },
            ],
        };
        const r = await runAiAction(
            def,
            { text: "Configured a Sensor for next week" },
            RECIPIENT,
            // The model got it wrong — the deterministic override must win.
            okInfer('{"reading":20,"category":"light"}'),
        );
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            expect(r.extracted.category).toBe("travel");
            // confirmPayload carries the POST-PASSED object.
            const payload = JSON.parse(new TextDecoder().decode(r.card.confirmPayload!)) as Record<
                string,
                unknown
            >;
            expect(payload.category).toBe("travel");
        }
    });

    describe("image-only keyword-map evidence", () => {
        const imageKindDef = (): AiActionDefinition => ({
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                required: ["reading", "kind"],
                properties: {
                    reading: { type: "number" },
                    kind: { type: "string", enum: ["scheduled", "observed"] },
                    annotation: { type: "string" },
                },
            },
            rules: [
                {
                    kind: "keyword_map",
                    field: "kind",
                    mode: "override",
                    map: [
                        { value: "scheduled", keywords: ["pending", "scan"] },
                        { value: "observed", keywords: ["measured", "captured"] },
                    ],
                },
            ],
        });

        it("does not let a model-authored pending/scan annotation relabel an explicit observed", async () => {
            const result = await runAiAction(
                imageKindDef(),
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                okInfer(
                    '{"reading":350,"kind":"observed","annotation":"reading pending; you scan"}',
                ),
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") expect(result.extracted.kind).toBe("observed");
        });

        it.each([undefined, "", "   "])(
            "fails closed when image kind is missing and source text is not authoritative (%s)",
            async (text) => {
                const result = await runAiAction(
                    imageKindDef(),
                    { image: new Uint8Array([1, 2, 3]), text },
                    RECIPIENT,
                    okInfer('{"reading":350,"annotation":"reading pending; you scan"}'),
                );

                expect(result).toMatchObject({
                    kind: "incomplete_extraction",
                    missingFields: ["kind"],
                    candidateCount: 1,
                    validCandidateCount: 0,
                });
            },
        );

        it("keeps a nonempty image caption authoritative for keyword overrides", async () => {
            const def: AiActionDefinition = {
                ...DEF,
                acceptsImage: true,
                responseSchema: {
                    type: "object",
                    required: ["reading", "orientation"],
                    properties: {
                        reading: { type: "number" },
                        orientation: { type: "string", enum: ["east", "west"] },
                        message: { type: "string" },
                    },
                },
                card: {
                    ...DEF.card,
                    rows: [
                        { label: "Reading", valueKey: "reading" },
                        { label: "Orientation", valueKey: "orientation" },
                    ],
                },
                rules: [
                    {
                        kind: "keyword_map",
                        field: "orientation",
                        mode: "override",
                        map: [
                            { value: "east", keywords: ["scanned to you"] },
                            { value: "west", keywords: ["you scan"] },
                        ],
                    },
                ],
            };

            const result = await runAiAction(
                def,
                { image: new Uint8Array([1, 2, 3]), text: "Cleaning fee scanned to you" },
                RECIPIENT,
                okInfer('{"reading":350,"orientation":"west","message":"you scan"}'),
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") {
                expect(result.extracted.orientation).toBe("east");
                expect(result.card.rows).toContainEqual({ label: "Orientation", value: "east" });
            }
        });
    });

    describe("image-only response-schema defaults", () => {
        const imageDefaultDef = (): AiActionDefinition => ({
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                required: ["reading", "orientation"],
                properties: {
                    reading: { type: "number" },
                    orientation: {
                        type: "string",
                        enum: ["east", "west"],
                        default: "west",
                        "x-openchat-default-for-image-only": "east",
                        "x-openchat-property-aliases": ["relationship"],
                    },
                },
            },
            card: {
                ...DEF.card,
                rows: [
                    { label: "Reading", valueKey: "reading" },
                    { label: "Orientation", valueKey: "orientation" },
                ],
            },
        });

        it("uses the app-declared image default when a model omits the field", async () => {
            const result = await runAiAction(
                imageDefaultDef(),
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                okInfer('{"reading":12345}'),
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") {
                expect(result.extracted.orientation).toBe("east");
                expect(result.card.rows).toContainEqual({
                    label: "Orientation",
                    value: "east",
                });
            }
        });

        it("preserves an explicit model value instead of replacing it with the image default", async () => {
            const result = await runAiAction(
                imageDefaultDef(),
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                okInfer('{"reading":12345,"orientation":"west"}'),
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") expect(result.extracted.orientation).toBe("west");
        });

        it("uses the app-declared editable image fallback after rejecting an invalid model enum", async () => {
            const result = await runAiAction(
                imageDefaultDef(),
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                okInfer('{"reading":12345,"orientation":"scanned to you"}'),
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") expect(result.extracted.orientation).toBe("east");
        });

        it("does not treat a model-authored image message as source evidence for an app rule", async () => {
            const def = imageDefaultDef();
            def.rules = [
                {
                    kind: "keyword_map",
                    field: "orientation",
                    mode: "override",
                    map: [{ value: "west", keywords: ["i scan you"] }],
                },
            ];
            const result = await runAiAction(
                def,
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                okInfer('{"reading":12345,"message":"I scan you"}'),
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") expect(result.extracted.orientation).toBe("east");
        });

        it("retains the ordinary schema default for typed text", async () => {
            const result = await runAiAction(
                imageDefaultDef(),
                { text: "inspection 12345" },
                RECIPIENT,
                okInfer('{"reading":12345}'),
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") expect(result.extracted.orientation).toBe("west");
        });

        it("does not hide conflicting explicit and aliased model values behind the image default", async () => {
            const result = await runAiAction(
                imageDefaultDef(),
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                okInfer('{"reading":12345,"orientation":"east","relationship":"west"}'),
            );

            expect(result).toMatchObject({
                kind: "incomplete_extraction",
                missingFields: ["orientation"],
                candidateCount: 1,
                validCandidateCount: 0,
            });
        });

        it.each([true, 1, "sideways", { value: "east" }])(
            "fails closed for a nonconforming image default annotation (%j)",
            async (annotation) => {
                const def = imageDefaultDef();
                const orientation = (
                    def.responseSchema as {
                        properties: { orientation: Record<string, unknown> };
                    }
                ).properties.orientation;
                orientation["x-openchat-default-for-image-only"] = annotation;

                const result = await runAiAction(
                    def,
                    { image: new Uint8Array([1, 2, 3]) },
                    RECIPIENT,
                    okInfer('{"reading":12345}'),
                );

                expect(result).toMatchObject({
                    kind: "incomplete_extraction",
                    missingFields: ["orientation"],
                });
            },
        );
    });

    describe("image-only explicit response-schema values", () => {
        const explicitImageValueDef = (): AiActionDefinition => ({
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                required: ["reading", "kind"],
                properties: {
                    reading: { type: "number" },
                    kind: {
                        type: "string",
                        enum: ["observed", "scheduled"],
                        default: "scheduled",
                        "x-openchat-require-explicit-for-image-only": true,
                        "x-openchat-property-aliases": ["record_kind"],
                    },
                },
            },
            card: {
                ...DEF.card,
                rows: [
                    { label: "Reading", valueKey: "reading" },
                    { label: "Kind", valueKey: "kind" },
                ],
            },
        });

        it("keeps an omitted required image value missing instead of applying its ordinary default", async () => {
            const result = await runAiAction(
                explicitImageValueDef(),
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                okInfer('{"reading":12345}'),
            );

            expect(result).toMatchObject({
                kind: "incomplete_extraction",
                missingFields: ["kind"],
                candidateCount: 1,
                validCandidateCount: 0,
            });
        });

        it("preserves an explicit valid image value", async () => {
            const result = await runAiAction(
                explicitImageValueDef(),
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                okInfer('{"reading":12345,"kind":"observed"}'),
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") expect(result.extracted.kind).toBe("observed");
        });

        it("retains the ordinary default for text input", async () => {
            const result = await runAiAction(
                explicitImageValueDef(),
                { text: "inspection 12345" },
                RECIPIENT,
                okInfer('{"reading":12345}'),
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") expect(result.extracted.kind).toBe("scheduled");
        });

        it.each([
            ["invalid", '{"reading":12345,"kind":"refund"}'],
            [
                "conflicting alias tombstone",
                '{"reading":12345,"kind":"observed","record_kind":"scheduled"}',
            ],
        ])("does not hide an explicit %s behind the ordinary default", async (_label, raw) => {
            const result = await runAiAction(
                explicitImageValueDef(),
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                okInfer(raw),
            );

            expect(result).toMatchObject({
                kind: "incomplete_extraction",
                missingFields: ["kind"],
            });
        });

        it.each([false, "true", 1, { value: true }])(
            "ignores a malformed explicit-image annotation (%j)",
            async (annotation) => {
                const def = explicitImageValueDef();
                const kind = (
                    def.responseSchema as {
                        properties: { kind: Record<string, unknown> };
                    }
                ).properties.kind;
                kind["x-openchat-require-explicit-for-image-only"] = annotation;

                const result = await runAiAction(
                    def,
                    { image: new Uint8Array([1, 2, 3]) },
                    RECIPIENT,
                    okInfer('{"reading":12345}'),
                );

                expect(result.kind).toBe("ready");
                if (result.kind === "ready") expect(result.extracted.kind).toBe("scheduled");
            },
        );
    });

    describe("image-only response-schema omissions", () => {
        const omissionDef = (annotation: unknown = true): AiActionDefinition => ({
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number" },
                    unstable: {
                        type: "string",
                        "x-openchat-omit-for-image-only": annotation,
                    },
                    retainedDate: { type: "string", format: "date" },
                },
                required: ["reading"],
            },
            card: {
                ...DEF.card,
                rows: [
                    { label: "Reading", valueKey: "reading" },
                    { label: "Unstable", valueKey: "unstable" },
                    { label: "Retained date", valueKey: "retainedDate" },
                ],
            },
        });

        it.each([undefined, "", "   "])(
            "removes only an opted-in property for image input with blank text (%s)",
            async (text) => {
                const result = await runAiAction(
                    omissionDef(),
                    { image: new Uint8Array([1, 2, 3]), text },
                    RECIPIENT,
                    okInfer('{"reading":20,"unstable":"model guess","retainedDate":"2026-08-09"}'),
                );

                expect(result.kind).toBe("ready");
                if (result.kind === "ready") {
                    expect(result.extracted).toEqual({
                        reading: 20,
                        retainedDate: "2026-08-09",
                    });
                    expect(result.card.rows).toEqual([
                        { label: "Reading", value: "20" },
                        { label: "Retained date", value: "2026-08-09" },
                    ]);
                    expect(
                        JSON.parse(new TextDecoder().decode(result.card.confirmPayload!)),
                    ).toEqual(result.extracted);
                }
            },
        );

        it.each([
            ["text-only", { text: "source says the value" }],
            [
                "mixed image + nonblank text",
                { image: new Uint8Array([1, 2, 3]), text: "source says the value" },
            ],
        ])("retains an opted-in property for %s input", async (_label, input) => {
            const result = await runAiAction(
                omissionDef(),
                input,
                RECIPIENT,
                okInfer('{"reading":20,"unstable":"source value"}'),
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") {
                expect(result.extracted.unstable).toBe("source value");
                expect(result.card.rows).toContainEqual({
                    label: "Unstable",
                    value: "source value",
                });
            }
        });

        it.each([false, "true", 1, null])(
            "ignores a malformed or disabled annotation (%s)",
            async (annotation) => {
                const result = await runAiAction(
                    omissionDef(annotation),
                    { image: new Uint8Array([1, 2, 3]) },
                    RECIPIENT,
                    okInfer('{"reading":20,"unstable":"keep me"}'),
                );

                expect(result.kind).toBe("ready");
                if (result.kind === "ready") {
                    expect(result.extracted.unstable).toBe("keep me");
                }
            },
        );

        it("fails closed when an image-only omitted property is required", async () => {
            const def = omissionDef();
            (def.responseSchema as { required: string[] }).required.push("unstable");

            const result = await runAiAction(
                def,
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                okInfer('{"reading":20,"unstable":"model guess"}'),
            );

            expect(result).toMatchObject({
                kind: "incomplete_extraction",
                missingFields: ["unstable"],
                candidateCount: 1,
                validCandidateCount: 0,
            });
        });

        it("applies independently to every model-produced entry without mutating the schema or source data", async () => {
            const def = omissionDef();
            const schemaBefore = structuredClone(def.responseSchema);
            const source = [
                { reading: 20, unstable: "first", retainedDate: "2026-08-09" },
                { reading: 30, unstable: "second", retainedDate: "2026-08-10" },
            ];
            const sourceBefore = structuredClone(source);

            const result = await runAiAction(
                def,
                { image: new Uint8Array([1, 2, 3]) },
                RECIPIENT,
                okInfer(JSON.stringify(source)),
            );

            expect(result.kind).toBe("ready_multi");
            if (result.kind === "ready_multi") {
                expect(result.extracted).toEqual([
                    { reading: 20, retainedDate: "2026-08-09" },
                    { reading: 30, retainedDate: "2026-08-10" },
                ]);
                expect(JSON.parse(new TextDecoder().decode(result.card.confirmPayload!))).toEqual(
                    result.extracted,
                );
            }
            expect(def.responseSchema).toEqual(schemaBefore);
            expect(source).toEqual(sourceBefore);
        });
    });

    it("from_message fills the field from the message text", async () => {
        const def: AiActionDefinition = {
            ...DEF,
            rules: [{ kind: "from_message", field: "annotation", maxLength: 10 }],
        };
        const r = await runAiAction(
            def,
            { text: "  team lunch at noon  " },
            RECIPIENT,
            okInfer('{"reading":20}'),
        );
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            // trimmed, then truncated to maxLength
            expect(r.extracted.annotation).toBe("team lunch");
            const payload = JSON.parse(new TextDecoder().decode(r.card.confirmPayload!)) as Record<
                string,
                unknown
            >;
            expect(payload.annotation).toBe("team lunch");
        }
    });

    it("k_m_suffix normalization turns '26k' into 26000", async () => {
        const def: AiActionDefinition = {
            ...DEF,
            rules: [{ kind: "normalize", field: "reading", ops: ["k_m_suffix"] }],
        };
        const r = await runAiAction(
            def,
            { text: "spent 26k" },
            RECIPIENT,
            okInfer('{"reading":"26k"}'),
        );
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            expect(r.extracted.reading).toBe(26000);
        }
    });

    it("reports an incomplete extraction when a required reading violates its schema", async () => {
        // Live repro: the model "extracted" a observed with reading 0 from the message "hi". The
        // conformance pass deletes the degenerate reading, and with `reading` required the runner must
        // NOT post a card the consumer will reject — it reports "model found no action" instead.
        const def: AiActionDefinition = {
            ...DEF,
            responseSchema: {
                type: "object",
                properties: {
                    kind: { type: "string" },
                    reading: { type: "number", exclusiveMinimum: 0 },
                    unit: { type: "string" },
                },
                required: ["reading"],
            },
        };
        const raw = '{"kind":"observed","reading":0,"unit":"LUX"}';
        const r = await runAiAction(def, { text: "hi" }, RECIPIENT, okInfer(raw));
        expect(r.kind).toBe("incomplete_extraction");
        if (r.kind === "incomplete_extraction") {
            expect(r.raw).toBe(raw);
            expect(r.missingFields).toEqual(["reading"]);
            expect(r.candidateCount).toBe(1);
            expect(r.validCandidateCount).toBe(0);
        }
    });

    it("a positive reading under the same required + exclusiveMinimum schema still yields a ready card", async () => {
        const def: AiActionDefinition = {
            ...DEF,
            responseSchema: {
                type: "object",
                properties: {
                    kind: { type: "string" },
                    reading: { type: "number", exclusiveMinimum: 0 },
                    unit: { type: "string" },
                },
                required: ["reading"],
            },
        };
        const r = await runAiAction(
            def,
            { text: "settle 350 LUX" },
            RECIPIENT,
            okInfer('{"kind":"observed","reading":350,"unit":"LUX"}'),
        );
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            expect(r.extracted.reading).toBe(350);
            expect(r.card.rows).toContainEqual({ label: "Reading", value: "350" });
        }
    });

    it("schema conformance deletes a field violating an enum", async () => {
        const def: AiActionDefinition = {
            ...DEF,
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number" },
                    unit: { type: "string", enum: ["LUX", "PPM"] },
                },
            },
            rules: [{ kind: "instruction", text: "Report the unit as an ISO code." }],
        };
        const r = await runAiAction(
            def,
            { text: "measured 20" },
            RECIPIENT,
            okInfer('{"reading":20,"unit":"???"}'),
        );
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            // Visible omission beats silent wrongness: the enum-violating field is deleted.
            expect(r.extracted).toEqual({ reading: 20 });
            expect(r.card.rows.map((row) => row.label)).toEqual(["Reading"]);
        }
    });

    it("rules-free definitions preserve extraction behavior without adding context", async () => {
        let seen: InferenceRequest | undefined;
        const r = await runAiAction(
            DEF,
            { text: "I measured $20 LUX for lunch" },
            RECIPIENT,
            async (req) => {
                seen = req;
                return { kind: "ok", text: '{"reading":20,"unit":"LUX","extra":true}' };
            },
        );
        // No Rules block in the prompt...
        expect(seen?.prompt).toBe(
            `${DEF.promptTemplate}\n\nMessage:\nI measured $20 LUX for lunch`,
        );
        // ...and the extraction passes through untouched (DEF's schema declares no properties).
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            expect(r.extracted).toEqual({ reading: 20, unit: "LUX", extra: true });
        }
    });

    // --- multi-entry (array) extraction -----------------------------------------------------------
    it("a single OBJECT still yields a `ready` card with an OBJECT confirmPayload (byte-identical)", async () => {
        const r = await runAiAction(
            MULTI_DEF,
            { text: "I measured 20 LUX for lunch" },
            RECIPIENT,
            okInfer('{"reading":20,"unit":"LUX","annotation":"lunch"}'),
        );
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            const payload = JSON.parse(new TextDecoder().decode(r.card.confirmPayload!)) as unknown;
            expect(Array.isArray(payload)).toBe(false);
            expect(payload).toEqual({ reading: 20, unit: "LUX", annotation: "lunch" });
            expect(r.card.title).toBe(DEF.card.title);
        }
    });

    it("fails the whole multi proposal when one element is degenerate", async () => {
        const raw =
            '[{"reading":20,"unit":"LUX","annotation":"lunch"},' +
            '{"reading":0,"unit":"LUX"},' +
            '{"reading":30,"unit":"PPM","annotation":"dinner"}]';
        const r = await runAiAction(
            MULTI_DEF,
            { text: "two measurements and a bad one" },
            RECIPIENT,
            okInfer(raw),
        );
        expect(r.kind).toBe("incomplete_extraction");
        if (r.kind === "incomplete_extraction") {
            expect(r.missingFields).toEqual(["reading"]);
            expect(r.candidateCount).toBe(3);
            expect(r.validCandidateCount).toBe(2);
        }
    });

    it("accepts the exact multi-card title boundary and rejects the first character beyond it", async () => {
        const run = (title: string) =>
            runAiAction(
                { ...MULTI_DEF, card: { ...MULTI_DEF.card, title } },
                { text: "two" },
                RECIPIENT,
                okInfer('[{"reading":1},{"reading":2}]'),
            );
        // `buildMultiActionCardContent` appends ` (2 entries)` (12 characters).
        const atBoundary = await run("T".repeat(MAX_AI_ACTION_CARD_TITLE_CHARS - 12));
        expect(atBoundary.kind).toBe("ready_multi");

        const overflow = await run("T".repeat(MAX_AI_ACTION_CARD_TITLE_CHARS - 11));
        expect(overflow).toEqual({
            kind: "error",
            error: `The multi-entry card title exceeds ${MAX_AI_ACTION_CARD_TITLE_CHARS} characters.`,
        });
    });

    it("accepts the exact summary-row boundary and rejects the first character beyond it", async () => {
        const prefix = "Reading: 1 · Annotation: ";
        const run = (noteLength: number) =>
            runAiAction(
                MULTI_DEF,
                { text: "two" },
                RECIPIENT,
                okInfer(
                    JSON.stringify([
                        { reading: 1, annotation: "x".repeat(noteLength) },
                        { reading: 2, annotation: "ok" },
                    ]),
                ),
            );
        const atBoundary = await run(MAX_AI_ACTION_CARD_ROW_VALUE_CHARS - prefix.length);
        expect(atBoundary.kind).toBe("ready_multi");

        const overflow = await run(MAX_AI_ACTION_CARD_ROW_VALUE_CHARS - prefix.length + 1);
        expect(overflow).toEqual({
            kind: "error",
            error: `A multi-entry card summary exceeds ${MAX_AI_ACTION_CARD_ROW_VALUE_CHARS} characters.`,
        });
    });

    it("accepts a 16 KiB exact array and rejects 16 KiB + 1 before provenance", async () => {
        const def: AiActionDefinition = {
            ...MULTI_DEF,
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number", exclusiveMinimum: 0 },
                    opaque: { type: "string" },
                },
                required: ["reading"],
            },
            card: {
                ...MULTI_DEF.card,
                rows: [{ label: "Reading", valueKey: "reading" }],
            },
        };
        const rawWithPayloadBytes = (target: number): string => {
            const empty = JSON.stringify([{ reading: 1, opaque: "" }, { reading: 2 }]);
            const overhead = new TextEncoder().encode(empty).byteLength;
            return JSON.stringify([
                { reading: 1, opaque: "x".repeat(target - overhead) },
                { reading: 2 },
            ]);
        };
        const atBoundary = await runAiAction(
            def,
            { text: "two" },
            RECIPIENT,
            okInfer(rawWithPayloadBytes(MAX_AI_APP_CONFIRM_PAYLOAD_BYTES)),
        );
        expect(atBoundary.kind).toBe("ready_multi");
        if (atBoundary.kind === "ready_multi") {
            expect(atBoundary.card.confirmPayload).toHaveLength(MAX_AI_APP_CONFIRM_PAYLOAD_BYTES);
            // `opaque` is exact app payload, not a manifest-declared public row.
            expect(JSON.stringify(atBoundary.card.rows)).not.toContain("opaque");
            expect(JSON.stringify(atBoundary.card.rows)).not.toContain("xxxx");
        }

        const overflow = await runAiAction(
            def,
            { text: "two" },
            RECIPIENT,
            okInfer(rawWithPayloadBytes(MAX_AI_APP_CONFIRM_PAYLOAD_BYTES + 1)),
        );
        expect(overflow).toEqual({
            kind: "error",
            error: `The multi-entry confirmation payload exceeds ${MAX_AI_APP_CONFIRM_PAYLOAD_BYTES} bytes.`,
        });
    });

    it("does not collapse a partial ARRAY into a misleading single-entry card", async () => {
        const raw = '[{"reading":0,"unit":"LUX"},{"reading":42,"unit":"LUX","annotation":"taxi"}]';
        const r = await runAiAction(
            MULTI_DEF,
            { text: "one good one bad" },
            RECIPIENT,
            okInfer(raw),
        );
        expect(r.kind).toBe("incomplete_extraction");
        if (r.kind === "incomplete_extraction") {
            expect(r.missingFields).toEqual(["reading"]);
            expect(r.candidateCount).toBe(2);
            expect(r.validCandidateCount).toBe(1);
        }
    });

    it("an all-invalid ARRAY reports the required fields that failed", async () => {
        const raw = '[{"reading":0,"unit":"LUX"},{"unit":"PPM"}]';
        const r = await runAiAction(MULTI_DEF, { text: "nothing usable" }, RECIPIENT, okInfer(raw));
        expect(r.kind).toBe("incomplete_extraction");
        if (r.kind === "incomplete_extraction") {
            expect(r.raw).toBe(raw);
            expect(r.missingFields).toEqual(["reading"]);
            expect(r.candidateCount).toBe(2);
            expect(r.validCandidateCount).toBe(0);
        }
    });
});

describe("buildMultiActionCardContent", () => {
    const entries = [
        { reading: 20, unit: "LUX", annotation: "lunch" },
        { reading: 30, unit: "PPM", annotation: "dinner" },
    ];
    it("builds public summary rows without placing the exact array in a hidden row", () => {
        const card = buildMultiActionCardContent(DEF, entries, RECIPIENT);
        expect(card.kind).toBe("action_card_content");
        expect(card.actionId).toBe(DEF.name);
        expect(card.title).toContain("2");
        expect(card.rows).toEqual([
            { label: "Entry 1", value: "Reading: 20 · Unit: LUX · Annotation: lunch" },
            { label: "Entry 2", value: "Reading: 30 · Unit: PPM · Annotation: dinner" },
        ]);
        expect(JSON.parse(new TextDecoder().decode(card.confirmPayload!))).toEqual(entries);
    });
    it("never copies the send-only exact payload into public rows", () => {
        const card = buildMultiActionCardContent(DEF, entries, RECIPIENT);
        expect(card.rows.some((r) => r.label.startsWith("__oc_"))).toBe(false);
        expect(
            card.rows.some((r) => r.value === new TextDecoder().decode(card.confirmPayload!)),
        ).toBe(false);
    });
    it("threads the inbox + fan-out keys exactly like the single-entry builder", () => {
        const card = buildMultiActionCardContent(DEF, entries, RECIPIENT, "aaaaa-aa", [
            "OTHER_KEY_PEM",
            "",
            RECIPIENT,
        ]);
        expect(card.inboxCanisterId).toBe("aaaaa-aa");
        expect(card.recipientPublicKey).toBe(RECIPIENT);
        expect(card.recipientPublicKeys).toEqual(["OTHER_KEY_PEM"]);
    });
    it("bakes the owning appId onto the multi card", () => {
        const card = buildMultiActionCardContent(DEF, entries, RECIPIENT, undefined, undefined, 7);
        expect(card.appId).toBe(7);
    });

    it("rejects a card whose individually valid rows exceed the aggregate 64 KiB bound", () => {
        const card = buildMultiActionCardContent(DEF, entries, RECIPIENT);
        const withinAggregate = {
            ...card,
            rows: Array.from({ length: 15 }, (_, index) => ({
                label: `Entry ${index + 1}`,
                value: "x".repeat(4_090),
            })),
            confirmPayload: new TextEncoder().encode("[{},{}]"),
        };
        expect(multiActionCardBoundsError(withinAggregate)).toBeUndefined();

        const overflow = {
            ...withinAggregate,
            rows: [...withinAggregate.rows, { label: "Entry 16", value: "x".repeat(4_090) }],
        };
        expect(multiActionCardBoundsError(overflow)).toMatch(/64 KiB/);
    });
});

describe("compileRules", () => {
    it("compiles instruction / keyword_map / from_message and skips normalize + context", () => {
        const rules: AiActionRule[] = [
            { kind: "instruction", text: "Be terse." },
            {
                kind: "keyword_map",
                field: "kind",
                mode: "override",
                map: [
                    { value: "a", keywords: ["x", "y"] },
                    { value: "b", keywords: ["z"] },
                ],
            },
            { kind: "from_message", field: "annotation" },
            { kind: "normalize", field: "reading", ops: ["trim"] },
            { kind: "context", provide: ["today"] },
        ];
        expect(compileRules(rules)).toEqual([
            "Be terse.",
            'Set "kind" to "a" when the message mentions any of: x, y',
            'Set "kind" to "b" when the message mentions any of: z',
            'Set "annotation" to a short phrase taken from the message.',
        ]);
    });

    it("omits only from_message guidance when no message text is available", () => {
        const rules: AiActionRule[] = [
            { kind: "instruction", text: "Use visible evidence." },
            { kind: "from_message", field: "annotation" },
            {
                kind: "keyword_map",
                field: "category",
                mode: "override",
                map: [{ value: "travel", keywords: ["sensor"] }],
            },
        ];

        expect(compileRules(rules, { hasMessageText: false })).toEqual([
            "Use visible evidence.",
            'Set "category" to "travel" when the message mentions any of: sensor',
        ]);
    });
});

describe("applyRulesPostPass", () => {
    it("keyword_map hint mode never touches the extraction", () => {
        const rules: AiActionRule[] = [
            {
                kind: "keyword_map",
                field: "category",
                mode: "hint",
                map: [{ value: "travel", keywords: ["sensor"] }],
            },
        ];
        expect(applyRulesPostPass(rules, { category: "light" }, "a sensor stay")).toEqual({
            category: "light",
        });
    });
    it("keyword_map override matches case-insensitively and the first matching mapping wins", () => {
        const rules: AiActionRule[] = [
            {
                kind: "keyword_map",
                field: "category",
                mode: "override",
                map: [
                    { value: "travel", keywords: ["HOTEL"] },
                    { value: "stay", keywords: ["sensor"] },
                ],
            },
        ];
        expect(applyRulesPostPass(rules, {}, "A Hotel Stay")).toEqual({ category: "travel" });
    });

    it("supports specific orientation phrases before a bare scan shorthand fallback", () => {
        const rules: AiActionRule[] = [
            {
                kind: "keyword_map",
                field: "orientation",
                mode: "override",
                map: [
                    { value: "east", keywords: ["you scan", "scan me", "scans me"] },
                    { value: "west", keywords: ["i scan", "scan you", "scan"] },
                ],
            },
        ];
        const orientationFor = (message: string) =>
            applyRulesPostPass(rules, {}, message).orientation;

        expect(orientationFor("scan 200 pressure")).toBe("west");
        expect(orientationFor("I scan you 200 for Pressure")).toBe("west");
        expect(orientationFor("You scan me 200 for Pressure")).toBe("east");
        expect(orientationFor("you scan 200 for Pressure")).toBe("east");
    });

    // The override is deterministic and unarguable — neither the model nor the user gets a say — so a
    // keyword that fires INSIDE another word silently mislabels the entry. A ledger app can register
    // the bare keyword "scan" while expecting OpenChat to match on word boundaries, which was
    // only ever true of the auto-propose chip), so under substring matching every message containing
    // A substring inside "scanner", "scanning", or "rescan" must not trigger a label.
    describe("keyword_map override matches WHOLE WORDS", () => {
        const rules: AiActionRule[] = [
            {
                kind: "keyword_map",
                field: "kind",
                mode: "override",
                map: [{ value: "west", keywords: ["scan", "scanned", "scans"] }],
            },
        ];
        const kindFor = (message: string) => applyRulesPostPass(rules, {}, message).kind;

        it("does not fire inside a longer word", () => {
            expect(kindFor("The scanner is idle")).toBeUndefined();
            expect(kindFor("No scanning today")).toBeUndefined();
            expect(kindFor("rescan everything")).toBeUndefined();
        });

        it("still fires on the real word, wherever it sits and however it is cased", () => {
            expect(kindFor("Scan me 300 pressure")).toBe("west");
            expect(kindFor("you scan me")).toBe("west");
            expect(kindFor("scans")).toBe("west");
            // Punctuation is a boundary, not a mismatch — otherwise the fix just trades one silent
            // misclassification for a silent miss.
            expect(kindFor("he scanned, then measured")).toBe("west");
            expect(kindFor("(scan) 300")).toBe("west");
        });
    });

    describe("keyword_map override evidence for image input", () => {
        const rules: AiActionRule[] = [
            {
                kind: "keyword_map",
                field: "kind",
                mode: "override",
                map: [
                    { value: "east", keywords: ["scanned to you", "visible"] },
                    { value: "west", keywords: ["you scan", "scan"] },
                ],
            },
        ];
        const withImage = { hasImage: true };

        it.each([
            ["target", { kind: "scanned to you" }, "scanned to you"],
            ["message", { kind: "unknown", message: "This is scanned to you" }, "unknown"],
            ["annotation", { kind: "unknown", annotation: "Account visible" }, "unknown"],
            ["other", { kind: "unknown", details: "you scan this" }, "unknown"],
        ])(
            "does not treat the model-authored %s field as source evidence",
            (_label, extracted, kind) => {
                expect(
                    applyRulesPostPass(rules, extracted, undefined, undefined, withImage).kind,
                ).toBe(kind);
            },
        );

        it("keeps caption/source text authoritative when both text and image are present", () => {
            expect(
                applyRulesPostPass(
                    rules,
                    { kind: "unknown", annotation: "scanned to you" },
                    "you scan this",
                    undefined,
                    withImage,
                ).kind,
            ).toBe("west");
            expect(
                applyRulesPostPass(
                    rules,
                    { kind: "unknown", annotation: "scanned to you" },
                    "no declared keyword here",
                    undefined,
                    withImage,
                ).kind,
            ).toBe("unknown");
        });

        it("preserves a value already resolved by the app's parser", () => {
            expect(
                applyRulesPostPass(
                    rules,
                    { kind: "east", annotation: "you scan" },
                    undefined,
                    undefined,
                    { hasImage: true, rulesAlreadyResolved: true },
                ).kind,
            ).toBe("east");
        });
    });

    it("skips message-driven rules when there is no message text", () => {
        const rules: AiActionRule[] = [
            { kind: "from_message", field: "annotation" },
            {
                kind: "keyword_map",
                field: "category",
                mode: "override",
                map: [{ value: "a", keywords: ["b"] }],
            },
        ];
        expect(applyRulesPostPass(rules, { reading: 1 }, undefined)).toEqual({ reading: 1 });
    });
    it("from_message truncates to 200 chars by default", () => {
        const rules: AiActionRule[] = [{ kind: "from_message", field: "annotation" }];
        const out = applyRulesPostPass(rules, {}, "x".repeat(500));
        expect((out.annotation as string).length).toBe(200);
    });
    it("normalize handles k/m suffixes, plain numeric strings and leaves real numbers alone", () => {
        const rules: AiActionRule[] = [
            { kind: "normalize", field: "reading", ops: ["k_m_suffix"] },
        ];
        expect(applyRulesPostPass(rules, { reading: "26k" }, undefined)).toEqual({
            reading: 26000,
        });
        expect(applyRulesPostPass(rules, { reading: "1.5m" }, undefined)).toEqual({
            reading: 1500000,
        });
        expect(applyRulesPostPass(rules, { reading: "1,500 k" }, undefined)).toEqual({
            reading: 1500000,
        });
        expect(applyRulesPostPass(rules, { reading: "42" }, undefined)).toEqual({ reading: 42 });
        expect(applyRulesPostPass(rules, { reading: 42 }, undefined)).toEqual({ reading: 42 });
        expect(applyRulesPostPass(rules, { reading: "not a number" }, undefined)).toEqual({
            reading: "not a number",
        });
        // A unit code the model folded into the reading is tolerated — the LEADING number is
        // recovered so it survives the number-typed schema field instead of being dropped as a string.
        expect(applyRulesPostPass(rules, { reading: "2000 lux" }, undefined)).toEqual({
            reading: 2000,
        });
        expect(applyRulesPostPass(rules, { reading: "2000usd" }, undefined)).toEqual({
            reading: 2000,
        });
        expect(applyRulesPostPass(rules, { reading: "2.5m lux" }, undefined)).toEqual({
            reading: 2500000,
        });
    });
    it("recovers a model-folded unit reading ('2000 lux') through normalize + schema conformance", () => {
        // Repro of the "invalid draft / reading set to 0" report: the model emitted reading as the string
        // "2000 lux". Without the leading-number normalize it stays a string, the number-typed schema
        // field drops it, and the consumer app gets no reading -> "invalid draft" + reading 0. With the
        // k_m_suffix normalize the leading number is recovered and kept.
        const schema = {
            type: "object",
            properties: { reading: { type: "number" }, unit: { type: "string" } },
        };
        const rules: AiActionRule[] = [
            { kind: "normalize", field: "reading", ops: ["k_m_suffix"] },
        ];
        expect(
            applyRulesPostPass(rules, { reading: "2000 lux", unit: "LUX" }, undefined, schema),
        ).toEqual({
            reading: 2000,
            unit: "LUX",
        });
    });
    it("normalize strip_symbols removes unit symbols/commas/spaces and parses numerics", () => {
        const rules: AiActionRule[] = [
            { kind: "normalize", field: "reading", ops: ["strip_symbols"] },
        ];
        expect(applyRulesPostPass(rules, { reading: "$1,299.50" }, undefined)).toEqual({
            reading: 1299.5,
        });
        expect(applyRulesPostPass(rules, { reading: "€ 20" }, undefined)).toEqual({ reading: 20 });
    });
    it("normalize applies string ops in order and skips absent fields", () => {
        const rules: AiActionRule[] = [
            { kind: "normalize", field: "code", ops: ["trim", "uppercase"] },
            { kind: "normalize", field: "missing", ops: ["lowercase"] },
        ];
        expect(applyRulesPostPass(rules, { code: "  lux " }, undefined)).toEqual({ code: "LUX" });
    });
    it("schema conformance drops undeclared, type-violating, and patterned fields", () => {
        const schema = {
            type: "object",
            properties: {
                reading: { type: "number" },
                code: { type: "string", pattern: "^[A-Z]{3}$" },
            },
        };
        expect(
            applyRulesPostPass([], { reading: "20", code: "LUX", extra: 1 }, undefined, schema),
        ).toEqual({});
        expect(applyRulesPostPass([], { reading: 20, code: "lux" }, undefined, schema)).toEqual({
            reading: 20,
        });
    });
    it("never executes a catastrophic manifest regex", () => {
        const schema = {
            type: "object",
            properties: {
                unsafe: { type: "string", pattern: "(a+)+$" },
                reading: { type: "number" },
            },
        };
        const started = performance.now();
        expect(
            applyRulesPostPass(
                [],
                { unsafe: `${"a".repeat(50_000)}!`, reading: 5 },
                undefined,
                schema,
            ),
        ).toEqual({ reading: 5 });
        expect(performance.now() - started).toBeLessThan(250);
    });
    it("schema conformance keeps a number meeting its minimum and deletes one below it", () => {
        const schema = {
            type: "object",
            properties: { reading: { type: "number", minimum: 10 } },
        };
        expect(applyRulesPostPass([], { reading: 10 }, undefined, schema)).toEqual({ reading: 10 });
        expect(applyRulesPostPass([], { reading: 9.99 }, undefined, schema)).toEqual({});
    });
    it("schema conformance deletes a number EQUAL to its exclusiveMinimum bound", () => {
        const schema = {
            type: "object",
            properties: { reading: { type: "number", exclusiveMinimum: 0 } },
        };
        expect(applyRulesPostPass([], { reading: 0 }, undefined, schema)).toEqual({});
        expect(applyRulesPostPass([], { reading: 0.01 }, undefined, schema)).toEqual({
            reading: 0.01,
        });
    });
    it("applies a valid app-declared scalar default without overriding an extracted value", () => {
        const schema = {
            type: "object",
            properties: {
                reading: { type: "number", minimum: 1 },
                orientation: {
                    type: "string",
                    enum: ["east", "west"],
                    default: "west",
                },
            },
            required: ["reading", "orientation"],
        };

        const defaulted = applyRulesPostPass([], { reading: 800 }, undefined, schema);
        expect(defaulted).toEqual({ reading: 800, orientation: "west" });
        expect(missingRequired(defaulted, schema)).toEqual([]);
        expect(
            applyRulesPostPass([], { reading: 800, orientation: "east" }, undefined, schema),
        ).toEqual({ reading: 800, orientation: "east" });
    });
    it("rejects an invalid schema default instead of satisfying a required field", () => {
        const schema = {
            type: "object",
            properties: {
                orientation: {
                    type: "string",
                    enum: ["east", "west"],
                    default: "sideways",
                },
            },
            required: ["orientation"],
        };
        const conformed = applyRulesPostPass([], {}, undefined, schema);
        expect(conformed).toEqual({});
        expect(missingRequired(conformed, schema)).toEqual(["orientation"]);
    });
    it("validates a declared ISO calendar format without interpreting display text", () => {
        const schema = {
            type: "object",
            properties: {
                date: {
                    type: "string",
                    format: "date",
                },
            },
        };

        expect(
            applyRulesPostPass([], { date: "Date: 04 Jul 2026 03:19 PM" }, undefined, schema),
        ).toEqual({});
        expect(applyRulesPostPass([], { date: "2026-07-04" }, undefined, schema)).toEqual({
            date: "2026-07-04",
        });
        expect(applyRulesPostPass([], { date: "04/07/2026" }, undefined, schema)).toEqual({});
    });
    describe("x-openchat-property-aliases", () => {
        const calendarSchema = (aliases: unknown = ["recorded_on"]) => ({
            type: "object",
            properties: {
                date: {
                    type: "string",
                    format: "date",

                    "x-openchat-property-aliases": aliases,
                },
            },
        });

        it("maps a declared model alias before schema validation and drops the alias key", () => {
            expect(
                applyRulesPostPass([], { recorded_on: "2026-07-04" }, undefined, calendarSchema()),
            ).toEqual({ date: "2026-07-04" });
        });

        it("accepts identical target and alias values", () => {
            expect(
                applyRulesPostPass(
                    [],
                    { date: "2026-07-04", recorded_on: "2026-07-04" },
                    undefined,
                    calendarSchema(),
                ),
            ).toEqual({ date: "2026-07-04" });
        });

        it.each([
            [
                "target and alias",
                ["recorded_on"],
                { date: "2026-07-05", recorded_on: "2026-07-04" },
            ],
            [
                "two aliases",
                ["recorded_on", "scanned_on"],
                { recorded_on: "2026-07-04", scanned_on: "2026-07-05" },
            ],
        ])("omits the target when %s values conflict", (_label, aliases, extracted) => {
            expect(applyRulesPostPass([], extracted, undefined, calendarSchema(aliases))).toEqual(
                {},
            );
        });

        it.each([
            ["not an array", "recorded_on"],
            ["empty", []],
            ["duplicates", ["recorded_on", "recorded_on"]],
            ["target itself", ["date"]],
            ["unsafe field", ["__proto__"]],
            ["too many", Array.from({ length: 9 }, (_, index) => `alias${index}`)],
        ])("ignores a malformed alias declaration: %s", (_label, aliases) => {
            expect(
                applyRulesPostPass(
                    [],
                    { recorded_on: "2026-07-04" },
                    undefined,
                    calendarSchema(aliases),
                ),
            ).toEqual({});
        });

        it("does not let one alias ambiguously populate two declared properties", () => {
            const schema = {
                type: "object",
                properties: {
                    start: {
                        type: "string",
                        "x-openchat-property-aliases": ["model_date"],
                    },
                    end: {
                        type: "string",
                        "x-openchat-property-aliases": ["model_date"],
                    },
                },
            };
            expect(applyRulesPostPass([], { model_date: "2026-07-04" }, undefined, schema)).toEqual(
                {},
            );
        });
    });
    describe("x-openchat-enum-aliases", () => {
        const kindSchema = (
            aliases: unknown = { observed: ["measured", "measurement", "capture"] },
        ) => ({
            type: "object",
            properties: {
                kind: {
                    type: "string",
                    enum: ["observed", "scheduled"],
                    "x-openchat-enum-aliases": aliases,
                    "x-openchat-require-explicit-for-image-only": true,
                },
                annotation: { type: "string" },
                message: { type: "string" },
            },
            required: ["kind"],
        });

        it.each(["measured", " MEASUREMENT ", "Capture"])(
            "maps only the target field's bounded whole-value alias: %s",
            (kind) => {
                expect(
                    applyRulesPostPass(
                        [],
                        { kind, annotation: "untouched" },
                        undefined,
                        kindSchema(),
                        {
                            hasImage: true,
                        },
                    ),
                ).toEqual({ kind: "observed", annotation: "untouched" });
            },
        );

        it("preserves canonical enum values and never defaults a missing explicit image field", () => {
            expect(
                applyRulesPostPass([], { kind: "scheduled" }, undefined, kindSchema(), {
                    hasImage: true,
                }),
            ).toEqual({ kind: "scheduled" });
            expect(applyRulesPostPass([], {}, undefined, kindSchema(), { hasImage: true })).toEqual(
                {},
            );
        });

        it.each(["other", "successful", "unmeasured", "measurement complete"])(
            "does not treat an undeclared or substring value as an alias: %s",
            (kind) => {
                expect(
                    applyRulesPostPass(
                        [],
                        { kind, annotation: "measured", message: "capture" },
                        undefined,
                        kindSchema(),
                        { hasImage: true },
                    ),
                ).toEqual({ annotation: "measured", message: "capture" });
            },
        );

        it("fails the target field closed when normalized aliases have ambiguous ownership", () => {
            const aliases = {
                observed: ["measurement"],
                scheduled: [" MEASUREMENT "],
            };
            expect(
                applyRulesPostPass([], { kind: "measurement" }, undefined, kindSchema(aliases), {
                    hasImage: true,
                }),
            ).toEqual({});
        });

        it("fails even a canonical target value closed when the declared alias table is malformed", () => {
            expect(
                applyRulesPostPass(
                    [],
                    { kind: "scheduled" },
                    undefined,
                    kindSchema({ observed: ["measured", " MEASURED "] }),
                    { hasImage: true },
                ),
            ).toEqual({});
        });

        it.each([
            ["not an object", ["measured"]],
            ["empty object", {}],
            ["unknown canonical", { unknown: ["measured"] }],
            ["empty aliases", { observed: [] }],
            ["non-string alias", { observed: [7] }],
            ["duplicate normalized alias", { observed: ["measured", " MEASURED "] }],
            ["oversized alias", { observed: ["x".repeat(65)] }],
            [
                "too many canonical keys",
                Object.fromEntries(
                    Array.from({ length: 9 }, (_, index) => [`value${index}`, ["alias"]]),
                ),
            ],
            [
                "too many aliases",
                { observed: Array.from({ length: 9 }, (_, index) => `alias${index}`) },
            ],
        ])("fails the target field closed for malformed aliases: %s", (_label, aliases) => {
            expect(
                applyRulesPostPass([], { kind: "measured" }, undefined, kindSchema(aliases), {
                    hasImage: true,
                }),
            ).toEqual({});
        });
    });
    it("minimum never applies to non-number values", () => {
        // An untyped field carrying a (nonsensical) numeric bound: a string value is untouched —
        // the bound constrains numbers only, exactly like JSON schema.
        const schema = {
            type: "object",
            properties: { annotation: { minimum: 5 }, code: { exclusiveMinimum: 5 } },
        };
        expect(applyRulesPostPass([], { annotation: "hi", code: "ab" }, undefined, schema)).toEqual(
            {
                annotation: "hi",
                code: "ab",
            },
        );
    });
    it("no schema passes a violating-looking value straight through", () => {
        expect(applyRulesPostPass([], { reading: -5 }, undefined, undefined)).toEqual({
            reading: -5,
        });
    });
});

describe("postProcessAiActionCandidate", () => {
    it("treats calendar fields as app output without deriving or rewriting them from source text", () => {
        const measurementDef: AiActionDefinition = {
            ...DEF,
            rules: [],
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number" },
                    observed_on: { type: "string", format: "date" },
                    window_open: { type: "string" },
                    window_close: { type: "string" },
                },
                required: ["reading"],
            },
        };
        const source = { text: "Measurement recorded 14 August 2026; sampling 6–10 August." };
        const candidate = {
            reading: 42,
            observed_on: "2026-09-01",
            window_open: "app-owned start",
            window_close: "app-owned end",
        };
        expect(postProcessAiActionCandidate(measurementDef, candidate, source)).toEqual(candidate);
        expect(postProcessAiActionCandidate(measurementDef, { reading: 42 }, source)).toEqual({
            reading: 42,
        });
        expect(candidate.observed_on).toBe("2026-09-01");
    });

    const def: AiActionDefinition = {
        ...DEF,
        acceptsImage: true,
        rules: [
            {
                kind: "keyword_map",
                field: "orientation",
                mode: "override",
                map: [
                    { value: "east", keywords: ["scanned to you"] },
                    { value: "west", keywords: ["you scan"] },
                ],
            },
        ],
        responseSchema: {
            type: "object",
            properties: {
                reading: { type: "number", exclusiveMinimum: 0 },
                orientation: { type: "string", enum: ["east", "west"] },
                date: {
                    type: "string",
                    format: "date",
                    "x-openchat-omit-for-image-only": true,
                },
                message: {
                    type: "string",
                    "x-openchat-omit-for-image-only": true,
                },
            },
            required: ["reading", "orientation"],
        },
    };

    it.each([undefined, "", "   "])(
        "does not promote model strings to image evidence and strips image-only fields (%s)",
        (text) => {
            expect(
                postProcessAiActionCandidate(
                    def,
                    {
                        reading: 350,
                        orientation: "scanned to you",
                        date: "2026-08-09",
                        message: "Cleaning fee scanned to you",
                    },
                    { hasImage: true, text },
                ),
            ).toEqual({ reading: 350 });
        },
    );

    it("retains annotated values and lets real source text stay authoritative for text input", () => {
        expect(
            postProcessAiActionCandidate(
                def,
                {
                    reading: 350,
                    orientation: "scanned to you",
                    date: "2026-08-09",
                    message: "model phrase scanned to you",
                },
                { text: "you scan this" },
            ),
        ).toEqual({
            reading: 350,
            orientation: "west",
            date: "2026-08-09",
            message: "model phrase scanned to you",
        });
    });

    it("makes a required image-only omitted field visibly missing to the caller's fail-closed gate", () => {
        const requiredMessageDef: AiActionDefinition = {
            ...def,
            responseSchema: {
                ...(def.responseSchema as object),
                required: ["reading", "orientation", "message"],
            },
        };
        const processed = postProcessAiActionCandidate(
            requiredMessageDef,
            { reading: 350, orientation: "scanned to you", message: "Cleaning fee scanned to you" },
            { hasImage: true },
        );

        expect(processed).toEqual({ reading: 350 });
        expect(missingRequired(processed, requiredMessageDef.responseSchema)).toEqual([
            "orientation",
            "message",
        ]);
    });

    describe("x-openchat-require-text-evidence", () => {
        const inferOk = (text: string) => async () => ({ kind: "ok" as const, text });
        const unitDef = (
            annotation: unknown = true,
            required: string[] = ["reading"],
        ): AiActionDefinition => ({
            ...DEF,
            rules: [
                {
                    kind: "keyword_map",
                    field: "unit",
                    mode: "hint",
                    map: [
                        { value: "LUX", keywords: ["lux", "$"] },
                        { value: "PPM", keywords: ["euros", "€"] },
                    ],
                },
            ],
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number", exclusiveMinimum: 0 },
                    unit: {
                        type: "string",
                        enum: ["LUX", "PPM", "HPA"],
                        "x-openchat-require-text-evidence": annotation,
                    },
                    annotation: { type: "string" },
                },
                required,
            },
        });

        it.each([
            ["the direct ISO code", "Measured 20 LUX for lunch"],
            ["a whole-word alias", "Measured 20 lux for lunch"],
            ["a punctuation alias touching the number", "Measured $20 for lunch"],
        ])("retains a normalized claim evidenced by %s", (_label, text) => {
            expect(
                postProcessAiActionCandidate(
                    unitDef(),
                    { reading: 20, unit: "LUX", annotation: "lunch" },
                    { text },
                ),
            ).toEqual({ reading: 20, unit: "LUX", annotation: "lunch" });
        });

        it.each([
            ["a different direct claim", "Measured 20 PPM for lunch", "LUX"],
            ["an unsupported claim", "Measured 20 for lunch", "HPA"],
        ])("deletes %s rather than trusting the model", (_label, text, unit) => {
            expect(
                postProcessAiActionCandidate(
                    unitDef(),
                    { reading: 20, unit, annotation: "lunch" },
                    { text },
                ),
            ).toEqual({ reading: 20, annotation: "lunch" });
        });

        it.each([
            ["image-only", { hasImage: true }],
            ["no source metadata", {}],
            ["empty source text", { text: "" }],
            ["whitespace source text", { text: "   " }],
        ])("preserves the claim when there is no authoritative text: %s", (_label, source) => {
            expect(
                postProcessAiActionCandidate(unitDef(), { reading: 20, unit: "LUX" }, source),
            ).toEqual({ reading: 20, unit: "LUX" });
        });

        it.each([false, "true", 1, null, { enabled: true }])(
            "ignores a malformed or disabled annotation (%s)",
            (annotation) => {
                expect(
                    postProcessAiActionCandidate(
                        unitDef(annotation),
                        { reading: 20, unit: "LUX" },
                        { text: "Measured 20 for lunch" },
                    ),
                ).toEqual({ reading: 20, unit: "LUX" });
            },
        );

        it("fails closed when evidence deletion makes a required field missing", async () => {
            const result = await runAiAction(
                unitDef(true, ["reading", "unit"]),
                { text: "Measured 20 for lunch" },
                RECIPIENT,
                inferOk('{"reading":20,"unit":"LUX"}'),
            );

            expect(result).toMatchObject({
                kind: "incomplete_extraction",
                missingFields: ["unit"],
                candidateCount: 1,
                validCandidateCount: 0,
            });
        });

        it("removes invented units independently from every stored multi-entry payload row", async () => {
            const result = await runAiAction(
                unitDef(),
                { text: "Lunch cost 20 and dinner cost 30" },
                RECIPIENT,
                inferOk(
                    '[{"reading":20,"unit":"LUX","annotation":"lunch"},' +
                        '{"reading":30,"unit":"PPM","annotation":"dinner"}]',
                ),
            );

            expect(result.kind).toBe("ready_multi");
            if (result.kind === "ready_multi") {
                const expected = [
                    { reading: 20, annotation: "lunch" },
                    { reading: 30, annotation: "dinner" },
                ];
                expect(result.extracted).toEqual(expected);
                expect(JSON.parse(new TextDecoder().decode(result.card.confirmPayload!))).toEqual(
                    expected,
                );
                expect(result.card.rows).toHaveLength(2);
                expect(result.card.rows.some((row) => /LUX|PPM/.test(row.value))).toBe(false);
            }
        });

        it("checks only the authoritative source prefix that the app can attest", () => {
            const def = unitDef();
            def.rules = [
                ...(def.rules ?? []),
                { kind: "from_message", field: "message", maxLength: 200 },
            ];
            def.responseSchema = {
                ...(def.responseSchema as object),
                properties: {
                    ...((def.responseSchema as { properties: object }).properties ?? {}),
                    message: { type: "string", maxLength: 200 },
                },
            };
            const source = `${"x".repeat(205)} LUX`;

            expect(
                postProcessAiActionCandidate(def, { reading: 20, unit: "LUX" }, { text: source }),
            ).toEqual({ reading: 20, message: "x".repeat(200) });
        });

        it("deletes a claim when the declared evidence field cannot survive its schema", () => {
            const def = unitDef();
            def.rules = [
                ...(def.rules ?? []),
                { kind: "from_message", field: "message", maxLength: 200 },
            ];
            def.responseSchema = {
                ...(def.responseSchema as object),
                properties: {
                    ...((def.responseSchema as { properties: object }).properties ?? {}),
                    message: { type: "string", maxLength: 100 },
                },
            };

            expect(
                postProcessAiActionCandidate(
                    def,
                    { reading: 20, unit: "LUX" },
                    { text: `${"x".repeat(150)} LUX` },
                ),
            ).toEqual({ reading: 20 });
        });
    });
});

describe("missingRequired", () => {
    const schema = {
        type: "object",
        properties: {
            reading: { type: "number", exclusiveMinimum: 0 },
            unit: { type: "string" },
        },
        required: ["reading", "unit"],
    };
    it("reports required fields absent from the extraction", () => {
        expect(missingRequired({ unit: "LUX" }, schema)).toEqual(["reading"]);
    });
    it("passes when every required field is present", () => {
        expect(missingRequired({ reading: 1, unit: "LUX" }, schema)).toEqual([]);
    });
    it("reports a required field the conformance pass deleted", () => {
        const conformed = applyRulesPostPass([], { reading: 0, unit: "LUX" }, undefined, schema);
        expect(missingRequired(conformed, schema)).toEqual(["reading"]);
    });
    it("returns [] when the schema declares no required fields, or there is no schema", () => {
        expect(missingRequired({}, { type: "object" })).toEqual([]);
        expect(missingRequired({}, undefined)).toEqual([]);
    });

    it("does not satisfy a required field through the prototype chain", () => {
        const inherited = Object.create({ reading: 10 }) as Record<string, unknown>;
        inherited.unit = "LUX";
        expect(missingRequired(inherited, schema)).toEqual(["reading"]);
    });

    it("treats forbidden required names as unsatisfied", () => {
        expect(
            missingRequired({ reading: 1 }, { required: ["reading", "__proto__", "constructor"] }),
        ).toEqual(["__proto__", "constructor"]);
    });
});

describe("untrusted extraction field integrity", () => {
    it("drops prototype keys and returns a null-prototype own-property map", () => {
        const extraction = JSON.parse(
            '{"reading":10,"annotation":"light","__proto__":{"admin":true},"constructor":"evil"}',
        ) as Record<string, unknown>;
        const conformed = applyRulesPostPass([], extraction, undefined);
        expect(Object.getPrototypeOf(conformed)).toBeNull();
        expect(conformed).toEqual({ reading: 10, annotation: "light" });
        expect(Object.hasOwn(conformed, "__proto__")).toBe(false);
        expect(Object.hasOwn(conformed, "constructor")).toBe(false);
    });

    it("serializes and displays only safe declared fields", () => {
        const def: AiActionDefinition = {
            ...DEF,
            responseSchema: {
                type: "object",
                properties: { reading: { type: "number" }, annotation: { type: "string" } },
                required: ["reading"],
            },
        };
        const raw = JSON.parse(
            '{"reading":10,"annotation":"light","prototype":"evil","__proto__":{"admin":true}}',
        ) as Record<string, unknown>;
        const safe = applyRulesPostPass([], raw, undefined, def.responseSchema);
        const card = buildActionCardContent(def, safe, RECIPIENT);
        expect(card.rows).toEqual([
            { label: "Reading", value: "10" },
            { label: "Annotation", value: "light" },
        ]);
        expect(JSON.parse(new TextDecoder().decode(card.confirmPayload!))).toEqual({
            reading: 10,
            annotation: "light",
        });
    });
});

describe("aiActionDefinitionFromWire", () => {
    const WIRE: AiActionDefinitionWire = {
        name: "demo.measurement.add",
        description: "Log measurement",
        prompt_template: "extract the record",
        response_schema: '{"type":"object"}',
        endpoint: "",
        consumer_public_key: "-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----\n",
        card: {
            title: "Log measurement",
            confirm_label: "Add",
            cancel_label: "Dismiss",
            rows: [
                { field: "reading", label: "Reading" },
                { field: "unit", label: "Unit" },
            ],
        },
    };

    it("maps the snake_case wire definition to a runner AiActionDefinition", () => {
        const def = aiActionDefinitionFromWire(WIRE);
        expect(def.name).toBe("demo.measurement.add");
        expect(def.promptTemplate).toBe("extract the record");
        expect(def.responseSchema).toEqual({ type: "object" });
        expect(def.consumerPublicKey).toContain("BEGIN PUBLIC KEY");
        expect(def.card.confirmLabel).toBe("Add");
        // card row `field` becomes the runner's `valueKey`
        expect(def.card.rows).toEqual([
            { label: "Reading", valueKey: "reading" },
            { label: "Unit", valueKey: "unit" },
        ]);
    });
    it("preserves the bounded image-only omission annotation from the wire schema", () => {
        const def = aiActionDefinitionFromWire({
            ...WIRE,
            response_schema: JSON.stringify({
                type: "object",
                properties: {
                    optionalValue: {
                        type: "string",
                        "x-openchat-omit-for-image-only": true,
                    },
                },
            }),
        });

        expect(def.responseSchema).toEqual({
            type: "object",
            properties: {
                optionalValue: {
                    type: "string",
                    "x-openchat-omit-for-image-only": true,
                },
            },
        });
    });
    it("tolerates a non-JSON schema string (no constraint)", () => {
        const def = aiActionDefinitionFromWire({ ...WIRE, response_schema: "not json" });
        expect(def.responseSchema).toBeUndefined();
    });
    it("defaults rules to [] when absent from the wire", () => {
        const def = aiActionDefinitionFromWire(WIRE);
        expect(def.rules).toEqual([]);
    });
    it("maps externally tagged wire rules to the flat domain union", () => {
        const def = aiActionDefinitionFromWire({
            ...WIRE,
            rules: [
                {
                    keyword_map: {
                        field: "category",
                        mode: "override",
                        map: [{ value: "travel", keywords: ["flight", "sensor"] }],
                    },
                },
                { from_message: { field: "annotation", max_length: 120 } },
                { normalize: { field: "reading", ops: ["k_m_suffix", "trim"] } },
                { instruction: { text: "Be terse." } },
                { context: { provide: ["today"] } },
            ],
        });
        expect(def.rules).toEqual([
            {
                kind: "keyword_map",
                field: "category",
                mode: "override",
                map: [{ value: "travel", keywords: ["flight", "sensor"] }],
            },
            { kind: "from_message", field: "annotation", maxLength: 120 },
            { kind: "normalize", field: "reading", ops: ["k_m_suffix", "trim"] },
            { kind: "instruction", text: "Be terse." },
            { kind: "context", provide: ["today"] },
        ]);
    });
    it("maps wire surfaces and defaults them to [] when absent", () => {
        const manifestWire: AiAppManifestWire = {
            name: "demo",
            description: "Demo app",
            consumer_public_key: "-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----\n",
            actions: [WIRE],
            surfaces: [
                {
                    kind: "chat_link",
                    url: "https://app.example/openchat/link-chat?app={appId}",
                    display: "sheet",
                },
                { kind: "docs", url: "https://app.example/docs", display: "external" },
            ],
        };
        const manifest = aiAppManifestFromWire(manifestWire);
        expect(manifest.surfaces).toEqual([
            {
                kind: "chat_link",
                url: "https://app.example/openchat/link-chat?app={appId}",
                display: "sheet",
            },
            { kind: "docs", url: "https://app.example/docs", display: "external" },
        ]);
        // Registrations that predate surfaces omit the field entirely.
        const legacy = aiAppManifestFromWire({ ...manifestWire, surfaces: undefined });
        expect(legacy.surfaces).toEqual([]);
    });

    it("maps the wire app/inbox canister ids and leaves them undefined when absent", () => {
        const base: AiAppManifestWire = {
            name: "demo",
            description: "Demo app",
            consumer_public_key: "-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----\n",
            actions: [WIRE],
            app_canister_id: "rrkah-fqaaa-aaaaa-aaaaq-cai",
            inbox_canister_id: "aaaaa-aa",
        };
        expect(aiAppManifestFromWire(base).appCanisterId).toBe("rrkah-fqaaa-aaaaa-aaaaq-cai");
        expect(aiAppManifestFromWire(base).inboxCanisterId).toBe("aaaaa-aa");
        expect(
            aiAppManifestFromWire({ ...base, app_canister_id: undefined }).appCanisterId,
        ).toBeUndefined();
        expect(
            aiAppManifestFromWire({ ...base, inbox_canister_id: undefined }).inboxCanisterId,
        ).toBeUndefined();
    });

    it("skips malformed wire rules instead of failing", () => {
        const def = aiActionDefinitionFromWire({
            ...WIRE,
            // deliberately broken entries mixed in with one valid rule
            rules: [
                "nonsense",
                { unknown_rule: { field: "x" } },
                { keyword_map: { field: "k", mode: "sideways", map: [] } },
                { instruction: { text: "Keep it short." } },
                // unrecognised normalize ops are dropped, the rule itself survives
                { normalize: { field: "reading", ops: ["trim", "future_op"] } },
            ] as unknown as NonNullable<AiActionDefinitionWire["rules"]>,
        });
        expect(def.rules).toEqual([
            { kind: "instruction", text: "Keep it short." },
            { kind: "normalize", field: "reading", ops: ["trim"] },
        ]);
    });

    it("fails the whole card template closed for forbidden, duplicate, or control-bearing rows", () => {
        for (const rows of [
            [
                { field: "reading", label: "Reading" },
                { field: "__proto__", label: "Admin" },
            ],
            [
                { field: "reading", label: "Reading" },
                { field: "unit", label: "Reading" },
            ],
            [
                { field: "reading", label: "Reading" },
                { field: "reading", label: "Again" },
            ],
            [{ field: "reading", label: "Reading\u202e" }],
        ]) {
            expect(
                aiActionDefinitionFromWire({ ...WIRE, card: { ...WIRE.card, rows } }).card.rows,
            ).toEqual([]);
        }
    });

    it("rejects forbidden rule targets and enforces aggregate rule/keyword budgets", () => {
        expect(
            rulesFromWire([
                { from_message: { field: "__proto__" } },
                { normalize: { field: "constructor", ops: ["trim"] } },
            ]),
        ).toEqual([]);

        const instructions = Array.from({ length: 21 }, (_, i) => ({
            instruction: { text: `instruction-${i}` },
        }));
        expect(rulesFromWire(instructions)).toHaveLength(20);

        const keywordRule = rulesFromWire([
            {
                keyword_map: {
                    field: "category",
                    mode: "override",
                    map: Array.from({ length: 11 }, (_, mapping) => ({
                        value: `value-${mapping}`,
                        keywords: Array.from(
                            { length: 50 },
                            (_, keyword) => `k${mapping}_${keyword}`,
                        ),
                    })),
                },
            },
        ]);
        expect(keywordRule).toHaveLength(1);
        if (keywordRule[0]?.kind !== "keyword_map") throw new Error("expected keyword map");
        expect(keywordRule[0].map.flatMap((mapping) => mapping.keywords)).toHaveLength(500);
    });
});

describe("chatKeyFor", () => {
    // These MUST byte-match the backend renderer
    // (backend/canisters/local_user_index/impl/src/action_deposit_envelope.rs `chat_key`).
    it("renders a group chat as group:<principal>", () => {
        expect(chatKeyFor({ kind: "group_chat", groupId: "dgegb-daaaa-aaaar-arlhq-cai" })).toBe(
            "group:dgegb-daaaa-aaaar-arlhq-cai",
        );
    });
    it("renders a channel as channel:<community principal>:<channel id decimal>", () => {
        expect(
            chatKeyFor({
                kind: "channel",
                communityId: "dgegb-daaaa-aaaar-arlhq-cai",
                channelId: 42,
            }),
        ).toBe("channel:dgegb-daaaa-aaaar-arlhq-cai:42");
    });
    it("uses the same byte-ordered direct identity from both participant perspectives", () => {
        const alice = "scp3f-4qbae-aq"; // principal bytes [1,1,1]
        const bob = "ed6q5-uqcai-ba"; // principal bytes [2,2,2]
        const expected = `direct:${alice}:${bob}`;
        expect(chatKeyFor({ kind: "direct_chat", userId: bob }, alice)).toBe(expected);
        expect(chatKeyFor({ kind: "direct_chat", userId: alice }, bob)).toBe(expected);
        expect(aiAppCardChatContext({ kind: "direct_chat", userId: bob }, alice)).toEqual({
            kind: "direct",
            userIds: [alice, bob],
        });
    });

    it("fails closed without the current direct-chat viewer or with an invalid pair", () => {
        const other = "ed6q5-uqcai-ba";
        expect(chatKeyFor({ kind: "direct_chat", userId: other })).toBeUndefined();
        expect(chatKeyFor({ kind: "direct_chat", userId: other }, other)).toBeUndefined();
        expect(
            chatKeyFor({ kind: "direct_chat", userId: other }, "not-a-principal"),
        ).toBeUndefined();
    });
});

describe("structured model replies preserve every record", () => {
    const REPORTED_MESSAGE = "Scan me 300 pressure 150 light\n\n500 humidity";

    const MODEL_3_ENTRIES = `[
  { "kind": "west", "reading": 300, "unit": "LUX", "orientation": "west", "annotation": "Pressure ride" },
  { "kind": "west", "reading": 150, "unit": "LUX", "orientation": "west", "annotation": "Light" },
  { "kind": "observed", "reading": 500, "unit": "LUX", "orientation": "east", "annotation": "Humidity" }
]`;

    const readingsOf = (entries: Record<string, unknown>[]) => entries.map((e) => e.reading);

    it("three records in, three entries out — including two on the SAME line", async () => {
        // "300 pressure 150 light" share a line; "500 humidity" is a paragraph away. Both splits must survive.
        expect(readingsOf(parseExtractionList(MODEL_3_ENTRIES)!)).toEqual([300, 150, 500]);
        const r = await runAiAction(MULTI_DEF, { text: REPORTED_MESSAGE }, RECIPIENT, async () => ({
            kind: "ok",
            text: MODEL_3_ENTRIES,
        }));
        expect(r.kind).toBe("ready_multi");
        if (r.kind === "ready_multi") {
            expect(readingsOf(r.extracted)).toEqual([300, 150, 500]);
            expect(r.card.rows).toHaveLength(3);
        }
    });

    it("never encodes the exact entry array into public rows", async () => {
        // Exact entries belong only in confirmPayload, never in a public display row.
        const r = await runAiAction(MULTI_DEF, { text: REPORTED_MESSAGE }, RECIPIENT, async () => ({
            kind: "ok",
            text: MODEL_3_ENTRIES,
        }));
        expect(r.kind).toBe("ready_multi");
        if (r.kind !== "ready_multi") throw new Error("expected a multi-entry card");
        const exactArray = MODEL_3_ENTRIES.replace(/\s+/g, "");
        expect(r.card.rows.some((row) => row.value.replace(/\s+/g, "").includes(exactArray))).toBe(
            false,
        );
        expect(r.card.rows.some((row) => row.label.startsWith("__oc_"))).toBe(false);
        expect(JSON.parse(new TextDecoder().decode(r.card.confirmPayload!))).toEqual(r.extracted);
    });

    it("gives each entry its OWN annotation, never the whole message", async () => {
        // The first form of this bug: every row got the entire message as its description, so three
        // entries read "Scan me 300 pressure 150 light 500 humidity". The annotation is the model's per-entry text;
        // the raw message travels separately, on `message`.
        const r = await runAiAction(MULTI_DEF, { text: REPORTED_MESSAGE }, RECIPIENT, async () => ({
            kind: "ok",
            text: MODEL_3_ENTRIES,
        }));
        expect(r.kind).toBe("ready_multi");
        if (r.kind !== "ready_multi") throw new Error("expected a multi-entry card");
        expect(r.extracted.map((e) => e.annotation)).toEqual([
            "Pressure ride",
            "Light",
            "Humidity",
        ]);
        for (const e of r.extracted) {
            expect(e.annotation).not.toContain("500 humidity");
        }
    });

    it("does not add any candidates beyond the model's duplicated reply", async () => {
        // The browser backend once received the message twice (prompt AND text) and duly extracted
        // 300 twice. The duplicate send is fixed and tested above; this pins the SYMPTOM, so a
        // reintroduction anywhere in the chain fails here too.
        const duplicated = `[
  { "kind": "west", "reading": 300, "annotation": "Pressure ride" },
  { "kind": "west", "reading": 150, "annotation": "Light" },
  { "kind": "west", "reading": 300, "annotation": "Pressure ride" },
  { "kind": "west", "reading": 150, "annotation": "Light" }
]`;
        const r = await runAiAction(MULTI_DEF, { text: REPORTED_MESSAGE }, RECIPIENT, async () => ({
            kind: "ok",
            text: duplicated,
        }));
        expect(r.kind).toBe("ready_multi");
        // We do NOT dedupe (two identical real records are legal), so this documents today's
        // behaviour deliberately: the guard against duplicates is the single-send test, not a filter.
        if (r.kind === "ready_multi") {
            expect(readingsOf(r.extracted)).toEqual([300, 150, 300, 150]);
        }
    });

    it("salvages the completed records when the model's reply is cut off mid-object", async () => {
        // A small model hitting the token cap truncates. Losing the tail is acceptable; losing
        // EVERYTHING (which is what happened before scanJsonObjects) is not — that is the long wait
        // ending in "nothing to process".
        const truncated = `[
  { "kind": "west", "reading": 300, "annotation": "Pressure ride" },
  { "kind": "west", "reading": 150, "annotation": "Light" },
  { "kind": "west", "reading": 500, "annotation": "Mov`;
        const r = await runAiAction(MULTI_DEF, { text: REPORTED_MESSAGE }, RECIPIENT, async () => ({
            kind: "ok",
            text: truncated,
        }));
        expect(r.kind).toBe("ready_multi");
        if (r.kind === "ready_multi") {
            expect(readingsOf(r.extracted)).toEqual([300, 150]);
        }
    });

    it("does not silently drop one degenerate record from a captured model reply", async () => {
        // reading 0 violates exclusiveMinimum, so that element is dropped by the viability gate — but
        // dropping the whole card would lose two good records with it.
        const withZero = `[
  { "kind": "west", "reading": 300, "annotation": "Pressure ride" },
  { "kind": "west", "reading": 0, "annotation": "Light" },
  { "kind": "west", "reading": 500, "annotation": "Humidity" }
]`;
        const r = await runAiAction(MULTI_DEF, { text: REPORTED_MESSAGE }, RECIPIENT, async () => ({
            kind: "ok",
            text: withZero,
        }));
        expect(r.kind).toBe("incomplete_extraction");
        if (r.kind === "incomplete_extraction") {
            expect(r.missingFields).toEqual(["reading"]);
            expect(r.candidateCount).toBe(3);
            expect(r.validCandidateCount).toBe(2);
        }
    });
});

// ── The reply SHAPES a small model actually emits ────────────────────────────
//
// This is the block that would have caught "produces two entries only, dropping the 150 light".
//
// Every one of these carries the same three records; only the packaging differs, and the
// packaging is not something we control — a model wraps its list under a key, splits it across two
// fenced blocks, or adds an afterthought object after the closing bracket, depending on its mood.
// The parser used to stop at the first promising REGION, so four of these six silently yielded FEWER
// entries than the message had readings. Silently is the operative word: the card just had fewer rows,
// which nobody notices without counting.
//
// Written as a table so a newly observed shape is one line, not a new test.
describe("parseExtractionList — the reply shapes a small model actually emits", () => {
    const SHAPES: [string, string][] = [
        // Used to yield 1: the scanner sees one top-level object and the entries are nested inside it.
        // That candidate then failed the required-field gate — the long wait ending in "nothing to
        // process".
        [
            "the list wrapped under a key",
            '{"records":[{"reading":300,"annotation":"pressure"},{"reading":150,"annotation":"light"},{"reading":500,"annotation":"humidity"}]}',
        ],
        // Used to yield 2: the fence match was non-greedy, so only the FIRST block was read.
        [
            "two separate fenced blocks",
            '```json\n[{"reading":300},{"reading":150}]\n```\n```json\n[{"reading":500}]\n```',
        ],
        // Used to yield 2: the array fast path returned as soon as the array parsed, ignoring the rest.
        [
            "an array plus an afterthought object",
            '[{"reading":300},{"reading":150}] and also {"reading":500}',
        ],
        [
            "a fenced array plus an afterthought object",
            'Sure:\n```json\n[{"reading":300},{"reading":150}]\n```\nplus {"reading":500}',
        ],
        // These already worked. Kept so a future "simplification" cannot quietly break them.
        ["bare objects, one per line", '{"reading":300}\n{"reading":150}\n{"reading":500}'],
        [
            "objects scattered through prose",
            '1. {"reading":300}\nThen: {"reading":150}\nFinally {"reading":500}\nThat is all.',
        ],
        ["a clean array", '[{"reading":300},{"reading":150},{"reading":500}]'],
    ];

    it.each(SHAPES)("keeps all three records: %s", (_name, raw) => {
        const got = parseExtractionList(raw);
        expect(got).toBeDefined();
        expect(got!.map((o) => o.reading)).toEqual([300, 150, 500]);
    });

    it("still finds nothing in a reply that contains no JSON at all", () => {
        // The negative control: scanning the whole text more aggressively must not start inventing
        // entries out of prose.
        expect(parseExtractionList("I could not find a record in that message.")).toBeUndefined();
    });

    it("does not unwrap a real extraction that happens to hold one array", () => {
        // {"schedule":[…]} is unwrapped (harmless — a bare schedule fails the required-field gate
        // anyway), but a genuine entry carries more than one field and must survive intact.
        const got = parseExtractionList(
            '{"reading":300,"schedule":[{"recorded_on":"2026-08-01"}]}',
        );
        expect(got).toHaveLength(1);
        expect(got![0].reading).toBe(300);
    });
});
