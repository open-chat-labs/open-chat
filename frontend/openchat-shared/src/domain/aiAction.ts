// Generic in-OpenChat AI-action runner.
//
// A registered app declares an AiAction (prompt + output schema + a card template + delivery metadata).
// The runner takes a message's content (image/text), runs the
// user's selected ON-DEVICE model against the declared prompt, parses the structured result, and builds a
// confirmable ActionCard whose rows come from the template. Nothing here is app-specific — every
// app-specific value comes from the registration. At confirmation the canisters use immutable app
// provenance plus authoritative membership to resolve the inbox and recipient keys; card-carried
// routing fields remain compatibility data, never authority.

import { Principal } from "@icp-sdk/core/principal";
import type { ActionCardContent, ActionCardRow, ChatIdentifier } from "./chat/chat";
import type { InferenceImageRegion, InferenceRequest, InferenceResult } from "./onDeviceModel";

// These are defense-in-depth limits at the untrusted manifest/model boundary. The registry enforces
// compatible per-field bounds, but clients must remain safe when reading legacy, cached, or malformed
// data and when a model emits an unexpectedly large candidate list.
export const MAX_AI_ACTION_CANDIDATES = 32;
// These byte/character ceilings mirror the card-attestation and chat-ingress protocol. Keep them
// client-visible so a model/manual extraction fails before provenance is minted instead of relying
// on a later canister rejection for limits the browser can compute exactly.
export const MAX_AI_ACTION_CARD_TITLE_CHARS = 200;
export const MAX_AI_ACTION_CARD_ROW_VALUE_CHARS = 4_096;
export const MAX_AI_APP_CONFIRM_PAYLOAD_BYTES = 16 * 1_024;
export const MAX_ATTESTED_ACTION_CARD_BYTES = 64 * 1_024;
const MAX_AI_ACTION_MODEL_OUTPUT_CHARS = 131_072;
const MAX_AI_ACTION_RULES = 20;
const MAX_AI_ACTION_KEYWORD_MAPPINGS = 50;
const MAX_AI_ACTION_KEYWORDS_PER_MAPPING = 50;
const MAX_AI_ACTION_KEYWORD_CHECKS = 500;
const MAX_AI_ACTION_RULE_STRING_LENGTH = 64;
const MAX_AI_ACTION_INSTRUCTION_LENGTH = 1_000;
const MAX_AI_ACTION_MESSAGE_SCAN_CHARS = 10_000;
const MAX_AI_ACTION_FROM_MESSAGE_LENGTH = 2_000;
const MAX_AI_ACTION_CARD_ROWS = 32;
const MAX_AI_ACTION_CARD_LABEL_LENGTH = 128;
// Private OCR is an in-memory bridge between the deterministic image reader and a text-only
// verification pass. Keep its complete UTF-8 payload below the same bounded source window the
// action parser scans; it must never become ordinary chat text or persisted card data.
export const MAX_PRIVATE_IMAGE_EVIDENCE_BYTES = 10_000;
export const MAX_AI_ACTION_PRIVATE_IMAGE_VERIFIER_PROMPT_BYTES = 4_096;
export const AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION = "x-openchat-private-image-verifier";
export const PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER = "{{PRIMARY_IMAGE_EVIDENCE_JSON}}";
export const PRIVATE_IMAGE_SEMANTIC_VALUES_PLACEHOLDER = "{{SEMANTIC_IMAGE_VALUES_JSON}}";
const SAFE_AI_ACTION_FIELD = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const AI_ACTION_WORD_CHAR = /[\p{L}\p{N}]/u;
const DISPLAY_CONTROL = /[\p{Cc}\p{Cf}]/u;
const FORBIDDEN_AI_ACTION_FIELDS = new Set(["__proto__", "prototype", "constructor"]);

export interface PrivateImageEvidence {
    // Exact text from the app-declared primary local image reader.
    primaryText: string;
    // Optional bounded values projected from app-declared semantic fields. Raw secondary-reader
    // text never crosses this boundary.
    semanticValues?: Record<string, string[]>;
}

export interface AiActionPrivateImageVerifierConfig {
    promptTemplate: string;
    requiredFields: string[];
    optionalFields: string[];
    semanticFields: string[];
    ocrProfiles: AiActionPrivateImageOcrProfile[];
}

export type AiActionPrivateImageOcrProfile = "eng" | "ara+eng";

const PRIVATE_IMAGE_OCR_PROFILES = new Set<AiActionPrivateImageOcrProfile>(["eng", "ara+eng"]);

const MAX_PRIVATE_IMAGE_VERIFIER_FIELDS = 16;
const MAX_PRIVATE_IMAGE_SEMANTIC_VALUES_PER_FIELD = 16;
const MAX_PRIVATE_IMAGE_SEMANTIC_VALUE_CHARS = 64;

function isPrivateImageSemanticValues(
    value: unknown,
    semanticFields: readonly string[],
): value is Record<string, string[]> {
    if (!isRecord(value)) return false;
    const entries = Object.entries(value);
    if (entries.length === 0 || entries.length > semanticFields.length) return false;
    const allowed = new Set(semanticFields);
    for (const [field, rawValues] of entries) {
        if (!allowed.has(field) || !Array.isArray(rawValues)) return false;
        if (
            rawValues.length === 0 ||
            rawValues.length > MAX_PRIVATE_IMAGE_SEMANTIC_VALUES_PER_FIELD
        ) {
            return false;
        }
        const seen = new Set<string>();
        for (const rawValue of rawValues) {
            if (
                typeof rawValue !== "string" ||
                rawValue.length === 0 ||
                [...rawValue].length > MAX_PRIVATE_IMAGE_SEMANTIC_VALUE_CHARS ||
                DISPLAY_CONTROL.test(rawValue) ||
                seen.has(rawValue)
            ) {
                return false;
            }
            seen.add(rawValue);
        }
    }
    return true;
}

export function isValidPrivateImageEvidence(
    value: unknown,
    semanticFields: readonly string[] = [],
): value is PrivateImageEvidence {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const evidence = value as Record<string, unknown>;
    const keys = Object.keys(evidence).sort();
    if (
        (keys.length !== 1 && keys.length !== 2) ||
        keys[0] !== "primaryText" ||
        (keys.length === 2 && keys[1] !== "semanticValues") ||
        typeof evidence.primaryText !== "string" ||
        evidence.primaryText.trim().length === 0 ||
        evidence.primaryText.includes("\0") ||
        (evidence.semanticValues !== undefined &&
            !isPrivateImageSemanticValues(evidence.semanticValues, semanticFields))
    ) {
        return false;
    }
    const encoder = new TextEncoder();
    const primaryBytes = encoder.encode(evidence.primaryText).byteLength;
    const semanticBytes =
        evidence.semanticValues !== undefined
            ? encoder.encode(JSON.stringify(evidence.semanticValues)).byteLength
            : 0;
    return (
        primaryBytes <= MAX_PRIVATE_IMAGE_EVIDENCE_BYTES &&
        semanticBytes <= MAX_PRIVATE_IMAGE_EVIDENCE_BYTES &&
        primaryBytes + semanticBytes <= MAX_PRIVATE_IMAGE_EVIDENCE_BYTES
    );
}

function privateImageEvidencePrompt(
    config: AiActionPrivateImageVerifierConfig,
    evidence: PrivateImageEvidence,
): string {
    return config.promptTemplate
        .replace(PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER, JSON.stringify(evidence.primaryText))
        .replace(
            PRIVATE_IMAGE_SEMANTIC_VALUES_PLACEHOLDER,
            JSON.stringify(evidence.semanticValues ?? null),
        );
}

// Optional app-declared image prompt carried inside the already-bounded response schema. Keeping
// this as a schema extension avoids a second action-definition wire format while letting an app
// remove text-oriented/redundant guidance from expensive vision prefill. A malformed extension is
// ignored so legacy/cached registrations retain the original prompt and rule guidance.
export const AI_ACTION_IMAGE_PROMPT_EXTENSION = "x-openchat-image-prompt-template";
export const AI_ACTION_IMAGE_PROMPT_BY_MODEL_EXTENSION = "x-openchat-image-prompt-by-model";
export const AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION = "x-openchat-image-focused-passes";
export const MAX_AI_ACTION_IMAGE_PROMPT_BYTES = 4_096;
export const MAX_AI_ACTION_IMAGE_PROMPT_MODELS = 8;
export const MAX_AI_ACTION_IMAGE_PROMPT_MODEL_ID_CHARS = 128;
export const MAX_AI_ACTION_IMAGE_PROMPT_BY_MODEL_BYTES = 16_384;

export interface AiActionImagePromptTemplateConfig {
    template: string;
    includeRuleGuidance: boolean;
    /** Present only in the atomic v2 per-model contract; v1 always emits canonical fields. */
    output?: "canonical" | "app";
}

// An additive extension lets an app split expensive image extraction into a few small, disjoint
// field passes while keeping the backwards-compatible v1 compact primary prompt. Each pass owns
// exactly the fields it names: model output for every other field is discarded before schema/rule
// processing. This is both a phone-memory guard and a correctness boundary.
export const MAX_AI_ACTION_IMAGE_MODEL_PASSES = 3;
export const MAX_AI_ACTION_IMAGE_PASS_FIELDS = 16;
export const MAX_AI_ACTION_IMAGE_PASS_TOKENS = 96;

export interface AiActionImageModelPassConfig {
    template: string;
    fields: string[];
    includeRuleGuidance: boolean;
    includeMessage: boolean;
    maxTokens: number;
    imageRegion?: InferenceImageRegion;
}

export interface AiActionImageModelPassesConfig {
    primaryFields: string[];
    primaryMaxTokens: number;
    passes: AiActionImageModelPassConfig[];
}

function containsUnsafePromptCodePoint(value: string): boolean {
    for (const character of value) {
        const codePoint = character.codePointAt(0)!;
        // Preserve ordinary language/script characters, multiline formatting, joiners and
        // variation selectors. Reject transport-hostile controls, direction-changing/invisible
        // isolates, and lone UTF-16 surrogates; valid surrogate pairs are one code point here.
        if (
            (codePoint < 0x20 && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d) ||
            (codePoint >= 0x7f && codePoint <= 0x9f) ||
            (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
            codePoint === 0x061c ||
            codePoint === 0x200b ||
            (codePoint >= 0x200e && codePoint <= 0x200f) ||
            (codePoint >= 0x202a && codePoint <= 0x202e) ||
            (codePoint >= 0x2060 && codePoint <= 0x206f) ||
            codePoint === 0xfeff
        ) {
            return true;
        }
    }
    return false;
}

function exactSubstringCount(value: string, substring: string): number {
    let count = 0;
    let from = 0;
    while (from <= value.length - substring.length) {
        const index = value.indexOf(substring, from);
        if (index < 0) break;
        count++;
        from = index + substring.length;
    }
    return count;
}

function privateImageVerifierFieldList(
    value: unknown,
    properties: Record<string, unknown>,
): string[] | undefined {
    if (!Array.isArray(value) || value.length > MAX_PRIVATE_IMAGE_VERIFIER_FIELDS) {
        return undefined;
    }
    const fields: string[] = [];
    const seen = new Set<string>();
    for (const field of value) {
        if (
            typeof field !== "string" ||
            !isSafeAiActionFieldName(field) ||
            !Object.hasOwn(properties, field) ||
            seen.has(field)
        ) {
            return undefined;
        }
        seen.add(field);
        fields.push(field);
    }
    return fields;
}

/** Parse the complete app-authored private image verifier contract. OpenChat validates only
 * bounded prompt/field structure; all field names and semantic meanings remain app-owned. */
export function privateImageVerifierConfig(
    responseSchema: object | undefined,
): AiActionPrivateImageVerifierConfig | undefined {
    if (
        !isRecord(responseSchema) ||
        !Object.hasOwn(responseSchema, AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION) ||
        !isRecord(responseSchema.properties)
    ) {
        return undefined;
    }
    const raw = responseSchema[AI_ACTION_PRIVATE_IMAGE_VERIFIER_EXTENSION];
    if (!isRecord(raw)) return undefined;
    const keys = Object.keys(raw).sort();
    const versionOneKeys = [
        "optionalFields",
        "promptTemplate",
        "requiredFields",
        "semanticFields",
        "version",
    ];
    const versionTwoKeys = [
        "ocrProfiles",
        "optionalFields",
        "promptTemplate",
        "requiredFields",
        "semanticFields",
        "version",
    ];
    const expectedKeys =
        raw.version === 1 ? versionOneKeys : raw.version === 2 ? versionTwoKeys : [];
    if (
        keys.length !== expectedKeys.length ||
        keys.some((key, index) => key !== expectedKeys[index]) ||
        typeof raw.promptTemplate !== "string" ||
        raw.promptTemplate.length === 0 ||
        new TextEncoder().encode(raw.promptTemplate).byteLength >
            MAX_AI_ACTION_PRIVATE_IMAGE_VERIFIER_PROMPT_BYTES ||
        containsUnsafePromptCodePoint(raw.promptTemplate) ||
        exactSubstringCount(raw.promptTemplate, PRIVATE_IMAGE_PRIMARY_EVIDENCE_PLACEHOLDER) !== 1 ||
        exactSubstringCount(raw.promptTemplate, PRIVATE_IMAGE_SEMANTIC_VALUES_PLACEHOLDER) !== 1
    ) {
        return undefined;
    }
    const properties = responseSchema.properties;
    const requiredFields = privateImageVerifierFieldList(raw.requiredFields, properties);
    const optionalFields = privateImageVerifierFieldList(raw.optionalFields, properties);
    const semanticFields = privateImageVerifierFieldList(raw.semanticFields, properties);
    const ocrProfiles: AiActionPrivateImageOcrProfile[] = [];
    if (raw.version === 1) {
        ocrProfiles.push("eng");
    } else {
        if (
            !Array.isArray(raw.ocrProfiles) ||
            raw.ocrProfiles.length === 0 ||
            raw.ocrProfiles.length > 2
        ) {
            return undefined;
        }
        for (const profile of raw.ocrProfiles) {
            if (
                typeof profile !== "string" ||
                !PRIVATE_IMAGE_OCR_PROFILES.has(profile as AiActionPrivateImageOcrProfile) ||
                ocrProfiles.includes(profile as AiActionPrivateImageOcrProfile)
            ) {
                return undefined;
            }
            ocrProfiles.push(profile as AiActionPrivateImageOcrProfile);
        }
    }
    if (
        requiredFields === undefined ||
        requiredFields.length === 0 ||
        optionalFields === undefined ||
        semanticFields === undefined
    ) {
        return undefined;
    }
    const outputFields = new Set(requiredFields);
    for (const field of optionalFields) {
        if (outputFields.has(field)) return undefined;
        outputFields.add(field);
    }
    if (
        outputFields.size > MAX_PRIVATE_IMAGE_VERIFIER_FIELDS ||
        semanticFields.some((field) => !outputFields.has(field))
    ) {
        return undefined;
    }
    return {
        promptTemplate: raw.promptTemplate,
        requiredFields,
        optionalFields,
        semanticFields,
        ocrProfiles,
    };
}

/** Parse the exact v1 image-prompt extension without mutating or trimming its template. */
export function imagePromptTemplateConfig(
    responseSchema: object | undefined,
): AiActionImagePromptTemplateConfig | undefined {
    if (
        responseSchema === undefined ||
        !Object.hasOwn(responseSchema, AI_ACTION_IMAGE_PROMPT_EXTENSION)
    ) {
        return undefined;
    }
    const raw = (responseSchema as Record<string, unknown>)[AI_ACTION_IMAGE_PROMPT_EXTENSION];
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const extension = raw as Record<string, unknown>;
    const keys = Object.keys(extension).sort();
    if (
        keys.length !== 3 ||
        keys[0] !== "includeRuleGuidance" ||
        keys[1] !== "template" ||
        keys[2] !== "version" ||
        extension.version !== 1 ||
        typeof extension.template !== "string" ||
        extension.template.trim().length === 0 ||
        new TextEncoder().encode(extension.template).byteLength >
            MAX_AI_ACTION_IMAGE_PROMPT_BYTES ||
        containsUnsafePromptCodePoint(extension.template) ||
        typeof extension.includeRuleGuidance !== "boolean"
    ) {
        return undefined;
    }
    return {
        template: extension.template,
        includeRuleGuidance: extension.includeRuleGuidance,
    };
}

// The model IDs and prompt contents are opaque app-authored data. This additive sibling leaves
// the exact v1 extension intact for older clients, unknown models and text/private-reader paths.
// Inspect data descriptors rather than invoking accessors on an in-memory schema object.
function imagePromptOwnData(value: unknown): Record<string, unknown> | undefined {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const entries: [string, unknown][] = [];
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== "string") return undefined;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
            return undefined;
        }
        entries.push([key, descriptor.value]);
    }
    return Object.fromEntries(entries);
}

/** Select only an exact registered model ID. Any malformed entry rejects the whole extension.
 * The aggregate bound covers the UTF-8 serialized extension, including keys and JSON escapes. */
export function imagePromptTemplateForModel(
    responseSchema: object | undefined,
    modelId: string | undefined,
): AiActionImagePromptTemplateConfig | undefined {
    if (responseSchema === undefined || typeof modelId !== "string") return undefined;
    try {
        const property = Object.getOwnPropertyDescriptor(
            responseSchema,
            AI_ACTION_IMAGE_PROMPT_BY_MODEL_EXTENSION,
        );
        if (property?.enumerable !== true || !Object.hasOwn(property, "value")) return undefined;
        const extension = imagePromptOwnData(property.value);
        if (
            extension === undefined ||
            Object.keys(extension).sort().join(",") !== "templates,version" ||
            (extension.version !== 1 && extension.version !== 2)
        ) {
            return undefined;
        }
        const templates = imagePromptOwnData(extension.templates);
        if (templates === undefined) return undefined;
        const entries = Object.entries(templates);
        if (entries.length === 0 || entries.length > MAX_AI_ACTION_IMAGE_PROMPT_MODELS) {
            return undefined;
        }
        const encoder = new TextEncoder();
        const validated = new Map<string, AiActionImagePromptTemplateConfig>();
        for (const [id, raw] of entries) {
            if (
                id.length > MAX_AI_ACTION_IMAGE_PROMPT_MODEL_ID_CHARS ||
                !/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/.test(id)
            ) {
                return undefined;
            }
            const config = imagePromptOwnData(raw);
            if (
                config === undefined ||
                Object.keys(config).sort().join(",") !==
                    (extension.version === 1
                        ? "includeRuleGuidance,template"
                        : "includeRuleGuidance,output,template") ||
                typeof config.template !== "string" ||
                config.template.length > MAX_AI_ACTION_IMAGE_PROMPT_BYTES ||
                config.template.trim().length === 0 ||
                encoder.encode(config.template).byteLength > MAX_AI_ACTION_IMAGE_PROMPT_BYTES ||
                containsUnsafePromptCodePoint(config.template) ||
                typeof config.includeRuleGuidance !== "boolean" ||
                (extension.version === 2 &&
                    config.output !== "canonical" &&
                    config.output !== "app")
            ) {
                return undefined;
            }
            validated.set(id, {
                template: config.template,
                includeRuleGuidance: config.includeRuleGuidance,
                ...(extension.version === 2
                    ? { output: config.output as "canonical" | "app" }
                    : {}),
            });
        }
        const serialized = JSON.stringify({
            version: extension.version,
            templates: Object.fromEntries(validated),
        });
        if (encoder.encode(serialized).byteLength > MAX_AI_ACTION_IMAGE_PROMPT_BY_MODEL_BYTES) {
            return undefined;
        }
        return validated.get(modelId);
    } catch {
        // Malformed/proxied local schema values cannot turn an optional extension into a crash.
        return undefined;
    }
}

/** Parse focused passes layered over the backwards-compatible compact primary prompt. Version 1
 * receives the original image for every pass. Version 2 permits only lower_half. Version 3 permits
 * lower_half/detail_card. Version 4 adds lower_detail_rows without broadening v3; older clients
 * ignore the unknown optional extension and safely keep the compact primary pass. */
export function imageModelPassesConfig(
    responseSchema: object | undefined,
): AiActionImageModelPassesConfig | undefined {
    if (
        responseSchema === undefined ||
        !Object.hasOwn(responseSchema, AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION)
    ) {
        return undefined;
    }
    const raw = (responseSchema as Record<string, unknown>)[
        AI_ACTION_IMAGE_FOCUSED_PASSES_EXTENSION
    ];
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const extension = raw as Record<string, unknown>;
    const extensionKeys = Object.keys(extension).sort();
    const extensionVersion = extension.version as 1 | 2 | 3 | 4;
    if (
        extensionKeys.length !== 4 ||
        extensionKeys[0] !== "passes" ||
        extensionKeys[1] !== "primaryFields" ||
        extensionKeys[2] !== "primaryMaxTokens" ||
        extensionKeys[3] !== "version" ||
        (extensionVersion !== 1 &&
            extensionVersion !== 2 &&
            extensionVersion !== 3 &&
            extensionVersion !== 4) ||
        !Array.isArray(extension.primaryFields) ||
        extension.primaryFields.length === 0 ||
        extension.primaryFields.length > MAX_AI_ACTION_IMAGE_PASS_FIELDS ||
        !Number.isInteger(extension.primaryMaxTokens) ||
        (extension.primaryMaxTokens as number) < 1 ||
        (extension.primaryMaxTokens as number) > MAX_AI_ACTION_IMAGE_PASS_TOKENS ||
        !Array.isArray(extension.passes) ||
        extension.passes.length === 0 ||
        extension.passes.length >= MAX_AI_ACTION_IMAGE_MODEL_PASSES
    ) {
        return undefined;
    }

    const properties = (responseSchema as Record<string, unknown>).properties;
    if (properties === null || typeof properties !== "object" || Array.isArray(properties)) {
        return undefined;
    }

    const ownedFields = new Set<string>();
    const primaryFields: string[] = [];
    for (const field of extension.primaryFields) {
        if (
            typeof field !== "string" ||
            !isSafeAiActionFieldName(field) ||
            !Object.hasOwn(properties, field) ||
            ownedFields.has(field)
        ) {
            return undefined;
        }
        ownedFields.add(field);
        primaryFields.push(field);
    }
    const passes: AiActionImageModelPassConfig[] = [];
    let totalPromptBytes = 0;
    for (const rawPass of extension.passes) {
        if (rawPass === null || typeof rawPass !== "object" || Array.isArray(rawPass)) {
            return undefined;
        }
        const pass = rawPass as Record<string, unknown>;
        const passKeys = Object.keys(pass).sort();
        const validPassKeys =
            extensionVersion === 1
                ? passKeys.length === 5 &&
                  passKeys[0] === "fields" &&
                  passKeys[1] === "includeMessage" &&
                  passKeys[2] === "includeRuleGuidance" &&
                  passKeys[3] === "maxTokens" &&
                  passKeys[4] === "template"
                : passKeys.length === 6 &&
                  passKeys[0] === "fields" &&
                  passKeys[1] === "imageRegion" &&
                  passKeys[2] === "includeMessage" &&
                  passKeys[3] === "includeRuleGuidance" &&
                  passKeys[4] === "maxTokens" &&
                  passKeys[5] === "template";
        if (
            !validPassKeys ||
            typeof pass.template !== "string" ||
            pass.template.trim().length === 0 ||
            containsUnsafePromptCodePoint(pass.template) ||
            typeof pass.includeRuleGuidance !== "boolean" ||
            typeof pass.includeMessage !== "boolean" ||
            !Number.isInteger(pass.maxTokens) ||
            (pass.maxTokens as number) < 1 ||
            (pass.maxTokens as number) > MAX_AI_ACTION_IMAGE_PASS_TOKENS ||
            !Array.isArray(pass.fields) ||
            pass.fields.length === 0 ||
            pass.fields.length > MAX_AI_ACTION_IMAGE_PASS_FIELDS ||
            (extensionVersion === 2 && pass.imageRegion !== "lower_half") ||
            (extensionVersion === 3 &&
                pass.imageRegion !== "lower_half" &&
                pass.imageRegion !== "detail_card") ||
            (extensionVersion === 4 &&
                pass.imageRegion !== "lower_half" &&
                pass.imageRegion !== "detail_card" &&
                pass.imageRegion !== "lower_detail_rows")
        ) {
            return undefined;
        }
        totalPromptBytes += new TextEncoder().encode(pass.template).byteLength;
        if (totalPromptBytes > MAX_AI_ACTION_IMAGE_PROMPT_BYTES) return undefined;

        const fields: string[] = [];
        for (const field of pass.fields) {
            if (
                typeof field !== "string" ||
                !isSafeAiActionFieldName(field) ||
                !Object.hasOwn(properties, field) ||
                ownedFields.has(field)
            ) {
                return undefined;
            }
            ownedFields.add(field);
            fields.push(field);
        }
        passes.push({
            template: pass.template,
            fields,
            includeRuleGuidance: pass.includeRuleGuidance,
            includeMessage: pass.includeMessage,
            maxTokens: pass.maxTokens as number,
            imageRegion:
                extensionVersion >= 2 ? (pass.imageRegion as InferenceImageRegion) : undefined,
        });
    }
    return {
        primaryFields,
        primaryMaxTokens: extension.primaryMaxTokens as number,
        passes,
    };
}

export function isSafeAiActionFieldName(field: string): boolean {
    return SAFE_AI_ACTION_FIELD.test(field) && !FORBIDDEN_AI_ACTION_FIELDS.has(field);
}

function normalizedCardRows(
    rows: readonly AiActionCardRowTemplate[],
): AiActionCardRowTemplate[] | undefined {
    if (rows.length === 0 || rows.length > MAX_AI_ACTION_CARD_ROWS) return undefined;
    const labels = new Set<string>();
    const fields = new Set<string>();
    const normalized: AiActionCardRowTemplate[] = [];
    for (const row of rows) {
        const label = row.label.trim();
        if (
            !isSafeAiActionFieldName(row.valueKey) ||
            label.length === 0 ||
            label.length > MAX_AI_ACTION_CARD_LABEL_LENGTH ||
            DISPLAY_CONTROL.test(label) ||
            label.startsWith("__oc_") ||
            labels.has(label) ||
            fields.has(row.valueKey)
        ) {
            return undefined;
        }
        labels.add(label);
        fields.add(row.valueKey);
        normalized.push({ label, valueKey: row.valueKey });
    }
    return normalized;
}

// A row of the card, declaratively bound to a key in the model's structured output.
export interface AiActionCardRowTemplate {
    label: string;
    // The key in the extracted JSON object whose value fills this row.
    valueKey: string;
}

export interface AiActionCardTemplate {
    title: string;
    rows: AiActionCardRowTemplate[];
    confirmLabel: string;
    cancelLabel: string;
    disclosure?: string;
}

// Declarative extraction rules a registering app can attach to its action. Rules serve two purposes:
// they compile into prompt guidance for the model (compileRules) and they run as a deterministic
// post-pass over the model's extraction (applyRulesPostPass). All rules are generic — field names,
// values and keywords come from the registration.
export type AiActionRuleMode = "hint" | "override";
export type AiActionNormalizeOp =
    | "k_m_suffix"
    | "strip_symbols"
    | "uppercase"
    | "lowercase"
    | "trim";
export type AiActionRule =
    | {
          kind: "keyword_map";
          field: string;
          mode: AiActionRuleMode;
          map: { value: string; keywords: string[] }[];
      }
    | { kind: "from_message"; field: string; maxLength?: number }
    | { kind: "normalize"; field: string; ops: AiActionNormalizeOp[] }
    | { kind: "instruction"; text: string }
    // Optional non-source context. `today` is supplied only alongside nonempty text evidence; it is
    // never injected into an image-only prompt where a model could mistake it for visible content.
    | { kind: "context"; provide: "today"[] };

// The frontend mirror of the on-chain AiActionDefinition (types/src/ai_actions.rs). All values are supplied by
// the registering app; OpenChat treats them opaquely.
export interface AiActionDefinition {
    // Stable id, used as the card's actionId.
    name: string;
    description: string;
    // CALLER-SUPPLIED extraction prompt handed verbatim to the on-device model.
    promptTemplate: string;
    // Optional JSON schema the model is asked (best-effort) to conform to.
    responseSchema?: object;
    card: AiActionCardTemplate;
    // Optional legacy webhook (relay path); unused for the on-chain inbox delivery.
    endpoint?: string;
    // P-256 SPKI PEM — the recipient OpenChat encrypts confirmed actions to. Required for inbox delivery.
    consumerPublicKey?: string;
    // Missing/"confirmer" keeps legacy least-privilege delivery. "app_authorized" lets the
    // vouched app select a bounded current per-user-key recipient set at confirmation time.
    recipientScope?: "confirmer" | "app_authorized";
    // Optional extraction rules (absent === []).
    rules?: AiActionRule[];
    // True if the action can extract from an IMAGE message; drives the auto-propose image chip
    // (only image-capable actions are offered on images). Absent === false (the mapper defaults it).
    acceptsImage?: boolean;
}

// --- AI-app directory (Phase A) --------------------------------------------------------------------------------
// An app registers ONE manifest (name, description, delivery key, its actions) with the user_index; chat
// owners/admins then enable the app per chat. The manifest-level consumerPublicKey is the app's delivery
// key; an action's own consumerPublicKey, when set, overrides it.

// How OpenChat presents a declared surface.
//   "sheet"    = embedded in-app (an iframe hosted in a bottom sheet)
//   "external" = opened in the system browser / a new tab
export type AiAppSurfaceDisplay = "sheet" | "external";

// The frontend mirror of the on-chain AiAppSurface (types/src/ai_actions.rs): a URL OpenChat can open
// on the app's behalf. `kind` says what the surface is for — "chat_link" = configure/link a chat inside
// the app (OpenChat opens it after the first confirmed action in a chat); other kinds are app-defined
// and OpenChat ignores kinds it does not know. The URL may contain only the public {appId}
// placeholder. Raw chat/message/user coordinates are never substituted into external URLs.
export interface AiAppSurface {
    kind: string;
    url: string;
    display: AiAppSurfaceDisplay;
}

// Canonical, generic rendering of a chat identity for surface URLs. MUST byte-match the backend
// renderer (backend/canisters/local_user_index/impl/src/action_deposit_envelope.rs `chat_key`) because
// apps correlate this value with the delivery provenance (`context.chat`) of confirmed actions:
//   "group:<group canister principal text>"
//   "channel:<community canister principal text>:<channel id decimal>"
// Direct chats bind the sorted pair of viewer + counterpart. This makes the same logical chat
// byte-identical from both participants' perspectives without exposing a session credential.
export type AiAppCardChatContext =
    | { kind: "group"; groupId: string }
    | { kind: "channel"; communityId: string; channelId: number }
    | { kind: "direct"; userIds: [string, string] };

function comparePrincipalBytes(left: string, right: string): number {
    const a = Principal.fromText(left).toUint8Array();
    const b = Principal.fromText(right).toUint8Array();
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
}

export function aiAppCardChatContext(
    chatId: ChatIdentifier,
    currentUserId: string,
): AiAppCardChatContext | undefined {
    switch (chatId.kind) {
        case "group_chat":
            return { kind: "group", groupId: chatId.groupId };
        case "channel":
            return {
                kind: "channel",
                communityId: chatId.communityId,
                channelId: chatId.channelId,
            };
        case "direct_chat": {
            if (currentUserId === chatId.userId) return undefined;
            try {
                const userIds = [currentUserId, chatId.userId].sort(comparePrincipalBytes) as [
                    string,
                    string,
                ];
                return { kind: "direct", userIds };
            } catch {
                return undefined;
            }
        }
    }
}

export function chatKeyFor(chatId: ChatIdentifier, currentUserId?: string): string | undefined {
    switch (chatId.kind) {
        case "group_chat":
            return `group:${chatId.groupId}`;
        case "channel":
            return `channel:${chatId.communityId}:${chatId.channelId}`;
        case "direct_chat": {
            // Both participants derive the same sorted two-principal identity. Missing viewer
            // context fails closed rather than falling back to the old ambiguous counterpart key.
            if (currentUserId === undefined) return undefined;
            const context = aiAppCardChatContext(chatId, currentUserId);
            return context?.kind === "direct"
                ? `direct:${context.userIds[0]}:${context.userIds[1]}`
                : undefined;
        }
    }
}

// The frontend mirror of the on-chain AiAppManifest (types/src/ai_actions.rs).
export interface AiAppManifest {
    // Unique per owner; the stable id used for upsert-by-(owner, name).
    name: string;
    description: string;
    iconUrl?: string;
    // Canister authorized to redeem per-user link codes and attest app-authored cards.
    appCanisterId?: string;
    // P-256 SPKI PEM: the app-level delivery key confirmed actions are encrypted to.
    consumerPublicKey: string;
    // When true, each user's confirmed actions are delivered encrypted to THAT user's own registered
    // key (see AiAppUserKey) instead of the manifest/action key; a user with no registered key must
    // first pair via a link code. Absent === false (legacy single-key delivery).
    perUserKeys?: boolean;
    actions: AiActionDefinition[];
    // Surfaces the app declares (absent === []).
    surfaces?: AiAppSurface[];
    // Optional per-app inbox canister (text principal, decoded by the agent layer). When set, the
    // card-builder routes this app's confirmed actions here instead of the global action_inbox.
    inboxCanisterId?: string;
}

// The frontend mirror of the on-chain AiAppRegistration returned by bounded UserIndex app queries.
export interface AiAppRegistration {
    id: number;
    owner: string;
    manifest: AiAppManifest;
    created: bigint;
    updated: bigint;
    // Directory visibility (Phase B): unpublished apps are visible only to their owner.
    published: boolean;
}

// The calling user's own registered delivery key for one app, as the user_index `my_ai_app_keys`
// query returns it. For a per-user-keys app this key (not the manifest key) is the effective
// recipient of that user's confirmed actions.
export interface AiAppUserKey {
    appId: number;
    publicKey: string;
    // Monotonic consent epoch for this exact user/app binding. A fresh link-code claim advances it
    // even when the app deliberately reuses the same durable PEM.
    keyVersion: bigint;
}

// One row of the guarded user_index `ai_app_user_keys` C2C lookup: a chat MEMBER's registered
// delivery key for one app. The local_user_index requests these at confirmation using member ids
// supplied by the authoritative chat canister; browser callers cannot enumerate another user's keys.
export interface AiAppMemberKey {
    userId: string;
    publicKey: string;
}

// A one-time high-entropy claim token (user_index `create_ai_app_link_code`): the user enters it in
// the app, whose exact registered app canister calls `c2c_claim_ai_app_link_code` with the code and
// public key. Success returns `{ app_subject, subject_version, app_id, app_revision, app_canister_id,
// key_version }`; the app must retain that exact app-scoped binding tuple. Revocation sends the same
// app-subject/app/key_version/public-key tuple,
// a fresh timestamp, and its 64-byte P-256 proof to `revoke_ai_app_user_key`. The deprecated public
// `claim_ai_app_link_code` method is never an integration path. The code is single-use and expires at
// `expiresAt` (epoch millis).
export interface AiAppLinkCode {
    code: string;
    expiresAt: bigint;
}

// A short-lived, one-time bearer minted by the authoritative chat canister for one exact
// app/revision/chat tuple. The raw 32 bytes are kept only long enough to build or cancel the
// chat_link URL; they must never be persisted or logged.
export interface AiAppChatLinkToken {
    token: Uint8Array;
    expiresAt: bigint;
}

// Short-lived, viewer/card/recipient-key-bound authority for a private app-card context. The UI
// represents the opaque token as unpadded base64url solely for delivery to the exact sandboxed
// WindowProxy after source + opaque-origin + per-load nonce checks.
export interface AppScopedCardContext {
    contextVersion: 1;
    appSubject: string;
    chatHandle: string;
    messageHandle: string;
    appId: number;
    appRevision: bigint;
    actionId: string;
}

export interface AiAppCardCapability {
    capability: string;
    expiresAt: bigint;
    context: AppScopedCardContext;
}

// The browser envelope deliberately mirrors a card capability, while this named alias makes the
// isolated private-match mint/redeem path explicit at its call sites.
export type AiAppPrivateMatchCapability = AiAppCardCapability;

// Opaque one-time server/app attestation over one exact final confirmation payload. Kept as raw
// bytes because the client returns it only to the authoritative chat canister alongside the exact
// payload bytes; it is never exposed to the iframe, URL, storage, or logs.
export interface AiAppCardConfirmationGrant {
    grant: Uint8Array;
    expiresAt: bigint;
}

export interface AiAppCardProvenance {
    provenance: Uint8Array;
    expiresAt: bigint;
}

// Privacy-safe result for minting provenance over one exact app-authored card. Failure variants
// deliberately carry no backend message, card content, app/chat coordinates, or bearer material.
// Transport and offline are added by the client/agent layers; every canister response is mapped to
// one of the remaining variants so a rejected attestation can never collapse into `undefined`.
export type AiAppCardProvenanceResult =
    | ({ kind: "success" } & AiAppCardProvenance)
    | { kind: "app_unavailable" }
    | { kind: "invalid_request" }
    | { kind: "backend_error" }
    | { kind: "malformed_success" }
    | { kind: "transport_error" }
    | { kind: "offline" };

// Exact sender-visible and confirmable V1 content vouched for by the registered app canister before
// UserIndex mints card provenance. Authenticated viewer/chat/message/app coordinates are supplied by
// UserIndex; routing, recipient keys, provenance, and private context are deliberately excluded.
export interface AiAppCardContentV1 {
    title: string;
    rows: ActionCardRow[];
    confirmLabel: string;
    cancelLabel: string;
    actionId: string;
    disclosure?: string;
    expiresAt?: bigint;
    confirmPayload?: Uint8Array;
}

export type RunAiActionResult =
    | { kind: "ready"; card: ActionCardContent; extracted: Record<string, unknown> }
    // Several valid entries extracted from one message: one card with one frozen JSON-array payload.
    | { kind: "ready_multi"; card: ActionCardContent; extracted: Record<string, unknown>[] }
    // No native runtime / no model selected — the caller must degrade gracefully (no autonomous fallback).
    | { kind: "unavailable"; reason: string }
    // The input contains image bytes, but this app action did not opt into image extraction.
    | { kind: "image_not_accepted" }
    // The model ran but produced nothing parseable as the declared structured output.
    | { kind: "no_extraction"; raw: string }
    // Structured output existed, but at least one candidate lacked an app-required field.
    | {
          kind: "incomplete_extraction";
          raw: string;
          missingFields: string[];
          candidateCount: number;
          validCandidateCount: number;
      }
    | { kind: "error"; error: string };

export const MAX_AI_ACTION_APP_OUTPUT_BYTES = 64 * 1024;
export const AI_ACTION_APP_NORMALIZATION_TIMEOUT_MS = 30_000;
/** Host-provided capability, never a callback or executable value read from an app schema. */
export interface AiActionAppNormalization {
    normalize: (candidates: Record<string, unknown>[]) => Promise<unknown>;
}

// Clone only bounded plain JSON data. Accessors, custom prototypes, symbols, sparse arrays,
// nonfinite values and dangerous property names cannot cross the app-normalization boundary.
function cloneAppOutputJson(value: unknown, depth = 0): unknown {
    if (depth > 8) throw new Error("App output depth exceeded");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "string" && value.length <= MAX_AI_ACTION_APP_OUTPUT_BYTES) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) throw new Error("Invalid array");
        const descriptors = Object.getOwnPropertyDescriptors(value as object);
        const length: unknown = descriptors.length?.value;
        if (
            typeof length !== "number" ||
            !Number.isInteger(length) ||
            length < 0 ||
            length > 256 ||
            Reflect.ownKeys(descriptors).length !== length + 1
        ) {
            throw new Error("Invalid array bounds");
        }
        return Array.from({ length }, (_, index) => {
            const item = descriptors[String(index)];
            if (item?.enumerable !== true || !Object.hasOwn(item, "value"))
                throw new Error("Invalid array item");
            return cloneAppOutputJson(item.value, depth + 1);
        });
    }
    const record = imagePromptOwnData(value);
    if (record === undefined || Object.keys(record).length > 128) throw new Error("Invalid object");
    return Object.fromEntries(
        Object.entries(record).map(([key, item]) => {
            if (["__proto__", "constructor", "prototype"].includes(key))
                throw new Error("Invalid property");
            return [key, cloneAppOutputJson(item, depth + 1)];
        }),
    );
}

export function cloneBoundedAppActionCandidates(
    value: unknown,
): Record<string, unknown>[] | undefined {
    try {
        const copied = cloneAppOutputJson(value);
        if (
            !Array.isArray(copied) ||
            copied.length === 0 ||
            copied.length > MAX_AI_ACTION_CANDIDATES ||
            copied.some(
                (item) => item === null || typeof item !== "object" || Array.isArray(item),
            ) ||
            new TextEncoder().encode(JSON.stringify(copied)).byteLength >
                MAX_AI_ACTION_APP_OUTPUT_BYTES
        )
            return undefined;
        return copied as Record<string, unknown>[];
    } catch {
        return undefined;
    }
}

/** Raw app output must be one COMPLETE object/array, optionally inside one complete JSON fence.
 * Do not use the legacy prose/truncation/wrapper recovery parser for this new contract. */
export function parseCompleteAppActionOutput(text: string): Record<string, unknown>[] | undefined {
    if (
        text.length > MAX_AI_ACTION_APP_OUTPUT_BYTES ||
        new TextEncoder().encode(text).byteLength > MAX_AI_ACTION_APP_OUTPUT_BYTES
    )
        return undefined;
    const trimmed = text.trim();
    const fence = /^```(?:json)?\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
    const json = fence?.[1] ?? trimmed;
    // The existing duplicate-key scanner covers the entire nested value in this synthetic
    // envelope. JSON.parse enforces completion; no source object is unwrapped or discarded.
    const parsed = parseBalancedJsonObject(`{"value":${json}}`);
    if (parsed.kind !== "parsed") return undefined;
    const value = parsed.value.value;
    return cloneBoundedAppActionCandidates(Array.isArray(value) ? value : [value]);
}

async function normalizeAppActionOutput(
    capability: AiActionAppNormalization,
    candidates: Record<string, unknown>[],
): Promise<
    | { kind: "candidates"; candidates: Record<string, unknown>[] }
    | { kind: "none" }
    | { kind: "error" }
> {
    let clearDeadline: (() => void) | undefined;
    try {
        const input = cloneBoundedAppActionCandidates(candidates);
        if (input === undefined) return { kind: "error" };
        const result = await Promise.race([
            Promise.resolve().then(() => capability.normalize(input)),
            new Promise<undefined>((resolve) => {
                const timer = setTimeout(
                    () => resolve(undefined),
                    AI_ACTION_APP_NORMALIZATION_TIMEOUT_MS,
                );
                clearDeadline = () => clearTimeout(timer);
            }),
        ]);
        const data = imagePromptOwnData(result);
        if (data === undefined) return { kind: "error" };
        if (
            Object.keys(data).join(",") === "kind" &&
            (data.kind === "none" || data.kind === "ambiguous")
        )
            return { kind: "none" };
        if (
            Object.keys(data).sort().join(",") !== "candidates,kind,sourceIndexes" ||
            data.kind !== "candidates"
        )
            return { kind: "error" };
        const normalized = cloneBoundedAppActionCandidates(data.candidates);
        const indexes = cloneAppOutputJson(data.sourceIndexes);
        if (
            normalized === undefined ||
            normalized.length !== candidates.length ||
            !Array.isArray(indexes) ||
            indexes.length !== candidates.length ||
            indexes.some((index, position) => index !== position)
        )
            return { kind: "error" };
        return { kind: "candidates", candidates: normalized };
    } catch {
        return { kind: "error" };
    } finally {
        clearDeadline?.();
    }
}

function formatValue(v: unknown): string {
    if (v === undefined || v === null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
    return JSON.stringify(v);
}

type BalancedJsonObjectParse =
    | { kind: "parsed"; value: Record<string, unknown> }
    | { kind: "invalid" }
    | { kind: "duplicate" };

// JSON.parse silently keeps the last duplicate property, but a model's repeated name is not
// evidence that its later value is a correction. Validate syntax natively, then inspect the original
// string before that ambiguity can reach schema/card processing. Per-object key sets also cover
// nested arrays/envelopes; decoded names make `field` and `f\u0069eld` collide. The iterative scan is
// linear in the bounded reply length and does not add a recursive parser or model-specific policy.
function parseBalancedJsonObject(text: string): BalancedJsonObjectParse {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return { kind: "invalid" };
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return { kind: "invalid" };
    }
    const scopes: Set<string>[] = [];
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (char === "{") {
            scopes.push(new Set());
        } else if (char === "}") {
            scopes.pop();
        } else if (char === '"') {
            const token = jsonStringToken(text, index);
            if (token === undefined) return { kind: "invalid" };
            // In valid JSON, a quoted token followed by ':' is necessarily a property name.
            if (text[skipJsonWhitespace(text, token.end)] === ":") {
                const keys = scopes.at(-1);
                if (keys === undefined) return { kind: "invalid" };
                if (keys.has(token.value)) return { kind: "duplicate" };
                keys.add(token.value);
            }
            index = token.end - 1;
        }
    }
    return { kind: "parsed", value: value as Record<string, unknown> };
}

function parseExtractionCandidate(text: string): BalancedJsonObjectParse {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : text;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) return { kind: "invalid" };
    return parseBalancedJsonObject(candidate.slice(start, end + 1));
}

// Tolerantly pull the first JSON object out of a model's text (it may wrap it in prose or ```json fences).
export function parseExtraction(text: string): Record<string, unknown> | undefined {
    const parsed = parseExtractionCandidate(text);
    return parsed.kind === "parsed" ? parsed.value : undefined;
}

// Tolerantly pull a LIST of candidate objects out of a model's text. The model may emit either a
// single object (one record) or a JSON ARRAY of objects (several records in one message).
// An array that opens before any bare object is treated as the multi-entry form; only its object
// elements are kept. Anything else falls back to the single-object parse (wrapped in a one-element
// list), so the single-entry path is byte-identical to `parseExtraction`. Returns undefined when
// nothing object-shaped is found.
export function parseExtractionList(text: string): Record<string, unknown>[] | undefined {
    if (text.length > MAX_AI_ACTION_MODEL_OUTPUT_CHARS) return undefined;
    // Scan the WHOLE reply. Every earlier version stopped at the first promising REGION and kept only
    // what it found there, which is how three records arrived as two:
    //
    //   - the fence match was non-greedy, so a model emitting TWO ```json blocks had only its first
    //     one read;
    //   - the array fast path returned the moment one array parsed cleanly, so an afterthought object
    //     past the "]" ("[{a},{b}] and also {c}") was never looked at.
    //
    // Both dropped entries in SILENCE — the card simply had fewer rows than the message had amounts,
    // which nobody notices unless they count. scanJsonObjects tracks BRACE depth only, so "[" and "]"
    // never move it: array elements are already found as top-level objects and the fast path bought
    // nothing this does not. Fence markers carry no braces either, so reading straight through them
    // costs nothing and recovers records stranded outside the fence.
    //
    // Degrades exactly as before on a truncated generation (the unterminated tail object is dropped,
    // the completed ones survive) and on trailing commas between elements.
    // Keep one overflow sentinel (33) so the runner can distinguish "too many" from the valid
    // 32-candidate boundary, then stop before rules/schema/card work is performed for attacker-sized
    // output. Wrapper objects are bounded too; `flatMap` here previously expanded each nested list.
    const objects = scanJsonObjects(text);
    // An ambiguous balanced object rejects the whole batch, not just that row. Do not feed it to
    // either fallback: recovery could otherwise resurrect a duplicate that was deliberately refused.
    if (objects === undefined) return undefined;
    const scanned: Record<string, unknown>[] = [];
    for (const object of objects) {
        for (const entry of unwrapEntryList(object)) {
            scanned.push(entry);
            if (scanned.length > MAX_AI_ACTION_CANDIDATES) return scanned;
        }
    }
    if (scanned.length > 0) return scanned;
    // Last resort: parseExtraction slices from the first "{" to the last "}". It cannot handle a
    // multi-object emission, but it does salvage a lone object the scanner could not balance.
    const parsed = parseExtractionCandidate(text);
    if (parsed.kind === "duplicate") return undefined;
    if (parsed.kind === "parsed") return [parsed.value];
    return scanTruncatedScalarObjectPrefixes(text);
}

// A model asked for "a JSON array of records" often returns that array under a KEY instead:
// {"records":[{…},{…},{…}]}. The scanner sees ONE top-level object (the inner ones are nested),
// so the whole message used to extract to a single candidate — which then failed the required-field
// gate, because a wrapper has no reading, and surfaced as a long wait ending in "nothing to process".
//
// Unwrapped only for the unambiguous shape: exactly one property, holding a non-empty array of
// objects. A real extraction carries more than one field, so this cannot swallow one. Something like
// {"schedule":[…]} would be unwrapped too, but a bare schedule is not a valid entry either way — the
// same required-field gate drops it before and after.
function unwrapEntryList(obj: Record<string, unknown>): Record<string, unknown>[] {
    const values = Object.values(obj);
    if (values.length !== 1 || !Array.isArray(values[0])) return [obj];
    const objs: Record<string, unknown>[] = [];
    for (const entry of values[0]) {
        if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
            objs.push(entry as Record<string, unknown>);
            if (objs.length > MAX_AI_ACTION_CANDIDATES) break;
        }
    }
    return objs.length > 0 ? objs : [obj];
}

// Collect every balanced top-level {...} substring that parses as a JSON object, in order.
// String-aware (a brace inside a quoted value must not move the depth) and escape-aware, so a annotation
// like {"annotation":"paid 50 } later"} does not derail the scan. An unterminated trailing object is simply
// dropped — which is what makes a truncated generation degrade to "the objects that DID complete"
// instead of to nothing.
function scanJsonObjects(text: string): Record<string, unknown>[] | undefined {
    const out: Record<string, unknown>[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === "\\") escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
        } else if (ch === "{") {
            if (depth === 0) start = i;
            depth++;
        } else if (ch === "}") {
            if (depth > 0) {
                depth--;
                if (depth === 0 && start >= 0) {
                    const parsed = parseBalancedJsonObject(text.slice(start, i + 1));
                    if (parsed.kind === "duplicate") return undefined;
                    if (parsed.kind === "parsed") {
                        out.push(parsed.value);
                        if (out.length > MAX_AI_ACTION_CANDIDATES) return out;
                    }
                    // A malformed object is still skipped; an ambiguous valid one fails above.
                    start = -1;
                }
            }
        }
    }
    return out;
}

type JsonStringToken = { value: string; end: number };
type JsonScalarToken = { value: string | number | boolean | null; end: number };
type TruncatedObjectParse =
    | { kind: "candidate"; value: Record<string, unknown> }
    | { kind: "skip_wrapper" }
    | { kind: "reject" };

function skipJsonWhitespace(text: string, start: number): number {
    let index = start;
    while (
        index < text.length &&
        (text[index] === " " ||
            text[index] === "\n" ||
            text[index] === "\r" ||
            text[index] === "\t")
    ) {
        index++;
    }
    return index;
}

function jsonStringToken(text: string, start: number): JsonStringToken | undefined {
    if (text[start] !== '"') return undefined;
    let escaped = false;
    for (let index = start + 1; index < text.length; index++) {
        const char = text[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === "\\") {
            escaped = true;
            continue;
        }
        if (char !== '"') continue;
        try {
            const value: unknown = JSON.parse(text.slice(start, index + 1));
            return typeof value === "string" ? { value, end: index + 1 } : undefined;
        } catch {
            return undefined;
        }
    }
    return undefined;
}

function jsonScalarToken(text: string, start: number): JsonScalarToken | undefined {
    if (text[start] === '"') return jsonStringToken(text, start);
    const rest = text.slice(start);
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest)?.[0];
    const token = number ?? ["true", "false", "null"].find((value) => rest.startsWith(value));
    if (token === undefined) return undefined;
    const end = start + token.length;
    const boundary = text[end];
    if (
        boundary !== undefined &&
        boundary !== "," &&
        boundary !== "}" &&
        boundary !== " " &&
        boundary !== "\n" &&
        boundary !== "\r" &&
        boundary !== "\t"
    ) {
        return undefined;
    }
    try {
        const value: unknown = JSON.parse(token);
        if (
            value !== null &&
            typeof value !== "string" &&
            typeof value !== "boolean" &&
            (typeof value !== "number" || !Number.isFinite(value))
        ) {
            return undefined;
        }
        return { value: value as JsonScalarToken["value"], end };
    } catch {
        return undefined;
    }
}

function isTruncatedJsonStringAtEnd(text: string, start: number): boolean {
    if (text[start] !== '"') return false;
    for (let index = start + 1; index < text.length; index++) {
        const code = text.charCodeAt(index);
        if (code <= 0x1f) return false;
        const char = text[index];
        if (char === '"') return false;
        if (char !== "\\") continue;
        index++;
        if (index >= text.length) return true;
        const escape = text[index];
        if ('"\\/bfnrt'.includes(escape)) continue;
        if (escape !== "u") return false;
        for (let digit = 0; digit < 4; digit++) {
            index++;
            if (index >= text.length) return true;
            if (!/[0-9A-Fa-f]/.test(text[index])) return false;
        }
    }
    return true;
}

function isJsonNumberPrefixAtEnd(value: string): boolean {
    let index = 0;
    if (value[index] === "-") index++;
    if (index >= value.length) return true;
    if (value[index] === "0") {
        index++;
    } else {
        if (!/[1-9]/.test(value[index])) return false;
        while (index < value.length && /\d/.test(value[index])) index++;
    }
    if (index < value.length && value[index] === ".") {
        index++;
        const fractionStart = index;
        while (index < value.length && /\d/.test(value[index])) index++;
        if (index === fractionStart && index < value.length) return false;
    }
    if (index < value.length && (value[index] === "e" || value[index] === "E")) {
        index++;
        if (value[index] === "+" || value[index] === "-") index++;
        while (index < value.length && /\d/.test(value[index])) index++;
    }
    return index === value.length;
}

function isTruncatedJsonScalarAtEnd(text: string, start: number): boolean {
    if (start >= text.length) return true;
    if (text[start] === '"') return isTruncatedJsonStringAtEnd(text, start);
    const rest = text.slice(start);
    return (
        ["true", "false", "null"].some((value) => value.startsWith(rest)) ||
        isJsonNumberPrefixAtEnd(rest)
    );
}

// Parse only a complete SCALAR-member prefix that reaches a genuine object/end-of-output boundary.
// This is deliberately narrower than JSON recovery: malformed syntax, nested objects/arrays, unsafe
// keys, and non-finite numbers reject the whole prefix. A differing or incomplete duplicate becomes
// an undefined tombstone, so an ambiguous required field fails the ordinary schema/required gate
// without discarding independent grounded fields. Identical complete scalar duplicates may coalesce.
function parseTruncatedScalarObjectAt(text: string, start: number): TruncatedObjectParse {
    let index = skipJsonWhitespace(text, start + 1);
    const out: Record<string, unknown> = {};
    let members = 0;
    while (index < text.length) {
        if (text[index] === "}") {
            return members > 0 ? { kind: "candidate", value: out } : { kind: "reject" };
        }
        const key = jsonStringToken(text, index);
        if (key === undefined) return { kind: "reject" };
        if (!isSafeAiActionFieldName(key.value)) return { kind: "reject" };
        const duplicate = Object.hasOwn(out, key.value);
        index = skipJsonWhitespace(text, key.end);
        if (text[index] !== ":") return { kind: "reject" };
        index = skipJsonWhitespace(text, index + 1);
        if (text[index] === "[" || text[index] === "{") {
            // The only nested shape this fallback traverses is the outer one-property array envelope
            // (`{"records":[{...`). Candidate members themselves remain scalar-only.
            return members === 0 && text[index] === "["
                ? { kind: "skip_wrapper" }
                : { kind: "reject" };
        }
        const scalar = jsonScalarToken(text, index);
        if (scalar === undefined) {
            if (!duplicate || !isTruncatedJsonScalarAtEnd(text, index)) {
                return { kind: "reject" };
            }
            if (members >= MAX_AI_ACTION_CARD_ROWS) return { kind: "reject" };
            out[key.value] = undefined;
            return { kind: "candidate", value: out };
        }
        if (members >= MAX_AI_ACTION_CARD_ROWS) return { kind: "reject" };
        if (!duplicate) {
            out[key.value] = scalar.value;
        } else if (!Object.is(out[key.value], scalar.value)) {
            out[key.value] = undefined;
        }
        members++;
        index = skipJsonWhitespace(text, scalar.end);
        if (index >= text.length) {
            // A number cut at EOF has no lexical boundary: `12` could be a truncated `12900`.
            // A repeated field is tombstoned; a first occurrence makes the candidate unsafe.
            if (typeof scalar.value === "number" && scalar.end === text.length) {
                if (!duplicate) return { kind: "reject" };
                out[key.value] = undefined;
            }
            return { kind: "candidate", value: out };
        }
        if (text[index] === "}") {
            return { kind: "candidate", value: out };
        }
        if (text[index] !== ",") return { kind: "reject" };
        index = skipJsonWhitespace(text, index + 1);
    }
    return members > 0 ? { kind: "candidate", value: out } : { kind: "reject" };
}

// The normal balanced parser above remains authoritative. This fallback runs only when the entire
// bounded model reply contains no parseable object. It considers top-level objects and direct object
// elements of a one-level array envelope; deeper nested structures are never promoted to candidates.
function scanTruncatedScalarObjectPrefixes(text: string): Record<string, unknown>[] | undefined {
    const starts: number[] = [];
    const activeStarts = new Map<number, number>();
    const balancedEnds = new Map<number, number>();
    let objectDepth = 0;
    let arrayDepth = 0;
    let inString = false;
    let escaped = false;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') {
            inString = true;
        } else if (char === "{") {
            if (objectDepth === 0 || (objectDepth === 1 && arrayDepth > 0)) {
                starts.push(index);
                activeStarts.set(objectDepth, index);
                // One outer wrapper plus the ordinary 33rd overflow sentinel is sufficient. More
                // candidate starts are malformed/attacker-sized and fail closed without quadratic work.
                if (starts.length > MAX_AI_ACTION_CANDIDATES + 2) return undefined;
            }
            objectDepth++;
        } else if (char === "}") {
            if (objectDepth > 0) {
                objectDepth--;
                const start = activeStarts.get(objectDepth);
                if (start !== undefined) {
                    balancedEnds.set(start, index + 1);
                    activeStarts.delete(objectDepth);
                }
            }
        } else if (char === "[") {
            arrayDepth++;
        } else if (char === "]") {
            if (arrayDepth > 0) arrayDepth--;
        }
    }

    const candidates: Record<string, unknown>[] = [];
    for (const start of starts) {
        // A truncated envelope may contain a fully balanced child. It must pass the same duplicate
        // check as a bare object, not regain acceptance through scalar-prefix recovery. Only candidate
        // boundaries are retained within the existing start limit, without rescanning for braces.
        const end = balancedEnds.get(start);
        if (
            end !== undefined &&
            parseBalancedJsonObject(text.slice(start, end)).kind === "duplicate"
        ) {
            return undefined;
        }
        const parsed = parseTruncatedScalarObjectAt(text, start);
        if (parsed.kind === "reject") return undefined;
        if (parsed.kind === "skip_wrapper") continue;
        candidates.push(parsed.value);
        if (candidates.length > MAX_AI_ACTION_CANDIDATES) return candidates;
    }
    return candidates.length > 0 ? candidates : undefined;
}

// --- Rules ---------------------------------------------------------------------------------------------------

function isBoundedRuleString(value: string): boolean {
    return (
        value.length > 0 &&
        value.length <= MAX_AI_ACTION_RULE_STRING_LENGTH &&
        !DISPLAY_CONTROL.test(value)
    );
}

// Sanitize even domain-typed rules: values may originate in legacy/cached registry entries or a
// programmatic caller that bypassed the wire mapper. The aggregate keyword budget bounds both prompt
// construction and deterministic message scans across all rules.
function boundedRules(rules: readonly AiActionRule[]): AiActionRule[] {
    const bounded: AiActionRule[] = [];
    let remainingKeywords = MAX_AI_ACTION_KEYWORD_CHECKS;
    for (const rule of rules.slice(0, MAX_AI_ACTION_RULES)) {
        switch (rule.kind) {
            case "instruction":
                if (rule.text.length <= MAX_AI_ACTION_INSTRUCTION_LENGTH) bounded.push(rule);
                break;
            case "context":
                bounded.push({
                    kind: "context",
                    provide: rule.provide.filter((p) => p === "today"),
                });
                break;
            case "from_message":
                if (isSafeAiActionFieldName(rule.field)) {
                    const maxLength =
                        rule.maxLength === undefined || !Number.isFinite(rule.maxLength)
                            ? undefined
                            : Math.min(
                                  MAX_AI_ACTION_FROM_MESSAGE_LENGTH,
                                  Math.max(0, Math.trunc(rule.maxLength)),
                              );
                    bounded.push({ kind: "from_message", field: rule.field, maxLength });
                }
                break;
            case "normalize":
                if (isSafeAiActionFieldName(rule.field)) {
                    bounded.push({
                        kind: "normalize",
                        field: rule.field,
                        ops: rule.ops
                            .filter((op) => NORMALIZE_OPS.includes(op))
                            .slice(0, NORMALIZE_OPS.length),
                    });
                }
                break;
            case "keyword_map": {
                if (!isSafeAiActionFieldName(rule.field) || remainingKeywords === 0) break;
                const map: { value: string; keywords: string[] }[] = [];
                for (const mapping of rule.map.slice(0, MAX_AI_ACTION_KEYWORD_MAPPINGS)) {
                    if (!isBoundedRuleString(mapping.value) || remainingKeywords === 0) continue;
                    const keywords: string[] = [];
                    for (const keyword of mapping.keywords.slice(
                        0,
                        MAX_AI_ACTION_KEYWORDS_PER_MAPPING,
                    )) {
                        if (remainingKeywords === 0) break;
                        if (!isBoundedRuleString(keyword)) continue;
                        keywords.push(keyword);
                        remainingKeywords--;
                    }
                    if (keywords.length > 0) map.push({ value: mapping.value, keywords });
                }
                if (map.length > 0) {
                    bounded.push({ kind: "keyword_map", field: rule.field, mode: rule.mode, map });
                }
                break;
            }
        }
    }
    return bounded;
}

// Compile the declared rules into prompt guidance lines. Only rules that need the model's cooperation
// produce a line — normalize is deterministic (post-pass only), while context/today is conditionally
// supplied by runAiAction when the invocation also carries nonempty text evidence. `from_message`
// guidance is likewise meaningful only when message text exists; image-only extraction has no source
// text for its deterministic post-pass to copy.
export function compileRules(
    rules: AiActionRule[],
    options: { hasMessageText?: boolean } = {},
): string[] {
    const lines: string[] = [];
    const hasMessageText = options.hasMessageText ?? true;
    for (const rule of boundedRules(rules)) {
        switch (rule.kind) {
            case "instruction":
                lines.push(rule.text);
                break;
            case "keyword_map":
                for (const m of rule.map) {
                    lines.push(
                        `Set "${rule.field}" to "${m.value}" when the message mentions any of: ${m.keywords.join(", ")}`,
                    );
                }
                break;
            case "from_message":
                if (hasMessageText) {
                    lines.push(`Set "${rule.field}" to a short phrase taken from the message.`);
                }
                break;
            case "normalize":
            case "context":
                break;
        }
    }
    return lines;
}

// "26k" / "1.5m" (optional commas/spaces) -> number; plain numeric strings -> number; real numbers
// untouched. The number is matched at the START of the string, tolerating trailing text a model may
// append — most importantly a unit suffix folded into the reading: "2000 lux" / "2000lux" -> 2000.
// Without this, such a value stays a string and the schema-conformance pass DROPS it (a `number` field
// can't hold a string), so the consumer receives no reading at all. Anchored at `^` so a number is never
// plucked from the middle of a word.
function normalizeKMSuffix(v: unknown): unknown {
    if (typeof v !== "string") return v;
    const compact = v.trim().replace(/[,\s]/g, "");
    const m = compact.match(/^([+-]?\d+(?:\.\d+)?)([kKmM])?/);
    if (m === null) return v;
    const n = parseFloat(m[1]);
    if (Number.isNaN(n)) return v;
    const suffix = m[2]?.toLowerCase();
    if (suffix === "k") return n * 1e3;
    if (suffix === "m") return n * 1e6;
    return n;
}

// Strip Unicode currency symbols / commas / spaces from a string, then parse as a number when what remains is numeric.
function normalizeStripSymbols(v: unknown): unknown {
    if (typeof v !== "string") return v;
    const stripped = v.replace(/[\p{Sc},\s]/gu, "");
    return /^[+-]?\d+(?:\.\d+)?$/.test(stripped) ? parseFloat(stripped) : stripped;
}

function applyNormalizeOp(op: AiActionNormalizeOp, v: unknown): unknown {
    switch (op) {
        case "k_m_suffix":
            return normalizeKMSuffix(v);
        case "strip_symbols":
            return normalizeStripSymbols(v);
        case "uppercase":
            return typeof v === "string" ? v.toUpperCase() : v;
        case "lowercase":
            return typeof v === "string" ? v.toLowerCase() : v;
        case "trim":
            return typeof v === "string" ? v.trim() : v;
    }
}

function isStrictCalendarDate(value: string): boolean {
    if (value.length !== 10 || value[4] !== "-" || value[7] !== "-") return false;
    for (let index = 0; index < value.length; index++) {
        if (index === 4 || index === 7) continue;
        const code = value.charCodeAt(index);
        if (code < 48 || code > 57) return false;
    }
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= daysInMonth[month - 1];
}

function conformsToSafeStringFormat(format: unknown, value: string): boolean {
    switch (format) {
        case "date":
            return isStrictCalendarDate(value);
        case "ascii-uppercase":
            return [...value].every((character) => {
                const code = character.charCodeAt(0);
                return code >= 65 && code <= 90;
            });
        case "no-nul":
            return !value.includes(String.fromCharCode(0));
        case "utf8-no-nul": {
            // JavaScript strings may contain lone UTF-16 surrogates, but Rust/serde strings and
            // Candid text are Unicode scalar values. Reject them here so exact-card provenance
            // cannot be minted for bytes the app boundary is structurally unable to decode.
            for (let index = 0; index < value.length; index++) {
                const code = value.charCodeAt(index);
                if (code === 0) return false;
                if (code >= 0xd800 && code <= 0xdbff) {
                    if (index + 1 >= value.length) return false;
                    const next = value.charCodeAt(index + 1);
                    if (next < 0xdc00 || next > 0xdfff) return false;
                    index++;
                } else if (code >= 0xdc00 && code <= 0xdfff) {
                    return false;
                }
            }
            return true;
        }
        default:
            // JSON Schema permits implementation-defined formats. Unknown formats remain annotations.
            return true;
    }
}

const INVALID_SCHEMA_VALUE = Symbol("invalid-schema-value");

type SafePropertySchema = {
    type?: unknown;
    enum?: unknown;
    pattern?: unknown;
    minimum?: unknown;
    exclusiveMinimum?: unknown;
    maximum?: unknown;
    minLength?: unknown;
    maxLength?: unknown;
    format?: unknown;
    default?: unknown;
    "x-openchat-default-for-image-only"?: unknown;
    "x-openchat-require-explicit-for-image-only"?: unknown;
    "x-openchat-property-aliases"?: unknown;
    "x-openchat-enum-aliases"?: unknown;
};

const MAX_AI_ACTION_PROPERTY_ALIASES = 8;
const MAX_AI_ACTION_ENUM_ALIAS_TARGETS = 8;
const MAX_AI_ACTION_ENUM_ALIASES_PER_TARGET = 8;
const MAX_AI_ACTION_ENUM_ALIASES_TOTAL = 32;
const MAX_AI_ACTION_ENUM_ALIAS_BYTES = 64;

// A property may declare a few alternate keys that small structured-output models commonly emit.
// The alias names are data from an untrusted app manifest, so declarations must be bounded, unique,
// safe, undeclared schema fields and owned by exactly one target. Resolution happens before rules and
// schema cleanup. Identical duplicate values coalesce; any value conflict leaves an explicit
// undefined tombstone so conformance drops the target without applying its schema default.
function applySchemaPropertyAliases(
    extracted: Record<string, unknown>,
    schema: object | undefined,
): Record<string, unknown> {
    if (!isRecord(schema) || !isRecord(schema.properties)) return extracted;
    const properties = schema.properties;
    const declaredFields = new Set(Object.keys(properties));
    const declarations: { target: string; aliases: string[] }[] = [];
    const claimCounts = new Map<string, number>();

    for (const [target, rawProperty] of Object.entries(properties)) {
        if (!isSafeAiActionFieldName(target) || !isRecord(rawProperty)) continue;
        const rawAliases = rawProperty["x-openchat-property-aliases"];
        if (rawAliases === undefined) continue;
        if (
            !Array.isArray(rawAliases) ||
            rawAliases.length === 0 ||
            rawAliases.length > MAX_AI_ACTION_PROPERTY_ALIASES
        ) {
            continue;
        }
        const aliases: string[] = [];
        const seen = new Set<string>();
        let valid = true;
        for (const alias of rawAliases) {
            if (
                typeof alias !== "string" ||
                !isSafeAiActionFieldName(alias) ||
                alias === target ||
                declaredFields.has(alias) ||
                seen.has(alias)
            ) {
                valid = false;
                break;
            }
            seen.add(alias);
            aliases.push(alias);
        }
        if (!valid) continue;
        declarations.push({ target, aliases });
        for (const alias of aliases) {
            claimCounts.set(alias, (claimCounts.get(alias) ?? 0) + 1);
        }
    }

    let out = extracted;
    for (const declaration of declarations) {
        if (declaration.aliases.some((alias) => claimCounts.get(alias) !== 1)) continue;
        const values: unknown[] = [];
        if (Object.hasOwn(out, declaration.target)) values.push(out[declaration.target]);
        for (const alias of declaration.aliases) {
            if (Object.hasOwn(out, alias)) values.push(out[alias]);
        }
        if (values.length === 0) continue;
        if (out === extracted) out = { ...extracted };
        if (values.every((value) => Object.is(value, values[0]))) {
            out[declaration.target] = values[0];
        } else {
            out[declaration.target] = undefined;
        }
    }
    return out;
}

function normalizedEnumAlias(value: string): string | undefined {
    const trimmed = value.trim();
    if (
        trimmed.length === 0 ||
        new TextEncoder().encode(trimmed).byteLength > MAX_AI_ACTION_ENUM_ALIAS_BYTES ||
        containsUnsafePromptCodePoint(trimmed)
    ) {
        return undefined;
    }
    return trimmed.toLowerCase();
}

// Some small structured-output models put a short semantic label (for example "measurement") in an
// enum field even when instructed to emit the app's canonical token. An app may declare a tiny
// whole-field alias table under that property's schema. Only the target value is examined: notes,
// messages, sibling fields, and substrings never participate. The entire field fails closed if the
// untrusted declaration is malformed, oversized, or has any normalized ownership collision.
function conformEnumAliasValue(value: unknown, p: SafePropertySchema): unknown {
    const raw = p["x-openchat-enum-aliases"];
    if (raw === undefined) return value;
    if (
        p.type !== "string" ||
        typeof value !== "string" ||
        !isRecord(raw) ||
        !Array.isArray(p.enum) ||
        p.enum.length === 0 ||
        p.enum.length > MAX_AI_ACTION_ENUM_ALIAS_TARGETS ||
        !p.enum.every((entry) => typeof entry === "string")
    ) {
        return INVALID_SCHEMA_VALUE;
    }

    const canonicalValues = p.enum as string[];
    const canonicalOwners = new Map<string, string>();
    for (const canonical of canonicalValues) {
        const normalized = normalizedEnumAlias(canonical);
        if (normalized === undefined || canonicalOwners.has(normalized)) {
            return INVALID_SCHEMA_VALUE;
        }
        canonicalOwners.set(normalized, canonical);
    }

    const declarations = Object.entries(raw);
    if (declarations.length === 0 || declarations.length > MAX_AI_ACTION_ENUM_ALIAS_TARGETS) {
        return INVALID_SCHEMA_VALUE;
    }
    const aliasOwners = new Map<string, string>();
    let aliasCount = 0;
    for (const [canonical, aliases] of declarations) {
        if (
            normalizedEnumAlias(canonical) === undefined ||
            !canonicalValues.includes(canonical) ||
            !Array.isArray(aliases) ||
            aliases.length === 0 ||
            aliases.length > MAX_AI_ACTION_ENUM_ALIASES_PER_TARGET
        ) {
            return INVALID_SCHEMA_VALUE;
        }
        aliasCount += aliases.length;
        if (aliasCount > MAX_AI_ACTION_ENUM_ALIASES_TOTAL) return INVALID_SCHEMA_VALUE;
        for (const alias of aliases) {
            if (typeof alias !== "string") return INVALID_SCHEMA_VALUE;
            const normalized = normalizedEnumAlias(alias);
            if (
                normalized === undefined ||
                canonicalOwners.has(normalized) ||
                aliasOwners.has(normalized)
            ) {
                return INVALID_SCHEMA_VALUE;
            }
            aliasOwners.set(normalized, canonical);
        }
    }

    // Exact canonical values remain byte-for-byte unchanged. Aliases use bounded trim/case folding
    // only for lookup and return the app-declared canonical enum value.
    if (canonicalValues.includes(value)) return value;
    const normalizedValue = normalizedEnumAlias(value);
    if (normalizedValue === undefined) return INVALID_SCHEMA_VALUE;
    return aliasOwners.get(normalizedValue) ?? INVALID_SCHEMA_VALUE;
}

function conformPropertyValue(value: unknown, p: SafePropertySchema): unknown {
    const conformed = conformEnumAliasValue(value, p);
    if (conformed === INVALID_SCHEMA_VALUE) return INVALID_SCHEMA_VALUE;
    if (p.type === "number" && typeof conformed !== "number") return INVALID_SCHEMA_VALUE;
    if (p.type === "string" && typeof conformed !== "string") return INVALID_SCHEMA_VALUE;
    if (Array.isArray(p.enum) && !p.enum.some((entry) => entry === conformed)) {
        return INVALID_SCHEMA_VALUE;
    }
    // Numeric lower bounds constrain number values only, exactly like JSON schema. A model can
    // emit a degenerate value that IS the declared type (e.g. reading 0 against exclusiveMinimum
    // 0, live-reproduced from the message "hi") — deleting it here lets the required-fields
    // check refuse the whole extraction instead of posting an unusable card.
    if (typeof p.minimum === "number" && typeof conformed === "number" && conformed < p.minimum) {
        return INVALID_SCHEMA_VALUE;
    }
    if (
        typeof p.exclusiveMinimum === "number" &&
        typeof conformed === "number" &&
        conformed <= p.exclusiveMinimum
    ) {
        return INVALID_SCHEMA_VALUE;
    }
    if (typeof p.maximum === "number" && typeof conformed === "number" && conformed > p.maximum) {
        return INVALID_SCHEMA_VALUE;
    }
    if (typeof conformed === "string") {
        const length = [...conformed].length;
        if (
            typeof p.minLength === "number" &&
            Number.isSafeInteger(p.minLength) &&
            p.minLength >= 0 &&
            length < p.minLength
        ) {
            return INVALID_SCHEMA_VALUE;
        }
        if (
            typeof p.maxLength === "number" &&
            Number.isSafeInteger(p.maxLength) &&
            p.maxLength >= 0 &&
            length > p.maxLength
        ) {
            return INVALID_SCHEMA_VALUE;
        }
        if (!conformsToSafeStringFormat(p.format, conformed)) return INVALID_SCHEMA_VALUE;
    }
    // Manifest patterns are untrusted and JavaScript's backtracking RegExp engine has no timeout.
    // Fail closed for any patterned field rather than execute a potential ReDoS expression such
    // as `(a+)+$`. A future implementation may re-enable patterns through a bounded RE2 engine.
    if (typeof p.pattern === "string") return INVALID_SCHEMA_VALUE;
    return conformed;
}

// Tiny local schema conformance pass (type/enum/numeric bounds, bounded string lengths, standard
// format: "date", deterministic allowlisted string formats,
// and validated scalar defaults only — deliberately not a full JSON-schema validator and no added
// dependency). utf8-no-nul additionally keeps exact payloads representable at Rust/Candid app
// boundaries. Drops keys the schema doesn't declare and DELETES fields that violate their declared
// constraint: visible omission beats silent wrongness.
function conformToSchema(
    extracted: Record<string, unknown>,
    schema: object | undefined,
    source: { hasImage?: boolean } = {},
): Record<string, unknown> {
    if (schema === undefined) return extracted;
    const props: unknown = (schema as { properties?: unknown }).properties;
    if (props === null || typeof props !== "object" || Array.isArray(props)) return extracted;
    const properties = props as Record<string, unknown>;
    const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const [key, value] of Object.entries(extracted)) {
        if (!isSafeAiActionFieldName(key) || !Object.hasOwn(properties, key)) continue;
        const propSchema: unknown = properties[key];
        // Drop keys the schema doesn't declare.
        if (propSchema === undefined) continue;
        if (propSchema === null || typeof propSchema !== "object") {
            out[key] = value;
            continue;
        }
        const conformed = conformPropertyValue(value, propSchema as SafePropertySchema);
        if (conformed !== INVALID_SCHEMA_VALUE) out[key] = conformed;
    }
    for (const [key, propSchema] of Object.entries(properties)) {
        if (
            !isSafeAiActionFieldName(key) ||
            propSchema === null ||
            typeof propSchema !== "object" ||
            Array.isArray(propSchema)
        ) {
            continue;
        }
        const p = propSchema as SafePropertySchema;
        // Some required image fields represent semantics that the app does not want a generic
        // schema default to invent. The exact boolean annotation suppresses every default only for
        // an image-bearing invocation. Text keeps the ordinary default unchanged.
        if (source.hasImage === true && p["x-openchat-require-explicit-for-image-only"] === true) {
            continue;
        }
        // An app may choose a different editable fallback for an image-bearing invocation. This is
        // deliberately a property annotation rather than hard-coded record logic: apps own
        // their fields and semantics. It is considered after aliases, rules, and conformance: a
        // valid explicit/rule value remains in `out`, while a rejected model enum may use the app's
        // editable image fallback. An explicit `undefined` tombstone (including an alias conflict)
        // still fails closed instead of being hidden by the fallback. Ordinary schema defaults keep
        // their absent-only behavior for both text and image input.
        const imageDefault = "x-openchat-default-for-image-only";
        const useImageDefault = source.hasImage === true && Object.hasOwn(p, imageDefault);
        if (useImageDefault) {
            if (
                Object.hasOwn(out, key) ||
                (Object.hasOwn(extracted, key) && extracted[key] === undefined)
            ) {
                continue;
            }
        } else if (Object.hasOwn(extracted, key)) {
            continue;
        }
        if (!useImageDefault && !Object.hasOwn(p, "default")) continue;
        const declaredDefault = useImageDefault ? p[imageDefault] : p.default;
        const scalarDefault =
            (p.type === "string" && typeof declaredDefault === "string") ||
            (p.type === "number" &&
                typeof declaredDefault === "number" &&
                Number.isFinite(declaredDefault));
        if (!scalarDefault) continue;
        const conformed = conformPropertyValue(declaredDefault, p);
        if (conformed !== INVALID_SCHEMA_VALUE) out[key] = conformed;
    }
    return out;
}

function isWholeKeywordAt(text: string, index: number, length: number): boolean {
    let before = "";
    if (index > 0) {
        let beforeStart = index - 1;
        const last = text.charCodeAt(beforeStart);
        if (
            last >= 0xdc00 &&
            last <= 0xdfff &&
            beforeStart > 0 &&
            text.charCodeAt(beforeStart - 1) >= 0xd800 &&
            text.charCodeAt(beforeStart - 1) <= 0xdbff
        ) {
            beforeStart--;
        }
        before = text.slice(beforeStart, index);
    }
    const afterIndex = index + length;
    const after =
        afterIndex >= text.length ? "" : String.fromCodePoint(text.codePointAt(afterIndex) ?? 0);
    return !AI_ACTION_WORD_CHAR.test(before) && !AI_ACTION_WORD_CHAR.test(after);
}

// Does the message mention this keyword as a WHOLE WORD? Case-insensitive.
//
// Raw `text.includes(keyword)` fired INSIDE other words, which made short keywords unusable. An app
// declaring "art" could otherwise match "cartography" even though the auto-propose chip uses word
// boundaries. A keyword_map override cannot be argued with by the model or the user, so a stray
// substring hit silently mislabels the entry.
//
// \b is not usable: keywords may legitimately begin or end with punctuation or spaces (multi-word
// phrases), so assert a non-alphanumeric character — or the string edge — on each side. \p{L}/\p{N}
// keep this correct for non-ASCII messages.
//
// The auto-propose chip has its own copy of this rule in app/src/utils/keywordMatch.ts (it cannot
// import openchat-shared without dragging in the client graph). The two MUST agree: a chip that
// appears on a message this pass then refuses to classify is the confusing half-state.
export function matchesKeyword(text: string, keyword: string): boolean {
    if (!isBoundedRuleString(keyword)) return false;
    const haystack = text.slice(0, MAX_AI_ACTION_MESSAGE_SCAN_CHARS).toLowerCase();
    const needle = keyword.toLowerCase();
    let from = 0;
    while (from <= haystack.length - needle.length) {
        const index = haystack.indexOf(needle, from);
        if (index < 0) return false;
        if (isWholeKeywordAt(haystack, index, needle.length)) return true;
        from = index + Math.max(needle.length, 1);
    }
    return false;
}

// Deterministic post-pass over the model's extraction, applied in a fixed order:
//   1. from_message rules fill their field from the message text itself (trimmed, truncated).
//   2. keyword_map rules with mode "override" scan only authoritative source/caption text
//      (case-insensitive WHOLE-WORD match per keyword); the first mapping with any match wins. Model
//      output is never promoted into source evidence. Mode "hint" is prompt-guidance only.
//   3. normalize ops run in order on the field when it is present.
//   4. schema conformance (type/enum/numeric bounds/safe string lengths/bounded string formats)
//      deletes violating fields and drops undeclared keys. An exact app-declared image-only scalar
//      default may then fill a missing/rejected field, except an explicit conflict tombstone.
//      Untrusted regex patterns fail closed and are never executed.
export function applyRulesPostPass(
    rules: AiActionRule[],
    extracted: Record<string, unknown>,
    messageText: string | undefined,
    responseSchema?: object,
    source: { hasImage?: boolean; rulesAlreadyResolved?: boolean } = {},
): Record<string, unknown> {
    const safeRules = boundedRules(rules);
    let out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const [key, value] of Object.entries(extracted)) {
        if (isSafeAiActionFieldName(key)) out[key] = value;
    }
    out = applySchemaPropertyAliases(out, responseSchema);

    if (messageText !== undefined && source.rulesAlreadyResolved !== true) {
        for (const rule of safeRules) {
            if (rule.kind === "from_message") {
                out[rule.field] = messageText
                    .slice(0, MAX_AI_ACTION_MESSAGE_SCAN_CHARS)
                    .trim()
                    .slice(0, rule.maxLength ?? 200);
            }
        }
    }

    for (const rule of safeRules) {
        if (
            source.rulesAlreadyResolved !== true &&
            rule.kind === "keyword_map" &&
            rule.mode === "override"
        ) {
            // Supplied source/caption text is authoritative even when no keyword matches it. Model-
            // authored target, message, annotation, or other fields are output claims, not image evidence.
            const evidence = messageText?.slice(0, MAX_AI_ACTION_MESSAGE_SCAN_CHARS);
            if (evidence === undefined) continue;
            const hit = rule.map.find((m) => m.keywords.some((k) => matchesKeyword(evidence, k)));
            if (hit !== undefined) {
                out[rule.field] = hit.value;
            }
        }
    }

    for (const rule of safeRules) {
        if (rule.kind === "normalize" && Object.hasOwn(out, rule.field)) {
            let v = out[rule.field];
            for (const op of rule.ops) {
                v = applyNormalizeOp(op, v);
            }
            out[rule.field] = v;
        }
    }

    out = conformToSchema(out, responseSchema, { hasImage: source.hasImage === true });
    return out;
}

// The schema's `required` field names absent (or undefined) in the extraction — checked AFTER the
// conformance pass, so a field conformance deleted counts as missing. Generic JSON-schema mechanics
// only: no schema, or no (array) `required`, means nothing is required. Callers gate on a non-empty
// result to refuse a degenerate extraction instead of posting a card the consumer must reject.
export function missingRequired(
    extraction: Record<string, unknown>,
    schema: object | undefined,
): string[] {
    if (schema === undefined) return [];
    const required: unknown = (schema as { required?: unknown }).required;
    if (!Array.isArray(required)) return [];
    return required.filter(
        (name): name is string =>
            typeof name === "string" &&
            (!isSafeAiActionFieldName(name) ||
                !Object.hasOwn(extraction, name) ||
                extraction[name] === undefined),
    );
}

// A property schema may explicitly opt out of image-only extraction by setting
// `x-openchat-omit-for-image-only` to the boolean `true`. This is deliberately generic: an app can
// use it for any OPTIONAL field whose value cannot be trusted unless the user also supplied source
// text. Unknown formats remain ordinary schema annotations, and malformed/non-boolean extension
// values do nothing. Build a fresh object so neither the conformed candidate nor the registered
// schema is mutated while processing one or many candidates.
function omitImageOnlySchemaProperties(
    extraction: Record<string, unknown>,
    schema: object | undefined,
): Record<string, unknown> {
    if (schema === undefined) return extraction;
    const props: unknown = (schema as { properties?: unknown }).properties;
    if (props === null || typeof props !== "object" || Array.isArray(props)) return extraction;
    const properties = props as Record<string, unknown>;
    const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;

    for (const [field, value] of Object.entries(extraction)) {
        const propertySchema = Object.hasOwn(properties, field) ? properties[field] : undefined;
        const omitted =
            propertySchema !== null &&
            typeof propertySchema === "object" &&
            !Array.isArray(propertySchema) &&
            Object.hasOwn(propertySchema, "x-openchat-omit-for-image-only") &&
            (propertySchema as Record<string, unknown>)["x-openchat-omit-for-image-only"] === true;
        if (!omitted) out[field] = value;
    }
    return out;
}

// A registering app may require a model-produced STRING field to be evidenced by authoritative
// source text by setting `x-openchat-require-text-evidence: true` on that property. The normalized
// claim itself is accepted as a whole token. A same-field keyword_map may declare aliases (including
// symbols such as "$" that legitimately touch an reading); punctuation-bearing aliases use a bounded
// literal match while word aliases keep the standard Unicode whole-token semantics. With no source
// text (image-only/manual image) this policy is deliberately inactive.
function textEvidenceMatches(text: string, token: string): boolean {
    if (!isBoundedRuleString(token)) return false;
    const boundedText = text.slice(0, MAX_AI_ACTION_MESSAGE_SCAN_CHARS);
    if (/[^\p{L}\p{N}\s]/u.test(token)) {
        return boundedText.toLowerCase().includes(token.toLowerCase());
    }
    return matchesKeyword(boundedText, token);
}

// If the app persists authoritative source text through a bounded from_message field, validate an
// opted-in claim against only the prefix that can actually reach the app's attester. Otherwise a
// token after that persisted boundary could pass here but disappear from the exact stored payload.
// The shortest declared prefix is the conservative generic choice when an app declares more than
// one evidence field; with no from_message rule this remains a client-side correctness policy over
// the normal bounded source view.
function persistedTextEvidence(
    rules: readonly AiActionRule[],
    schema: object | undefined,
    messageText: string,
): string {
    const fromMessageRules = boundedRules(rules).filter(
        (rule): rule is Extract<AiActionRule, { kind: "from_message" }> =>
            rule.kind === "from_message",
    );
    const bounded = messageText.slice(0, MAX_AI_ACTION_MESSAGE_SCAN_CHARS).trim();
    if (fromMessageRules.length === 0) return bounded;
    const surviving = fromMessageRules
        .map((rule) => bounded.slice(0, rule.maxLength ?? 200))
        .filter((value, index) => {
            const field = fromMessageRules[index].field;
            return typeof conformToSchema({ [field]: value }, schema)[field] === "string";
        });
    if (surviving.length === 0) return "";
    return surviving.reduce((shortest, value) =>
        [...value].length < [...shortest].length ? value : shortest,
    );
}

function omitUnevidencedTextSchemaProperties(
    extraction: Record<string, unknown>,
    schema: object | undefined,
    rules: readonly AiActionRule[],
    messageText: string,
): Record<string, unknown> {
    if (schema === undefined) return extraction;
    const props: unknown = (schema as { properties?: unknown }).properties;
    if (props === null || typeof props !== "object" || Array.isArray(props)) return extraction;
    const properties = props as Record<string, unknown>;
    const safeRules = boundedRules(rules);
    const evidence = persistedTextEvidence(safeRules, schema, messageText);
    const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;

    for (const [field, value] of Object.entries(extraction)) {
        const rawProperty = Object.hasOwn(properties, field) ? properties[field] : undefined;
        const property =
            rawProperty !== null && typeof rawProperty === "object" && !Array.isArray(rawProperty)
                ? (rawProperty as Record<string, unknown>)
                : undefined;
        const requiresEvidence = property?.["x-openchat-require-text-evidence"] === true;
        if (!requiresEvidence) {
            out[field] = value;
            continue;
        }
        if (typeof value !== "string") continue;
        const aliases = safeRules
            .filter(
                (rule): rule is Extract<AiActionRule, { kind: "keyword_map" }> =>
                    rule.kind === "keyword_map" && rule.field === field,
            )
            .flatMap((rule) =>
                rule.map
                    .filter((mapping) => mapping.value === value)
                    .flatMap((mapping) => mapping.keywords),
            );
        if (
            textEvidenceMatches(evidence, value) ||
            aliases.some((alias) => textEvidenceMatches(evidence, alias))
        ) {
            out[field] = value;
        }
    }
    return out;
}

// Source evidence is kept explicit at the candidate-policy boundary. `hasImage` distinguishes an
// image-origin extraction from a text extraction that simply has no message string (for example a
// manual/debug candidate), while nonempty `text` remains authoritative for message-driven rules in
// a mixed invocation. Keeping all schema-owned source policy in this seam lets model and manual
// candidates share the same ordering: rules -> conformance -> source-specific omission -> required
// gate in the caller.
export interface AiActionCandidateSource {
    hasImage?: boolean;
    text?: string;
    // App extraction may already resolve message rules per candidate. Preserve those independent
    // values while still applying normalization, schema validation, and image-only omissions.
    rulesAlreadyResolved?: boolean;
}

export function postProcessAiActionCandidate(
    def: AiActionDefinition,
    candidate: Record<string, unknown>,
    source: AiActionCandidateSource = {},
): Record<string, unknown> {
    const hasText = source.text !== undefined && source.text.trim().length > 0;
    let processed = applyRulesPostPass(
        def.rules ?? [],
        candidate,
        hasText ? source.text : undefined,
        def.responseSchema,
        {
            hasImage: source.hasImage === true,
            rulesAlreadyResolved: source.rulesAlreadyResolved === true,
        },
    );
    if (hasText) {
        processed = omitUnevidencedTextSchemaProperties(
            processed,
            def.responseSchema,
            def.rules ?? [],
            source.text!,
        );
    }
    if (source.hasImage === true && !hasText) {
        processed = omitImageOnlySchemaProperties(processed, def.responseSchema);
    }
    return processed;
}

// Pure: turn a registered action + a structured extraction + the recipient key into a postable ActionCard.
// `rows` come from the template (only non-empty values are shown); `confirmPayload` is the verbatim JSON of the
// extraction — opaque to OpenChat, exactly what the consumer's client parses after decrypting it from the inbox.
export function buildActionCardContent(
    def: AiActionDefinition,
    extracted: Record<string, unknown>,
    recipientPublicKeyPem: string,
    inboxCanisterId?: string,
    // Fan-out: additional recipient keys (other chat members' registered app keys). Confirm
    // encrypts the deposit separately to the primary key AND each of these (deduped server-side).
    additionalRecipientKeys?: string[],
    // The id of the app that owns this action, baked onto the card so a recipient binds card-surface
    // resolution to the exact producing app (not the non-namespaced actionId). See ActionCardContent.
    appId?: number,
    appRevision?: bigint,
): ActionCardContent {
    const templateRows = normalizedCardRows(def.card.rows) ?? [];
    const rows: ActionCardRow[] = templateRows
        .map((r) => ({ label: r.label, value: formatValue(extracted[r.valueKey]) }))
        .filter((r) => r.value.length > 0);

    return {
        kind: "action_card_content",
        title: def.card.title,
        rows,
        confirmLabel: def.card.confirmLabel,
        cancelLabel: def.card.cancelLabel,
        actionId: def.name,
        appId,
        appRevision,
        disclosure: def.card.disclosure,
        state: "pending",
        recipientPublicKey: recipientPublicKeyPem,
        recipientPublicKeys: additionalRecipientKeys?.filter(
            (k) => k.length > 0 && k !== recipientPublicKeyPem,
        ),
        confirmPayload: new TextEncoder().encode(JSON.stringify(extracted)),
        inboxCanisterId,
    };
}

// Pure multi-entry builder. Exact entries live only in confirmPayload and are never encoded into
// public rows. Each card row summarises one entry — its value composed from the SAME template row
// valueKeys the single-entry card uses (so a
// category/state field renders through its declared value exactly as today), joined into one readable
// line. The title reflects the entry count while deriving from the definition's own card title (no
// app name is hardcoded). Routing (recipient key, fan-out keys, inbox) is threaded identically to the
// single-entry builder, so one confirm → one deposit → one fanned-out envelope per member.
export function buildMultiActionCardContent(
    def: AiActionDefinition,
    extractedList: Record<string, unknown>[],
    recipientPublicKeyPem: string,
    inboxCanisterId?: string,
    additionalRecipientKeys?: string[],
    // The owning app id, baked onto the card (see buildActionCardContent).
    appId?: number,
    appRevision?: bigint,
): ActionCardContent {
    const templateRows = normalizedCardRows(def.card.rows) ?? [];
    const rows: ActionCardRow[] = extractedList.map((entry, i) => ({
        label: `Entry ${i + 1}`,
        value: templateRows
            .map((r) => ({ label: r.label, value: formatValue(entry[r.valueKey]) }))
            .filter((row) => row.value.length > 0)
            // Summary rows cannot use the manifest's field labels as their own row labels without
            // multiplying row count beyond the 32-row protocol limit. Preserve that information in
            // a deterministic, human-readable value so fields such as Type remain identifiable.
            .map((row) => `${row.label}: ${row.value}`)
            .join(" · "),
    }));

    return {
        kind: "action_card_content",
        title: `${def.card.title} (${extractedList.length} entries)`,
        rows,
        confirmLabel: def.card.confirmLabel,
        cancelLabel: def.card.cancelLabel,
        actionId: def.name,
        appId,
        appRevision,
        disclosure: def.card.disclosure,
        state: "pending",
        recipientPublicKey: recipientPublicKeyPem,
        recipientPublicKeys: additionalRecipientKeys?.filter(
            (k) => k.length > 0 && k !== recipientPublicKeyPem,
        ),
        confirmPayload: new TextEncoder().encode(JSON.stringify(extractedList)),
        inboxCanisterId,
    };
}

const MAX_CANONICAL_CARD_CONTEXT_BYTES =
    8 + // `OC-CARD\x01`
    (4 + 29) + // length-prefixed maximum-size viewer principal
    (1 + 4 + 29 + 4) + // largest chat variant: channel tag + community principal + channel id
    (1 + 4) + // present thread-root tag + index
    8 + // message id
    4 + // app id
    8; // app revision

function utf8Length(value: string): number {
    return new TextEncoder().encode(value).byteLength;
}

function canonicalStringLength(value: string): number {
    return 4 + utf8Length(value);
}

function maximumCanonicalCardBytes(card: ActionCardContent): number {
    let total = MAX_CANONICAL_CARD_CONTEXT_BYTES;
    total += canonicalStringLength(card.title);
    total += 4; // row count
    for (const row of card.rows) {
        total += canonicalStringLength(row.label);
        total += canonicalStringLength(row.value);
    }
    total += canonicalStringLength(card.confirmLabel);
    total += canonicalStringLength(card.cancelLabel);
    total += canonicalStringLength(card.actionId);
    total += 1 + (card.disclosure === undefined ? 0 : canonicalStringLength(card.disclosure));
    total += card.expiresAt === undefined ? 1 : 1 + 8;
    total += card.confirmPayload === undefined ? 1 : 1 + 4 + card.confirmPayload.byteLength;
    return total;
}

// Validate a built multi card against the protocol bounds before the caller asks the app canister
// to attest it. The aggregate calculation uses worst-case valid principal/chat/thread coordinates,
// so a pass is safe for every destination while a near-boundary value may be rejected conservatively.
export function multiActionCardBoundsError(card: ActionCardContent): string | undefined {
    if ([...card.title].length > MAX_AI_ACTION_CARD_TITLE_CHARS) {
        return `The multi-entry card title exceeds ${MAX_AI_ACTION_CARD_TITLE_CHARS} characters.`;
    }
    if (card.rows.some((row) => [...row.value].length > MAX_AI_ACTION_CARD_ROW_VALUE_CHARS)) {
        return `A multi-entry card summary exceeds ${MAX_AI_ACTION_CARD_ROW_VALUE_CHARS} characters.`;
    }
    if (
        card.confirmPayload !== undefined &&
        card.confirmPayload.byteLength > MAX_AI_APP_CONFIRM_PAYLOAD_BYTES
    ) {
        return `The multi-entry confirmation payload exceeds ${MAX_AI_APP_CONFIRM_PAYLOAD_BYTES} bytes.`;
    }
    if (maximumCanonicalCardBytes(card) > MAX_ATTESTED_ACTION_CARD_BYTES) {
        return "The multi-entry card exceeds OpenChat's 64 KiB attested-content limit.";
    }
    return undefined;
}

export function formatLocalCalendarDate(
    date: Pick<Date, "getFullYear" | "getMonth" | "getDate">,
): string {
    const year = String(date.getFullYear()).padStart(4, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const MAX_UNEXPECTED_INFERENCE_FAILURE_CHARS = 240;

function boundedInferenceFailure(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    const safe = raw
        .replace(/([?&](?:code|key|secret|token)=)[^&\s]*/giu, "$1[redacted]")
        // eslint-disable-next-line no-control-regex -- Intentionally removes C0/C1 controls from untrusted error text.
        .replace(/[\u0000-\u001f\u007f-\u009f]+/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();
    if (safe.length === 0) return "model inference stopped unexpectedly";
    return safe.length <= MAX_UNEXPECTED_INFERENCE_FAILURE_CHARS
        ? safe
        : `${safe.slice(0, MAX_UNEXPECTED_INFERENCE_FAILURE_CHARS - 1)}…`;
}

// Orchestrates the full proposal: run the on-device model against the declared prompt, parse, and build the
// card. `infer` is the on-device inference facade (injected so this is unit-testable without a native runtime).
export async function runAiAction(
    def: AiActionDefinition,
    input: {
        image?: Uint8Array;
        text?: string;
        modelId?: string;
        privateImageEvidence?: PrivateImageEvidence;
        /** Internal host policy for verification: compare exactly one full-image model read. */
        singleImagePass?: boolean;
        /** Source-message timestamp supplied as context only when the app requests it. */
        sourceTimestamp?: number;
    },
    recipientPublicKeyPem: string,
    infer: (req: InferenceRequest) => Promise<InferenceResult>,
    inboxCanisterId?: string,
    additionalRecipientKeys?: string[],
    // The owning app id, baked onto the built card (see buildActionCardContent).
    appId?: number,
    appRevision?: bigint,
    appNormalization?: AiActionAppNormalization,
): Promise<RunAiActionResult> {
    // The inference contract is result-shaped, but a native bridge/worker can still reject when its
    // runtime execution context is destroyed. Keep that infrastructure failure inside the model
    // boundary. Letting it escape made the outer proposal flow show the unrelated generic “action
    // could not be prepared” toast and hid the actual inference failure.
    const inferSafely = async (request: InferenceRequest): Promise<InferenceResult> => {
        try {
            const result = await infer(request);
            return result.kind === "error"
                ? { ...result, error: boundedInferenceFailure(result.error) }
                : result;
        } catch (error) {
            return {
                kind: "error",
                error: boundedInferenceFailure(error),
            };
        }
    };
    const privateEvidenceSupplied = input.privateImageEvidence !== undefined;
    const privateVerifier = privateEvidenceSupplied
        ? privateImageVerifierConfig(def.responseSchema)
        : undefined;
    if (
        privateEvidenceSupplied &&
        (input.image !== undefined ||
            input.text !== undefined ||
            privateVerifier === undefined ||
            !isValidPrivateImageEvidence(
                input.privateImageEvidence,
                privateVerifier.semanticFields,
            ))
    ) {
        return { kind: "error", error: "The private image evidence is invalid." };
    }
    const privateImageEvidence = privateEvidenceSupplied ? input.privateImageEvidence : undefined;
    const hasImageSource = input.image !== undefined || privateImageEvidence !== undefined;
    if (hasImageSource && def.acceptsImage !== true) {
        return { kind: "image_not_accepted" };
    }
    if (normalizedCardRows(def.card.rows) === undefined) {
        return { kind: "error", error: "The action card template is invalid." };
    }
    // The native runtime reads only `prompt` (its separate `text` field is not consumed), so the
    // message MUST be interpolated into the prompt for the model to see it. An explicitly declared
    // context/today rule anchors relative or year-less dates in nonempty message text ("1st june")
    // to the user's current date. It is never injected for image-only input: image pixels remain the
    // sole source evidence. Declared model-guidance rules compile into a "Rules:" block first.
    const rules = def.rules ?? [];
    const hasTextInput = input.text !== undefined && input.text.trim().length > 0;
    let candidates: Record<string, unknown>[] | undefined;
    let extractionRaw = "";
    const legacyImagePrompt = hasImageSource
        ? imagePromptTemplateConfig(def.responseSchema)
        : undefined;
    const imagePrompt =
        (input.image !== undefined
            ? imagePromptTemplateForModel(def.responseSchema, input.modelId)
            : undefined) ?? legacyImagePrompt;
    const usesAppOutput = imagePrompt?.output === "app";
    if (usesAppOutput && appNormalization === undefined) {
        return {
            kind: "error",
            error: "This image prompt requires the app's local processor. Refresh the app connection and retry.",
        };
    }
    // Focused passes are an additive extension to the v1 compact prompt. Requiring both means an
    // older client can ignore the new declaration and still use the same safe compact primary.
    const imageModelPasses =
        input.image !== undefined &&
        legacyImagePrompt !== undefined &&
        input.singleImagePass !== true
            ? imageModelPassesConfig(def.responseSchema)
            : undefined;
    if (usesAppOutput && imageModelPasses !== undefined) {
        return {
            kind: "error",
            error: "App-normalized image output cannot be combined with focused model passes.",
        };
    }
    const compiledRuleLines = compileRules(rules, { hasMessageText: hasTextInput });
    const ruleLines = imagePrompt?.includeRuleGuidance === false ? [] : compiledRuleLines;
    const providesTodayContext = boundedRules(rules).some(
        (rule) => rule.kind === "context" && rule.provide.includes("today"),
    );
    const sourceTimestamp =
        input.sourceTimestamp !== undefined && Number.isSafeInteger(input.sourceTimestamp)
            ? new Date(input.sourceTimestamp)
            : undefined;
    const calendarAnchor =
        providesTodayContext && hasTextInput
            ? sourceTimestamp !== undefined && Number.isFinite(sourceTimestamp.getTime())
                ? sourceTimestamp
                : new Date()
            : undefined;
    const buildImagePassPrompt = (pass: AiActionImageModelPassConfig): string => {
        let passPrompt = pass.template;
        if (pass.includeRuleGuidance && compiledRuleLines.length > 0) {
            passPrompt += `\n\nRules:\n- ${compiledRuleLines.join("\n- ")}`;
        }
        if (pass.includeMessage && calendarAnchor !== undefined) {
            passPrompt += `\n\nToday is ${formatLocalCalendarDate(calendarAnchor)}.`;
        }
        if (pass.includeMessage && hasTextInput) {
            passPrompt += `\n\nMessage:\n${input.text}`;
        }
        return passPrompt;
    };
    // Text keeps the original app prompt byte-for-byte. Only an image-bearing invocation may opt
    // into the compact base. Suppressing model guidance never suppresses post-processing performed
    // by executable rule kinds, schema conformance, defaults, or required-field checks.
    let prompt =
        privateImageEvidence === undefined
            ? (imagePrompt?.template ?? def.promptTemplate)
            : privateImageEvidencePrompt(privateVerifier!, privateImageEvidence);
    if (privateImageEvidence === undefined) {
        if (ruleLines.length > 0) {
            prompt += `\n\nRules:\n- ${ruleLines.join("\n- ")}`;
        }
        if (calendarAnchor !== undefined) {
            const today = formatLocalCalendarDate(calendarAnchor);
            prompt += `\n\nToday is ${today}.`;
        }
        if (hasTextInput) {
            prompt += `\n\nMessage:\n${input.text}`;
        }
    }

    // NB: the response schema is deliberately NOT passed to the model. Grammar/JSON-schema-CONSTRAINED
    // decoding makes a small on-device model emit a degenerate value under the constraint — in practice a
    // numeric output can collapse to 0 for some inputs even when the declared lower bound rejects
    // zero. The consumer then receives an invalid draft, even
    // though UNCONSTRAINED decoding extracts the right number. The schema is still enforced deterministically
    // AFTER generation by `applyRulesPostPass`/`conformToSchema` below, so nothing is lost by dropping the
    // generation-time constraint — we just let the model pick the value freely first.
    // Deliberately NO `text` here. The message is ALREADY inlined into `prompt` above, because the
    // native runtime reads only `prompt`. The BROWSER backend, however, concatenates prompt + text
    // (see webInference.ts, which builds its prompt as request.prompt followed by request.text) — so
    // passing both sent the model the SAME message twice, and it duly extracted some records twice.
    // Native never saw the duplicate, which made this look like small-model flakiness rather than a
    // bug in our own prompt assembly.
    if (candidates === undefined) {
        if (imageModelPasses !== undefined) {
            // Every pass runs through the same selected vision model and receives only image pixels;
            // a v2 focused pass may receive a bounded crop of the original, never OCR/text-reader
            // output. The compact prompt owns primaryFields; focused passes may only fill their own
            // disjoint fields.
            const primary = await inferSafely({
                modelId: input.modelId,
                prompt,
                image: input.image,
                responseMode: "json",
                maxTokens: imageModelPasses.primaryMaxTokens,
            });
            if (primary.kind === "unavailable") {
                return { kind: "unavailable", reason: primary.reason };
            }
            if (primary.kind === "error") return { kind: "error", error: primary.error };
            extractionRaw = primary.text;
            const firstCandidates = parseExtractionList(primary.text);
            if (firstCandidates !== undefined) {
                if (firstCandidates.length > MAX_AI_ACTION_CANDIDATES) {
                    return {
                        kind: "error",
                        error: `The model returned more than ${MAX_AI_ACTION_CANDIDATES} action candidates.`,
                    };
                }
                const primaryOwned = new Set(imageModelPasses.primaryFields);
                candidates = firstCandidates.map((candidate) =>
                    Object.fromEntries(
                        Object.entries(
                            applySchemaPropertyAliases(candidate, def.responseSchema),
                        ).filter(([field]) => primaryOwned.has(field)),
                    ),
                );
            }

            // Index-only merging is safe for one candidate. For a multi-record document, keep
            // the bounded primary result and omit focused fields until a future manifest contract can
            // declare immutable match keys; never attach a reordered date to the wrong record.
            if (candidates?.length === 1) {
                for (const pass of imageModelPasses.passes) {
                    const result = await inferSafely({
                        modelId: input.modelId,
                        prompt: buildImagePassPrompt(pass),
                        image: input.image,
                        imageRegion: pass.imageRegion,
                        responseMode: "json",
                        maxTokens: pass.maxTokens,
                    });
                    if (result.kind === "unavailable") {
                        return { kind: "unavailable", reason: result.reason };
                    }
                    if (result.kind === "error") return { kind: "error", error: result.error };
                    const refinement = parseExtractionList(result.text);
                    if (refinement === undefined) {
                        return {
                            kind: "error",
                            error: "A focused image-model pass returned no parseable JSON object.",
                        };
                    }
                    if (refinement.length !== 1) {
                        return {
                            kind: "error",
                            error: "A focused image-model pass returned a different candidate count.",
                        };
                    }
                    const owned = new Set(pass.fields);
                    const focusedCandidate = refinement[0]!;
                    const focusedFields = Object.fromEntries(
                        Object.entries(
                            applySchemaPropertyAliases(focusedCandidate, def.responseSchema),
                        ).filter(([field]) => owned.has(field)),
                    );
                    candidates[0] = { ...candidates[0]!, ...focusedFields };
                }
            }
        } else {
            const result = await inferSafely({
                modelId: input.modelId,
                prompt,
                // The private-evidence route is intentionally text-only: image preparation/OCR has
                // already completed and no vision projector or pixel bytes may cross this seam.
                image: privateImageEvidence === undefined ? input.image : undefined,
                // This is structured JSON extraction, so runtimes may decode greedily. Keep this separate
                // from responseSchema: schema grammar remains deliberately disabled for numeric accuracy.
                responseMode: "json",
                // Action cards contain bounded structured JSON, never long-form prose. Keeping the
                // first pass to the same 256-token envelope as the repair pass prevents a small
                // single-thread browser model from spending minutes on a runaway response.
                maxTokens: 256,
            });

            if (result.kind === "unavailable") {
                return privateImageEvidence === undefined
                    ? { kind: "unavailable", reason: result.reason }
                    : {
                          kind: "unavailable",
                          reason: "The private image verification model is unavailable.",
                      };
            }
            if (result.kind === "error") {
                return privateImageEvidence === undefined
                    ? { kind: "error", error: result.error }
                    : { kind: "error", error: "Private image verification inference failed." };
            }
            extractionRaw = result.text;

            // The model text is accepted as a single OBJECT or an ARRAY of objects (several records in
            // one message). Normalize to a list of candidate objects.
            candidates = usesAppOutput
                ? parseCompleteAppActionOutput(result.text)
                : parseExtractionList(result.text);
            // Small local models occasionally describe the right actions in prose or emit `[]` despite a
            // text message containing explicit amounts. Give TEXT input one bounded format-repair attempt;
            // it reuses the original evidence/prompt, stays unconstrained (schema grammars corrupt numeric
            // values on these models), and caps output so a failed repair cannot turn into another 512-token
            // runaway. Image inference is intentionally not doubled here unless the app explicitly declared
            // the bounded field-pass pipeline above.
            if (candidates === undefined && !hasImageSource && hasTextInput) {
                const repair = await inferSafely({
                    modelId: input.modelId,
                    prompt: `${prompt}\n\nJSON FORMAT CORRECTION:\nYour previous response did not contain a parseable action. Return ONLY valid JSON: one object for one action, or an array with one object per action. Follow every original extraction rule, include only fields supported by the message, and include every required field that the message supports. Do not include analysis, prose, markdown fences, or an empty array.`,
                    responseMode: "json",
                    maxTokens: 256,
                });
                if (repair.kind === "unavailable") {
                    return { kind: "unavailable", reason: repair.reason };
                }
                if (repair.kind === "error") return { kind: "error", error: repair.error };
                extractionRaw = repair.text;
                candidates = parseExtractionList(repair.text);
            }
        }
    }
    if (candidates === undefined) {
        return {
            kind: "no_extraction",
            raw: privateImageEvidence === undefined ? extractionRaw : "",
        };
    }
    if (candidates.length > MAX_AI_ACTION_CANDIDATES) {
        return {
            kind: "error",
            error: `The model returned more than ${MAX_AI_ACTION_CANDIDATES} action candidates.`,
        };
    }

    if (usesAppOutput) {
        const normalized = await normalizeAppActionOutput(appNormalization!, candidates);
        if (normalized.kind === "error") {
            return {
                kind: "error",
                error: "The app could not normalize the complete model result. No action was prepared.",
            };
        }
        if (normalized.kind === "none") return { kind: "no_extraction", raw: "" };
        candidates = normalized.candidates;
    }

    // Deterministic post-pass over each candidate. The card and confirmPayload are built from the
    // post-passed objects, never the raw extraction. If any candidate is incomplete, fail the whole
    // proposal so a partial multi-entry result cannot masquerade as a complete card.
    const valid: Record<string, unknown>[] = [];
    const missingFields = new Set<string>();
    for (const candidate of candidates) {
        // A text-only verifier is only an agreement signal over the exact fields compared by the
        // app-declared verifier. Discard every other model field before card construction so an
        // OCR echo (annotation/message/account/reference/raw) cannot reach a result, payload, or store.
        const verifierOutputFields =
            privateVerifier === undefined
                ? undefined
                : new Set([...privateVerifier.requiredFields, ...privateVerifier.optionalFields]);
        const boundedCandidate =
            verifierOutputFields === undefined
                ? candidate
                : Object.fromEntries(
                      Object.entries(candidate).filter(([field]) =>
                          verifierOutputFields.has(field),
                      ),
                  );
        if (privateImageEvidence !== undefined) {
            const missingRaw = privateVerifier!.requiredFields.filter(
                (field) => !Object.hasOwn(boundedCandidate, field),
            );
            if (missingRaw.length > 0) {
                for (const field of missingRaw) missingFields.add(field);
                continue;
            }
        }
        const processedExtraction = postProcessAiActionCandidate(def, boundedCandidate, {
            hasImage: hasImageSource,
            text: input.text,
        });
        const finalExtraction =
            verifierOutputFields === undefined
                ? processedExtraction
                : Object.fromEntries(
                      Object.entries(processedExtraction).filter(([field]) =>
                          verifierOutputFields.has(field),
                      ),
                  );
        const missing = missingRequired(finalExtraction, def.responseSchema);
        if (missing.length === 0) {
            valid.push(finalExtraction);
        } else {
            for (const field of missing) missingFields.add(field);
        }
    }

    // One valid candidate becomes one card. Multiple valid candidates become one attested card whose
    // exact JSON array remains in the server-stored confirmPayload; public rows stay summaries.
    if (missingFields.size > 0) {
        return {
            kind: "incomplete_extraction",
            raw: privateImageEvidence === undefined ? extractionRaw : "",
            missingFields: [...missingFields].sort(),
            candidateCount: candidates.length,
            validCandidateCount: valid.length,
        };
    }
    if (valid.length === 1) {
        return {
            kind: "ready",
            card: buildActionCardContent(
                def,
                valid[0],
                recipientPublicKeyPem,
                inboxCanisterId,
                additionalRecipientKeys,
                appId,
                appRevision,
            ),
            extracted: valid[0],
        };
    }
    const card = buildMultiActionCardContent(
        def,
        valid,
        recipientPublicKeyPem,
        inboxCanisterId,
        additionalRecipientKeys,
        appId,
        appRevision,
    );
    const boundsError = multiActionCardBoundsError(card);
    return boundsError === undefined
        ? { kind: "ready_multi", card, extracted: valid }
        : { kind: "error", error: boundsError };
}

// --- Directory read ------------------------------------------------------------------------------------------
// The on-chain action definition returned by bounded UserIndex app queries, nested in each app manifest.
// (snake_case; response_schema is a JSON string; card rows are keyed by `field`). Defined here as the read
// contract — the agent validates the query result into this shape, then maps it to the AiActionDefinition the
// runner consumes.

// Rules as serde/msgpack encodes the Rust AiActionRule enum: externally tagged — newtype variants become a
// single-key map { variant_name: payload } and unit variants (RuleMode, NormalizeOp, ContextItem) become
// plain snake_case strings.
export type AiActionRuleWire =
    | { keyword_map: { field: string; mode: string; map: { value: string; keywords: string[] }[] } }
    | { from_message: { field: string; max_length?: number | null } }
    | { normalize: { field: string; ops: string[] } }
    | { instruction: { text: string } }
    | { context: { provide: string[] } };

export interface AiActionDefinitionWire {
    name: string;
    description: string;
    prompt_template: string;
    response_schema: string;
    endpoint: string;
    consumer_public_key?: string;
    recipient_scope?: "confirmer" | "app_authorized";
    card: {
        title: string;
        confirm_label: string;
        cancel_label: string;
        disclosure?: string;
        rows: { field: string; label: string }[];
    };
    rules?: AiActionRuleWire[];
    accepts_image?: boolean;
}

// A surface as serde encodes the Rust AiAppSurface: field names already match the domain shape and
// the SurfaceDisplay unit variants travel as the plain strings "sheet" / "external" (per-variant
// serde renames).
export interface AiAppSurfaceWire {
    kind: string;
    url: string;
    display: AiAppSurfaceDisplay;
}

// The on-chain AiAppManifest / AiAppRegistration returned by bounded UserIndex app queries.
// (snake_case; nested actions use the AiActionDefinitionWire shape above). The registration's
// `owner` principal is expected to have already been stringified by the agent layer.
export interface AiAppManifestWire {
    name: string;
    description: string;
    icon_url?: string;
    app_canister_id?: string;
    consumer_public_key: string;
    // serde(default) on-chain: registrations that predate per-user keys omit it (=== false).
    per_user_keys?: boolean;
    actions: AiActionDefinitionWire[];
    // serde(default) on-chain: registrations that predate surfaces omit it (=== []).
    surfaces?: AiAppSurfaceWire[];
    // Per-app inbox: the agent layer pre-decodes the principal bytes to a text principal (like owner)
    // before this wire shape reaches aiAppManifestFromWire; absent for registrations that predate it.
    inbox_canister_id?: string;
}

export interface AiAppRegistrationWire {
    id: number;
    owner: string;
    manifest: AiAppManifestWire;
    created: bigint;
    updated: bigint;
    published: boolean;
}

const NORMALIZE_OPS: readonly AiActionNormalizeOp[] = [
    "k_m_suffix",
    "strip_symbols",
    "uppercase",
    "lowercase",
    "trim",
];

function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function ruleFromWire(entry: unknown): AiActionRule | undefined {
    if (!isRecord(entry)) return undefined;
    if (isRecord(entry.keyword_map)) {
        const r = entry.keyword_map;
        if (
            typeof r.field !== "string" ||
            !isSafeAiActionFieldName(r.field) ||
            (r.mode !== "hint" && r.mode !== "override") ||
            !Array.isArray(r.map) ||
            r.map.length > MAX_AI_ACTION_KEYWORD_MAPPINGS
        ) {
            return undefined;
        }
        const map: { value: string; keywords: string[] }[] = [];
        for (const m of r.map) {
            if (
                isRecord(m) &&
                typeof m.value === "string" &&
                isBoundedRuleString(m.value) &&
                Array.isArray(m.keywords) &&
                m.keywords.length <= MAX_AI_ACTION_KEYWORDS_PER_MAPPING &&
                m.keywords.every((k) => typeof k === "string" && isBoundedRuleString(k))
            ) {
                map.push({ value: m.value, keywords: m.keywords as string[] });
            }
        }
        return { kind: "keyword_map", field: r.field, mode: r.mode, map };
    }
    if (isRecord(entry.from_message)) {
        const r = entry.from_message;
        if (typeof r.field !== "string" || !isSafeAiActionFieldName(r.field)) return undefined;
        if (
            r.max_length !== undefined &&
            r.max_length !== null &&
            (typeof r.max_length !== "number" ||
                !Number.isInteger(r.max_length) ||
                r.max_length < 0 ||
                r.max_length > MAX_AI_ACTION_FROM_MESSAGE_LENGTH)
        ) {
            return undefined;
        }
        return {
            kind: "from_message",
            field: r.field,
            maxLength: typeof r.max_length === "number" ? r.max_length : undefined,
        };
    }
    if (isRecord(entry.normalize)) {
        const r = entry.normalize;
        if (
            typeof r.field !== "string" ||
            !isSafeAiActionFieldName(r.field) ||
            !Array.isArray(r.ops) ||
            r.ops.length > NORMALIZE_OPS.length
        )
            return undefined;
        // Unrecognised ops (forward compatibility) are skipped rather than failing the rule.
        const ops = r.ops.filter((o): o is AiActionNormalizeOp =>
            NORMALIZE_OPS.includes(o as AiActionNormalizeOp),
        );
        return { kind: "normalize", field: r.field, ops };
    }
    if (isRecord(entry.instruction)) {
        const r = entry.instruction;
        if (typeof r.text !== "string" || r.text.length > MAX_AI_ACTION_INSTRUCTION_LENGTH) {
            return undefined;
        }
        return { kind: "instruction", text: r.text };
    }
    if (isRecord(entry.context)) {
        const r = entry.context;
        if (!Array.isArray(r.provide)) return undefined;
        return { kind: "context", provide: r.provide.filter((p): p is "today" => p === "today") };
    }
    return undefined;
}

// Tolerant: a missing / non-array rules value maps to [] and entries that don't match a known rule
// shape are skipped, so an older (or newer) registry entry can never break the runner.
export function rulesFromWire(raw: unknown): AiActionRule[] {
    if (!Array.isArray(raw)) return [];
    const rules: AiActionRule[] = [];
    for (const entry of raw.slice(0, MAX_AI_ACTION_RULES)) {
        const rule = ruleFromWire(entry);
        if (rule !== undefined) rules.push(rule);
    }
    return boundedRules(rules);
}

export function aiActionDefinitionFromWire(d: AiActionDefinitionWire): AiActionDefinition {
    let responseSchema: object | undefined;
    if (d.response_schema.trim().length > 0) {
        try {
            const parsed: unknown = JSON.parse(d.response_schema);
            if (parsed !== null && typeof parsed === "object") responseSchema = parsed as object;
        } catch {
            // best-effort: a non-JSON schema string just means no constraint is passed to the model
        }
    }
    return {
        name: d.name,
        description: d.description,
        promptTemplate: d.prompt_template,
        responseSchema,
        endpoint: d.endpoint,
        consumerPublicKey: d.consumer_public_key,
        recipientScope: d.recipient_scope,
        card: {
            title: d.card.title,
            confirmLabel: d.card.confirm_label,
            cancelLabel: d.card.cancel_label,
            disclosure: d.card.disclosure,
            // Fail the whole template closed on an unsafe/ambiguous row. `runAiAction` refuses an empty
            // template, and the card-surface resolver likewise gets no attacker-controlled key map.
            rows:
                normalizedCardRows(
                    d.card.rows.map((r) => ({ label: r.label, valueKey: r.field })),
                ) ?? [],
        },
        rules: rulesFromWire(d.rules),
        acceptsImage: d.accepts_image ?? false,
    };
}

export function aiAppManifestFromWire(m: AiAppManifestWire): AiAppManifest {
    return {
        name: m.name,
        description: m.description,
        iconUrl: m.icon_url,
        appCanisterId: m.app_canister_id,
        consumerPublicKey: m.consumer_public_key,
        perUserKeys: m.per_user_keys,
        actions: m.actions.map(aiActionDefinitionFromWire),
        // Tolerant: registrations that predate surfaces omit the field.
        surfaces: (m.surfaces ?? []).map((s) => ({
            kind: s.kind,
            url: s.url,
            display: s.display,
        })),
        inboxCanisterId: m.inbox_canister_id,
    };
}

// One page of the published-app explorer (user_index explore_ai_apps). Failures degrade to an
// empty page at the mapping layer, so consumers never branch on error shapes.
export interface ExploreAiAppsResponse {
    matches: AiAppRegistration[];
    total: number;
}

export function aiAppFromRegistration(reg: AiAppRegistrationWire): AiAppRegistration {
    return {
        id: reg.id,
        owner: reg.owner,
        manifest: aiAppManifestFromWire(reg.manifest),
        created: reg.created,
        updated: reg.updated,
        published: reg.published,
    };
}
