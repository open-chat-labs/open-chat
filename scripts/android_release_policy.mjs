#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
export const ANDROID_RELEASE_BUILD_TOOLS_VERSION = "35.0.0";
// Official google/bundletool release asset 235114272, uploaded 2025-03-06.
// SHA-256 measured from the official HTTPS download on 2026-09-07; the
// upstream release API's digest is null, not an independently published hash.
export const ANDROID_BUNDLETOOL = Object.freeze({
  version: "1.18.1",
  bytes: 32_505_571,
  sha256: "675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c",
  url: "https://github.com/google/bundletool/releases/download/1.18.1/bundletool-all-1.18.1.jar",
});

export function verifyBundletoolJar(
  jar,
  { readFile = readFileSync, tool = ANDROID_BUNDLETOOL } = {},
) {
  if (typeof jar !== "string" || !jar.trim() || /[\0\r\n]/u.test(jar)) {
    throw new Error(
      "ANDROID_BUNDLETOOL_JAR must explicitly select the pinned standalone JAR.",
    );
  }
  const path = resolve(jar);
  const bytes = readFile(path);
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length !== tool.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== tool.sha256
  ) {
    throw new Error(
      "bundletool size/SHA-256 does not match the pinned official release artifact.",
    );
  }
  return path;
}

export function releaseBuildToolsDirectory(androidHome, version) {
  if (typeof androidHome !== "string" || !androidHome.trim())
    throw new Error("ANDROID_HOME is required for APK verification.");
  if (version !== ANDROID_RELEASE_BUILD_TOOLS_VERSION) {
    throw new Error(
      `ANDROID_BUILD_TOOLS_VERSION must explicitly select the reviewed ${ANDROID_RELEASE_BUILD_TOOLS_VERSION} tools.`,
    );
  }
  return resolve(androidHome, "build-tools", version);
}

export function nativeVersion(version, code) {
  const match = typeof version === "string" && semver.exec(version);
  if (!match || match[0] !== version)
    throw new Error(
      "Android version must be exactly X.Y.Z (no prefix or prerelease).",
    );
  if (!match.slice(1).every((part) => Number.isSafeInteger(Number(part)))) {
    throw new Error("Android semver components must be safe integers.");
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  // Keep the upstream Gradle formula and bounds identical: patch numbers may
  // exceed 999, without colliding with the next minor or major release.
  if (major > 2000 || minor > 99 || patch > 9999) {
    throw new Error(
      "Android version is outside the major 0..2000, minor 0..99, patch 0..9999 formula bounds.",
    );
  }
  const versionCode = major * 1_000_000 + minor * 10_000 + patch;
  if (versionCode < 1) throw new Error("Android versionCode must be positive.");
  // Callers verifying an artifact or historical rollout may supply a code,
  // but cannot override the version-derived identity.
  if (code !== undefined && code !== String(versionCode)) {
    throw new Error(
      "Android versionCode must exactly match the version-derived code.",
    );
  }
  return { version, versionCode };
}

export function releasePolicy({
  eventName,
  tag = "",
  manualVersion = "",
  releaseVersionCode,
  manualVersionCode,
}) {
  if (eventName === "release") {
    // Non-Android checkpoint/website releases must never enter the Android build job.
    if (!tag.endsWith("-android")) return { eligible: false };
    if (!tag.startsWith("v"))
      throw new Error("Android release tags must be vX.Y.Z-android.");
    return {
      eligible: true,
      ...nativeVersion(tag.slice(1, -8), releaseVersionCode),
    };
  }
  if (eventName === "workflow_dispatch") {
    return {
      eligible: true,
      ...nativeVersion(manualVersion, manualVersionCode),
    };
  }
  return { eligible: false };
}

export function tauriVersionConfig(version, code) {
  const parsed = nativeVersion(version, code);
  return {
    version: parsed.version,
    bundle: {
      android: {
        versionCode: parsed.versionCode,
        autoIncrementVersionCode: false,
      },
    },
  };
}

export function signingFingerprint(value) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    !/^(?:[a-fA-F0-9]{64}|(?:[a-fA-F0-9]{2}:){31}[a-fA-F0-9]{2})$/u.test(value)
  ) {
    throw new Error(
      "ANDROID_RELEASE_CERT_SHA256 must pin the approved release certificate.",
    );
  }
  return value.replaceAll(":", "").toLowerCase();
}

export function assertSigningConfigured(environment) {
  for (const name of [
    "OC_ANDROID_KEYSTORE_BASE64",
    "OC_ANDROID_KEYSTORE_PASSWORD",
    "OC_ANDROID_KEY_ALIAS",
    "OC_ANDROID_KEY_PASSWORD",
  ]) {
    if (typeof environment[name] !== "string" || !environment[name].trim()) {
      throw new Error(
        `Required release signing configuration is missing: ${name}`,
      );
    }
  }
  signingFingerprint(environment.ANDROID_RELEASE_CERT_SHA256);
}

export function verifyApkMetadata({
  badging,
  certificates,
  version,
  versionCode,
  certificateSha256,
}) {
  const expected = nativeVersion(version, versionCode);
  const packageLine = badging
    .split(/\r?\n/u)
    .find((line) => line.startsWith("package: "));
  const field = (name) =>
    packageLine?.match(new RegExp(`(?:^| )${name}='([^']*)'`, "u"))?.[1];
  if (
    field("name") !== "com.oclabs.openchat" ||
    field("versionName") !== expected.version ||
    field("versionCode") !== String(expected.versionCode)
  ) {
    throw new Error(
      "Built APK application ID or native version does not match the release policy.",
    );
  }
  const signers = [
    ...certificates.matchAll(
      /^Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]+)\r?$/gmu,
    ),
  ];
  if (
    signers.length !== 1 ||
    signingFingerprint(signers[0][1]) !== signingFingerprint(certificateSha256)
  ) {
    throw new Error(
      "Built APK must have exactly the approved release signing certificate.",
    );
  }
}

export function verifyAabSignature({
  verification,
  certificates,
  certificateSha256,
}) {
  // AABs use JAR signatures, not APK signatures. Missing or unsigned entries
  // fail even if jarsigner also reports that some signed entries verified.
  if (
    !/^jar verified\.$/mu.test(verification) ||
    /unsigned entries|jar is unsigned|CN=Android Debug/iu.test(verification)
  ) {
    throw new Error(
      "Built AAB must have a verified non-debug JAR signature without unsigned entries.",
    );
  }
  const fingerprints = [
    ...certificates.matchAll(/^\s*SHA256:\s*([a-fA-F0-9:]+)\s*$/gmu),
  ];
  if (
    fingerprints.length !== 1 ||
    /CN=Android Debug/iu.test(certificates) ||
    signingFingerprint(fingerprints[0][1]) !==
      signingFingerprint(certificateSha256)
  ) {
    throw new Error(
      "Built AAB must have exactly the approved release signing certificate.",
    );
  }
}

function runAabTool(spawn, name, args) {
  const result = spawn(name, args, {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  if (
    result.error ||
    result.status !== 0 ||
    result.signal ||
    typeof result.stdout !== "string" ||
    typeof result.stderr !== "string"
  ) {
    throw new Error(`AAB verification failed: ${name}`);
  }
  return result;
}

function requireSingleToolValue(output, expected, description) {
  // bundletool uses println. Do not trim: extra lines, a BOM and whitespace
  // must not turn malformed or ambiguous output into an approved identity.
  if (output !== `${expected}\n` && output !== `${expected}\r\n`) {
    throw new Error(
      `Built AAB ${description} does not match the release policy.`,
    );
  }
  return expected;
}

export function verifyAabManifest(aab, environment, dependencies = {}) {
  if (typeof aab !== "string" || !aab.trim() || /[\0\r\n]/u.test(aab)) {
    throw new Error("AAB path is required.");
  }
  const expected = nativeVersion(environment.VERSION, environment.VERSION_CODE);
  const { spawn = spawnSync, tool = ANDROID_BUNDLETOOL } = dependencies;
  // The CLI never accepts a trust pin from the environment. Dependency
  // injection exists only for fixture tests; production always uses the pin.
  const jar = verifyBundletoolJar(
    environment.ANDROID_BUNDLETOOL_JAR,
    dependencies,
  );
  const run = (args) => {
    const result = runAabTool(spawn, "java", ["-jar", jar, ...args]);
    if (result.stderr !== "") {
      throw new Error("AAB manifest reader wrote unexpected diagnostics.");
    }
    return result.stdout;
  };
  requireSingleToolValue(
    run(["version"]),
    tool.version,
    "manifest-reader version",
  );
  const readAttribute = (name, namespace, value) => {
    // The exact predicates run before bundletool's output.trim(). Counting
    // every same-local-name attribute also rejects alternate-namespace
    // lookalikes, even when a correct attribute is present alongside them.
    // This checks the DOM attributes exposed by bundletool, not arbitrary
    // malformed raw protobuf structure (which this tool does not preserve).
    const xpath = `/manifest/@*[local-name()='${name}' and namespace-uri()='${namespace}' and count(../@*[local-name()='${name}'])=1 and .='${value}']`;
    return requireSingleToolValue(
      run([
        "dump",
        "manifest",
        `--bundle=${aab}`,
        "--module=base",
        `--xpath=${xpath}`,
      ]),
      value,
      name,
    );
  };
  const androidNamespace = "http://schemas.android.com/apk/res/android";
  return {
    packageName: readAttribute("package", "", "com.oclabs.openchat"),
    versionName: readAttribute(
      "versionName",
      androidNamespace,
      expected.version,
    ),
    versionCode: readAttribute(
      "versionCode",
      androidNamespace,
      String(expected.versionCode),
    ),
  };
}

export function verifyAab(aab, environment, dependencies = {}) {
  verifyAabManifest(aab, environment, dependencies);
  const { spawn = spawnSync } = dependencies;
  const run = (name, args) => {
    const result = runAabTool(spawn, name, args);
    return result.stdout + result.stderr;
  };
  verifyAabSignature({
    verification: run("jarsigner", [
      "-J-Duser.language=en",
      "-J-Duser.country=US",
      "-verify",
      aab,
    ]),
    certificates: run("keytool", [
      "-J-Duser.language=en",
      "-J-Duser.country=US",
      "-printcert",
      "-jarfile",
      aab,
    ]),
    certificateSha256: environment.ANDROID_RELEASE_CERT_SHA256,
  });
}

function verifyApk(apk, environment) {
  if (!apk || !environment.ANDROID_HOME)
    throw new Error("APK path and ANDROID_HOME are required.");
  const toolDirectory = releaseBuildToolsDirectory(
    environment.ANDROID_HOME,
    environment.ANDROID_BUILD_TOOLS_VERSION,
  );
  if (!existsSync(toolDirectory))
    throw new Error(
      "The reviewed Android build-tools installation is missing; install it before APK verification.",
    );
  const run = (name, args) => {
    const result = spawnSync(resolve(toolDirectory, name), args, {
      encoding: "utf8",
    });
    if (result.error || result.status !== 0)
      throw new Error(`APK verification failed: ${name}`);
    return result.stdout;
  };
  verifyApkMetadata({
    badging: run("aapt", ["dump", "badging", apk]),
    certificates: run("apksigner", ["verify", "--print-certs", apk]),
    version: environment.VERSION,
    versionCode: environment.VERSION_CODE,
    certificateSha256: environment.ANDROID_RELEASE_CERT_SHA256,
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const command = process.argv[2];
    if (command === "plan") {
      const policy = releasePolicy({
        eventName: process.env.GITHUB_EVENT_NAME,
        tag: process.env.ANDROID_RELEASE_TAG,
        manualVersion: process.env.ANDROID_MANUAL_VERSION,
        releaseVersionCode: process.env.ANDROID_RELEASE_VERSION_CODE,
        manualVersionCode: process.env.ANDROID_MANUAL_VERSION_CODE,
      });
      if (!process.env.GITHUB_OUTPUT)
        throw new Error("GITHUB_OUTPUT is required.");
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `eligible=${policy.eligible}\n`,
      );
      if (policy.eligible) {
        appendFileSync(
          process.env.GITHUB_OUTPUT,
          `version=${policy.version}\nversion_code=${policy.versionCode}\ntauri_config=${JSON.stringify(tauriVersionConfig(policy.version, String(policy.versionCode)))}\n`,
        );
      }
      console.log(
        policy.eligible
          ? `Validated Android ${policy.version} (${policy.versionCode}).`
          : "Not an Android release; APK build and upload are skipped.",
      );
    } else if (command === "bundletool-url") {
      console.log(ANDROID_BUNDLETOOL.url);
    } else if (command === "verify-bundletool") {
      verifyBundletoolJar(process.argv[3]);
      console.log(
        "Standalone bundletool size and SHA-256 verified before execution.",
      );
    } else if (command === "signing") {
      assertSigningConfigured(process.env);
      console.log(
        "Required release signing configuration is present; APK identity will be verified before upload.",
      );
    } else if (command === "verify-apk") {
      verifyApk(process.argv[3], process.env);
      console.log(
        "APK native version, application ID, and release signing certificate verified.",
      );
    } else if (command === "verify-aab") {
      verifyAab(process.argv[3], process.env);
      console.log(
        "AAB application ID, native version, JAR signature, and approved release signing certificate verified.",
      );
    } else {
      throw new Error(
        "Usage: android_release_policy.mjs plan|signing|bundletool-url|verify-bundletool|verify-apk|verify-aab <path>",
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
