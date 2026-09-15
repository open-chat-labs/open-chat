// Executes an app's local processing contract in its registered, isolated card document.
// Field interpretation belongs to that document; the host accepts only bounded JSON candidates.
import { MAX_AI_ACTION_CANDIDATES } from "@shared";
import { currentUserIdStore } from "@client";
import { supportsCredentiallessIframe } from "./cardBridge";

export const APP_PROCESSOR_MAX_BYTES = 64 * 1024;
export const APP_PROCESSOR_TIMEOUT_MS = 30_000;
const MAX_SOURCE_BYTES = 32 * 1024;
const MAX_ACTIVE = 2;
const VERSION = 1;
const EXTENSION = "x-openchat-local-processor";
const PREFIX = "oc:app-process:";

export interface AppProcessorInput {
    operation: "extract" | "normalize" | "normalize_raw";
    modality: "text" | "image" | "audio";
    text?: string;
    ocrTranscripts?: { profile: string; text: string }[];
    sourceTimestamp?: number;
    candidates?: Record<string, unknown>[];
}

export type AppProcessorResult =
    | { kind: "candidates"; candidates: Record<string, unknown>[]; sourceIndexes?: number[] }
    | { kind: "none" | "ambiguous" }
    | { kind: "error"; error: string };

type Binding = { frameNonce: string; requestNonce: string };

function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function appLocalProcessorSupports(schema: object | undefined): boolean {
    if (!record(schema)) return false;
    const config = schema[EXTENSION];
    return record(config) && config.version === VERSION && Object.keys(config).length === 1;
}

function safeJson(value: unknown, depth = 0): boolean {
    if (depth > 8) return false;
    if (value === null || typeof value === "boolean" || typeof value === "string") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value))
        return value.length <= 256 && value.every((item) => safeJson(item, depth + 1));
    return (
        record(value) &&
        Object.keys(value).length <= 128 &&
        Object.entries(value).every(
            ([key, item]) =>
                !["__proto__", "constructor", "prototype"].includes(key) &&
                safeJson(item, depth + 1),
        )
    );
}

function bytes(value: unknown): number {
    try {
        return new TextEncoder().encode(JSON.stringify(value)).byteLength;
    } catch {
        return Infinity;
    }
}

export function validAppProcessorCandidates(value: unknown): value is Record<string, unknown>[] {
    return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.length <= MAX_AI_ACTION_CANDIDATES &&
        value.every((item) => record(item) && safeJson(item)) &&
        bytes(value) <= APP_PROCESSOR_MAX_BYTES
    );
}

export function parseAppProcessorResult(
    value: unknown,
    expected: Binding,
    operation: AppProcessorInput["operation"] = "normalize",
): AppProcessorResult | undefined {
    if (
        !record(value) ||
        value.type !== PREFIX + "result" ||
        value.version !== VERSION ||
        value.frameNonce !== expected.frameNonce ||
        value.requestNonce !== expected.requestNonce ||
        Object.keys(value).some(
            (key) =>
                ![
                    "type",
                    "version",
                    "frameNonce",
                    "requestNonce",
                    "kind",
                    "candidates",
                    ...(operation === "normalize_raw" ? ["sourceIndexes"] : []),
                ].includes(key),
        ) ||
        bytes(value) > APP_PROCESSOR_MAX_BYTES
    )
        return undefined;
    if (value.kind === "candidates" && validAppProcessorCandidates(value.candidates)) {
        if (operation === "normalize_raw") {
            const indexes = value.sourceIndexes;
            if (
                !Array.isArray(indexes) ||
                indexes.length !== value.candidates.length ||
                Array.from({ length: indexes.length }, (_, index) => index).some(
                    (index) => !Object.hasOwn(indexes, index) || indexes[index] !== index,
                )
            )
                return undefined;
            return { kind: "candidates", candidates: value.candidates, sourceIndexes: indexes };
        }
        return { kind: "candidates", candidates: value.candidates };
    }
    if (
        !Object.hasOwn(value, "candidates") &&
        !Object.hasOwn(value, "sourceIndexes") &&
        (value.kind === "none" || value.kind === "ambiguous")
    ) {
        return { kind: value.kind };
    }
    if (
        !Object.hasOwn(value, "candidates") &&
        !Object.hasOwn(value, "sourceIndexes") &&
        value.kind === "error"
    ) {
        return { kind: "error", error: "The app could not prepare this action. Please retry." };
    }
    return undefined;
}

const active = new Set<() => void>();
export function abortAppLocalProcessors(): void {
    for (const cancel of [...active]) cancel();
}
import.meta.hot?.dispose(abortAppLocalProcessors);

export async function processWithApp(
    registeredCardUrl: string,
    actionId: string,
    input: AppProcessorInput,
    stillCurrent: () => boolean = () => true,
): Promise<AppProcessorResult> {
    const unavailable = (): AppProcessorResult => ({
        kind: "error",
        error: "The app's local processor is unavailable. Refresh and retry.",
    });
    const viewer = currentUserIdStore.value;
    const current = () => currentUserIdStore.value === viewer && stillCurrent();
    if (
        !current() ||
        !supportsCredentiallessIframe() ||
        active.size >= MAX_ACTIVE ||
        (input.text !== undefined &&
            new TextEncoder().encode(input.text).byteLength > MAX_SOURCE_BYTES) ||
        (input.candidates !== undefined && !validAppProcessorCandidates(input.candidates)) ||
        ((input.operation === "normalize" || input.operation === "normalize_raw") &&
            input.candidates === undefined) ||
        (input.operation === "normalize_raw" &&
            (input.modality !== "image" || input.ocrTranscripts !== undefined)) ||
        !safeJson(input) ||
        bytes(input) > APP_PROCESSOR_MAX_BYTES
    )
        return unavailable();
    let url: URL;
    try {
        url = new URL(registeredCardUrl);
    } catch {
        return unavailable();
    }
    if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        (url.protocol === "http:" && !["127.0.0.1", "localhost"].includes(url.hostname))
    )
        return unavailable();
    url.searchParams.set("oc-app-process", "1");
    const nonce = () =>
        Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) =>
            byte.toString(16).padStart(2, "0"),
        ).join("");
    const binding = { frameNonce: nonce(), requestNonce: nonce() };
    return new Promise((resolve) => {
        const frame = document.createElement("iframe");
        frame.setAttribute("sandbox", "allow-scripts");
        frame.setAttribute("credentialless", "");
        frame.setAttribute("aria-hidden", "true");
        frame.referrerPolicy = "no-referrer";
        frame.hidden = true;
        let settled = false;
        let sent = false;
        const finish = (result: AppProcessorResult) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            clearInterval(bootstrapTimer);
            window.removeEventListener("message", receive);
            frame.remove();
            active.delete(cancel);
            resolve(result);
        };
        const cancel = () => finish(unavailable());
        const bootstrap = () => {
            if (!current()) return cancel();
            if (!sent)
                frame.contentWindow?.postMessage(
                    { type: PREFIX + "bootstrap", version: VERSION, ...binding },
                    "*",
                );
        };
        const receive = (event: MessageEvent) => {
            if (settled || event.source !== frame.contentWindow || event.origin !== "null") return;
            if (!current()) return cancel();
            const data: unknown = event.data;
            if (
                !record(data) ||
                data.frameNonce !== binding.frameNonce ||
                data.requestNonce !== binding.requestNonce ||
                data.version !== VERSION
            )
                return;
            if (!sent && data.type === PREFIX + "ready" && Object.keys(data).length === 4) {
                sent = true;
                frame.contentWindow?.postMessage(
                    { type: PREFIX + "request", version: VERSION, ...binding, actionId, input },
                    "*",
                );
            } else if (sent && data.type === PREFIX + "result") {
                finish(parseAppProcessorResult(data, binding, input.operation) ?? unavailable());
            }
        };
        const timeout = setTimeout(cancel, APP_PROCESSOR_TIMEOUT_MS);
        const bootstrapTimer = setInterval(bootstrap, 300);
        active.add(cancel);
        window.addEventListener("message", receive);
        frame.addEventListener("load", bootstrap);
        frame.addEventListener("error", cancel);
        frame.src = url.href;
        document.body.append(frame);
    });
}
