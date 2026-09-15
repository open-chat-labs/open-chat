import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const read = (relative) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");
const workflows = [
  "frontend.yaml",
  "backend.yaml",
  "candid.yaml",
  "on_device_model_security.yaml",
  "openchat_pr2_security.yaml",
];

function candidBashExecutable() {
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

function runCandidFixture(options = {}) {
  const fixtureParent = realpathSync(tmpdir());
  const fixture = mkdtempSync(
    path.join(fixtureParent, "openchat-candid-policy-"),
  );
  const checkout = path.join(fixture, "checkout with spaces & symbols");
  const temporary = path.join(fixture, "owned temp with spaces & symbols");
  const eventsPath = path.join(fixture, "events.tsv");
  const original = "pre-existing repository file must survive\n";
  try {
    mkdirSync(path.join(checkout, "scripts"), { recursive: true });
    mkdirSync(temporary);
    writeFileSync(path.join(temporary, "unrelated.keep"), original);
    writeFileSync(path.join(checkout, "temp.did"), original);
    writeFileSync(
      path.join(checkout, "scripts/validate-candid-matches-rust.sh"),
      read("./validate-candid-matches-rust.sh").replaceAll("\r\n", "\n"),
    );
    const canisters = [
      "backend/canisters/alpha/api/can.did",
      "backend/system_canisters/beta/api/can.did",
    ];
    for (const canister of canisters) {
      const filename = path.join(checkout, canister);
      mkdirSync(path.dirname(filename), { recursive: true });
      writeFileSync(filename, "service : { fixture: () -> (); }\n");
    }
    mkdirSync(path.join(checkout, "backend/canisters/no_interface"));
    const invalidTemporary = path.join(fixture, "not a directory");
    writeFileSync(invalidTemporary, original);

    // Only compiler/comparator calls are shadowed. Source the actual script;
    // mktemp, quoting, failure propagation and cleanup execute in real Bash.
    // Emit plausible generated output even when Cargo fails, so rejection
    // cannot accidentally rely on didc finding an invalid/empty document.
    const wrapper = `
printf '%s' "$TMPDIR" > "$OC_FIXTURE_TEMP_LOCATION"
cargo() {
  printf cargo >> "$OC_FIXTURE_EVENTS"
  printf '\\t%s' "$@" >> "$OC_FIXTURE_EVENTS"
  printf '\\n' >> "$OC_FIXTURE_EVENTS"
  printf 'service : { generated: () -> (); }\\n'
  return "$OC_FIXTURE_CARGO_EXIT"
}
didc() {
  DIDC_CALL_COUNT=$((DIDC_CALL_COUNT + 1))
  printf didc >> "$OC_FIXTURE_EVENTS"
  printf '\\t%s' "$@" >> "$OC_FIXTURE_EVENTS"
  printf '\\n' >> "$OC_FIXTURE_EVENTS"
  [[ "$#" == 4 && "$1" == check && "$2" == --strict ]] || return 90
  [[ -f "$3" && -f "$4" ]] || return 91
  if [[ "$DIDC_CALL_COUNT" == "$OC_FIXTURE_DIDC_FAIL_AT" ]]; then return 42; fi
}
DIDC_CALL_COUNT=0
source "$1"
`;
    const results = [];
    for (let attempt = 0; attempt < (options.runs ?? 1); attempt++) {
      const result = spawnSync(
        candidBashExecutable(),
        [
          "--noprofile",
          "--norc",
          "-c",
          wrapper,
          "./scripts/validate-candid-matches-rust.sh",
          "./scripts/validate-candid-matches-rust.sh",
        ],
        {
          cwd: checkout,
          encoding: "utf8",
          timeout: 10_000,
          env: {
            PATH: process.env.PATH,
            SystemRoot: process.env.SystemRoot,
            TEMP: tmpdir(),
            TMP: tmpdir(),
            TMPDIR: options.invalidTemporary ? invalidTemporary : temporary,
            OC_FIXTURE_EVENTS: eventsPath,
            OC_FIXTURE_TEMP_LOCATION: `${eventsPath}.tempdir`,
            OC_FIXTURE_CARGO_EXIT: String(options.cargoExitCode ?? 0),
            OC_FIXTURE_DIDC_FAIL_AT: String(options.didcFailAt ?? 0),
          },
        },
      );
      assert.ifError(result.error);
      results.push({ status: result.status, stderr: result.stderr });
    }
    const events = existsSync(eventsPath)
      ? readFileSync(eventsPath, "utf8")
          .trim()
          .split(/\r?\n/u)
          .map((line) => line.split("\t"))
      : [];
    return {
      results,
      events,
      // Git Bash may expose the configured Windows directory through /tmp;
      // compare with the actual shell TMPDIR, not a guessed drive translation.
      shellTemporary: readFileSync(`${eventsPath}.tempdir`, "utf8"),
      canisters,
      originalPreserved:
        existsSync(path.join(checkout, "temp.did")) &&
        readFileSync(path.join(checkout, "temp.did"), "utf8") === original,
      leftoverTemporary: readdirSync(temporary).filter(
        (name) => name !== "unrelated.keep",
      ),
      unrelatedPreserved:
        readFileSync(path.join(temporary, "unrelated.keep"), "utf8") ===
        original,
    };
  } finally {
    const resolvedFixture = realpathSync(fixture);
    assert.equal(path.dirname(resolvedFixture), fixtureParent);
    assert.match(path.basename(resolvedFixture), /^openchat-candid-policy-/u);
    rmSync(resolvedFixture, { recursive: true, force: true });
  }
}

function assertCandidFixtureClean(result) {
  assert.equal(
    result.originalPreserved,
    true,
    "do not overwrite/delete repository temp.did",
  );
  assert.equal(
    result.unrelatedPreserved,
    true,
    "do not remove unrelated temporary files",
  );
  assert.deepEqual(
    result.leftoverTemporary,
    [],
    "remove the owned generated file on every exit",
  );
}

test("Candid compiler failure skips didc and cleans its owned output", () => {
  const result = runCandidFixture({ cargoExitCode: 37 });
  assert.notEqual(result.results[0].status, 0);
  assert.deepEqual(result.events, [
    ["cargo", "run", "--locked", "-p", "alpha_canister"],
  ]);
  assertCandidFixtureClean(result);
});

for (const [direction, didcFailAt] of [
  ["forward", 1],
  ["backward", 2],
]) {
  test(`Candid ${direction} strict mismatch fails without compiling the next canister`, () => {
    const result = runCandidFixture({ didcFailAt });
    assert.notEqual(result.results[0].status, 0);
    assert.equal(
      result.events.filter(([command]) => command === "cargo").length,
      1,
    );
    assert.equal(
      result.events.filter(([command]) => command === "didc").length,
      didcFailAt,
    );
    assertCandidFixtureClean(result);
  });
}

test("Candid temporary-file creation failure skips compilation and comparison", () => {
  const result = runCandidFixture({ invalidTemporary: true });
  assert.notEqual(result.results[0].status, 0);
  assert.deepEqual(result.events, []);
  assertCandidFixtureClean(result);
});

test("Candid checks every existing canister in both strict directions with locked Cargo", () => {
  const result = runCandidFixture();
  assert.equal(result.results[0].status, 0, result.results[0].stderr);
  assert.deepEqual(
    result.events.filter(([command]) => command === "cargo"),
    [
      ["cargo", "run", "--locked", "-p", "alpha_canister"],
      ["cargo", "run", "--locked", "-p", "beta_canister"],
    ],
  );
  const comparisons = result.events.filter(([command]) => command === "didc");
  assert.equal(comparisons.length, 4);
  for (let index = 0; index < result.canisters.length; index++) {
    const forward = comparisons[index * 2];
    const backward = comparisons[index * 2 + 1];
    assert.deepEqual(forward.slice(0, 3), ["didc", "check", "--strict"]);
    assert.equal(forward[3], `./${result.canisters[index]}`);
    assert.equal(
      path.posix.dirname(forward[4]),
      result.shellTemporary.replace(/\/$/u, ""),
    );
    assert.deepEqual(backward, [
      "didc",
      "check",
      "--strict",
      forward[4],
      forward[3],
    ]);
  }
  assertCandidFixtureClean(result);
});

test("Candid invocations allocate distinct outputs inside the supplied TMPDIR", () => {
  const result = runCandidFixture({ runs: 2 });
  for (const run of result.results) assert.equal(run.status, 0, run.stderr);
  const comparisons = result.events.filter(([command]) => command === "didc");
  assert.equal(comparisons.length, 8);
  assert.notEqual(comparisons[0][4], comparisons[4][4]);
  assertCandidFixtureClean(result);
});

// Bound the match to a single top-level event instead of accepting branch names from job text.
function eventBlock(text, event) {
  const start = text.indexOf(`\n  ${event}:`);
  assert.notEqual(start, -1, `missing ${event} event`);
  const remaining = text.slice(start + 1);
  return remaining.split(/\n(?=  [a-z_]+:|[a-z_]+:)/u)[0];
}

for (const filename of workflows) {
  test(`${filename}: validates the stacked app PR and integration pushes`, () => {
    const text = read(`../.github/workflows/${filename}`);
    assert.match(eventBlock(text, "pull_request"), /\bmaster\b/u);
    assert.match(eventBlock(text, "pull_request"), /codex\/pr1-local-models/u);
    assert.match(eventBlock(text, "push"), /codex\/pr2-clean-integration/u);
    assert.match(eventBlock(text, "push"), /codex\/pr2-app-chat-interfaces/u);
    assert.match(text, /\n  workflow_dispatch:/u);
    assert.doesNotMatch(text, /pull_request_target/u);
    assert.match(text, /permissions:\s*\n  contents: read/u);
  });
}

test("backend CI preserves the lock and reports independent lint failures without waiving them", () => {
  const workflow = read("../.github/workflows/backend.yaml");
  assert.match(
    workflow,
    /command: clippy\s+args: --locked --keep-going --workspace --exclude open-chat --exclude tauri-plugin-oc --tests -- -D warnings\r?\n/u,
  );
  assert.match(
    workflow,
    /command: test\s+args: --locked --workspace --exclude integration_tests --exclude open-chat --exclude tauri-plugin-oc\r?\n/u,
  );
  assert.doesNotMatch(workflow, /continue-on-error:\s*true|\|\|\s*true/u);
});

test("backend PR change detection has its required read-only token permissions", () => {
  const workflow = read("../.github/workflows/backend.yaml");
  const start = workflow.indexOf("\n  changes:");
  assert.notEqual(start, -1, "missing backend change-detection job");
  const changes = workflow.slice(start + 1).split(/\r?\n(?=  [a-z_]+:)/u)[0];
  assert.match(changes, /uses: dorny\/paths-filter@v3/u);
  // PR file enumeration uses the GitHub API. The compiler/test jobs keep
  // contents-only access; this permission belongs to change detection only.
  assert.match(
    changes,
    /^    permissions:\r?\n      contents: read\r?\n      pull-requests: read\r?\n/mu,
  );
  assert.doesNotMatch(changes, /^      [a-z-]+: write\s*$/mu);
});

test("backend integration runner tests the locked dependency graph without changing its selection", () => {
  const script = read("./run-integration-tests.sh");
  const commands = script
    .split(/\r?\n/u)
    .filter((line) => /^\s*cargo\s/u.test(line));
  assert.equal(
    commands.length,
    1,
    "account for every integration Cargo invocation",
  );
  assert.match(
    commands[0],
    /^cargo test --locked --package integration_tests \$TESTNAME -- --nocapture --test-threads \$TEST_THREADS \|\| exit 1$/u,
  );
});

test("stacked interface CI retains syntax and bidirectional Rust contract checks", () => {
  const workflow = read("../.github/workflows/candid.yaml");
  assert.match(workflow, /run: \.\/scripts\/validate-candid-syntax\.sh/u);
  assert.match(workflow, /run: \.\/scripts\/validate-candid-matches-rust\.sh/u);
  assert.match(
    workflow,
    /github\.event\.pull_request\.number \|\| github\.ref/u,
  );
  assert.doesNotMatch(workflow, /continue-on-error:\s*true|\|\|\s*true/u);
  const compare = read("./validate-candid-matches-rust.sh");
  assert.match(compare, /didc check --strict "\$candid" "\$generated_candid"/u);
  assert.match(compare, /didc check --strict "\$generated_candid" "\$candid"/u);
});

test("frontend CI uses the reviewed runtime and never rewrites dependency or source inputs", () => {
  const workflow = read("../.github/workflows/frontend.yaml");
  const policy = JSON.parse(
    read("../.github/security/openchat-pr2-security-baseline.json"),
  );
  const packageJson = JSON.parse(read("../frontend/package.json"));
  assert.match(
    workflow,
    new RegExp(
      `node-version: "${policy.ciRuntime.nodeVersion.replaceAll(".", "\\.")}"`,
      "u",
    ),
  );
  assert.match(workflow, /run: npm ci/u);
  assert.doesNotMatch(workflow, /run: npm (?:install|update|audit fix)\b/u);
  assert.match(workflow, /node --test scripts\/pr-ci-policy\.test\.mjs/u);
  assert.match(workflow, /scripts\/release_preflight\.test\.mjs/u);
  assert.match(workflow, /scripts\/android_bundle\.test\.mjs/u);
  assert.match(workflow, /scripts\/frontend_format_check\.test\.mjs/u);
  assert.match(workflow, /scripts\/android_dev\.test\.mjs/u);
  assert.match(workflow, /scripts\/verify_webgpu_distribution\.test\.mjs/u);
  assert.match(workflow, /scripts\/model_asset_notices\.test\.mjs/u);
  assert.match(workflow, /command -v zip\b/u);
  assert.match(workflow, /command -v unzip\b/u);
  assert.match(workflow, /node scripts\/cdp_axios_compatibility\.mjs/u);
  assert.match(workflow, /node scripts\/decoder_compatibility\.mjs/u);
  assert.match(workflow, /node scripts\/onnx_adm_zip_compatibility\.mjs/u);
  assert.match(
    workflow,
    /node scripts\/transformers_sharp_compatibility\.mjs/u,
  );
  assert.equal(packageJson.scripts["lint:check"], "eslint .");
  assert.match(packageJson.scripts["build:ci"], /npm run lint:check(?: &&|$)/u);
  assert.doesNotMatch(
    packageJson.scripts["build:ci"],
    /npm run lint(?: &&|$)|--fix/u,
  );
});

function requireHostedPolicyRegression(workflow, filename) {
  const heading = /^ {6}- name: Check PR and release policy regressions\r?$/gmu;
  const matches = [...workflow.matchAll(heading)];
  assert.equal(matches.length, 1, "expected one hosted policy step");
  const step = workflow.slice(matches[0].index).split(/\r?\n(?= {6}- )/u)[0];
  assert.match(step, /^ {8}working-directory: \.\r?$/mu);
  assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
  const command = /^ {8}run: node --test ([^\r\n]+)\r?$/mu.exec(step);
  assert.ok(command, "expected the executable root-level Node policy command");
  const files = command[1].trim().split(/\s+/u);
  for (const file of files)
    assert.match(file, /^scripts\/[a-zA-Z0-9_.-]+\.test\.mjs$/u);
  assert.equal(
    files.filter((file) => file === filename).length,
    1,
    `hosted policy must execute ${filename} exactly once`,
  );
}

test("hosted frontend policy executes the action-inbox wiring regression suite", () => {
  requireHostedPolicyRegression(
    read("../.github/workflows/frontend.yaml"),
    "scripts/validate_action_inbox_wiring.test.mjs",
  );
});

test("hosted frontend policy executes the upgrade digest regression suite", () => {
  requireHostedPolicyRegression(
    read("../.github/workflows/frontend.yaml"),
    "scripts/upgrade_canister.test.mjs",
  );
});

test("upgrade digest regression coverage rejects omission and misleading mentions", () => {
  const filename = "scripts/upgrade_canister.test.mjs";
  const workflow = read("../.github/workflows/frontend.yaml");
  const omitted = workflow.replaceAll(filename, "");
  const misleading = `${omitted}\n      # ${filename}\n      - name: Unrelated example\n        run: node --test ${filename}\n`;
  for (const candidate of [omitted, misleading]) {
    assert.throws(
      () => requireHostedPolicyRegression(candidate, filename),
      /hosted policy must execute/u,
    );
  }
});

test("wiring policy coverage cannot be satisfied by a comment or another step", () => {
  const workflow = read("../.github/workflows/frontend.yaml").replaceAll(
    "scripts/validate_action_inbox_wiring.test.mjs",
    "",
  );
  const misleading = `${workflow}\n      # scripts/validate_action_inbox_wiring.test.mjs\n      - name: Unrelated example\n        run: node --test scripts/validate_action_inbox_wiring.test.mjs\n`;
  assert.throws(
    () =>
      requireHostedPolicyRegression(
        misleading,
        "scripts/validate_action_inbox_wiring.test.mjs",
      ),
    /hosted policy must execute/u,
  );
});

function requireSharedMessageContract(workflow) {
  for (const event of ["pull_request", "push"]) {
    assert.doesNotMatch(
      eventBlock(workflow, event),
      /^ {4}(?:paths|paths-ignore):/mu,
      "shared Rust/Candid-only changes must reach frontend policy",
    );
  }
  const jobs = [...workflow.matchAll(/^ {2}install-and-test:\r?$/gmu)];
  assert.equal(jobs.length, 1, "expected the actual frontend policy job");
  const job = workflow.slice(jobs[0].index).split(/\r?\n(?= {2}[a-z_-]+:)/u)[0];
  assert.doesNotMatch(job, /^ {4}(?:if|needs|continue-on-error):/mu);
  requireHostedPolicyRegression(
    job,
    "scripts/message_content_candid_contract.test.mjs",
  );
}

test("frontend policy executes the shared message contract for Rust/Candid-only changes", () => {
  requireSharedMessageContract(read("../.github/workflows/frontend.yaml"));
});

test("shared message contract coverage rejects misleading mentions and skipped routes", () => {
  const workflow = read("../.github/workflows/frontend.yaml");
  const filename = "scripts/message_content_candid_contract.test.mjs";
  const misleading = `${workflow.replaceAll(filename, "")}\n      # ${filename}\n      - name: Unrelated example\n        run: node --test ${filename}\n`;
  assert.throws(
    () => requireSharedMessageContract(misleading),
    /hosted policy must execute/u,
  );
  for (const event of ["pull_request", "push"]) {
    const filtered = workflow.replace(
      `  ${event}:`,
      `  ${event}:\n    paths: ["frontend/**"]`,
    );
    assert.throws(
      () => requireSharedMessageContract(filtered),
      /shared Rust\/Candid-only/u,
    );
  }
  const skipped = workflow.replace(
    "  install-and-test:",
    "  install-and-test:\n    if: false",
  );
  assert.throws(() => requireSharedMessageContract(skipped));
});

test("event extraction cannot satisfy branch coverage from an unrelated job", () => {
  const text =
    "on:\n  pull_request:\n    branches: [master]\n  push:\n    branches: [different]\njobs:\n  example:\n    name: codex/pr1-local-models codex/pr2-clean-integration\n";
  assert.doesNotMatch(eventBlock(text, "pull_request"), /codex\//u);
  assert.doesNotMatch(eventBlock(text, "push"), /codex\//u);
});

test("CI builds a separate production WebGPU candidate and checks its emitted bytes", () => {
  const workflow = read("../.github/workflows/frontend.yaml");
  const defaultBuild = workflow.indexOf("run: npm run build:ci");
  const candidate = workflow.indexOf(
    "- name: Build and verify the opt-in production WebGPU candidate",
  );
  assert.ok(defaultBuild > 0 && candidate > defaultBuild);
  const block = workflow.slice(candidate).split(/\n      - name:/u)[0];
  assert.match(
    block,
    /npm run build:prod\s+node \.\.\/scripts\/verify_webgpu_distribution\.mjs app\/build/u,
  );
  assert.match(block, /OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE: "true"/u);
  assert.match(
    block,
    /OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY: immutable-hub-v1/u,
  );
  assert.doesNotMatch(block, /continue-on-error|\|\|\s*true/u);
  assert.doesNotMatch(
    workflow.slice(defaultBuild, candidate),
    /OC_TRANSFORMERS_WEBGPU_(?:IMAGE_SPIKE|ASSET_DELIVERY):/u,
  );
});

test("the production CI bundle has the exact dfx prerequisite without skipping public-key verification", () => {
  const workflow = read("../.github/workflows/frontend.yaml");
  const dfxVersion = JSON.parse(read("../dfx.json")).dfx;
  assert.match(workflow, /uses: dfinity\/setup-dfx@[a-f0-9]{40}\b/u);
  assert.ok(workflow.includes(`dfx-version: "${dfxVersion}"`));
  const setup = workflow.indexOf("uses: dfinity/setup-dfx@");
  const verify = workflow.indexOf("run: dfx --version");
  const build = workflow.indexOf("run: npm run build:ci");
  assert.ok(setup > 0 && verify > setup && build > verify);
  assert.doesNotMatch(workflow, /SKIP_PUBLIC_KEY|continue-on-error:\s*true/u);
  const rollup = read("../frontend/app/rollup.config.mjs");
  assert.match(rollup, /publicKeyBuildPlugin\(\{/u);
});
