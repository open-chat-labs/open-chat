import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { verifyWebGpuDistribution } from "./verify_webgpu_distribution.mjs";
import { patchQwen3Vl2bDecoderGraph } from "../frontend/app/transformersWebGpuDecoderGraph.mjs";
import {
  patchQwen3Vl2bDeepStackDecoderGraph,
  patchQwen3Vl2bDeepStackVisionGraph,
} from "../frontend/app/transformersWebGpuDeepStackGraph.mjs";
import { patchQwen3Vl2bGenerationGraph } from "../frontend/app/transformersWebGpuQwenGenerationGraph.mjs";
import { patchQwen3Vl2bVisionGeometryGraph } from "../frontend/app/transformersWebGpuQwenVisionGraph.mjs";
import { collectModelAssetNotices } from "../frontend/app/modelAssetNotices.mjs";

const root = resolve(import.meta.dirname, "..");
test("actual distribution verifier imports in native Node without browser state or loaders", () => {
  const target = pathToFileURL(resolve(root, "scripts/verify_webgpu_distribution.mjs")).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "--eval", `
    Object.defineProperty(globalThis, "localStorage", {
      get() { throw new Error("Packaging must not access browser state"); }
    });
    const module = await import(${JSON.stringify(target)});
    if (typeof module.verifyWebGpuDistribution !== "function") process.exit(1);
  `], { encoding: "utf8", timeout: 15_000, env: { ...process.env, NODE_OPTIONS: "" } });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
});

test("verification does not derive required packaged graphs from the selectable catalog", () => {
  const source = readFileSync(resolve(root, "scripts/verify_webgpu_distribution.mjs"), "utf8");
  assert.doesNotMatch(source, /transformersWebGpuProtocol|webGpuModelCatalog|model-catalog\.json/u);
});
const worker = Buffer.from(
  "reusing decoder tied embeddings loading decoder after releasing prompt sessions Gemma Qwen generation metadata: Qwen vision session: ".padEnd(
    65536,
    " ",
  ),
);
const notices = collectModelAssetNotices({
  includeWllama: true,
  includeWebGpu: true,
});
const graphs = new Map();
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
  if (!graphs.has(name)) {
    const graph = readFileSync(
      resolve(root, "frontend/app/model-overrides/qwen3vl2b/onnx", name),
    );
    graphs.set(
      name,
      name.startsWith("decoder")
        ? patchQwen3Vl2bGenerationGraph(
            patchQwen3Vl2bDeepStackDecoderGraph(
              patchQwen3Vl2bDecoderGraph(graph),
            ),
            { scope: "generation-only" },
          )
        : patchQwen3Vl2bVisionGeometryGraph(
            patchQwen3Vl2bDeepStackVisionGraph(graph),
          ),
    );
  }
  return graphs.get(name);
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
      (error) =>
        error.message ===
        `Built asset differs from its pinned identity: ${notice.fileName}`,
    );
  }
});

test("same-size corrupt ORT or model graph is rejected, not just missing files", () => {
  for (const match of ["jspi.wasm", "decoder_model", "vision_encoder"]) {
    let changedFile;
    assert.throws(
      () =>
        verifyWebGpuDistribution("fixture-build", (path) => {
          const bytes = Buffer.from(sourceFixture(path));
          if (path.includes(match)) {
            bytes[0] ^= 1;
            changedFile = path;
          }
          return bytes;
        }),
      (error) =>
        typeof changedFile === "string" &&
        error.message.endsWith(
          changedFile.replaceAll("\\", "/").split("/fixture-build/")[1],
        ),
    );
  }
});

test("older DeepStack-only graphs are rejected even when their source pins are valid", () => {
  for (const name of [
    "decoder_model_merged_q4.onnx",
    "vision_encoder_q4.onnx",
  ]) {
    const source = readFileSync(
      resolve(root, "frontend/app/model-overrides/qwen3vl2b/onnx", name),
    );
    const previous = name.startsWith("decoder")
      ? patchQwen3Vl2bDeepStackDecoderGraph(patchQwen3Vl2bDecoderGraph(source))
      : patchQwen3Vl2bDeepStackVisionGraph(source);
    const file = `assets/transformers-webgpu/qwen3vl2b/onnx/${name}`;
    assert.throws(
      () =>
        verifyWebGpuDistribution("fixture-build", (path) =>
          path.replaceAll("\\", "/").endsWith(`/${file}`)
            ? previous
            : sourceFixture(path),
        ),
      (error) =>
        error.message ===
        `Built asset differs from its pinned identity: ${file}`,
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

for (const marker of ["Qwen generation metadata: ", "Qwen vision session: "]) {
  test(`missing factory implementation is rejected as packaging evidence: ${marker}`, () => {
    const incomplete = Buffer.from(
      worker.toString("utf8").replace(marker, " ".repeat(marker.length)),
    );
    assert.equal(incomplete.length, worker.length);
    assert.throws(
      () =>
        verifyWebGpuDistribution("fixture-build", (path) =>
          path.endsWith("transformers_webgpu_worker.js")
            ? incomplete
            : sourceFixture(path),
        ),
      (error) =>
        error.message ===
        `Built worker is missing runtime implementation: ${marker}`,
    );
  });
}
