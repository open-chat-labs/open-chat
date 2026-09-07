import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
} from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const manifestPath = fileURLToPath(
  new URL("./android_component_identity_tools.json", import.meta.url),
);
const central = "https://repo.maven.apache.org/maven2/";
const maxArtifactBytes = 60_000_000;

export function artifactUrl(artifact) {
  assert.match(artifact.group, /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/u);
  assert.match(artifact.artifact, /^[a-z][a-z0-9-]*$/u);
  assert.match(artifact.version, /^\d+(?:\.\d+)+$/u);
  return `${central}${artifact.group.replaceAll(".", "/")}/${artifact.artifact}/${artifact.version}/${artifact.artifact}-${artifact.version}.jar`;
}

export function validateManifest(manifest) {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(
    manifest.artifacts.length,
    9,
    "expected the reviewed nine-artifact closure",
  );
  const ids = new Set();
  for (const artifact of manifest.artifacts) {
    artifactUrl(artifact);
    assert.ok(!ids.has(artifact.artifact), "duplicate artifact");
    ids.add(artifact.artifact);
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
    assert.match(artifact.verifiedSha1, /^[a-f0-9]{40}$/u);
    assert.ok(
      Number.isSafeInteger(artifact.bytes) &&
        artifact.bytes > 0 &&
        artifact.bytes <= maxArtifactBytes,
      "invalid artifact size",
    );
  }
  assert.ok(
    manifest.artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0) <=
      65_000_000,
    "oversized tool closure",
  );
  assert.deepEqual(Object.keys(manifest.classpaths).sort(), [
    "compiler",
    "junit",
    "runtime",
  ]);
  const used = new Set();
  for (const names of Object.values(manifest.classpaths)) {
    assert.ok(
      Array.isArray(names) &&
        names.length > 0 &&
        new Set(names).size === names.length,
      "invalid classpath",
    );
    for (const name of names) {
      assert.ok(ids.has(name), "unknown classpath artifact");
      used.add(name);
    }
  }
  assert.deepEqual(used, ids, "unused tool artifact");
  return manifest;
}

async function freshDirectory(directory) {
  assert.ok(isAbsolute(directory), "output directory must be absolute");
  const target = resolve(directory);
  assert.ok(
    !target.includes(delimiter),
    "output directory contains classpath separator",
  );
  // No cache searching or redirected writes through existing symlink/junction ancestors.
  for (let ancestor = dirname(target); ; ancestor = dirname(ancestor)) {
    const stat = await lstat(ancestor);
    assert.ok(
      stat.isDirectory() && !stat.isSymbolicLink(),
      "output ancestry must be real directories",
    );
    assert.equal(
      await realpath(ancestor),
      ancestor,
      "output ancestry is redirected",
    );
    if (dirname(ancestor) === ancestor) break;
  }
  await mkdir(target); // Existing output is an error, including a dangling symlink.
  return target;
}

async function downloadArtifact(artifact, output, fetchImpl, timeoutMs) {
  const url = artifactUrl(artifact);
  const fileName = `${artifact.artifact}-${artifact.version}.jar`;
  const part = join(output, `${fileName}.part`);
  const controller = new AbortController();
  let reader;
  let file;
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`tool download deadline exceeded: ${fileName}`));
    }, timeoutMs);
  });
  const bounded = (operation) => Promise.race([operation, deadline]);
  try {
    const response = await bounded(
      fetchImpl(url, {
        redirect: "error",
        credentials: "omit",
        signal: controller.signal,
      }),
    );
    assert.equal(response.status, 200, `unexpected response for ${fileName}`);
    assert.equal(response.redirected, false, "tool redirect is forbidden");
    assert.equal(response.url, url, "tool response origin/path changed");
    const length = response.headers.get("content-length");
    if (length !== null)
      assert.equal(length, String(artifact.bytes), "unexpected content length");
    assert.ok(response.body, "tool response body missing");
    reader = response.body.getReader();
    file = await open(part, "wx");
    const hash = createHash("sha256");
    let bytes = 0;
    while (true) {
      const { done, value } = await bounded(reader.read());
      if (done) break;
      bytes += value.byteLength;
      assert.ok(bytes <= artifact.bytes, "tool body exceeds pinned size");
      hash.update(value);
      await file.writeFile(value);
    }
    assert.equal(bytes, artifact.bytes, "tool body truncated");
    assert.equal(hash.digest("hex"), artifact.sha256, "tool SHA-256 mismatch");
    await file.close();
    file = undefined;
    await rename(part, join(output, fileName));
    return join(output, fileName);
  } finally {
    clearTimeout(timer);
    controller.abort();
    // Cancellation must not itself hang after a server/body deadline.
    if (reader) void reader.cancel().catch(() => {});
    if (file) await file.close();
  }
}

// Fetch injection is for offline fixture tests only; the CLI has no endpoint,
// mirror, credential, manifest or timeout override. Failed output is never reused.
export async function resolveTools({
  directory,
  manifest,
  fetchImpl = fetch,
  timeoutMs = 60_000,
}) {
  validateManifest(manifest);
  assert.ok(
    Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60_000,
  );
  const output = await freshDirectory(directory);
  const paths = new Map();
  for (const artifact of manifest.artifacts) {
    paths.set(
      artifact.artifact,
      await downloadArtifact(artifact, output, fetchImpl, timeoutMs),
    );
  }
  return Object.fromEntries(
    Object.entries(manifest.classpaths).map(([name, artifacts]) => [
      `${name}Classpath`,
      artifacts.map((id) => paths.get(id)).join(delimiter),
    ]),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    assert.equal(
      process.argv.length,
      4,
      "usage: node android_component_identity_tools.mjs --output-directory ABSOLUTE_FRESH_DIRECTORY",
    );
    assert.equal(process.argv[2], "--output-directory");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const result = await resolveTools({ directory: process.argv[3], manifest });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
