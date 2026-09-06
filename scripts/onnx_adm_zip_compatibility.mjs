#!/usr/bin/env node
// Offline compatibility/security regression for the narrowly scoped ONNX installer override.
// Runs the installed parent's real extraction/copy implementation against an in-memory feed.
import assert from "node:assert/strict";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const frontend = path.resolve(
  process.argv[2] ?? fileURLToPath(new URL("../frontend", import.meta.url)),
);
const requireFrontend = createRequire(path.join(frontend, "package.json"));
const parentJson = requireFrontend.resolve("onnxruntime-node/package.json");
const requireParent = createRequire(parentJson);
assert.equal(
  requireParent(parentJson).version,
  "1.24.3",
  "Review the installer contract before changing its version",
);
assert.equal(
  requireParent("adm-zip/package.json").version,
  "0.6.0",
  "Test the exact overridden dependency",
);
const AdmZip = requireParent("adm-zip");
const { installPackages } = requireParent("./script/install-utils.js");
const fixtureRoot = fs.mkdtempSync(
  path.join(path.resolve(process.argv[3] ?? os.tmpdir()), "openchat-onnx-zip-"),
);
const originalGet = https.get;
const originalTmpdir = os.tmpdir;
const originalRmSync = fs.rmSync;
const originalAlloc = Buffer.alloc;
const inFixture = (target) => {
  const resolved = path.resolve(target);
  assert.ok(
    resolved.startsWith(fixtureRoot + path.sep),
    `Unexpected fixture operation: ${resolved}`,
  );
  return resolved;
};
const binaryA = Buffer.from([0, 1, 2, 127, 128, 254, 255]);
const binaryB = Buffer.from("second native-library fixture");
const zip = new AdmZip();
zip.addFile("runtimes/platform-a/native/runtime.bin", binaryA);
zip.addFile("runtimes/platform-b/native/runtime.bin", binaryB);
zip.addFile("unrequested/unused.bin", Buffer.from("must not be copied"));
let archive = zip.toBuffer();
let requests = 0;
let checks = 0;
const index = "https://dependency-fixture.invalid/v3/index.json";
const base = "https://dependency-fixture.invalid/packages/";
const candidate = {
  name: "Fixture.Native",
  versions: [{ feed: "fixture", version: "1.0.0" }],
};
const feeds = { fixture: { type: "nuget", index } };
const install = (paths) =>
  installPackages(
    [candidate],
    paths.map(([pathInPackage, name]) => ({
      packagesInfo: candidate,
      pathInPackage,
      filepath: inFixture(path.join(fixtureRoot, "output", name)),
    })),
    feeds,
  );

try {
  // No socket is ever opened. Unexpected requests fail closed, including redirects.
  https.get = (url, callback) => {
    requests++;
    let data;
    let contentType = "application/json";
    if (url === index)
      data = JSON.stringify({
        resources: [{ "@type": "PackageBaseAddress/3.0.0", "@id": base }],
      });
    else if (url === `${base}fixture.native/index.json`)
      data = JSON.stringify({ versions: ["1.0.0"] });
    else if (url === `${base}fixture.native/1.0.0/fixture.native.1.0.0.nupkg`) {
      data = archive;
      contentType = "application/zip";
    } else throw new Error(`Unexpected offline fixture request: ${url}`);
    const request = new EventEmitter();
    process.nextTick(() => {
      const response = Readable.from([data]);
      response.statusCode = 200;
      response.headers = { "content-type": contentType };
      callback(response);
    });
    return request;
  };
  os.tmpdir = () => fixtureRoot;
  fs.rmSync = (target, options) => originalRmSync(inFixture(target), options);

  await install([
    ["runtimes/platform-a/native/runtime.bin", "a.bin"],
    ["runtimes/platform-b/native/runtime.bin", "b.bin"],
  ]);
  assert.deepEqual(
    fs.readFileSync(path.join(fixtureRoot, "output/a.bin")),
    binaryA,
  );
  assert.deepEqual(
    fs.readFileSync(path.join(fixtureRoot, "output/b.bin")),
    binaryB,
  );
  assert.deepEqual(fs.readdirSync(path.join(fixtureRoot, "output")).sort(), [
    "a.bin",
    "b.bin",
  ]);
  checks += 3;
  assert.deepEqual(
    fs.readdirSync(fixtureRoot),
    ["output"],
    "Parent cleans extracted ZIP files",
  );
  checks++;
  await assert.rejects(
    install([["missing/runtime.bin", "missing.bin"]]),
    /Failed to find.*in NuGet package/,
  );
  assert.deepEqual(
    fs.readdirSync(fixtureRoot),
    ["output"],
    "Parent cleans after a missing entry",
  );
  checks += 2;
  archive = Buffer.from("not a zip archive");
  await assert.rejects(
    install([["runtimes/platform-a/native/runtime.bin", "a.bin"]]),
    /Failed to open NuGet package/,
  );
  assert.deepEqual(
    fs.readdirSync(fixtureRoot),
    ["output"],
    "Parent cleans malformed archives",
  );
  checks += 2;

  // Regression for CVE-2026-39244. A tiny STORED entry declares 256 MiB.
  // Instrument allocation to prevent the test itself causing memory pressure on a regression.
  const stored = new AdmZip();
  stored.addFile("runtimes/native/stored.bin", binaryA);
  stored.getEntry("runtimes/native/stored.bin").header.method = 0;
  archive = stored.toBuffer();
  const central = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(central >= 0);
  archive.writeUInt32LE(256 * 1024 * 1024, central + 24);
  let largestAllocation = 0;
  Buffer.alloc = (size, ...args) => {
    largestAllocation = Math.max(largestAllocation, size);
    assert.ok(
      size < 8 * 1024 * 1024,
      "Untrusted ZIP size caused an eager allocation",
    );
    return originalAlloc(size, ...args);
  };
  await install([["runtimes/native/stored.bin", "stored.bin"]]);
  assert.deepEqual(
    fs.readFileSync(path.join(fixtureRoot, "output/stored.bin")),
    binaryA,
  );
  assert.ok(largestAllocation < 8 * 1024 * 1024);
  assert.equal(requests, 12);
  checks += 3;
  console.log(
    `ONNX 1.24.3 / adm-zip 0.6.0 compatibility: ${checks} checks passed (offline, real parent installer)`,
  );
} finally {
  https.get = originalGet;
  os.tmpdir = originalTmpdir;
  fs.rmSync = originalRmSync;
  Buffer.alloc = originalAlloc;
  assert.equal(
    path.basename(fixtureRoot).startsWith("openchat-onnx-zip-"),
    true,
  );
  originalRmSync(fixtureRoot, { recursive: true, force: true });
}
