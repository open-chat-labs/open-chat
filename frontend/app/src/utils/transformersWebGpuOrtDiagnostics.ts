type OrtTensorDescriptor = {
    readonly type?: unknown;
    readonly dims?: unknown;
    readonly location?: unknown;
};

export function isTransformersWebGpuOrtRunFailure(error: unknown): boolean {
    const detail = error instanceof Error ? error.message : String(error);
    return /\bOrtRun(?:\(\))?\b/i.test(detail);
}

function tensorSignature(value: unknown): string {
    if (typeof value !== "object" || value === null) return typeof value;
    const tensor = value as OrtTensorDescriptor;
    const type = typeof tensor.type === "string" ? tensor.type : "unknown";
    const dims = Array.isArray(tensor.dims)
        ? tensor.dims
              .map((dimension) => (Number.isSafeInteger(dimension) ? String(dimension) : "invalid"))
              .join("x")
        : "invalid";
    const location = typeof tensor.location === "string" ? `@${tensor.location}` : "";
    return `${type}[${dims}]${location}`;
}

/** Keep raw ORT errors actionable without serializing tensor contents (which can be tens of MiB). */
export function transformersWebGpuOrtRunError(
    modelName: string,
    sessionName: string,
    activeStage: string,
    feeds: unknown,
    error: unknown,
): Error {
    const signature =
        typeof feeds === "object" && feeds !== null
            ? Object.entries(feeds)
                  .map(([name, value]) => `${name}=${tensorSignature(value)}`)
                  .join(", ")
            : "invalid feeds";
    const detail = error instanceof Error ? error.message : String(error);
    return new Error(
        `${modelName} ${sessionName} OrtRun failed during ${activeStage} (${signature}): ${detail}`,
    );
}
