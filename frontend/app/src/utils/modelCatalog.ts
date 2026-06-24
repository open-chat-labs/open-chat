import type { ModelCatalog } from "openchat-shared";

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
                    url: "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf",
                    sha256: "9378bc471710229ef165709b62e34bfb62231420ddaf6d729e727305b5b8672d",
                    bytes: 3106736256,
                },
                {
                    // Vision projector (mmproj) — enables image input.
                    url: "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/mmproj-F16.gguf",
                    sha256: "140be8d7849741f88c50757d529b84373ee8e27052cc2236855b537f4a8215fa",
                    bytes: 985654080,
                },
            ],
            license: "Gemma Terms of Use",
            licenseUrl: "https://ai.google.dev/gemma/terms",
            sizeBytes: 4092390336,
        },
    ],
};
