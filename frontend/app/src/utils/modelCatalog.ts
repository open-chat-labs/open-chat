import type { ModelCatalog, ModelCatalogEntry } from "openchat-shared";

// The default on-device model catalog.
//
// This is DATA, not a bundled model: every entry merely points at publicly hosted files the user chooses
// to download, verify (SHA-256) and run locally. Gemma-class multimodal models are example entries —
// nothing here is a dependency of OpenChat, and the user can ignore the list entirely. In future this can
// be fetched from a configurable source (see `ModelCatalog`); for now it ships as the built-in default.
//
// Each entry's `id` is the local store key: download_model writes the files under it and listLocalModels
// reports it back, so it must be stable and filesystem-safe.
export const defaultModelCatalog: ModelCatalog = {
    version: 1,
    models: [
        // ── Browser-capable small models (single GGUF ≤ 2 GB — they also run natively) ─────────
        // Listed Gemma-first: it is the DEFAULT suggestion in the browser chooser.
        {
            id: "gemma-3-1b-it-q4",
            name: "Gemma 3 1B (instruct) — default",
            description:
                "Default. Google's small instruct model, same family as the desktop model. " +
                "Pros: balanced quality, broad language coverage, modest size (~0.8 GB). " +
                "Cons: a little chattier about output format than Qwen; Gemma license terms.",
            modalities: ["text"],
            runtime: "llama-cpp",
            files: [
                {
                    url: "https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf",
                    sha256: "8ccc5cd1f1b3602548715ae25a66ed73fd5dc68a210412eea643eb20eb75a135",
                    bytes: 806058240,
                },
            ],
            license: "Gemma Terms of Use",
            licenseUrl: "https://ai.google.dev/gemma/terms",
            sizeBytes: 806058240,
        },
        {
            id: "qwen2.5-1.5b-instruct-q4",
            name: "Qwen2.5 1.5B (instruct)",
            description:
                "Best extraction quality of the small models. " +
                "Pros: strictest JSON/format discipline per MB, Apache-2.0 license. " +
                "Cons: largest of the three (~1.1 GB) — slower to load and run in a browser.",
            modalities: ["text"],
            runtime: "llama-cpp",
            files: [
                {
                    url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
                    sha256: "6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e",
                    bytes: 1117320736,
                },
            ],
            license: "Apache 2.0",
            licenseUrl: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF",
            sizeBytes: 1117320736,
        },
        {
            id: "qwen2.5-0.5b-instruct-q4",
            name: "Qwen2.5 0.5B (instruct)",
            description:
                "Fastest and lightest (~0.5 GB) — good for weaker machines. " +
                "Pros: quickest load + response, Apache-2.0 license. " +
                "Cons: weakest extraction quality — leans on the app's built-in correction rules.",
            modalities: ["text"],
            runtime: "llama-cpp",
            files: [
                {
                    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
                    sha256: "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db",
                    bytes: 491400032,
                },
            ],
            license: "Apache 2.0",
            licenseUrl: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF",
            sizeBytes: 491400032,
        },
        {
            id: "gemma-4-e2b-it-q4",
            name: "Gemma 4 E2B (instruct)",
            description:
                "Google's compact multimodal model — understands text and images, runs fully on-device. " +
                "A good default for private, offline AI features.",
            modalities: ["text", "image"],
            runtime: "llama-cpp",
            files: [
                {
                    // Language model (Q4_K_M GGUF).
                    url: "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/0314792d7f1f7e229411f620751375812bb9faf2/gemma-4-E2B-it-Q4_K_M.gguf",
                    sha256: "740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8",
                    bytes: 3106738272,
                },
                {
                    // Vision projector (mmproj) — enables image input.
                    url: "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/0314792d7f1f7e229411f620751375812bb9faf2/mmproj-F16.gguf",
                    sha256: "140be8d7849741f88c50757d529b84373ee8e27052cc2236855b537f4a8215fa",
                    bytes: 985654080,
                },
            ],
            license: "Apache-2.0",
            licenseUrl: "https://ai.google.dev/gemma/docs/gemma_4_license",
            sizeBytes: 4092392352,
        },
    ],
};

// The practical wasm32 envelope for BROWSER inference: address space is 4 GB and llama.cpp-WASM needs
// headroom for KV cache + compute buffers on top of the weights. Shared by both ModelManager trees
// (and mirrored by MAX_WEB_MODEL_BYTES in webInference.ts, which enforces it at attach time).
export const WEB_MODEL_MAX_BYTES = 2_147_483_648; // 2 GB

/**
 * Merge the remote (on-chain, owner-curated) catalog OVER the built-in default.
 *
 * The remote catalog is a per-id overlay, never a wholesale replacement: remote entries come first
 * (in remote order, so the operator controls ranking) and win on id conflicts; builtin entries whose
 * id the remote doesn't mention are appended in builtin order. A stale or partial remote catalog can
 * therefore never shrink the chooser below the builtin floor — removing a builtin model remains a
 * client-release concern.
 */
export function mergeCatalogs(
    remote: ModelCatalogEntry[],
    builtin: ModelCatalogEntry[],
): ModelCatalogEntry[] {
    const merged: ModelCatalogEntry[] = [];
    const seen = new Set<string>();
    for (const entry of [...remote, ...builtin]) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        merged.push(entry);
    }
    return merged;
}

/**
 * Catalog models a BROWSER can run: a single GGUF within the ~2 GB wasm32 envelope (the mmproj
 * vision path stays native-only). Order is preserved — catalog order is the recommendation order,
 * so index 0 is the default suggestion.
 */
export function webEligibleModels(models: ModelCatalogEntry[]): ModelCatalogEntry[] {
    return models.filter((m) => m.files.length === 1 && m.sizeBytes <= WEB_MODEL_MAX_BYTES);
}
