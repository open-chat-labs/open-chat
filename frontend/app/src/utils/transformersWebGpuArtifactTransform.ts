import { sha256 } from "@noble/hashes/sha2.js";
import type { TransformersWebGpuArtifact } from "./transformersWebGpuProtocol";

const SOURCE_CHUNK_BYTES = 32 * 1024;
const TASK_OUTPUT_BYTES = 4 * 1024 * 1024;
const TASK_BUDGET_MS = 8;
const hex = (bytes: Uint8Array) =>
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const abortReason = (signal: AbortSignal) =>
    signal.reason ?? new DOMException("cancelled", "AbortError");

function requiredSource(artifact: TransformersWebGpuArtifact) {
    const source = artifact.source;
    if (source === undefined) throw new Error("Artifact has no pinned transform source.");
    const { start, end, totalBytes } = source.range;
    if (
        source.transform !== "bf16-le-to-f32-le" ||
        !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(source.repository) ||
        !/^[0-9a-f]{40}$/.test(source.revision) ||
        !source.path.split("/").every((part) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part)) ||
        ![start, end, totalBytes, source.bytes, artifact.bytes].every(Number.isSafeInteger) ||
        start < 0 ||
        end < start ||
        totalBytes <= end ||
        source.bytes <= 0 ||
        source.bytes !== end - start + 1 ||
        source.bytes % 2 !== 0 ||
        artifact.bytes !== source.bytes * 2 ||
        !/^[0-9a-f]{64}$/.test(source.sha256) ||
        !/^[0-9a-f]{64}$/.test(artifact.sha256)
    )
        throw new Error("Invalid pinned artifact transform source.");
    return source;
}

/** A single browser-safe range only; never request the complete source model as a fallback. */
export function transformersWebGpuArtifactSourceHeaders(
    artifact: TransformersWebGpuArtifact,
): { Range: string } | undefined {
    if (artifact.source === undefined) return undefined;
    const source = requiredSource(artifact);
    return { Range: `bytes=${source.range.start}-${source.range.end}` };
}

/**
 * Expand BF16 bit patterns into IEEE754 FP32 without float arithmetic (including signed zero,
 * subnormals and NaN payloads). CacheStorage consumes this backpressured stream; no model-sized
 * source/output buffer is allocated. Neither source nor output is accepted before both hashes pass.
 */
export async function transformTransformersWebGpuArtifactResponse(
    response: Response,
    artifact: TransformersWebGpuArtifact,
    signal?: AbortSignal,
): Promise<Response> {
    const source = requiredSource(artifact);
    const expectedRange = `bytes ${source.range.start}-${source.range.end}/${source.range.totalBytes}`;
    const encoding = response.headers.get("content-encoding");
    if (
        response.status !== 206 ||
        response.body === null ||
        response.headers.get("content-range") !== expectedRange ||
        response.headers.get("content-length") !== String(source.bytes) ||
        (encoding !== null && encoding !== "identity")
    ) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`${artifact.path} requires the exact pinned HTTP 206 byte range.`);
    }
    if (signal?.aborted) {
        await response.body.cancel(abortReason(signal)).catch(() => undefined);
        throw abortReason(signal);
    }

    const reader = response.body.getReader();
    const sourceDigest = sha256.create();
    const outputDigest = sha256.create();
    let pending = new Uint8Array(0);
    let offset = 0;
    let carry: number | undefined;
    let received = 0;
    let produced = 0;
    let taskBytes = 0;
    let taskMs = 0;
    let terminal = false;
    let outputController: ReadableStreamDefaultController<Uint8Array>;
    const cleanup = () => {
        signal?.removeEventListener("abort", abort);
        sourceDigest.destroy();
        outputDigest.destroy();
        pending = new Uint8Array(0);
    };
    const fail = (reason: unknown) => {
        if (terminal) return;
        terminal = true;
        cleanup();
        outputController.error(reason);
        void reader
            .cancel(reason)
            .catch(() => undefined)
            .finally(() => reader.releaseLock());
    };
    const abort = () => fail(abortReason(signal!));
    const body = new ReadableStream<Uint8Array>(
        {
            start(controller) {
                outputController = controller;
                signal?.addEventListener("abort", abort, { once: true });
                if (signal?.aborted) abort();
            },
            async pull(controller) {
                try {
                    if (terminal) return;
                    while (offset === pending.byteLength) {
                        const next = await reader.read();
                        if (terminal) return;
                        if (next.done) {
                            if (
                                received !== source.bytes ||
                                carry !== undefined ||
                                produced !== artifact.bytes ||
                                hex(sourceDigest.digest()) !== source.sha256 ||
                                hex(outputDigest.digest()) !== artifact.sha256
                            )
                                throw new Error(
                                    `${artifact.path} failed its pinned source/output SHA-256 or size check.`,
                                );
                            terminal = true;
                            cleanup();
                            reader.releaseLock();
                            controller.close();
                            return;
                        }
                        if (next.value.byteLength > source.bytes - received)
                            throw new Error(`${artifact.path} source exceeded its pinned size.`);
                        pending = next.value;
                        offset = 0;
                        // Even empty producer chunks cannot starve cancellation/rendering indefinitely.
                        if (pending.byteLength === 0)
                            await new Promise<void>((resolve) => setTimeout(resolve, 0));
                    }
                    const started = performance.now();
                    const chunk = pending.subarray(offset, offset + SOURCE_CHUNK_BYTES);
                    offset += chunk.byteLength;
                    sourceDigest.update(chunk);
                    received += chunk.byteLength;
                    const output = new Uint8Array(
                        Math.floor((chunk.byteLength + (carry === undefined ? 0 : 1)) / 2) * 4,
                    );
                    let inputOffset = 0;
                    let outputOffset = 0;
                    if (carry !== undefined && chunk.byteLength > 0) {
                        output[2] = carry;
                        output[3] = chunk[inputOffset++];
                        outputOffset = 4;
                        carry = undefined;
                    }
                    while (inputOffset + 1 < chunk.byteLength) {
                        output[outputOffset + 2] = chunk[inputOffset++];
                        output[outputOffset + 3] = chunk[inputOffset++];
                        outputOffset += 4;
                    }
                    if (inputOffset < chunk.byteLength) carry = chunk[inputOffset];
                    outputDigest.update(output);
                    produced += output.byteLength;
                    taskBytes += output.byteLength;
                    taskMs += performance.now() - started;
                    if (taskBytes >= TASK_OUTPUT_BYTES || taskMs >= TASK_BUDGET_MS) {
                        await new Promise<void>((resolve) => setTimeout(resolve, 0));
                        taskBytes = 0;
                        taskMs = 0;
                    }
                    // A single odd source byte still satisfies this pull with an empty chunk;
                    // withholding it would strand a pending read with a zero-watermark stream.
                    if (!terminal) controller.enqueue(output);
                } catch (error) {
                    fail(error);
                }
            },
            async cancel(reason) {
                if (terminal) return;
                terminal = true;
                cleanup();
                try {
                    await reader.cancel(reason);
                } finally {
                    reader.releaseLock();
                }
            },
        },
        { highWaterMark: 0 },
    );
    return new Response(body, {
        status: 200,
        statusText: "OK",
        headers: {
            "content-type": "application/octet-stream",
            "content-length": String(artifact.bytes),
            "x-content-sha256": artifact.sha256,
        },
    });
}
