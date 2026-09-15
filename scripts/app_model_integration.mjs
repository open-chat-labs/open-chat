// Test-only Linux runner. No deployment, signing, model download, core audit or
// change to the upstream full-suite runner. The stress test remains explicitly ignored.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = fileURLToPath(new URL("../", import.meta.url));
export const prefixes = Object.freeze([
  "action_card_inbox_routing_tests::",
  "action_inbox_lifecycle_tests::",
  "ai_app_link_code_tests::",
  "ai_app_registry_tests::",
  "ai_app_revoke_throttle_tests::",
  "communities::enabled_ai_apps_capacity_tests::",
  "communities::enabled_ai_apps_import_tests::",
  "fan_out_delivery_tests::",
  "per_user_key_isolation_tests::",
  "two_phase_confirm_idempotency_tests::",
  "model_catalog_tests::",
]);
export const moduleCounts = Object.freeze([3, 6, 9, 15, 6, 1, 1, 9, 1, 3, 1]);
export const ignoredStressTest =
  "action_inbox_lifecycle_tests::exact_global_action_capacity_survives_upgrade_and_recovers_after_one_exact_action_is_acknowledged";
export const generatedCanisters = Object.freeze([
  "action_inbox",
  "ai_app_verifier_test",
  "airdrop_bot",
  "community",
  "cycles_dispenser",
  "escrow",
  "event_relay",
  "group",
  "group_index",
  "identity",
  "local_user_index",
  "market_maker",
  "neuron_controller",
  "notifications_index",
  "online_users",
  "openchat_installer",
  "proposal_validation",
  "proposals_bot",
  "registry",
  "sign_in_with_email",
  "storage_bucket",
  "storage_index",
  "translations",
  "user",
  "user_index",
]);
const pinsPath = new URL(
  "./app_model_integration_fixtures.json",
  import.meta.url,
);
const maxAssetBytes = 128 * 1024 * 1024;
export function validateFixturePins(manifest) {
  assert.equal(manifest.schemaVersion, 1, "Unknown fixture manifest schema");
  assert.ok(
    typeof manifest.provenance === "string" && manifest.provenance.trim(),
  );
  assert.ok(Array.isArray(manifest.fixtures), "Missing fixtures");
  assert.deepEqual(
    manifest.fixtures.map(({ name }) => name),
    [
      "pocket-ic",
      "icp_ledger.wasm.gz",
      "sns_wasm.wasm.gz",
      "icrc_ledger.wasm.gz",
      "event_store.wasm.gz",
    ],
    "Fixtures must be complete, unique and use the reviewed names",
  );
  for (const pin of manifest.fixtures) {
    const keys = Object.keys(pin).sort();
    assert.deepEqual(
      keys,
      (pin.name === "pocket-ic"
        ? ["name", "url", "gunzip", "bytes", "sha256"]
        : ["name", "url", "bytes", "sha256"]
      ).sort(),
    );
    assert.ok(
      Number.isSafeInteger(pin.bytes) &&
        pin.bytes > 0 &&
        pin.bytes <= maxAssetBytes,
    );
    assert.match(pin.sha256, /^[a-f0-9]{64}$/u);
    const url = new URL(pin.url);
    assert.equal(url.protocol, "https:");
    assert.equal(url.username + url.password + url.search + url.hash, "");
    if (pin.name === "pocket-ic") assert.equal(pin.gunzip, true);
  }
  return manifest.fixtures;
}
export const fixturePins = Object.freeze(
  validateFixturePins(JSON.parse(readFileSync(pinsPath, "utf8"))),
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function checkedCommand(result, label) {
  assert.equal(result.status, 0, `${label} did not exit successfully`);
  return result.stdout;
}

export function validateSourceStatus(result) {
  const status = checkedCommand(result, "Source status");
  assert.equal(
    status.trim(),
    "",
    "Tracked, staged or untracked candidate source changed",
  );
}

export function inventory(text) {
  const lines = text.replaceAll("\r\n", "\n").trim().split("\n");
  const footer = /^(\d+) tests?, 0 benchmarks$/.exec(lines.at(-1));
  assert.ok(footer, "Missing complete libtest inventory footer");
  const names = lines
    .slice(0, -1)
    .filter(Boolean)
    .map((line) => {
      const match = /^([A-Za-z0-9_:]+): test$/.exec(line);
      assert.ok(match, `Invalid inventory line: ${line}`);
      return match[1];
    });
  assert.equal(
    names.length,
    Number(footer[1]),
    "Inventory count differs from its footer",
  );
  assert.equal(new Set(names).size, names.length, "Duplicate inventory names");
  return names;
}

export function validateSelection(allText, selectedText, ignoredText) {
  const all = inventory(allText);
  const selected = inventory(selectedText);
  const ignored = inventory(ignoredText);
  const expected = all.filter((name) =>
    prefixes.some((prefix) => name.startsWith(prefix)),
  );
  assert.deepEqual(
    [...selected].sort(),
    [...expected].sort(),
    "Filters omitted or added tests",
  );
  assert.equal(
    selected.length,
    55,
    "Review the scoped test inventory before changing its count",
  );
  prefixes.forEach((prefix, index) =>
    assert.equal(
      selected.filter((name) => name.startsWith(prefix)).length,
      moduleCounts[index],
      `Review changed module inventory: ${prefix}`,
    ),
  );
  assert.deepEqual(ignored, [ignoredStressTest], "Ignored test policy changed");
  return {
    selected,
    ignored,
    normal: 54,
    filteredOut: all.length - selected.length,
  };
}

export function validateExecution(result, selection) {
  const stdout = checkedCommand(
    result,
    "Selected integration tests",
  ).replaceAll("\r\n", "\n");
  const footers = [
    ...stdout.matchAll(
      /^test result: (ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out; finished in [0-9.]+s$/gmu,
    ),
  ];
  assert.equal(footers.length, 1, "Missing or ambiguous execution footer");
  assert.deepEqual(
    footers[0].slice(1),
    ["ok", "54", "0", "1", "0", String(selection.filteredOut)],
    "Actual executed counts do not match the reviewed selection",
  );
  const outcomes = [
    ...stdout.matchAll(
      /^test ([A-Za-z0-9_:]+) \.\.\. (ok|FAILED|ignored(?:, [^\n]*)?)$/gmu,
    ),
  ];
  assert.equal(
    outcomes.length,
    selection.selected.length,
    "Missing per-test execution evidence",
  );
  assert.equal(
    new Set(outcomes.map((match) => match[1])).size,
    outcomes.length,
    "Repeated test result",
  );
  assert.deepEqual(
    outcomes.map((match) => match[1]).sort(),
    [...selection.selected].sort(),
    "Executed tests differ from the selected inventory",
  );
  for (const [, name, status] of outcomes) {
    assert.ok(
      name === ignoredStressTest
        ? status.startsWith("ignored")
        : status === "ok",
      `Unexpected outcome for ${name}`,
    );
  }
  return {
    passed: 54,
    failed: 0,
    ignored: 1,
    filteredOut: selection.filteredOut,
  };
}

export async function executeSelected(harness, options, execute = command) {
  const list = async (args) =>
    checkedCommand(
      await execute(
        harness,
        ["--list", "--format", "pretty", ...args],
        options,
      ),
      "Test inventory",
    );
  const selection = validateSelection(
    await list([]),
    await list(prefixes),
    await list(["--ignored", ...prefixes]),
  );
  // One real execution process, not one process/base-environment initialization per module.
  const result = await execute(
    harness,
    ["--format", "pretty", "--test-threads", "2", ...prefixes],
    options,
  );
  return { selection, result, counts: validateExecution(result, selection) };
}

export function verifyFixture(bytes, pin) {
  assert.ok(
    Number.isSafeInteger(pin.bytes) &&
      pin.bytes > 0 &&
      pin.bytes <= maxAssetBytes,
  );
  assert.match(pin.sha256, /^[a-f0-9]{64}$/u);
  const payload = pin.gunzip
    ? gunzipSync(bytes, { maxOutputLength: pin.bytes })
    : bytes;
  assert.equal(
    payload.length,
    pin.bytes,
    `Fixture byte length differs: ${pin.name}`,
  );
  assert.equal(
    sha256(payload),
    pin.sha256,
    `Fixture SHA-256 differs: ${pin.name}`,
  );
  if (pin.name.endsWith(".wasm.gz")) verifyWasm(payload);
  return payload;
}

function verifyWasm(compressed) {
  const payload = gunzipSync(compressed, { maxOutputLength: maxAssetBytes });
  assert.equal(
    payload.subarray(0, 8).toString("hex"),
    "0061736d01000000",
    "Invalid WASM fixture",
  );
}

export function linkedHarness(messages, repositoryRoot) {
  const rows = messages
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
  assert.equal(
    rows.at(-1)?.reason,
    "build-finished",
    "Missing Cargo build completion",
  );
  assert.equal(rows.at(-1)?.success, true, "Cargo did not finish successfully");
  const candidates = rows.filter(
    (row) =>
      row.reason === "compiler-artifact" &&
      row.executable &&
      row.target?.name === "integration_tests" &&
      row.profile?.test === true,
  );
  assert.equal(candidates.length, 1, "Expected one actual integration harness");
  const [candidate] = candidates;
  assert.equal(
    resolve(candidate.manifest_path),
    resolve(repositoryRoot, "backend/integration_tests/Cargo.toml"),
  );
  assert.ok(isAbsolute(candidate.executable), "Harness path must be absolute");
  const belowTarget = relative(
    resolve(repositoryRoot, "target"),
    resolve(candidate.executable),
  );
  assert.ok(
    belowTarget &&
      !belowTarget.startsWith(`..${sep}`) &&
      belowTarget !== ".." &&
      !isAbsolute(belowTarget),
    "Harness must be the candidate's target artifact",
  );
  return candidate.executable;
}

async function command(executable, args, options = {}) {
  return await new Promise((fulfill, reject) => {
    const child = spawn(executable, args, {
      ...options,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "",
      bytes = 0;
    const append = (chunk, stream) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024 * 1024) {
        child.kill();
        reject(new Error("Command output exceeded its bound"));
        return;
      }
      if (stream === "stdout") stdout += chunk.toString();
      else stderr += chunk.toString();
      if (!args.includes("--list")) process[stream].write(chunk);
    };
    child.stdout.on("data", (chunk) => append(chunk, "stdout"));
    child.stderr.on("data", (chunk) => append(chunk, "stderr"));
    child.once("error", reject);
    child.once("close", (status) => fulfill({ status, stdout, stderr }));
  });
}

export async function readDownload(pin, request = fetch) {
  let url = pin.url;
  let response;
  for (let redirects = 0; redirects <= 5; redirects++) {
    assert.equal(
      new URL(url).protocol,
      "https:",
      "Fixture transport must remain HTTPS",
    );
    response = await request(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    assert.ok(
      location && redirects < 5,
      "Missing or excessive fixture redirects",
    );
    url = new URL(location, url).href;
    await response.body?.cancel();
  }
  assert.equal(response.status, 200, `Fixture unavailable: ${pin.name}`);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    assert.ok(bytes <= maxAssetBytes, "Fixture download exceeded its bound");
    chunks.push(chunk);
  }
  return verifyFixture(Buffer.concat(chunks), pin);
}

function outputLocation(value, environment = process.env) {
  assert.ok(environment.RUNNER_TEMP, "The scoped runner requires RUNNER_TEMP");
  const parent = realpathSync(environment.RUNNER_TEMP);
  const output = resolve(value);
  assert.equal(
    dirname(output),
    parent,
    "Use a direct, project-specific RUNNER_TEMP child",
  );
  assert.equal(output, join(parent, "openchat-app-model-integration"));
  return output;
}

async function sourceIdentity() {
  const git = (args) =>
    command(
      "git",
      ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
      { cwd: root },
    );
  validateSourceStatus(
    await git(["status", "--porcelain=v1", "--untracked-files=normal"]),
  );
  const head = checkedCommand(
    await git(["rev-parse", "HEAD"]),
    "Source revision",
  ).trim();
  assert.match(head, /^[a-f0-9]{40}$/u);
  return {
    head,
    cargoLockSha256: sha256(readFileSync(join(root, "Cargo.lock"))),
    fixturePinsSha256: sha256(readFileSync(pinsPath)),
  };
}

async function prepare(output) {
  mkdirSync(output); // Never reuse or overwrite an earlier run.
  mkdirSync(join(output, "wasms"));
  mkdirSync(join(output, "tmp"));
  const source = await sourceIdentity();
  const artifacts = [];
  for (const name of generatedCanisters) {
    const bytes = readFileSync(join(root, "wasms", `${name}.wasm.gz`));
    verifyWasm(bytes);
    writeFileSync(join(output, "wasms", `${name}.wasm.gz`), bytes, {
      flag: "wx",
    });
    artifacts.push({
      name: `${name}.wasm.gz`,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  for (const pin of fixturePins) {
    const payload = await readDownload(pin);
    const destination = join(
      output,
      pin.name === "pocket-ic" ? pin.name : `wasms/${pin.name}`,
    );
    writeFileSync(destination, payload, { flag: "wx" });
    if (pin.name === "pocket-ic") chmodSync(destination, 0o700);
    artifacts.push({
      name: pin.name,
      bytes: payload.length,
      sha256: sha256(payload),
    });
  }
  assert.deepEqual(
    await sourceIdentity(),
    source,
    "Source changed during fixture preparation",
  );
  writeFileSync(
    join(output, "inputs.json"),
    JSON.stringify({ source, artifacts }, null, 2),
    { flag: "wx" },
  );
}

async function run(output) {
  assert.equal(
    lstatSync(output).isSymbolicLink(),
    false,
    "Run directory must be physical",
  );
  const inputs = JSON.parse(readFileSync(join(output, "inputs.json"), "utf8"));
  const source = await sourceIdentity();
  assert.deepEqual(
    source,
    inputs.source,
    "Prepared fixture source differs from linked source",
  );
  const expectedNames = [
    ...generatedCanisters.map((name) => `${name}.wasm.gz`),
    ...fixturePins.map((pin) => pin.name),
  ];
  assert.deepEqual(
    inputs.artifacts.map(({ name }) => name).sort(),
    expectedNames.sort(),
  );
  for (const artifact of inputs.artifacts) {
    const bytes = readFileSync(
      join(
        output,
        artifact.name === "pocket-ic"
          ? artifact.name
          : `wasms/${artifact.name}`,
      ),
    );
    assert.equal(bytes.length, artifact.bytes);
    assert.equal(
      sha256(bytes),
      artifact.sha256,
      `Prepared input changed: ${artifact.name}`,
    );
  }
  const harness = linkedHarness(
    readFileSync(join(output, "cargo-messages.json"), "utf8"),
    root,
  );
  const harnessSha256 = sha256(readFileSync(harness));
  const summary = {
    source,
    harnessSha256,
    passed: false,
    normalExpected: 54,
    ignoredCapacityTest: ignoredStressTest,
    capacityTestExecuted: false,
    error: null,
  };
  const env = {
    ...process.env,
    CARGO_MANIFEST_DIR: output,
    POCKET_IC_BIN: join(output, "pocket-ic"),
    TMPDIR: join(output, "tmp"),
    TEMP: join(output, "tmp"),
    TMP: join(output, "tmp"),
  };
  const loggingCommand = async (executable, args, options) => {
    const result = await command(executable, args, options);
    if (!args.includes("--list")) {
      writeFileSync(join(output, "run.stdout.log"), result.stdout, {
        flag: "wx",
      });
      writeFileSync(join(output, "run.stderr.log"), result.stderr, {
        flag: "wx",
      });
    }
    return result;
  };
  try {
    const result = await executeSelected(
      harness,
      { cwd: output, env },
      loggingCommand,
    );
    assert.deepEqual(
      await sourceIdentity(),
      source,
      "Source changed during integration execution",
    );
    assert.equal(
      sha256(readFileSync(harness)),
      harnessSha256,
      "Harness changed during execution",
    );
    Object.assign(summary, {
      passed: true,
      counts: result.counts,
      selected: result.selection.selected,
    });
  } catch (error) {
    summary.error = error.message;
    throw error;
  } finally {
    writeFileSync(
      join(output, "summary.json"),
      JSON.stringify(summary, null, 2),
      { flag: "wx" },
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    assert.equal(
      process.platform,
      "linux",
      "The execution runner supports native Linux only",
    );
    const [mode, value, ...extra] = process.argv.slice(2);
    assert.ok(
      ["prepare", "run"].includes(mode) && value && extra.length === 0,
      "Usage: node scripts/app_model_integration.mjs prepare|run RUNNER_TEMP/openchat-app-model-integration",
    );
    const output = outputLocation(value);
    if (mode === "prepare") await prepare(output);
    else await run(output);
  } catch (error) {
    console.error(`App/model integration failed: ${error.message}`);
    process.exitCode = 1;
  }
}
