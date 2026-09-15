import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertSigningConfigured,
  nativeVersion,
  releasePolicy,
  signingFingerprint,
  tauriVersionConfig,
  verifyApkMetadata,
  verifyAabSignature,
  verifyAab,
  verifyBundletoolJar,
  ANDROID_BUNDLETOOL,
} from "./android_release_policy.mjs";

const certificate = "ab".repeat(32);
const signing = {
  OC_ANDROID_KEYSTORE_BASE64: "fixture-not-a-key",
  OC_ANDROID_KEYSTORE_PASSWORD: "fixture-placeholder",
  OC_ANDROID_KEY_ALIAS: "fixture-alias",
  OC_ANDROID_KEY_PASSWORD: "fixture-placeholder",
  ANDROID_RELEASE_CERT_SHA256: certificate,
};

for (const tag of [
  "model-integration-checkpoint-2026-09-05",
  "v2.4.6-website",
  "v2.4.6",
  "android",
  "v2.4.6-android-extra",
]) {
  test(`non-Android release is ineligible: ${tag}`, () => {
    assert.deepEqual(releasePolicy({ eventName: "release", tag }), {
      eligible: false,
    });
  });
}

test("only explicit Android stable release tags produce build outputs", () => {
  assert.deepEqual(
    releasePolicy({ eventName: "release", tag: "v2.4.6-android" }),
    {
      eligible: true,
      version: "2.4.6",
      versionCode: 2_040_006,
    },
  );
});

for (const tag of [
  "2.4.6-android",
  "v02.4.6-android",
  "v2.4.6-rc1-android",
  "v2.4.6+meta-android",
  "v2.4.6\nnext=value-android",
]) {
  test(`invalid Android tag fails closed: ${JSON.stringify(tag)}`, () => {
    assert.throws(() =>
      releasePolicy({
        eventName: "release",
        tag,
        releaseVersionCode: "2004006",
      }),
    );
  });
}

test("manual build requires an explicit native-compatible version", () => {
  assert.deepEqual(
    releasePolicy({ eventName: "workflow_dispatch", manualVersion: "2.4.6" }),
    {
      eligible: true,
      version: "2.4.6",
      versionCode: 2_040_006,
    },
  );
  assert.throws(() => releasePolicy({ eventName: "workflow_dispatch" }));
  assert.deepEqual(
    releasePolicy({ eventName: "push", tag: "v2.4.6-android" }),
    { eligible: false },
  );
});

for (const version of [
  "999999999999999999999.0.0",
  "1.2",
  "1.2.3 ",
  "v1.2.3",
  "1.2.3\n",
  "1.2.3\nnext=value",
]) {
  test(`invalid native version is rejected: ${JSON.stringify(version)}`, () => {
    assert.throws(() => nativeVersion(version, "2004006"));
  });
}

test("version codes use upstream's collision-free bounded high-patch formula", () => {
  for (const [version, code] of [
    ["2.0.2051", 2_002_051],
    ["2.1.0", 2_010_000],
    ["3.0.0", 3_000_000],
  ]) {
    assert.deepEqual(
      releasePolicy({ eventName: "release", tag: `v${version}-android` }),
      {
        eligible: true,
        version,
        versionCode: code,
      },
    );
    assert.equal(tauriVersionConfig(version).bundle.android.versionCode, code);
    assert.equal(nativeVersion(version, String(code)).versionCode, code);
    assert.throws(() => nativeVersion(version, "42001"), /match/u);
  }
  assert.equal(nativeVersion("0.0.1").versionCode, 1);
  assert.equal(nativeVersion("2000.99.9999").versionCode, 2_000_999_999);
  assert.ok(
    nativeVersion("2.1.0").versionCode > nativeVersion("2.0.9999").versionCode,
  );
  assert.ok(
    nativeVersion("3.0.0").versionCode > nativeVersion("2.99.9999").versionCode,
  );
  assert.deepEqual(tauriVersionConfig("2.4.6"), {
    version: "2.4.6",
    bundle: {
      android: { versionCode: 2_040_006, autoIncrementVersionCode: false },
    },
  });
});

for (const version of [
  "0.0.0",
  "2001.0.0",
  "2.100.0",
  "2.0.10000",
  "2.-1.0",
  "2.1.+1",
]) {
  test(`invalid derived version boundary fails closed: ${version}`, () => {
    assert.throws(() => nativeVersion(version));
  });
}

for (const code of [
  "",
  "0",
  "-1",
  "1.5",
  "1e6",
  "01",
  "2100000001",
  "999999999999999999999",
  "42001\n",
  "42001",
]) {
  test(`invalid or mismatched explicit code fails closed: ${JSON.stringify(code)}`, () => {
    assert.throws(() => nativeVersion("2.0.2050", code));
    assert.throws(() =>
      releasePolicy({
        eventName: "release",
        tag: "v2.0.2050-android",
        releaseVersionCode: code,
      }),
    );
    assert.throws(() =>
      releasePolicy({
        eventName: "workflow_dispatch",
        manualVersion: "2.0.2050",
        manualVersionCode: code,
      }),
    );
  });
}

test("complete signing configuration is required without exposing values", () => {
  assert.doesNotThrow(() => assertSigningConfigured(signing));
  for (const name of Object.keys(signing)) {
    for (const absent of [undefined, "", " "]) {
      assert.throws(
        () => assertSigningConfigured({ ...signing, [name]: absent }),
        (error) => {
          assert.doesNotMatch(
            error.message,
            /fixture-placeholder|fixture-not-a-key/u,
          );
          return true;
        },
      );
    }
  }
  assert.equal(signingFingerprint("AB:".repeat(31) + "AB"), certificate);
  assert.throws(() => signingFingerprint("not-approved"));
  assert.throws(() => signingFingerprint(certificate + "\n"));
});

const apk = {
  badging:
    "package: name='com.oclabs.openchat' versionCode='2040006' versionName='2.4.6' platformBuildVersionName='36'\n",
  certificates: `Verifies\nSigner #1 certificate SHA-256 digest: ${certificate}\n`,
  version: "2.4.6",
  versionCode: "2040006",
  certificateSha256: certificate,
};

test("artifact must match both native version and approved signing identity", () => {
  assert.doesNotThrow(() => verifyApkMetadata(apk));
  assert.doesNotThrow(() =>
    verifyApkMetadata({
      ...apk,
      certificates: apk.certificates.replaceAll("\n", "\r\n"),
    }),
  );
  for (const [before, after] of [
    ["com.oclabs.openchat", "com.oc.app"],
    ["com.oclabs.openchat", "other.app"],
    ["2040006", "1"],
    ["2.4.6", "0.1.0"],
  ]) {
    assert.throws(() =>
      verifyApkMetadata({
        ...apk,
        badging: apk.badging.replace(before, after),
      }),
    );
  }
  assert.throws(() => verifyApkMetadata({ ...apk, certificates: "" }));
  assert.throws(() =>
    verifyApkMetadata({ ...apk, certificateSha256: "cd".repeat(32) }),
  );
  assert.throws(() =>
    verifyApkMetadata({
      ...apk,
      certificates:
        apk.certificates +
        `Signer #2 certificate SHA-256 digest: ${certificate}\n`,
    }),
  );
});

test("store AAB must be fully JAR-verified with the pinned non-debug certificate", () => {
  const aab = {
    verification:
      "\njar verified.\nWarning: The signer's certificate is self-signed.\n",
    certificates: `Signer #1:\nOwner: CN=Release\nCertificate fingerprints:\n SHA256: ${"AB:".repeat(31)}AB\n`,
    certificateSha256: certificate,
  };
  assert.doesNotThrow(() => verifyAabSignature(aab));
  assert.doesNotThrow(() =>
    verifyAabSignature({
      ...aab,
      certificates: aab.certificates.replaceAll("\n", "\r\n"),
    }),
  );
  for (const verification of [
    "",
    "jar is unsigned.",
    "jar verified.\nThis jar contains unsigned entries.",
    "jar verified.\nCN=Android Debug",
  ]) {
    assert.throws(() => verifyAabSignature({ ...aab, verification }));
  }
  for (const certificates of [
    "",
    aab.certificates.replace("CN=Release", "CN=Android Debug"),
    aab.certificates.replaceAll("AB", "CD"),
    aab.certificates + aab.certificates,
  ]) {
    assert.throws(() => verifyAabSignature({ ...aab, certificates }));
  }
});

// Only injected fixtures use this artificial tool identity. The command-line
// verifier must always use the independently pinned production artifact.
const fixtureJar = Buffer.from("bundletool-test-fixture-not-an-executable");
const fixtureTool = {
  version: "1.18.1",
  bytes: fixtureJar.length,
  sha256: createHash("sha256").update(fixtureJar).digest("hex"),
};
const aabEnvironment = {
  ANDROID_BUNDLETOOL_JAR: "fixture bundletool.jar",
  VERSION: "2.4.6",
  VERSION_CODE: "2040006",
  ANDROID_RELEASE_CERT_SHA256: certificate,
};

function aabFixture(overrides = {}) {
  const calls = [];
  const dependencies = {
    tool: fixtureTool,
    readFile: () => fixtureJar,
    spawn: (name, args, options) => {
      calls.push({ name, args, options });
      const output = (stdout) => ({ status: 0, stdout, stderr: "" });
      if (name === "jarsigner") return output("jar verified.\n");
      if (name === "keytool")
        return output(`Owner: CN=Release\n SHA256: ${certificate}\n`);
      assert.equal(name, "java");
      if (args.at(-1) === "version") return output("1.18.1\n");
      const query = args.find((arg) => arg.startsWith("--xpath="));
      assert.ok(query, "every manifest read must be an explicit XPath query");
      if (query.includes("local-name()='package'"))
        return output("com.oclabs.openchat\n");
      if (query.includes("local-name()='versionName'"))
        return output("2.4.6\n");
      if (query.includes("local-name()='versionCode'"))
        return output("2040006\n");
      assert.fail(`Unexpected manifest query: ${query}`);
    },
    ...overrides,
  };
  return { calls, dependencies };
}

test("AAB verifier checks the pinned tool, actual base metadata, and existing signatures", () => {
  const { calls, dependencies } = aabFixture();
  verifyAab("fixture store.aab", aabEnvironment, dependencies);
  assert.deepEqual(
    calls.map(({ name }) => name),
    ["java", "java", "java", "java", "jarsigner", "keytool"],
  );
  for (const call of calls) {
    assert.equal(call.options.shell, false);
    assert.equal(call.options.timeout, 30_000);
    assert.equal(call.options.maxBuffer, 1024 * 1024);
  }
  for (const { args } of calls.slice(1, 4)) {
    assert.ok(args.includes("--bundle=fixture store.aab"));
    assert.ok(args.includes("--module=base"));
    const query = args.find((arg) => arg.startsWith("--xpath="));
    assert.match(query, /^--xpath=\/manifest\/@\*\[/u);
    assert.match(query, /count\(\.\.\/@\*\[/u);
    assert.match(
      query,
      / and \.='(?:com\.oclabs\.openchat|2\.4\.6|2040006)'\]$/u,
    );
    assert.ok(query.includes("namespace-uri()='"));
    if (!query.includes("local-name()='package'")) {
      assert.ok(
        query.includes(
          "namespace-uri()='http://schemas.android.com/apk/res/android'",
        ),
      );
    } else {
      assert.ok(query.includes("namespace-uri()=''"));
    }
  }
});

test("bundletool bytes are pinned before any Java or signer execution", () => {
  const { calls, dependencies } = aabFixture({
    readFile: () => Buffer.from("tampered artifact"),
  });
  assert.throws(
    () => verifyAab("fixture.aab", aabEnvironment, dependencies),
    /SHA-256/u,
  );
  assert.equal(calls.length, 0);
  assert.throws(() =>
    verifyBundletoolJar("fixture.jar", {
      tool: fixtureTool,
      readFile: () => {
        throw new Error("fixture read denied");
      },
    }),
  );
  const sameSizeTamper = Buffer.from(fixtureJar);
  sameSizeTamper[0] ^= 1;
  assert.throws(
    () =>
      verifyBundletoolJar("fixture.jar", {
        tool: fixtureTool,
        readFile: () => sameSizeTamper,
      }),
    /SHA-256/u,
  );
  // A caller-controlled environment hash must never approve different bytes.
  assert.throws(
    () =>
      verifyAab(
        "fixture.aab",
        {
          ...aabEnvironment,
          ANDROID_BUNDLETOOL_SHA256: createHash("sha256")
            .update("tampered artifact")
            .digest("hex"),
        },
        dependencies,
      ),
    /SHA-256/u,
  );
  assert.notEqual(ANDROID_BUNDLETOOL.sha256, fixtureTool.sha256);
  assert.match(ANDROID_BUNDLETOOL.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(ANDROID_BUNDLETOOL.bytes, 32_505_571);
  assert.ok(Object.isFrozen(ANDROID_BUNDLETOOL));
  assert.equal(ANDROID_BUNDLETOOL.version, "1.18.1");
  assert.equal(
    ANDROID_BUNDLETOOL.url,
    "https://github.com/google/bundletool/releases/download/1.18.1/bundletool-all-1.18.1.jar",
  );
});

for (const malformed of [
  "",
  "\n",
  "wrong\n",
  " expected\n",
  "expected \n",
  "expected\nexpected\n",
  "expected\n\n",
  "expected\r",
  "expected\nwarning\n",
  "\uFEFFexpected\n",
]) {
  test(`AAB rejects wrong/missing/duplicate/whitespace/malformed output: ${JSON.stringify(malformed)}`, () => {
    for (let failedCall = 0; failedCall < 4; failedCall++) {
      const { dependencies } = aabFixture();
      const spawn = dependencies.spawn;
      let javaCalls = 0;
      dependencies.spawn = (name, args, options) => {
        const result = spawn(name, args, options);
        if (name === "java" && javaCalls++ === failedCall) {
          return {
            ...result,
            stdout: malformed.replaceAll("expected", result.stdout.trim()),
          };
        }
        return result;
      };
      assert.throws(() =>
        verifyAab("fixture.aab", aabEnvironment, dependencies),
      );
    }
  });
}

test("AAB accepts only the platform newline, not trimmed artifact values", () => {
  const { dependencies } = aabFixture();
  const spawn = dependencies.spawn;
  dependencies.spawn = (name, args, options) => {
    const result = spawn(name, args, options);
    return { ...result, stdout: result.stdout.replaceAll("\n", "\r\n") };
  };
  assert.doesNotThrow(() =>
    verifyAab("fixture.aab", aabEnvironment, dependencies),
  );
});

test("every manifest/version/signature subprocess failure stops AAB verification", () => {
  for (let failedCall = 0; failedCall < 6; failedCall++) {
    for (const failure of [
      { status: 1 },
      { status: null, signal: "SIGTERM" },
      { status: 0, error: new Error("fixture timeout") },
    ]) {
      const { calls, dependencies } = aabFixture();
      const spawn = dependencies.spawn;
      dependencies.spawn = (name, args, options) => ({
        ...spawn(name, args, options),
        ...(calls.length - 1 === failedCall ? failure : {}),
      });
      assert.throws(() =>
        verifyAab("fixture.aab", aabEnvironment, dependencies),
      );
      assert.equal(calls.length, failedCall + 1);
    }
  }
});

test("manifest-reader diagnostics and malformed subprocess results fail closed", () => {
  for (let failedCall = 0; failedCall < 4; failedCall++) {
    for (const failure of [
      { stderr: "unexpected diagnostic\n" },
      { stdout: null },
      { stderr: null },
    ]) {
      const { calls, dependencies } = aabFixture();
      const spawn = dependencies.spawn;
      dependencies.spawn = (name, args, options) => ({
        ...spawn(name, args, options),
        ...(calls.length - 1 === failedCall ? failure : {}),
      });
      assert.throws(() =>
        verifyAab("fixture.aab", aabEnvironment, dependencies),
      );
      assert.equal(calls.length, failedCall + 1);
    }
  }
});

test("AAB requires explicit tool path and valid policy before executing tools", () => {
  for (const environment of [
    { ...aabEnvironment, ANDROID_BUNDLETOOL_JAR: undefined },
    { ...aabEnvironment, ANDROID_BUNDLETOOL_JAR: " " },
    { ...aabEnvironment, VERSION: "2.4.6' or '1'='1" },
    { ...aabEnvironment, VERSION_CODE: "1" },
  ]) {
    const { calls, dependencies } = aabFixture();
    assert.throws(() => verifyAab("fixture.aab", environment, dependencies));
    assert.equal(calls.length, 0);
  }
});

function assertBundletoolRunnerEnvironment(workflow) {
  const build = workflow.split(/^  build-android:\r?$/mu)[1];
  assert.ok(build, "missing Android build job");
  const header = build.split(/^    steps:\r?$/mu)[0];
  const environment = /^    env:\r?\n((?: {6}[^\r\n]*(?:\r?\n|$))*)/mu.exec(
    header,
  )?.[1];
  assert.ok(environment, "missing Android build job environment");
  // GitHub evaluates job env before a runner exists. These contexts are
  // available in steps, but not jobs.<job_id>.env (GitHub contexts reference).
  for (const [, expression] of environment.matchAll(/\$\{\{([\s\S]*?)\}\}/gu)) {
    assert.doesNotMatch(expression, /\b(?:runner|env|job|steps)\s*(?:\.|\[)/u);
  }
  assert.doesNotMatch(environment, /^\s*ANDROID_BUNDLETOOL_JAR:/mu);

  const download = build
    .split("- name: Download and verify pinned bundletool")[1]
    ?.split(/\r?\n      - /u)[0];
  assert.ok(download, "missing verified bundletool download step");
  const assignment =
    'ANDROID_BUNDLETOOL_JAR="$RUNNER_TEMP/bundletool-all-1.18.1.jar"';
  const persistence =
    'printf \'ANDROID_BUNDLETOOL_JAR=%s\\n\' "$ANDROID_BUNDLETOOL_JAR" >> "$GITHUB_ENV"';
  assert.equal(
    download.split(assignment).length,
    2,
    "assign the runner path once",
  );
  assert.equal(
    download.split(persistence).length,
    2,
    "persist the verified path once",
  );
  assert.ok(download.indexOf(assignment) < download.indexOf("curl --fail"));
  assert.ok(
    download.indexOf("curl --fail") < download.indexOf("verify-bundletool"),
  );
  assert.ok(
    download.indexOf(persistence) > download.indexOf("verify-bundletool"),
  );
}

test("bundletool path is evaluated on the runner and persisted after verification", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/android_release.yaml", import.meta.url),
    "utf8",
  );
  assertBundletoolRunnerEnvironment(workflow);
  // runner is valid in step env; do not ban it throughout the workflow.
  assertBundletoolRunnerEnvironment(
    workflow.replace(
      "      - name: Download and verify pinned bundletool",
      "      - name: Download and verify pinned bundletool\n        env:\n          VERIFIED_TEMP: ${{ runner.temp }}",
    ),
  );
});

test("bundletool environment regressions fail before a workflow is published", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/android_release.yaml", import.meta.url),
    "utf8",
  );
  const assignment =
    '          ANDROID_BUNDLETOOL_JAR="$RUNNER_TEMP/bundletool-all-1.18.1.jar"';
  const persistence =
    '          printf \'ANDROID_BUNDLETOOL_JAR=%s\\n\' "$ANDROID_BUNDLETOOL_JAR" >> "$GITHUB_ENV"';
  const mutants = [
    workflow.replace(
      '      ANDROID_BUILD_TOOLS_VERSION: "35.0.0"',
      '      ANDROID_BUILD_TOOLS_VERSION: "35.0.0"\n      ANDROID_BUNDLETOOL_JAR: ${{ runner.temp }}/bundletool-all-1.18.1.jar',
    ),
    workflow.replace(
      '      ANDROID_BUILD_TOOLS_VERSION: "35.0.0"',
      '      ANDROID_BUILD_TOOLS_VERSION: "35.0.0"\n      BROKEN_RUNNER_PATH: ${{ runner.temp }}',
    ),
    workflow.replace(assignment, ""),
    workflow.replace(persistence, ""),
    workflow
      .replace(persistence, "")
      .replace(assignment, assignment + "\n" + persistence),
  ];
  for (const [index, mutant] of mutants.entries()) {
    assert.notEqual(
      mutant,
      workflow,
      `mutation ${index} must alter the workflow`,
    );
    assert.throws(() => assertBundletoolRunnerEnvironment(mutant));
  }
});

test("workflow gates every build/upload behind the policy and verifies both artifacts", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/android_release.yaml", import.meta.url),
    "utf8",
  );
  assert.match(
    workflow,
    /build-android:\s+needs: release-policy\s+if: needs\.release-policy\.outputs\.eligible == 'true'/u,
  );
  assert.match(
    workflow,
    /node --test scripts\/android_release_policy\.test\.mjs/u,
  );
  assert.match(workflow, /OC_ANDROID_REQUIRE_RELEASE_SIGNING: "true"/u);
  assert.match(
    workflow,
    /node \.\.\/scripts\/android_release_policy\.mjs signing/u,
  );
  assert.doesNotMatch(
    workflow,
    /keytool -genkey|debug\.keystore|manual-build-\$/u,
  );
  assert.equal(
    (workflow.match(/--config "\$ANDROID_TAURI_RELEASE_CONFIG"/gu) ?? [])
      .length,
    2,
  );
  assert.equal(
    (workflow.match(/android_release_policy\.mjs verify-apk/gu) ?? []).length,
    1,
  );
  assert.equal(
    (workflow.match(/android_release_policy\.mjs verify-aab/gu) ?? []).length,
    1,
  );
  const upload = workflow.indexOf("- name: Upload build artifacts");
  assert.ok(
    upload > workflow.indexOf('verify-apk "./openchat_${VERSION}_full.apk"'),
  );
  assert.ok(
    upload > workflow.indexOf('verify-aab "./openchat_${VERSION}_store.aab"'),
  );
  const downloadStart = workflow.indexOf(
    "- name: Download and verify pinned bundletool",
  );
  assert.ok(
    downloadStart > 0 &&
      downloadStart < workflow.indexOf("- name: Build Android AAB (Store)"),
  );
  const download = workflow.slice(downloadStart).split(/\n      - name:/u)[0];
  assert.match(download, /set -euo pipefail/u);
  assert.match(download, /android_release_policy\.mjs bundletool-url/u);
  assert.match(
    download,
    /curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https'/u,
  );
  assert.match(download, /--output "\$ANDROID_BUNDLETOOL_JAR"/u);
  assert.match(
    download,
    /android_release_policy\.mjs verify-bundletool "\$ANDROID_BUNDLETOOL_JAR"/u,
  );
  assert.ok(
    download.indexOf("verify-bundletool") > download.indexOf("curl --fail"),
  );
  assert.doesNotMatch(download, /java|\|\| true|continue-on-error/u);
  assertBundletoolRunnerEnvironment(workflow);
  assert.match(
    workflow,
    /- name: Setup Android SDK\s+uses: android-actions\/setup-android@v3\s+with:\s+packages: platform-tools\s/u,
  );
  assert.match(
    workflow,
    /- name: Upload APK to Release\s+if: github\.event_name == 'release'/u,
  );
  assert.match(
    workflow,
    /android build --verbose --apk --target aarch64 armv7 --features inference --config/u,
  );
  assert.match(
    workflow,
    /android build --verbose --aab --target aarch64 armv7 --features inference,store --config/u,
  );
  assert.match(
    workflow,
    /OC_ANDROID_KEYSTORE_BASE64: \$\{\{ secrets\.ANDROID_UPLOAD_KEYSTORE_BASE64 \}\}/u,
  );
  assert.doesNotMatch(
    workflow,
    /secrets\.ANDROID_KEYSTORE_BASE64|ANDROID_KEY_STORE_FILE|store\.apk|sort -V\s*\|\s*tail/u,
  );
  assert.doesNotMatch(
    workflow.split(/\r?\n[ \t]+release:/u)[0],
    /^\s+version_code:/mu,
  );
  assert.doesNotMatch(
    workflow,
    /^\s+(?:ANDROID_MANUAL_VERSION_CODE|ANDROID_RELEASE_VERSION_CODE):/mu,
  );
  assert.match(
    workflow,
    /OC_ANDROID_VERSION_NAME: \$\{\{ needs\.release-policy\.outputs\.version \}\}/u,
  );
  assert.equal(
    (workflow.match(/- name: Require configured release signing/gu) ?? [])
      .length,
    1,
  );
  assert.equal((workflow.match(/- name: Setup Node\.js/gu) ?? []).length, 1);
  assert.doesNotMatch(
    workflow
      .split("- name: Upload APK to Release")[1]
      .split("- name: Notify Release")[0],
    /\.aab/u,
  );
  assert.doesNotMatch(
    workflow,
    /--features[^\n]*transformers-webgpu-android|OC_TRANSFORMERS_WEBGPU_ENABLED/u,
  );
});

test("Gradle requires configured release signing when CI requests it", () => {
  const gradle = readFileSync(
    new URL(
      "../frontend/src-tauri/gen/android/app/build.gradle.kts",
      import.meta.url,
    ),
    "utf8",
  );
  const guard = gradle.match(
    /require\((\(!requireReleaseSigning && !signingConfigured\) \|\| hasReleaseSigning)\)/u,
  )?.[1];
  assert.ok(guard, "actual Gradle signing predicate must be present");
  const allows = new Function(
    "requireReleaseSigning",
    "signingConfigured",
    "hasReleaseSigning",
    `return ${guard};`,
  );
  for (let mask = 0; mask < 16; mask++) {
    const configured = mask !== 0;
    const complete = mask === 15;
    assert.equal(allows(false, configured, complete), !configured || complete);
    assert.equal(allows(true, configured, complete), complete);
  }
  assert.match(
    gradle,
    /signingConfig = signingConfigs\.findByName\("release"\)\s+\?: signingConfigs\.getByName\("debug"\)/u,
  );
  assert.match(
    gradle,
    /System\.getenv\("OC_ANDROID_REQUIRE_RELEASE_SIGNING"\) == "true"/u,
  );
  assert.match(gradle, /releaseSigningProperties\.values\.any/u);
  assert.match(gradle, /releaseSigningProperties\.values\.all/u);
  assert.match(gradle, /if \(!it\.isFile\) throw GradleException/u);
  for (const name of [
    "OC_ANDROID_KEYSTORE_PATH",
    "OC_ANDROID_KEYSTORE_PASSWORD",
    "OC_ANDROID_KEY_ALIAS",
    "OC_ANDROID_KEY_PASSWORD",
  ]) {
    assert.ok(gradle.includes(`"${name}"`));
  }
  assert.doesNotMatch(gradle, /configuredRelease|debugRelease|"ANDROID_KEY/u);
});

test("Gradle and policy share production identity, version formula and local RP-ID checks", () => {
  const gradle = readFileSync(
    new URL(
      "../frontend/src-tauri/gen/android/app/build.gradle.kts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(gradle, /namespace = "com\.oclabs\.openchat"/u);
  assert.match(gradle, /applicationId = "com\.oclabs\.openchat"/u);
  assert.doesNotMatch(gradle, /com\.oc\.app/u);
  const expression = gradle.match(
    /val code = (major \* [\d_]+ \+ minor \* [\d_]+ \+ patch)/u,
  )?.[1];
  assert.ok(expression, "actual Gradle version formula must be present");
  const derive = new Function(
    "major",
    "minor",
    "patch",
    `return ${expression};`,
  );
  for (const version of [
    "0.0.1",
    "2.0.2051",
    "2.0.9999",
    "2.1.0",
    "2.99.9999",
    "3.0.0",
    "2000.99.9999",
  ]) {
    assert.equal(
      derive(...version.split(".").map(Number)),
      nativeVersion(version).versionCode,
    );
  }
  assert.match(
    gradle,
    /major !in 0\.\.2000 \|\| minor !in 0\.\.99 \|\| patch !in 0\.\.9999/u,
  );
  assert.match(gradle, /require\(code > 0\)/u);
  assert.match(
    gradle,
    /environmentOpenChatRpId == null \|\| bundledOpenChatRpId == null \|\| environmentOpenChatRpId == bundledOpenChatRpId/u,
  );
  assert.match(gradle, /resValue\("string", "openchat_rp_id", openChatRpId\)/u);
  assert.match(
    gradle,
    /https:\/\/\$openChatRpId\/\.well-known\/assetlinks\.json/u,
  );
  for (const value of [
    'ndkVersion = "26.1.10909125"',
    'buildToolsVersion = "35.0.0"',
  ])
    assert.ok(gradle.includes(value));
  assert.doesNotMatch(gradle, /^<{7}|^={7}|^>{7}|tokens truncated/mu);
});
