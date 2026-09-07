import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  artifactIdentity,
  assertIncreasingVersion,
  collectPreflight,
  modelDistributionInventory,
  REQUIRED_RELEASE_EVIDENCE,
  sourceFindings,
  prerequisiteFindings,
  preflightSourceAttribution,
  REVIEWED_GRADLE_DISTRIBUTION,
} from "./release_preflight.mjs";
import {
  ANDROID_RELEASE_BUILD_TOOLS_VERSION,
  releaseBuildToolsDirectory,
} from "./android_release_policy.mjs";

test("native version progression derives the next code and independently validates historical codes", () => {
  assert.deepEqual(assertIncreasingVersion("2.0.1234", "2001234", "50000"), {
    version: "2.0.1234",
    versionCode: 2001234,
    previousVersionCode: 50000,
  });
  for (const code of ["50000", "49999", "0", "01", "2100000001"]) {
    assert.throws(() => assertIncreasingVersion("2.0.1234", code, "50000"));
  }
  assert.equal(
    assertIncreasingVersion("2.0.1234", undefined, "50000").versionCode,
    2001234,
  );
  for (const previous of [
    "2001234",
    "2001235",
    "2100000000",
    "0",
    "01",
    "2100000001",
    "50000\n",
    undefined,
  ]) {
    assert.throws(() =>
      assertIncreasingVersion("2.0.1234", "2001234", previous),
    );
  }
  assert.throws(() => assertIncreasingVersion("v2.0.1", "2000001", "50000"));
});

test("same-length corrupt artifact bytes and malformed identity metadata are rejected", () => {
  const bytes = Buffer.from("reviewed bytes");
  const identity = {
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  assert.equal(artifactIdentity(bytes, identity), true);
  assert.equal(
    artifactIdentity(Buffer.from("unreview bytes"), identity),
    false,
  );
  assert.equal(
    artifactIdentity(Buffer.concat([bytes, bytes]), identity),
    false,
  );
  assert.throws(() =>
    artifactIdentity(bytes, { ...identity, sha256: "unknown" }),
  );
  assert.throws(() => artifactIdentity(bytes, { ...identity, bytes: -1 }));
});

test("actual Qwen and Gemma manifests retain separate optional audio and exact immutable delivery", () => {
  const models = modelDistributionInventory();
  assert.equal(models.length, 2);
  const audioModel = models.find((model) => model.optionalAudio.length > 0);
  assert.equal(audioModel.optionalAudio.length, 2);
  assert.equal(audioModel.optionalAudioBytes, 171518558);
  assert.ok(
    audioModel.optionalAudio.every(
      (artifact) => artifact.delivery === "optional-immutable-download",
    ),
  );
  assert.ok(
    audioModel.artifacts.every(
      (artifact) => !artifact.path.includes("audio_encoder"),
    ),
  );
  assert.equal(
    models
      .flatMap((model) => model.artifacts)
      .filter((artifact) => artifact.delivery === "packaged-graph").length,
    2,
  );
  assert.ok(models.every((model) => /^[a-f0-9]{40}$/u.test(model.revision)));
});

test("inventory rejects moving revisions, unsafe paths, digest omissions and mismatched byte totals", () => {
  const original = {
    id: "example",
    repository: "example/model",
    revision: "a".repeat(40),
    dtype: "q4",
    artifacts: [{ path: "config.json", bytes: 1, sha256: "b".repeat(64) }],
    artifactBytes: 1,
    packagedArtifacts: [],
  };
  for (const change of [
    { revision: "main" },
    { artifactBytes: 2 },
    { packagedArtifacts: ["missing.onnx"] },
    {
      artifacts: [{ path: "../config.json", bytes: 1, sha256: "b".repeat(64) }],
    },
    { artifacts: [{ path: "config.json", bytes: 1, sha256: "" }] },
    { optionalAudio: { artifacts: original.artifacts, artifactBytes: 1 } },
  ])
    assert.throws(() =>
      modelDistributionInventory({ example: { ...original, ...change } }),
    );
});

const completeSource = {
  workflow:
    "cargo tauri android build --features transformers-webgpu-android\ncargo tauri android build --features transformers-webgpu-android,store",
  wrapper: `distributionSha256Sum=${"a".repeat(64)}\n`,
  gradleApp: 'ndkVersion = "26.1.10909125"\nbuildToolsVersion = "36.0.0"',
  productionWebGpuEnabled: true,
};

test("reviewed source declarations do not substitute for release evidence", () => {
  assert.deepEqual(sourceFindings(completeSource), []);
  assert.ok(
    REQUIRED_RELEASE_EVIDENCE.some(
      (item) => item.id === "physical-device-acceptance",
    ),
  );
  assert.ok(
    REQUIRED_RELEASE_EVIDENCE.some((item) => item.id === "backend-app-rollout"),
  );
  assert.ok(
    REQUIRED_RELEASE_EVIDENCE.some(
      (item) => item.id === "signing-and-account-identity",
    ),
  );
});

for (const [id, change] of [
  ["production-webgpu-gate", { productionWebGpuEnabled: false }],
  [
    "shipping-runtime-selection",
    {
      workflow:
        "cargo tauri android build --features inference\ncargo tauri android build --features inference,store",
    },
  ],
  [
    "shipping-runtime-selection",
    {
      workflow:
        "cargo tauri android build --features transformers-webgpu-android",
    },
  ],
  [
    "shipping-runtime-selection",
    {
      workflow:
        "cargo tauri android build --features inference,transformers-webgpu-android\ncargo tauri android build --features transformers-webgpu-android,store",
    },
  ],
  [
    "android-ndk-pin",
    {
      workflow:
        completeSource.workflow + "\nfind android/ndk | sort -V | tail -n 1",
    },
  ],
  ["android-ndk-pin", { gradleApp: 'buildToolsVersion = "36.0.0"' }],
  ["android-build-tools-pin", { gradleApp: 'ndkVersion = "26.1.10909125"' }],
  [
    "gradle-distribution-digest",
    { wrapper: "distributionUrl=https://example.invalid/gradle.zip" },
  ],
]) {
  test(`source blocker remains detectable: ${id} ${JSON.stringify(change)}`, () => {
    assert.ok(
      sourceFindings({ ...completeSource, ...change }).some(
        (finding) => finding.id === id,
      ),
    );
  });
}

test("current source preflight never reports a shipping release as verified", () => {
  const report = collectPreflight({
    version: "2.0.1234",
    versionCode: "50001",
    previousVersionCode: "50000",
    now: new Date("2026-09-06T00:00:00Z"),
  });
  assert.equal(report.releaseReady, false);
  assert.equal(report.assessment, "offline-source-preflight");
  assert.equal(report.requestedRuntime, "all-webgpu");
  assert.equal(report.productionWebGpuEnabled, false);
  assert.equal(report.productionAssetContractAvailable, true);
  assert.ok(
    report.findings.some((finding) => finding.id === "production-webgpu-gate"),
  );
  assert.ok(report.notPerformed.includes("credential inspection"));
  assert.ok(report.notPerformed.includes("device tests"));
  assert.equal(report.sourceAssets.length, 4);
  assert.ok(report.toolchainDeclarations.node);
  assert.ok(report.toolchainDeclarations.rust);
});

test("CLI rejects unsupported flags and never accepts an approval bypass", () => {
  const script = fileURLToPath(
    new URL("./release_preflight.mjs", import.meta.url),
  );
  for (const args of [
    ["--approve"],
    ["--skip-security", "true"],
    ["--version", "2.0.1", "--version", "2.0.2"],
  ]) {
    const result = spawnSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      cwd: resolve(script, ".."),
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid or repeated preflight argument/u);
  }
});

const sourceText = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const currentPrerequisites = {
  workflow: sourceText(".github/workflows/android_release.yaml"),
  wrapper: sourceText(
    "frontend/src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties",
  ),
  gradleApp: sourceText("frontend/src-tauri/gen/android/app/build.gradle.kts"),
  dfxVersion: JSON.parse(sourceText("dfx.json")).dfx,
};

test("Android source uses the proven local toolchain and exact official Gradle checksum", () => {
  assert.deepEqual(prerequisiteFindings(currentPrerequisites), []);
  assert.equal(
    REVIEWED_GRADLE_DISTRIBUTION.sha256,
    "f1771298a70f6db5a29daf62378c4e18a17fc33c9ba6b14362e0cdf40610380d",
  );
  assert.equal(currentPrerequisites.dfxVersion, "0.31.0-beta.1");
  assert.doesNotMatch(currentPrerequisites.workflow, /sort -V\s*\|\s*tail/u);
  assert.doesNotMatch(
    currentPrerequisites.gradleApp,
    /System\.getenv\("ANDROID_(?:NDK|BUILD_TOOLS)_VERSION"\)/u,
  );
});

for (const [id, change] of [
  [
    "reviewed-ndk-selection",
    {
      gradleApp: currentPrerequisites.gradleApp.replace(
        'ndkVersion = "26.1.10909125"',
        'ndkVersion = "27.0.12077973"',
      ),
    },
  ],
  [
    "reviewed-ndk-selection",
    {
      workflow: currentPrerequisites.workflow.replace(
        '"ndk;$ANDROID_NDK_VERSION"',
        '"ndk;27.0.12077973"',
      ),
    },
  ],
  [
    "reviewed-build-tools-selection",
    {
      workflow: currentPrerequisites.workflow.replace(
        'ANDROID_BUILD_TOOLS_VERSION: "35.0.0"',
        'ANDROID_BUILD_TOOLS_VERSION: "36.0.0"',
      ),
    },
  ],
  [
    "reviewed-build-tools-selection",
    {
      gradleApp: currentPrerequisites.gradleApp.replace(
        'buildToolsVersion = "35.0.0"',
        'buildToolsVersion = "36.0.0"',
      ),
    },
  ],
  [
    "reviewed-gradle-distribution",
    {
      wrapper: currentPrerequisites.wrapper.replace(
        REVIEWED_GRADLE_DISTRIBUTION.sha256,
        "b".repeat(64),
      ),
    },
  ],
  [
    "reviewed-gradle-distribution",
    {
      wrapper: currentPrerequisites.wrapper.replace(
        "gradle-8.14.4-bin.zip",
        "gradle-8.14.4-all.zip",
      ),
    },
  ],
  [
    "dfx-production-prerequisite",
    {
      workflow: currentPrerequisites.workflow.replace(
        "e50c04f104ee4285ec010f10609483cf41e4d365",
        "v1",
      ),
    },
  ],
  ["dfx-production-prerequisite", { dfxVersion: "0.30.0" }],
  [
    "dfx-production-prerequisite",
    {
      workflow: currentPrerequisites.workflow.replace(
        "run: dfx --version",
        "run: echo unavailable",
      ),
    },
  ],
]) {
  test(`modified Android prerequisite fails: ${id} ${JSON.stringify(Object.keys(change))}`, () => {
    assert.ok(
      prerequisiteFindings({ ...currentPrerequisites, ...change }).some(
        (finding) => finding.id === id,
      ),
    );
  });
}

test("APK verification selects only explicitly configured reviewed tools, never a newer installed folder", () => {
  const sdk = resolve("fixture-sdk");
  assert.equal(
    releaseBuildToolsDirectory(sdk, ANDROID_RELEASE_BUILD_TOOLS_VERSION),
    resolve(sdk, "build-tools", "35.0.0"),
  );
  for (const invalid of [undefined, "", "36.0.0", "35.0.0\n", "../35.0.0"]) {
    assert.throws(
      () => releaseBuildToolsDirectory(sdk, invalid),
      /explicitly select the reviewed/u,
    );
  }
  assert.throws(
    () => releaseBuildToolsDirectory(undefined, "35.0.0"),
    /ANDROID_HOME/u,
  );
  assert.doesNotMatch(
    sourceText("scripts/android_release_policy.mjs"),
    /versions\.sort|versions\.at\(-1\)|readdirSync/u,
  );
});

test("dirty-worktree attribution never labels current local bytes as the committed source", () => {
  const head = "a".repeat(40);
  const report = preflightSourceAttribution(
    { status: 0, stdout: `${head}\n` },
    {
      status: 0,
      stdout: " M frontend/app/rollup.config.mjs\0?? scripts/new-check.mjs\0",
    },
  );
  assert.equal(report.gitHeadRevision, head);
  assert.equal(report.worktreeDirty, true);
  assert.equal(
    report.assessedSource,
    "working-tree-and-installed-artifact-files",
  );
  assert.equal(Object.hasOwn(report, "sourceRevision"), false);
  assert.match(report.sourceAttributionNote, /uncommitted changes/u);
  assert.match(
    report.sourceAttributionNote,
    /not an exact-source attestation/u,
  );
  assert.doesNotMatch(
    JSON.stringify(report),
    /new-check\.mjs|rollup\.config\.mjs/u,
  );
});

test("clean tracked status remains distinct from ignored artifacts and unknown Git status", () => {
  const head = { status: 0, stdout: `${"b".repeat(40)}\r\n` };
  const clean = preflightSourceAttribution(head, { status: 0, stdout: "" });
  assert.equal(clean.worktreeDirty, false);
  assert.match(clean.sourceAttributionNote, /ignored build\/dependency files/u);
  for (const status of [
    { status: 1, stdout: "" },
    { status: null },
    { status: 0 },
  ]) {
    assert.equal(preflightSourceAttribution(head, status).worktreeDirty, null);
  }
  assert.equal(
    preflightSourceAttribution(
      { status: 1, stdout: head.stdout },
      { status: 0, stdout: "" },
    ).gitHeadRevision,
    null,
  );
  assert.equal(
    preflightSourceAttribution(
      { status: 0, stdout: "not a revision" },
      { status: 0, stdout: "" },
    ).gitHeadRevision,
    null,
  );
});
