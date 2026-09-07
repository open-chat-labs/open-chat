import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  dependencyDigest,
  RAW_DEPENDENCY_DIGEST,
  reviewedDependencyDigest,
  TEXT_DEPENDENCY_DIGEST,
} from "./security_dependency_hash.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bytes = (text) => Buffer.from(text, "utf8");
const textHash = (text) =>
  dependencyDigest(bytes(text), TEXT_DEPENDENCY_DIGEST);

test("UTF-8 LF, CRLF, and mixed checkouts have the same reviewed text digest", () => {
  const lf = '[dependencies]\nexample = "1.2.3"\n# عربي\n';
  assert.equal(textHash(lf), textHash(lf.replaceAll("\n", "\r\n")));
  assert.equal(textHash(lf), textHash(lf.replace("\n", "\r\n")));
});

test("dependency version and source edits still fail the digest", () => {
  const source = 'example = { version = "1.2.3", registry = "reviewed" }\n';
  for (const changed of [
    source.replace("1.2.3", "1.2.4"),
    source.replace("reviewed", "unreviewed"),
    source + 'other = "1"\n',
  ]) {
    assert.notEqual(textHash(source), textHash(changed));
    assert.notEqual(
      textHash(source),
      textHash(changed.replaceAll("\n", "\r\n")),
    );
  }
});

test("canonicalization does not trim or rewrite any other content", () => {
  const original = '{"version":"1"}\n';
  for (const changed of [
    original.trimEnd(),
    original + "\n",
    " " + original,
    "\uFEFF" + original,
    original.replace("\n", "\r"),
  ]) {
    assert.notEqual(textHash(original), textHash(changed));
  }
  assert.notEqual(textHash("\u00e9\n"), textHash("e\u0301\n"));
});

test("invalid UTF-8 and unknown digest formats fail closed", () => {
  assert.throws(() =>
    dependencyDigest(Buffer.from([0xc3, 0x28]), TEXT_DEPENDENCY_DIGEST),
  );
  assert.throws(
    () => dependencyDigest(bytes("x"), "sha256-unknown"),
    /Unsupported/,
  );
});

test("legacy policies remain byte-exact and are never silently normalized", () => {
  const lf = bytes("name = 'example'\n");
  const crlf = bytes("name = 'example'\r\n");
  assert.equal(
    reviewedDependencyDigest(lf, {}, "Cargo.toml"),
    dependencyDigest(lf, RAW_DEPENDENCY_DIGEST),
  );
  assert.notEqual(
    reviewedDependencyDigest(lf, {}, "Cargo.toml"),
    reviewedDependencyDigest(crlf, {}, "Cargo.toml"),
  );
});

test("an unproven legacy record retains its byte-exact digest explicitly", () => {
  const policy = {
    reviewedDependencyDigestFormat: TEXT_DEPENDENCY_DIGEST,
    dependencyDigestMigration: { legacyRawFiles: ["Cargo.toml"] },
  };
  const lf = bytes("name = 'example'\n");
  const crlf = bytes("name = 'example'\r\n");
  assert.notEqual(
    reviewedDependencyDigest(lf, policy, "Cargo.toml"),
    reviewedDependencyDigest(crlf, policy, "Cargo.toml"),
  );
  assert.equal(
    reviewedDependencyDigest(lf, policy, "Cargo.lock"),
    reviewedDependencyDigest(crlf, policy, "Cargo.lock"),
  );
});

function historicalBytes(commit, path) {
  const result = spawnSync(
    process.platform === "win32" ? "git.exe" : "git",
    [
      "-c",
      `safe.directory=${root.replaceAll("\\", "/")}`,
      "show",
      `${commit}:${path}`,
    ],
    { cwd: root, maxBuffer: 64 * 1024 * 1024 },
  );
  assert.equal(
    result.status,
    0,
    `Historical digest proof requires commit ${commit}: ${result.stderr}`,
  );
  return result.stdout;
}

function originalCheckoutBytes(source, path, migration) {
  const lf = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
    .decode(source)
    .replaceAll("\r\n", "\n");
  if (migration.sourceLfFiles.includes(path)) return bytes(lf);
  assert.equal(migration.sourceDefaultLineEndings, "crlf");
  const ranges = migration.sourceMixedLfLineRanges[path] ?? [];
  const lines = lf.split("\n");
  for (const [first, last] of ranges) {
    assert.ok(
      Number.isInteger(first) &&
        Number.isInteger(last) &&
        first > 0 &&
        first <= last &&
        last < lines.length,
    );
  }
  return bytes(
    lines
      .map((line, index) => {
        if (index === lines.length - 1) return line;
        const wasLf = ranges.some(
          ([first, last]) => index + 1 >= first && index + 1 <= last,
        );
        return line + (wasLf ? "\n" : "\r\n");
      })
      .join(""),
  );
}

// The historical proof runs in the PR1 security job with fetch-depth: 0.
// PR2 owns its own policy migration and is not a prerequisite for this model PR.
for (const pr of ["pr1"]) {
  const policyPath = `.github/security/openchat-${pr}-security-baseline.json`;
  const policy = JSON.parse(readFileSync(resolve(root, policyPath), "utf8"));
  const migration = policy.dependencyDigestMigration;
  const original = JSON.parse(
    historicalBytes(migration.sourceCommit, policyPath),
  );

  test(`${pr}: migration preserves reviewed fields except the explicit Node-job count repair`, () => {
    const {
      reviewedDependencyFiles,
      reviewedDependencyDigestFormat,
      dependencyDigestMigration,
      ...unchanged
    } = policy;
    const { reviewedDependencyFiles: originalFiles, ...originalUnchanged } =
      original;
    if (pr === "pr1") {
      // The independently covered Android component job adds one Node setup.
      // Preserve the historical comparison for every other field, not a broad
      // ciRuntime exception or an advisory/dependency baseline refresh.
      assert.equal(originalUnchanged.ciRuntime.setupNodeOccurrences, 2);
      assert.equal(unchanged.ciRuntime.setupNodeOccurrences, 3);
      unchanged.ciRuntime = { ...unchanged.ciRuntime, setupNodeOccurrences: 2 };
    }
    assert.deepEqual(unchanged, originalUnchanged);
    assert.deepEqual(
      Object.keys(reviewedDependencyFiles),
      Object.keys(originalFiles),
    );
    assert.equal(reviewedDependencyDigestFormat, TEXT_DEPENDENCY_DIGEST);
    for (const path of [
      ...dependencyDigestMigration.sourceLfFiles,
      ...Object.keys(dependencyDigestMigration.sourceMixedLfLineRanges),
      ...dependencyDigestMigration.legacyRawFiles,
    ]) {
      assert.ok(
        Object.hasOwn(reviewedDependencyFiles, path),
        `Unknown migration path: ${path}`,
      );
    }
  });

  for (const [path, expected] of Object.entries(
    policy.reviewedDependencyFiles,
  )) {
    test(`${pr}: historical-byte proof for ${path}`, () => {
      if (migration.legacyRawFiles.includes(path)) {
        assert.equal(
          expected,
          original.reviewedDependencyFiles[path],
          "Unproven records must not be updated",
        );
        return;
      }
      const historical = historicalBytes(migration.sourceCommit, path);
      const originalCheckout = originalCheckoutBytes(
        historical,
        path,
        migration,
      );
      assert.equal(
        dependencyDigest(originalCheckout),
        original.reviewedDependencyFiles[path],
        "Reconstructed historical bytes must reproduce the original reviewed SHA-256",
      );
      assert.equal(
        reviewedDependencyDigest(originalCheckout, policy, path),
        expected,
      );
      assert.equal(
        reviewedDependencyDigest(historical, policy, path),
        expected,
      );
      assert.notEqual(
        reviewedDependencyDigest(
          Buffer.concat([historical, bytes("# unreviewed dependency edit\n")]),
          policy,
          path,
        ),
        expected,
      );
    });
  }
}
