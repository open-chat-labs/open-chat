import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import test from "node:test";
import { verifyWebGpuDistribution } from "./verify_webgpu_distribution.mjs";
import { patchQwen3Vl2bDecoderGraph } from "../frontend/app/transformersWebGpuDecoderGraph.mjs";
import { collectModelAssetNotices } from "../frontend/app/modelAssetNotices.mjs";

const root = resolve(import.meta.dirname, "..");
const worker = Buffer.from(
  "reusing decoder tied embeddings loading decoder after releasing prompt sessions Gemma".padEnd(
    65536,
    " ",
  ),
);
const notices = collectModelAssetNotices({
  includeWllama: true,
  includeWebGpu: true,
});
function sourceFixture(path) {
  const notice = notices.find(({ fileName }) =>
    path.replaceAll("\\", "/").endsWith(`/${fileName}`),
  );
  if (notice) return Buffer.from(notice.source, "utf8");
  const name = basename(path);
  if (name === "transformers_webgpu_worker.js") return worker;
  if (name.startsWith("ort-wasm"))
    return readFileSync(
      resolve(root, "frontend/node_modules/onnxruntime-web/dist", name),
    );
  const graph = readFileSync(
    resolve(root, "frontend/app/model-overrides/qwen3vl2b/onnx", name),
  );
  return name.startsWith("decoder") ? patchQwen3Vl2bDecoderGraph(graph) : graph;
}

test("validates actual pinned assets and identifies packaging evidence separately from inference", () => {
  const report = verifyWebGpuDistribution("fixture-build", sourceFixture);
  assert.equal(report.passed, true);
  assert.equal(report.inferenceVerified, false);
  assert.equal(report.assets.length, 5 + notices.length);
  assert.equal(report.noticeCount, notices.length);
});

test("built license and modified-model sidecars must retain their reviewed content", () => {
  for (const notice of notices) {
    assert.throws(
      () =>
        verifyWebGpuDistribution("fixture-build", (path) => {
          const bytes = Buffer.from(sourceFixture(path));
          if (path.replaceAll("\\", "/").endsWith(`/${notice.fileName}`))
            bytes[0] ^= 1;
          return bytes;
        }),
      /differs from its pinned identity/,
    );
  }
});

test("same-size corrupt ORT or model graph is rejected, not just missing files", () => {
  for (const match of ["jspi.wasm", "decoder_model", "vision_encoder"]) {
    assert.throws(
      () =>
        verifyWebGpuDistribution("fixture-build", (path) => {
          const bytes = Buffer.from(sourceFixture(path));
          if (path.includes(match)) bytes[0] ^= 1;
          return bytes;
        }),
      /differs from its pinned identity/,
    );
  }
});

test("missing or wrong worker implementation is rejected", () => {
  for (const bytes of [
    Buffer.alloc(0),
    Buffer.alloc(65536),
    Buffer.concat([worker, Buffer.from("import.meta.env")]),
  ]) {
    assert.throws(() =>
      verifyWebGpuDistribution("fixture-build", (path) =>
        path.endsWith("transformers_webgpu_worker.js")
          ? bytes
          : sourceFixture(path),
      ),
    );
  }
  assert.throws(
    () =>
      verifyWebGpuDistribution("fixture-build", () => {
        throw new Error("ENOENT");
      }),
    /ENOENT/,
  );
});
