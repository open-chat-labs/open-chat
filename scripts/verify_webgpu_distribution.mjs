#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { collectModelAssetNotices } from "../frontend/app/modelAssetNotices.mjs";
import { TRANSFORMERS_WEBGPU_RUNTIME_ASSETS } from "../frontend/app/src/utils/transformersWebGpuRuntimeAssets.ts";
import {
  QWEN3_VL_2B_GENERATION_BYTES,
  QWEN3_VL_2B_GENERATION_SHA256,
} from "../frontend/app/transformersWebGpuQwenGenerationGraph.mjs";
import {
  QWEN3_VL_2B_VISION_GEOMETRY_BYTES,
  QWEN3_VL_2B_VISION_GEOMETRY_SHA256,
} from "../frontend/app/transformersWebGpuQwenVisionGraph.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Checks the actual built bytes. No downloads, feature enablement, inference or
// signing occurs here; a successful result is packaging evidence only.
export function verifyWebGpuDistribution(buildDirectory, read = readFileSync) {
  const assets = [];
  const check = (file, expected) => {
    const bytes = read(resolve(buildDirectory, file));
    const digest = sha256(bytes);
    if (bytes.byteLength !== expected.bytes || digest !== expected.sha256) {
      throw new Error(`Built asset differs from its pinned identity: ${file}`);
    }
    assets.push({ file, bytes: bytes.byteLength, sha256: digest });
  };
  for (const artifact of TRANSFORMERS_WEBGPU_RUNTIME_ASSETS) {
    const file = artifact.path.replace(/^\//u, "");
    if (artifact.kind === "pinned") {
      check(file, artifact);
    } else {
      const bytes = read(resolve(buildDirectory, file));
      if (
        bytes.byteLength < artifact.minimumBytes ||
        bytes.byteLength > artifact.maximumBytes
      ) {
        throw new Error(
          "The built WebGPU worker is missing, truncated or unexpectedly large.",
        );
      }
      const source = bytes.toString("utf8");
      // Implementation presence only; these markers do not establish invocation,
      // native provider placement, numerical accuracy or device compatibility.
      for (const marker of [
        "reusing decoder tied embeddings",
        "loading decoder after releasing prompt sessions",
        "Gemma",
        "Qwen generation metadata: ",
        "Qwen vision session: ",
      ]) {
        if (!source.includes(marker))
          throw new Error(
            `Built worker is missing runtime implementation: ${marker}`,
          );
      }
      if (source.includes("import.meta.env"))
        throw new Error(
          "The built worker contains unresolved environment values.",
        );
      assets.push({ file, bytes: bytes.byteLength, sha256: sha256(bytes) });
    }
  }
  // These are adapter-owned build outputs, emitted even when the selectable
  // catalog is empty. Operator-hosted catalog artifacts are verified at download
  // time, not treated as files that must exist inside every APK.
  check("assets/transformers-webgpu/qwen3vl2b/onnx/decoder_model_merged_q4.onnx", {
    bytes: QWEN3_VL_2B_GENERATION_BYTES,
    sha256: QWEN3_VL_2B_GENERATION_SHA256,
  });
  check("assets/transformers-webgpu/qwen3vl2b/onnx/vision_encoder_q4.onnx", {
    bytes: QWEN3_VL_2B_VISION_GEOMETRY_BYTES,
    sha256: QWEN3_VL_2B_VISION_GEOMETRY_SHA256,
  });
  const notices = collectModelAssetNotices({
    includeWllama: true,
    includeWebGpu: true,
  });
  for (const notice of notices) {
    const source = Buffer.from(notice.source, "utf8");
    check(notice.fileName, {
      bytes: source.byteLength,
      sha256: sha256(source),
    });
  }
  return {
    passed: true,
    evidence: "built-webgpu-distribution-only",
    assets,
    noticeCount: notices.length,
    inferenceVerified: false,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const build = resolve(
      process.argv[2] ?? resolve(root, "frontend/app/build"),
    );
    console.log(JSON.stringify(verifyWebGpuDistribution(build), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
