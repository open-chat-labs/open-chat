import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { securityModes } from "./security_mode_scope.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policies = existsSync(
  resolve(root, ".github/workflows/openchat_pr2_security.yaml"),
)
  ? ["pr1", "pr2"]
  : ["pr1"];
const disabled =
  /Unscoped audit\/inventory disabled; scoped replacement required/u;

test("every expected policy retains its actual CLI entry point", () => {
  for (const policy of policies) {
    assert.ok(
      existsSync(
        resolve(root, "scripts", `check_openchat_${policy}_security.mjs`),
      ),
      `Missing required ${policy} security CLI`,
    );
  }
});

for (const policy of ["pr1", "pr2"]) {
  test(`${policy}: explicit offline modes remain selectable`, () => {
    const allowed =
      policy === "pr1" ? ["ci", "licenses", "format"] : ["ci", "licenses"];
    for (const mode of allowed) {
      assert.deepEqual([...securityModes([mode], policy)], [mode]);
    }
    assert.deepEqual([...securityModes([...allowed, "ci"], policy)], allowed);
  });

  test(`${policy}: defaults, broad modes and mixed selections fail closed`, () => {
    for (const args of [
      [],
      ["npm"],
      ["rust"],
      ["sbom"],
      ["ci", "npm"],
      ["licenses", "rust"],
      ["sbom", "ci"],
    ]) {
      assert.throws(() => securityModes(args, policy), disabled);
    }
  });

  test(`${policy}: typos, flags and empty/whitespace modes are rejected`, () => {
    for (const mode of [
      "nmp",
      "NPM",
      "--help",
      "--allow-unscoped",
      "",
      " ci",
      "npm ",
    ]) {
      assert.throws(
        () => securityModes(["ci", mode], policy),
        /Unknown or unsupported/u,
      );
    }
    if (policy === "pr2") {
      assert.throws(
        () => securityModes(["format"], policy),
        /Unknown or unsupported/u,
      );
    }
  });
}

test("an unknown policy cannot gain an implicit allowed-mode set", () => {
  assert.throws(() => securityModes(["ci"], "pr3"), /Unknown security policy/u);
});

// The preload fails the child immediately if a blocked CLI reaches policy reads,
// any subprocess API or network APIs. Positive controls prove the tripwires run.
// License controls fake read-only Git output and stop at Cargo invocation instead
// of executing Git/Cargo or consuming their real output.
function preload(licenseProbe = false, policy = "pr1") {
  const source = `
    import child from "node:child_process";
    import fs from "node:fs";
    import http from "node:http";
    import https from "node:https";
    import net from "node:net";
    import tls from "node:tls";
    import dns from "node:dns";
    import { basename } from "node:path";
    import { syncBuiltinESMExports } from "node:module";
    const trip = (operation) => {
      process.stderr.write("SCOPE_TRIPWIRE:" + operation + "\\n");
      process.exit(86);
    };
    for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {
      child[name] = () => trip("subprocess:" + name);
    }
    for (const module of [http, https]) {
      for (const name of ["request", "get"]) module[name] = () => trip("network:" + name);
    }
    for (const name of ["connect", "createConnection"]) net[name] = () => trip("network:" + name);
    tls.connect = () => trip("network:tls");
    for (const name of ["lookup", "resolve", "resolve4", "resolve6"]) {
      dns[name] = () => trip("network:dns");
      dns.promises[name] = () => trip("network:dns");
    }
    globalThis.fetch = () => trip("network:fetch");
    globalThis.WebSocket = class { constructor() { trip("network:WebSocket"); } };
    const read = fs.readFileSync;
    fs.readFileSync = function(path, ...args) {
      if (!${licenseProbe} && /openchat-pr[12]-security-baseline\\.json$/u.test(String(path))) {
        trip("baseline");
      }
      return read.call(this, path, ...args);
    };
    if (${licenseProbe}) {
      child.spawnSync = (command, args) => {
        const name = basename(command).toLowerCase();
        if (["git", "git.exe"].includes(name) && (args.includes("diff") || args.includes("ls-files"))) {
          return { status: 0, stdout: "", stderr: "" };
        }
        const expected = ${JSON.stringify(
          policy === "pr1"
            ? [
                "metadata",
                "--locked",
                "--offline",
                "--format-version",
                "1",
                "--features",
                "inference",
              ]
            : ["metadata", "--locked", "--offline", "--format-version", "1"],
        )};
        if (["cargo", "cargo.exe"].includes(name) && JSON.stringify(args) === JSON.stringify(expected)) {
          process.stderr.write("SCOPE_OFFLINE_LICENSE_METADATA\\n");
          process.exit(87);
        }
        trip("unexpected-license-subprocess");
      };
    }
    syncBuiltinESMExports();
    process.stderr.write("SCOPE_PRELOAD_READY\\n");
  `;
  return (
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
}

function run(args, hook = preload()) {
  return spawnSync(process.execPath, ["--import", hook, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      NODE_OPTIONS: "",
      // Existing tool/output variables must not make a blocked mode reachable.
      CARGO_AUDIT_BIN: "must-not-run-audit",
      CARGO_CYCLONEDX_BIN: "must-not-run-inventory",
      SBOM_OUTPUT: "must-not-write.json",
    },
  });
}

function assertStarted(result) {
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.match(result.stderr, /SCOPE_PRELOAD_READY/u);
}

for (const [label, expression] of [
  [
    "baseline",
    'await import("node:fs").then(fs => fs.readFileSync("openchat-pr1-security-baseline.json"))',
  ],
  [
    "subprocess",
    'await import("node:child_process").then(child => child.spawnSync("must-not-run", []))',
  ],
  [
    "https",
    'await import("node:https").then(https => https.get("https://example.invalid"))',
  ],
  ["fetch", 'await fetch("https://example.invalid")'],
]) {
  test(`CLI tripwire control catches ${label}`, () => {
    const result = run(["--input-type=module", "-e", expression]);
    assertStarted(result);
    assert.equal(result.status, 86, result.stderr);
    assert.match(result.stderr, /SCOPE_TRIPWIRE:/u);
  });
}

for (const policy of policies) {
  const cli = resolve(root, "scripts", `check_openchat_${policy}_security.mjs`);

  for (const args of [
    [],
    ["npm"],
    ["rust"],
    ["sbom"],
    ["ci", "npm"],
    ["licenses", "rust"],
    ["ci", "licenses", "sbom"],
  ]) {
    test(`${policy} CLI rejects ${JSON.stringify(args)} before reads/commands/network`, () => {
      const result = run([cli, ...args]);
      assertStarted(result);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, disabled);
      assert.doesNotMatch(
        result.stderr,
        /SCOPE_TRIPWIRE:|SCOPE_OFFLINE_LICENSE_METADATA/u,
      );
      assert.doesNotMatch(result.stdout, /security policy passed/iu);
    });
  }

  test(`${policy} CLI rejects typo and bypass-like flag before side effects`, () => {
    for (const args of [["ci", "nmp"], ["--allow-unscoped"], [""]]) {
      const result = run([cli, ...args]);
      assertStarted(result);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /Unknown or unsupported security mode/u);
      assert.doesNotMatch(result.stderr, /SCOPE_TRIPWIRE:/u);
    }
  });

  test(`${policy} CLI ci and mixed ci modes still reach baseline validation`, () => {
    const selections = [["ci"], ["ci", "licenses"]];
    if (policy === "pr1") selections.push(["format", "ci"]);
    for (const selection of selections) {
      const result = run([cli, ...selection]);
      assertStarted(result);
      assert.equal(result.status, 86, result.stderr);
      assert.match(result.stderr, /SCOPE_TRIPWIRE:baseline/u);
      assert.doesNotMatch(result.stderr, disabled);
    }
  });

  test(`${policy} CLI license metadata stays locked and offline`, () => {
    const result = run([cli, "licenses"], preload(true, policy));
    assertStarted(result);
    assert.equal(result.status, 87, result.stderr);
    assert.match(result.stderr, /SCOPE_OFFLINE_LICENSE_METADATA/u);
    assert.doesNotMatch(result.stderr, /SCOPE_TRIPWIRE:/u);
  });
}
