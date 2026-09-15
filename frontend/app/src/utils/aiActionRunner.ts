// App-level orchestrator for the in-OpenChat AI-action runner.
//
// Ties together the three verified pieces: bounded AI-app lookup, the on-device model
// (inferOnDevice), and the generic runner (runAiAction, in openchat-shared). Given a chat message's content,
// it runs the offered action on-device and returns a proposable confirm-card. The caller posts the card
// with client.sendMessageWithContent. On confirm, OpenChat resolves the card's exact published app
// revision, action, inbox and authoritative chat-member keys before depositing. Nothing here is
// app-specific.
//
// Groups/channels offer the bounded directory apps enabled by their admins. Direct chats have no
// admin enablement set: they offer only exact published per-user-key apps paired by this user, while
// an unpaired published app may request the one-time link flow.

import {
    buildActionCardContent,
    buildMultiActionCardContent,
    MAX_AI_ACTION_CANDIDATES,
    missingRequired,
    multiActionCardBoundsError,
    privateImageVerifierConfig,
    postProcessAiActionCandidate,
    random64,
    runAiAction,
    type AiActionDefinition,
    type AiActionPrivateImageVerifierConfig,
    type AiAppCardContentV1,
    type AiAppRegistration,
    type ModelModality,
    type PrivateImageEvidence,
    type RunAiActionResult,
} from "@shared";
import type { ChatIdentifier, MessageContent, MessageContext, OpenChat } from "@client";
import { currentUserIdStore } from "@client";
import {
    browserUsesLocalReaderOnly,
    browserUsesModelOnly,
    browserUsesModelWithLocalVerification,
} from "../stores/browserImageActionMode";
import { appContentAttestationAvailable } from "./aiActionAvailability";
import { isDirectChatCardApp, loadDirectChatAiApps } from "./aiAppDirectChat";
import type { AiAppReconnectCompletion, AiAppReconnectRequest } from "./aiAppReconnect";
import { cardSurfaceOpening } from "./aiAppSurfaces";
import {
    extractLocalActionForPrivateVerification,
    localActionExtractorSupports,
    localImageEvidenceExtractorSupports,
    type LocalActionExtractorResult,
} from "./localActionExtractor";
import {
    processWithApp,
    type AppProcessorInput,
    type AppProcessorResult,
} from "./appLocalProcessor";
import {
    inferOnDevice,
    inferOnDeviceTextOnlyNoProjector,
    onDeviceInferenceCapability,
    usesWebInferenceRuntime,
} from "./onDeviceInference";
import { localAudioInput } from "./localAudioInput";
import { localImageBytes, type ImagePageLocation } from "./localImageInput";
import {
    browserImageModelFirstReadiness,
    browserTextModelReadiness,
    webImageInferenceEvidence,
    webModelCatalogId,
} from "./webInference";
import {
    isSemanticDuplicateBrowserImageResult,
    type BrowserModelImageEvidence,
} from "./imageSemanticDuplicateGuard";

const MAX_AI_ACTION_ENABLED_APPS = 32;
const GPU_ONLY_IMAGE_UNAVAILABLE_MESSAGE =
    "Accelerated image inference is unavailable for the selected model on this device. The local reader is disabled.";
const LOCAL_VERIFICATION_FAILED_MESSAGE =
    "The model result could not be verified against the image. No action was created.";
const LOCAL_READER_VERIFICATION_FAILED_MESSAGE =
    "The local image reader could not produce complete evidence, so model verification was not run. No action was created.";
const PROVENANCE_FAILURE_MESSAGES = {
    invalid_request:
        "The app rejected this card's verified content. No action was posted; refresh OpenChat and retry.",
    backend_error: "The card verification service failed. Please retry in a moment.",
    malformed_success:
        "OpenChat received an invalid card verification response. No action was posted; please retry.",
    transport_error:
        "OpenChat could not reach the card verification service. Check your connection and retry.",
    offline: "OpenChat is offline. Reconnect, then retry the action.",
} as const;
function readyCandidates(
    result: RunAiActionResult | ProposeResult | undefined,
): Record<string, unknown>[] | undefined {
    if (result?.kind === "ready") return [result.extracted];
    if (result?.kind === "ready_multi") return result.extracted;
    return undefined;
}

function verifiedImageCandidateMatches(
    model: Record<string, unknown>,
    local: Record<string, unknown>,
    verifier: AiActionPrivateImageVerifierConfig,
): boolean {
    for (const field of verifier.requiredFields) {
        if (!Object.hasOwn(model, field) || !Object.hasOwn(local, field)) return false;
        if (model[field] !== local[field]) return false;
    }
    return verifier.optionalFields.every(
        (field) =>
            !Object.hasOwn(model, field) ||
            (Object.hasOwn(local, field) && model[field] === local[field]),
    );
}

export function reconcileModelWithLocalResult(
    vision: RunAiActionResult,
    evidenceDecoded: ProposeResult | undefined,
    responseSchema?: object,
): ProposeResult {
    const verifier = privateImageVerifierConfig(responseSchema);
    if (verifier === undefined) {
        return { kind: "error", error: LOCAL_VERIFICATION_FAILED_MESSAGE };
    }
    const evidenceCandidates = readyCandidates(evidenceDecoded);
    if (evidenceCandidates === undefined) {
        return { kind: "error", error: LOCAL_VERIFICATION_FAILED_MESSAGE };
    }

    if (vision.kind === "unavailable" || vision.kind === "error") return vision;
    if (vision.kind !== "ready" && vision.kind !== "ready_multi") {
        return { kind: "error", error: LOCAL_VERIFICATION_FAILED_MESSAGE };
    }

    const visionCandidates = readyCandidates(vision)!;
    if (
        visionCandidates.length !== evidenceCandidates.length ||
        !visionCandidates.every((candidate, index) =>
            verifiedImageCandidateMatches(candidate, evidenceCandidates[index], verifier),
        )
    ) {
        return { kind: "error", error: LOCAL_VERIFICATION_FAILED_MESSAGE };
    }
    // The OCR-evidence decoder is app-prompted and may recover an optional app-owned label that the
    // vision pass omitted. Once every vision claim covered by the verifier contract agrees, preserve
    // that evidence-decoded object for the app's own private post-processing instead of silently
    // throwing its label away. A conflicting vision claim has already failed closed above.
    return evidenceDecoded!;
}

// A directory app's action offered in a chat, with the delivery key already resolved. For a
// per-user-keys app this is the proposing user's own registered key (from my_ai_app_keys);
// otherwise it is the action's own consumer key when it declares one, else the app-level key from
// the manifest. Pairs with no resolvable key are not runnable and are never surfaced.
export interface AiActionCandidate {
    app: AiAppRegistration;
    action: AiActionDefinition;
    recipientKey: string;
    // Present for a per-user-key app. It is caller-local proposal metadata only and is never added
    // to the posted card; recovery uses it to verify that a freshly resolved binding epoch advanced.
    recipientKeyVersion?: bigint;
    // Legacy sender-routing fields retained for wire compatibility. Current canisters ignore these
    // and resolve recipients/inbox from the vouched manifest and authoritative membership at confirm.
    additionalRecipientKeys?: string[];
    inboxCanisterId?: string;
}

/** Public immutable coordinates retained by an auto-propose suggestion (never private type data). */
export interface AiActionCoordinates {
    appId: number;
    appRevision: bigint;
    actionId: string;
}

export type SuggestedAiActionResolution =
    | { kind: "candidate"; candidate: AiActionCandidate }
    | { kind: "link_required"; app: AiAppRegistration }
    | { kind: "stale" };

export type AiActionUnavailableReason =
    | "missing_card_surface"
    | "missing_inbox_route"
    | "content_attestation_unavailable";

export interface AiActionUnavailable {
    app: AiAppRegistration;
    reason: AiActionUnavailableReason;
}

export type ProposeResult =
    | RunAiActionResult
    // No runnable or linkable AI app is available in this chat.
    | { kind: "no_actions" }
    // The message content isn't something the runner can extract from.
    | { kind: "unsupported_content" }
    // A schema-opted source reader ran without a generative model but could not safely produce a
    // complete action. Keep this distinct from model no_extraction.
    | {
          kind: "local_no_extraction";
          reason: "ambiguous" | "none";
      }
    // The message IS an image but the SELECTED MODEL has no image modality. The remedy is the same
    // in every client — pick an image-capable model — so this carries only the model that refused.
    | { kind: "image_unsupported"; modelId?: string }
    // More than one enabled (app, action) pair applies — the UI must show a chooser and run the
    // picked candidate with proposeAndPostCandidate.
    | { kind: "choose"; candidates: AiActionCandidate[] }
    // Every enabled candidate comes from a per-user-keys app the user has not linked yet — the UI
    // must run the one-time consent flow (create a link code, wait for the app to claim it) and
    // then re-propose.
    | { kind: "link_required"; app: AiAppRegistration }
    // Enabled apps exist, but starting a proposal would create a card that cannot safely complete.
    // This is decided before local inference, provenance minting, or posting.
    | { kind: "actions_unavailable"; unavailable: AiActionUnavailable[] }
    // The app declined provenance for the exact card. This may be a stale app connection, but the
    // backend deliberately does not reveal which verification predicate failed. Retain only the
    // already validated structured extraction so an explicit reconnect can rebuild the card for
    // the newly bound recipient key without reading the source image or running the model again.
    | ({
          kind: "app_connection_unavailable";
          preparedExtraction: ManualExtraction;
          preparedSource: ManualExtractionSource;
      } & AiAppReconnectRequest);

// Caller-local progress for one proposal. It is intentionally not a global store because several
// message components may be alive concurrently.
export type ProposalPhase =
    | "preparing"
    | "reading_text"
    | "reading_image"
    | "generating"
    | "validating"
    | "attesting"
    | "sending";
export type ProposalPhaseListener = (phase: ProposalPhase) => void;

export interface ResolvedCandidates {
    candidates: AiActionCandidate[];
    // Enabled per-user-keys apps the user has no registered key for. Their actions must NOT fall
    // back to the manifest/action key (it belongs to someone else) — they need the one-time
    // link-code pairing first.
    linkRequired: AiAppRegistration[];
    unavailable: AiActionUnavailable[];
}

function unavailableReasonForApp(
    app: AiAppRegistration,
    chatId: ChatIdentifier,
): AiActionUnavailableReason | undefined {
    // UserIndex provenance resolution requires an actual registered card surface. Classic cards are
    // not a supported fallback for new app-bound proposals because they cannot display private app
    // context or prove the sender's title/rows/payload came from the app.
    if (cardSurfaceOpening(app, chatId) === undefined) return "missing_card_surface";
    // A card with no app inbox can be proposed but can never deliver a confirmed action. Reject it
    // before spending model work or asking the user to confirm a doomed operation.
    if ((app.manifest.inboxCanisterId?.trim().length ?? 0) === 0) return "missing_inbox_route";
    // Release brake for builds that have not explicitly enabled the complete app-card attestation
    // path. Enabled builds still obtain exact app-authored title/rows/payload provenance below;
    // this preflight only prevents them from spending model work when that path is switched off.
    if (!appContentAttestationAvailable()) return "content_attestation_unavailable";
    return undefined;
}

// Resolve the (app, action) candidates on offer in a chat. Groups/channels use their authoritative
// admin-curated enabled set. Direct chats use only published per-user-key apps paired by this user;
// an unpaired directory app can request linking but can never fall back to a manifest/action key.
// Exported so auto-propose derives its trigger vocabulary from this same resolution.
export async function resolveCandidates(
    client: OpenChat,
    chatId: ChatIdentifier,
): Promise<ResolvedCandidates> {
    let enabledApps: AiAppRegistration[];
    let directExactAppIds: ReadonlySet<number> | undefined;
    let myKeys: Map<number, string>;
    let myKeyVersions: Map<number, bigint>;

    if (chatId.kind === "direct_chat") {
        const direct = await loadDirectChatAiApps(client);
        directExactAppIds = direct.exactAppIds;
        myKeys = new Map(direct.connectedKeys);
        myKeyVersions = new Map(direct.connectedKeyVersions);
        enabledApps = direct.apps
            .filter(
                (app) =>
                    isDirectChatCardApp(app) &&
                    // A non-empty key marks the app connected, but the directory snapshot is not
                    // enough to run it: the exact keyed lookup must also have succeeded.
                    (!myKeys.has(app.id) || direct.exactAppIds.has(app.id)),
            )
            .slice(0, MAX_AI_ACTION_ENABLED_APPS);
    } else if (chatId.kind === "group_chat" || chatId.kind === "channel") {
        const enabledIds = await client.enabledAiApps(chatId);
        const boundedIds = enabledIds.slice(0, MAX_AI_ACTION_ENABLED_APPS);
        const apps = await client.aiApps(boundedIds.map((appId) => ({ appId })));
        const enabled = new Set(boundedIds);
        enabledApps = apps
            .filter((app) => enabled.has(app.id))
            .slice(0, MAX_AI_ACTION_ENABLED_APPS);
        myKeys = new Map<number, string>();
        myKeyVersions = new Map<number, bigint>();
    } else {
        return { candidates: [], linkRequired: [], unavailable: [] };
    }

    const unavailable: AiActionUnavailable[] = [];
    const runnableApps: AiAppRegistration[] = [];
    for (const app of enabledApps) {
        const reason = unavailableReasonForApp(app, chatId);
        if (reason === undefined) {
            runnableApps.push(app);
        } else {
            unavailable.push({ app, reason });
        }
    }

    // The user's own registered delivery keys, fetched only when an enabled app declares per-user
    // keys — apps without per_user_keys resolve exactly as before.
    if (
        directExactAppIds === undefined &&
        runnableApps.some((app) => app.manifest.perUserKeys === true)
    ) {
        for (const key of await client.myAiAppKeys()) {
            myKeys.set(key.appId, key.publicKey);
            myKeyVersions.set(key.appId, key.keyVersion);
        }
    }

    const candidates: AiActionCandidate[] = [];
    const linkRequired: AiAppRegistration[] = [];
    candidateApps: for (const app of runnableApps) {
        if (app.manifest.perUserKeys === true) {
            // Per-user delivery: the ONLY acceptable recipient is the proposing user's own key.
            const myKey = myKeys.get(app.id);
            if (myKey === undefined || myKey.length === 0) {
                if (linkRequired.length < MAX_AI_ACTION_ENABLED_APPS) linkRequired.push(app);
                continue;
            }
            for (const action of app.manifest.actions) {
                if (candidates.length >= MAX_AI_ACTION_CANDIDATES) break candidateApps;
                candidates.push({
                    app,
                    action,
                    recipientKey: myKey,
                    recipientKeyVersion: myKeyVersions.get(app.id),
                    inboxCanisterId: app.manifest.inboxCanisterId,
                });
            }
            continue;
        }
        // Legacy single-key delivery, unchanged: the action's own key else the manifest key.
        for (const action of app.manifest.actions) {
            if (candidates.length >= MAX_AI_ACTION_CANDIDATES) break candidateApps;
            const recipientKey =
                (action.consumerPublicKey?.length ?? 0) > 0
                    ? (action.consumerPublicKey as string)
                    : app.manifest.consumerPublicKey;
            if (recipientKey.length === 0) continue;
            candidates.push({
                app,
                action,
                recipientKey,
                inboxCanisterId: app.manifest.inboxCanisterId,
            });
        }
    }
    return { candidates, linkRequired, unavailable };
}

/** Re-resolve a chip's exact public app revision/action; any drift fails closed as stale. */
export async function resolveSuggestedAiAction(
    client: OpenChat,
    chatId: ChatIdentifier,
    coordinates: AiActionCoordinates,
): Promise<SuggestedAiActionResolution> {
    const { candidates, linkRequired } = await resolveCandidates(client, chatId);
    const candidate = candidates.find(
        (value) =>
            value.app.id === coordinates.appId &&
            value.app.updated === coordinates.appRevision &&
            value.action.name === coordinates.actionId,
    );
    if (candidate !== undefined) return { kind: "candidate", candidate };
    const app = linkRequired.find(
        (value) =>
            value.id === coordinates.appId &&
            value.updated === coordinates.appRevision &&
            value.manifest.actions.some((action) => action.name === coordinates.actionId),
    );
    return app === undefined ? { kind: "stale" } : { kind: "link_required", app };
}

export type AiActionPreflightBlocker = Extract<
    ProposeResult,
    { kind: "actions_unavailable" | "no_actions" }
>;

// Cheap directory-only check used before the UI asks for a model/manual extraction. It returns only
// terminal blockers; runnable or linkable candidates continue through the normal proposal flow.
export async function preflightAiActionForMessage(
    client: OpenChat,
    chatId: ChatIdentifier,
): Promise<AiActionPreflightBlocker | undefined> {
    const { candidates, linkRequired, unavailable } = await resolveCandidates(client, chatId);
    if (candidates.length > 0 || linkRequired.length > 0) return undefined;
    return unavailable.length > 0
        ? { kind: "actions_unavailable", unavailable }
        : { kind: "no_actions" };
}

// Turn a message's content into runner input. Text is used directly; media bytes are loaded through
// bounded local helpers so a selected on-device image/audio model sees the same attachment the user
// can display or play, without an unbounded fetch. Audio is explicit opt-in so the existing app-action
// proposal path (whose schemas support only text/image) cannot silently consume a voice attachment.
export async function contentToInput(
    content: MessageContent,
    client?: Pick<OpenChat, "downloadPublicBlob">,
    page?: ImagePageLocation,
    blobUrlPattern?: string,
    options: { includeAudio?: boolean } = {},
): Promise<
    { text?: string; image?: Uint8Array; audio?: Uint8Array; audioMimeType?: string } | undefined
> {
    if (content.kind === "text_content") {
        return { text: content.text };
    }
    if (content.kind === "image_content") {
        const image = await localImageBytes(
            content,
            client === undefined
                ? undefined
                : (ref, maxBytes) => client.downloadPublicBlob(ref, maxBytes),
            page,
            blobUrlPattern,
        );
        if (image !== undefined) return { image, text: content.caption };
    }
    if (options.includeAudio && content.kind === "audio_content") {
        const input = await localAudioInput(
            content,
            client === undefined
                ? undefined
                : (ref, maxBytes) => client.downloadPublicBlob(ref, maxBytes, "audio"),
            page,
            blobUrlPattern,
        );
        if (input !== undefined) return { ...input, text: content.caption };
    }
    return undefined;
}

// A manual extraction is either a single entry (OBJECT) or several (ARRAY of objects) — the test/
// manual prompt answer may be either, mirroring what the model may emit.
export type ManualExtraction = Record<string, unknown> | Record<string, unknown>[];
export interface ManualExtractionSource {
    modality: ModelModality;
    text?: string;
    rulesAlreadyResolved?: boolean;
    sourceTimestamp?: number;
}

function preparedSourceForContent(
    content: MessageContent,
    sourceTimestamp?: number,
): ManualExtractionSource {
    return content.kind === "text_content"
        ? { modality: "text", text: content.text, rulesAlreadyResolved: true, sourceTimestamp }
        : {
              modality: "image",
              text: content.kind === "image_content" ? content.caption : undefined,
              rulesAlreadyResolved: true,
          };
}
export const MANUAL_EXTRACTION_CANCELLED = Symbol("manual_extraction_cancelled");
export type ManualExtractionPromptResult =
    | ManualExtraction
    | typeof MANUAL_EXTRACTION_CANCELLED
    | undefined;

function isPlainExtractionObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

// Keep raw window.prompt handling out of the two ChatMessage trees so Cancel, malformed JSON, and
// wrong top-level shapes have one testable meaning everywhere. The callback lets each UI surface own
// its translated error toast.
export function parseManualExtractionPrompt(
    raw: string | null,
    onInvalid: () => void,
): ManualExtraction | typeof MANUAL_EXTRACTION_CANCELLED {
    if (raw === null) return MANUAL_EXTRACTION_CANCELLED;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (
            isPlainExtractionObject(parsed) ||
            (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isPlainExtractionObject))
        ) {
            return parsed;
        }
    } catch {
        // Malformed JSON follows the same reported invalid-input path as a wrong top-level shape.
    }
    onInvalid();
    return MANUAL_EXTRACTION_CANCELLED;
}

// The manual-extraction half of runDefinition, exported as a pure seam for tests. A caller-supplied
// extraction goes through the same deterministic gate as the model path. If any candidate is
// incomplete, fail the whole proposal instead of silently dropping rows. Otherwise one valid
// candidate builds a single-entry card and multiple valid candidates build one frozen array card.
export function buildManualCard(
    def: AiActionDefinition,
    manualExtraction: ManualExtraction,
    recipientKey: string,
    inboxCanisterId?: string,
    additionalRecipientKeys?: string[],
    // The owning app id, baked onto the built card so the recipient binds the surface to this app.
    appId?: number,
    appRevision?: bigint,
    // Manual/debug JSON still belongs to the selected chat-message source. Keep its modality explicit
    // so an image extraction cannot bypass image-only schema policy merely because no model ran.
    source: ManualExtractionSource = { modality: "text" },
): ProposeResult {
    const candidates = Array.isArray(manualExtraction) ? manualExtraction : [manualExtraction];
    if (candidates.length === 0) {
        return { kind: "no_extraction", raw: JSON.stringify(manualExtraction) };
    }
    if (candidates.length > MAX_AI_ACTION_CANDIDATES) {
        return {
            kind: "error",
            error: `The supplied extraction contains more than ${MAX_AI_ACTION_CANDIDATES} action candidates.`,
        };
    }
    const valid: Record<string, unknown>[] = [];
    const missingFields = new Set<string>();
    for (const candidate of candidates) {
        const finalExtraction = postProcessAiActionCandidate(def, candidate, {
            hasImage: source.modality === "image",
            text: source.text,
            rulesAlreadyResolved: source.rulesAlreadyResolved,
        });
        const missing = missingRequired(finalExtraction, def.responseSchema);
        if (missing.length === 0) {
            valid.push(finalExtraction);
        } else {
            for (const field of missing) missingFields.add(field);
        }
    }
    if (missingFields.size > 0) {
        return {
            kind: "incomplete_extraction",
            raw: JSON.stringify(manualExtraction),
            missingFields: [...missingFields].sort(),
            candidateCount: candidates.length,
            validCandidateCount: valid.length,
        };
    }
    if (valid.length === 1) {
        const card = buildActionCardContent(
            def,
            valid[0],
            recipientKey,
            inboxCanisterId,
            additionalRecipientKeys,
            appId,
            appRevision,
        );
        return { kind: "ready", card, extracted: valid[0] };
    }
    const card = buildMultiActionCardContent(
        def,
        valid,
        recipientKey,
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

// Test seam for the manual-JSON extraction prompt (Issue 1): the raw window.prompt fallback runs
// only when this tab's URL carries ?manualExtract=1. Never read persistent storage here: a crashed
// live journey must not leave a real profile opening test prompts on later proposals. Real users
// are guided to set up an on-device model instead of seeing a raw JSON box.
export function manualExtractEnabled(): boolean {
    if (typeof window === "undefined") return false;
    try {
        if (new URLSearchParams(window.location.search).get("manualExtract") === "1") return true;
    } catch {
        // no parseable query string — treat as disabled.
    }
    return false;
}

// Run one action definition against the message content, delivering to the given recipient key.
// When the caller supplies an extraction directly (no on-device runtime, or a native client with no
// model), the card is built from it with no inference — the rest of the cycle is identical, INCLUDING
// the deterministic post-pass + required-fields gate (buildManualCard).
async function runDefinition(
    def: AiActionDefinition,
    recipientKey: string,
    content: MessageContent,
    client: OpenChat,
    manualExtraction?: ManualExtraction,
    inboxCanisterId?: string,
    additionalRecipientKeys?: string[],
    // The id of the app that owns this action, baked onto the built card (see ActionCardContent.appId).
    appId?: number,
    appRevision?: bigint,
    onPhase?: ProposalPhaseListener,
    manualExtractionSource?: ManualExtractionSource,
    sourceTimestamp?: number,
    appProcessorUrl?: string,
    stillCurrent?: () => boolean,
): Promise<ProposeResult> {
    const viewer = currentUserIdStore.value;
    const contextCurrent = () => currentUserIdStore.value === viewer && stillCurrent?.() !== false;
    // `acceptsImage` is an explicit app capability, not a menu hint. Enforce it before the manual
    // seam, blob fetching, model-capability checks, or inference so an image can never reach an
    // action that omitted/disabled image support. Text proposals are unaffected.
    if (content.kind === "image_content" && def.acceptsImage !== true) {
        return { kind: "image_not_accepted" };
    }
    if (manualExtraction !== undefined) {
        onPhase?.("validating");
        return buildManualCard(
            def,
            manualExtraction,
            recipientKey,
            inboxCanisterId,
            additionalRecipientKeys,
            appId,
            appRevision,
            manualExtractionSource ??
                (content.kind === "text_content"
                    ? { modality: "text", text: content.text, sourceTimestamp }
                    : {
                          modality: "image",
                          text: content.kind === "image_content" ? content.caption : undefined,
                      }),
        );
    }

    const input = await contentToInput(content, client);
    if (!contextCurrent()) return { kind: "error", error: "proposal context changed" };
    if (input === undefined) return { kind: "unsupported_content" };
    const webInference = usesWebInferenceRuntime();
    // Every all-WebGPU build, including Android, packages the same local OCR runtime. The selected
    // mode is an explicit user boundary: OCR is reachable only in the two local-reader modes and
    // is never introduced as an automatic fallback for model-only inference.
    const browserLocalReaderModesAllowed = webInference;
    const useLocalReaderOnly = input.image !== undefined && browserUsesLocalReaderOnly();
    const useModelOnly = input.image !== undefined && browserUsesModelOnly();
    const verifyBrowserImageWithLocal =
        browserLocalReaderModesAllowed &&
        input.image !== undefined &&
        browserUsesModelWithLocalVerification();
    // Pin the browser selection once for the complete action. A declarative image action may use
    // several sequential focused passes; never merge outputs from two models if the user changes
    // the global selection while those passes are running.
    const selectedBrowserModelId = webInference ? webModelCatalogId() : undefined;
    let browserModelImageEvidence: BrowserModelImageEvidence | undefined;
    const inferWithPhase: typeof inferOnDevice = async (request) => {
        onPhase?.("generating");
        const inference = await inferOnDevice(request);
        browserModelImageEvidence = webImageInferenceEvidence(inference);
        onPhase?.("validating");
        return inference;
    };
    const inferPrivateEvidenceWithPhase: typeof inferOnDeviceTextOnlyNoProjector = async (
        request,
    ) => {
        onPhase?.("generating");
        const inference = await inferOnDeviceTextOnlyNoProjector(request);
        onPhase?.("validating");
        return inference;
    };
    const runSelectedModel = async (singleImagePass = false): Promise<RunAiActionResult> => {
        browserModelImageEvidence = undefined;
        let rawNormalizationAttempted = false;
        const result = await runAiAction(
            def,
            {
                ...input,
                modelId: selectedBrowserModelId,
                sourceTimestamp,
                ...(singleImagePass ? { singleImagePass: true } : {}),
            },
            recipientKey,
            inferWithPhase,
            inboxCanisterId,
            additionalRecipientKeys,
            appId,
            appRevision,
            appProcessorUrl === undefined
                ? undefined
                : {
                      normalize: async (candidates) => {
                          rawNormalizationAttempted = true;
                          if (!contextCurrent()) return { kind: "error" };
                          const normalized = await processWithApp(
                              appProcessorUrl,
                              def.name,
                              {
                                  operation: "normalize_raw",
                                  modality: "image",
                                  candidates,
                                  ...(input.text === undefined ? {} : { text: input.text }),
                                  ...(sourceTimestamp === undefined ? {} : { sourceTimestamp }),
                              },
                              contextCurrent,
                          );
                          onPhase?.("validating");
                          return contextCurrent() ? normalized : { kind: "error" };
                      },
                  },
        );
        if (
            webInference &&
            input.image !== undefined &&
            browserModelImageEvidence !== undefined &&
            isSemanticDuplicateBrowserImageResult(
                { appId, appRevision, actionId: def.name },
                browserModelImageEvidence,
                result,
            )
        ) {
            return {
                kind: "error",
                error: "A different image produced the same normalized action as the previous model result. This result was discarded; retry the image or choose another model.",
            };
        }
        // Raw output is normalized inside runAiAction before canonical rules/card construction.
        // Do not normalize it again through the legacy post-card/manual-card path.
        return rawNormalizationAttempted ? result : normalizeWithApp(result);
    };
    const runPrivateEvidenceModel = async (
        privateImageEvidence: PrivateImageEvidence,
    ): Promise<RunAiActionResult> =>
        runAiAction(
            def,
            { privateImageEvidence, modelId: selectedBrowserModelId, sourceTimestamp },
            recipientKey,
            inferPrivateEvidenceWithPhase,
            inboxCanisterId,
            additionalRecipientKeys,
            appId,
            appRevision,
        );

    const localExtractionOptions = {
        imageDimensions:
            content.kind === "image_content"
                ? { width: content.width, height: content.height }
                : undefined,
    };
    const localResult = (
        local: LocalActionExtractorResult | AppProcessorResult,
    ): ProposeResult | undefined => {
        switch (local.kind) {
            case "candidates":
                return buildManualCard(
                    def,
                    local.candidates,
                    recipientKey,
                    inboxCanisterId,
                    additionalRecipientKeys,
                    appId,
                    appRevision,
                    input.image === undefined
                        ? {
                              modality: "text",
                              text: input.text,
                              rulesAlreadyResolved: true,
                              sourceTimestamp,
                          }
                        : { modality: "image", rulesAlreadyResolved: true },
                );
            case "unavailable":
                return { kind: "unavailable", reason: local.reason };
            case "error":
                return { kind: "error", error: local.error };
            case "none":
                return { kind: "local_no_extraction", reason: "none" };
            case "ambiguous":
                return {
                    kind: "local_no_extraction",
                    reason: "ambiguous",
                };
            case "unsupported":
                return undefined;
        }
    };
    const runAppProcessor = async (request: AppProcessorInput): Promise<ProposeResult> => {
        if (appProcessorUrl === undefined)
            return {
                kind: "error",
                error: "The app's registered local processor could not be resolved. Refresh and retry.",
            };
        if (!contextCurrent()) return { kind: "error", error: "proposal context changed" };
        const result = await processWithApp(appProcessorUrl, def.name, request, contextCurrent);
        onPhase?.("validating");
        return localResult(result)!;
    };
    const normalizeWithApp = async (result: RunAiActionResult): Promise<RunAiActionResult> => {
        if (!localActionExtractorSupports(def.responseSchema)) return result;
        const candidates = readyCandidates(result);
        if (candidates === undefined) return result;
        const normalized = await runAppProcessor({
            operation: "normalize",
            modality:
                input.image !== undefined ? "image" : input.audio !== undefined ? "audio" : "text",
            candidates,
            ...(input.text === undefined ? {} : { text: input.text }),
            ...(sourceTimestamp === undefined ? {} : { sourceTimestamp }),
        });
        return normalized.kind === "local_no_extraction"
            ? { kind: "no_extraction", raw: "" }
            : (normalized as RunAiActionResult);
    };
    const runAppExtraction = async (): Promise<ProposeResult> => {
        onPhase?.("reading_text");
        return runAppProcessor({
            operation: "extract",
            modality: "text",
            text: input.text ?? "",
            ...(sourceTimestamp === undefined ? {} : { sourceTimestamp }),
        });
    };
    const readPrivateImageEvidence = async (): Promise<{
        failure?: ProposeResult;
        privateImageEvidence?: PrivateImageEvidence;
        ocrTranscripts?: { profile: string; text: string }[];
    }> => {
        onPhase?.("reading_image");
        const extraction = await extractLocalActionForPrivateVerification(
            def.responseSchema,
            def.rules ?? [],
            input,
            localExtractionOptions,
        );
        onPhase?.("validating");
        return {
            failure: localResult(extraction.result),
            privateImageEvidence: extraction.privateImageEvidence,
            ocrTranscripts: extraction.ocrTranscripts,
        };
    };

    const selectedBrowserImageModelReadiness = async (): Promise<{
        available: boolean;
        reason?: string;
    }> => {
        let readiness: { available: boolean; reason?: string } = { available: false };
        try {
            readiness = await browserImageModelFirstReadiness({
                retryAfterRecentFailure: true,
            });
        } catch {
            // Treat a failed probe as unavailable.
        }
        // Preserve an actionable readiness failure (notably an incomplete/stale pinned browser
        // download). An error-state selection is intentionally not advertised as inference-capable,
        // so consulting only its live modality would erase this reason and misreport the image model
        // as text-only.
        if (!readiness.available && readiness.reason !== undefined) return readiness;
        const imageModelSelected =
            imageUnsupportedReason(onDeviceInferenceCapability()) === undefined;
        return imageModelSelected ? readiness : { available: false };
    };

    const selectedBrowserTextModelReadiness = async (): Promise<{
        available: boolean;
        reason?: string;
    }> => {
        try {
            return await browserTextModelReadiness();
        } catch {
            return {
                available: false,
                reason: "The selected on-device model could not be prepared. Open On-device models and retry its download.",
            };
        }
    };

    if (
        browserLocalReaderModesAllowed &&
        input.image !== undefined &&
        (useLocalReaderOnly || verifyBrowserImageWithLocal)
    ) {
        if (!localImageEvidenceExtractorSupports(def.responseSchema)) {
            return useLocalReaderOnly
                ? {
                      kind: "unavailable",
                      reason: "This app does not provide a private image-reader contract. Choose model-only mode or ask the app developer to add one.",
                  }
                : { kind: "error", error: LOCAL_VERIFICATION_FAILED_MESSAGE };
        }
        if (useLocalReaderOnly) {
            if (!localActionExtractorSupports(def.responseSchema)) {
                return {
                    kind: "unavailable",
                    reason: "This app does not provide a local processor for OCR-only mode.",
                };
            }
            const source = await readPrivateImageEvidence();
            if (source.failure !== undefined) return source.failure;
            if (source.ocrTranscripts === undefined || source.ocrTranscripts.length === 0) {
                return { kind: "error", error: LOCAL_READER_VERIFICATION_FAILED_MESSAGE };
            }
            return runAppProcessor({
                operation: "extract",
                modality: "image",
                ocrTranscripts: source.ocrTranscripts,
                ...(input.text === undefined ? {} : { text: input.text }),
                ...(sourceTimestamp === undefined ? {} : { sourceTimestamp }),
            });
        }
        const textReadiness = await selectedBrowserTextModelReadiness();
        if (!textReadiness.available || selectedBrowserModelId === undefined) {
            return {
                kind: "unavailable",
                reason:
                    textReadiness.reason ??
                    "Select and download an on-device model before using the local image reader.",
            };
        }
        if (verifyBrowserImageWithLocal) {
            const imageReadiness = await selectedBrowserImageModelReadiness();
            if (!imageReadiness.available) {
                if (imageReadiness.reason !== undefined) {
                    return { kind: "unavailable", reason: imageReadiness.reason };
                }
                const unsupported = imageUnsupportedReason(onDeviceInferenceCapability());
                if (unsupported !== undefined) return unsupported;
                return { kind: "unavailable", reason: GPU_ONLY_IMAGE_UNAVAILABLE_MESSAGE };
            }
        }

        // Read and release every app-requested OCR worker before allocating any model sessions.
        const source = await readPrivateImageEvidence();
        if (source.failure !== undefined) return source.failure;
        if (source.privateImageEvidence === undefined) {
            return { kind: "error", error: LOCAL_READER_VERIFICATION_FAILED_MESSAGE };
        }
        if (webModelCatalogId() !== selectedBrowserModelId) {
            return { kind: "error", error: LOCAL_VERIFICATION_FAILED_MESSAGE };
        }

        // Verification compares two independent reads under one pinned selection: exactly one
        // full-image vision inference and exactly one text decode of private OCR evidence.
        const vision = await runSelectedModel(true);
        if (webModelCatalogId() !== selectedBrowserModelId) {
            return { kind: "error", error: LOCAL_VERIFICATION_FAILED_MESSAGE };
        }
        if (vision.kind === "unavailable" || vision.kind === "error") return vision;
        const decoded = await normalizeWithApp(
            await runPrivateEvidenceModel(source.privateImageEvidence),
        );
        if (webModelCatalogId() !== selectedBrowserModelId) {
            return { kind: "error", error: LOCAL_VERIFICATION_FAILED_MESSAGE };
        }
        return reconcileModelWithLocalResult(vision, decoded, def.responseSchema);
    }

    // Model-only sends the original image directly to the selected runtime and never invokes OCR.
    if (webInference && input.image !== undefined && useModelOnly) {
        const modelReadiness = await selectedBrowserImageModelReadiness();
        if (!modelReadiness.available) {
            if (modelReadiness.reason !== undefined) {
                return { kind: "unavailable", reason: modelReadiness.reason };
            }
            const unsupported = imageUnsupportedReason(onDeviceInferenceCapability());
            if (unsupported !== undefined) return unsupported;
            return { kind: "unavailable", reason: GPU_ONLY_IMAGE_UNAVAILABLE_MESSAGE };
        }
    }

    if (
        input.image === undefined &&
        input.audio === undefined &&
        localActionExtractorSupports(def.responseSchema)
    ) {
        return runAppExtraction();
    }

    // An image needs a model with the "image" modality. Without this the bytes were shipped into a
    // text-only runtime and the propose silently did NOTHING (browser) or failed deep inside the
    // native plugin — the user got no explanation either way. Both entry points (the message menu and
    // the auto-propose chip) funnel through here, so one gate covers both.
    if (input.image !== undefined) {
        const blocked = imageUnsupportedReason(onDeviceInferenceCapability());
        if (blocked !== undefined) return blocked;
    }

    return runSelectedModel();
}

/**
 * Can this client read an IMAGE right now? Returns undefined when it can, else the ProposeResult
 * explaining why not. Pure (capability + client kind in, verdict out) so the policy is unit-testable
 * without a Tauri bridge or a loaded model.
 *
 * The verdict is about the MODEL, never about which client you are in — so this takes ONLY the
 * capability. Browser vision is absent today, not impossible: `webEligibleModels` excludes the 2-FILE
 * shape (weights + a separate mmproj projector) within a ~2 GB wasm32 envelope — a single-file vision
 * GGUF under that ceiling would already pass — and `webInfer` then rejects images because the WASM
 * projector path is unimplemented, not because a browser cannot do it. So when a browser-runnable
 * image model appears, the capability probe starts reporting "image" and this allows it with no change
 * here. Deliberately NOT branching on native-vs-browser: a distinction the UI does not use is the kind
 * of dead code that let this whole failure go unreported in the first place.
 */
export function imageUnsupportedReason(capability: {
    selectedModalities: ModelModality[];
    selectedModelId?: string;
}): { kind: "image_unsupported"; modelId?: string } | undefined {
    if (capability.selectedModalities.includes("image")) return undefined;
    return { kind: "image_unsupported", modelId: capability.selectedModelId };
}

// Run the action on offer for a message in this chat, returning a card to propose (or a status).
// The AI-app directory is the only source of actions: exactly one runnable candidate runs directly,
// several defer to the UI's chooser. When the only enabled apps are per-user-keys apps the user
// hasn't linked yet, the caller must run the consent flow ("link_required"). A chat with no enabled
// app yields "no_actions".
export async function proposeAiActionForMessage(
    client: OpenChat,
    chatId: ChatIdentifier,
    content: MessageContent,
    manualExtraction?: ManualExtraction,
    onPhase?: ProposalPhaseListener,
    sourceTimestamp?: number,
    stillCurrent?: () => boolean,
): Promise<ProposeResult> {
    const viewer = currentUserIdStore.value;
    const contextCurrent = () => currentUserIdStore.value === viewer && stillCurrent?.() !== false;
    const { candidates, linkRequired, unavailable } = await resolveCandidates(client, chatId);
    if (!contextCurrent()) return { kind: "error", error: "proposal context changed" };
    if (candidates.length === 1) {
        const c = candidates[0];
        return runDefinition(
            c.action,
            c.recipientKey,
            content,
            client,
            manualExtraction,
            c.inboxCanisterId,
            c.additionalRecipientKeys,
            c.app.id,
            c.app.updated,
            onPhase,
            undefined,
            sourceTimestamp,
            cardSurfaceOpening(c.app, chatId)?.url,
            contextCurrent,
        );
    }
    if (candidates.length > 1) {
        return { kind: "choose", candidates };
    }
    if (linkRequired.length > 0) {
        return { kind: "link_required", app: linkRequired[0] };
    }
    if (unavailable.length > 0) {
        return { kind: "actions_unavailable", unavailable };
    }
    return { kind: "no_actions" };
}

// Post the proposed card. The send was previously FIRE-AND-FORGET (no await, no catch), so if posting
// the card message failed the whole propose ended in silence: the extraction prompt had been answered,
// no toast appeared, and simply no card showed up — indistinguishable from "nothing matched". Await it
// and turn a failure into an "error" result so the caller can surface it.
async function postCard(
    client: OpenChat,
    messageContext: MessageContext,
    result: ProposeResult & { kind: "ready" | "ready_multi" },
    preparedSource: ManualExtractionSource,
    stillCurrent?: () => boolean,
    onPhase?: ProposalPhaseListener,
): Promise<ProposeResult> {
    try {
        if (stillCurrent?.() === false) {
            return { kind: "error", error: "suggestion context changed" };
        }
        const appId = result.card.appId;
        const appRevision = result.card.appRevision;
        if (appId === undefined || appRevision === undefined) {
            return { kind: "error", error: "could not prove the card's app provenance" };
        }
        const messageId = random64();
        const exactContent: AiAppCardContentV1 = {
            title: result.card.title,
            rows: result.card.rows.map((row) => ({ label: row.label, value: row.value })),
            confirmLabel: result.card.confirmLabel,
            cancelLabel: result.card.cancelLabel,
            actionId: result.card.actionId,
            disclosure: result.card.disclosure,
            expiresAt: result.card.expiresAt,
            confirmPayload: result.card.confirmPayload?.slice(),
        };
        onPhase?.("attesting");
        const provenanceResult = await client.createAiAppCardProvenance(
            appId,
            appRevision,
            result.card.actionId,
            exactContent,
            messageContext.chatId,
            messageId,
            messageContext.threadRootMessageIndex,
        );
        if (stillCurrent?.() === false) {
            return { kind: "error", error: "suggestion context changed" };
        }
        if (provenanceResult.kind === "app_unavailable") {
            return {
                kind: "app_connection_unavailable",
                appId,
                appRevision,
                actionId: result.card.actionId,
                preparedExtraction: result.extracted,
                preparedSource,
            };
        }
        if (provenanceResult.kind !== "success") {
            return {
                kind: "error",
                error: PROVENANCE_FAILURE_MESSAGES[provenanceResult.kind],
            };
        }
        if (provenanceResult.expiresAt <= BigInt(Date.now())) {
            return {
                kind: "error",
                error: "Card verification expired before the card could be posted. Please retry.",
            };
        }
        const vouchedCard = { ...result.card, appProvenance: provenanceResult.provenance };
        // NB: this does NOT throw on failure — it RESOLVES with a failure response (e.g. the chat is
        // missing from the store, or the send is throttled), which is the other half of why a failed
        // propose was completely silent. Inspect the response, don't just await it.
        if (stillCurrent?.() === false) {
            return { kind: "error", error: "suggestion context changed" };
        }
        onPhase?.("sending");
        const res = await client.sendMessageWithContent(
            messageContext,
            vouchedCard,
            false,
            [],
            false,
            messageId,
        );
        if (res?.kind !== undefined && res.kind !== "success") {
            console.error("[aiAction] posting the proposed card was rejected", res);
            return { kind: "error", error: `could not post the card (${res.kind})` };
        }
        return result;
    } catch (err) {
        console.error("[aiAction] posting the proposed card failed", err);
        return { kind: "error", error: String((err as { message?: string })?.message ?? err) };
    }
}

// Convenience: run + post. Posts the proposed card into the chat (Pending) for the user to confirm.
export async function proposeAndPost(
    client: OpenChat,
    messageContext: MessageContext,
    content: MessageContent,
    manualExtraction?: ManualExtraction,
    stillCurrent?: () => boolean,
    onPhase?: ProposalPhaseListener,
    sourceTimestamp?: number,
): Promise<ProposeResult> {
    if (stillCurrent?.() === false) {
        return { kind: "error", error: "proposal context changed" };
    }
    onPhase?.("preparing");
    const result = await proposeAiActionForMessage(
        client,
        messageContext.chatId,
        content,
        manualExtraction,
        onPhase,
        sourceTimestamp,
        stillCurrent,
    );
    if (stillCurrent?.() === false) {
        return { kind: "error", error: "proposal context changed" };
    }
    if (result.kind === "ready" || result.kind === "ready_multi") {
        return postCard(
            client,
            messageContext,
            result,
            preparedSourceForContent(content, sourceTimestamp),
            stillCurrent,
            onPhase,
        );
    }
    return result;
}

// The second half of the chooser flow: run the (app, action) candidate the user picked and post the
// proposed card on success. Never returns "choose".
export async function proposeAndPostCandidate(
    client: OpenChat,
    messageContext: MessageContext,
    content: MessageContent,
    candidate: AiActionCandidate,
    manualExtraction?: ManualExtraction,
    stillCurrent?: () => boolean,
    onPhase?: ProposalPhaseListener,
    manualExtractionSource?: ManualExtractionSource,
    sourceTimestamp?: number,
): Promise<ProposeResult> {
    if (stillCurrent?.() === false) {
        return { kind: "error", error: "suggestion context changed" };
    }
    onPhase?.("preparing");
    const unavailableReason = unavailableReasonForApp(candidate.app, messageContext.chatId);
    if (unavailableReason !== undefined) {
        return {
            kind: "actions_unavailable",
            unavailable: [{ app: candidate.app, reason: unavailableReason }],
        };
    }
    const result = await runDefinition(
        candidate.action,
        candidate.recipientKey,
        content,
        client,
        manualExtraction,
        candidate.inboxCanisterId,
        candidate.additionalRecipientKeys,
        candidate.app.id,
        candidate.app.updated,
        onPhase,
        manualExtractionSource,
        sourceTimestamp,
        cardSurfaceOpening(candidate.app, messageContext.chatId)?.url,
        stillCurrent,
    );
    // The model can run for seconds. Recheck before the only external write so switching accounts
    // during inference cannot post A's message-derived card into B's session.
    if (stillCurrent?.() === false) {
        return { kind: "error", error: "suggestion context changed" };
    }
    if (result.kind === "ready" || result.kind === "ready_multi") {
        return postCard(
            client,
            messageContext,
            result,
            preparedSourceForContent(content, sourceTimestamp),
            stillCurrent,
            onPhase,
        );
    }
    return result;
}

// Every "propose can't run because there is no model" exit says this — the pre-check and the
// `unavailable` result both land here, so the user gets one answer and one place to go.
export const NO_MODEL_MESSAGE =
    "No on-device model is ready — pick one in profile → App settings → On-device models.";

const NO_MODEL_UNAVAILABLE_REASONS = new Set([
    "no model",
    "no runtime",
    "no browser model attached",
    "on-device inference requires the native client",
    "no on-device model selected",
    "the selected model is not in the trusted catalog",
    "the selected model is not downloaded",
]);

/**
 * What to tell the user about a propose result, or undefined when there is nothing to say — the card
 * was posted, or a chooser/consent surface is now up and the flow continues through it.
 *
 * This mapping used to be copied into both ChatMessage trees, and copies drift: the classic tree was
 * fixed while the mobile one kept its silent exit, so proposing on mobile did nothing and said
 * nothing. One switch, reachable from a unit test, is the fix. It is EXHAUSTIVE on purpose — a new
 * ProposeResult kind fails to type as `never` below, so adding one without deciding what the user
 * hears is a COMPILE error rather than another dead button.
 */
export function proposeFailureMessage(result: ProposeResult): string | undefined {
    switch (result.kind) {
        case "ready":
        case "ready_multi":
        case "app_connection_unavailable":
            // The card is already in the chat, waiting to be confirmed.
            // Or the flow is opening a recovery surface for the exact failed app coordinates.
            return undefined;
        case "choose":
        case "link_required":
            // Not an outcome: runProposeFlow is mid-flight and a surface is up.
            return undefined;
        case "actions_unavailable": {
            const reasons = new Set(result.unavailable.map((entry) => entry.reason));
            if (reasons.has("content_attestation_unavailable")) {
                return "New app actions are not enabled for this OpenChat build.";
            }
            if (reasons.has("missing_card_surface")) {
                return "This app action is unavailable because the app has no valid secure in-chat card surface.";
            }
            return "This app action is unavailable because the app has no confirmed-action inbox route.";
        }
        case "no_actions":
            // The one message here that IS a translation key — it predates the rest and exists in the
            // locale files. Callers wrap the return in i18nKey, which passes the plain-English
            // messages below through untranslated.
            return "aiApps.noneEnabled";
        case "unavailable":
            return NO_MODEL_UNAVAILABLE_REASONS.has(result.reason)
                ? NO_MODEL_MESSAGE
                : result.reason;
        case "unsupported_content":
            return "This message can't be turned into an action";
        case "image_unsupported":
            return `${result.modelId ?? "This model"} doesn't support images, only text. Switch to an image-capable model in profile → App settings → On-device models.`;
        case "image_not_accepted":
            return "This app action doesn't accept images. Choose an image-enabled action or send the details as text.";
        case "local_no_extraction":
            return "The local reader couldn't determine a complete action from this message.";
        case "no_extraction":
            return "The model found no action in this message";
        case "incomplete_extraction": {
            const fields = result.missingFields.join(", ");
            if (result.candidateCount > 1) {
                return `The model produced ${result.candidateCount} action entries, but only ${result.validCandidateCount} passed validation. Nothing was posted. Missing or invalid required fields: ${fields}.`;
            }
            return `The model found an action, but required fields were missing or invalid: ${fields}. Nothing was posted.`;
        }
        case "error":
            return `Action failed: ${result.error}`;
        default: {
            const unhandled: never = result;
            // Unreachable while the switch above is complete; still returns a STRING so that even a
            // kind bolted on at runtime speaks rather than leaving the user staring at nothing.
            return `Action failed: ${JSON.stringify(unhandled)}`;
        }
    }
}

// Everything the propose flow needs from its host tree. Injected rather than imported so the flow is
// testable with no model, no Tauri bridge and no mounted component — that this logic was reachable
// only by clicking is precisely how the same silent-exit bug shipped twice.
export interface ProposeFlowDeps {
    // Resolve terminal availability before touching model/manual-extraction UX. In particular, the
    // temporary content-attestation kill-switch must speak before any local inference work starts.
    preflight: () => Promise<AiActionPreflightBlocker | undefined>;
    // Is an on-device model loaded and usable right now?
    canInfer: () =>
        | boolean
        | { available: boolean; reason?: string }
        | Promise<boolean | { available: boolean; reason?: string }>;
    // Browser image + OCR-only must enter the app-declared local reader without probing selected
    // model readiness. Other modes keep the existing model gate.
    requiresModelReadiness: () => boolean;
    // The manual-JSON seam is enabled only by this tab's explicit query. Undefined means the seam is
    // disabled; the cancellation sentinel means the user explicitly cancelled and the flow must stop.
    promptForExtraction: () => ManualExtractionPromptResult;
    propose: (extraction?: ManualExtraction) => Promise<ProposeResult>;
    proposeCandidate: (
        candidate: AiActionCandidate,
        extraction?: ManualExtraction,
        source?: ManualExtractionSource,
    ) => Promise<ProposeResult>;
    // When a private/public trigger created the chip, re-resolve only those immutable coordinates.
    // Stale registrations must never fall back to the generic chooser or a different candidate.
    resolveSuggestedCandidate?: () => Promise<SuggestedAiActionResolution>;
    // Captured-viewer guard for a suggestion. Checked around every awaited phase and before runs.
    stillCurrent?: () => boolean;
    // Pick between several offered actions. The classic tree answers synchronously (a numbered
    // window.prompt), the mobile tree asynchronously (a sheet); undefined means the user backed out.
    chooseCandidate: (
        candidates: AiActionCandidate[],
    ) => AiActionCandidate | undefined | Promise<AiActionCandidate | undefined>;
    // Run the one-time pairing surface for a per-user-keys app; true once the key is registered.
    linkApp: (app: AiAppRegistration) => boolean | Promise<boolean>;
    // Offer an explicit reconnect surface for the exact app revision that declined provenance.
    // AppUnavailable is ambiguous. Opening/closing this surface returns undefined; only an explicit
    // code claim followed by Check connection returns a completion proof.
    promptReconnect: (
        target: AiAppReconnectRequest,
    ) => AiAppReconnectCompletion | undefined | Promise<AiAppReconnectCompletion | undefined>;
    // After explicit completion, re-resolve only the immutable current coordinates captured by the
    // recovery resolver. This must never fall back to a chooser or a different app/action.
    resolveReconnectCandidate: (
        target: AiAppReconnectRequest,
    ) => Promise<SuggestedAiActionResolution>;
    toast: (message: string) => void;
}

function candidateHasCoordinates(
    candidate: AiActionCandidate,
    coordinates: AiActionCoordinates,
): boolean {
    return (
        candidate.app.id === coordinates.appId &&
        candidate.app.updated === coordinates.appRevision &&
        candidate.action.name === coordinates.actionId
    );
}

/**
 * Propose an action for one message: decide, run, and make sure the user always hears an answer.
 *
 * Hoisted out of components/home/ChatMessage.svelte and components_mobile/home/ChatMessage.svelte,
 * which carried two hand-maintained copies of it. Each tree keeps its own surfaces (prompts vs
 * sheets) — only the DECISIONS live here.
 *
 * The rule the two copies kept breaking: every failure path must say why. An explicit Cancel in the
 * isolated manual-QC seam is a user decision and stops quietly; when that seam is inactive and no
 * model exists, the user is told where to get one. The same rule applies before proposing, after an
 * `unavailable`, and after an `unavailable` from a CHOSEN candidate (the branch the mobile tree
 * once returned from in silence, leaving a user with two candidates and no model a dead button).
 */
async function runProposeFlowInternal(deps: ProposeFlowDeps): Promise<ProposeFlowOutcome> {
    const stale = (): boolean => {
        if (deps.stillCurrent?.() !== false) return false;
        deps.toast("aiApps.autoPropose.stale");
        return true;
    };
    if (stale()) return "retryable";
    const blocker = await deps.preflight();
    if (stale()) return "retryable";
    if (blocker !== undefined) {
        const message = proposeFailureMessage(blocker);
        if (message !== undefined) deps.toast(message);
        return "retryable";
    }

    let suggestedCandidate: AiActionCandidate | undefined;
    if (deps.resolveSuggestedCandidate !== undefined) {
        let resolved = await deps.resolveSuggestedCandidate();
        if (stale()) return "retryable";
        if (resolved.kind === "link_required") {
            if (!(await deps.linkApp(resolved.app))) return "retryable";
            if (stale()) return "retryable";
            resolved = await deps.resolveSuggestedCandidate();
            if (stale()) return "retryable";
        }
        if (resolved.kind !== "candidate") {
            deps.toast("aiApps.autoPropose.stale");
            return "retryable";
        }
        suggestedCandidate = resolved.candidate;
    }

    // The prompt dependency is inert for real users. Check it before model availability so an
    // explicitly isolated QC tab can override a model without unloading or mutating model state.
    const prompted = deps.promptForExtraction();
    if (stale()) return "retryable";
    if (prompted === MANUAL_EXTRACTION_CANCELLED) return "retryable";
    const extraction = prompted;
    if (extraction === undefined && deps.requiresModelReadiness()) {
        const readiness = await deps.canInfer();
        if (stale()) return "retryable";
        const available = typeof readiness === "boolean" ? readiness : readiness.available;
        if (!available) {
            deps.toast(
                typeof readiness === "boolean"
                    ? NO_MODEL_MESSAGE
                    : (readiness.reason ?? NO_MODEL_MESSAGE),
            );
            return "retryable";
        }
    }

    if (stale()) return "retryable";
    let result =
        suggestedCandidate === undefined
            ? await deps.propose(extraction)
            : await deps.proposeCandidate(suggestedCandidate, extraction);
    if (stale()) return "retryable";

    // A candidate-specific run is not allowed to escape into a generic chooser/link flow even if a
    // malformed/runtime implementation returns an impossible union member.
    if (
        suggestedCandidate !== undefined &&
        (result.kind === "choose" || result.kind === "link_required")
    ) {
        deps.toast("aiApps.autoPropose.stale");
        return "retryable";
    }

    if (result.kind === "link_required") {
        // The pairing surface reports its own outcome, and dismissing it is a deliberate "not now" —
        // the one early exit that is honest without a toast.
        if (!(await deps.linkApp(result.app))) return "retryable";
        if (stale()) return "retryable";
        result = await deps.propose(extraction);
        if (stale()) return "retryable";
    }

    if (result.kind === "choose") {
        const candidate = await deps.chooseCandidate(result.candidates);
        if (stale()) return "retryable";
        // Backing out of the chooser is a choice, not a failure.
        if (candidate === undefined) return "retryable";
        result = await deps.proposeCandidate(candidate, extraction);
        if (stale()) return "retryable";
        if (result.kind === "unavailable") {
            const retry = deps.promptForExtraction();
            if (retry === MANUAL_EXTRACTION_CANCELLED) return "retryable";
            // NB: no early return when the seam gives nothing — falling through to the message below
            // IS the fix. Returning here is what left the mobile chooser path mute.
            if (retry !== undefined) {
                result = await deps.proposeCandidate(candidate, retry);
                if (stale()) return "retryable";
            }
        }
    } else if (result.kind === "unavailable") {
        const retry = deps.promptForExtraction();
        if (retry === MANUAL_EXTRACTION_CANCELLED) return "retryable";
        if (retry !== undefined) {
            result =
                suggestedCandidate === undefined
                    ? await deps.propose(retry)
                    : await deps.proposeCandidate(suggestedCandidate, retry);
            if (stale()) return "retryable";
        }
    }

    if (result.kind === "app_connection_unavailable") {
        // The first run already fetched/read the message and validated this exact extraction. Keep
        // it in this caller-local flow while reconnect is open. Replaying it through buildManualCard
        // revalidates against the freshly resolved app revision and rebinds the card to the new
        // recipient key, but deliberately cannot invoke image decoding or model inference.
        const preparedExtraction = result.preparedExtraction;
        const preparedSource = result.preparedSource;
        const failedCoordinates: AiAppReconnectRequest = {
            appId: result.appId,
            appRevision: result.appRevision,
            actionId: result.actionId,
        };
        const completion = await deps.promptReconnect(failedCoordinates);
        if (stale()) return "retryable";
        if (completion === undefined) return "retryable";

        const retryCoordinates = completion.retryCoordinates;
        if (
            completion.previousKeyVersion < 0n ||
            retryCoordinates.appId !== failedCoordinates.appId ||
            retryCoordinates.actionId !== failedCoordinates.actionId ||
            retryCoordinates.appRevision !== failedCoordinates.appRevision ||
            (suggestedCandidate !== undefined &&
                !candidateHasCoordinates(suggestedCandidate, retryCoordinates))
        ) {
            deps.toast(
                suggestedCandidate === undefined
                    ? "aiApps.reconnectChanged"
                    : "aiApps.autoPropose.stale",
            );
            return "retryable";
        }

        const refreshed = await deps.resolveReconnectCandidate(retryCoordinates);
        if (stale()) return "retryable";
        if (
            refreshed.kind !== "candidate" ||
            !candidateHasCoordinates(refreshed.candidate, retryCoordinates)
        ) {
            deps.toast(
                suggestedCandidate === undefined
                    ? "aiApps.reconnectChanged"
                    : "aiApps.autoPropose.stale",
            );
            return "retryable";
        }
        if (
            refreshed.candidate.recipientKeyVersion === undefined ||
            refreshed.candidate.recipientKeyVersion <= completion.previousKeyVersion
        ) {
            deps.toast("aiApps.reconnectNotAdvanced");
            return "retryable";
        }

        // Exactly one retry. Another ambiguous AppUnavailable result is reported and never opens a
        // second modal or loops. The user still confirms the resulting card before any app action.
        result = await deps.proposeCandidate(
            refreshed.candidate,
            preparedExtraction,
            preparedSource,
        );
        if (stale()) return "retryable";
        if (result.kind === "app_connection_unavailable") {
            deps.toast("aiApps.reconnectStillUnavailable");
            return "retryable";
        }
        if (result.kind === "choose" || result.kind === "link_required") {
            deps.toast("aiApps.reconnectChanged");
            return "retryable";
        }
    }

    const message = proposeFailureMessage(result);
    if (message !== undefined) deps.toast(message);
    // `ready` and `ready_multi` are returned only after proposeAndPost has successfully sent the
    // vouched card. Every other handled outcome leaves an auto-propose suggestion available for an
    // exact retry, including user cancellation and model/provenance/transport failures.
    return result.kind === "ready" || result.kind === "ready_multi" ? "posted" : "retryable";
}

/** Failure boundary shared by both render trees so an awaited resolver/model rejection is spoken. */
export type ProposeFlowOutcome = "posted" | "retryable";

const MAX_UNEXPECTED_PROPOSAL_FAILURE_CHARS = 240;

/**
 * Preserve a useful local/runtime rejection without allowing an unbounded or control-character
 * bearing exception to become UI content. Query values are redacted because bridge/network errors
 * sometimes include request URLs.
 */
export function unexpectedProposalFailureMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    const safe = raw
        .replace(/([?&](?:code|key|secret|token)=)[^&\s]*/giu, "$1[redacted]")
        // eslint-disable-next-line no-control-regex -- Intentionally removes C0/C1 controls from untrusted error text.
        .replace(/[\u0000-\u001f\u007f-\u009f]+/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();
    if (safe.length === 0) return "aiApps.autoPropose.failed";
    const bounded =
        safe.length <= MAX_UNEXPECTED_PROPOSAL_FAILURE_CHARS
            ? safe
            : `${safe.slice(0, MAX_UNEXPECTED_PROPOSAL_FAILURE_CHARS - 1)}…`;
    return `Action failed while preparing the action: ${bounded}`;
}

export async function runProposeFlow(deps: ProposeFlowDeps): Promise<ProposeFlowOutcome> {
    try {
        return await runProposeFlowInternal(deps);
    } catch (error) {
        deps.toast(
            deps.stillCurrent?.() === false
                ? "aiApps.autoPropose.stale"
                : unexpectedProposalFailureMessage(error),
        );
        return "retryable";
    }
}
