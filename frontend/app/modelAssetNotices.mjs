import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const DEFAULT_FRONTEND_DIRECTORY = path.resolve(import.meta.dirname, "..");
const NOTICE_DIRECTORY = "app/model-asset-notices";
const OUTPUT_DIRECTORY = "assets/licenses/model-assets";
const ORT_REVISION = "1b1e1db7bcf583e5927588e8d85c5a89717dc45c";
const TRANSFORMERS_LICENSE_SHA256 =
    "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30";
const APACHE_LICENSE_SHA256 = "a60eea817514531668d7e00765731449fe14d059d3249e0bc93b36de45f759f2";

const REQUIRED_DOCUMENTS = {
    wllama: [
        "wllama-MIT.txt",
        "wllama-llama.cpp-MIT.txt",
        "wllama-jsonhpp-MIT.txt",
        "wllama-cpp-httplib-MIT.txt",
        "wllama-emscripten-LICENSE.txt",
        "wllama-musl-COPYRIGHT.txt",
        "wllama-libcxx-LICENSE.txt",
        "wllama-libcxxabi-LICENSE.txt",
        "wllama-miniaudio-LICENSE.txt",
        "wllama-stb_image-LICENSE.txt",
    ],
    webgpu: [
        "onnxruntime-MIT.txt",
        "onnxruntime-ThirdPartyNotices.txt",
        "Qwen3-VL-2B-original-MODEL_CARD.md",
        "Gemma4-E2B-ONNX-MODEL_CARD.md",
    ],
};

// Git may check text out as CRLF. No other whitespace or content is discarded.
export function canonicalNoticeText(bytes) {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
        .decode(bytes)
        .replace(/\r\n/g, "\n");
    return text.endsWith("\n") ? text : `${text}\n`;
}

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Collect notice text, never runtime/model payloads or network responses.
 * Wllama defaults on: its WASM load hook can emit an asset before tree shaking.
 * Select WebGPU coverage with the same decision that packages that runtime. */
export function collectModelAssetNotices({
    frontendDirectory = DEFAULT_FRONTEND_DIRECTORY,
    includeWllama = true,
    includeWebGpu = false,
    readFile = readFileSync,
} = {}) {
    if (typeof includeWllama !== "boolean" || typeof includeWebGpu !== "boolean") {
        throw new TypeError("Model notice selectors must be explicit booleans.");
    }
    const read = (name) => readFile(path.resolve(frontendDirectory, name));
    const text = (name) => canonicalNoticeText(read(name));
    const manifest = JSON.parse(text(`${NOTICE_DIRECTORY}/sources.json`));
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.documents)) {
        throw new Error("Unsupported model asset notice manifest.");
    }
    const selectedGroups = new Set([
        ...(includeWllama ? ["wllama"] : []),
        ...(includeWebGpu ? ["webgpu"] : []),
    ]);
    for (const group of selectedGroups) {
        const actual = manifest.documents
            .filter((document) => document.group === group)
            .map((document) => document.name)
            .sort();
        if (JSON.stringify(actual) !== JSON.stringify([...REQUIRED_DOCUMENTS[group]].sort())) {
            throw new Error(`Incomplete model asset notice coverage for ${group}.`);
        }
    }
    const packageJson = JSON.parse(text("package.json"));
    const lock = JSON.parse(text("package-lock.json"));
    for (const expected of manifest.packages) {
        const selected = expected.name === "@wllama/wllama" ? includeWllama : includeWebGpu;
        if (!selected) continue;
        const installed = JSON.parse(text(`node_modules/${expected.name}/package.json`));
        const locked = lock.packages[`node_modules/${expected.name}`];
        if (
            packageJson.dependencies[expected.name] !== expected.version ||
            installed.version !== expected.version ||
            locked?.version !== expected.version ||
            locked.integrity !== expected.integrity
        ) {
            throw new Error(`Review model asset notices before changing ${expected.name}.`);
        }
    }
    if (
        includeWebGpu &&
        text("node_modules/onnxruntime-web/__commit.txt").trim() !== ORT_REVISION
    ) {
        throw new Error("ONNX Runtime notice revision no longer matches the installed runtime.");
    }
    const assets = [];
    const names = new Set();
    const add = (fileName, source) => {
        if (names.has(fileName)) throw new Error(`Duplicate model notice output: ${fileName}`);
        names.add(fileName);
        assets.push({ type: "asset", fileName, source });
    };
    const selectedDocuments = manifest.documents.filter(({ group }) => selectedGroups.has(group));
    for (const document of selectedDocuments) {
        if (!/^[A-Za-z0-9_.-]+$/.test(document.name) || document.name.includes("..")) {
            throw new Error("Unsafe model asset notice filename.");
        }
        const source = text(`${NOTICE_DIRECTORY}/${document.name}`);
        if (Buffer.byteLength(source) !== document.bytes || sha256(source) !== document.sha256) {
            throw new Error(`Model asset notice changed or is incomplete: ${document.name}`);
        }
        add(`${OUTPUT_DIRECTORY}/${document.name}`, source);
    }
    if (includeWllama) {
        if (
            text("node_modules/@wllama/wllama/LICENCE") !==
            text(`${NOTICE_DIRECTORY}/wllama-MIT.txt`)
        ) {
            throw new Error("Wllama installed license changed; review its attribution.");
        }
    }
    if (includeWebGpu) {
        for (const [name, sourcePath, expectedHash] of [
            [
                "huggingface-transformers-Apache-2.0.txt",
                "node_modules/@huggingface/transformers/LICENSE",
                TRANSFORMERS_LICENSE_SHA256,
            ],
            [
                "Apache-2.0.txt",
                "src-tauri/THIRD_PARTY_LICENSES/Apache-2.0.txt",
                APACHE_LICENSE_SHA256,
            ],
        ]) {
            const source = text(sourcePath);
            if (sha256(source) !== expectedHash)
                throw new Error(`Model asset license changed or is incomplete: ${name}`);
            add(`${OUTPUT_DIRECTORY}/${name}`, source);
        }
        add(
            `${OUTPUT_DIRECTORY}/MODEL_MODIFICATIONS.md`,
            text(`${NOTICE_DIRECTORY}/MODEL_MODIFICATIONS.md`),
        );
        for (const graph of ["decoder_model_merged_q4.onnx", "vision_encoder_q4.onnx"]) {
            add(
                `assets/transformers-webgpu/qwen3vl2b/onnx/${graph}.NOTICE.txt`,
                `MODIFIED MODEL GRAPH: ${graph}\n\n` +
                    "OpenChat modifies this Qwen3-VL-2B graph; it is not the unmodified publisher artifact.\n" +
                    "The original Qwen model is Apache-2.0. The complete license, upstream attribution,\n" +
                    "immutable hashes and modification description accompany the distribution at:\n" +
                    "assets/licenses/model-assets/Apache-2.0.txt\n" +
                    "assets/licenses/model-assets/MODEL_MODIFICATIONS.md\n",
            );
        }
    }
    if (selectedGroups.size > 0) {
        add(`${OUTPUT_DIRECTORY}/THIRD_PARTY_NOTICES.md`, text("src-tauri/THIRD_PARTY_NOTICES.md"));
        add(
            `${OUTPUT_DIRECTORY}/sources.json`,
            `${JSON.stringify(
                {
                    ...manifest,
                    includedNoticeGroups: [...selectedGroups],
                    documents: selectedDocuments,
                },
                null,
                2,
            )}\n`,
        );
    }
    return assets;
}

/** Rollup emits into the web build and Tauri frontendDist/APK input alike. */
export function modelAssetNoticesPlugin(options = {}) {
    return {
        name: "model-asset-notices",
        generateBundle() {
            for (const asset of collectModelAssetNotices(options)) this.emitFile(asset);
        },
    };
}
