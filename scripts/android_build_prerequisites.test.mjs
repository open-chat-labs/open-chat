import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const androidScript = readFileSync(
  new URL("frontend/app/build_android.sh", root),
  "utf8",
).replaceAll("\r\n", "\n");
const sourceEnvDefaults = readFileSync(
  new URL("frontend/app/source_env_defaults.sh", root),
  "utf8",
).replaceAll("\r\n", "\n");
const requiredAssets = [
  "index.html",
  "version",
  "ota-policy.json",
  "android-rp-id",
];

function bashExecutable() {
  if (process.env.OC_TEST_BASH) return process.env.OC_TEST_BASH;
  if (process.platform !== "win32") return "bash";
  const executable = path.join(
    process.env.ProgramFiles ?? "C:/Program Files",
    "Git/bin/bash.exe",
  );
  assert.ok(
    existsSync(executable),
    "Git Bash is required on Windows; set OC_TEST_BASH for a non-default installation.",
  );
  return executable;
}

function runBuildFixture(source, rollupExitCode, missingAsset, options = {}) {
  const fixture = mkdtempSync(
    path.join(tmpdir(), "openchat-android-build-test-"),
  );
  const frontend = path.join(fixture, "checkout with spaces & symbols");
  const app = path.join(frontend, "app");
  try {
    mkdirSync(path.join(app, "build"), { recursive: true });
    mkdirSync(path.join(app, "public"));
    writeFileSync(path.join(app, "build_android.sh"), source);
    writeFileSync(path.join(app, "source_env_defaults.sh"), sourceEnvDefaults);
    if (options.defaults === "directory") {
      mkdirSync(path.join(frontend, ".env"));
    } else if (options.defaults !== null) {
      writeFileSync(
        path.join(frontend, ".env"),
        options.defaults ?? "OC_APP_KLIPY_APIKEY=fixture-only\n",
      );
    }
    for (const asset of requiredAssets) {
      if (asset !== missingAsset) {
        writeFileSync(path.join(app, "build", asset), "previous candidate");
      }
    }
    writeFileSync(path.join(app, "public/asset.txt"), "public asset");

    // Functions shadow the commands regardless of PATH: neither npm/Rollup nor
    // a real asset copy can run. Source the actual script, including its setup,
    // with a fixture-only .env and no inherited credentials or BASH_ENV hook.
    const wrapper = `
npx() {
  printf '%s\\n' "$*" > ../rollup-arguments
  printf '%s\\n' rollup >> ../steps
  printf '%s\\n' "$OC_WEBSITE_VERSION" "\${OC_FIXTURE_DEFAULT-unset}" "\${OC_FIXTURE_EMPTY-unset}" > ../effective-defaults
  return "$OC_TEST_ROLLUP_EXIT_CODE"
}
cp() {
  printf '%s\\n' copy >> ../steps
  printf '%s\\n' "$*" > ../copy-arguments
  if [ "$OC_TEST_MISSING_ASSET" != "index.html" ]; then
    printf '%s' overwritten > ./build/index.html
  fi
}
# Windows ACLs and privileged Unix runners do not reliably honor chmod 000.
# Inject only the readability predicate; execute the actual helper and source path.
if [[ "$OC_TEST_DENY_ENV_READ" == 1 ]]; then
  test() {
    if [[ "$1" == -r && "$2" == */.env ]]; then return 1; fi
    builtin test "$@"
  }
fi
source "$1"
`;
    const result = spawnSync(
      bashExecutable(),
      [
        "--noprofile",
        "--norc",
        "-c",
        wrapper,
        "android-build-fixture",
        "./build_android.sh",
      ],
      {
        cwd: app,
        encoding: "utf8",
        timeout: 10_000,
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          TEMP: tmpdir(),
          TMP: tmpdir(),
          OC_APP_STORE: "false",
          OC_TEST_ROLLUP_EXIT_CODE: String(rollupExitCode),
          OC_TEST_MISSING_ASSET: missingAsset ?? "",
          OC_TEST_DENY_ENV_READ: options.denyDefaultsRead ? "1" : "0",
          ...options.environment,
        },
      },
    );
    assert.ifError(result.error);
    if (existsSync(path.join(frontend, "rollup-arguments"))) {
      assert.equal(
        readFileSync(path.join(frontend, "rollup-arguments"), "utf8").trim(),
        "rollup -c",
      );
    }
    return {
      status: result.status,
      stderr: result.stderr,
      steps: existsSync(path.join(frontend, "steps"))
        ? readFileSync(path.join(frontend, "steps"), "utf8")
            .trim()
            .split(/\r?\n/u)
        : [],
      defaults: existsSync(path.join(frontend, "effective-defaults"))
        ? readFileSync(path.join(frontend, "effective-defaults"), "utf8")
        : undefined,
      copied: existsSync(path.join(frontend, "copy-arguments")),
      artifact: existsSync(path.join(app, "build/index.html"))
        ? readFileSync(path.join(app, "build/index.html"), "utf8")
        : undefined,
    };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

test("Android build uses the same reviewed Node pin as model CI", () => {
  const workflow = readFileSync(
    new URL(".github/workflows/android_release.yaml", root),
    "utf8",
  );
  const policy = JSON.parse(
    readFileSync(
      new URL(".github/security/openchat-pr1-security-baseline.json", root),
      "utf8",
    ),
  );
  const versions = [
    ...workflow.matchAll(/node-version:\s*["']([0-9.]+)["']/gu),
  ].map((match) => match[1]);
  // Policy tests run before signing; the build job has its own cached Node setup.
  assert.deepEqual(versions, [
    policy.ciRuntime.nodeVersion,
    policy.ciRuntime.nodeVersion,
  ]);
});

test("failed Rollup aborts the actual Android script without copying over an existing build", () => {
  const result = runBuildFixture(androidScript, 73);
  assert.equal(result.status, 73, result.stderr);
  assert.deepEqual(result.steps, ["rollup"]);
  assert.equal(result.copied, false);
  assert.equal(result.artifact, "previous candidate");
});

test("successful Rollup still permits the normal asset-copy stage", () => {
  const result = runBuildFixture(androidScript, 0);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.steps, ["rollup", "copy"]);
  assert.equal(result.copied, true);
  assert.equal(result.artifact, "overwritten");
});

test("a fresh checkout without optional .env reaches Rollup with caller values intact", () => {
  const result = runBuildFixture(androidScript, 0, undefined, {
    defaults: null,
    environment: { OC_WEBSITE_VERSION: "caller-version" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.steps, ["rollup", "copy"]);
  assert.equal(result.defaults, "caller-version\nunset\nunset\n");
});

test("existing defaults fill absent values but preserve explicit caller values including empty", () => {
  const result = runBuildFixture(androidScript, 0, undefined, {
    defaults:
      "OC_WEBSITE_VERSION=file-version\n" +
      "export OC_FIXTURE_DEFAULT='file value with spaces'\n" +
      "OC_FIXTURE_EMPTY=file-must-not-win\n",
    environment: {
      OC_WEBSITE_VERSION: "caller-version",
      OC_FIXTURE_EMPTY: "",
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.defaults, "caller-version\nfile value with spaces\n\n");
});

for (const [description, options] of [
  ["malformed", { defaults: 'OC_WEBSITE_VERSION="unterminated\n' }],
  ["non-file", { defaults: "directory" }],
  ["unreadable", { denyDefaultsRead: true }],
]) {
  test(`an existing ${description} defaults file fails before Rollup or copying assets`, () => {
    const result = runBuildFixture(androidScript, 0, undefined, options);
    assert.notEqual(result.status, 0, result.stderr);
    assert.deepEqual(result.steps, []);
    assert.equal(result.copied, false);
    assert.equal(result.artifact, "previous candidate");
    assert.match(result.stderr, /\.env/u);
  });
}

test("regression fixture exposes the previous fail-open script behavior", () => {
  assert.match(androidScript, /^set -euo pipefail\n/u);
  const oldScript = androidScript.replace(/^set -euo pipefail\n\n/u, "");
  assert.notEqual(oldScript, androidScript);
  const result = runBuildFixture(oldScript, 73);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.steps, ["rollup", "copy"]);
  assert.equal(result.copied, true);
  assert.equal(result.artifact, "overwritten");
});

for (const missingAsset of requiredAssets) {
  test(`successful Rollup cannot pass the actual script with missing ${missingAsset}`, () => {
    const result = runBuildFixture(androidScript, 0, missingAsset);
    assert.equal(result.status, 1, result.stderr);
    assert.deepEqual(result.steps, ["rollup", "copy"]);
    assert.ok(result.stderr.includes(`missing build/${missingAsset}`));
  });
}
