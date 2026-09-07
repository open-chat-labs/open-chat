import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { androidDevArguments, runAndroidDev } from "./android_dev.mjs";

test("normal Android development does not compile telemetry", () => {
  for (const flag of [undefined, "", "0", "false", "TRUE", "true "]) {
    assert.deepEqual(androidDevArguments({ OC_DEVTOOLS: flag }), [
      "android",
      "dev",
      "--no-watch",
    ]);
  }
});

test("the existing debug opt-in explicitly selects the optional Cargo dependency", () => {
  for (const flag of ["1", "true"]) {
    assert.deepEqual(androidDevArguments({ OC_DEVTOOLS: flag }), [
      "android",
      "dev",
      "--no-watch",
      "--features=devtools",
    ]);
  }
});

test("a release-mode launch cannot enable telemetry from the environment alone", () => {
  assert.deepEqual(
    androidDevArguments({ OC_DEVTOOLS: "true" }, ["--release"]),
    ["android", "dev", "--no-watch", "--release"],
  );
});

test("forwarded device, features, configuration, and runner arguments remain intact", () => {
  const forwarded = [
    "device-name",
    "--features",
    "inference",
    "--config",
    '{"build":{}}',
    "--",
    "runner-argument",
  ];
  assert.deepEqual(androidDevArguments({ OC_DEVTOOLS: "1" }, forwarded), [
    "android",
    "dev",
    "--no-watch",
    ...forwarded.slice(0, -2),
    "--features=devtools",
    "--",
    "runner-argument",
  ]);
  assert.deepEqual(androidDevArguments({}, forwarded), [
    "android",
    "dev",
    "--no-watch",
    ...forwarded,
  ]);
});

test("a runner argument named release does not change the Cargo build profile", () => {
  assert.deepEqual(
    androidDevArguments({ OC_DEVTOOLS: "1" }, ["--", "--release"]),
    ["android", "dev", "--no-watch", "--features=devtools", "--", "--release"],
  );
});

test("the npm entry point uses the repository CLI without shell interpolation", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../frontend/package.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.scripts.mobile, "node ../scripts/android_dev.mjs");
  const environment = { OC_DEVTOOLS: "1" };
  const result = runAndroidDev(
    environment,
    ["--help"],
    (command, args, options) => {
      assert.equal(command, process.execPath);
      assert.match(
        args[0].replaceAll("\\", "/"),
        /\/frontend\/node_modules\/@tauri-apps\/cli\/tauri\.js$/u,
      );
      assert.deepEqual(args.slice(1), [
        "android",
        "dev",
        "--no-watch",
        "--help",
        "--features=devtools",
      ]);
      assert.equal(
        options.cwd,
        fileURLToPath(new URL("../frontend/", import.meta.url)),
      );
      assert.equal(options.env, environment);
      assert.equal(options.shell, false);
      assert.equal(options.stdio, "inherit");
      return { status: 0 };
    },
  );
  assert.equal(result.status, 0);
});
