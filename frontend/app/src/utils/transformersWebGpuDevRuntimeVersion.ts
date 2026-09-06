export const TRANSFORMERS_WEBGPU_DEV_RUNTIME_VERSION_META =
    "openchat-transformers-webgpu-runtime-version";

export type TransformersWebGpuDevRuntimeVersion = {
    current(): string;
    rotate(): string;
};

/**
 * Give every successfully rebuilt development worker a distinct immutable URL. Production keeps
 * using the website version and never calls this development-only build helper.
 */
export function createTransformersWebGpuDevRuntimeVersion(
    websiteVersion: string,
): TransformersWebGpuDevRuntimeVersion {
    const prefix = websiteVersion.trim();
    if (prefix.length === 0) throw new Error("The development website version is empty.");
    let generation = 0;
    const current = () => `${prefix}.webgpu.${generation}`;
    return {
        current,
        rotate() {
            generation += 1;
            return current();
        },
    };
}

type MetaRoot = {
    querySelector(selector: string): { getAttribute(name: string): string | null } | null;
};

/** Read the generation emitted into the current development document without a network request. */
export function readTransformersWebGpuDevRuntimeVersion(
    root: MetaRoot | undefined,
): string | undefined {
    const value = root
        ?.querySelector(`meta[name="${TRANSFORMERS_WEBGPU_DEV_RUNTIME_VERSION_META}"]`)
        ?.getAttribute("content")
        ?.trim();
    return value === undefined || value.length === 0 ? undefined : value;
}
