import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const sourceTextIdentity = "utf8-lf";
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const packageName = (name) =>
  name.startsWith("@")
    ? name.split("/").slice(0, 2).join("/")
    : name.split("/")[0];
const reviewedRoots = {
  "pr1-model-npm": [
    "|@huggingface/transformers",
    "|@wllama/wllama",
    "|onnxruntime-web",
    "|@noble/hashes",
    "|svelte",
    "|tauri-plugin-oc-api",
    "|@sinclair/typebox",
    "|@icp-sdk/core",
    "|msgpackr",
    "|vite",
    "|@tauri-apps/cli",
    "|chokidar",
    "|rollup-plugin-copy",
    "location|node_modules/fs-extra",
    "|svelte-i18n",
    "|svelte-material-icons",
    "component-lib|@tsconfig/svelte",
    "component-lib|typescript",
  ],
  "pr2-app-card-ocr-npm": [
    "|tesseract.js",
    "|tesseract.js-core",
    "|@tesseract.js-data/eng",
    "|@tesseract.js-data/ara",
    "|svelte",
    "component-lib|@tsconfig/svelte",
    "component-lib|typescript",
    "|svelte-material-icons",
    "|svelte-i18n",
    "|@icp-sdk/core",
    "|@sinclair/typebox",
    "|msgpackr",
    "|@noble/hashes",
    "|idb",
    "tauri-plugin-oc|@tauri-apps/api",
    "|vite",
    "|rollup-plugin-copy",
  ],
};
const selectors = {
  "pr1-model-npm": [
    ["frontend/app", /^transformersWebGpu.*\.mjs$/],
    [
      "frontend/app/src/utils",
      /^(?:gemma4WebGpu|transformersWebGpu|webInference|webGpuModelCatalog|onDeviceInference|modelCatalog|modelSuitability)/,
    ],
    [
      "frontend/app/src/stores",
      /^(?:onDeviceModels|customModels|transformersWebGpuSettings|webGpuModelCatalog)\./,
    ],
    ["frontend/app/src/workers", /^transformersWebGpuInference\.worker\.ts$/],
    [
      "frontend/app/src/components_shared",
      /^(?:WebInferenceRuntimeSettings|WebGpuModelCatalogSettings)\.svelte$/,
    ],
  ],
  "pr2-app-card-ocr-npm": [
    [
      "frontend/app/src/utils",
      /^(?:aiAction|aiApp|appLocalProcessor|browserOcr|cardBridge|localActionExtractor|inferenceImage|ocrImage|privateMatchSurface|imageGate|autoPropose|localAi|imageSemantic)/,
    ],
    [
      "frontend/app/src/components/home",
      /^(?:AiApp|ActionCardContent|HardenedAiAppSurface)/,
    ],
    ["frontend/app/src/components_mobile/home", /^AiApp/],
    ["frontend/openchat-agent/src/services/common", /^aiApp/],
    ["frontend/openchat-shared/src/domain", /^aiAction\.ts$/],
  ],
};

export function featureOwnedFiles(repositoryRoot, scopeId) {
  assert(selectors[scopeId], "unknown reviewed feature scope");
  const files = selectors[scopeId].flatMap(([directory, pattern]) =>
    readdirSync(resolve(repositoryRoot, directory), { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          pattern.test(entry.name) &&
          /\.(?:ts|svelte|mjs)$/.test(entry.name) &&
          !/\.(?:test|spec)\./.test(entry.name),
      )
      .map((entry) => `${directory}/${entry.name}`),
  );
  if (scopeId === "pr1-model-npm")
    files.push(
      "frontend/app/src/components/home/profile/ModelManager.svelte",
      "frontend/app/src/components_mobile/home/user_profile/ModelManager.svelte",
      "frontend/openchat-agent/src/services/registry/modelCatalog.ts",
    );
  return files.sort();
}

function safePath(path) {
  assert(
    typeof path === "string" &&
      /^(?:frontend|scripts)\//.test(path) &&
      !path.includes("\\") &&
      !path.includes(":") &&
      !path.split("/").includes(".."),
    "unsafe provenance path",
  );
  return path;
}

// Source-review snapshots normalize only CRLF to LF in strict UTF-8. This never
// changes collector manifest/lock bytes or their independent raw-byte identities.
export function sourceReviewFingerprintFromBytes(entries) {
  assert(Array.isArray(entries) && entries.length, "empty source fingerprint");
  const sources = new Map();
  for (const [file, bytes] of entries) {
    safePath(file);
    assert(
      bytes instanceof Uint8Array,
      "source fingerprint requires UTF-8 bytes",
    );
    assert(!sources.has(file), "duplicate source fingerprint path");
    sources.set(file, bytes);
  }
  const files = [...sources.keys()].sort();
  return {
    files,
    textIdentity: sourceTextIdentity,
    sha256: sha256(
      JSON.stringify(
        files.map((file) => [
          file,
          sha256(
            new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
              .decode(sources.get(file))
              .replaceAll("\r\n", "\n"),
          ),
        ]),
      ),
    ),
  };
}

export function assertReviewedSourceFingerprint(fingerprint, sourceReview) {
  assert.equal(
    sourceReview?.textIdentity,
    sourceTextIdentity,
    "unsupported source fingerprint text identity",
  );
  assert.equal(fingerprint.textIdentity, sourceTextIdentity);
  assert(
    sourceReview.snapshots.some(
      (snapshot) => snapshot.sha256 === fingerprint.sha256,
    ),
    "feature source set changed; review roots before regenerating inventory",
  );
}

export function seedSourceFingerprint(repositoryRoot, config) {
  const files = [
    ...new Set([
      ...featureOwnedFiles(repositoryRoot, config.scopeId),
      ...config.seeds.flatMap((seed) =>
        seed.evidence.map((item) => safePath(item.file)),
      ),
    ]),
  ].sort();
  return sourceReviewFingerprintFromBytes(
    files.map((file) => [file, readFileSync(resolve(repositoryRoot, file))]),
  );
}

/** Read-only source ownership gate. No package execution, lock collection, advisory lookup or install. */
export function reviewFeatureSeeds(repositoryRoot, config) {
  assert.equal(config.sourceReview?.status, "reviewed-direct-feature-roots");
  assert.equal(
    config.sourceReview?.textIdentity,
    sourceTextIdentity,
    "unsupported source fingerprint text identity",
  );
  assert.equal(
    config.sourceReview?.boundary,
    "changed-feature-consumers-and-necessary-reached-edges",
  );
  assert.equal(
    config.status,
    "draft",
    "collector inventory status is separate from source review",
  );
  assert.deepEqual(
    config.seeds
      .map((seed) =>
        seed.kind === "edge"
          ? `${seed.from}|${seed.name}`
          : `location|${seed.location}`,
      )
      .sort(),
    [...reviewedRoots[config.scopeId]].sort(),
    "reviewed feature root set changed",
  );
  const identities = config.seeds.map((seed) =>
    JSON.stringify(
      seed.kind === "edge"
        ? [seed.kind, seed.from, seed.name]
        : [seed.kind, seed.location],
    ),
  );
  assert.equal(
    new Set(identities).size,
    identities.length,
    "duplicate feature roots",
  );
  const names = new Set();
  for (const seed of config.seeds) {
    assert(
      Array.isArray(seed.evidence) && seed.evidence.length > 0,
      "root lacks tracked source ownership evidence",
    );
    for (const item of seed.evidence) {
      assert(
        typeof item.contains === "string" && item.contains.length > 0,
        "empty source ownership anchor",
      );
      assert(
        readFileSync(
          resolve(repositoryRoot, safePath(item.file)),
          "utf8",
        ).includes(item.contains),
        "source ownership anchor changed",
      );
    }
    if (seed.kind === "edge") {
      assert(
        typeof seed.from === "string" &&
          !seed.from.includes("..") &&
          !/[\\:]/.test(seed.from),
      );
      const owner = json(
        resolve(repositoryRoot, "frontend", seed.from, "package.json"),
      );
      assert(
        [
          "dependencies",
          "devDependencies",
          "optionalDependencies",
          "peerDependencies",
        ].some((section) => Object.hasOwn(owner[section] ?? {}, seed.name)),
        "reviewed root edge is not declared by its owner",
      );
      names.add(seed.name);
    } else {
      assert.equal(seed.kind, "location");
      const locked = json(resolve(repositoryRoot, "frontend/package-lock.json"))
        .packages[seed.location];
      assert(locked?.version, "reviewed location root is absent from lock");
      names.add(seed.location.replace(/^node_modules\//, ""));
    }
  }
  if (config.sourceReview.inherits) {
    assert.equal(
      config.sourceReview.inherits,
      "scripts/npm_feature_scope.pr1.json",
    );
    for (const seed of json(
      resolve(repositoryRoot, config.sourceReview.inherits),
    ).seeds) {
      names.add(seed.name ?? seed.location.replace(/^node_modules\//, ""));
    }
  }
  // Scan dedicated feature modules, not entire mixed core/config files. Shared consumers instead
  // have exact ownership anchors above. The fingerprint also forces review for new feature files.
  for (const file of featureOwnedFiles(repositoryRoot, config.scopeId)) {
    const text = readFileSync(resolve(repositoryRoot, file), "utf8");
    const imports = [
      ...text.matchAll(
        /^\s*(?:import|export)\s+(?:type\s+)?[^;]*?\bfrom\s*["']([^"']+)["']/gm,
      ),
      ...text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
    ];
    for (const [, specifier] of imports) {
      if (
        specifier.startsWith(".") ||
        specifier.startsWith("node:") ||
        /^@(src|utils|client|shared|agent|app|i18n|stores|components|theme)(?:\/|$)/.test(
          specifier,
        )
      )
        continue;
      const name = packageName(specifier);
      if (name === "component-lib") {
        assert(
          names.has("@tsconfig/svelte") &&
            names.has("typescript") &&
            names.has("svelte") &&
            names.has("svelte-material-icons"),
          "selected component consumer dependencies are missing",
        );
      } else
        assert(
          names.has(name),
          `dedicated feature import has no reviewed root: ${name}`,
        );
    }
  }
  const fingerprint = seedSourceFingerprint(repositoryRoot, config);
  assertReviewedSourceFingerprint(fingerprint, config.sourceReview);
  return {
    scopeId: config.scopeId,
    sourceReview: config.sourceReview.status,
    roots: config.seeds.length,
    sourceFiles: fingerprint.files.length,
    sourceSha256: fingerprint.sha256,
    sourceTextIdentity: fingerprint.textIdentity,
    advisoryAcceptance: false,
  };
}

const ownRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  for (const file of [
    "npm_feature_scope.pr1.json",
    ...(existsSync(
      resolve(ownRoot, ".github/workflows/openchat_pr2_security.yaml"),
    )
      ? ["npm_feature_scope.pr2.json"]
      : []),
  ]) {
    console.log(
      JSON.stringify(
        reviewFeatureSeeds(ownRoot, json(resolve(ownRoot, "scripts", file))),
      ),
    );
  }
}
