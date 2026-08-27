import { get, writable } from "svelte/store";

export const TRANSFORMERS_WEBGPU_SETTINGS_KEY = "openchat_transformers_webgpu_runtime_settings_v1";
const TRANSFORMERS_WEBGPU_SETTINGS_VERSION = 1;

export const TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKENS_DEFAULT = 96;
export const TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKEN_LIMITS = {
    min: 1,
    max: TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKENS_DEFAULT,
} as const;

type PersistedTransformersWebGpuSettings = {
    version: typeof TRANSFORMERS_WEBGPU_SETTINGS_VERSION;
    maxOutputTokens: number;
};

function clampMaxOutputTokens(
    value: unknown,
    fallback = TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKENS_DEFAULT,
): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.min(
        TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKEN_LIMITS.max,
        Math.max(TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKEN_LIMITS.min, Math.round(value)),
    );
}

function loadMaxOutputTokens(): number {
    try {
        if (typeof localStorage === "undefined") {
            return TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKENS_DEFAULT;
        }
        const raw = localStorage.getItem(TRANSFORMERS_WEBGPU_SETTINGS_KEY);
        if (raw === null) return TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKENS_DEFAULT;
        const parsed = JSON.parse(raw) as Partial<PersistedTransformersWebGpuSettings>;
        if (parsed.version !== TRANSFORMERS_WEBGPU_SETTINGS_VERSION) {
            return TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKENS_DEFAULT;
        }
        return clampMaxOutputTokens(parsed.maxOutputTokens);
    } catch {
        return TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKENS_DEFAULT;
    }
}

export const transformersWebGpuMaxOutputTokens = writable(loadMaxOutputTokens());

function persist(maxOutputTokens: number): void {
    try {
        if (typeof localStorage === "undefined") return;
        localStorage.setItem(
            TRANSFORMERS_WEBGPU_SETTINGS_KEY,
            JSON.stringify({
                version: TRANSFORMERS_WEBGPU_SETTINGS_VERSION,
                maxOutputTokens,
            } satisfies PersistedTransformersWebGpuSettings),
        );
    } catch {
        // Storage can be disabled or full. The in-memory cap remains usable for this tab.
    }
}

export function updateTransformersWebGpuMaxOutputTokens(value: unknown): number {
    const resolved = clampMaxOutputTokens(value);
    transformersWebGpuMaxOutputTokens.set(resolved);
    persist(resolved);
    return resolved;
}

export function resetTransformersWebGpuMaxOutputTokens(): number {
    const resolved = TRANSFORMERS_WEBGPU_MAX_OUTPUT_TOKENS_DEFAULT;
    transformersWebGpuMaxOutputTokens.set(resolved);
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.removeItem(TRANSFORMERS_WEBGPU_SETTINGS_KEY);
        }
    } catch {
        // Storage can be disabled. The in-memory default is already restored.
    }
    return resolved;
}

/**
 * Apply the user-configured output cap without expanding a caller's smaller request.
 * Invalid requests remain invalid so the existing inference bridge can reject them.
 */
export function resolveTransformersWebGpuMaxOutputTokens(
    requested: number | undefined,
    configured = get(transformersWebGpuMaxOutputTokens),
): number {
    const cap = clampMaxOutputTokens(configured);
    if (requested === undefined) return cap;
    if (!Number.isInteger(requested) || requested < 1) return requested;
    return Math.min(requested, cap);
}
