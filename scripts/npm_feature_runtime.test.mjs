import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { Socket } from "node:net";
import { join } from "node:path";
import test from "node:test";
import {
  assertNpmFeatureRuntimeVersions,
  assertReviewedArborist,
  NPM_FEATURE_RUNTIME,
} from "./npm_feature_runtime.mjs";
import { runFeatureAdvisories } from "./npm_feature_advisories.mjs";
import { runNpmFeatureRuntimeSmoke } from "./npm_feature_runtime_smoke.mjs";

test("one complete reviewed Node/npm/Arborist/semver tuple is required", () => {
  assertNpmFeatureRuntimeVersions({ ...NPM_FEATURE_RUNTIME });
  for (const [field, old] of Object.entries({
    node: "24.14.1",
    npm: "11.11.0",
    arborist: "9.4.0",
    semver: "7.7.4",
  })) {
    assert.throws(() =>
      assertNpmFeatureRuntimeVersions({ ...NPM_FEATURE_RUNTIME, [field]: old }),
    );
    const missing = { ...NPM_FEATURE_RUNTIME };
    delete missing[field];
    assert.throws(() => assertNpmFeatureRuntimeVersions(missing));
  }
  assert.throws(() =>
    assertReviewedArborist({ name: "@npmcli/arborist", version: "9.4.0" }),
  );
  assert.throws(() =>
    assertReviewedArborist({ name: "arborist-lookalike", version: "9.7.0" }),
  );
});

test("actual runner writes sanitized pre-query runtime failure evidence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "npm-runtime-failure-"));
  const repo = join(directory, "repo");
  const npm = join(directory, "npm");
  const arborist = join(npm, "node_modules/@npmcli/arborist");
  mkdirSync(repo);
  mkdirSync(arborist, { recursive: true });
  mkdirSync(join(npm, "node_modules/semver"));
  const save = (file, data) => writeFileSync(file, JSON.stringify(data));
  save(join(npm, "package.json"), { name: "npm", version: "11.16.0" });
  save(join(arborist, "package.json"), {
    name: "@npmcli/arborist",
    version: "9.4.0",
    main: "index.cjs",
  });
  save(join(npm, "node_modules/semver/package.json"), {
    name: "semver",
    version: "7.8.1",
  });
  writeFileSync(
    join(arborist, "index.cjs"),
    'throw new Error("PRIVATE_SOURCE_MUST_NOT_EXECUTE")',
  );
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    throw new Error("PRIVATE_NETWORK_ERROR");
  };
  try {
    await assert.rejects(
      runFeatureAdvisories({
        repositoryRoot: repo,
        variant: "pr2",
        arboristPath: arborist,
        outputDirectory: directory,
        queryBulk: true,
      }),
      /failed at runtime/u,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls, 0);
  const run = readdirSync(directory).find((name) =>
    name.startsWith("npm-feature-advisories-"),
  );
  assert.deepEqual(readdirSync(join(directory, run)), ["failure.json"]);
  const text = readFileSync(join(directory, run, "failure.json"), "utf8");
  assert.doesNotMatch(text, /PRIVATE|node_modules|[A-Z]:|https?:/u);
  assert.deepEqual(JSON.parse(text), {
    version: 1,
    scope: "pr2",
    mode: "bulk-query",
    status: "failed",
    stage: "runtime",
    advisoryRequestAttempted: false,
    advisoryAcceptance: false,
    wholeRepositoryCoverage: false,
  });
  const savedConnect = Socket.prototype.connect;
  const savedFetch = globalThis.fetch;
  await assert.rejects(
    runNpmFeatureRuntimeSmoke({
      repositoryRoot: repo,
      variant: "pr2",
      arboristPath: arborist,
      outputDirectory: directory,
      queryBulk: false,
    }),
    /failed at runtime/u,
  );
  assert.equal(Socket.prototype.connect, savedConnect);
  assert.equal(globalThis.fetch, savedFetch);
  const smoke = readdirSync(directory).find((name) =>
    name.startsWith("npm-feature-advisories-smoke-"),
  );
  const failedSmoke = JSON.parse(
    readFileSync(join(directory, smoke, "failure.json")),
  );
  assert.deepEqual(failedSmoke, {
    version: 1,
    scope: "pr2",
    mode: "offline-runtime-smoke",
    status: "failed",
    stage: "runtime",
    forbiddenCalls: 0,
    advisoryRequestAttempted: false,
    advisoryAcceptance: false,
  });
});

test("real runtime smoke rejects query mode before reading any inputs", async () => {
  await assert.rejects(
    runNpmFeatureRuntimeSmoke({ queryBulk: true }),
    /offline plan mode only/u,
  );
});
