export const TRANSFORMERS_WEBGPU_AUDIO_SAMPLE_RATE = 16_000 as const;
export const TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES = 161;
export const TRANSFORMERS_WEBGPU_MAX_AUDIO_SAMPLES = 480_000;
export const TRANSFORMERS_WEBGPU_MAX_ENCODED_AUDIO_BYTES = 10 * 1024 * 1024;
export const TRANSFORMERS_WEBGPU_AUDIO_DECODE_TIMEOUT_MS = 15_000;
export const TRANSFORMERS_WEBGPU_AUDIO_CLOSE_TIMEOUT_MS = 2_000;

type DecodedAudioBuffer = {
    readonly length: number;
    readonly numberOfChannels: number;
    readonly sampleRate: number;
    getChannelData(channel: number): Float32Array;
};

type AudioContextLike = {
    decodeAudioData(bytes: ArrayBuffer): Promise<DecodedAudioBuffer>;
    close(): Promise<void>;
};

type AudioContextConstructor = new (options?: { sampleRate?: number }) => AudioContextLike;

type AudioDecodeOptions = {
    readonly decodeTimeoutMs?: number;
    readonly closeTimeoutMs?: number;
};

class AudioOperationTimeoutError extends Error {}

async function waitForAudioOperation<T>(
    operation: Promise<T>,
    timeoutMs: number,
    message: string,
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            operation,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new AudioOperationTimeoutError(message)),
                    timeoutMs,
                );
            }),
        ]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

function defaultAudioContext(): AudioContextConstructor | undefined {
    const scope = globalThis as typeof globalThis & {
        AudioContext?: AudioContextConstructor;
        webkitAudioContext?: AudioContextConstructor;
    };
    return scope.AudioContext ?? scope.webkitAudioContext;
}

function decodedDurationSamples(buffer: DecodedAudioBuffer): number {
    if (
        !Number.isSafeInteger(buffer.length) ||
        buffer.length < 1 ||
        !Number.isSafeInteger(buffer.numberOfChannels) ||
        buffer.numberOfChannels < 1 ||
        !Number.isFinite(buffer.sampleRate) ||
        buffer.sampleRate <= 0
    ) {
        throw new Error("The browser decoded an invalid voice-message audio shape.");
    }
    return Math.round((buffer.length * TRANSFORMERS_WEBGPU_AUDIO_SAMPLE_RATE) / buffer.sampleRate);
}

function mixToMono(buffer: DecodedAudioBuffer): Float32Array {
    const mono = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const samples = buffer.getChannelData(channel);
        if (samples.length !== buffer.length) {
            throw new Error("The browser decoded inconsistent voice-message channels.");
        }
        for (let index = 0; index < samples.length; index++) {
            const sample = samples[index];
            if (!Number.isFinite(sample)) {
                throw new Error("The decoded voice message contains a non-finite sample.");
            }
            mono[index] += sample / buffer.numberOfChannels;
        }
    }
    return mono;
}

/** Deterministic linear resampling is preprocessing, not a CPU model fallback. */
export function resampleMonoPcm(
    input: Float32Array,
    inputRate: number,
    outputRate = TRANSFORMERS_WEBGPU_AUDIO_SAMPLE_RATE,
): Float32Array {
    if (inputRate === outputRate) return input.slice();
    const outputLength = Math.round((input.length * outputRate) / inputRate);
    const output = new Float32Array(outputLength);
    if (outputLength === 1) {
        output[0] = input[0];
        return output;
    }
    const scale = (input.length - 1) / (outputLength - 1);
    for (let index = 0; index < outputLength; index++) {
        const source = index * scale;
        const left = Math.floor(source);
        const right = Math.min(input.length - 1, left + 1);
        const fraction = source - left;
        output[index] = input[left] * (1 - fraction) + input[right] * fraction;
    }
    return output;
}

/** Decode the actual encoded chat attachment, mix it to mono, and return exact 16 kHz PCM. */
export async function decodeTransformersWebGpuAudio(
    encoded: Uint8Array,
    mimeType: string,
    AudioContextClass: AudioContextConstructor | undefined = defaultAudioContext(),
    options: AudioDecodeOptions = {},
): Promise<Float32Array> {
    if (
        encoded.byteLength < 1 ||
        encoded.byteLength > TRANSFORMERS_WEBGPU_MAX_ENCODED_AUDIO_BYTES ||
        !/^audio\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:\s*;[^\r\n]{1,96})?$/iu.test(mimeType.trim())
    ) {
        throw new Error(
            "Voice input requires a bounded encoded audio file and its audio MIME type.",
        );
    }
    if (AudioContextClass === undefined) {
        throw new Error("This browser cannot decode voice messages for the local Gemma model.");
    }
    const context = new AudioContextClass({ sampleRate: TRANSFORMERS_WEBGPU_AUDIO_SAMPLE_RATE });
    const decodeTimeoutMs = options.decodeTimeoutMs ?? TRANSFORMERS_WEBGPU_AUDIO_DECODE_TIMEOUT_MS;
    const closeTimeoutMs = options.closeTimeoutMs ?? TRANSFORMERS_WEBGPU_AUDIO_CLOSE_TIMEOUT_MS;
    try {
        // decodeAudioData may detach its input. Never pass the caller-owned chat attachment buffer.
        const copy = encoded.slice().buffer as ArrayBuffer;
        let decoded: DecodedAudioBuffer;
        try {
            decoded = await waitForAudioOperation(
                context.decodeAudioData(copy),
                decodeTimeoutMs,
                "Voice-message decoding timed out in this browser.",
            );
        } catch (error) {
            if (error instanceof AudioOperationTimeoutError) throw error;
            throw new Error(
                "The browser could not decode this voice-message format for the local Gemma model.",
            );
        }
        const outputSamples = decodedDurationSamples(decoded);
        if (
            outputSamples < TRANSFORMERS_WEBGPU_MIN_AUDIO_SAMPLES ||
            outputSamples > TRANSFORMERS_WEBGPU_MAX_AUDIO_SAMPLES
        ) {
            throw new Error(
                "Gemma voice messages must be at least 11 ms and no longer than 30 seconds.",
            );
        }
        const samples = resampleMonoPcm(mixToMono(decoded), decoded.sampleRate);
        if (
            samples.length !== outputSamples ||
            samples.length > TRANSFORMERS_WEBGPU_MAX_AUDIO_SAMPLES
        ) {
            throw new Error("The decoded Gemma voice-message duration is invalid.");
        }
        return samples;
    } finally {
        await waitForAudioOperation(
            context.close(),
            closeTimeoutMs,
            "Voice-message decoder cleanup timed out.",
        ).catch(() => undefined);
    }
}
