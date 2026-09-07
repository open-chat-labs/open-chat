#!/usr/bin/env node

// Offline source preparation only: no downloads, builds, signing, credentials,
// deployment calls, device access, or changes to the existing release gates.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANDROID_RELEASE_BUILD_TOOLS_VERSION,
  nativeVersion,
} from "./android_release_policy.mjs";
import { reviewedDependencyDigest } from "./security_dependency_hash.mjs";
import {
  transformersWebGpuFeatureEnabled,
  transformersWebGpuProductionAssetsEnabled,
  TRANSFORMERS_WEBGPU_IMMUTABLE_DELIVERY,
} from "../frontend/app/transformersWebGpuFeatureFlag.mjs";
import {
  TRANSFORMERS_WEBGPU_MODEL_SPECS,
  TRANSFORMERS_WEBGPU_RUNTIME_ASSETS,
} from "../frontend/app/src/utils/transformersWebGpuProtocol.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function preflightSourceAttribution(headResult, statusResult) {
  const head =
    typeof headResult?.stdout === "string" ? headResult.stdout.trim() : "";
  const gitHeadRevision =
    headResult?.status === 0 && /^[a-f0-9]{40}$/u.test(head) ? head : null;
  const worktreeDirty =
    statusResult?.status === 0 && typeof statusResult.stdout === "string"
      ? statusResult.stdout.length > 0
      : null;
  return {
    gitHeadRevision,
    worktreeDirty,
    assessedSource: "working-tree-and-installed-artifact-files",
    sourceAttributionNote:
      "The report reads current local bytes, including uncommitted changes and installed artifacts. Git HEAD is reference metadata only, not an exact-source attestation or atomic snapshot; ignored build/dependency files are not part of Git's dirty status.",
  };
}

export const REVIEWED_ANDROID_NDK_VERSION = "26.1.10909125";
export const REVIEWED_GRADLE_DISTRIBUTION = Object.freeze({
  url: "https://services.gradle.org/distributions/gradle-8.14.4-bin.zip",
  sha256: "f1771298a70f6db5a29daf62378c4e18a17fc33c9ba6b14362e0cdf40610380d",
});

export function prerequisiteFindings({
  workflow,
  wrapper,
  gradleApp,
  dfxVersion,
}) {
  const findings = [];
  const block = (id, detail) =>
    findings.push({ id, status: "blocked", detail });
  const envPin = (name) =>
    workflow.match(new RegExp(`${name}:\\s*"([^"]+)"`, "u"))?.[1];
  const gradlePin = (name) =>
    gradleApp.match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`, "u"))?.[1];
  if (
    envPin("ANDROID_NDK_VERSION") !== REVIEWED_ANDROID_NDK_VERSION ||
    gradlePin("ndkVersion") !== REVIEWED_ANDROID_NDK_VERSION ||
    !workflow.includes('"ndk;$ANDROID_NDK_VERSION"') ||
    !workflow.includes("NDK_HOME=$ANDROID_HOME/ndk/$ANDROID_NDK_VERSION")
  ) {
    block(
      "reviewed-ndk-selection",
      "CI installation, NDK_HOME and Gradle must agree on the tested NDK26.1.10909125; installed-runner discovery cannot replace that pin.",
    );
  }
  if (
    envPin("ANDROID_BUILD_TOOLS_VERSION") !==
      ANDROID_RELEASE_BUILD_TOOLS_VERSION ||
    gradlePin("buildToolsVersion") !== ANDROID_RELEASE_BUILD_TOOLS_VERSION ||
    !workflow.includes('"build-tools;$ANDROID_BUILD_TOOLS_VERSION"')
  ) {
    block(
      "reviewed-build-tools-selection",
      "CI installation, APK verifier and Gradle must agree on the tested build-tools35.0.0.",
    );
  }
  const url = wrapper
    .match(/^distributionUrl=(.+)\r?$/mu)?.[1]
    .replaceAll("\\:", ":");
  const checksum = wrapper.match(
    /^distributionSha256Sum=([a-f0-9]{64})\r?$/mu,
  )?.[1];
  if (
    url !== REVIEWED_GRADLE_DISTRIBUTION.url ||
    checksum !== REVIEWED_GRADLE_DISTRIBUTION.sha256
  ) {
    block(
      "reviewed-gradle-distribution",
      "Gradle8.14.4 binary distribution URL and SHA-256 must match the official reviewed pair; a different well-formed digest is not sufficient.",
    );
  }
  const dfx = workflow.match(
    /uses:\s*dfinity\/setup-dfx@e50c04f104ee4285ec010f10609483cf41e4d365\s+with:\s+dfx-version:\s*"([^"]+)"/u,
  );
  const verifyDfx = workflow.indexOf("run: dfx --version");
  const build = workflow.indexOf("cargo tauri android build");
  if (
    !dfx ||
    dfx[1] !== dfxVersion ||
    verifyDfx < 0 ||
    build < 0 ||
    dfx.index >= verifyDfx ||
    verifyDfx >= build ||
    /OC_SKIP_PUBLIC_KEY|OC_PUBLIC_KEY_BUILD_SKIP/u.test(workflow)
  ) {
    block(
      "dfx-production-prerequisite",
      "Install the immutable setup-dfx action with dfx.json's exact version and verify it before Android production rollup; do not skip the public-key query.",
    );
  }
  return findings;
}

export function assertIncreasingVersion(
  version,
  versionCode,
  previousVersionCode,
) {
  const next = nativeVersion(version, versionCode);
  // Historical installations can predate the current derived-code formula.
  // Validate the actual distributed code independently, never invent a version
  // name for it or allow it to override the next artifact's derived identity.
  const previous = Number(previousVersionCode);
  if (
    typeof previousVersionCode !== "string" ||
    !/^[1-9]\d*$/u.test(previousVersionCode) ||
    previousVersionCode !== previousVersionCode.trim() ||
    !Number.isSafeInteger(previous) ||
    previous > 2_100_000_000
  ) {
    throw new Error(
      "The last distributed versionCode must be a positive store-compatible integer.",
    );
  }
  if (next.versionCode <= previous) {
    throw new Error(
      "Proposed versionCode must exceed the last distributed versionCode.",
    );
  }
  return { ...next, previousVersionCode: previous };
}

export function artifactIdentity(bytes, expected) {
  if (
    !Number.isSafeInteger(expected?.bytes) ||
    expected.bytes < 1 ||
    !/^[a-f0-9]{64}$/u.test(expected?.sha256 ?? "")
  ) {
    throw new Error(
      "Artifact identity must contain an exact byte count and SHA-256.",
    );
  }
  return (
    bytes.byteLength === expected.bytes && digest(bytes) === expected.sha256
  );
}

export function modelDistributionInventory(
  specs = TRANSFORMERS_WEBGPU_MODEL_SPECS,
) {
  return Object.values(specs).map((spec) => {
    if (!/^[a-f0-9]{40}$/u.test(spec.revision))
      throw new Error("Model revision is not immutable.");
    const allArtifacts = [
      ...spec.artifacts,
      ...(spec.optionalAudio?.artifacts ?? []),
    ];
    const paths = new Set();
    for (const artifact of allArtifacts) {
      if (
        typeof artifact.path !== "string" ||
        !/^[A-Za-z0-9_./-]+$/u.test(artifact.path) ||
        artifact.path.startsWith("/") ||
        artifact.path
          .split("/")
          .some((part) => !part || part === "." || part === "..") ||
        paths.has(artifact.path)
      )
        throw new Error("Model artifact paths must be safe and unique.");
      paths.add(artifact.path);
      artifactIdentity(Buffer.alloc(0), artifact); // Validates identity metadata without downloading any weights.
    }
    if (
      spec.packagedArtifacts.some(
        (path) => !spec.artifacts.some((artifact) => artifact.path === path),
      )
    ) {
      throw new Error(
        "Every packaged graph must belong to the base immutable manifest.",
      );
    }
    const artifacts = spec.artifacts.map((artifact) => ({
      ...artifact,
      delivery: spec.packagedArtifacts.includes(artifact.path)
        ? "packaged-graph"
        : "immutable-download",
    }));
    if (
      artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0) !==
      spec.artifactBytes
    ) {
      throw new Error("Base model artifact byte total is inconsistent.");
    }
    const optionalAudio =
      spec.optionalAudio?.artifacts.map((artifact) => ({
        ...artifact,
        delivery: "optional-immutable-download",
      })) ?? [];
    if (
      optionalAudio.some((artifact) =>
        artifacts.some((base) => base.path === artifact.path),
      ) ||
      optionalAudio.reduce((sum, artifact) => sum + artifact.bytes, 0) !==
        (spec.optionalAudio?.artifactBytes ?? 0)
    ) {
      throw new Error(
        "Optional audio must remain separate and match its declared byte total.",
      );
    }
    return {
      id: spec.id,
      repository: spec.repository,
      revision: spec.revision,
      dtype: spec.dtype,
      baseBytes: spec.artifactBytes,
      optionalAudioBytes: spec.optionalAudio?.artifactBytes ?? 0,
      artifacts,
      optionalAudio,
    };
  });
}

export function sourceFindings({
  workflow,
  wrapper,
  gradleApp,
  productionWebGpuEnabled,
}) {
  const findings = [];
  const block = (id, detail) =>
    findings.push({ id, status: "blocked", detail });
  if (!productionWebGpuEnabled)
    block(
      "production-webgpu-gate",
      "The development flag alone does not enable production/ic. A shipping configuration must deliberately select the immutable production asset contract after distribution and runtime acceptance; an opt-in CI candidate is not shipping approval.",
    );
  const buildFeatures = [
    ...workflow.matchAll(
      /cargo tauri android build[^\r\n]*--features ([^\s]+)/gu,
    ),
  ].map((match) => match[1].split(","));
  if (
    buildFeatures.length !== 2 ||
    buildFeatures.some(
      (features) =>
        !features.includes("transformers-webgpu-android") ||
        features.includes("inference"),
    )
  ) {
    block(
      "shipping-runtime-selection",
      "Both shipping APK variants must explicitly use the reviewed all-WebGPU contract; current native inference features do not prove that runtime.",
    );
  }
  if (
    /sort -V\s*\|\s*tail/u.test(workflow) ||
    !/ndkVersion\s*=\s*"[0-9.]+"/u.test(gradleApp)
  ) {
    block(
      "android-ndk-pin",
      "Select one reviewed NDK revision in both installation and Gradle; choosing the runner's latest installed NDK is not reproducible.",
    );
  }
  if (!/buildToolsVersion\s*=\s*"[0-9.]+"/u.test(gradleApp))
    block(
      "android-build-tools-pin",
      "Pin Android build-tools and use that exact version for aapt/apksigner verification, not the highest installed version.",
    );
  if (!/^distributionSha256Sum=[a-f0-9]{64}\r?$/mu.test(wrapper))
    block(
      "gradle-distribution-digest",
      "Gradle wrapper URL is versioned but has no distribution SHA-256; verify and pin the official distribution digest.",
    );
  return findings;
}

export const REQUIRED_RELEASE_EVIDENCE = Object.freeze([
  {
    id: "hosted-exact-source-checks",
    detail:
      "Run the existing frontend/backend/PR1-security/PR2-security gates for the exact release SHA. android_release_checks.mjs must accept their workflow/job evidence before building and uploading.",
  },
  {
    id: "production-asset-distribution",
    detail:
      "Choose production immutable download origins and APK graph delivery; verify revision, length and SHA-256, CSP/CORS, interrupted downloads, cache reuse and explicit missing/disabled paths. Do not depend on the development /hf-model proxy.",
  },
  {
    id: "runtime-transform-and-licenses",
    detail:
      "Build the exact transformed Qwen decoder and qualified vision graph, lock Transformers/ORT and staged-session patches, inspect packaged worker/ORT bytes, and review model/runtime distribution licenses and notices.",
  },
  {
    id: "backend-app-rollout",
    detail:
      "Verify the versioned app/card/link contract, signing-key activation with independent consumer pins, ActionInbox wiring, legacy queue disposition, rollback limits and fully verified app-authored cards. Keep production app capability flags disabled until accepted.",
  },
  {
    id: "signing-and-account-identity",
    detail:
      "Use existing signing presence and APK certificate checks in CI without exposing key values. Verify the approved certificate/application ID against production asset links, RP ID, existing passkeys and install-over account reuse.",
  },
  {
    id: "version-and-ota-artifact",
    detail:
      "Confirm versionCode against the last actually distributed artifact; inspect both APK native versions, bundled frontend version, production origin and OTA policy, including existing OTA cache behavior.",
  },
  {
    id: "physical-device-acceptance",
    detail:
      "On the exact signed candidate, test Qwen and Gemma text/images repeatedly, switching with cache preservation, cancellation/device retirement, optional voice-message download/inference, and full card verification. Emulator response replay is not physical WebGPU proof.",
  },
]);

export function collectPreflight(options = {}) {
  const workflow = read(".github/workflows/android_release.yaml");
  const wrapper = read(
    "frontend/src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties",
  );
  const gradleApp = read("frontend/src-tauri/gen/android/app/build.gradle.kts");
  const productionWebGpuEnabled = transformersWebGpuFeatureEnabled({
    OC_BUILD_ENV: "production",
    OC_DFX_NETWORK: "ic",
    OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE: "true",
  });
  const findings = sourceFindings({
    workflow,
    wrapper,
    gradleApp,
    productionWebGpuEnabled,
  });
  findings.push(
    ...prerequisiteFindings({
      workflow,
      wrapper,
      gradleApp,
      dfxVersion: JSON.parse(read("dfx.json")).dfx,
    }),
  );
  const block = (id, detail) =>
    findings.push({ id, status: "blocked", detail });
  let proposedVersion;
  try {
    proposedVersion = assertIncreasingVersion(
      options.version,
      options.versionCode,
      options.previousVersionCode,
    );
  } catch (error) {
    block(
      "explicit-version-progression",
      error.message +
        " Supply --version, --version-code and --previous-version-code; these values are not evidence from a distribution service.",
    );
  }
  const today = (options.now ?? new Date()).toISOString().slice(0, 10);
  for (const pr of ["pr1", "pr2"]) {
    const policy = JSON.parse(
      read(`.github/security/openchat-${pr}-security-baseline.json`),
    );
    if (today > policy.expiresOn)
      block(
        `${pr}-security-expired`,
        `Security review expired ${policy.expiresOn}; this preflight cannot extend or waive it.`,
      );
    for (const [path, expected] of Object.entries(
      policy.reviewedDependencyFiles,
    )) {
      const absolute = resolve(root, path);
      if (
        !existsSync(absolute) ||
        reviewedDependencyDigest(readFileSync(absolute), policy, path) !==
          expected
      ) {
        block(
          `${pr}-dependency-drift:${path}`,
          "Reviewed dependency bytes are missing or changed; run the complete existing audit, license and unreviewed-manifest gates.",
        );
      }
    }
  }
  const packageJson = JSON.parse(read("frontend/package.json"));
  const gradleRoot = read("frontend/src-tauri/gen/android/build.gradle.kts");
  const modelInventory = modelDistributionInventory();
  const sourceAssets = [];
  const checkSourceAsset = (path, asset) => {
    const matches =
      existsSync(resolve(root, path)) &&
      artifactIdentity(readFileSync(resolve(root, path)), asset);
    sourceAssets.push({
      path,
      bytes: asset.bytes,
      sha256: asset.sha256,
      matches,
    });
    if (!matches)
      block(
        `source-asset:${path}`,
        "Pinned source asset is absent or differs; restore reviewed bytes, never update its digest to fit arbitrary content.",
      );
  };
  for (const asset of TRANSFORMERS_WEBGPU_RUNTIME_ASSETS.filter(
    (asset) => asset.kind === "pinned",
  )) {
    const fileName = asset.path.split("/").at(-1);
    const path = `frontend/node_modules/onnxruntime-web/dist/${fileName}`;
    checkSourceAsset(path, asset);
  }
  const graphTransform = read(
    "frontend/app/transformersWebGpuDecoderGraph.mjs",
  );
  checkSourceAsset(
    "frontend/app/model-overrides/qwen3vl2b/onnx/decoder_model_merged_q4.onnx",
    {
      bytes: Number(
        graphTransform
          .match(/QWEN3_VL_2B_DECODER_SOURCE_BYTES\s*=\s*([0-9_]+)/u)?.[1]
          .replaceAll("_", ""),
      ),
      sha256: graphTransform.match(
        /QWEN3_VL_2B_DECODER_SOURCE_SHA256\s*=\s*"([a-f0-9]{64})"/u,
      )?.[1],
    },
  );
  const vision = modelInventory
    .flatMap((model) => model.artifacts)
    .find(
      (artifact) =>
        artifact.delivery === "packaged-graph" &&
        artifact.path === "onnx/vision_encoder_q4.onnx",
    );
  checkSourceAsset(
    "frontend/app/model-overrides/qwen3vl2b/onnx/vision_encoder_q4.onnx",
    vision,
  );
  const git = (args) =>
    spawnSync(
      process.platform === "win32" ? "git.exe" : "git",
      ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
      { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
  const attribution = preflightSourceAttribution(
    git(["rev-parse", "HEAD"]),
    git(["status", "--porcelain=v1", "-z", "--untracked-files=normal"]),
  );
  if (
    attribution.gitHeadRevision === null ||
    attribution.worktreeDirty === null
  ) {
    block(
      "source-attribution-unavailable",
      "Git HEAD or working-tree status could not be verified; unknown status must not be described as a clean release checkout.",
    );
  }
  return {
    schemaVersion: 1,
    assessment: "offline-source-preflight",
    releaseReady: false,
    ...attribution,
    requestedRuntime: "all-webgpu",
    productionWebGpuEnabled,
    productionAssetContractAvailable: transformersWebGpuProductionAssetsEnabled(
      {
        OC_BUILD_ENV: "production",
        OC_DFX_NETWORK: "ic",
        OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE: "true",
        OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY:
          TRANSFORMERS_WEBGPU_IMMUTABLE_DELIVERY,
      },
    ),
    proposedVersion,
    findings,
    sourceAssets,
    modelInventory,
    toolchainDeclarations: {
      node: workflow.match(/node-version:\s*"([^"]+)"/u)?.[1] ?? null,
      java: workflow.match(/java-version:\s*"([^"]+)"/u)?.[1] ?? null,
      rust:
        read("rust-toolchain.toml").match(/channel\s*=\s*"([^"]+)"/u)?.[1] ??
        null,
      tauriCli:
        workflow.match(/crate:\s*tauri-cli\s+version:\s*"([^"]+)"/u)?.[1] ??
        null,
      androidGradlePlugin:
        gradleRoot.match(/com\.android\.tools\.build:gradle:([0-9.]+)/u)?.[1] ??
        null,
      kotlinGradlePlugin:
        gradleRoot.match(
          /org\.jetbrains\.kotlin:kotlin-gradle-plugin:([0-9.]+)/u,
        )?.[1] ?? null,
      gradleDistribution:
        wrapper
          .match(/^distributionUrl=(.+)\r?$/mu)?.[1]
          .replaceAll("\\:", ":") ?? null,
      compileSdk: gradleApp.match(/compileSdk\s*=\s*(\d+)/u)?.[1] ?? null,
      targetSdk: gradleApp.match(/targetSdk\s*=\s*(\d+)/u)?.[1] ?? null,
      minSdk: gradleApp.match(/minSdk\s*=\s*(\d+)/u)?.[1] ?? null,
      ndk: gradleApp.match(/ndkVersion\s*=\s*"([^"]+)"/u)?.[1] ?? null,
      buildTools:
        gradleApp.match(/buildToolsVersion\s*=\s*"([^"]+)"/u)?.[1] ?? null,
      dfx: JSON.parse(read("dfx.json")).dfx,
      transformers: packageJson.dependencies["@huggingface/transformers"],
      onnxruntimeWeb: packageJson.dependencies["onnxruntime-web"],
    },
    requiredEvidence: REQUIRED_RELEASE_EVIDENCE,
    notPerformed: [
      "network requests",
      "credential inspection",
      "toolchain installation or execution",
      "build/signing",
      "APK inspection",
      "backend deployment",
      "device tests",
      "security waiver",
    ],
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === "--help") {
      console.log(
        "Usage: node scripts/release_preflight.mjs [--version X.Y.Z --version-code N --previous-version-code N]\nPrints offline JSON inventory. Nonzero exit is intentional while release blockers or external evidence remain. Reads no signing secrets and changes no files.",
      );
    } else {
      const options = {};
      const keys = {
        "--version": "version",
        "--version-code": "versionCode",
        "--previous-version-code": "previousVersionCode",
      };
      for (let index = 0; index < args.length; index += 2) {
        const key = keys[args[index]];
        if (!key || !args[index + 1] || options[key] !== undefined)
          throw new Error(
            "Invalid or repeated preflight argument; use --help.",
          );
        options[key] = args[index + 1];
      }
      console.log(JSON.stringify(collectPreflight(options), null, 2));
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Release preflight could not complete: ${error.message}`);
    process.exitCode = 1;
  }
}
