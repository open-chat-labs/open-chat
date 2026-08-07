import type { ModelCatalog, ModelCatalogEntry, ModelFile } from "@shared";

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
        // ── THE DEFAULT ────────────────────────────────────────────────────────────────────────
        // Index 0 is the browser chooser's default suggestion (webEligibleModels preserves catalog
        // order and both ModelManager trees label `i === 0` "Download & use (default)"), so this
        // entry is the one a new browser user is steered to.
        //
        // A vision model sits here because it performed best on both text and image structured-output
        // tasks during evaluation. It costs roughly twice Gemma 3 1B's download; the text-only
        // alternatives below stay one click away.
        {
            id: "qwen3-vl-2b-instruct-q4",
            name: "Qwen3-VL 2B (vision) — default",
            description:
                "Default. The most accurate model here, on text as well as images: in testing it was " +
                'the ONLY one to read a date range correctly ("3-8 august" → the 3rd) and the only ' +
                "one to return an amount from a photo as a number rather than text. Reads receipts. " +
                "Apache-2.0. Costs ~1.5 GB of download and roughly 10s per image — pick Gemma 3 1B " +
                "below if you only send text and want a smaller download.",
            modalities: ["text", "image"],
            runtime: "llama-cpp",
            files: [
                {
                    url: "https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/52d6c8ffea26cc873ac5ad116f8631268d7eb503/Qwen3VL-2B-Instruct-Q4_K_M.gguf",
                    sha256: "089d75c52f4b7ffc56ba998ffc50aae89fcafc755f9e7208aacca281dca6c2ae",
                    bytes: 1107409952,
                },
                {
                    // Vision projector (mmproj) — enables image input. Identified by the "mmproj" in
                    // its name (see isMmprojFile); wllama re-checks the GGUF header at load time.
                    url: "https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/52d6c8ffea26cc873ac5ad116f8631268d7eb503/mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf",
                    sha256: "f9a68fabba69c3b81e153367b2c7521030b0fa8bb0de400c9599c8e6725f9c82",
                    bytes: 445053216,
                },
            ],
            license: "Apache 2.0",
            licenseUrl: "https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF",
            sizeBytes: 1552463168,
        },
        // ── Smaller TEXT-ONLY models (≤ 2 GB of GGUF in total — they also run natively) ─────────
        // Cheaper downloads for text-only chats, weak machines or slow connections.
        {
            id: "gemma-3-1b-it-q4",
            name: "Gemma 3 1B (instruct)",
            description:
                "Google's small instruct model, same family as the desktop model. " +
                "Pros: balanced quality, broad language coverage, half the default's download (~0.8 GB). " +
                "Cons: cannot read images; a little chattier about output format than Qwen; Gemma license terms.",
            modalities: ["text"],
            runtime: "llama-cpp",
            files: [
                {
                    url: "https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/f9c28bcd85737ffc5aef028638d3341d49869c27/gemma-3-1b-it-Q4_K_M.gguf",
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
                    url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/91cad51170dc346986eccefdc2dd33a9da36ead9/qwen2.5-1.5b-instruct-q4_k_m.gguf",
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
                    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf",
                    sha256: "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db",
                    bytes: 491400032,
                },
            ],
            license: "Apache 2.0",
            licenseUrl: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF",
            sizeBytes: 491400032,
        },
        // ── A SMALLER vision model ─────────────────────────────────────────────────────────────
        // Vision needs TWO files — llama.cpp offers no single-file VLM GGUF (`-m model.gguf --mmproj
        // proj.gguf`), and wllama mirrors that with ModelSource.mmprojUrl.
        //
        // Every vision entry here was measured in a real browser on representative structured-output
        // tasks, not chosen from benchmarks. SmolVLM 256M was rejected because it emitted nested,
        // structurally invalid JSON for both image and text-only controls.
        {
            id: "smolvlm-500m-instruct-q8",
            name: "SmolVLM 500M (vision) — smallest",
            description:
                "Reads images at a third of the default's download (~0.55 GB total, Apache-2.0) — the " +
                "one to pick on a slow connection or a weak machine. Much less accurate: in testing " +
                'it took the Subtotal line instead of the total, and on text it read "3-8 august" ' +
                "as an amount of 3.00. Verify every figure before relying on the output.",
            modalities: ["text", "image"],
            runtime: "llama-cpp",
            files: [
                {
                    url: "https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF/resolve/72e986006ef53e37cdd3f6d4241c90b0f01df376/SmolVLM-500M-Instruct-Q8_0.gguf",
                    sha256: "9d4612de6a42214499e301494a3ecc2be0abdd9de44e663bda63f1152fad1bf4",
                    bytes: 436806912,
                },
                {
                    // Vision projector (mmproj) — enables image input. Identified by the "mmproj" in
                    // its name (see isMmprojFile); wllama re-checks the GGUF header at load time.
                    url: "https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF/resolve/72e986006ef53e37cdd3f6d4241c90b0f01df376/mmproj-SmolVLM-500M-Instruct-Q8_0.gguf",
                    sha256: "d1eb8b6b23979205fdf63703ed10f788131a3f812c7b1f72e0119d5d81295150",
                    bytes: 108783360,
                },
            ],
            license: "Apache 2.0",
            licenseUrl: "https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF",
            sizeBytes: 545590272,
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

// The practical envelope for BROWSER inference, applied to the entry TOTAL (weights + mmproj), not
// per file. Both files are resident in the SAME wasm heap at once — the projector is not a sidecar —
// so the sum is what has to fit alongside the KV cache and compute buffers.
//
// The old comment here justified the number with "address space is 4 GB" (wasm32). That reasoning is
// dead: wllama 3.x allocates its heap with `address: 'i64'` (Memory64), and measuring the browser
// directly (Chrome 150, crossOriginIsolated, 32 GB host) it granted a SHARED Memory64 reservation of
// at least 16 GB — the probe ran out of headroom before the browser did — against exactly 4096 MB for
// the wasm32 equivalent. So 4 GB is no longer the platform's limit.
//
// It is still the ceiling in practice, because wllama caps ITSELF there: its allocator asks for
// `maximum: 65536` pages (4 GiB) and probes downward in 128 MB steps until the browser agrees. 2 GB
// leaves that headroom for the KV cache and compute buffers, which is why the number stands even
// though its original justification did not.
//
// Shared by both ModelManager trees and by webInference.ts, which enforces it at attach time.
export const WEB_MODEL_MAX_BYTES = 2_147_483_648; // 2 GB, total across the entry's files

/**
 * Is this file the VISION PROJECTOR (mmproj) rather than the language-model weights?
 *
 * Read from the URL's basename. That convention is already load-bearing in three places this code
 * has to agree with: llama.cpp's own converter names projectors `mmproj-*.gguf` (every ggml-org and
 * unsloth repo follows it), the native downloader's `find_mmproj` classifies on-disk files the same
 * way, and this app's "Add a model from URL" form force-renames the projector to `mmproj.gguf`.
 * wllama independently re-checks the GGUF header at load time (`general.architecture == "clip"`) and
 * routes the blobs itself, so a misnamed file costs a load error — never a silently wrong model.
 */
export function isMmprojFile(file: ModelFile): boolean {
    const path = file.url.split(/[?#]/)[0];
    const basename = path.slice(path.lastIndexOf("/") + 1);
    return basename.toLowerCase().includes("mmproj");
}

/** Partition an entry's files into language-model weights and vision projector(s). */
export function splitModelFiles(files: ModelFile[]): { weights: ModelFile[]; mmproj: ModelFile[] } {
    return {
        weights: files.filter((f) => !isMmprojFile(f)),
        mmproj: files.filter((f) => isMmprojFile(f)),
    };
}

/**
 * Catalog models a BROWSER can run: ONE weights GGUF, optionally plus ONE mmproj vision projector,
 * within the ~2 GB total envelope. Order is preserved — catalog order is the recommendation order,
 * so index 0 is the default suggestion.
 *
 * This filter used to be `files.length === 1`, which excluded every vision model in existence — not
 * because a browser cannot do vision (wllama has run it since 3.0.0) but because llama.cpp takes the
 * projector as a SECOND file and the filter counted files. Multi-shard weights (`-00001-of-0000N`)
 * are still excluded: wllama can load them, but nothing in the catalog needs it and allowing an
 * arbitrary file count would re-admit the 4 GB native-only entries this filter exists to keep out.
 */
export function webEligibleModels(models: ModelCatalogEntry[]): ModelCatalogEntry[] {
    return models.filter((m) => {
        const { weights, mmproj } = splitModelFiles(m.files);
        return weights.length === 1 && mmproj.length <= 1 && m.sizeBytes <= WEB_MODEL_MAX_BYTES;
    });
}

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
