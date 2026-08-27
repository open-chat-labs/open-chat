import type { Plugin } from "vite";

export const TRANSFORMERS_WEBGPU_SEQUENTIAL_SESSION_MARKER: string;
export const TRANSFORMERS_WEBGPU_STAGED_DECODER_MARKER: string;
export const TRANSFORMERS_WEBGPU_TIED_EMBEDDING_MARKER: string;
export const TRANSFORMERS_QWEN_DECODER_TOKEN_IDS_INPUT: string;
export const TRANSFORMERS_QWEN_DECODER_INPUT_METADATA: ReadonlyArray<{
    readonly name: string;
    readonly isTensor: true;
    readonly type: "float32" | "int64";
    readonly shape: ReadonlyArray<string | number>;
}>;
export function patchTransformersWebGpuSessionSource(source: string, id: string): string | null;
export function transformersWebGpuSequentialSessionsPlugin(): Plugin;
