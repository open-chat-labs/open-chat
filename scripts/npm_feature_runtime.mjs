import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// One reviewed tuple, not ranges and not whatever the current npm happens to bundle.
export const NPM_FEATURE_RUNTIME = Object.freeze({
  node: "24.18.1",
  npm: "11.16.0",
  arborist: "9.7.0",
  semver: "7.8.1",
});

// Bounded semantic review of the official Node 24.18.1 / npm 11.16.0 sources.
// See npm_feature_runtime.review.md. This is not a hash inventory of all npm code.
export const NPM_FEATURE_ARBORIST_SOURCES = Object.freeze({
  "lib/arborist/load-virtual.js":
    "5acd380ec9f592db8f5418319facdd4e61de8d621cbeacd63e5f3edecdbe4c45",
  "lib/node.js":
    "50ba0586f3ffe89f3bc1214be213e2c3eba189b617e1e1b3bb25dd87aa43e991",
  "lib/edge.js":
    "a547398f1ac1dc19a57bc6bc3f4477baf7b2af34337518e15223aa7f35e34e81",
  "lib/link.js":
    "eac85a33fd0e653c7b7d39d4542b77d8aa134d2ede1145b8d2945c3f09defc9f",
  "lib/override-set.js":
    "ad1f5a508110fada532a9d8d262fa568d1ab041199f33850f565075897237991",
  "lib/shrinkwrap.js":
    "0b9065e9b37131f8ccbdccfb1a62bea28987f781adc6dfb763d25cdfe8732479",
  "lib/dep-valid.js":
    "b6328406231815d130e55c55b2e177f92e46ca5c104d2bcb7adaf4b23606da68",
});
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function assertReviewedArborist(pkg) {
  assert(
    pkg?.name === "@npmcli/arborist" &&
      pkg.version === NPM_FEATURE_RUNTIME.arborist,
    "expected reviewed Arborist 9.7.0",
  );
}

export function assertNpmFeatureRuntimeVersions(actual) {
  assert.deepEqual(
    actual,
    NPM_FEATURE_RUNTIME,
    "reviewed npm toolchain required",
  );
}

/** Read metadata and source pins before importing any collector runtime code. */
export function loadNpmFeatureRuntime(arboristPath) {
  const arboristRoot = realpathSync(arboristPath);
  const npmRoot = realpathSync(resolve(arboristRoot, "../../.."));
  assert.equal(
    realpathSync(resolve(npmRoot, "node_modules/@npmcli/arborist")),
    arboristRoot,
    "reviewed bundled Arborist layout required",
  );
  const require = createRequire(resolve(arboristRoot, "package.json"));
  const captured = new Map();
  const read = (file) => {
    const bytes = readFileSync(file);
    captured.set(file, bytes);
    return bytes;
  };
  const npm = JSON.parse(read(resolve(npmRoot, "package.json")));
  const arborist = JSON.parse(read(resolve(arboristRoot, "package.json")));
  const semverPath = realpathSync(require.resolve("semver/package.json"));
  assert.equal(
    semverPath,
    realpathSync(resolve(npmRoot, "node_modules/semver/package.json")),
    "semver must resolve from the reviewed npm bundle",
  );
  const semver = JSON.parse(read(semverPath));
  assert.equal(npm.name, "npm");
  assert.equal(semver.name, "semver");
  assertReviewedArborist(arborist);
  const versions = {
    node: process.versions.node,
    npm: npm.version,
    arborist: arborist.version,
    semver: semver.version,
  };
  assertNpmFeatureRuntimeVersions(versions);
  for (const [file, expected] of Object.entries(NPM_FEATURE_ARBORIST_SOURCES)) {
    const source = read(resolve(arboristRoot, file)).toString("utf8");
    assert.equal(
      sha256(source.replaceAll("\r\n", "\n")),
      expected,
      "reviewed Arborist semantic source differs",
    );
  }
  const verifyUnchanged = () => {
    for (const [file, bytes] of captured) {
      assert(
        readFileSync(file).equals(bytes),
        "npm runtime changed during collection",
      );
    }
  };
  return {
    semver: require("semver"),
    evidence: {
      ...versions,
      reviewedArboristSourceLfSha256: NPM_FEATURE_ARBORIST_SOURCES,
      wholeRuntimeSourceCoverage: false,
    },
    verifyUnchanged,
  };
}
