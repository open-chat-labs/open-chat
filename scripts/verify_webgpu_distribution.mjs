#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { collectModelAssetNotices } from "../frontend/app/modelAssetNotices.mjs";
import {
  TRANSFORMERS_WEBGPU_MODEL_SPECS,
  TRANSFORMERS_WEBGPU_RUNTIME_ASSETS,
} from "../frontend/app/src/utils/transformersWebGpuProtocol.ts";

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
      for (const marker of [
        "reusing decoder tied embeddings",
        "loading decoder after releasing prompt sessions",
        "Gemma",
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
  for (const model of Object.values(TRANSFORMERS_WEBGPU_MODEL_SPECS)) {
    for (const file of model.packagedArtifacts) {
      const artifact = model.artifacts.find(
        (candidate) => candidate.path === file,
      );
      if (!artifact || !model.packagedModelBase)
        throw new Error("Packaged graph metadata is incomplete.");
      check(`${model.packagedModelBase.replace(/^\//u, "")}${file}`, artifact);
    }
  }
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
