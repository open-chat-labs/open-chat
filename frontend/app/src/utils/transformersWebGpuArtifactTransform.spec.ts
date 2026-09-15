import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    transformTransformersWebGpuArtifactResponse,
    transformersWebGpuArtifactSourceHeaders,
} from "./transformersWebGpuArtifactTransform";
import * as protocol from "./transformersWebGpuProtocol";
import type { TransformersWebGpuArtifact } from "./transformersWebGpuProtocol";
import {
    preloadTransformersWebGpuModel,
    transformersWebGpuArtifactDownloadUrl,
    transformersWebGpuModelArtifactsDownloaded,
    transformersWebGpuModelArtifactsPresent,
    type TransformersWebGpuArtifactCache,
} from "./transformersWebGpuInference";

// These public-downloader tests isolate artifact handling. Existing inference suites exercise the
// real worker/ORT selection gates; no runtime or model weights are downloaded by these fixtures.
vi.mock("./transformersWebGpuProtocol", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./transformersWebGpuProtocol")>()),
    TRANSFORMERS_WEBGPU_RUNTIME_ASSETS: [],
}));

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const bf16 = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x80, // +/- zero
    0x01,
    0x00,
    0x01,
    0x80, // +/- smallest subnormal
    0x80,
    0x3f,
    0x80,
    0xbf, // +/- one
    0x80,
    0x7f,
    0x80,
    0xff, // +/- infinity
    0x81,
    0x7f,
    0xc1,
    0xff, // signaling/quiet NaN payloads and sign
]);
const fp32 = new Uint8Array([
    0, 0, 0x00, 0x00, 0, 0, 0x00, 0x80, 0, 0, 0x01, 0x00, 0, 0, 0x01, 0x80, 0, 0, 0x80, 0x3f, 0, 0,
    0x80, 0xbf, 0, 0, 0x80, 0x7f, 0, 0, 0x80, 0xff, 0, 0, 0x81, 0x7f, 0, 0, 0xc1, 0xff,
]);
function artifactFor(sourceBytes = bf16, outputBytes = fp32): TransformersWebGpuArtifact {
    return {
        path: "onnx/derived.onnx_data",
        bytes: outputBytes.length,
        sha256: digest(outputBytes),
        source: {
            repository: "fixture/model",
            revision: "a".repeat(40),
            path: "model.safetensors",
            range: {
                start: 100,
                end: 99 + sourceBytes.length,
                totalBytes: 1000 + sourceBytes.length,
            },
            bytes: sourceBytes.length,
            sha256: digest(sourceBytes),
            transform: "bf16-le-to-f32-le",
        },
    };
}
function responseFor(
    artifact = artifactFor(),
    chunks: Uint8Array[] = [bf16],
    overrides: ResponseInit = {},
) {
    const source = artifact.source!;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
        },
        pull(controller) {
            controller.close();
        },
        cancel,
    });
    const response = new Response(stream, {
        status: 206,
        headers: {
            "content-range": `bytes ${source.range.start}-${source.range.end}/${source.range.totalBytes}`,
            "content-length": String(source.bytes),
        },
        ...overrides,
    });
    return { response, cancel };
}
async function transformedBytes(
    response: Response,
    artifact = artifactFor(),
    signal?: AbortSignal,
) {
    const output = await transformTransformersWebGpuArtifactResponse(response, artifact, signal);
    return new Uint8Array(await output.arrayBuffer());
}
afterEach(() => vi.restoreAllMocks());

describe("pinned ranged artifact transformation", () => {
    it.each(Array.from({ length: bf16.length + 1 }, (_, split) => split))(
        "preserves exact IEEE754 bits at split %i (including odd-byte carry)",
        async (split) => {
            const { response } = responseFor(artifactFor(), [
                bf16.slice(0, split),
                bf16.slice(split),
            ]);
            expect(await transformedBytes(response)).toEqual(fp32);
        },
    );
    it("handles one-byte chunks without float conversion or NaN canonicalization", async () => {
        const { response } = responseFor(
            artifactFor(),
            Array.from(bf16, (byte) => new Uint8Array([byte])),
        );
        expect(await transformedBytes(response)).toEqual(fp32);
    });
    it("requests only one range and strips source response metadata from derived cache bytes", async () => {
        const artifact = artifactFor();
        expect(transformersWebGpuArtifactSourceHeaders(artifact)).toEqual({
            Range: "bytes=100-119",
        });
        expect(
            transformersWebGpuArtifactSourceHeaders({
                path: "plain",
                bytes: 1,
                sha256: "a".repeat(64),
            }),
        ).toBeUndefined();
        const { response } = responseFor();
        response.headers.set("content-encoding", "identity");
        response.headers.set("etag", "source-etag");
        response.headers.set("x-source-length", "1020");
        const output = await transformTransformersWebGpuArtifactResponse(response, artifact);
        expect(output.status).toBe(200);
        expect(Object.fromEntries(output.headers)).toEqual({
            "content-length": "40",
            "content-type": "application/octet-stream",
            "x-content-sha256": artifact.sha256,
        });
        expect(new Uint8Array(await output.arrayBuffer())).toEqual(fp32);
    });
    it.each([
        { label: "full-file HTTP 200", status: 200 },
        { label: "missing range", range: null },
        { label: "wrong range start", range: "bytes 99-119/1020" },
        { label: "wrong range end", range: "bytes 100-120/1020" },
        { label: "wrong total", range: "bytes 100-119/1021" },
        { label: "wildcard total", range: "bytes 100-119/*" },
        { label: "multi range", range: "bytes 100-119/1020, bytes 130-140/1020" },
        { label: "missing length", length: null },
        { label: "wrong length", length: "21" },
        { label: "compressed body", encoding: "gzip" },
    ])("cancels $label before consuming the body", async ({ status, range, length, encoding }) => {
        const { response, cancel } = responseFor(artifactFor(), [bf16], { status: status ?? 206 });
        if (range === null) response.headers.delete("content-range");
        else if (range !== undefined) response.headers.set("content-range", range);
        if (length === null) response.headers.delete("content-length");
        else if (length !== undefined) response.headers.set("content-length", length);
        if (encoding !== undefined) response.headers.set("content-encoding", encoding);
        const read = vi.spyOn(response.body!, "getReader");
        await expect(
            transformTransformersWebGpuArtifactResponse(response, artifactFor()),
        ).rejects.toThrow("exact pinned HTTP 206");
        expect(cancel).toHaveBeenCalledOnce();
        expect(read).not.toHaveBeenCalled();
    });
    it.each([
        { label: "same-size corrupt source", bytes: new Uint8Array(bf16).fill(0) },
        { label: "truncated even source", bytes: bf16.slice(0, -2) },
        { label: "truncated odd source", bytes: bf16.slice(0, -1) },
        { label: "oversized source", bytes: new Uint8Array([...bf16, 0, 0]) },
    ])("rejects $label", async ({ bytes }) => {
        const { response } = responseFor(artifactFor(), [bytes]);
        await expect(transformedBytes(response)).rejects.toThrow(/pinned/);
    });
    it.each(["source", "output"] as const)("rejects a mismatching %s hash", async (which) => {
        const original = artifactFor();
        const artifact =
            which === "source"
                ? { ...original, source: { ...original.source!, sha256: "0".repeat(64) } }
                : { ...original, sha256: "0".repeat(64) };
        await expect(transformedBytes(responseFor(artifact).response, artifact)).rejects.toThrow(
            "SHA-256",
        );
    });
    it.each([
        {
            label: "odd source length",
            source: { bytes: 19, range: { start: 100, end: 118, totalBytes: 1020 } },
        },
        {
            label: "range length mismatch",
            source: { range: { start: 100, end: 120, totalBytes: 1020 } },
        },
        { label: "range past total", source: { range: { start: 100, end: 119, totalBytes: 119 } } },
        { label: "negative start", source: { range: { start: -1, end: 18, totalBytes: 1020 } } },
        {
            label: "unsafe offset",
            source: {
                range: {
                    start: Number.MAX_SAFE_INTEGER + 1,
                    end: Number.MAX_SAFE_INTEGER + 20,
                    totalBytes: Number.MAX_SAFE_INTEGER + 40,
                },
            },
        },
        { label: "mutable revision", source: { revision: "main" } },
        { label: "path escape", source: { path: "../model.safetensors" } },
        { label: "repository escape", source: { repository: "https://other.test/model" } },
        { label: "relative repository", source: { repository: "fixture/.." } },
        { label: "unsupported transform", source: { transform: "other" } },
        { label: "malformed source hash", source: { sha256: "not-a-hash" } },
    ])("rejects malformed manifest: $label before any request", ({ source }) => {
        const artifact = artifactFor();
        expect(() =>
            transformersWebGpuArtifactSourceHeaders({
                ...artifact,
                source: { ...artifact.source!, ...source } as NonNullable<
                    TransformersWebGpuArtifact["source"]
                >,
            }),
        ).toThrow("Invalid pinned");
    });
    it("rejects output size/hash inconsistencies before any request", () => {
        for (const change of [{ bytes: 39 }, { sha256: "bad" }])
            expect(() =>
                transformersWebGpuArtifactSourceHeaders({ ...artifactFor(), ...change }),
            ).toThrow("Invalid pinned");
    });
    it("forwards consumer cancellation without reading the source", async () => {
        const { response, cancel } = responseFor();
        const output = await transformTransformersWebGpuArtifactResponse(response, artifactFor());
        const reason = new Error("cache consumer stopped");
        await output.body!.cancel(reason);
        expect(cancel).toHaveBeenCalledExactlyOnceWith(reason);
    });
    it("aborts a blocked upstream read promptly and cancels that reader", async () => {
        const controller = new AbortController();
        const cancel = vi.fn();
        const response = responseFor().response;
        const blocked = new Response(new ReadableStream<Uint8Array>({ cancel }), {
            status: 206,
            headers: response.headers,
        });
        const output = await transformTransformersWebGpuArtifactResponse(
            blocked,
            artifactFor(),
            controller.signal,
        );
        const consumption = output.arrayBuffer();
        const reason = new Error("cancelled while waiting");
        controller.abort(reason);
        await expect(consumption).rejects.toBe(reason);
        expect(cancel).toHaveBeenCalledExactlyOnceWith(reason);
    });
    it("does not consume an already-aborted response", async () => {
        const controller = new AbortController();
        const reason = new Error("already cancelled");
        controller.abort(reason);
        const { response, cancel } = responseFor();
        await expect(
            transformTransformersWebGpuArtifactResponse(response, artifactFor(), controller.signal),
        ).rejects.toBe(reason);
        expect(cancel).toHaveBeenCalledExactlyOnceWith(reason);
    });
    it("bounds output chunks and yields to timer cancellation for one oversized input chunk", async () => {
        const source = new Uint8Array(3 * 1024 * 1024);
        const output = new Uint8Array(source.length * 2);
        const artifact = artifactFor(source, output);
        const cancel = vi.fn();
        const response = new Response(
            new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(source);
                },
                cancel,
            }),
            { status: 206, headers: responseFor(artifact).response.headers },
        );
        const abortController = new AbortController();
        const reason = new Error("cancelled by UI timer");
        const transformed = await transformTransformersWebGpuArtifactResponse(
            response,
            artifact,
            abortController.signal,
        );
        const reader = transformed.body!.getReader();
        const first = await reader.read();
        expect(first.done).toBe(false);
        let largest = first.value!.length;
        let received = first.value!.length;
        const timer = setTimeout(() => abortController.abort(reason), 0);
        try {
            await expect(
                (async () => {
                    while (true) {
                        const next = await reader.read();
                        if (next.done) break;
                        largest = Math.max(largest, next.value.length);
                        received += next.value.length;
                    }
                })(),
            ).rejects.toBe(reason);
            expect(largest).toBeGreaterThan(0);
            expect(largest).toBeLessThanOrEqual(64 * 1024);
            expect(received).toBeLessThan(artifact.bytes);
            expect(cancel).toHaveBeenCalledOnce();
        } finally {
            clearTimeout(timer);
            reader.releaseLock();
        }
    });
});

function modelFixture(artifact: TransformersWebGpuArtifact) {
    const retainedBytes = new Uint8Array([1, 2, 3, 4]);
    const retained = {
        path: "retained.bin",
        bytes: retainedBytes.length,
        sha256: digest(retainedBytes),
    };
    const original = protocol.transformersWebGpuModelSpec(protocol.PHONE_QWEN3_VL_2B_MODEL_ID)!;
    const spec = {
        ...original,
        artifacts: [retained, artifact],
        artifactBytes: retained.bytes + artifact.bytes,
    };
    vi.spyOn(protocol, "transformersWebGpuModelSpec").mockReturnValue(spec);
    const baseUrl = "https://phone.test/";
    const urlFor = (path: string) =>
        `${baseUrl}hf-model/${spec.repository}/resolve/${spec.revision}/${path}`;
    const retainedResponse = new Response(retainedBytes, {
        headers: {
            "content-length": String(retained.bytes),
            "x-content-sha256": retained.sha256,
        },
    });
    const entries = new Map([[urlFor(retained.path), retainedResponse]]);
    const cache: TransformersWebGpuArtifactCache = {
        match: vi.fn(async (request) => entries.get(String(request))?.clone()),
        put: vi.fn(async (request, response) => {
            const body = await response.arrayBuffer();
            entries.set(
                String(request),
                new Response(body, { status: response.status, headers: response.headers }),
            );
        }),
        delete: vi.fn(async (request) => entries.delete(String(request))),
    };
    return {
        spec,
        retained,
        retainedResponse,
        entries,
        cache,
        urlFor,
        options: {
            cacheStorage: { open: vi.fn(async (_name: string) => cache) },
            baseUrl,
            packagedAndroid: true,
        },
    };
}
describe("derived artifacts through the actual model downloader", () => {
    it("selects immutable source URLs and never substitutes the output artifact URL", () => {
        const artifact = artifactFor();
        modelFixture(artifact);
        expect(
            transformersWebGpuArtifactDownloadUrl(artifact.path, {
                baseUrl: "https://dev.test/",
                packagedAndroid: false,
            }),
        ).toBe(
            `https://dev.test/hf-model/fixture/model/resolve/${"a".repeat(40)}/model.safetensors`,
        );
        expect(
            transformersWebGpuArtifactDownloadUrl(artifact.path, { packagedAndroid: true }),
        ).toBe(`https://huggingface.co/fixture/model/resolve/${"a".repeat(40)}/model.safetensors`);
    });
    it("retains verified weights, fetches only the range, and commits verified 200 output at the original cache key", async () => {
        const artifact = artifactFor();
        const fixture = modelFixture(artifact);
        const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            expect(init?.headers).toEqual({ Range: "bytes=100-119" });
            expect(init?.cache).toBe("no-store");
            return responseFor(artifact).response;
        });
        const progress: number[] = [];
        await preloadTransformersWebGpuModel(fixture.spec.id, {
            ...fixture.options,
            fetcher,
            onProgress: (received, total) => {
                expect(total).toBe(44);
                progress.push(received);
            },
        });
        expect(fetcher).toHaveBeenCalledOnce();
        expect(fixture.cache.delete).not.toHaveBeenCalled();
        expect(fixture.entries.get(fixture.urlFor(fixture.retained.path))).toBe(
            fixture.retainedResponse,
        );
        const stored = fixture.entries.get(fixture.urlFor(artifact.path))!;
        expect(stored.status).toBe(200);
        expect(stored.headers.get("content-range")).toBeNull();
        expect(stored.headers.get("content-length")).toBe("40");
        expect(new Uint8Array(await stored.clone().arrayBuffer())).toEqual(fp32);
        expect(progress.at(-1)).toBe(44);
        await expect(
            transformersWebGpuModelArtifactsDownloaded(fixture.spec.id, fixture.options),
        ).resolves.toBe(true);
    });
    it("removes an interrupted partial cache write and leaves no ready artifact", async () => {
        const artifact = artifactFor();
        const fixture = modelFixture(artifact);
        const controller = new AbortController();
        const reason = new Error("cancelled after first transformed chunk");
        const cancel = vi.fn();
        let first = true;
        const fetcher = vi.fn(
            async () =>
                new Response(
                    new ReadableStream<Uint8Array>(
                        {
                            pull(stream) {
                                if (first) {
                                    first = false;
                                    stream.enqueue(bf16.slice(0, 2));
                                } else controller.abort(reason);
                            },
                            cancel,
                        },
                        { highWaterMark: 0 },
                    ),
                    { status: 206, headers: responseFor().response.headers },
                ),
        );
        await expect(
            preloadTransformersWebGpuModel(fixture.spec.id, {
                ...fixture.options,
                fetcher,
                signal: controller.signal,
            }),
        ).rejects.toBe(reason);
        expect(fixture.cache.put).toHaveBeenCalledOnce();
        expect(fixture.cache.delete).toHaveBeenCalledExactlyOnceWith(fixture.urlFor(artifact.path));
        expect(cancel).toHaveBeenCalledExactlyOnceWith(reason);
        expect(fixture.entries.has(fixture.urlFor(artifact.path))).toBe(false);
        expect(fixture.entries.get(fixture.urlFor(fixture.retained.path))).toBe(
            fixture.retainedResponse,
        );
        await expect(
            transformersWebGpuModelArtifactsDownloaded(fixture.spec.id, fixture.options),
        ).resolves.toBe(false);
    });
    it.each(["bad-source", "bad-output", "truncated", "http200", "abort"] as const)(
        "never leaves partial ready output after %s",
        async (failure) => {
            const artifact = artifactFor();
            const expected =
                failure === "bad-output" ? { ...artifact, sha256: "0".repeat(64) } : artifact;
            const fixture = modelFixture(expected);
            const abortController = new AbortController();
            const fetcher = vi.fn(async () => {
                if (failure === "abort") abortController.abort(new Error("cancelled download"));
                return responseFor(
                    expected,
                    [
                        failure === "truncated"
                            ? bf16.slice(0, -1)
                            : failure === "bad-source"
                              ? new Uint8Array(bf16.length)
                              : bf16,
                    ],
                    { status: failure === "http200" ? 200 : 206 },
                ).response;
            });
            await expect(
                preloadTransformersWebGpuModel(fixture.spec.id, {
                    ...fixture.options,
                    fetcher,
                    signal: abortController.signal,
                }),
            ).rejects.toThrow();
            expect(fetcher).toHaveBeenCalledOnce();
            expect(fixture.entries.has(fixture.urlFor(artifact.path))).toBe(false);
            expect(fixture.entries.get(fixture.urlFor(fixture.retained.path))).toBe(
                fixture.retainedResponse,
            );
            await expect(
                transformersWebGpuModelArtifactsPresent(fixture.spec.id, fixture.options),
            ).resolves.toBe(false);
            await expect(
                transformersWebGpuModelArtifactsDownloaded(fixture.spec.id, fixture.options),
            ).resolves.toBe(false);
        },
    );
});
