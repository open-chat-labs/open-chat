import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  canonicalNoticeText,
  collectModelAssetNotices,
  modelAssetNoticesPlugin,
} from "../frontend/app/modelAssetNotices.mjs";
import {
  TRANSFORMERS_QWEN_REVISION,
  TRANSFORMERS_GEMMA_REVISION,
  TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS,
  TRANSFORMERS_WEBGPU_PACKAGED_MODEL_ARTIFACTS,
} from "../frontend/app/src/utils/transformersWebGpuProtocol.ts";

const frontend = path.resolve(import.meta.dirname, "../frontend");
const noticePath = "assets/licenses/model-assets/";
const manifestPath = path.join(
  frontend,
  "app/model-asset-notices/sources.json",
);
const readWith = (relative, transform) => (file) => {
  const bytes = readFileSync(file);
  return path.resolve(file) === path.resolve(frontend, relative)
    ? Buffer.from(transform(bytes))
    : bytes;
};

test("default Wllama coverage includes embedded dependencies without OCR or WebGPU", () => {
  const assets = collectModelAssetNotices();
  assert.equal(assets.length, 12);
  for (const component of [
    "wllama-MIT.txt",
    "wllama-llama.cpp-MIT.txt",
    "wllama-miniaudio-LICENSE.txt",
    "wllama-stb_image-LICENSE.txt",
    "wllama-musl-COPYRIGHT.txt",
    "wllama-libcxx-LICENSE.txt",
  ]) {
    assert.ok(
      assets.some(({ fileName }) => fileName === noticePath + component),
      component,
    );
  }
  assert.ok(!assets.some(({ fileName }) => fileName.includes("onnxruntime")));
  assert.deepEqual(
    collectModelAssetNotices({ includeWllama: false, includeWebGpu: false }),
    [],
  );
});

test("WebGPU notices cover ORT, model licenses, optional audio and modified-graph sidecars", () => {
  const assets = collectModelAssetNotices({ includeWebGpu: true });
  assert.equal(assets.length, 21);
  assert.equal(
    new Set(assets.map(({ fileName }) => fileName)).size,
    assets.length,
  );
  const get = (name) =>
    assets.find(({ fileName }) => fileName === noticePath + name)?.source;
  assert.match(
    get("onnxruntime-MIT.txt"),
    /Copyright \(c\) Microsoft Corporation/,
  );
  assert.equal(
    Buffer.byteLength(get("onnxruntime-ThirdPartyNotices.txt")),
    325054,
  );
  assert.match(
    get("huggingface-transformers-Apache-2.0.txt"),
    /Apache License/,
  );
  assert.match(
    get("Apache-2.0.txt"),
    /TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION/,
  );
  const modifications = get("MODEL_MODIFICATIONS.md");
  assert.ok(modifications.includes(TRANSFORMERS_QWEN_REVISION));
  assert.ok(modifications.includes(TRANSFORMERS_GEMMA_REVISION));
  assert.match(modifications, /not reconstructed/);
  assert.match(modifications, /modified in-memory decoder/);
  for (const artifact of TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS) {
    assert.ok(modifications.includes(artifact.path));
    assert.ok(modifications.includes(artifact.sha256));
  }
  for (const graph of TRANSFORMERS_WEBGPU_PACKAGED_MODEL_ARTIFACTS) {
    const sidecar = assets.find(
      ({ fileName }) =>
        fileName === `assets/transformers-webgpu/qwen3vl2b/${graph}.NOTICE.txt`,
    );
    assert.match(sidecar?.source, /MODIFIED MODEL GRAPH/);
    assert.match(sidecar.source, /MODEL_MODIFICATIONS.md/);
  }
  assert.ok(
    assets.every(({ fileName }) => !/\.(wasm|onnx|onnx_data)$/.test(fileName)),
    "notices never bundle model/audio payloads",
  );
});

test("Rollup emits the complete same set into web/APK frontendDist", () => {
  const options = { includeWllama: true, includeWebGpu: true };
  const emitted = [];
  modelAssetNoticesPlugin(options).generateBundle.call({
    emitFile: (asset) => emitted.push(asset),
  });
  assert.deepEqual(emitted, collectModelAssetNotices(options));
});

test("canonicalization accepts CRLF but rejects invalid UTF-8 and preserves BOM/whitespace", () => {
  assert.equal(canonicalNoticeText(Buffer.from("A\r\nB\n")), "A\nB\n");
  assert.equal(canonicalNoticeText(Buffer.from("A")), "A\n");
  assert.equal(canonicalNoticeText(Buffer.from("\ufeffA \n")), "\ufeffA \n");
  assert.throws(() => canonicalNoticeText(Buffer.from([0xff])));
  const baseline = collectModelAssetNotices({ includeWebGpu: true });
  const crlf = collectModelAssetNotices({
    includeWebGpu: true,
    readFile: (file) =>
      Buffer.from(
        readFileSync(file, "utf8")
          .replace(/\r\n/g, "\n")
          .replace(/\n/g, "\r\n"),
      ),
  });
  assert.deepEqual(crlf, baseline);
});

for (const file of [
  "onnxruntime-MIT.txt",
  "onnxruntime-ThirdPartyNotices.txt",
  "wllama-MIT.txt",
]) {
  test(`corrupt or omitted notice fails before emission: ${file}`, () => {
    assert.throws(
      () =>
        collectModelAssetNotices({
          includeWebGpu: true,
          readFile: readWith(
            `app/model-asset-notices/${file}`,
            () => "incomplete\n",
          ),
        }),
      /changed or is incomplete/,
    );
    assert.throws(
      () =>
        collectModelAssetNotices({
          includeWebGpu: true,
          readFile: (candidate) => {
            if (path.basename(candidate) === file)
              throw new Error("missing notice fixture");
            return readFileSync(candidate);
          },
        }),
      /missing notice/,
    );
  });
}

test("manifest cannot omit, duplicate or reassign component notice coverage", () => {
  for (const modify of [
    (manifest) => {
      manifest.documents.pop();
    },
    (manifest) => {
      manifest.documents.push(manifest.documents[0]);
    },
    (manifest) => {
      manifest.documents[0].group = "unselected";
    },
  ]) {
    assert.throws(
      () =>
        collectModelAssetNotices({
          includeWebGpu: true,
          readFile: (file) => {
            if (path.resolve(file) !== manifestPath) return readFileSync(file);
            const value = JSON.parse(readFileSync(file, "utf8"));
            modify(value);
            return Buffer.from(JSON.stringify(value));
          },
        }),
      /Incomplete model asset notice coverage/,
    );
  }
});

for (const file of [
  "package.json",
  "package-lock.json",
  "node_modules/onnxruntime-web/package.json",
]) {
  test(`runtime identity changes require attribution review: ${file}`, () => {
    assert.throws(
      () =>
        collectModelAssetNotices({
          includeWebGpu: true,
          readFile: readWith(file, (bytes) =>
            bytes
              .toString("utf8")
              .replaceAll("1.29.0-dev.20260723-1b1e1db7bc", "1.29.0-other"),
          ),
        }),
      /Review model asset notices/,
    );
  });
}

test("wrong ORT revision and changed installed license fail closed", () => {
  assert.throws(
    () =>
      collectModelAssetNotices({
        includeWebGpu: true,
        readFile: readWith("node_modules/onnxruntime-web/__commit.txt", () =>
          "a".repeat(40),
        ),
      }),
    /notice revision/,
  );
  assert.throws(
    () =>
      collectModelAssetNotices({
        readFile: readWith(
          "node_modules/@wllama/wllama/LICENCE",
          () => "changed",
        ),
      }),
    /installed license changed/,
  );
  assert.throws(
    () => collectModelAssetNotices({ includeWebGpu: "true" }),
    /booleans/,
  );
});
