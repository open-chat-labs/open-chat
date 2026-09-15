import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const digest = "0123456789abcdef".repeat(4);
const scripts = [
  {
    name: "upgrade-canister.sh",
    network: "fixture network",
    url: "https://fixture.invalid/a?x=1&y=2",
  },
  {
    name: "upgrade-canister-local.sh",
    network: "local",
    url: "http://127.0.0.1:8080/",
  },
  { name: "upgrade-canister-prod.sh", network: "ic", url: "https://ic0.app/" },
  {
    name: "upgrade-canister-prod-test.sh",
    network: "ic_test",
    url: "https://ic0.app/",
  },
];
const identity = "fixture identity & name";
const canister = "fixture canister";
const version = "1.2.3";

function bashExecutable() {
  if (process.env.OC_TEST_BASH) return process.env.OC_TEST_BASH;
  if (process.platform !== "win32") return "bash";
  const executable = path.join(
    process.env.ProgramFiles ?? "C:/Program Files",
    "Git/bin/bash.exe",
  );
  assert.ok(
    existsSync(executable),
    "Git Bash is required; set OC_TEST_BASH if needed.",
  );
  return executable;
}

function runFixture(script, options = {}) {
  const parent = realpathSync(tmpdir());
  const fixture = mkdtempSync(path.join(parent, "openchat-upgrade-guard-"));
  const checkout = path.join(fixture, "checkout with spaces & symbols");
  const eventsPath = path.join(fixture, "events.tsv");
  const argsPath = path.join(fixture, "arguments.bin");
  try {
    mkdirSync(path.join(checkout, "scripts"), { recursive: true });
    for (const { name } of scripts) {
      const target = path.join(checkout, "scripts", name);
      writeFileSync(
        target,
        readFileSync(new URL(name, import.meta.url), "utf8").replaceAll(
          "\r\n",
          "\n",
        ),
      );
      chmodSync(target, 0o755);
    }
    // These are the only build/download executables in the fixture. They cannot
    // invoke the real build or network paths, even if validation regresses.
    for (const [name, event, exitVariable] of [
      ["generate-wasm.sh", "build", "OC_FIXTURE_BUILD_EXIT"],
      ["download-canister-wasm.sh", "download", "OC_FIXTURE_DOWNLOAD_EXIT"],
    ]) {
      const target = path.join(checkout, "scripts", name);
      writeFileSync(
        target,
        `#!/bin/bash\nrecord ${event} "$@"\nexit "$${exitVariable}"\n`,
      );
      chmodSync(target, 0o755);
    }
    const args = [identity, canister, version, options.source ?? "local"];
    if (script.name === "upgrade-canister.sh")
      args.unshift(script.network, script.url);
    if (!options.omitDigest) args.push(options.digest ?? digest);
    // Git Bash's Windows command-line adapter strips a trailing newline from
    // an argument. NUL-delimited fixture input preserves the exact negative
    // test bytes, including empty arguments, before Bash invokes the script.
    writeFileSync(argsPath, `${args.join("\0")}\0`);
    // Exported functions shadow dfx/Cargo in the actual child Bash scripts.
    // No credentials or BASH_ENV hooks are inherited by this isolated process.
    const wrapper = `
record() {
  printf '%s' "$1" >> "$OC_FIXTURE_EVENTS"
  shift
  printf '\\t%s' "$@" >> "$OC_FIXTURE_EVENTS"
  printf '\\n' >> "$OC_FIXTURE_EVENTS"
}
dfx() {
  record dfx "$@"
  if [[ "\${!#}" == "$OC_FIXTURE_DFX_FAIL_ON" ]]; then return 43; fi
  printf 'fixture-id-%s\\n' "\${!#}"
}
cargo() {
  record cargo "$@"
  return "$OC_FIXTURE_CARGO_EXIT"
}
export -f record dfx cargo
mapfile -d '' -t fixture_args < "$OC_FIXTURE_ARGS"
exec "$1" "\${fixture_args[@]}"
`;
    const result = spawnSync(
      bashExecutable(),
      [
        "--noprofile",
        "--norc",
        "-c",
        wrapper,
        "upgrade-fixture",
        `./scripts/${script.name}`,
      ],
      {
        cwd: checkout,
        encoding: "utf8",
        timeout: 10_000,
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          TEMP: parent,
          TMP: parent,
          OC_FIXTURE_EVENTS: eventsPath,
          OC_FIXTURE_ARGS: argsPath,
          OC_FIXTURE_BUILD_EXIT: String(options.buildExit ?? 0),
          OC_FIXTURE_DOWNLOAD_EXIT: String(options.downloadExit ?? 0),
          OC_FIXTURE_DFX_FAIL_ON: options.dfxFailOn ?? "",
          OC_FIXTURE_CARGO_EXIT: String(options.cargoExit ?? 0),
        },
      },
    );
    assert.ifError(result.error);
    const events = existsSync(eventsPath)
      ? readFileSync(eventsPath, "utf8")
          .trimEnd()
          .split(/\r?\n/u)
          .map((line) => line.split("\t"))
      : [];
    return { status: result.status, stderr: result.stderr, events };
  } finally {
    const relative = path.relative(parent, realpathSync(fixture));
    assert.ok(
      relative.startsWith("openchat-upgrade-guard-") &&
        !relative.includes(path.sep),
    );
    rmSync(fixture, { recursive: true, force: true });
  }
}

function assertForwarded(result, script, expectedDigest) {
  assert.equal(result.status, 0, result.stderr);
  const cargo = result.events.filter(([event]) => event === "cargo");
  assert.equal(cargo.length, 1);
  const args = cargo[0].slice(1);
  assert.deepEqual(args.slice(0, 4), [
    "run",
    "--manifest-path",
    "backend/tools/canister_upgrader/Cargo.toml",
    "--",
  ]);
  for (const [flag, value] of [
    ["--url", script.url],
    ["--controller", identity],
    ["--canister-to-upgrade", canister],
    ["--version", version],
    ["--expected-wasm-sha256", expectedDigest],
  ]) {
    assert.equal(args.filter((arg) => arg === flag).length, 1);
    assert.equal(args[args.indexOf(flag) + 1], value);
  }
  const dfx = result.events.filter(([event]) => event === "dfx");
  assert.equal(dfx.length, 18);
  for (const event of dfx) {
    assert.deepEqual(event.slice(1, 5), [
      "canister",
      "--network",
      script.network,
      "id",
    ]);
    assert.equal(event.length, 6);
  }
  assert.equal(result.events.at(-1)[0], "cargo");
}

test("all upgrade entrypoints reject missing/invalid digests before any action", () => {
  const invalid = [
    "",
    "a".repeat(63),
    "a".repeat(65),
    "g".repeat(64),
    ` ${digest}`,
    `${digest}\n`,
    "Ａ".repeat(64),
  ];
  for (const script of scripts) {
    for (const options of [
      { omitDigest: true },
      ...invalid.map((value) => ({ digest: value })),
    ]) {
      const result = runFixture(script, { ...options, source: "build" });
      assert.equal(
        result.status,
        2,
        `${script.name} ${JSON.stringify(options)}: ${result.stderr}`,
      );
      assert.match(result.stderr, /64 ASCII hexadecimal/i);
      assert.deepEqual(result.events, [], script.name);
    }
  }
});

test("all entrypoints preserve caller digest, network, URL and quoted arguments", () => {
  for (const script of scripts) {
    for (const value of [digest, digest.toUpperCase()]) {
      const result = runFixture(script, { digest: value });
      assertForwarded(result, script, value);
      assert.ok(
        result.events.every(
          ([event]) => event !== "build" && event !== "download",
        ),
      );
    }
  }
});

test("empty/build source retains local build selection and forwards the trusted digest", () => {
  for (const source of ["", "build"]) {
    const result = runFixture(scripts[0], { source });
    assertForwarded(result, scripts[0], digest);
    assert.deepEqual(result.events[0], ["build", canister]);
    assert.equal(
      result.events.filter(([event]) => event === "build").length,
      1,
    );
    assert.ok(result.events.every(([event]) => event !== "download"));
  }
});

test("download selection preserves the exact source argument and caller digest", () => {
  const result = runFixture(scripts[2], {
    source: "release fixture & revision",
  });
  assertForwarded(result, scripts[2], digest);
  assert.deepEqual(result.events[0], [
    "download",
    canister,
    "release fixture & revision",
  ]);
  assert.ok(result.events.every(([event]) => event !== "build"));
});

test("build and download failures stop before dfx/Cargo and preserve failure status", () => {
  for (const script of scripts) {
    const build = runFixture(script, { source: "build", buildExit: 41 });
    assert.equal(build.status, 41, build.stderr);
    assert.deepEqual(build.events, [["build", canister]]);
    const download = runFixture(script, { source: "latest", downloadExit: 42 });
    assert.equal(download.status, 42, download.stderr);
    assert.deepEqual(download.events, [["download", canister, "latest"]]);
  }
});

test("dfx failure stops before Cargo and is propagated through every wrapper", () => {
  for (const script of scripts) {
    const result = runFixture(script, { dfxFailOn: "openchat_installer" });
    assert.equal(result.status, 43, result.stderr);
    assert.deepEqual(result.events, [
      [
        "dfx",
        "canister",
        "--network",
        script.network,
        "id",
        "openchat_installer",
      ],
    ]);
  }
});

test("Cargo failure is propagated through every wrapper", () => {
  for (const script of scripts) {
    const result = runFixture(script, { cargoExit: 44 });
    assert.equal(result.status, 44, result.stderr);
    assert.equal(result.events.at(-1)[0], "cargo");
    assert.equal(result.events.at(-1).at(-1), digest);
  }
});
