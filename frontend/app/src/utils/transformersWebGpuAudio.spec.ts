import { describe, expect, it, vi } from "vitest";
import {
    decodeTransformersWebGpuAudio,
    resampleMonoPcm,
    TRANSFORMERS_WEBGPU_AUDIO_SAMPLE_RATE,
    TRANSFORMERS_WEBGPU_MAX_AUDIO_SAMPLES,
    TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES,
} from "./transformersWebGpuAudio";

class FakeAudioContext {
    static decoded = {
        length: TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES,
        numberOfChannels: 2,
        sampleRate: 16_000,
        getChannelData: (channel: number) => {
            const samples = new Float32Array(TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES);
            samples.set(
                channel === 0
                    ? new Float32Array([1, 0.5, 0, -1])
                    : new Float32Array([-1, 0.5, 0, 1]),
            );
            return samples;
        },
    };
    static receivedOptions: unknown;
    static closed = vi.fn(async (): Promise<void> => undefined);

    constructor(options?: unknown) {
        FakeAudioContext.receivedOptions = options;
    }

    async decodeAudioData(_bytes: ArrayBuffer) {
        return FakeAudioContext.decoded;
    }

    close(): Promise<void> {
        return FakeAudioContext.closed();
    }
}

describe("Gemma voice-message decoding", () => {
    it("decodes the encoded attachment, mixes channels, and returns exact 16 kHz PCM", async () => {
        FakeAudioContext.closed.mockClear();
        const result = await decodeTransformersWebGpuAudio(
            new Uint8Array([1, 2, 3]),
            "audio/webm;codecs=opus",
            FakeAudioContext,
        );
        expect(FakeAudioContext.receivedOptions).toEqual({
            sampleRate: TRANSFORMERS_WEBGPU_AUDIO_SAMPLE_RATE,
        });
        expect(result).toHaveLength(TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES);
        expect([...result.slice(0, 4)]).toEqual([0, 0.5, 0, 0]);
        expect(FakeAudioContext.closed).toHaveBeenCalledOnce();
    });

    it("resamples deterministically without changing an already-16k source", () => {
        expect([...resampleMonoPcm(new Float32Array([0, 1, 0]), 16_000)]).toEqual([0, 1, 0]);
        expect(resampleMonoPcm(new Float32Array([0, 1, 0]), 8_000)).toEqual(
            new Float32Array([0, 0.4, 0.8, 0.8, 0.4, 0]),
        );
    });

    it("accepts exactly 30 seconds and rejects the next sample without truncation", async () => {
        FakeAudioContext.decoded = {
            length: TRANSFORMERS_WEBGPU_MAX_AUDIO_SAMPLES,
            numberOfChannels: 1,
            sampleRate: 16_000,
            getChannelData: () => new Float32Array(TRANSFORMERS_WEBGPU_MAX_AUDIO_SAMPLES),
        };
        await expect(
            decodeTransformersWebGpuAudio(new Uint8Array([1]), "audio/ogg", FakeAudioContext),
        ).resolves.toHaveLength(TRANSFORMERS_WEBGPU_MAX_AUDIO_SAMPLES);

        FakeAudioContext.decoded = {
            ...FakeAudioContext.decoded,
            length: TRANSFORMERS_WEBGPU_MAX_AUDIO_SAMPLES + 1,
            getChannelData: () => new Float32Array(TRANSFORMERS_WEBGPU_MAX_AUDIO_SAMPLES + 1),
        };
        await expect(
            decodeTransformersWebGpuAudio(new Uint8Array([1]), "audio/ogg", FakeAudioContext),
        ).rejects.toThrow("no longer than 30 seconds");
    });

    it("rejects audio too short to produce a Gemma feature frame", async () => {
        FakeAudioContext.decoded = {
            length: TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES - 1,
            numberOfChannels: 1,
            sampleRate: 16_000,
            getChannelData: () => new Float32Array(TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES - 1),
        };
        await expect(
            decodeTransformersWebGpuAudio(new Uint8Array([1]), "audio/ogg", FakeAudioContext),
        ).rejects.toThrow("at least 11 ms");
    });

    it("fails closed for undecodable media and still closes the context", async () => {
        class BrokenAudioContext extends FakeAudioContext {
            override async decodeAudioData(_bytes: ArrayBuffer): Promise<never> {
                throw new Error("codec failed");
            }
        }
        FakeAudioContext.closed.mockClear();
        await expect(
            decodeTransformersWebGpuAudio(new Uint8Array([1]), "audio/webm", BrokenAudioContext),
        ).rejects.toThrow("could not decode");
        expect(FakeAudioContext.closed).toHaveBeenCalledOnce();
    });

    it("bounds a stalled codec and still attempts bounded context cleanup", async () => {
        vi.useFakeTimers();
        const close = vi.fn(async () => undefined);
        class StalledAudioContext {
            decodeAudioData(): Promise<never> {
                return new Promise<never>(() => undefined);
            }
            close() {
                return close();
            }
        }
        const pending = decodeTransformersWebGpuAudio(
            new Uint8Array([1]),
            "audio/webm",
            StalledAudioContext,
            { decodeTimeoutMs: 20, closeTimeoutMs: 10 },
        );
        const rejection = expect(pending).rejects.toThrow("decoding timed out");
        await vi.advanceTimersByTimeAsync(20);
        await rejection;
        expect(close).toHaveBeenCalledOnce();
        vi.useRealTimers();
    });

    it("does not let a stalled AudioContext close block decoded PCM", async () => {
        vi.useFakeTimers();
        class StalledCloseAudioContext extends FakeAudioContext {
            override close(): Promise<void> {
                return new Promise<void>(() => undefined);
            }
        }
        FakeAudioContext.decoded = {
            length: TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES,
            numberOfChannels: 1,
            sampleRate: 16_000,
            getChannelData: () => new Float32Array(TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES),
        };
        const pending = decodeTransformersWebGpuAudio(
            new Uint8Array([1]),
            "audio/webm",
            StalledCloseAudioContext,
            { decodeTimeoutMs: 20, closeTimeoutMs: 10 },
        );
        await vi.advanceTimersByTimeAsync(10);
        await expect(pending).resolves.toHaveLength(TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES);
        vi.useRealTimers();
    });
});
