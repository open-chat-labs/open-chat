type TokenTensor = {
    readonly dims: readonly number[];
    readonly data: ArrayLike<unknown>;
};

function tokenId(value: unknown): bigint {
    if (typeof value === "bigint" && value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return value;
    }
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
        return BigInt(value);
    }
    throw new Error("The model returned an invalid token ID.");
}

/** Use the effective generation config, not tokenizer metadata or a nullish fallback. */
export function completionEosTokenIds(value: unknown): readonly bigint[] {
    const ids = Array.isArray(value) ? value : [value];
    if (ids.length === 0) throw new Error("The model has no configured completion EOS tokens.");
    try {
        return [...new Set(ids.map(tokenId))];
    } catch {
        throw new Error("The model has invalid or disabled completion EOS tokens.");
    }
}

function tensorLength(tensor: TokenTensor): number {
    if (
        !Array.isArray(tensor.dims) ||
        tensor.dims.length !== 2 ||
        tensor.dims[0] !== 1 ||
        !Number.isSafeInteger(tensor.dims[1]) ||
        tensor.dims[1] <= 0 ||
        tensor.data == null ||
        tensor.data.length !== tensor.dims[1]
    ) {
        throw new Error("The model returned an invalid single-request token tensor.");
    }
    return tensor.dims[1];
}

/**
 * These decoder-only, single-request paths use only max_new_tokens and EOS stopping.
 * Validate the actual generated IDs before decoding: even valid-looking text can be
 * an unfinished prefix. No re-tokenization, extra inference, or retained KV cache.
 */
export function assertCompletedGeneration(
    input: TokenTensor,
    output: TokenTensor,
    maxNewTokens: number,
    effectiveEosTokenIds: readonly bigint[],
): void {
    if (!Number.isSafeInteger(maxNewTokens) || maxNewTokens <= 0) {
        throw new Error("The model output token allowance must be a positive safe integer.");
    }
    const eos = completionEosTokenIds(effectiveEosTokenIds);
    const inputLength = tensorLength(input);
    const outputLength = tensorLength(output);
    const generatedCount = outputLength - inputLength;
    if (generatedCount <= 0 || generatedCount > maxNewTokens) {
        throw new Error("The model returned an invalid generated token count.");
    }
    for (let index = 0; index < inputLength; index++) {
        if (tokenId(input.data[index]) !== tokenId(output.data[index])) {
            throw new Error(
                "The model returned a generated sequence with a different input prefix.",
            );
        }
    }
    for (let index = inputLength; index < outputLength; index++) {
        const isEos = eos.includes(tokenId(output.data[index]));
        if (isEos && index !== outputLength - 1) {
            throw new Error("The model returned tokens after its completion EOS token.");
        }
        if (index === outputLength - 1 && !isEos) {
            if (generatedCount === maxNewTokens) {
                throw new Error(
                    "The model reached its output token limit before completing the response. No partial result was returned.",
                );
            }
            throw new Error(
                "The model stopped without a completion EOS token. No partial result was returned.",
            );
        }
    }
}
