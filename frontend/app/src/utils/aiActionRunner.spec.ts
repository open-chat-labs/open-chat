import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InferenceRequest, InferenceResult, OnDeviceInferenceCapability } from "@shared";
import type { BrowserModelImageEvidence } from "./imageSemanticDuplicateGuard";
import type { AppProcessorInput, AppProcessorResult } from "./appLocalProcessor";

const {
    acceleratedImageModelReadyMock,
    textModelReadyMock,
    acceleratedImageModelFailureReasonMock,
    attestationAvailableMock,
    imageInferenceEvidenceMock,
    inferOnDeviceMock,
    inferOnDeviceTextOnlyNoProjectorMock,
    inferenceCapabilityMock,
    isNativeClientMock,
    usesWebInferenceRuntimeMock,
    selectedWebModelIdMock,
    recognizeBrowserImageMock,
    disposeBrowserOcrMock,
    processWithAppMock,
} = vi.hoisted(() => ({
    acceleratedImageModelReadyMock: vi.fn(async () => false),
    acceleratedImageModelFailureReasonMock: vi.fn<() => string | undefined>(() => undefined),
    textModelReadyMock: vi.fn(async () => ({ available: true as const })),
    attestationAvailableMock: vi.fn(() => false),
    imageInferenceEvidenceMock: vi.fn<() => BrowserModelImageEvidence | undefined>(() => undefined),
    inferOnDeviceMock: vi.fn(
        async (_request: InferenceRequest): Promise<InferenceResult> => ({
            kind: "unavailable",
            reason: "not in tests",
        }),
    ),
    inferOnDeviceTextOnlyNoProjectorMock: vi.fn(
        async (_request: InferenceRequest): Promise<InferenceResult> => ({
            kind: "unavailable",
            reason: "not in tests",
        }),
    ),
    inferenceCapabilityMock: vi.fn(
        (): OnDeviceInferenceCapability => ({
            available: true,
            runtimesSupported: ["llama-cpp"],
            selectedModalities: ["text"],
        }),
    ),
    isNativeClientMock: vi.fn(() => false),
    usesWebInferenceRuntimeMock: vi.fn(() => true),
    selectedWebModelIdMock: vi.fn<() => string | undefined>(() => "qwen3-vl-2b-instruct-q4"),
    recognizeBrowserImageMock: vi.fn(),
    disposeBrowserOcrMock: vi.fn(async () => undefined),
    processWithAppMock: vi.fn(
        async (
            _url: string,
            _actionId: string,
            _input: AppProcessorInput,
            _stillCurrent?: () => boolean,
        ): Promise<AppProcessorResult> => ({ kind: "none" }),
    ),
}));

// These specs pin the MANUAL-extraction gate: the manual path (no on-device runtime — the caller
// supplies the extraction) must run the SAME deterministic pass as the model path (rules post-pass +
// schema conformance + required-fields check) before a card is built. Previously it built the card
// straight from the caller-supplied object, so a degenerate value (e.g. reading 0 against a schema
// requiring reading > 0) posted a confirm card the consumer app then rejected as an invalid draft.

// aiActionRunner imports the on-device inference facade at module level; stub it so importing the
// module never touches the Tauri bridge (the manual path performs no inference at all).
vi.mock("./aiActionAvailability", () => ({
    appContentAttestationAvailable: attestationAvailableMock,
}));
vi.mock("./onDeviceInference", () => ({
    inferOnDevice: inferOnDeviceMock,
    inferOnDeviceTextOnlyNoProjector: inferOnDeviceTextOnlyNoProjectorMock,
    isNativeClient: isNativeClientMock,
    onDeviceInferenceCapability: inferenceCapabilityMock,
    usesWebInferenceRuntime: usesWebInferenceRuntimeMock,
}));
vi.mock("./webInference", () => ({
    browserImageModelFirstReadiness: async () => {
        const available = await acceleratedImageModelReadyMock();
        return available
            ? { available: true }
            : { available: false, reason: acceleratedImageModelFailureReasonMock() };
    },
    browserTextModelReadiness: textModelReadyMock,
    webImageInferenceEvidence: imageInferenceEvidenceMock,
    webModelCatalogId: selectedWebModelIdMock,
}));
vi.mock("./browserOcr", () => ({
    recognizeBrowserImage: recognizeBrowserImageMock,
    disposeBrowserOcr: disposeBrowserOcrMock,
}));
vi.mock("./ocrImage", () => ({
    prepareImageForBrowserOcr: async (image: Uint8Array) => image,
}));
vi.mock("./appLocalProcessor", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./appLocalProcessor")>()),
    processWithApp: processWithAppMock,
}));

import type {
    ActionCardContent,
    AiActionDefinition,
    AiAppCardContentV1,
    AiAppRegistration,
    RunAiActionResult,
} from "@shared";
import { MAX_AI_ACTION_CANDIDATES } from "@shared";
import type { MessageContext, OpenChat } from "@client";
import { currentUserIdStore } from "@client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { browserImageActionMode } from "../stores/browserImageActionMode";
import {
    buildManualCard,
    MANUAL_EXTRACTION_CANCELLED,
    manualExtractEnabled,
    imageUnsupportedReason,
    parseManualExtractionPrompt,
    proposeFailureMessage,
    proposeAndPost,
    proposeAndPostCandidate,
    proposeAiActionForMessage,
    preflightAiActionForMessage,
    reconcileModelWithLocalResult,
    resolveCandidates,
    resolveSuggestedAiAction,
    runProposeFlow,
    NO_MODEL_MESSAGE,
    type AiActionCandidate,
    type AiActionPreflightBlocker,
    type ManualExtractionPromptResult,
    type ProposeFlowDeps,
    type ProposeResult,
    type SuggestedAiActionResolution,
    unexpectedProposalFailureMessage,
} from "./aiActionRunner";

const RECIPIENT = "-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----\n";

beforeEach(() => {
    // Match a fresh browser. Tests for either local-reader policy opt into it explicitly.
    browserImageActionMode.set("model_only");
    acceleratedImageModelReadyMock.mockReset();
    acceleratedImageModelReadyMock.mockResolvedValue(false);
    acceleratedImageModelFailureReasonMock.mockReset();
    acceleratedImageModelFailureReasonMock.mockReturnValue(undefined);
    textModelReadyMock.mockReset();
    textModelReadyMock.mockResolvedValue({ available: true });
    imageInferenceEvidenceMock.mockReset();
    imageInferenceEvidenceMock.mockReturnValue(undefined);
    attestationAvailableMock.mockReset();
    attestationAvailableMock.mockReturnValue(false);
    inferOnDeviceMock.mockReset();
    inferOnDeviceMock.mockResolvedValue({ kind: "unavailable", reason: "not in tests" });
    inferOnDeviceTextOnlyNoProjectorMock.mockReset();
    inferOnDeviceTextOnlyNoProjectorMock.mockResolvedValue({
        kind: "unavailable",
        reason: "not in tests",
    });
    inferenceCapabilityMock.mockReset();
    inferenceCapabilityMock.mockReturnValue({
        available: true,
        runtimesSupported: ["llama-cpp"],
        selectedModalities: ["text"],
    });
    isNativeClientMock.mockReset();
    isNativeClientMock.mockReturnValue(false);
    usesWebInferenceRuntimeMock.mockReset();
    usesWebInferenceRuntimeMock.mockReturnValue(true);
    selectedWebModelIdMock.mockReset();
    selectedWebModelIdMock.mockReturnValue("qwen3-vl-2b-instruct-q4");
    recognizeBrowserImageMock.mockReset();
    recognizeBrowserImageMock.mockResolvedValue({
        kind: "ok",
        confidence: 90,
        text: "METER 42 ZX NOMINAL",
    });
    disposeBrowserOcrMock.mockReset();
    disposeBrowserOcrMock.mockResolvedValue(undefined);
    processWithAppMock.mockReset();
    processWithAppMock.mockResolvedValue({ kind: "none" });
});

const DEF: AiActionDefinition = {
    name: "demo.measurement.add",
    description: "Log measurement",
    promptTemplate: "extract the record as JSON",
    responseSchema: {
        type: "object",
        properties: {
            kind: { type: "string", enum: ["measurement", "observed"] },
            reading: { type: "number", exclusiveMinimum: 0 },
            unit: { type: "string" },
        },
        required: ["reading"],
    },
    card: {
        title: "Log measurement",
        rows: [
            { label: "Reading", valueKey: "reading" },
            { label: "Unit", valueKey: "unit" },
        ],
        confirmLabel: "Add",
        cancelLabel: "Dismiss",
    },
};

describe("buildManualCard (manual-extraction gate)", () => {
    it("reports a degenerate manual extraction as incomplete — no card", () => {
        const manual = { kind: "observed", reading: 0, unit: "LUX" };
        const r = buildManualCard(DEF, manual, RECIPIENT);
        expect(r.kind).toBe("incomplete_extraction");
        if (r.kind === "incomplete_extraction") {
            // raw carries the ORIGINAL manual extraction for the caller to surface/debug.
            expect(JSON.parse(r.raw)).toEqual(manual);
            expect(r.missingFields).toEqual(["reading"]);
            expect(r.candidateCount).toBe(1);
            expect(r.validCandidateCount).toBe(0);
        }
    });

    it("builds a ready card from a valid manual extraction, post-passed like the model path", () => {
        const r = buildManualCard(
            DEF,
            { kind: "observed", reading: 350, unit: "LUX", extra: 1 },
            RECIPIENT,
        );
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            // Undeclared keys are dropped by the same conformance pass the model path runs.
            expect(r.extracted).toEqual({ kind: "observed", reading: 350, unit: "LUX" });
            expect(r.card.rows).toEqual([
                { label: "Reading", value: "350" },
                { label: "Unit", value: "LUX" },
            ]);
            expect(r.card.recipientPublicKey).toBe(RECIPIENT);
        }
    });

    const imageOmissionDef = (required: string[] = ["reading"]): AiActionDefinition => {
        const schema = DEF.responseSchema as {
            type: string;
            properties: Record<string, unknown>;
            required: string[];
        };
        return {
            ...DEF,
            responseSchema: {
                ...schema,
                properties: {
                    ...schema.properties,
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
                required,
            },
            card: {
                ...DEF.card,
                rows: [
                    ...DEF.card.rows,
                    { label: "Date", valueKey: "date" },
                    { label: "Message", valueKey: "message" },
                ],
            },
        };
    };

    it.each([undefined, "", "   "])(
        "removes date and message from image-origin manual extraction with blank text (%s)",
        (text) => {
            const result = buildManualCard(
                imageOmissionDef(),
                {
                    reading: 20,
                    unit: "LUX",
                    date: "2026-08-09",
                    message: "model-generated report description",
                },
                RECIPIENT,
                undefined,
                undefined,
                undefined,
                undefined,
                { modality: "image", text },
            );

            expect(result.kind).toBe("ready");
            if (result.kind === "ready") {
                expect(result.extracted).toEqual({ reading: 20, unit: "LUX" });
                expect(result.card.rows).toEqual([
                    { label: "Reading", value: "20" },
                    { label: "Unit", value: "LUX" },
                ]);
                expect(JSON.parse(new TextDecoder().decode(result.card.confirmPayload!))).toEqual(
                    result.extracted,
                );
            }
        },
    );

    it("keeps image-only annotated values on the manual text path", () => {
        const sourceText = "measured 20 LUX on 2026-08-09";
        const result = buildManualCard(
            imageOmissionDef(),
            {
                reading: 20,
                unit: "LUX",
                date: "2026-08-09",
                message: sourceText,
            },
            RECIPIENT,
            undefined,
            undefined,
            undefined,
            undefined,
            { modality: "text", text: sourceText },
        );

        expect(result.kind).toBe("ready");
        if (result.kind === "ready") {
            expect(result.extracted.date).toBe("2026-08-09");
            expect(result.extracted.message).toBe(sourceText);
        }
    });

    it("uses authoritative image caption text for keyword overrides, not model-authored fields", () => {
        const def: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            rules: [
                {
                    kind: "keyword_map",
                    field: "orientation",
                    mode: "override",
                    map: [
                        { value: "east", keywords: ["owed to you"] },
                        { value: "west", keywords: ["you scan"] },
                    ],
                },
            ],
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number", exclusiveMinimum: 0 },
                    orientation: { type: "string", enum: ["east", "west"] },
                    message: { type: "string" },
                },
                required: ["reading", "orientation"],
            },
        };

        const result = buildManualCard(
            def,
            { reading: 350, orientation: "you scan", message: "model-authored claim" },
            RECIPIENT,
            undefined,
            undefined,
            undefined,
            undefined,
            { modality: "image", text: "Cleaning fee owed to you" },
        );

        expect(result.kind).toBe("ready");
        if (result.kind === "ready") expect(result.extracted.orientation).toBe("east");
    });

    it("fails closed when an image-only omitted manual field is required", () => {
        const result = buildManualCard(
            imageOmissionDef(["reading", "message"]),
            { reading: 20, message: "model-generated report description" },
            RECIPIENT,
            undefined,
            undefined,
            undefined,
            undefined,
            { modality: "image" },
        );

        expect(result).toMatchObject({
            kind: "incomplete_extraction",
            missingFields: ["message"],
            candidateCount: 1,
            validCandidateCount: 0,
        });
    });

    it("runs declared normalize rules over the manual extraction ('350 lux' -> 350)", () => {
        const def: AiActionDefinition = {
            ...DEF,
            rules: [{ kind: "normalize", field: "reading", ops: ["k_m_suffix"] }],
        };
        const r = buildManualCard(def, { reading: "350 lux" }, RECIPIENT);
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            expect(r.extracted.reading).toBe(350);
        }
    });

    it("applies from_message rules to the real source text in the manual QC path", () => {
        const schema = DEF.responseSchema as {
            type: string;
            properties: Record<string, unknown>;
            required: string[];
        };
        const def: AiActionDefinition = {
            ...DEF,
            rules: [{ kind: "from_message", field: "message", maxLength: 200 }],
            responseSchema: {
                ...schema,
                properties: {
                    ...schema.properties,
                    message: { type: "string", maxLength: 200 },
                },
            },
        };
        const sourceText = "Journey qc: cleaning fee 350 HPA";
        const r = buildManualCard(
            def,
            { kind: "observed", reading: 350, unit: "HPA" },
            RECIPIENT,
            undefined,
            undefined,
            undefined,
            undefined,
            { modality: "text", text: sourceText },
        );
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            expect(r.extracted.message).toBe(sourceText);
            expect(JSON.parse(new TextDecoder().decode(r.card.confirmPayload!))).toMatchObject({
                unit: "HPA",
                message: sourceText,
            });
        }
    });

    it("no schema: the manual extraction passes through and builds a card", () => {
        const def: AiActionDefinition = { ...DEF, responseSchema: undefined };
        const r = buildManualCard(def, { reading: 0 }, RECIPIENT);
        expect(r.kind).toBe("ready");
    });

    it("threads the inbox + fan-out keys onto the card", () => {
        const r = buildManualCard(DEF, { reading: 5 }, RECIPIENT, "aaaaa-aa", ["OTHER_KEY_PEM"]);
        expect(r.kind).toBe("ready");
        if (r.kind === "ready") {
            expect(r.card.inboxCanisterId).toBe("aaaaa-aa");
            expect(r.card.recipientPublicKeys).toEqual(["OTHER_KEY_PEM"]);
        }
    });

    it("an ARRAY of two valid entries becomes one exact multi-entry card", () => {
        const r = buildManualCard(
            DEF,
            [
                { kind: "measurement", reading: 20, unit: "LUX" },
                { kind: "measurement", reading: 30, unit: "EUR" },
            ],
            RECIPIENT,
        );
        expect(r.kind).toBe("ready_multi");
        if (r.kind === "ready_multi") {
            expect(r.card.rows).toEqual([
                { label: "Entry 1", value: "Reading: 20 · Unit: LUX" },
                { label: "Entry 2", value: "Reading: 30 · Unit: EUR" },
            ]);
            expect(JSON.parse(new TextDecoder().decode(r.card.confirmPayload!))).toEqual([
                { kind: "measurement", reading: 20, unit: "LUX" },
                { kind: "measurement", reading: 30, unit: "EUR" },
            ]);
            expect(r.card.rows.some((row) => row.label.startsWith("__oc_"))).toBe(false);
        }
    });

    it("rejects a 33rd manual candidate before building a card", () => {
        const manual = Array.from({ length: MAX_AI_ACTION_CANDIDATES + 1 }, (_, index) => ({
            reading: index + 1,
        }));
        expect(buildManualCard(DEF, manual, RECIPIENT)).toEqual({
            kind: "error",
            error: `The supplied extraction contains more than ${MAX_AI_ACTION_CANDIDATES} action candidates.`,
        });
    });

    it("applies the multi-card payload bound to the manual path before posting", () => {
        const def: AiActionDefinition = {
            ...DEF,
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number", exclusiveMinimum: 0 },
                    opaque: { type: "string" },
                },
                required: ["reading"],
            },
            card: { ...DEF.card, rows: [{ label: "Reading", valueKey: "reading" }] },
        };
        const manual = [{ reading: 1, opaque: "x".repeat(16 * 1_024) }, { reading: 2 }];
        expect(buildManualCard(def, manual, RECIPIENT)).toMatchObject({
            kind: "error",
            error: expect.stringContaining("confirmation payload"),
        });
    });

    it("an ARRAY with one valid + one degenerate element fails as incomplete", () => {
        const r = buildManualCard(
            DEF,
            [
                { kind: "measurement", reading: 0, unit: "LUX" },
                { kind: "measurement", reading: 30, unit: "EUR" },
            ],
            RECIPIENT,
        );
        expect(r.kind).toBe("incomplete_extraction");
        if (r.kind === "incomplete_extraction") {
            expect(r.missingFields).toEqual(["reading"]);
            expect(r.candidateCount).toBe(2);
            expect(r.validCandidateCount).toBe(1);
        }
    });

    it("an all-invalid ARRAY reports incomplete required fields — no card", () => {
        const arr = [
            { kind: "measurement", reading: 0, unit: "LUX" },
            { kind: "measurement", unit: "EUR" },
        ];
        const r = buildManualCard(DEF, arr, RECIPIENT);
        expect(r.kind).toBe("incomplete_extraction");
        if (r.kind === "incomplete_extraction") {
            expect(JSON.parse(r.raw)).toEqual(arr);
            expect(r.missingFields).toEqual(["reading"]);
            expect(r.candidateCount).toBe(2);
            expect(r.validCandidateCount).toBe(0);
        }
    });

    it("deduplicates and sorts distinct missing fields across all candidates", () => {
        const def: AiActionDefinition = {
            ...DEF,
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number", exclusiveMinimum: 0 },
                    orientation: { type: "string", enum: ["east", "west"] },
                },
                required: ["reading", "orientation"],
            },
        };
        expect(
            buildManualCard(def, [{ orientation: "west" }, { reading: 20 }], RECIPIENT),
        ).toMatchObject({
            kind: "incomplete_extraction",
            missingFields: ["orientation", "reading"],
            candidateCount: 2,
            validCandidateCount: 0,
        });
    });
});

describe("manualExtractEnabled", () => {
    beforeEach(() => {
        localStorage.clear();
        history.replaceState({}, "", "/");
    });
    it("is false when neither the flag nor the query param is set", () => {
        expect(manualExtractEnabled()).toBe(false);
    });
    it("ignores a stale persistent flag so QC cannot contaminate a real profile", () => {
        localStorage.setItem("oc:manualExtract", "1");
        expect(manualExtractEnabled()).toBe(false);
    });
    it("is false for any other localStorage value", () => {
        localStorage.setItem("oc:manualExtract", "yes");
        expect(manualExtractEnabled()).toBe(false);
    });
    it("is true when the URL carries ?manualExtract=1", () => {
        history.replaceState({}, "", "/?manualExtract=1");
        expect(manualExtractEnabled()).toBe(true);
    });
});

describe("parseManualExtractionPrompt", () => {
    it("parses a valid extraction without reporting an error", () => {
        const onInvalid = vi.fn();
        expect(parseManualExtractionPrompt('{"reading":20,"unit":"LUX"}', onInvalid)).toEqual({
            reading: 20,
            unit: "LUX",
        });
        expect(onInvalid).not.toHaveBeenCalled();
    });

    it("parses an array when every extraction is a plain object", () => {
        const onInvalid = vi.fn();
        expect(parseManualExtractionPrompt('[{"reading":20},{"reading":30}]', onInvalid)).toEqual([
            { reading: 20 },
            { reading: 30 },
        ]);
        expect(onInvalid).not.toHaveBeenCalled();
    });

    it("rejects an empty array instead of building a zero-entry card", () => {
        const onInvalid = vi.fn();
        expect(parseManualExtractionPrompt("[]", onInvalid)).toBe(MANUAL_EXTRACTION_CANCELLED);
        expect(onInvalid).toHaveBeenCalledOnce();
        expect(buildManualCard(DEF, [], RECIPIENT)).toEqual({
            kind: "no_extraction",
            raw: "[]",
        });
    });

    it("maps Cancel to the cancellation sentinel without reporting invalid JSON", () => {
        const onInvalid = vi.fn();
        expect(parseManualExtractionPrompt(null, onInvalid)).toBe(MANUAL_EXTRACTION_CANCELLED);
        expect(onInvalid).not.toHaveBeenCalled();
    });

    it("reports malformed JSON once and maps it to the cancellation sentinel", () => {
        const onInvalid = vi.fn();
        expect(parseManualExtractionPrompt('{"reading":', onInvalid)).toBe(
            MANUAL_EXTRACTION_CANCELLED,
        );
        expect(onInvalid).toHaveBeenCalledOnce();
    });

    it.each([
        ["null", "null"],
        ["number", "7"],
        ["string", '"measurement"'],
        ["mixed array", '[{"reading":20},null]'],
        ["nested array item", '[{"reading":20},[{"reading":30}]]'],
    ])("rejects valid JSON with a non-object extraction shape: %s", (_name, raw) => {
        const onInvalid = vi.fn();
        expect(parseManualExtractionPrompt(raw, onInvalid)).toBe(MANUAL_EXTRACTION_CANCELLED);
        expect(onInvalid).toHaveBeenCalledOnce();
    });
});

// Proposing on an IMAGE used to do NOTHING: the bytes were shipped into a text-only runtime and the
// failure never surfaced. This policy is what turns that into an explanation. It is deliberately about
// the MODEL only — no native-vs-browser branch — because the remedy ("pick an image-capable model") is
// the same everywhere, and a distinction the UI never reads is exactly the dead code that hid the
// original bug.
describe("imageUnsupportedReason", () => {
    it("allows an image when the selected model has the image modality", () => {
        expect(
            imageUnsupportedReason({
                selectedModalities: ["text", "image"],
                selectedModelId: "gemma-4-e2b-it-q4",
            }),
        ).toBeUndefined();
    });

    it("blocks a text-only model and NAMES it, so the toast can say which one refused", () => {
        expect(
            imageUnsupportedReason({
                selectedModalities: ["text"],
                selectedModelId: "gemma-3-1b-it-q4",
            }),
        ).toEqual({
            kind: "image_unsupported",
            modelId: "gemma-3-1b-it-q4",
        });
    });

    it("blocks when NO model is selected (no modalities at all)", () => {
        expect(imageUnsupportedReason({ selectedModalities: [] })).toEqual({
            kind: "image_unsupported",
            modelId: undefined,
        });
    });

    it("BROWSER vision is absent, not impossible: an image-capable browser model is allowed", () => {
        // webEligibleModels excludes the 2-FILE (mmproj) shape, not vision itself — a single-file
        // vision GGUF under the ~2 GB wasm32 ceiling already passes that filter. The day the browser
        // capability probe reports "image", this must let it through with no edit here.
        expect(
            imageUnsupportedReason({
                selectedModalities: ["text", "image"],
                selectedModelId: "future-vlm.gguf",
            }),
        ).toBeUndefined();
    });
});

const CARD: ActionCardContent = {
    kind: "action_card_content",
    title: "Log measurement",
    rows: [],
    confirmLabel: "Add",
    cancelLabel: "Dismiss",
    actionId: "demo.measurement.add",
    state: "pending",
};

const APP: AiAppRegistration = {
    id: 1,
    owner: "owner-principal",
    manifest: {
        name: "Sample App",
        description: "Shared measurements",
        consumerPublicKey: RECIPIENT,
        perUserKeys: true,
        actions: [DEF],
        surfaces: [{ kind: "card", url: "https://app.example/card", display: "sheet" }],
        inboxCanisterId: "aaaaa-aa",
    },
    created: 0n,
    updated: 0n,
    published: true,
};

const DIRECT_CHAT = { kind: "direct_chat", userId: "2vxsx-fae" } as const;
const FATHER_KEY = "-----BEGIN PUBLIC KEY-----\nFATHER\n-----END PUBLIC KEY-----\n";

function directChatClient({
    directory = [],
    exact = [],
    keys = [],
}: {
    directory?: AiAppRegistration[];
    exact?: AiAppRegistration[];
    keys?: { appId: number; publicKey: string; keyVersion?: bigint }[];
} = {}) {
    const calls = {
        exploreAiApps: vi.fn(async () => ({ matches: directory, total: directory.length })),
        aiApps: vi.fn(async () => exact),
        myAiAppKeys: vi.fn(async () => keys),
        enabledAiApps: vi.fn(),
    };
    return { calls, client: calls as unknown as OpenChat };
}

describe("direct-chat per-user-key candidate resolution", () => {
    beforeEach(() => {
        attestationAvailableMock.mockReturnValue(true);
    });

    it("runs a connected app using this user's key even when the app is absent from the explorer page", async () => {
        const { client, calls } = directChatClient({
            directory: [],
            exact: [APP],
            keys: [{ appId: APP.id, publicKey: FATHER_KEY, keyVersion: 4n }],
        });

        await expect(resolveCandidates(client, DIRECT_CHAT)).resolves.toEqual({
            candidates: [
                {
                    app: APP,
                    action: DEF,
                    recipientKey: FATHER_KEY,
                    recipientKeyVersion: 4n,
                    inboxCanisterId: APP.manifest.inboxCanisterId,
                },
            ],
            linkRequired: [],
            unavailable: [],
        });
        expect(calls.exploreAiApps).toHaveBeenCalledWith(undefined, 0, 8);
        expect(calls.myAiAppKeys).toHaveBeenCalledTimes(1);
        expect(calls.aiApps).toHaveBeenCalledWith([{ appId: APP.id }]);
        expect(calls.enabledAiApps).not.toHaveBeenCalled();
    });

    it("asks to link a published per-user-key app when this user has no key", async () => {
        const { client, calls } = directChatClient({ directory: [APP] });

        await expect(
            proposeAiActionForMessage(
                client,
                DIRECT_CHAT,
                { kind: "text_content", text: "measured 20" },
                { reading: 20 },
            ),
        ).resolves.toEqual({ kind: "link_required", app: APP });
        expect(calls.exploreAiApps).toHaveBeenCalledWith(undefined, 0, 8);
        expect(calls.myAiAppKeys).toHaveBeenCalledTimes(1);
        expect(calls.enabledAiApps).not.toHaveBeenCalled();
        expect(inferOnDeviceMock).not.toHaveBeenCalled();
    });

    it("treats an empty app key as unconnected and never falls back to the manifest key", async () => {
        const { client } = directChatClient({
            directory: [APP],
            exact: [APP],
            keys: [{ appId: APP.id, publicKey: "" }],
        });

        await expect(resolveCandidates(client, DIRECT_CHAT)).resolves.toEqual({
            candidates: [],
            linkRequired: [APP],
            unavailable: [],
        });
    });

    it("does not use a key registered for another app to unlock this app", async () => {
        const { client } = directChatClient({
            directory: [APP],
            keys: [{ appId: APP.id + 1, publicKey: FATHER_KEY }],
        });

        await expect(resolveCandidates(client, DIRECT_CHAT)).resolves.toEqual({
            candidates: [],
            linkRequired: [APP],
            unavailable: [],
        });
    });

    it("re-resolves only exact public coordinates and fails revision/action drift closed", async () => {
        const other = { ...APP, id: 2, updated: 9n };
        const { client } = directChatClient({
            directory: [other, APP],
            exact: [other, APP],
            keys: [
                { appId: other.id, publicKey: FATHER_KEY },
                { appId: APP.id, publicKey: FATHER_KEY },
            ],
        });
        await expect(
            resolveSuggestedAiAction(client, DIRECT_CHAT, {
                appId: APP.id,
                appRevision: APP.updated,
                actionId: DEF.name,
            }),
        ).resolves.toMatchObject({ kind: "candidate", candidate: { app: APP, action: DEF } });
        await expect(
            resolveSuggestedAiAction(client, DIRECT_CHAT, {
                appId: APP.id,
                appRevision: APP.updated + 1n,
                actionId: DEF.name,
            }),
        ).resolves.toEqual({ kind: "stale" });
        await expect(
            resolveSuggestedAiAction(client, DIRECT_CHAT, {
                appId: APP.id,
                appRevision: APP.updated,
                actionId: "removed.action",
            }),
        ).resolves.toEqual({ kind: "stale" });

        const unlinked = directChatClient({ directory: [APP], exact: [APP] });
        await expect(
            resolveSuggestedAiAction(unlinked.client, DIRECT_CHAT, {
                appId: APP.id,
                appRevision: APP.updated,
                actionId: DEF.name,
            }),
        ).resolves.toEqual({ kind: "link_required", app: APP });
    });
});

const CANDIDATE: AiActionCandidate = {
    app: APP,
    action: DEF,
    recipientKey: RECIPIENT,
    recipientKeyVersion: 4n,
};

describe("candidate aggregate bounds", () => {
    it("accepts 31 and 32 actions, and caps a legacy 33-action manifest at 32", async () => {
        attestationAvailableMock.mockReturnValue(true);
        for (const count of [31, 32, 33]) {
            const app: AiAppRegistration = {
                ...APP,
                manifest: {
                    ...APP.manifest,
                    perUserKeys: false,
                    actions: Array.from({ length: count }, (_, index) => ({
                        ...DEF,
                        name: `sample.action.${index}`,
                    })),
                },
            };
            const client = {
                enabledAiApps: vi.fn(async () => [app.id]),
                aiApps: vi.fn(async () => [app]),
                myAiAppKeys: vi.fn(),
            } as unknown as OpenChat;
            const result = await resolveCandidates(client, {
                kind: "group_chat",
                groupId: "aaaaa-aa",
            });
            expect(result.candidates).toHaveLength(Math.min(count, MAX_AI_ACTION_CANDIDATES));
            expect(client.aiApps).toHaveBeenCalledWith([{ appId: app.id }]);
        }
    });
});

function proposalClient(app: AiAppRegistration) {
    const calls = {
        enabledAiApps: vi.fn(async () => [app.id]),
        aiApps: vi.fn(async () => [app]),
        myAiAppKeys: vi.fn(async () => [{ appId: app.id, publicKey: RECIPIENT }]),
        createAiAppCardProvenance: vi.fn(),
        sendMessageWithContent: vi.fn(),
    };
    return { calls, client: calls as unknown as OpenChat };
}

describe("new action-card availability preflight", () => {
    const messageContext: MessageContext = {
        chatId: { kind: "group_chat", groupId: "aaaaa-aa" },
    };
    const content = { kind: "text_content", text: "measured 20" } as const;

    it("the real UI preflight returns the attestation blocker before user-key/model work", async () => {
        const { client, calls } = proposalClient(APP);
        await expect(
            preflightAiActionForMessage(client, messageContext.chatId),
        ).resolves.toMatchObject({
            kind: "actions_unavailable",
            unavailable: [{ reason: "content_attestation_unavailable" }],
        });
        expect(calls.myAiAppKeys).not.toHaveBeenCalled();
        expect(inferOnDeviceMock).not.toHaveBeenCalled();
    });

    it("normal proposal path stops before key lookup, inference, provenance, or posting without full-content attestation", async () => {
        const { client, calls } = proposalClient(APP);
        const result = await proposeAndPost(client, messageContext, content);

        expect(result).toMatchObject({
            kind: "actions_unavailable",
            unavailable: [{ reason: "content_attestation_unavailable" }],
        });
        expect(calls.myAiAppKeys).not.toHaveBeenCalled();
        expect(inferOnDeviceMock).not.toHaveBeenCalled();
        expect(calls.createAiAppCardProvenance).not.toHaveBeenCalled();
        expect(calls.sendMessageWithContent).not.toHaveBeenCalled();
    });

    it("a custom candidate path cannot bypass the content-attestation kill-switch", async () => {
        const { client, calls } = proposalClient(APP);
        const result = await proposeAndPostCandidate(client, messageContext, content, CANDIDATE);

        expect(result).toMatchObject({
            kind: "actions_unavailable",
            unavailable: [{ reason: "content_attestation_unavailable" }],
        });
        expect(inferOnDeviceMock).not.toHaveBeenCalled();
        expect(calls.createAiAppCardProvenance).not.toHaveBeenCalled();
        expect(calls.sendMessageWithContent).not.toHaveBeenCalled();
    });

    it("fails before inference/post with an explicit reason when no valid card surface exists", async () => {
        const app: AiAppRegistration = {
            ...APP,
            manifest: { ...APP.manifest, surfaces: [] },
        };
        const { client, calls } = proposalClient(app);
        const result = await proposeAndPost(client, messageContext, content);

        expect(result).toMatchObject({
            kind: "actions_unavailable",
            unavailable: [{ reason: "missing_card_surface" }],
        });
        expect(inferOnDeviceMock).not.toHaveBeenCalled();
        expect(calls.createAiAppCardProvenance).not.toHaveBeenCalled();
        expect(calls.sendMessageWithContent).not.toHaveBeenCalled();
    });

    it("fails before inference/post with an explicit reason when no inbox route exists", async () => {
        const app: AiAppRegistration = {
            ...APP,
            manifest: { ...APP.manifest, inboxCanisterId: undefined },
        };
        const { client, calls } = proposalClient(app);
        const result = await proposeAndPost(client, messageContext, content);

        expect(result).toMatchObject({
            kind: "actions_unavailable",
            unavailable: [{ reason: "missing_inbox_route" }],
        });
        expect(inferOnDeviceMock).not.toHaveBeenCalled();
        expect(calls.createAiAppCardProvenance).not.toHaveBeenCalled();
        expect(calls.sendMessageWithContent).not.toHaveBeenCalled();
    });
});

describe("provenance before posting", () => {
    const messageContext: MessageContext = {
        chatId: { kind: "group_chat", groupId: "aaaaa-aa" },
    };
    const content = { kind: "text_content", text: "measured 20" } as const;

    beforeEach(() => {
        // These tests exercise the dormant post-attestation pipeline. Production remains false and
        // the proposal-entry tests below prove that no caller reaches this path while it is absent.
        attestationAvailableMock.mockReturnValue(true);
    });

    function processorFixture() {
        const action: AiActionDefinition = {
            ...DEF,
            name: "instrument.samples.capture",
            acceptsImage: true,
            responseSchema: {
                type: "object",
                "x-openchat-local-processor": { version: 1 },
                properties: {
                    reading: { type: "number", exclusiveMinimum: 0 },
                    observed_on: { type: "string" },
                    display_label: { type: "string" },
                },
                required: ["reading"],
            },
            card: {
                ...DEF.card,
                rows: [
                    { label: "Reading", valueKey: "reading" },
                    { label: "Observed", valueKey: "observed_on" },
                    { label: "Label", valueKey: "display_label" },
                ],
            },
        };
        const candidate: AiActionCandidate = {
            app: { ...APP, manifest: { ...APP.manifest, actions: [action] } },
            action,
            recipientKey: RECIPIENT,
        };
        const createAiAppCardProvenance = vi.fn(async () => ({
            kind: "success" as const,
            provenance: new Uint8Array([8]),
            expiresAt: BigInt(Date.now() + 60_000),
        }));
        const sendMessageWithContent = vi.fn(async () => ({ kind: "success" as const }));
        const client = { createAiAppCardProvenance, sendMessageWithContent } as unknown as OpenChat;
        return { action, candidate, client, createAiAppCardProvenance, sendMessageWithContent };
    }

    function declarePrivateReader(action: AiActionDefinition) {
        action.responseSchema = {
            ...(action.responseSchema as object),
            "x-openchat-private-image-verifier": {
                version: 2,
                promptTemplate:
                    "READ {{PRIMARY_IMAGE_EVIDENCE_JSON}} WITH {{SEMANTIC_IMAGE_VALUES_JSON}}",
                requiredFields: ["reading"],
                optionalFields: ["observed_on", "display_label"],
                semanticFields: [],
                ocrProfiles: ["eng", "ara+eng"],
            },
        };
    }

    it.each([false, true])(
        "runs OCR-only through the app's parser without any model readiness or inference (native=%s)",
        async (native) => {
            const fixture = processorFixture();
            declarePrivateReader(fixture.action);
            browserImageActionMode.set("local_reader_only");
            isNativeClientMock.mockReturnValue(native);
            selectedWebModelIdMock.mockReturnValue(undefined);
            inferenceCapabilityMock.mockReturnValue({
                available: false,
                runtimesSupported: [],
                selectedModalities: [],
            });
            textModelReadyMock.mockResolvedValue({ available: false } as never);
            const ocrTranscripts = [
                { profile: "eng", text: "METER 42 ZX NOMINAL" },
                { profile: "ara+eng", text: "قراءة الجهاز 42" },
            ];
            recognizeBrowserImageMock
                .mockResolvedValueOnce({ kind: "ok", confidence: 90, text: ocrTranscripts[0].text })
                .mockResolvedValueOnce({
                    kind: "ok",
                    confidence: 90,
                    text: ocrTranscripts[1].text,
                });
            const extraction = { reading: 42, display_label: "Station Delta" };
            processWithAppMock.mockResolvedValueOnce({
                kind: "candidates",
                candidates: [extraction],
            });
            const pixels = new Uint8Array([4, 2]);
            const result = await proposeAndPostCandidate(
                fixture.client,
                messageContext,
                { kind: "image_content", blobData: pixels } as unknown as Parameters<
                    typeof proposeAndPostCandidate
                >[2],
                fixture.candidate,
            );
            expect(result).toMatchObject({ kind: "ready", extracted: extraction });
            expect(processWithAppMock).toHaveBeenCalledExactlyOnceWith(
                expect.any(String),
                fixture.action.name,
                { operation: "extract", modality: "image", ocrTranscripts },
                expect.any(Function),
            );
            expect(recognizeBrowserImageMock.mock.calls.map(([, profile]) => profile)).toEqual([
                "eng",
                "ara+eng",
            ]);
            expect(disposeBrowserOcrMock).toHaveBeenCalledOnce();
            expect(disposeBrowserOcrMock.mock.invocationCallOrder[0]).toBeLessThan(
                processWithAppMock.mock.invocationCallOrder[0],
            );
            expect(textModelReadyMock).not.toHaveBeenCalled();
            expect(acceleratedImageModelReadyMock).not.toHaveBeenCalled();
            expect(inferOnDeviceMock).not.toHaveBeenCalled();
            expect(inferOnDeviceTextOnlyNoProjectorMock).not.toHaveBeenCalled();
            const exact = (
                fixture.createAiAppCardProvenance.mock.calls as unknown as unknown[][]
            )[0][3] as AiAppCardContentV1;
            expect(JSON.parse(new TextDecoder().decode(exact.confirmPayload))).toEqual(extraction);
            expect(JSON.stringify(exact)).not.toContain(ocrTranscripts[0].text);
            expect(JSON.stringify(exact)).not.toContain(ocrTranscripts[1].text);
        },
    );

    it("delegates declared local text extraction to the registered app surface before attestation", async () => {
        const fixture = processorFixture();
        const sourceTimestamp = Date.UTC(2026, 8, 4, 10);
        const source = {
            kind: "text_content",
            text: "Sample collected at station Delta.",
        } as const;
        const extraction = {
            reading: 42,
            observed_on: "2026-09-04",
            display_label: "Station Delta",
        };
        processWithAppMock.mockResolvedValueOnce({ kind: "candidates", candidates: [extraction] });
        const stillCurrent = () => true;
        const result = await proposeAndPostCandidate(
            fixture.client,
            messageContext,
            source,
            fixture.candidate,
            undefined,
            stillCurrent,
            undefined,
            undefined,
            sourceTimestamp,
        );

        expect(result).toMatchObject({ kind: "ready", extracted: extraction });
        expect(processWithAppMock).toHaveBeenCalledExactlyOnceWith(
            expect.any(String),
            fixture.action.name,
            { operation: "extract", modality: "text", text: source.text, sourceTimestamp },
            expect.any(Function),
        );
        const processorUrl = new URL(processWithAppMock.mock.calls[0][0]);
        expect(processorUrl.origin + processorUrl.pathname).toBe("https://app.example/card");
        expect(inferOnDeviceMock).not.toHaveBeenCalled();
        expect(recognizeBrowserImageMock).not.toHaveBeenCalled();
        expect(processWithAppMock.mock.invocationCallOrder[0]).toBeLessThan(
            fixture.createAiAppCardProvenance.mock.invocationCallOrder[0],
        );
        const exact = (
            fixture.createAiAppCardProvenance.mock.calls as unknown as unknown[][]
        )[0][3] as AiAppCardContentV1;
        expect(JSON.parse(new TextDecoder().decode(exact.confirmPayload))).toEqual(extraction);
    });

    it.each(["x-openchat-private-image-verifier", "x-openchat-local-processor"])(
        "requires the app's complete OCR-only contract before reading pixels (%s missing)",
        async (extension) => {
            const fixture = processorFixture();
            declarePrivateReader(fixture.action);
            delete (fixture.action.responseSchema as Record<string, unknown>)[extension];
            browserImageActionMode.set("local_reader_only");
            selectedWebModelIdMock.mockReturnValue(undefined);
            const result = await proposeAndPostCandidate(
                fixture.client,
                messageContext,
                {
                    kind: "image_content",
                    blobData: new Uint8Array([4, 2]),
                } as unknown as Parameters<typeof proposeAndPostCandidate>[2],
                fixture.candidate,
            );
            expect(result).toMatchObject({ kind: "unavailable" });
            expect(recognizeBrowserImageMock).not.toHaveBeenCalled();
            expect(processWithAppMock).not.toHaveBeenCalled();
            expect(textModelReadyMock).not.toHaveBeenCalled();
            expect(inferOnDeviceMock).not.toHaveBeenCalled();
            expect(inferOnDeviceTextOnlyNoProjectorMock).not.toHaveBeenCalled();
        },
    );

    it("normalizes v2 raw image fields before schema validation, exactly once, before attestation", async () => {
        const fixture = processorFixture();
        const modelId = "vendor/raw-vision:q4";
        selectedWebModelIdMock.mockReturnValue(modelId);
        (fixture.action.responseSchema as Record<string, unknown>)[
            "x-openchat-image-prompt-by-model"
        ] = {
            version: 2,
            templates: {
                [modelId]: {
                    template: "Read raw instrument values.",
                    includeRuleGuidance: false,
                    output: "app",
                },
            },
        };
        const raw = { reading_text: "42", raw_label: "Station Delta" };
        const normalized = {
            reading: 42,
            observed_on: "2026-09-04",
            display_label: "Station Delta",
        };
        acceleratedImageModelReadyMock.mockResolvedValue(true);
        inferenceCapabilityMock.mockReturnValue({
            available: true,
            runtimesSupported: ["llama-cpp"],
            selectedModalities: ["text", "image"],
        });
        inferOnDeviceMock.mockResolvedValueOnce({ kind: "ok", text: JSON.stringify(raw) });
        processWithAppMock.mockResolvedValueOnce({
            kind: "candidates",
            candidates: [normalized],
            sourceIndexes: [0],
        });
        const result = await proposeAndPostCandidate(
            fixture.client,
            messageContext,
            { kind: "image_content", blobData: new Uint8Array([4, 2]) } as unknown as Parameters<
                typeof proposeAndPostCandidate
            >[2],
            fixture.candidate,
        );
        expect(result).toMatchObject({ kind: "ready", extracted: normalized });
        expect(processWithAppMock).toHaveBeenCalledExactlyOnceWith(
            expect.any(String),
            fixture.action.name,
            { operation: "normalize_raw", modality: "image", candidates: [raw] },
            expect.any(Function),
        );
        expect(inferOnDeviceMock).toHaveBeenCalledOnce();
        expect(recognizeBrowserImageMock).not.toHaveBeenCalled();
        expect(processWithAppMock.mock.invocationCallOrder[0]).toBeLessThan(
            fixture.createAiAppCardProvenance.mock.invocationCallOrder[0],
        );
        const exact = (
            fixture.createAiAppCardProvenance.mock.calls as unknown as unknown[][]
        )[0][3] as AiAppCardContentV1;
        expect(JSON.parse(new TextDecoder().decode(exact.confirmPayload))).toEqual(normalized);
    });

    it.each(["invalid row binding", "changed context"])(
        "never attests raw fields or reruns inference after %s",
        async (failure) => {
            const fixture = processorFixture();
            let current = true;
            const modelId = "vendor/raw-vision:q4";
            selectedWebModelIdMock.mockReturnValue(modelId);
            (fixture.action.responseSchema as Record<string, unknown>)[
                "x-openchat-image-prompt-by-model"
            ] = {
                version: 2,
                templates: {
                    [modelId]: {
                        template: "Read raw values.",
                        includeRuleGuidance: false,
                        output: "app",
                    },
                },
            };
            acceleratedImageModelReadyMock.mockResolvedValue(true);
            inferenceCapabilityMock.mockReturnValue({
                available: true,
                runtimesSupported: ["llama-cpp"],
                selectedModalities: ["text", "image"],
            });
            inferOnDeviceMock.mockResolvedValueOnce({ kind: "ok", text: '{"reading_text":"42"}' });
            processWithAppMock.mockImplementationOnce(async () => {
                if (failure === "changed context") current = false;
                return {
                    kind: "candidates",
                    candidates: [{ reading: 42 }],
                    sourceIndexes: [failure === "changed context" ? 0 : 1],
                };
            });
            const result = await proposeAndPostCandidate(
                fixture.client,
                messageContext,
                {
                    kind: "image_content",
                    blobData: new Uint8Array([4, 2]),
                } as unknown as Parameters<typeof proposeAndPostCandidate>[2],
                fixture.candidate,
                undefined,
                () => current,
            );
            expect(result).toMatchObject({ kind: "error" });
            expect(inferOnDeviceMock).toHaveBeenCalledOnce();
            expect(processWithAppMock).toHaveBeenCalledOnce();
            expect(recognizeBrowserImageMock).not.toHaveBeenCalled();
            expect(fixture.createAiAppCardProvenance).not.toHaveBeenCalled();
            expect(fixture.sendMessageWithContent).not.toHaveBeenCalled();
        },
    );

    it("gives a model-only image result to the app for normalization before attesting its returned fields", async () => {
        const fixture = processorFixture();
        const raw = { reading: 42, observed_on: "4 Sep 2026", display_label: "raw model label" };
        const normalized = {
            reading: 42,
            observed_on: "2026-09-04",
            display_label: "Station Delta",
        };
        acceleratedImageModelReadyMock.mockResolvedValue(true);
        inferenceCapabilityMock.mockReturnValue({
            available: true,
            runtimesSupported: ["llama-cpp"],
            selectedModalities: ["text", "image"],
        });
        inferOnDeviceMock.mockResolvedValueOnce({ kind: "ok", text: JSON.stringify(raw) });
        processWithAppMock.mockResolvedValueOnce({ kind: "candidates", candidates: [normalized] });
        const result = await proposeAndPostCandidate(
            fixture.client,
            messageContext,
            { kind: "image_content", blobData: new Uint8Array([4, 2]) } as unknown as Parameters<
                typeof proposeAndPostCandidate
            >[2],
            fixture.candidate,
        );

        expect(result).toMatchObject({ kind: "ready", extracted: normalized });
        expect(processWithAppMock).toHaveBeenCalledExactlyOnceWith(
            expect.any(String),
            fixture.action.name,
            { operation: "normalize", modality: "image", candidates: [raw] },
            expect.any(Function),
        );
        expect(inferOnDeviceMock).toHaveBeenCalledOnce();
        expect(recognizeBrowserImageMock).not.toHaveBeenCalled();
        expect(inferOnDeviceMock.mock.invocationCallOrder[0]).toBeLessThan(
            processWithAppMock.mock.invocationCallOrder[0],
        );
        expect(processWithAppMock.mock.invocationCallOrder[0]).toBeLessThan(
            fixture.createAiAppCardProvenance.mock.invocationCallOrder[0],
        );
        const exact = (
            fixture.createAiAppCardProvenance.mock.calls as unknown as unknown[][]
        )[0][3] as AiAppCardContentV1;
        expect(JSON.parse(new TextDecoder().decode(exact.confirmPayload))).toEqual(normalized);
    });

    it.each(["none", "ambiguous"] as const)(
        "keeps an app's %s extraction result explicit without invoking a model or creating provenance",
        async (kind) => {
            const fixture = processorFixture();
            processWithAppMock.mockResolvedValueOnce({ kind });
            const result = await proposeAndPostCandidate(
                fixture.client,
                messageContext,
                content,
                fixture.candidate,
            );
            expect(result).toEqual({ kind: "local_no_extraction", reason: kind });
            expect(inferOnDeviceMock).not.toHaveBeenCalled();
            expect(fixture.createAiAppCardProvenance).not.toHaveBeenCalled();
            expect(fixture.sendMessageWithContent).not.toHaveBeenCalled();
        },
    );

    it("validates app-returned candidates before attestation and refuses a partial collection", async () => {
        const fixture = processorFixture();
        processWithAppMock.mockResolvedValueOnce({
            kind: "candidates",
            candidates: [{ reading: 42 }, { reading: 0 }],
        });
        const result = await proposeAndPostCandidate(
            fixture.client,
            messageContext,
            content,
            fixture.candidate,
        );
        expect(result).toMatchObject({
            kind: "incomplete_extraction",
            missingFields: ["reading"],
            candidateCount: 2,
            validCandidateCount: 1,
        });
        expect(fixture.createAiAppCardProvenance).not.toHaveBeenCalled();
        expect(fixture.sendMessageWithContent).not.toHaveBeenCalled();
    });

    it("does not invoke app processing for an action that has not declared the protocol", async () => {
        const fixture = processorFixture();
        delete (fixture.action.responseSchema as Record<string, unknown>)[
            "x-openchat-local-processor"
        ];
        inferOnDeviceMock.mockResolvedValueOnce({ kind: "ok", text: '{"reading":42}' });
        const result = await proposeAndPostCandidate(
            fixture.client,
            messageContext,
            content,
            fixture.candidate,
        );
        expect(result).toMatchObject({ kind: "ready", extracted: { reading: 42 } });
        expect(processWithAppMock).not.toHaveBeenCalled();
        expect(inferOnDeviceMock).toHaveBeenCalledOnce();
    });

    it("verifies an arbitrary image schema with one vision read and one OCR-evidence decode", async () => {
        const measurementAction: AiActionDefinition = {
            name: "instrument.measurement.capture",
            description: "Capture a measurement",
            acceptsImage: true,
            promptTemplate: "Extract app-defined measurement fields.",
            responseSchema: {
                type: "object",
                "x-openchat-local-processor": { version: 1 },
                "x-openchat-image-prompt-template": {
                    version: 1,
                    template: "Read the instrument image as app-defined JSON.",
                    includeRuleGuidance: false,
                },
                "x-openchat-private-image-verifier": {
                    version: 2,
                    promptTemplate:
                        "Read fields from OCR={{PRIMARY_IMAGE_EVIDENCE_JSON}}\nHints={{SEMANTIC_IMAGE_VALUES_JSON}}",
                    requiredFields: ["reading", "unit_code", "classification"],
                    optionalFields: ["observed_on", "display_label"],
                    semanticFields: ["classification"],
                    ocrProfiles: ["eng"],
                },
                properties: {
                    reading: { type: "number" },
                    unit_code: { type: "string" },
                    classification: { enum: ["nominal", "warning"] },
                    observed_on: { type: "string" },
                    display_label: { type: "string" },
                },
                required: ["reading", "unit_code", "classification"],
            },
            card: {
                title: "Review measurement",
                rows: [
                    { label: "Reading", valueKey: "reading" },
                    { label: "Unit", valueKey: "unit_code" },
                    { label: "Class", valueKey: "classification" },
                    { label: "Label", valueKey: "display_label" },
                ],
                confirmLabel: "Save",
                cancelLabel: "Cancel",
            },
        };
        const candidate: AiActionCandidate = {
            app: {
                ...APP,
                manifest: { ...APP.manifest, actions: [measurementAction] },
            },
            action: measurementAction,
            recipientKey: RECIPIENT,
        };
        const extraction = {
            reading: 42,
            unit_code: "ZX",
            classification: "nominal",
            observed_on: "2026-09-04",
            display_label: "Field Session",
        };
        const visionExtraction = {
            reading: extraction.reading,
            unit_code: extraction.unit_code,
            classification: extraction.classification,
            observed_on: "4 Sep 2026",
        };
        inferOnDeviceMock.mockResolvedValue({
            kind: "ok",
            text: JSON.stringify(visionExtraction),
        });
        inferOnDeviceTextOnlyNoProjectorMock.mockResolvedValue({
            kind: "ok",
            text: JSON.stringify(extraction),
        });
        processWithAppMock
            .mockResolvedValueOnce({
                kind: "candidates",
                candidates: [{ ...visionExtraction, observed_on: extraction.observed_on }],
            })
            .mockResolvedValueOnce({ kind: "candidates", candidates: [extraction] });
        acceleratedImageModelReadyMock.mockResolvedValue(true);
        inferenceCapabilityMock.mockReturnValue({
            available: true,
            runtimesSupported: ["llama-cpp"],
            selectedModalities: ["text", "image"],
            selectedModelId: "qwen3-vl-2b-instruct-q4",
        });
        const createAiAppCardProvenance = vi.fn(async () => ({
            kind: "success" as const,
            provenance: new Uint8Array([1]),
            expiresAt: BigInt(Date.now() + 60_000),
        }));
        const sendMessageWithContent = vi.fn(async () => ({ kind: "success" as const }));
        const client = {
            createAiAppCardProvenance,
            sendMessageWithContent,
        } as unknown as OpenChat;

        browserImageActionMode.set("model_with_local_verification");
        try {
            const result = await proposeAndPostCandidate(
                client,
                messageContext,
                {
                    kind: "image_content",
                    blobData: new Uint8Array([1, 2, 3]),
                    width: 640,
                    height: 480,
                } as unknown as Parameters<typeof proposeAndPostCandidate>[2],
                candidate,
            );
            expect(result).toMatchObject({ kind: "ready", extracted: extraction });
        } finally {
            browserImageActionMode.set("model_only");
        }

        expect(recognizeBrowserImageMock).toHaveBeenCalledOnce();
        expect(recognizeBrowserImageMock).toHaveBeenCalledWith(expect.any(Uint8Array), "eng");
        expect(disposeBrowserOcrMock).toHaveBeenCalledOnce();
        expect(inferOnDeviceMock).toHaveBeenCalledOnce();
        expect(inferOnDeviceTextOnlyNoProjectorMock).toHaveBeenCalledOnce();
        expect(inferOnDeviceMock.mock.calls[0][0]).toMatchObject({
            modelId: "qwen3-vl-2b-instruct-q4",
            image: expect.any(Uint8Array),
        });
        expect(inferOnDeviceTextOnlyNoProjectorMock.mock.calls[0][0]).toMatchObject({
            modelId: "qwen3-vl-2b-instruct-q4",
            image: undefined,
        });
        expect(inferOnDeviceTextOnlyNoProjectorMock.mock.calls[0][0].prompt).toContain(
            "--- OCR PROFILE eng ---",
        );
        expect(disposeBrowserOcrMock.mock.invocationCallOrder[0]).toBeLessThan(
            inferOnDeviceMock.mock.invocationCallOrder[0],
        );
        expect(inferOnDeviceMock.mock.invocationCallOrder[0]).toBeLessThan(
            inferOnDeviceTextOnlyNoProjectorMock.mock.invocationCallOrder[0],
        );
        expect(processWithAppMock).toHaveBeenCalledTimes(2);
        expect(processWithAppMock).toHaveBeenNthCalledWith(
            1,
            expect.any(String),
            measurementAction.name,
            { operation: "normalize", modality: "image", candidates: [visionExtraction] },
            expect.any(Function),
        );
        expect(processWithAppMock).toHaveBeenNthCalledWith(
            2,
            expect.any(String),
            measurementAction.name,
            { operation: "normalize", modality: "image", candidates: [extraction] },
            expect.any(Function),
        );
        expect(inferOnDeviceTextOnlyNoProjectorMock.mock.invocationCallOrder[0]).toBeLessThan(
            processWithAppMock.mock.invocationCallOrder[1],
        );
        expect(processWithAppMock.mock.invocationCallOrder[1]).toBeLessThan(
            createAiAppCardProvenance.mock.invocationCallOrder[0],
        );
        const provenanceCalls = createAiAppCardProvenance.mock.calls as unknown as unknown[][];
        const sendCalls = sendMessageWithContent.mock.calls as unknown as unknown[][];
        const exactContent = provenanceCalls[0][3] as AiAppCardContentV1;
        expect(exactContent.rows).toContainEqual({ label: "Label", value: "Field Session" });
        expect(JSON.parse(new TextDecoder().decode(exactContent.confirmPayload))).toEqual(
            extraction,
        );
        expect(sendCalls[0][1]).toMatchObject({
            rows: expect.arrayContaining([{ label: "Label", value: "Field Session" }]),
        });
    });

    it("refuses conflicting calendar values after independently normalizing both verified reads in the app", async () => {
        const fixture = processorFixture();
        declarePrivateReader(fixture.action);
        browserImageActionMode.set("model_with_local_verification");
        acceleratedImageModelReadyMock.mockResolvedValue(true);
        inferenceCapabilityMock.mockReturnValue({
            available: true,
            runtimesSupported: ["llama-cpp"],
            selectedModalities: ["text", "image"],
        });
        const vision = { reading: 42, observed_on: "4 Sep 2026" };
        const decoded = { reading: 42, observed_on: "2026-08-04" };
        inferOnDeviceMock.mockResolvedValueOnce({ kind: "ok", text: JSON.stringify(vision) });
        inferOnDeviceTextOnlyNoProjectorMock.mockResolvedValueOnce({
            kind: "ok",
            text: JSON.stringify(decoded),
        });
        processWithAppMock.mockImplementation(async (_url, _action, input) => ({
            kind: "candidates",
            candidates: (input.candidates ?? []).map((candidate) => ({
                ...candidate,
                observed_on:
                    candidate.observed_on === "4 Sep 2026" ? "2026-09-04" : candidate.observed_on,
            })),
        }));
        const result = await proposeAndPostCandidate(
            fixture.client,
            messageContext,
            { kind: "image_content", blobData: new Uint8Array([4, 2]) } as unknown as Parameters<
                typeof proposeAndPostCandidate
            >[2],
            fixture.candidate,
        );
        expect(result).toEqual({
            kind: "error",
            error: "The model result could not be verified against the image. No action was created.",
        });
        expect(processWithAppMock.mock.calls.map(([, , input]) => input.candidates)).toEqual([
            [vision],
            [decoded],
        ]);
        expect(fixture.createAiAppCardProvenance).not.toHaveBeenCalled();
        expect(fixture.sendMessageWithContent).not.toHaveBeenCalled();
    });

    it("binds provenance and the send to the same preallocated message id", async () => {
        const provenance = new Uint8Array([1, 2, 3]);
        const createAiAppCardProvenance = vi.fn(async () => ({
            kind: "success" as const,
            provenance,
            expiresAt: BigInt(Date.now() + 60_000),
        }));
        const sendMessageWithContent = vi.fn(async () => ({ kind: "success" }));
        const client = {
            createAiAppCardProvenance,
            sendMessageWithContent,
        } as unknown as OpenChat;

        const result = await proposeAndPostCandidate(client, messageContext, content, CANDIDATE, {
            reading: 20,
        });

        expect(result.kind).toBe("ready");
        const provenanceCalls = createAiAppCardProvenance.mock.calls as unknown as unknown[][];
        const sendCalls = sendMessageWithContent.mock.calls as unknown as unknown[][];
        const provedMessageId = provenanceCalls[0][5] as bigint;
        const exactContent = provenanceCalls[0][3] as Record<string, unknown>;
        const sendArgs = sendCalls[0];
        expect(sendArgs[5]).toBe(provedMessageId);
        expect(sendArgs[1]).toMatchObject({ appProvenance: provenance });
        expect(exactContent).toEqual({
            title: "Log measurement",
            rows: [{ label: "Reading", value: "20" }],
            confirmLabel: "Add",
            cancelLabel: "Dismiss",
            actionId: DEF.name,
            disclosure: undefined,
            expiresAt: undefined,
            confirmPayload: new TextEncoder().encode('{"reading":20}'),
        });
        expect(Object.keys(exactContent).sort()).toEqual([
            "actionId",
            "cancelLabel",
            "confirmLabel",
            "confirmPayload",
            "disclosure",
            "expiresAt",
            "rows",
            "title",
        ]);
        expect(createAiAppCardProvenance).toHaveBeenCalledWith(
            APP.id,
            APP.updated,
            DEF.name,
            exactContent,
            messageContext.chatId,
            provedMessageId,
            undefined,
        );
    });

    it("sanitizes image extraction before binding the exact card and payload to provenance", async () => {
        const imageDef: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number", minimum: 0.005, maximum: 100_000 },
                    unit: {
                        type: "string",
                        minLength: 3,
                        maxLength: 3,
                        format: "ascii-uppercase",
                    },
                    date: { type: "string", minLength: 10, maxLength: 10, format: "date" },
                    annotation: { type: "string", maxLength: 4_096, format: "utf8-no-nul" },
                },
                required: ["reading"],
            },
            card: {
                ...DEF.card,
                rows: [
                    { label: "Reading", valueKey: "reading" },
                    { label: "Unit", valueKey: "unit" },
                    { label: "Date", valueKey: "date" },
                    { label: "Annotation", valueKey: "annotation" },
                ],
            },
        };
        const imageApp: AiAppRegistration = {
            ...APP,
            manifest: { ...APP.manifest, actions: [imageDef] },
        };
        const imageCandidate: AiActionCandidate = {
            app: imageApp,
            action: imageDef,
            recipientKey: RECIPIENT,
        };
        const provenance = new Uint8Array([4, 5, 6]);
        const createAiAppCardProvenance = vi.fn(async () => ({
            kind: "success" as const,
            provenance,
            expiresAt: BigInt(Date.now() + 60_000),
        }));
        const sendMessageWithContent = vi.fn(async () => ({ kind: "success" }));
        const client = {
            createAiAppCardProvenance,
            sendMessageWithContent,
        } as unknown as OpenChat;
        const pixels = new Uint8Array([1, 2, 3, 4]);
        const imageContent = {
            kind: "image_content",
            blobData: pixels,
        } as unknown as Parameters<typeof proposeAndPostCandidate>[2];

        // This assertion targets the shared model-output sanitization boundary. Browser mode adds a
        // separate app-declared verification contract, which has its own focused coverage.
        usesWebInferenceRuntimeMock.mockReturnValue(false);
        inferenceCapabilityMock.mockReturnValue({
            available: true,
            runtimesSupported: ["llama-cpp"],
            selectedModalities: ["text", "image"],
            selectedModelId: "vision-test",
        });
        inferOnDeviceMock.mockResolvedValueOnce({
            kind: "ok",
            text: JSON.stringify({
                reading: 20,
                unit: "$$$",
                date: "08/07/2026",
                annotation: `visible${String.fromCharCode(0)}hidden`,
            }),
        });

        const result = await proposeAndPostCandidate(
            client,
            messageContext,
            imageContent,
            imageCandidate,
        );

        expect(result).toMatchObject({ kind: "ready" });
        expect(inferOnDeviceMock).toHaveBeenCalledTimes(1);
        expect(inferOnDeviceMock.mock.calls[0][0].image).toEqual(pixels);
        const provenanceCalls = createAiAppCardProvenance.mock.calls as unknown as unknown[][];
        const sendCalls = sendMessageWithContent.mock.calls as unknown as unknown[][];
        const exactContent = provenanceCalls[0][3] as Record<string, unknown>;
        const provedMessageId = provenanceCalls[0][5] as bigint;
        expect(exactContent).toEqual({
            title: "Log measurement",
            rows: [{ label: "Reading", value: "20" }],
            confirmLabel: "Add",
            cancelLabel: "Dismiss",
            actionId: imageDef.name,
            disclosure: undefined,
            expiresAt: undefined,
            confirmPayload: new TextEncoder().encode('{"reading":20}'),
        });
        expect(sendCalls[0][5]).toBe(provedMessageId);
        expect(sendCalls[0][1]).toMatchObject({ appProvenance: provenance });
    });

    it("pins one browser model id across a compact primary and focused image pass", async () => {
        acceleratedImageModelReadyMock.mockResolvedValue(true);
        const imageDef: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                "x-openchat-image-prompt-template": {
                    version: 1,
                    template: "Read reading only.",
                    includeRuleGuidance: false,
                },
                "x-openchat-image-focused-passes": {
                    version: 1,
                    primaryFields: ["reading"],
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
                    reading: { type: "number", minimum: 0.005 },
                    date: { type: "string", format: "date" },
                },
                required: ["reading"],
            },
        };
        const imageCandidate: AiActionCandidate = {
            app: { ...APP, manifest: { ...APP.manifest, actions: [imageDef] } },
            action: imageDef,
            recipientKey: RECIPIENT,
        };
        const client = {
            createAiAppCardProvenance: vi.fn(async () => ({
                kind: "success" as const,
                provenance: new Uint8Array([9]),
                expiresAt: BigInt(Date.now() + 60_000),
            })),
            sendMessageWithContent: vi.fn(async () => ({ kind: "success" })),
        } as unknown as OpenChat;
        const imageContent = {
            kind: "image_content",
            blobData: new Uint8Array([1, 2, 3]),
        } as unknown as Parameters<typeof proposeAndPostCandidate>[2];
        inferenceCapabilityMock.mockReturnValue({
            available: true,
            // This shared capability field still describes the native catalog runtime family; the
            // browser's Transformers/WebGPU backend is asserted through the web-runtime mocks below.
            runtimesSupported: ["llama-cpp"],
            selectedModalities: ["image"],
            selectedModelId: "qwen3-vl-2b-instruct-q4",
        });
        let call = 0;
        inferOnDeviceMock.mockImplementation(async () => {
            call += 1;
            if (call === 1) {
                selectedWebModelIdMock.mockReturnValue("another-model");
                return { kind: "ok", text: '{"reading":12345}' };
            }
            return { kind: "ok", text: '{"date":"2026-08-14"}' };
        });

        const result = await proposeAndPostCandidate(
            client,
            messageContext,
            imageContent,
            imageCandidate,
        );

        expect(result.kind).toBe("ready");
        expect(inferOnDeviceMock).toHaveBeenCalledTimes(2);
        expect(inferOnDeviceMock.mock.calls.map(([request]) => request.modelId)).toEqual([
            "qwen3-vl-2b-instruct-q4",
            "qwen3-vl-2b-instruct-q4",
        ]);
    });

    it("uses the fresh-browser model-only default for original image pixels without OCR", async () => {
        acceleratedImageModelReadyMock.mockResolvedValue(true);
        const imageDef: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number", minimum: 0.005 },
                    unit: { type: "string" },
                    kind: { type: "string", enum: ["scheduled", "observed"] },
                    orientation: { type: "string", enum: ["east", "west"] },
                    date: { type: "string", format: "date" },
                    annotation: { type: "string" },
                    message: { type: "string" },
                },
                required: ["reading", "unit", "kind", "orientation"],
            },
        };
        const imageCandidate: AiActionCandidate = {
            app: { ...APP, manifest: { ...APP.manifest, actions: [imageDef] } },
            action: imageDef,
            recipientKey: RECIPIENT,
        };
        const client = {
            createAiAppCardProvenance: vi.fn(async () => ({
                kind: "success" as const,
                provenance: new Uint8Array([9]),
                expiresAt: BigInt(Date.now() + 60_000),
            })),
            sendMessageWithContent: vi.fn(async () => ({ kind: "success" })),
        } as unknown as OpenChat;
        const pixels = new Uint8Array([11, 22, 33, 44]);
        const phases: string[] = [];
        inferenceCapabilityMock.mockReturnValue({
            available: true,
            runtimesSupported: ["llama-cpp"],
            selectedModalities: ["image"],
            selectedModelId: "qwen3-vl-2b-instruct-q4",
        });
        inferOnDeviceMock.mockResolvedValueOnce({
            kind: "ok",
            text: '{"reading":12345,"unit":"HPA","kind":"observed","orientation":"east","date":"2026-08-13"}',
        });

        const result = await proposeAndPostCandidate(
            client,
            messageContext,
            { kind: "image_content", blobData: pixels } as unknown as Parameters<
                typeof proposeAndPostCandidate
            >[2],
            imageCandidate,
            undefined,
            undefined,
            (phase) => phases.push(phase),
        );

        expect(result).toMatchObject({
            kind: "ready",
            extracted: { date: "2026-08-13" },
        });
        expect(inferOnDeviceMock).toHaveBeenCalledOnce();
        expect(inferOnDeviceMock.mock.calls[0][0]).toMatchObject({
            modelId: "qwen3-vl-2b-instruct-q4",
            image: pixels,
        });
        expect(inferOnDeviceTextOnlyNoProjectorMock).not.toHaveBeenCalled();
        expect(phases).not.toContain("reading_image");
        expect(phases).not.toContain("reading_text");
    });

    it("keeps a visible user-defined category and date range in a model-only image card without invoking OCR", async () => {
        acceleratedImageModelReadyMock.mockResolvedValue(true);
        const appImagePrompt =
            "APP_DEFINED_IMAGE_PROMPT: extract only the fields and meanings declared by this app.";
        const imageDef: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                "x-openchat-image-prompt-template": {
                    version: 1,
                    template: appImagePrompt,
                    includeRuleGuidance: false,
                },
                properties: {
                    reading: { type: "number", minimum: 0.005 },
                    unit: { type: "string" },
                    kind: { type: "string", enum: ["scheduled", "observed"] },
                    orientation: {
                        type: "string",
                        enum: ["east", "west"],
                        "x-openchat-default-for-image-only": "east",
                    },
                    date: { type: "string", format: "date" },
                    annotation: { type: "string" },
                    message: { type: "string" },
                },
                required: ["reading", "unit", "kind", "orientation"],
            },
        };
        const imageCandidate: AiActionCandidate = {
            app: { ...APP, manifest: { ...APP.manifest, actions: [imageDef] } },
            action: imageDef,
            recipientKey: RECIPIENT,
        };
        const client = {
            createAiAppCardProvenance: vi.fn(async () => ({
                kind: "success" as const,
                provenance: new Uint8Array([9]),
                expiresAt: BigInt(Date.now() + 60_000),
            })),
            sendMessageWithContent: vi.fn(async () => ({ kind: "success" })),
        } as unknown as OpenChat;
        const pixels = new Uint8Array([11, 22, 33, 44]);
        const phases: string[] = [];
        inferenceCapabilityMock.mockReturnValue({
            available: true,
            runtimesSupported: ["llama-cpp"],
            selectedModalities: ["image"],
            selectedModelId: "qwen3-vl-2b-instruct-q4",
        });
        inferOnDeviceMock.mockResolvedValueOnce({
            kind: "ok",
            text: '{"reading":1912.15,"unit":"LUX","kind":"scheduled","annotation":"Workshop Confirmed | From 2026-07-19 to 2026-08-06"}',
        });

        const result = await proposeAndPostCandidate(
            client,
            messageContext,
            { kind: "image_content", blobData: pixels } as unknown as Parameters<
                typeof proposeAndPostCandidate
            >[2],
            imageCandidate,
            undefined,
            undefined,
            (phase) => phases.push(phase),
        );

        expect(result).toMatchObject({
            kind: "ready",
            extracted: {
                reading: 1912.15,
                unit: "LUX",
                kind: "scheduled",
                orientation: "east",
                annotation: "Workshop Confirmed | From 2026-07-19 to 2026-08-06",
            },
        });
        expect(inferOnDeviceMock).toHaveBeenCalledOnce();
        expect(inferOnDeviceMock.mock.calls[0][0]).toMatchObject({
            modelId: "qwen3-vl-2b-instruct-q4",
            image: pixels,
            prompt: appImagePrompt,
        });
        expect(inferOnDeviceTextOnlyNoProjectorMock).not.toHaveBeenCalled();
        // The runner emits these phases immediately before either local image reader. Their
        // absence proves a successful model-only result does not invoke OCR as a hidden side path.
        expect(phases).not.toContain("reading_image");
        expect(phases).not.toContain("reading_text");
    });

    it("preserves a selected browser image model's update reason instead of calling it text-only", async () => {
        const updateReason =
            "Qwen3-VL 2B is selected but its all-WebGPU model files need an update. Open On-device models and tap Retry download.";
        acceleratedImageModelFailureReasonMock.mockReturnValue(updateReason);
        // This is the exact state after restore detects stale pinned cache entries: the selection is
        // retained, but it is not advertised as a live inference capability until it is updated.
        inferenceCapabilityMock.mockReturnValue({
            available: false,
            runtimesSupported: ["llama-cpp"],
            selectedModalities: [],
        });
        const imageDef: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number", minimum: 0.005 },
                    unit: { type: "string" },
                    kind: { type: "string", enum: ["scheduled", "observed"] },
                    orientation: { type: "string", enum: ["east", "west"] },
                    date: { type: "string" },
                    annotation: { type: "string" },
                    message: { type: "string" },
                },
                required: ["reading", "kind", "orientation"],
            },
        };
        const candidate: AiActionCandidate = {
            app: { ...APP, manifest: { ...APP.manifest, actions: [imageDef] } },
            action: imageDef,
            recipientKey: RECIPIENT,
        };

        browserImageActionMode.set("model_only");
        try {
            await expect(
                proposeAndPostCandidate(
                    {} as OpenChat,
                    { chatId: { kind: "group_chat", groupId: "aaaaa-aa" } },
                    {
                        kind: "image_content",
                        blobData: new Uint8Array([1, 2, 3]),
                    } as unknown as Parameters<typeof proposeAndPostCandidate>[2],
                    candidate,
                ),
            ).resolves.toEqual({ kind: "unavailable", reason: updateReason });
        } finally {
            browserImageActionMode.set("model_only");
        }
        expect(inferOnDeviceMock).not.toHaveBeenCalled();
    });

    const unavailableVerifierSchema = {
        type: "object",
        "x-openchat-private-image-verifier": {
            version: 1,
            promptTemplate:
                "VERIFY\nPRIMARY={{PRIMARY_IMAGE_EVIDENCE_JSON}}\nSEMANTIC={{SEMANTIC_IMAGE_VALUES_JSON}}",
            requiredFields: ["reading"],
            optionalFields: ["unit"],
            semanticFields: [],
        },
        properties: {
            reading: { type: "number" },
            unit: { type: "string" },
        },
        required: ["reading"],
    };

    it("verification mode never substitutes an OCR-decoder card when vision is unavailable", () => {
        const local: ProposeResult = {
            kind: "ready",
            card: CARD,
            extracted: {
                reading: 12_345,
                unit: "HPA",
                kind: "observed",
                orientation: "east",
                date: "2026-08-14",
            },
        };

        expect(
            reconcileModelWithLocalResult(
                { kind: "unavailable", reason: "private verifier unavailable" },
                local,
                unavailableVerifierSchema,
            ),
        ).toEqual({ kind: "unavailable", reason: "private verifier unavailable" });
    });

    it("verification mode fails closed without a valid app verifier declaration", () => {
        const local: ProposeResult = {
            kind: "ready",
            card: CARD,
            extracted: { reading: 42 },
        };
        expect(
            reconcileModelWithLocalResult(
                { kind: "unavailable", reason: "private verifier unavailable" },
                local,
            ),
        ).toEqual({
            kind: "error",
            error: "The model result could not be verified against the image. No action was created.",
        });
    });

    it("verification mode never falls back to an incomplete local extraction", () => {
        const local: ProposeResult = {
            kind: "incomplete_extraction",
            raw: '{"reading":12345}',
            missingFields: ["orientation"],
            candidateCount: 1,
            validCandidateCount: 0,
        };

        expect(
            reconcileModelWithLocalResult(
                { kind: "unavailable", reason: "private verifier unavailable" },
                local,
                unavailableVerifierSchema,
            ),
        ).toEqual({
            kind: "error",
            error: "The model result could not be verified against the image. No action was created.",
        });
    });

    it("compares arbitrary app-declared required and optional verifier fields exactly", () => {
        const responseSchema = {
            type: "object",
            "x-openchat-private-image-verifier": {
                version: 1,
                promptTemplate:
                    "VERIFY\nPRIMARY={{PRIMARY_IMAGE_EVIDENCE_JSON}}\nSEMANTIC={{SEMANTIC_IMAGE_VALUES_JSON}}",
                requiredFields: ["reading", "unit_code"],
                optionalFields: ["observed_on"],
                semanticFields: [],
            },
            properties: {
                reading: { type: "number" },
                unit_code: { type: "string" },
                observed_on: { type: "string" },
            },
            required: ["reading", "unit_code"],
        };
        const local: ProposeResult = {
            kind: "ready",
            card: CARD,
            extracted: { reading: 42, unit_code: "ZX", observed_on: "2026-09-03" },
        };
        const modelWithoutOptional: RunAiActionResult = {
            kind: "ready",
            card: CARD,
            extracted: { reading: 42, unit_code: "ZX" },
        };
        expect(reconcileModelWithLocalResult(modelWithoutOptional, local, responseSchema)).toBe(
            local,
        );

        const modelWithMatchingOptional: RunAiActionResult = {
            ...modelWithoutOptional,
            extracted: { reading: 42, unit_code: "ZX", observed_on: "2026-09-03" },
        };
        expect(
            reconcileModelWithLocalResult(modelWithMatchingOptional, local, responseSchema),
        ).toBe(local);

        const modelWithInventedOptional: RunAiActionResult = {
            ...modelWithoutOptional,
            extracted: { reading: 42, unit_code: "ZX", observed_on: "invented-prefix" },
        };
        expect(
            reconcileModelWithLocalResult(modelWithInventedOptional, local, responseSchema),
        ).toMatchObject({ kind: "error" });

        const localWithoutOptional: ProposeResult = {
            ...local,
            extracted: { reading: 42, unit_code: "ZX" },
        };
        expect(
            reconcileModelWithLocalResult(
                modelWithMatchingOptional,
                localWithoutOptional,
                responseSchema,
            ),
        ).toMatchObject({ kind: "error" });

        const modelWithRequiredMismatch: RunAiActionResult = {
            ...modelWithoutOptional,
            extracted: { reading: 43, unit_code: "ZX" },
        };
        expect(
            reconcileModelWithLocalResult(modelWithRequiredMismatch, local, responseSchema),
        ).toMatchObject({ kind: "error" });
    });

    it("hands an evidence-decoded optional label to app-private post-processing", () => {
        const responseSchema = {
            type: "object",
            "x-openchat-private-image-verifier": {
                version: 1,
                promptTemplate:
                    "VERIFY\nPRIMARY={{PRIMARY_IMAGE_EVIDENCE_JSON}}\nSEMANTIC={{SEMANTIC_IMAGE_VALUES_JSON}}",
                requiredFields: ["reading"],
                optionalFields: ["display_label"],
                semanticFields: [],
            },
            properties: {
                reading: { type: "number" },
                display_label: { type: "string" },
            },
            required: ["reading"],
        };
        const vision: RunAiActionResult = {
            kind: "ready",
            card: CARD,
            extracted: { reading: 42 },
        };
        const evidenceDecoded: ProposeResult = {
            kind: "ready",
            card: CARD,
            extracted: { reading: 42, display_label: "Field Session" },
        };

        expect(reconcileModelWithLocalResult(vision, evidenceDecoded, responseSchema)).toBe(
            evidenceDecoded,
        );

        const inventedVisionLabel: RunAiActionResult = {
            ...vision,
            extracted: { reading: 42, display_label: "Invented Prefix" },
        };
        expect(
            reconcileModelWithLocalResult(inventedVisionLabel, evidenceDecoded, responseSchema),
        ).toEqual({
            kind: "error",
            error: "The model result could not be verified against the image. No action was created.",
        });
    });

    it("applies the selected image modality to manual debug extraction before provenance", async () => {
        const imageDef: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                type: "object",
                properties: {
                    reading: { type: "number", exclusiveMinimum: 0 },
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
                required: ["reading"],
            },
        };
        const imageCandidate: AiActionCandidate = {
            app: { ...APP, manifest: { ...APP.manifest, actions: [imageDef] } },
            action: imageDef,
            recipientKey: RECIPIENT,
        };
        const createAiAppCardProvenance = vi.fn(async () => ({
            kind: "success" as const,
            provenance: new Uint8Array([7]),
            expiresAt: BigInt(Date.now() + 60_000),
        }));
        const client = {
            createAiAppCardProvenance,
            sendMessageWithContent: vi.fn(async () => ({ kind: "success" })),
        } as unknown as OpenChat;
        const imageContent = {
            kind: "image_content",
            blobData: new Uint8Array([1, 2, 3]),
        } as unknown as Parameters<typeof proposeAndPostCandidate>[2];

        const result = await proposeAndPostCandidate(
            client,
            messageContext,
            imageContent,
            imageCandidate,
            {
                reading: 20,
                date: "2026-08-09",
                message: "manual model stand-in",
            },
        );

        expect(result.kind).toBe("ready");
        expect(inferOnDeviceMock).not.toHaveBeenCalled();
        const provenanceCalls = createAiAppCardProvenance.mock.calls as unknown as unknown[][];
        expect(provenanceCalls[0][3]).toMatchObject({
            rows: [{ label: "Reading", value: "20" }],
            confirmPayload: new TextEncoder().encode('{"reading":20}'),
        });
    });

    it("binds a thread card to Some(threadRootMessageIndex)", async () => {
        const createAiAppCardProvenance = vi.fn(async () => ({
            kind: "success" as const,
            provenance: new Uint8Array([9]),
            expiresAt: BigInt(Date.now() + 60_000),
        }));
        const client = {
            createAiAppCardProvenance,
            sendMessageWithContent: vi.fn(async () => ({ kind: "success" })),
        } as unknown as OpenChat;
        const threadContext: MessageContext = { ...messageContext, threadRootMessageIndex: 42 };
        await proposeAndPostCandidate(client, threadContext, content, CANDIDATE, { reading: 20 });
        const provenanceCalls = createAiAppCardProvenance.mock.calls as unknown as unknown[][];
        expect(provenanceCalls[0][6]).toBe(42);
    });

    it.each([
        [
            "invalid request",
            { kind: "invalid_request" } as const,
            "rejected this card's verified content",
        ],
        ["backend error", { kind: "backend_error" } as const, "card verification service failed"],
        [
            "malformed success",
            { kind: "malformed_success" } as const,
            "invalid card verification response",
        ],
        [
            "transport error",
            { kind: "transport_error" } as const,
            "could not reach the card verification service",
        ],
        ["offline", { kind: "offline" } as const, "OpenChat is offline"],
    ])("fails closed with an actionable %s category", async (_label, provenanceResult, message) => {
        const sendMessageWithContent = vi.fn();
        const client = {
            createAiAppCardProvenance: vi.fn(async () => provenanceResult),
            sendMessageWithContent,
        } as unknown as OpenChat;
        const result = await proposeAndPostCandidate(client, messageContext, content, CANDIDATE, {
            reading: 20,
        });
        expect(result).toMatchObject({ kind: "error" });
        if (result.kind === "error") expect(result.error).toContain(message);
        expect(sendMessageWithContent).not.toHaveBeenCalled();
    });

    it("returns typed app coordinates when provenance reports app_unavailable", async () => {
        const sendMessageWithContent = vi.fn();
        const client = {
            createAiAppCardProvenance: vi.fn(async () => ({
                kind: "app_unavailable" as const,
            })),
            sendMessageWithContent,
        } as unknown as OpenChat;

        await expect(
            proposeAndPostCandidate(client, messageContext, content, CANDIDATE, { reading: 20 }),
        ).resolves.toEqual({
            kind: "app_connection_unavailable",
            appId: APP.id,
            appRevision: APP.updated,
            actionId: DEF.name,
            preparedExtraction: { reading: 20 },
            preparedSource: { modality: "text", text: content.text, rulesAlreadyResolved: true },
        });
        expect(sendMessageWithContent).not.toHaveBeenCalled();
    });

    it("fails closed with a distinct retry message when provenance has already expired", async () => {
        const sendMessageWithContent = vi.fn();
        const client = {
            createAiAppCardProvenance: vi.fn(async () => ({
                kind: "success" as const,
                provenance: new Uint8Array([9]),
                expiresAt: BigInt(Date.now()),
            })),
            sendMessageWithContent,
        } as unknown as OpenChat;
        const result = await proposeAndPostCandidate(client, messageContext, content, CANDIDATE, {
            reading: 20,
        });
        expect(result).toMatchObject({
            kind: "error",
            error: "Card verification expired before the card could be posted. Please retry.",
        });
        expect(sendMessageWithContent).not.toHaveBeenCalled();
    });

    it("does not mint provenance or send when a manual extraction is incomplete", async () => {
        const createAiAppCardProvenance = vi.fn();
        const sendMessageWithContent = vi.fn();
        const client = {
            createAiAppCardProvenance,
            sendMessageWithContent,
        } as unknown as OpenChat;

        const result = await proposeAndPostCandidate(client, messageContext, content, CANDIDATE, {
            reading: 0,
        });

        expect(result).toMatchObject({
            kind: "incomplete_extraction",
            missingFields: ["reading"],
        });
        expect(createAiAppCardProvenance).not.toHaveBeenCalled();
        expect(sendMessageWithContent).not.toHaveBeenCalled();
    });

    it("mints one provenance and sends one exact card for a multi-entry extraction", async () => {
        const provenance = new Uint8Array([7, 8, 9]);
        const createAiAppCardProvenance = vi.fn(async () => ({
            kind: "success" as const,
            provenance,
            expiresAt: BigInt(Date.now() + 60_000),
        }));
        const sendMessageWithContent = vi.fn(async () => ({ kind: "success" }));
        const client = {
            createAiAppCardProvenance,
            sendMessageWithContent,
        } as unknown as OpenChat;
        const result = await proposeAndPostCandidate(client, messageContext, content, CANDIDATE, [
            { reading: 20 },
            { reading: 30 },
        ]);
        expect(result.kind).toBe("ready_multi");
        expect(createAiAppCardProvenance).toHaveBeenCalledTimes(1);
        expect(sendMessageWithContent).toHaveBeenCalledTimes(1);

        const provenanceCalls = createAiAppCardProvenance.mock.calls as unknown as unknown[][];
        const sendCalls = sendMessageWithContent.mock.calls as unknown as unknown[][];
        const exactContent = provenanceCalls[0][3] as AiAppCardContentV1;
        const provedMessageId = provenanceCalls[0][5] as bigint;
        expect(JSON.parse(new TextDecoder().decode(exactContent.confirmPayload!))).toEqual([
            { reading: 20 },
            { reading: 30 },
        ]);
        expect(exactContent.rows).toEqual([
            { label: "Entry 1", value: "Reading: 20" },
            { label: "Entry 2", value: "Reading: 30" },
        ]);
        expect(createAiAppCardProvenance).toHaveBeenCalledWith(
            APP.id,
            APP.updated,
            DEF.name,
            exactContent,
            messageContext.chatId,
            provedMessageId,
            undefined,
        );
        const sendCall = sendCalls[0];
        const sentCard = sendCall[1] as ActionCardContent;
        expect(sendCall[5]).toBe(provedMessageId);
        expect(sentCard.appProvenance).toEqual(provenance);
        expect(JSON.parse(new TextDecoder().decode(sentCard.confirmPayload!))).toEqual([
            { reading: 20 },
            { reading: 30 },
        ]);
    });

    it("sends no partial multi-entry card when exact provenance is unavailable", async () => {
        const createAiAppCardProvenance = vi.fn(async () => ({
            kind: "app_unavailable" as const,
        }));
        const sendMessageWithContent = vi.fn();
        const client = {
            createAiAppCardProvenance,
            sendMessageWithContent,
        } as unknown as OpenChat;

        const result = await proposeAndPostCandidate(client, messageContext, content, CANDIDATE, [
            { reading: 20 },
            { reading: 30 },
        ]);

        expect(result).toEqual({
            kind: "app_connection_unavailable",
            appId: APP.id,
            appRevision: APP.updated,
            actionId: DEF.name,
            preparedExtraction: [{ reading: 20 }, { reading: 30 }],
            preparedSource: { modality: "text", text: content.text, rulesAlreadyResolved: true },
        });
        expect(createAiAppCardProvenance).toHaveBeenCalledTimes(1);
        expect(sendMessageWithContent).not.toHaveBeenCalled();
    });
});

// Proposing that ends without a word is the defect this whole describe exists for: a user taps
// "Propose action", nothing happens, nothing is said, and there is no way to tell a bug from an app
// with nothing to offer. Keying the table by ProposeResult["kind"] means a NEW kind fails to compile
// here too, so the table can never quietly stop covering the union it claims to cover.
const EVERY_RESULT: Record<ProposeResult["kind"], ProposeResult> = {
    ready: { kind: "ready", card: CARD, extracted: { reading: 20 } },
    ready_multi: { kind: "ready_multi", card: CARD, extracted: [{ reading: 20 }] },
    choose: { kind: "choose", candidates: [CANDIDATE] },
    link_required: { kind: "link_required", app: APP },
    actions_unavailable: {
        kind: "actions_unavailable",
        unavailable: [{ app: APP, reason: "content_attestation_unavailable" }],
    },
    app_connection_unavailable: {
        kind: "app_connection_unavailable",
        appId: APP.id,
        appRevision: APP.updated,
        actionId: DEF.name,
        preparedExtraction: { reading: 20 },
        preparedSource: { modality: "text", text: "measured 20", rulesAlreadyResolved: true },
    },
    no_actions: { kind: "no_actions" },
    unavailable: { kind: "unavailable", reason: "no model" },
    unsupported_content: { kind: "unsupported_content" },
    image_unsupported: { kind: "image_unsupported", modelId: "gemma-3-1b-it-q4" },
    image_not_accepted: { kind: "image_not_accepted" },
    local_no_extraction: { kind: "local_no_extraction", reason: "ambiguous" },
    no_extraction: { kind: "no_extraction", raw: "{}" },
    incomplete_extraction: {
        kind: "incomplete_extraction",
        raw: "{}",
        missingFields: ["orientation"],
        candidateCount: 1,
        validCandidateCount: 0,
    },
    error: { kind: "error", error: "boom" },
};

// The four kinds the FLOW is still working on (a card was posted, or a chooser/consent surface is
// up). Everything else is a dead end and must explain itself.
const SILENT_KINDS = [
    "ready",
    "ready_multi",
    "choose",
    "link_required",
    "app_connection_unavailable",
] as const;

describe("proposeFailureMessage", () => {
    for (const [kind, result] of Object.entries(EVERY_RESULT) as [
        ProposeResult["kind"],
        ProposeResult,
    ][]) {
        if ((SILENT_KINDS as readonly string[]).includes(kind)) {
            it(`says nothing for "${kind}" — the flow is not finished with it`, () => {
                expect(proposeFailureMessage(result)).toBeUndefined();
            });
            continue;
        }
        it(`always has something to say about "${kind}"`, () => {
            const message = proposeFailureMessage(result);
            expect(message).toEqual(expect.any(String));
            expect(message!.length).toBeGreaterThan(0);
        });
    }

    it('points a model-less user at where to get one, for "unavailable"', () => {
        expect(proposeFailureMessage({ kind: "unavailable", reason: "no runtime" })).toMatch(
            /on-device model/,
        );
    });

    it("tells a user to update when the native binary omitted the inference runtime", () => {
        const reason =
            "This OpenChat build does not include on-device inference. Update or reinstall OpenChat, then try again.";

        expect(proposeFailureMessage({ kind: "unavailable", reason })).toBe(reason);
    });

    it("NAMES the model that refused an image, so the user knows which one to replace", () => {
        const message = proposeFailureMessage({
            kind: "image_unsupported",
            modelId: "gemma-3-1b-it-q4",
        });
        expect(message).toContain("gemma-3-1b-it-q4");
        expect(message).toMatch(/doesn't support images/);
    });

    it("falls back to 'This model' when no model is selected at all", () => {
        expect(proposeFailureMessage({ kind: "image_unsupported" })).toMatch(
            /^This model doesn't support images/,
        );
    });

    it("distinguishes an app action that did not opt into images from a text-only model", () => {
        expect(proposeFailureMessage({ kind: "image_not_accepted" })).toBe(
            "This app action doesn't accept images. Choose an image-enabled action or send the details as text.",
        );
    });

    it("describes every local extraction failure without assuming app-defined semantics", () => {
        const expected = "The local reader couldn't determine a complete action from this message.";
        expect(proposeFailureMessage({ kind: "local_no_extraction", reason: "none" })).toBe(
            expected,
        );
        expect(proposeFailureMessage({ kind: "local_no_extraction", reason: "ambiguous" })).toBe(
            expected,
        );
    });

    it("reports an incomplete required field instead of claiming there was no action", () => {
        expect(
            proposeFailureMessage({
                kind: "incomplete_extraction",
                raw: '{"reading":200,"kind":"scheduled"}',
                missingFields: ["orientation"],
                candidateCount: 1,
                validCandidateCount: 0,
            }),
        ).toBe(
            "The model found an action, but required fields were missing or invalid: orientation. Nothing was posted.",
        );
    });

    it("reports partial multi extraction without posting only the surviving rows", () => {
        expect(
            proposeFailureMessage({
                kind: "incomplete_extraction",
                raw: "[]",
                missingFields: ["reading", "orientation"],
                candidateCount: 3,
                validCandidateCount: 1,
            }),
        ).toBe(
            "The model produced 3 action entries, but only 1 passed validation. Nothing was posted. Missing or invalid required fields: reading, orientation.",
        );
    });
});

const resolving = (result: ProposeResult) => vi.fn(async () => result);

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

// The propose flow, exercised with every dependency injected: no model, no Tauri, no component. It
// lived inside two hand-maintained ChatMessage trees until one was fixed and the other was not —
// nothing could reach it except a click, so nothing caught the difference.
function flowDeps(overrides: Partial<ProposeFlowDeps> = {}): {
    [K in keyof ProposeFlowDeps]: ReturnType<typeof vi.fn>;
} & ProposeFlowDeps {
    const deps = {
        preflight: vi.fn(async () => undefined),
        canInfer: vi.fn(() => true),
        requiresModelReadiness: vi.fn(() => true),
        promptForExtraction: vi.fn(() => undefined),
        propose: resolving({ kind: "ready", card: CARD, extracted: {} }),
        proposeCandidate: resolving({ kind: "ready", card: CARD, extracted: {} }),
        chooseCandidate: vi.fn(async () => undefined),
        linkApp: vi.fn(async () => false),
        promptReconnect: vi.fn(async () => undefined),
        resolveReconnectCandidate: vi.fn(async () => ({
            kind: "candidate" as const,
            candidate: CANDIDATE,
        })),
        toast: vi.fn(),
        ...overrides,
    };
    return deps as ReturnType<typeof flowDeps>;
}

describe("generic proposal context guard", () => {
    it("stops an account switch during model generation before candidates leave for app processing", async () => {
        attestationAvailableMock.mockReturnValue(true);
        acceleratedImageModelReadyMock.mockResolvedValue(true);
        inferenceCapabilityMock.mockReturnValue({
            available: true,
            runtimesSupported: ["llama-cpp"],
            selectedModalities: ["text", "image"],
        });
        const viewer = vi.spyOn(currentUserIdStore, "value", "get").mockReturnValue("viewer-one");
        const inference = deferred<InferenceResult>();
        inferOnDeviceMock.mockImplementationOnce(() => inference.promise);
        const action: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            responseSchema: {
                ...(DEF.responseSchema as object),
                "x-openchat-local-processor": { version: 1 },
            },
        };
        const app = { ...APP, manifest: { ...APP.manifest, actions: [action] } };
        const { client, calls } = proposalClient(app);
        try {
            const running = proposeAndPostCandidate(
                client,
                { chatId: { kind: "group_chat", groupId: "aaaaa-aa" } },
                {
                    kind: "image_content",
                    blobData: new Uint8Array([4, 2]),
                } as unknown as Parameters<typeof proposeAndPostCandidate>[2],
                { app, action, recipientKey: RECIPIENT },
            );
            await vi.waitFor(() => expect(inferOnDeviceMock).toHaveBeenCalledOnce());
            viewer.mockReturnValue("viewer-two");
            inference.resolve({ kind: "ok", text: '{"reading":42,"unit":"LUX"}' });
            await expect(running).resolves.toEqual({
                kind: "error",
                error: "proposal context changed",
            });
            expect(processWithAppMock).not.toHaveBeenCalled();
            expect(calls.createAiAppCardProvenance).not.toHaveBeenCalled();
            expect(calls.sendMessageWithContent).not.toHaveBeenCalled();
        } finally {
            viewer.mockRestore();
        }
    });

    it("stops after deferred inference when the captured account/context changes", async () => {
        attestationAvailableMock.mockReturnValue(true);
        const inference = deferred<InferenceResult>();
        inferOnDeviceMock.mockImplementationOnce(() => inference.promise);
        const { client, calls } = proposalClient(APP);
        let current = true;
        const running = proposeAndPost(
            client,
            { chatId: { kind: "group_chat", groupId: "aaaaa-aa" } },
            { kind: "text_content", text: "measured 20 LUX" },
            undefined,
            () => current,
        );
        await vi.waitFor(() => expect(inferOnDeviceMock).toHaveBeenCalledOnce());
        current = false;
        inference.resolve({ kind: "ok", text: JSON.stringify({ reading: 20, unit: "LUX" }) });
        await expect(running).resolves.toEqual({
            kind: "error",
            error: "proposal context changed",
        });
        expect(calls.createAiAppCardProvenance).not.toHaveBeenCalled();
        expect(calls.sendMessageWithContent).not.toHaveBeenCalled();
    });
});

describe("runProposeFlow", () => {
    it("bounds and sanitizes an unexpected proposal rejection before showing it", () => {
        const message = unexpectedProposalFailureMessage(
            new Error(`device\u0000lost?token=do-not-show&mode=test ${"x".repeat(400)}`),
        );

        expect(message).toContain("device lost?token=[redacted]&mode=test");
        expect(message).not.toContain("do-not-show");
        expect(message).not.toContain("\u0000");
        expect(message.endsWith("…")).toBe(true);
        expect(message.length).toBeLessThanOrEqual(
            "Action failed while preparing the action: ".length + 240,
        );
    });

    it("returns a retryable outcome on resolver rejection, then succeeds on an exact retry", async () => {
        const resolveSuggestedCandidate = vi
            .fn()
            .mockRejectedValueOnce(new Error("temporary directory failure"))
            .mockResolvedValueOnce({ kind: "candidate", candidate: CANDIDATE });
        const deps = flowDeps({ resolveSuggestedCandidate });
        await expect(runProposeFlow(deps)).resolves.toBe("retryable");
        expect(deps.toast).toHaveBeenCalledWith(
            "Action failed while preparing the action: temporary directory failure",
        );
        expect(deps.proposeCandidate).not.toHaveBeenCalled();

        await expect(runProposeFlow(deps)).resolves.toBe("posted");
        expect(deps.proposeCandidate).toHaveBeenCalledWith(CANDIDATE, undefined);
        expect(deps.propose).not.toHaveBeenCalled();
    });

    it.each([
        [
            "card verification",
            {
                kind: "error",
                error: "the app is unavailable or the card could not be verified",
            } satisfies ProposeResult,
        ],
        [
            "model availability",
            { kind: "unavailable", reason: "no runtime" } satisfies ProposeResult,
        ],
    ])("keeps an exact suggestion retryable after a handled %s failure", async (_label, result) => {
        const deps = flowDeps({
            resolveSuggestedCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: CANDIDATE,
            })),
            proposeCandidate: resolving(result),
        });

        await expect(runProposeFlow(deps)).resolves.toBe("retryable");
        expect(deps.toast).toHaveBeenCalledOnce();
    });

    it("does not retry when the reconnect surface is dismissed without explicit completion", async () => {
        const deps = flowDeps({
            resolveSuggestedCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: CANDIDATE,
            })),
            proposeCandidate: resolving({
                kind: "app_connection_unavailable",
                appId: APP.id,
                appRevision: APP.updated,
                actionId: DEF.name,
                preparedExtraction: { reading: 20 },
                preparedSource: {
                    modality: "image",
                    text: "report caption",
                    rulesAlreadyResolved: true,
                },
            }),
        });

        await expect(runProposeFlow(deps)).resolves.toBe("retryable");
        expect(deps.promptReconnect).toHaveBeenCalledOnce();
        expect(deps.promptReconnect).toHaveBeenCalledWith({
            appId: APP.id,
            appRevision: APP.updated,
            actionId: DEF.name,
        });
        expect(deps.proposeCandidate).toHaveBeenCalledOnce();
        expect(deps.resolveReconnectCandidate).not.toHaveBeenCalled();
        expect(deps.propose).not.toHaveBeenCalled();
        expect(deps.toast).not.toHaveBeenCalled();
    });

    it("reconnect reuses the first model result and never processes the source a second time", async () => {
        const refreshedCandidate = { ...CANDIDATE, recipientKeyVersion: 5n };
        const proposeCandidate = vi
            .fn()
            .mockResolvedValueOnce({
                kind: "app_connection_unavailable",
                appId: APP.id,
                appRevision: APP.updated,
                actionId: DEF.name,
                preparedExtraction: { reading: 20 },
                preparedSource: {
                    modality: "image",
                    text: "report caption",
                    rulesAlreadyResolved: true,
                },
            })
            .mockResolvedValueOnce({ kind: "ready", card: CARD, extracted: { reading: 20 } });
        const deps = flowDeps({
            canInfer: vi.fn(() => true),
            promptForExtraction: vi.fn(() => undefined),
            resolveSuggestedCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: CANDIDATE,
            })),
            proposeCandidate,
            promptReconnect: vi.fn(async () => ({
                retryCoordinates: {
                    appId: APP.id,
                    appRevision: APP.updated,
                    actionId: DEF.name,
                },
                previousKeyVersion: 4n,
            })),
            resolveReconnectCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: refreshedCandidate,
            })),
        });

        await expect(runProposeFlow(deps)).resolves.toBe("posted");
        expect(deps.promptReconnect).toHaveBeenCalledOnce();
        expect(deps.resolveReconnectCandidate).toHaveBeenCalledOnce();
        expect(proposeCandidate.mock.calls).toEqual([
            [CANDIDATE, undefined],
            [
                refreshedCandidate,
                { reading: 20 },
                {
                    modality: "image",
                    text: "report caption",
                    rulesAlreadyResolved: true,
                },
            ],
        ]);
        expect(deps.toast).not.toHaveBeenCalled();
    });

    it("rejects a newer app revision instead of replaying an extraction under changed semantics", async () => {
        const deps = flowDeps({
            propose: resolving({
                kind: "app_connection_unavailable",
                appId: APP.id,
                appRevision: APP.updated,
                actionId: DEF.name,
                preparedExtraction: { reading: 20 },
                preparedSource: {
                    modality: "image",
                    text: "report caption",
                    rulesAlreadyResolved: true,
                },
            }),
            promptReconnect: vi.fn(async () => ({
                retryCoordinates: {
                    appId: APP.id,
                    appRevision: APP.updated + 1n,
                    actionId: DEF.name,
                },
                previousKeyVersion: 4n,
            })),
        });

        await expect(runProposeFlow(deps)).resolves.toBe("retryable");
        expect(deps.propose).toHaveBeenCalledOnce();
        expect(deps.resolveReconnectCandidate).not.toHaveBeenCalled();
        expect(deps.proposeCandidate).not.toHaveBeenCalled();
        expect(deps.toast).toHaveBeenCalledWith("aiApps.reconnectChanged");
    });

    it("runs a two-pass image model only once across an app reconnect", async () => {
        attestationAvailableMock.mockReturnValue(true);
        acceleratedImageModelReadyMock.mockResolvedValue(true);
        inferenceCapabilityMock.mockReturnValue({
            available: true,
            runtimesSupported: ["llama-cpp"],
            selectedModalities: ["image"],
            selectedModelId: "qwen3-vl-2b-instruct-q4",
        });
        inferOnDeviceMock
            .mockResolvedValueOnce({ kind: "ok", text: '{"reading":12345}' })
            .mockResolvedValueOnce({ kind: "ok", text: '{"date":"2026-08-14"}' });

        const imageDef: AiActionDefinition = {
            ...DEF,
            acceptsImage: true,
            rules: [{ kind: "from_message", field: "annotation", maxLength: 200 }],
            responseSchema: {
                type: "object",
                "x-openchat-image-prompt-template": {
                    version: 1,
                    template: "Read reading only.",
                    includeRuleGuidance: false,
                },
                "x-openchat-image-focused-passes": {
                    version: 1,
                    primaryFields: ["reading"],
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
                    reading: { type: "number", minimum: 0.005 },
                    date: { type: "string", format: "date" },
                    annotation: { type: "string", maxLength: 200 },
                },
                required: ["reading"],
            },
        };
        const imageApp = { ...APP, manifest: { ...APP.manifest, actions: [imageDef] } };
        const imageCandidate: AiActionCandidate = {
            app: imageApp,
            action: imageDef,
            recipientKey: RECIPIENT,
            recipientKeyVersion: 4n,
        };
        const refreshedCandidate: AiActionCandidate = {
            ...imageCandidate,
            recipientKey: `${RECIPIENT}refreshed`,
            recipientKeyVersion: 5n,
        };
        const createAiAppCardProvenance = vi
            .fn()
            .mockResolvedValueOnce({ kind: "app_unavailable" as const })
            .mockResolvedValueOnce({
                kind: "success" as const,
                provenance: new Uint8Array([7]),
                expiresAt: BigInt(Date.now() + 60_000),
            });
        const sendMessageWithContent = vi.fn(async () => ({ kind: "success" }));
        const client = {
            createAiAppCardProvenance,
            sendMessageWithContent,
        } as unknown as OpenChat;
        const messageContext: MessageContext = {
            chatId: { kind: "group_chat", groupId: "aaaaa-aa" },
        };
        const imageContent = {
            kind: "image_content",
            blobData: new Uint8Array([1, 2, 3]),
            caption: "authoritative report caption",
        } as unknown as Parameters<typeof proposeAndPostCandidate>[2];
        const proposeCandidate = vi.fn((candidate, extraction, source) =>
            proposeAndPostCandidate(
                client,
                messageContext,
                imageContent,
                candidate,
                extraction,
                undefined,
                undefined,
                source,
            ),
        );
        const deps = flowDeps({
            resolveSuggestedCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: imageCandidate,
            })),
            proposeCandidate,
            promptReconnect: vi.fn(async () => ({
                retryCoordinates: {
                    appId: imageApp.id,
                    appRevision: imageApp.updated,
                    actionId: imageDef.name,
                },
                previousKeyVersion: 4n,
            })),
            resolveReconnectCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: refreshedCandidate,
            })),
        });

        browserImageActionMode.set("model_only");
        try {
            await expect(runProposeFlow(deps)).resolves.toBe("posted");
        } finally {
            browserImageActionMode.set("model_only");
        }

        expect(inferOnDeviceMock).toHaveBeenCalledTimes(2);
        expect(proposeCandidate.mock.calls).toEqual([
            [imageCandidate, undefined],
            [
                refreshedCandidate,
                {
                    reading: 12345,
                    date: "2026-08-14",
                    annotation: "authoritative report caption",
                },
                {
                    modality: "image",
                    text: "authoritative report caption",
                    rulesAlreadyResolved: true,
                },
            ],
        ]);
        expect(createAiAppCardProvenance).toHaveBeenCalledTimes(2);
        expect(sendMessageWithContent).toHaveBeenCalledOnce();
        expect(deps.promptReconnect).toHaveBeenCalledOnce();
        expect(deps.toast).not.toHaveBeenCalled();
    });

    it("never loops or opens a second modal when the one retry remains unavailable", async () => {
        const reconnectResult = {
            kind: "app_connection_unavailable" as const,
            appId: APP.id,
            appRevision: APP.updated,
            actionId: DEF.name,
            preparedExtraction: { reading: 20 },
            preparedSource: {
                modality: "image",
                text: "report caption",
                rulesAlreadyResolved: true,
            },
        } satisfies ProposeResult;
        const refreshedCandidate = { ...CANDIDATE, recipientKeyVersion: 5n };
        const deps = flowDeps({
            resolveSuggestedCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: CANDIDATE,
            })),
            proposeCandidate: vi.fn(async () => reconnectResult),
            promptReconnect: vi.fn(async () => ({
                retryCoordinates: {
                    appId: APP.id,
                    appRevision: APP.updated,
                    actionId: DEF.name,
                },
                previousKeyVersion: 4n,
            })),
            resolveReconnectCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: refreshedCandidate,
            })),
        });

        await expect(runProposeFlow(deps)).resolves.toBe("retryable");
        expect(deps.promptReconnect).toHaveBeenCalledOnce();
        expect(deps.resolveReconnectCandidate).toHaveBeenCalledOnce();
        expect(deps.proposeCandidate).toHaveBeenCalledTimes(2);
        expect(deps.toast).toHaveBeenCalledWith("aiApps.reconnectStillUnavailable");
    });

    it("refuses retry when Check connection did not produce a higher binding epoch", async () => {
        const deps = flowDeps({
            resolveSuggestedCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: CANDIDATE,
            })),
            proposeCandidate: resolving({
                kind: "app_connection_unavailable",
                appId: APP.id,
                appRevision: APP.updated,
                actionId: DEF.name,
                preparedExtraction: { reading: 20 },
                preparedSource: {
                    modality: "image",
                    text: "report caption",
                    rulesAlreadyResolved: true,
                },
            }),
            promptReconnect: vi.fn(async () => ({
                retryCoordinates: {
                    appId: APP.id,
                    appRevision: APP.updated,
                    actionId: DEF.name,
                },
                previousKeyVersion: 4n,
            })),
            resolveReconnectCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: CANDIDATE,
            })),
        });

        await expect(runProposeFlow(deps)).resolves.toBe("retryable");
        expect(deps.proposeCandidate).toHaveBeenCalledOnce();
        expect(deps.toast).toHaveBeenCalledWith("aiApps.reconnectNotAdvanced");
    });

    it("keeps the suggestion retryable when the reconnect surface cannot be opened", async () => {
        const deps = flowDeps({
            resolveSuggestedCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: CANDIDATE,
            })),
            proposeCandidate: resolving({
                kind: "app_connection_unavailable",
                appId: APP.id,
                appRevision: APP.updated,
                actionId: DEF.name,
                preparedExtraction: { reading: 20 },
                preparedSource: {
                    modality: "image",
                    text: "report caption",
                    rulesAlreadyResolved: true,
                },
            }),
            promptReconnect: vi.fn(async () => {
                throw new Error("directory lookup failed");
            }),
        });

        await expect(runProposeFlow(deps)).resolves.toBe("retryable");
        expect(deps.promptReconnect).toHaveBeenCalledOnce();
        expect(deps.proposeCandidate).toHaveBeenCalledOnce();
        expect(deps.propose).not.toHaveBeenCalled();
        expect(deps.toast).toHaveBeenCalledWith(
            "Action failed while preparing the action: directory lookup failed",
        );
    });

    it("runs only the exact re-resolved suggested candidate and never the generic chooser", async () => {
        const deps = flowDeps({
            resolveSuggestedCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: CANDIDATE,
            })),
        });
        await runProposeFlow(deps);
        expect(deps.proposeCandidate).toHaveBeenCalledWith(CANDIDATE, undefined);
        expect(deps.propose).not.toHaveBeenCalled();
        expect(deps.chooseCandidate).not.toHaveBeenCalled();
    });

    it("fails a stale exact suggestion closed without falling back to any candidate", async () => {
        const deps = flowDeps({
            resolveSuggestedCandidate: vi.fn(async () => ({ kind: "stale" as const })),
        });
        await runProposeFlow(deps);
        expect(deps.toast).toHaveBeenCalledWith("aiApps.autoPropose.stale");
        expect(deps.canInfer).not.toHaveBeenCalled();
        expect(deps.propose).not.toHaveBeenCalled();
        expect(deps.proposeCandidate).not.toHaveBeenCalled();
        expect(deps.chooseCandidate).not.toHaveBeenCalled();
    });

    it("re-resolves the same exact target after linking instead of selecting another action", async () => {
        const resolveSuggestedCandidate = vi
            .fn()
            .mockResolvedValueOnce({ kind: "link_required", app: APP })
            .mockResolvedValueOnce({ kind: "candidate", candidate: CANDIDATE });
        const deps = flowDeps({
            resolveSuggestedCandidate,
            linkApp: vi.fn(async () => true),
        });
        await runProposeFlow(deps);
        expect(resolveSuggestedCandidate).toHaveBeenCalledTimes(2);
        expect(deps.linkApp).toHaveBeenCalledWith(APP);
        expect(deps.proposeCandidate).toHaveBeenCalledWith(CANDIDATE, undefined);
        expect(deps.propose).not.toHaveBeenCalled();
    });

    it("account switch during preflight stops before resolve, inference, proposal, or send", async () => {
        const phase = deferred<AiActionPreflightBlocker | undefined>();
        let current = true;
        const deps = flowDeps({
            preflight: vi.fn(() => phase.promise),
            stillCurrent: () => current,
            resolveSuggestedCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: CANDIDATE,
            })),
        });
        const running = runProposeFlow(deps);
        current = false;
        phase.resolve(undefined);
        await running;
        expect(deps.resolveSuggestedCandidate).not.toHaveBeenCalled();
        expect(deps.canInfer).not.toHaveBeenCalled();
        expect(deps.proposeCandidate).not.toHaveBeenCalled();
        expect(deps.propose).not.toHaveBeenCalled();
    });

    it("account switch during exact re-resolution stops before inference or proposal", async () => {
        const phase = deferred<SuggestedAiActionResolution>();
        let current = true;
        const deps = flowDeps({
            stillCurrent: () => current,
            resolveSuggestedCandidate: vi.fn(() => phase.promise),
        });
        const running = runProposeFlow(deps);
        await vi.waitFor(() => expect(deps.resolveSuggestedCandidate).toHaveBeenCalledOnce());
        current = false;
        phase.resolve({ kind: "candidate", candidate: CANDIDATE });
        await running;
        expect(deps.canInfer).not.toHaveBeenCalled();
        expect(deps.proposeCandidate).not.toHaveBeenCalled();
        expect(deps.propose).not.toHaveBeenCalled();
    });

    it("account switch during readiness stops before candidate inference/proposal", async () => {
        const phase = deferred<boolean>();
        let current = true;
        const deps = flowDeps({
            stillCurrent: () => current,
            resolveSuggestedCandidate: vi.fn(async () => ({
                kind: "candidate" as const,
                candidate: CANDIDATE,
            })),
            canInfer: vi.fn(() => phase.promise),
        });
        const running = runProposeFlow(deps);
        await vi.waitFor(() => expect(deps.canInfer).toHaveBeenCalledOnce());
        current = false;
        phase.resolve(true);
        await running;
        expect(deps.proposeCandidate).not.toHaveBeenCalled();
        expect(deps.propose).not.toHaveBeenCalled();
    });

    it("reports an attestation blocker before model checks, prompts, or proposal work", async () => {
        const blocker: ProposeResult = {
            kind: "actions_unavailable",
            unavailable: [{ app: APP, reason: "content_attestation_unavailable" }],
        };
        const deps = flowDeps({
            preflight: vi.fn(async () => blocker),
            canInfer: vi.fn(() => false),
        });
        await runProposeFlow(deps);
        expect(deps.toast).toHaveBeenCalledWith(
            "New app actions are not enabled for this OpenChat build.",
        );
        expect(deps.canInfer).not.toHaveBeenCalled();
        expect(deps.promptForExtraction).not.toHaveBeenCalled();
        expect(deps.propose).not.toHaveBeenCalled();
    });

    it("with no model and nothing supplied, TELLS the user instead of doing nothing", async () => {
        const deps = flowDeps({ canInfer: vi.fn(() => false) });
        await runProposeFlow(deps);
        expect(deps.toast).toHaveBeenCalledWith(NO_MODEL_MESSAGE);
        expect(deps.propose).not.toHaveBeenCalled();
    });

    it("skips model readiness for an OCR-only image proposal", async () => {
        const deps = flowDeps({
            canInfer: vi.fn(async () => ({ available: false })),
            requiresModelReadiness: vi.fn(() => false),
        });

        await runProposeFlow(deps);

        expect(deps.canInfer).not.toHaveBeenCalled();
        expect(deps.propose).toHaveBeenCalledOnce();
        expect(deps.toast).not.toHaveBeenCalled();
    });

    it("awaits native readiness and preserves an update-required reason", async () => {
        const reason =
            "This OpenChat build does not include on-device inference. Update or reinstall OpenChat, then try again.";
        const deps = flowDeps({
            canInfer: vi.fn(async () => ({ available: false, reason })),
        });

        await runProposeFlow(deps);

        expect(deps.toast).toHaveBeenCalledWith(reason);
        expect(deps.propose).not.toHaveBeenCalled();
    });

    it("browser model-only image preflight preserves stale-Qwen update guidance", async () => {
        const reason =
            "The selected Qwen3-VL 2B model needs an update. Open On-device models and tap Retry download.";
        const deps = flowDeps({
            canInfer: vi.fn(async () => ({ available: false, reason })),
            requiresModelReadiness: vi.fn(() => true),
        });

        await runProposeFlow(deps);

        expect(deps.toast).toHaveBeenCalledWith(reason);
        expect(deps.propose).not.toHaveBeenCalled();
    });

    it("explains the missing model when the manual seam is inactive", async () => {
        // Undefined means the query-only seam is inactive. An explicit Cancel has its own sentinel
        // and is tested separately as a quiet user decision.
        const deps = flowDeps({
            canInfer: vi.fn(() => false),
            promptForExtraction: vi.fn(() => undefined),
        });
        await runProposeFlow(deps);
        expect(deps.toast).toHaveBeenCalledWith(NO_MODEL_MESSAGE);
        expect(deps.propose).not.toHaveBeenCalled();
    });

    it("with no model but an extraction supplied, proposes with it and stays quiet", async () => {
        const deps = flowDeps({
            canInfer: vi.fn(() => false),
            promptForExtraction: vi.fn(() => ({ reading: 20 })),
        });
        await runProposeFlow(deps);
        expect(deps.propose).toHaveBeenCalledWith({ reading: 20 });
        expect(deps.toast).not.toHaveBeenCalled();
    });

    it("checks the inert manual seam before using an available model", async () => {
        const deps = flowDeps({ canInfer: vi.fn(() => true) });
        await runProposeFlow(deps);
        expect(deps.promptForExtraction).toHaveBeenCalledOnce();
        expect(deps.propose).toHaveBeenCalled();
    });

    it("lets the explicit manual test seam override an available model deterministically", async () => {
        const deps = flowDeps({
            canInfer: vi.fn(() => true),
            promptForExtraction: vi.fn(() => ({ reading: 20 })),
        });
        await runProposeFlow(deps);
        expect(deps.propose).toHaveBeenCalledWith({ reading: 20 });
        expect(deps.canInfer).not.toHaveBeenCalled();
        expect(deps.toast).not.toHaveBeenCalled();
    });

    it("stops without inference or a card when the manual QC prompt is cancelled", async () => {
        const deps = flowDeps({
            canInfer: vi.fn(() => true),
            promptForExtraction: vi.fn(
                (): ManualExtractionPromptResult => MANUAL_EXTRACTION_CANCELLED,
            ),
        });
        await expect(runProposeFlow(deps)).resolves.toBe("retryable");
        expect(deps.propose).not.toHaveBeenCalled();
        expect(deps.canInfer).not.toHaveBeenCalled();
        expect(deps.toast).not.toHaveBeenCalled();
    });

    it("an 'unavailable' propose reaches the toast even when the retry prompt gives nothing", async () => {
        const deps = flowDeps({
            propose: resolving({ kind: "unavailable", reason: "no runtime" }),
            promptForExtraction: vi.fn(() => undefined),
        });
        await runProposeFlow(deps);
        expect(deps.toast).toHaveBeenCalledWith(NO_MODEL_MESSAGE);
    });

    it("an explicit Cancel at the direct unavailable retry stops without another proposal", async () => {
        const promptForExtraction = vi
            .fn<() => ManualExtractionPromptResult>()
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce(MANUAL_EXTRACTION_CANCELLED);
        const deps = flowDeps({
            propose: resolving({ kind: "unavailable", reason: "no runtime" }),
            promptForExtraction,
        });
        await runProposeFlow(deps);
        expect(promptForExtraction).toHaveBeenCalledTimes(2);
        expect(deps.propose).toHaveBeenCalledOnce();
        expect(deps.toast).not.toHaveBeenCalled();
    });

    // THE branch the mobile tree still got wrong: after the chooser, an `unavailable` whose retry
    // prompt supplies nothing used to `return` — so a user with two candidate actions and no model
    // picked one and was told nothing at all.
    it("a CHOSEN candidate that comes back 'unavailable' still explains itself", async () => {
        const deps = flowDeps({
            propose: resolving({ kind: "choose", candidates: [CANDIDATE] }),
            chooseCandidate: vi.fn(async () => CANDIDATE),
            proposeCandidate: resolving({ kind: "unavailable", reason: "no runtime" }),
            promptForExtraction: vi.fn(() => undefined),
        });
        await runProposeFlow(deps);
        expect(deps.chooseCandidate).toHaveBeenCalledWith([CANDIDATE]);
        expect(deps.toast).toHaveBeenCalledWith(NO_MODEL_MESSAGE);
    });

    it("an explicit Cancel at the chosen-candidate retry stops without another proposal", async () => {
        const promptForExtraction = vi
            .fn<() => ManualExtractionPromptResult>()
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce(MANUAL_EXTRACTION_CANCELLED);
        const deps = flowDeps({
            propose: resolving({ kind: "choose", candidates: [CANDIDATE] }),
            chooseCandidate: vi.fn(async () => CANDIDATE),
            proposeCandidate: resolving({ kind: "unavailable", reason: "no runtime" }),
            promptForExtraction,
        });
        await runProposeFlow(deps);
        expect(promptForExtraction).toHaveBeenCalledTimes(2);
        expect(deps.proposeCandidate).toHaveBeenCalledOnce();
        expect(deps.toast).not.toHaveBeenCalled();
    });

    it("backing out of the chooser is a choice — no candidate runs, nothing is claimed", async () => {
        const deps = flowDeps({
            propose: resolving({ kind: "choose", candidates: [CANDIDATE] }),
            chooseCandidate: vi.fn(async () => undefined),
        });
        await expect(runProposeFlow(deps)).resolves.toBe("retryable");
        expect(deps.proposeCandidate).not.toHaveBeenCalled();
        expect(deps.toast).not.toHaveBeenCalled();
    });

    it("re-proposes with the SAME extraction once the app is linked", async () => {
        const propose = vi
            .fn()
            .mockResolvedValueOnce({ kind: "link_required", app: APP })
            .mockResolvedValueOnce({ kind: "ready", card: CARD, extracted: {} });
        const deps = flowDeps({
            canInfer: vi.fn(() => false),
            promptForExtraction: vi.fn(() => ({ reading: 20 })),
            propose,
            linkApp: vi.fn(async () => true),
        });
        await runProposeFlow(deps);
        expect(deps.linkApp).toHaveBeenCalledWith(APP);
        expect(propose.mock.calls).toEqual([[{ reading: 20 }], [{ reading: 20 }]]);
        expect(deps.toast).not.toHaveBeenCalled();
    });

    it("a refused link stops the flow — the consent sheet already said its piece", async () => {
        const deps = flowDeps({
            propose: resolving({ kind: "link_required", app: APP }),
            linkApp: vi.fn(async () => false),
        });
        await runProposeFlow(deps);
        expect(deps.propose).toHaveBeenCalledTimes(1);
        expect(deps.toast).not.toHaveBeenCalled();
    });
});

// Keep only the cross-tree wiring check here. The parser, proposal decisions, and concurrent
// single-flight lifecycle are behavior-tested as pure utilities above and in singleFlight.spec.ts.
describe("both ChatMessage trees run the SHARED propose flow", () => {
    const TREES = {
        classic: "../components/home/ChatMessage.svelte",
        mobile: "../components_mobile/home/ChatMessage.svelte",
    };

    for (const [tree, relative] of Object.entries(TREES)) {
        it(`${tree}: delegates decisions, parsing, and lifecycle to shared utilities`, () => {
            const src = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
            expect(src).toContain("runProposeFlow(");
            expect(src).toContain("proposeCandidate: (candidate, extraction, source)");
            expect(src).toMatch(/onPhase,\s+source,\s+Number\(timestamp\),\s+\),/u);
            expect(src).toContain("const runAiActionSingleFlight = createSingleFlight(");
            expect(src).toContain("function runAiActionHandler(suggested?: AutoProposeSuggestion)");
            expect(src).toContain("parseManualExtractionPrompt(");
            expect(src).toContain("{#each autoProposeSuggestionList as suggestion");
            expect(src).toContain("autoProposeSuggestionActionKey(suggestion)");
            expect(src).toContain('outcome === "posted"');
            expect(src).not.toContain('outcome === "consumed"');
            expect(src).toContain("disabled={proposing}");
            expect(src).toContain("busy={");
            expect(src).toContain("proposing && !activeAutoProposeSuggestionVisible");
            expect(src).toContain("autoProposeSuggestionList.some(");
            expect(src).toContain("title={autoProposeSuggestionLabel(");
            expect(src).toContain("autoProposeSuggestionList,");
            expect(src).toContain(
                "async function proposeSuggestedAiAction(suggestion: AutoProposeSuggestion)",
            );
            expect(src).toContain("onPropose={() => proposeSuggestedAiAction(suggestion)}");
            expect(src).toContain("resolveSuggestedAiAction(");
            expect(src).toContain("autoProposeSuggestionStillCurrent(suggested)");
            expect(src).toContain("const outcome = await runAiActionHandler(suggestion)");
            expect(src).toContain("suggested?: AutoProposeSuggestion");
            expect(src).toContain("const capturedContext = {");
            expect(src).toContain("const capturedViewer = $currentUserIdStore");
            expect(src).toContain("currentAutoProposeSessionEpoch() === capturedSessionEpoch");
            expect(src.indexOf("await runAiActionHandler(suggestion)")).toBeLessThan(
                src.indexOf(
                    "dismissAutoProposeSuggestion(",
                    src.indexOf("await runAiActionHandler"),
                ),
            );
            // Deciding for itself whether a model exists is how a tree starts owning the flow again.
            expect(src).not.toContain("canInferOnDevice()");
            expect(src).toContain("aiActionProposalReadiness(");
            expect(src).toContain('capturedContent.kind === "image_content"');
            expect(src).toContain("usesWebInferenceRuntime()");
            expect(src).toContain("!usesWebInferenceRuntime()");
            expect(src).not.toContain("isNativeClient()");
            expect(src).not.toContain("canInfer: onDeviceInferenceReadiness");
            // A second copy of the message is a second thing to forget to fix.
            expect(src).not.toContain("No on-device model is ready");
        });
    }

    it("both chips separate active progress from disabled sibling actions", () => {
        for (const relative of [
            "../components/home/AutoProposeChip.svelte",
            "../components_mobile/home/AutoProposeChip.svelte",
        ]) {
            const src = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
            expect(src).toContain("disabled?: boolean;");
            expect(src).toContain("!busy && !disabled && onPropose()");
            expect(src).toContain("disabled={busy || disabled}");
        }
    });

    it("propagates exact thread-root wrapper identity through both render trees and previews", () => {
        for (const relative of [
            "../components/home/thread/Thread.svelte",
            "../components_mobile/home/thread/Thread.svelte",
        ]) {
            const src = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
            expect(src).toContain("{@const isThreadRoot = evt === rootEvent}");
            expect(src).toContain("supportsEdit={!isThreadRoot}");
            expect(src).toContain("{isThreadRoot}");
        }
        for (const relative of [
            "../components/home/thread/ThreadPreview.svelte",
            "../components_mobile/home/thread/ThreadPreview.svelte",
        ]) {
            const src = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
            expect(src).toContain("threadRootMessage={thread.rootMessage.event}");
            expect(src).toContain("isThreadRoot");
        }
    });

    it("classic renders a real action chooser without requiring the manual-QC query", () => {
        const src = readFileSync(fileURLToPath(new URL(TREES.classic, import.meta.url)), "utf8");
        expect(src).toContain("let aiActionChooser = $state");
        expect(src).toContain("function chooseCandidate(");
        expect(src).toContain("chooseCandidate,");
        expect(src).toContain("{#if aiActionChooser !== undefined}");
        expect(src).toContain("<Button fill secondary onClick={() => closeChooser(candidate)}>");
        expect(src).toContain("closeChooser(candidate)");
        expect(src).not.toContain("function promptForCandidate(");
    });

    it("classic exposes Propose only for confirmed active successful messages", () => {
        const menuPath = "../components/home/ChatMessageMenu.svelte";
        const src = readFileSync(fileURLToPath(new URL(menuPath, import.meta.url)), "utf8");

        expect(src).toContain(
            "{#if onRunAiAction !== undefined && confirmed && !inert && !failed}",
        );
        expect(src).toContain("<MenuItem onclick={() => onRunAiAction()}> ".trim());
        expect(src).not.toContain("<MenuItem onclick={onRunAiAction}>");
    });

    it("mobile keeps a visible working surface after the suggestion chip is dismissed", () => {
        const src = readFileSync(fileURLToPath(new URL(TREES.mobile, import.meta.url)), "utf8");
        expect(src).toContain("proposing && !activeAutoProposeSuggestionVisible");
        expect(src).toContain("resourceKey={autoProposeBusyResourceKey}");
    });

    it("passes the authoritative message timestamp through both action UI trees", () => {
        for (const relative of [TREES.classic, TREES.mobile]) {
            const src = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
            expect(src).toContain("Number(timestamp)");
            expect(src).toMatch(/proposeAndPost\([\s\S]*?Number\(timestamp\)[\s\S]*?\)/u);
            expect(src).toMatch(/proposeAndPostCandidate\([\s\S]*?Number\(timestamp\)[\s\S]*?\)/u);
        }
    });

    it("mobile icon actions expose their localized menu label to assistive technology", () => {
        const optionsPath = "../components_mobile/home/ChatMessageOptions.svelte";
        const iconButtonPath = "../../../component-lib/src/components/buttons/IconButton.svelte";
        const options = readFileSync(fileURLToPath(new URL(optionsPath, import.meta.url)), "utf8");
        const iconButton = readFileSync(
            fileURLToPath(new URL(iconButtonPath, import.meta.url)),
            "utf8",
        );

        expect(iconButton).toContain("ariaLabel?: string");
        expect(iconButton).toContain("aria-label={ariaLabel}");
        expect(options).toContain("ariaLabel={$_(menuItemTitleToKey(title))}");
    });
});
