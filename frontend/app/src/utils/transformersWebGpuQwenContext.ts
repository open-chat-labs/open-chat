// This is the pinned decoder's evaluated causal-table capacity, not the upstream
// tokenizer context window. Keep it linked to the delivered graph in the tests.
export const QWEN3_VL_WEBGPU_MAX_CONTEXT_TOKENS = 1_024;

/**
 * Validate the complete processor-expanded, single-request token tensor before
 * generation. The pinned generation loop forwards the prompt, then each sampled
 * token except the final one: the largest evaluated context is L + N - 1.
 * Never truncate instructions or reduce the caller's output allowance here.
 */
export function assertQwen3VlWebGpuContext(
    inputShape: readonly number[],
    inputTokenCount: number,
    maxNewTokens: number,
): void {
    if (
        !Array.isArray(inputShape) ||
        inputShape.length !== 2 ||
        inputShape[0] !== 1 ||
        !Number.isSafeInteger(inputShape[1]) ||
        inputShape[1] <= 0 ||
        !Number.isSafeInteger(inputTokenCount) ||
        inputTokenCount !== inputShape[1]
    ) {
        throw new RangeError(
            "Qwen processor returned an invalid single-request input token shape.",
        );
    }
    if (!Number.isSafeInteger(maxNewTokens) || maxNewTokens <= 0) {
        throw new RangeError("Qwen output token allowance must be a positive safe integer.");
    }
    const requiredContext = inputShape[1] + maxNewTokens - 1;
    if (
        !Number.isSafeInteger(requiredContext) ||
        requiredContext > QWEN3_VL_WEBGPU_MAX_CONTEXT_TOKENS
    ) {
        throw new RangeError(
            `This Qwen WebGPU model supports a 1,024-token context. This request requires ${requiredContext} positions including the output allowance. Shorten the input or lower Maximum output tokens.`,
        );
    }
}
