import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  bundleArchiveCommand,
  createBundleArchive,
} from "../frontend/app/rollup-plugin-android-bundle.mjs";

test("archive commands keep paths as literal arguments on both platforms", () => {
  const source = path.resolve("checkout with spaces & symbols", "bundle");
  const target = path.resolve("checkout with spaces & symbols", "app.zip");
  const unix = bundleArchiveCommand(source, target, "linux");
  assert.deepEqual(unix, {
    command: "zip",
    args: ["-q", "-r", target, "."],
    cwd: source,
  });
  const windows = bundleArchiveCommand(source, target, "win32");
  assert.equal(path.basename(windows.command), "tar.exe");
  assert.deepEqual(windows.args, [
    "-a",
    "-c",
    "--options",
    "zip:hdrcharset=UTF-8",
    "-f",
    target,
    "-C",
    source,
    ".",
  ]);
  assert.equal(windows.cwd, source);
});

test("real OTA ZIP preserves nested assets, dotfiles and literal filenames", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "openchat-bundle-test-"));
  try {
    const source = path.join(fixture, "checkout with spaces & symbols");
    const output = path.join(fixture, "unpacked");
    const archive = path.join(fixture, "candidate.zip");
    mkdirSync(path.join(source, ".well-known"), { recursive: true });
    mkdirSync(path.join(source, "assets"));
    mkdirSync(output);
    const files = {
      "index.html":
        '<head><script>window.OC_CONFIG={OC_APP_STORE:"true"}</script></head>',
      ".ic-assets.json5": "[]",
      ".well-known/assetlinks.json": "[]",
      "assets/space & unicode-é-日本語-العربية.js":
        "export const literal = true;",
    };
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(path.join(source, name), content);
    }
    await createBundleArchive(source, archive);
    const zipBytes = readFileSync(archive);
    assert.equal(zipBytes.readUInt32LE(0), 0x04034b50, "must be ZIP, not tar");
    if (process.platform === "win32") {
      // Same-tool extraction can hide a producer/consumer charset mismatch.
      // Android's zip 2.4.2 reader uses bit 11, not Info-ZIP Unicode extra fields.
      const end = zipBytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
      assert.notEqual(end, -1, "ZIP end-of-central-directory record");
      let offset = zipBytes.readUInt32LE(end + 16);
      const count = zipBytes.readUInt16LE(end + 10);
      const names = [];
      for (let entry = 0; entry < count; entry++) {
        assert.equal(zipBytes.readUInt32LE(offset), 0x02014b50);
        const flags = zipBytes.readUInt16LE(offset + 8);
        const nameLength = zipBytes.readUInt16LE(offset + 28);
        const name = zipBytes.subarray(offset + 46, offset + 46 + nameLength);
        if ([...name].some((byte) => byte >= 0x80)) {
          assert.equal(
            flags & 0x800,
            0x800,
            "non-ASCII names must declare UTF-8",
          );
        }
        names.push(name.toString("utf8").replace(/^\.\//, ""));
        offset +=
          46 +
          nameLength +
          zipBytes.readUInt16LE(offset + 30) +
          zipBytes.readUInt16LE(offset + 32);
      }
      for (const name of Object.keys(files))
        assert.ok(names.includes(name), name);
      const { command } = bundleArchiveCommand(source, archive);
      execFileSync(command, ["-x", "-f", archive, "-C", output]);
    } else {
      execFileSync("unzip", ["-q", archive, "-d", output]);
    }
    for (const [name, content] of Object.entries(files)) {
      assert.equal(
        readFileSync(path.join(output, name), "utf8"),
        content,
        name,
      );
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("missing archive source rejects instead of reporting success", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "openchat-bundle-error-"));
  try {
    await assert.rejects(
      createBundleArchive(
        path.join(fixture, "missing"),
        path.join(fixture, "app.zip"),
      ),
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("writeBundle emits both configured OTA ZIPs with the existing asset exclusions", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "openchat-bundle-plugin-"));
  try {
    const source = path.join(fixture, "checkout with spaces & symbols");
    const version = "1.2.3-test";
    const originalHtml =
      "<html><head><title>Bundle fixture</title></head><body>Ready</body></html>";
    const publicBytes = Buffer.from([0, 1, 127, 128, 255]);
    const retained = {
      ".ic-assets.json5": "[]",
      ".well-known/assetlinks.json": "[]",
      "assets/public asset.bin": publicBytes,
      "assets/nested/app & bundle.js": "export const literal = true;",
      "assets/app.css": "body { color: green; }",
    };
    const inputs = {
      "public/index.html": "must be replaced by build/index.html",
      "public/.ic-assets.json5": retained[".ic-assets.json5"],
      "public/.well-known/assetlinks.json":
        retained[".well-known/assetlinks.json"],
      "public/assets/public asset.bin": publicBytes,
      "public/assets/screenshots/remove.jpg": "not used by the app",
      "public/assets/blog/remove.html": "not used by the app",
      "public/out/remove.d.ts": "generated definitions",
      "public/assets/public.js.map": "public source map",
      "build/index.html": originalHtml,
      "build/assets/nested/app & bundle.js":
        retained["assets/nested/app & bundle.js"],
      "build/assets/app.css": retained["assets/app.css"],
      "build/assets/nested/app.js.map": "nested build source map",
      "build/downloads/prior-download.zip":
        "do not recursively bundle downloads",
      "dist_bundle/stale.txt": "must be cleaned before packaging",
    };
    for (const [name, content] of Object.entries(inputs)) {
      const target = path.join(source, name);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
    }

    // Isolate the plugin's relative paths and build environment from this test process.
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "const { androidBundlePlugin } = await import(process.argv[1]); await androidBundlePlugin({ version: process.argv[2] }).writeBundle();",
        new URL(
          "../frontend/app/rollup-plugin-android-bundle.mjs",
          import.meta.url,
        ).href,
        version,
      ],
      { cwd: source, env: { ...process.env, OC_APP_TYPE: "web" } },
    );

    assert.deepEqual(
      readdirSync(path.join(source, "build", "downloads")).sort(),
      [`full-${version}.zip`, "prior-download.zip", `store-${version}.zip`],
    );
    assert.equal(
      readFileSync(path.join(source, "build", "index.html"), "utf8"),
      originalHtml,
    );
    assert.equal(
      existsSync(path.join(source, "dist_bundle")),
      false,
      "staging directory is cleaned",
    );

    for (const [kind, store, ota] of [
      ["store", "true", "patch"],
      ["full", "false", "major"],
    ]) {
      const archive = path.join(
        source,
        "build",
        "downloads",
        `${kind}-${version}.zip`,
      );
      const output = path.join(fixture, `${kind} unpacked`);
      mkdirSync(output);
      assert.equal(readFileSync(archive).readUInt32LE(0), 0x04034b50);
      if (process.platform === "win32") {
        const { command } = bundleArchiveCommand(source, archive);
        execFileSync(command, ["-x", "-f", archive, "-C", output]);
      } else {
        execFileSync("unzip", ["-q", archive, "-d", output]);
      }
      const injection = `<script>window.OC_CONFIG={OC_MOBILE_LAYOUT:"v2", OC_APP_STORE: "${store}", OC_OTA_UPDATES: "${ota}"}</script>`;
      const expected = {
        ...retained,
        "index.html": originalHtml.replace("<head>", `<head>${injection}`),
      };
      for (const [name, content] of Object.entries(expected)) {
        assert.deepEqual(
          readFileSync(path.join(output, name)),
          Buffer.from(content),
          `${kind}: ${name}`,
        );
      }
      const actualFiles = readdirSync(output, {
        recursive: true,
        withFileTypes: true,
      })
        .filter((entry) => entry.isFile())
        .map((entry) =>
          path
            .relative(output, path.join(entry.parentPath, entry.name))
            .split(path.sep)
            .join("/"),
        )
        .sort();
      assert.deepEqual(
        actualFiles,
        Object.keys(expected).sort(),
        `${kind}: no maps, downloads, unused assets or stale files`,
      );
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
