import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertSbomLockIdentity } from "./sbom_lock_identity.mjs";

const registry = "registry+https://github.com/rust-lang/crates.io-index";
const a = "a".repeat(64);
const b = "b".repeat(64);
const entry = (name, version, source, checksum) =>
  `[[package]]\nname = ${JSON.stringify(name)}\nversion = ${JSON.stringify(version)}\n` +
  (source === undefined ? "" : `source = ${JSON.stringify(source)}\n`) +
  (checksum === undefined ? "" : `checksum = ${JSON.stringify(checksum)}\n`);
const lock = (...packages) =>
  Buffer.from(`version = 4\n\n${packages.join("\n")}`);
const root = entry("openchat-pr1-model-sbom", "0.0.0");
const plugin = entry("tauri-plugin-oc", "0.1.0");
const dep = entry("model-runtime", "1.2.3", registry, a);
const source = lock(
  plugin,
  dep,
  entry("unrelated-backend", "1.0.0", registry, b),
);

test("isolated SBOM may prune unrelated packages, preserving version/source/checksum", () => {
  const proof = assertSbomLockIdentity(source, lock(root, plugin, dep));
  assert.equal(proof.externalPackages, 1);
  assert.match(proof.sourceLockSha256, /^[a-f0-9]{64}$/u);
  assert.match(proof.isolatedLockSha256, /^[a-f0-9]{64}$/u);
});

test("lock identity accepts CRLF and Cargo v3 without confusing raw evidence hashes", () => {
  const lf = lock(root, dep);
  const crlf = Buffer.from(lf.toString().replaceAll("\n", "\r\n"));
  const older = Buffer.from(
    source.toString().replace("version = 4", "version = 3"),
  );
  assert.equal(assertSbomLockIdentity(older, crlf).externalPackages, 1);
  assert.notEqual(
    assertSbomLockIdentity(source, lf).isolatedLockSha256,
    assertSbomLockIdentity(source, crlf).isolatedLockSha256,
  );
});

for (const [name, changed] of [
  ["unreviewed version", entry("model-runtime", "1.2.4", registry, a)],
  ["changed checksum", entry("model-runtime", "1.2.3", registry, b)],
  [
    "changed registry",
    entry("model-runtime", "1.2.3", "registry+https://other.invalid", a),
  ],
  ["dependency hidden as a path package", entry("model-runtime", "1.2.3")],
  ["unknown path dependency", entry("unreviewed-local", "1.0.0")],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(
      () => assertSbomLockIdentity(source, lock(root, changed)),
      /differs/u,
    );
  });
}

test("git package identities include the exact revision", () => {
  const git = "git+https://example.invalid/model#" + "1".repeat(40);
  const gitDep = entry("git-runtime", "1.0.0", git);
  const sourceWithGit = lock(dep, gitDep);
  assert.equal(
    assertSbomLockIdentity(sourceWithGit, lock(root, dep, gitDep))
      .externalPackages,
    2,
  );
  assert.throws(
    () =>
      assertSbomLockIdentity(
        sourceWithGit,
        lock(root, dep, entry("git-runtime", "1.0.0", git.replace(/1$/u, "2"))),
      ),
    /differs/u,
  );
});

test("rejects incomplete, malformed and duplicate lock records", () => {
  for (const invalid of [
    Buffer.from(""),
    lock(root),
    lock(dep),
    lock(root, entry("model-runtime", "1.2.3", registry)),
    lock(root, dep, dep),
    lock(
      root,
      dep.replace(
        'name = "model-runtime"',
        'name = "model-runtime"\nname = "other"',
      ),
    ),
    lock(root, dep.replace('version = "1.2.3"', "version = 123")),
    lock(root, dep.replace('version = "1.2.3"', "version = unparseable")),
  ]) {
    assert.throws(() => assertSbomLockIdentity(source, invalid));
  }
});

test("current source Cargo.lock can be validated without resolving dependencies", () => {
  const current = readFileSync(new URL("../Cargo.lock", import.meta.url));
  const withRoot = Buffer.concat([current, Buffer.from("\n" + root)]);
  assert.ok(assertSbomLockIdentity(current, withRoot).externalPackages > 0);
});
