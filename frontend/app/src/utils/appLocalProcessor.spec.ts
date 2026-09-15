import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { user, supported } = vi.hoisted(() => ({
    user: { value: "viewer-a" },
    supported: vi.fn(() => true),
}));
vi.mock("@client", () => ({ currentUserIdStore: user }));
vi.mock("./cardBridge", () => ({ supportsCredentiallessIframe: supported }));
import {
    abortAppLocalProcessors,
    appLocalProcessorSupports,
    APP_PROCESSOR_TIMEOUT_MS,
    parseAppProcessorResult,
    processWithApp,
    validAppProcessorCandidates,
} from "./appLocalProcessor";

const binding = { frameNonce: "a".repeat(48), requestNonce: "b".repeat(48) };
const envelope = {
    type: "oc:app-process:result",
    version: 1,
    ...binding,
    kind: "candidates",
    candidates: [{ specimen: "fern", measurements: [12, 16] }],
};
beforeEach(() => {
    vi.useFakeTimers();
    user.value = "viewer-a";
    supported.mockReturnValue(true);
});
afterEach(() => {
    abortAppLocalProcessors();
    vi.useRealTimers();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
});

describe("registered app local processor contract", () => {
    it("requires ordered source-index bindings only for the new raw-normalization operation", () => {
        const raw = { ...envelope, sourceIndexes: [0] };
        expect(parseAppProcessorResult(raw, binding, "normalize_raw")).toEqual({
            kind: "candidates",
            candidates: envelope.candidates,
            sourceIndexes: [0],
        });
        expect(parseAppProcessorResult(raw, binding)).toBeUndefined();
        expect(parseAppProcessorResult(envelope, binding, "normalize_raw")).toBeUndefined();
        for (const sourceIndexes of [[], [1], [0, 1], ["0"], [NaN], Array(1)]) {
            expect(
                parseAppProcessorResult({ ...raw, sourceIndexes }, binding, "normalize_raw"),
            ).toBeUndefined();
        }
        expect(
            parseAppProcessorResult(
                { ...raw, kind: "none", candidates: undefined },
                binding,
                "normalize_raw",
            ),
        ).toBeUndefined();
    });
    it("does not send raw normalization without image candidates or with private-reader transcripts", async () => {
        for (const input of [
            {
                operation: "normalize_raw" as const,
                modality: "text" as const,
                candidates: [{ raw: "42" }],
            },
            { operation: "normalize_raw" as const, modality: "image" as const },
            {
                operation: "normalize_raw" as const,
                modality: "image" as const,
                candidates: [{ raw: "42" }],
                ocrTranscripts: [],
            },
        ]) {
            expect((await processWithApp("https://app.test/card", "observe", input)).kind).toBe(
                "error",
            );
            expect(document.querySelector("iframe")).toBeNull();
        }
    });
    it("accepts only the bounded generic opt-in", () => {
        expect(appLocalProcessorSupports({ "x-openchat-local-processor": { version: 1 } })).toBe(
            true,
        );
        expect(
            appLocalProcessorSupports({
                "x-openchat-local-processor": { version: 1, field: "specimen" },
            }),
        ).toBe(false);
        expect(appLocalProcessorSupports(undefined)).toBe(false);
    });
    it("transports arbitrary nested app fields without interpretation", () => {
        expect(parseAppProcessorResult(envelope, binding)).toEqual({
            kind: "candidates",
            candidates: envelope.candidates,
        });
    });
    it("rejects stale binding, unknown envelope data, prototypes, oversized and nonfinite data", () => {
        expect(
            parseAppProcessorResult({ ...envelope, requestNonce: "old" }, binding),
        ).toBeUndefined();
        expect(
            parseAppProcessorResult({ ...envelope, metadata: "private" }, binding),
        ).toBeUndefined();
        expect(validAppProcessorCandidates([JSON.parse('{"__proto__":{"polluted":true}}')])).toBe(
            false,
        );
        expect(validAppProcessorCandidates([{ value: Infinity }])).toBe(false);
        expect(validAppProcessorCandidates([{ value: "x".repeat(65537) }])).toBe(false);
        expect(validAppProcessorCandidates([])).toBe(false);
    });
    it("requires credentialless isolation", async () => {
        supported.mockReturnValue(false);
        expect(
            (
                await processWithApp("https://app.test/card", "observe", {
                    operation: "extract",
                    modality: "text",
                    text: "fern",
                })
            ).kind,
        ).toBe("error");
        expect(document.querySelector("iframe")).toBeNull();
    });
    it("binds egress to the exact opaque frame handshake and cleans up after one result", async () => {
        const pending = processWithApp("https://app.test/card", "observe", {
            operation: "extract",
            modality: "text",
            text: "fern",
        });
        const frame = document.querySelector("iframe")!;
        expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
        expect(frame.hasAttribute("credentialless")).toBe(true);
        expect(frame.referrerPolicy).toBe("no-referrer");
        const post = vi.spyOn(frame.contentWindow!, "postMessage").mockImplementation(() => {});
        await vi.advanceTimersByTimeAsync(300);
        const bootstrap = post.mock.calls[0][0] as Record<string, unknown>;
        const ready = { ...bootstrap, type: "oc:app-process:ready" };
        window.dispatchEvent(
            new MessageEvent("message", { source: window, origin: "null", data: ready }),
        );
        window.dispatchEvent(
            new MessageEvent("message", {
                source: frame.contentWindow,
                origin: "https://app.test",
                data: ready,
            }),
        );
        expect(post).toHaveBeenCalledTimes(1);
        window.dispatchEvent(
            new MessageEvent("message", {
                source: frame.contentWindow,
                origin: "null",
                data: ready,
            }),
        );
        expect(post).toHaveBeenCalledTimes(2);
        expect(post.mock.calls[1][0]).toMatchObject({
            type: "oc:app-process:request",
            input: { text: "fern" },
        });
        window.dispatchEvent(
            new MessageEvent("message", {
                source: frame.contentWindow,
                origin: "null",
                data: {
                    ...bootstrap,
                    type: "oc:app-process:result",
                    kind: "candidates",
                    candidates: [{ specimen: "fern" }],
                },
            }),
        );
        expect(await pending).toEqual({ kind: "candidates", candidates: [{ specimen: "fern" }] });
        expect(document.querySelector("iframe")).toBeNull();
    });
    it("expires stalled app documents and cancels a changed account before source egress", async () => {
        const first = processWithApp("https://app.test/card", "observe", {
            operation: "extract",
            modality: "text",
            text: "fern",
        });
        await vi.advanceTimersByTimeAsync(APP_PROCESSOR_TIMEOUT_MS);
        expect((await first).kind).toBe("error");
        const second = processWithApp("https://app.test/card", "observe", {
            operation: "extract",
            modality: "text",
            text: "fern",
        });
        user.value = "viewer-b";
        await vi.advanceTimersByTimeAsync(300);
        expect((await second).kind).toBe("error");
        expect(document.querySelector("iframe")).toBeNull();
    });
});
