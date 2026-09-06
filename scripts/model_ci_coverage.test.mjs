import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const workflow = read(".github/workflows/on_device_model_security.yaml");

// Parse only the workflow's simple block mappings, rejecting missing/ambiguous
// blocks. Event coverage must come from on.pull_request, never push or job text.
function mappingBlock(text, key, indentation) {
  const matches = [
    ...text.matchAll(
      new RegExp(`^${" ".repeat(indentation)}${key}:[ \\t]*\\r?$`, "gmu"),
    ),
  ];
  assert.equal(matches.length, 1, `expected one ${key} mapping`);
  const rest = text.slice(matches[0].index + matches[0][0].length);
  const end = rest.search(new RegExp(`^ {0,${indentation}}\\S`, "mu"));
  return end === -1 ? rest : rest.slice(0, end);
}

function pullRequestPaths(text) {
  const events = mappingBlock(text, "on", 0);
  const pullRequest = mappingBlock(events, "pull_request", 2);
  const paths = mappingBlock(pullRequest, "paths", 4);
  return paths
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => {
      const match = /^      - ("[^"]+")$/u.exec(line);
      assert.ok(match, `unsupported PR path entry: ${line}`);
      return JSON.parse(match[1]);
    });
}

// The workflow deliberately uses only positive literal paths, * and **. Keep
// this matcher limited to that syntax instead of silently guessing other globs.
function pathPattern(pattern) {
  assert.match(pattern, /^[a-zA-Z0-9_./*-]+$/u);
  let expression = "";
  for (let i = 0; i < pattern.length; i += 1) {
    if (pattern.slice(i, i + 3) === "**/") {
      expression += "(?:.*/)?";
      i += 2;
    } else if (pattern.slice(i, i + 2) === "**") {
      expression += ".*";
      i += 1;
    } else if (pattern[i] === "*") {
      expression += "[^/]*";
    } else {
      expression += pattern[i] === "." ? "\\." : pattern[i];
    }
  }
  return new RegExp(`^${expression}$`, "u");
}

function modelTestFilters(text) {
  const jobs = mappingBlock(text, "jobs", 0);
  const job = mappingBlock(jobs, "frontend-contracts", 2);
  const command = /\n        run: >-\r?\n((?:          [^\r\n]+\r?\n?)+)/u.exec(
    job,
  );
  assert.ok(command, "missing folded model test command");
  const words = command[1].trim().split(/\s+/u);
  assert.deepEqual(words.splice(0, 3), ["npm", "test", "--"]);
  assert.ok(words.length, "model test command has no path filters");
  return words;
}

function sourceFiles(path) {
  return readdirSync(join(root, "frontend", path), {
    withFileTypes: true,
  }).flatMap((entry) => {
    if (
      ["node_modules", "build", ".git", "model-overrides"].includes(entry.name)
    ) {
      return [];
    }
    const child = `${path}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(child) : [child];
  });
}

// Discover current and future tests by model-owned naming families, not a frozen
// list of today's filenames. App-authored action/OCR suites remain in full CI.
const modelFamily =
  /\/(?:customModels|onDeviceModels|model|onDeviceInference|nativeInferenceRuntimeBridge|webInference|transformersWebGpu|gemma4WebGpu|WebInferenceRuntimeSettings|localAi|localAudioInput|configuredLocalBlobUrl|localImageInput|publicBlob|rollup-plugin-wasm-url|bootstrapSecurity)[^/]*\.(?:spec|test)\.[cm]?[jt]sx?$/u;
const candidateFiles = [
  ...sourceFiles("app"),
  ...sourceFiles("openchat-agent/src/services/storageBucket"),
];
const inventory = candidateFiles.filter((path) => modelFamily.test(path));
const filters = modelTestFilters(workflow);
const patterns = pullRequestPaths(workflow).map(pathPattern);
const triggers = (path) => patterns.some((pattern) => pattern.test(path));

test("the model CI selects every discovered local-model frontend test", () => {
  assert.ok(inventory.length, "model test inventory is empty");
  assert.ok(
    inventory.includes("app/src/utils/nativeInferenceRuntimeBridge.spec.ts"),
  );
  const missed = inventory.filter(
    (path) => !filters.some((filter) => path.includes(filter)),
  );
  assert.deepEqual(missed, [], `unselected model tests:\n${missed.join("\n")}`);
});

test("model selectors are literal Vitest path prefixes that include future sibling tests", () => {
  for (const filter of filters) {
    assert.match(
      filter,
      /^(?:app|openchat-agent\/src\/services\/storageBucket)\/[a-zA-Z0-9_./-]+$/u,
    );
    assert.doesNotMatch(filter, /\.(?:spec|test)\./u);
    assert.ok(
      candidateFiles.some((path) => path.includes(filter)),
      `unused filter: ${filter}`,
    );
  }
  for (const path of inventory) {
    const sibling = path.replace(
      /\.(?:spec|test)\./u,
      ".future-regression.spec.",
    );
    assert.ok(
      filters.some((filter) => sibling.includes(filter)),
      sibling,
    );
  }
});

test("Vitest includes and excludes admit every discovered model suite", () => {
  const config = read("frontend/vitest.config.ts");
  const configuredPatterns = (field) => {
    const blocks = [
      ...config.matchAll(new RegExp(`^ +${field}: \\[([^\\]]*)\\]`, "gmu")),
    ];
    assert.equal(blocks.length, 1, `expected one literal Vitest ${field} list`);
    const list = blocks[0][1];
    assert.equal(list.replace(/"[^"]*"/gu, "").replace(/[,\s]/gu, ""), "");
    return [...list.matchAll(/"([^"]+)"/gu)].flatMap((match) => {
      // This is the only brace expansion used by the repository test config.
      // Any future glob syntax must be supported explicitly, not silently ignored.
      const pattern = match[1];
      return pattern.includes("{test,spec}")
        ? ["test", "spec"].map((kind) =>
            pathPattern(pattern.replace("{test,spec}", kind)),
          )
        : [pathPattern(pattern)];
    });
  };
  const includes = configuredPatterns("include");
  const excludes = configuredPatterns("exclude");
  for (const path of inventory) {
    assert.ok(
      includes.some((pattern) => pattern.test(path)),
      `Vitest does not discover ${path}`,
    );
    assert.ok(
      !excludes.some((pattern) => pattern.test(path)),
      `Vitest excludes ${path}`,
    );
  }
});

test("every discovered model test triggers the model pull-request workflow", () => {
  const missed = inventory.filter((path) => !triggers(`frontend/${path}`));
  assert.deepEqual(
    missed,
    [],
    `model tests missing PR coverage:\n${missed.join("\n")}`,
  );
});

test("model runtime, workers, helpers, UI, build, notices and policy inputs trigger on pull requests", () => {
  for (const path of [
    "frontend/app/src/utils/webInference.ts",
    "frontend/app/src/utils/nativeInferenceRuntimeBridge.spec.ts",
    "frontend/app/src/utils/imageDimensions.ts",
    "frontend/app/.ic-assets.json5",
    "frontend/vite-env.d.ts",
    "frontend/global.d.ts",
    "frontend/app/src/components/home/MessageEntry.svelte",
    "frontend/app/src/components_mobile/home/MessageEntry.svelte",
    "frontend/app/src/utils/localAudioInput.ts",
    "frontend/app/src/utils/configuredLocalBlobUrl.ts",
    "frontend/openchat-agent/src/services/storageBucket/publicBlob.ts",
    "frontend/openchat-agent/src/services/storageBucket/storageBucket.client.ts",
    "frontend/openchat-client/src/openchat.ts",
    "frontend/openchat-worker/src/worker.ts",
    "frontend/openchat-shared/src/domain/worker.ts",
    "frontend/openchat-agent/src/services/openchatAgent.ts",
    "frontend/app/src/utils/transformersWebGpuInference.ts",
    "frontend/app/src/utils/transformersWebGpuAudio.ts",
    "frontend/app/src/utils/transformersWebGpuDeviceRetirement.ts",
    "frontend/app/src/utils/gemma4WebGpuEmbedding.ts",
    "frontend/app/src/workers/transformersWebGpuInference.worker.ts",
    "frontend/app/src/stores/onDeviceModels.ts",
    "frontend/app/src/stores/transformersWebGpuSettings.ts",
    "frontend/app/src/components/home/profile/ModelManager.svelte",
    "frontend/app/src/components_mobile/home/user_profile/ModelManager.svelte",
    "frontend/app/src/components_shared/WebInferenceRuntimeSettings.svelte",
    "frontend/openchat-shared/src/domain/onDeviceModel.ts",
    "frontend/openchat-agent/src/services/registry/modelCatalog.ts",
    "frontend/app/transformersWebGpuFeatureFlag.mjs",
    "frontend/app/transformersWebGpuDecoderGraph.mjs",
    "frontend/app/transformersWebGpuSequentialSessions.mjs",
    "frontend/app/build-workers.mjs",
    "frontend/app/rollup.config.mjs",
    "frontend/app/rollup.extras.mjs",
    "frontend/app/rollup-plugin-wasm-url.mjs",
    "frontend/app/modelAssetNotices.mjs",
    ".gitattributes",
    "frontend/app/model-asset-notices/sources.json",
    "frontend/app/model-asset-notices/MODEL_MODIFICATIONS.md",
    "frontend/vitest.config.ts",
    "frontend/app/vitest.config.ts",
    "frontend/tauri-plugin-oc/src/model_manager.rs",
    "scripts/check_openchat_pr1_security.mjs",
    "scripts/model_ci_coverage.test.mjs",
    "scripts/model_asset_notices.test.mjs",
    "scripts/verify_webgpu_distribution.mjs",
    "scripts/android_bundle.test.mjs",
    ".github/security/openchat-pr1-security-baseline.json",
    ".github/workflows/frontend.yaml",
  ]) {
    assert.ok(existsSync(join(root, path)), `stale coverage fixture: ${path}`);
    assert.ok(triggers(path), `model PR workflow is not triggered by ${path}`);
  }
  for (const path of [
    "docs/unrelated-guide.md",
    "backend/canisters/user/impl/src/lib.rs",
    "frontend/app/src/utils/navigation.ts",
  ]) {
    assert.ok(
      !triggers(path),
      `model paths became unnecessarily broad: ${path}`,
    );
  }
});

test("coverage extraction cannot use patterns from push or job text", () => {
  const text =
    'on:\n  pull_request:\n    paths:\n      - "unrelated/**"\n  push:\n    paths:\n      - "frontend/**"\njobs:\n  example:\n    paths:\n      - "frontend/**"\n';
  assert.deepEqual(pullRequestPaths(text), ["unrelated/**"]);
  assert.ok(
    !pullRequestPaths(text)
      .map(pathPattern)
      .some((pattern) =>
        pattern.test("frontend/app/src/utils/webInference.ts"),
      ),
  );
});

test("the limited PR glob matcher preserves path-segment and globstar boundaries", () => {
  assert.ok(
    pathPattern("frontend/**/package.json").test("frontend/package.json"),
  );
  assert.ok(
    pathPattern("frontend/**/package.json").test("frontend/app/package.json"),
  );
  assert.ok(
    pathPattern("frontend/app/src/components*/**/ModelManager.svelte").test(
      "frontend/app/src/components_mobile/home/user_profile/ModelManager.svelte",
    ),
  );
  assert.ok(
    !pathPattern("frontend/app/src/utils/model*").test(
      "frontend/app/src/utils/models/unrelated.ts",
    ),
  );
  assert.throws(() => pathPattern("!frontend/**"));
});

test("normal frontend CI runs this coverage regression as a policy test", () => {
  const frontend = read(".github/workflows/frontend.yaml");
  const policyStep = frontend
    .split("- name: Check model and packaging policy regressions")[1]
    ?.split(/\n      - /u)[0];
  assert.ok(policyStep, "missing frontend policy test step");
  assert.match(
    policyStep,
    /run: node --test [^\r\n]*\bscripts\/model_ci_coverage\.test\.mjs(?:\s|$)/u,
  );
});

test("legacy workspace commands and fixed filenames cannot replace prefix discovery", () => {
  const legacy =
    "jobs:\n  frontend-contracts:\n    steps:\n      - name: Run model tests\n        run: >-\n          npm --workspace app test --\n          src/utils/modelCatalog.spec.ts\n";
  assert.throws(() => modelTestFilters(legacy));
  assert.doesNotMatch(workflow, /npm --workspace app/u);
});

test("native CI compiles both app feature sets on both supported runner platforms", () => {
  const jobs = mappingBlock(workflow, "jobs", 0);
  const native = mappingBlock(jobs, "native-hermetic", 2);
  assert.match(native, /os: \[ubuntu-24\.04, windows-2022\]/u);
  assert.equal(
    [
      ...native.matchAll(
        /^ +cargo check -p open-chat --features inference\r?$/gmu,
      ),
    ].length,
    2,
  );
  assert.equal(
    [
      ...native.matchAll(
        /^ +cargo check -p open-chat --features inference,store\r?$/gmu,
      ),
    ].length,
    2,
  );
  assert.doesNotMatch(native, /cargo check -p tauri-plugin-oc/u);
  assert.match(native, /cargo test -p tauri-plugin-oc --lib/u);
});

test("the frontend build runs a read-only lint check", () => {
  const manifest = JSON.parse(read("frontend/package.json"));
  assert.equal(manifest.scripts["lint:check"], "eslint .");
  assert.match(
    manifest.scripts["build:ci"],
    /(?:^|&&)\s*npm run lint:check(?:\s*&&|$)/u,
  );
  assert.doesNotMatch(manifest.scripts["build:ci"], /\bnpm run lint(?:\s|$)/u);
  assert.doesNotMatch(manifest.scripts["lint:check"], /--fix/u);
  assert.match(
    read(".github/workflows/frontend.yaml"),
    /run: npm run build:ci/u,
  );
});

test("frontend policy invokes only generic regression scripts present in this checkout", () => {
  const step = read(".github/workflows/frontend.yaml")
    .split("- name: Check model and packaging policy regressions")[1]
    ?.split(/\n      - /u)[0];
  assert.ok(step);
  const command = /run: node --test ([^\r\n]+)/u.exec(step);
  assert.ok(command);
  const files = command[1].trim().split(/\s+/u);
  assert.deepEqual(files, [
    "scripts/android_bundle.test.mjs",
    "scripts/model_asset_notices.test.mjs",
    "scripts/verify_webgpu_distribution.test.mjs",
    "scripts/model_ci_coverage.test.mjs",
  ]);
  for (const path of files) assert.ok(existsSync(join(root, path)), path);
});
