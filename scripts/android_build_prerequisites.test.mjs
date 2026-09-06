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

function runBuildFixture(source, rollupExitCode) {
  const fixture = mkdtempSync(
    path.join(tmpdir(), "openchat-android-build-test-"),
  );
  const frontend = path.join(fixture, "checkout with spaces & symbols");
  const app = path.join(frontend, "app");
  try {
    mkdirSync(path.join(app, "build"), { recursive: true });
    mkdirSync(path.join(app, "public"));
    writeFileSync(path.join(app, "build_android.sh"), source);
    writeFileSync(
      path.join(frontend, ".env"),
      "OC_APP_KLIPY_APIKEY=fixture-only\n",
    );
    writeFileSync(path.join(app, "build/index.html"), "previous candidate");
    writeFileSync(path.join(app, "public/asset.txt"), "public asset");

    // Functions shadow the commands regardless of PATH: neither npm/Rollup nor
    // a real asset copy can run. Source the actual script, including its setup,
    // with a fixture-only .env and no inherited credentials or BASH_ENV hook.
    const wrapper = `
npx() {
  printf '%s\\n' "$*" > ../rollup-arguments
  printf '%s\\n' rollup >> ../steps
  return "$OC_TEST_ROLLUP_EXIT_CODE"
}
cp() {
  printf '%s\\n' copy >> ../steps
  printf '%s\\n' "$*" > ../copy-arguments
  printf '%s' overwritten > ./build/index.html
}
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
        },
      },
    );
    assert.ifError(result.error);
    assert.equal(
      readFileSync(path.join(frontend, "rollup-arguments"), "utf8").trim(),
      "rollup -c",
    );
    return {
      status: result.status,
      stderr: result.stderr,
      steps: readFileSync(path.join(frontend, "steps"), "utf8")
        .trim()
        .split(/\r?\n/u),
      copied: existsSync(path.join(frontend, "copy-arguments")),
      artifact: readFileSync(path.join(app, "build/index.html"), "utf8"),
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
  assert.deepEqual(versions, [policy.ciRuntime.nodeVersion]);
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

test("regression fixture exposes the previous fail-open script behavior", () => {
  assert.match(androidScript, /^set -e\n/u);
  const oldScript = androidScript.replace(/^set -e\n\n/u, "");
  assert.notEqual(oldScript, androidScript);
  const result = runBuildFixture(oldScript, 73);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.steps, ["rollup", "copy"]);
  assert.equal(result.copied, true);
  assert.equal(result.artifact, "overwritten");
});
