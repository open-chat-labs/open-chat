import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import {
  executeSelected,
  fixturePins,
  generatedCanisters,
  ignoredStressTest,
  inventory,
  linkedHarness,
  moduleCounts,
  prefixes,
  readDownload,
  validateExecution,
  validateSelection,
  verifyFixture,
  validateFixturePins,
  validateSourceStatus,
} from "./app_model_integration.mjs";

const read = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const workflow = read("../.github/workflows/app_model_integration.yaml");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const actualNames = prefixes.flatMap((prefix) => {
  const filename = prefix.slice(0, -2).replaceAll("::", "/");
  const source = read(`../backend/integration_tests/src/${filename}.rs`);
  return [
    ...source.matchAll(/#\[test\]\s*(?:#\[[^\]]+\]\s*)*fn ([A-Za-z0-9_]+)\(/gu),
  ].map((match) => `${prefix}${match[1]}`);
});
const list = (names) =>
  `${names.map((name) => `${name}: test`).join("\n")}\n\n${names.length} tests, 0 benchmarks\n`;
const allNames = [...actualNames, "unrelated_core_test::not_selected"];
const selection = () =>
  validateSelection(
    list(allNames),
    list(actualNames),
    list([ignoredStressTest]),
  );
function successfulExecution() {
  const lines = actualNames.map(
    (name) =>
      `test ${name} ... ${name === ignoredStressTest ? "ignored, capacity-scale PocketIC regression" : "ok"}`,
  );
  return {
    status: 0,
    stderr: "",
    stdout: `${lines.join("\n")}\n\ntest result: ok. 54 passed; 0 failed; 1 ignored; 0 measured; 1 filtered out; finished in 1.00s\n`,
  };
}

test("reviewed prefixes cover every current scoped source test, retaining the one ignored stress test", () => {
  assert.equal(actualNames.length, 55);
  assert.equal(new Set(actualNames).size, 55);
  assert.equal(selection().normal, 54);
  assert.deepEqual(
    prefixes.map(
      (prefix) => actualNames.filter((name) => name.startsWith(prefix)).length,
    ),
    moduleCounts,
  );
  assert.match(
    read("../backend/integration_tests/src/action_inbox_lifecycle_tests.rs"),
    /#\[ignore = "capacity-scale PocketIC regression \(3,200 ingress updates\); run explicitly in release mode"\]/u,
  );
});

test("actual orchestration lists first then executes all prefixes in exactly one harness process", async () => {
  const calls = [];
  const replies = [
    list(allNames),
    list(actualNames),
    list([ignoredStressTest]),
  ];
  const result = await executeSelected(
    "candidate-harness",
    { cwd: "isolated" },
    async (executable, args, options) => {
      calls.push({ executable, args, options });
      return replies.length
        ? { status: 0, stdout: replies.shift(), stderr: "" }
        : successfulExecution();
    },
  );
  assert.equal(calls.length, 4);
  assert.deepEqual(
    calls.map(({ executable }) => executable),
    Array(4).fill("candidate-harness"),
  );
  assert.deepEqual(calls[0].args, ["--list", "--format", "pretty"]);
  assert.deepEqual(calls[1].args, [
    "--list",
    "--format",
    "pretty",
    ...prefixes,
  ]);
  assert.deepEqual(calls[2].args, [
    "--list",
    "--format",
    "pretty",
    "--ignored",
    ...prefixes,
  ]);
  assert.deepEqual(calls[3].args, [
    "--format",
    "pretty",
    "--test-threads",
    "2",
    ...prefixes,
  ]);
  assert.deepEqual(result.counts, {
    passed: 54,
    failed: 0,
    ignored: 1,
    filteredOut: 1,
  });
});

test("an empty or incomplete selection never reaches the real execution call", async () => {
  for (const badNames of [
    [],
    actualNames.slice(1),
    [...actualNames, allNames.at(-1)],
  ]) {
    let calls = 0;
    const replies = [list(allNames), list(badNames), list([ignoredStressTest])];
    await assert.rejects(
      executeSelected("candidate-harness", {}, async () => {
        calls++;
        return { status: 0, stdout: replies.shift(), stderr: "" };
      }),
    );
    assert.equal(
      calls,
      3,
      "Only the three inventories may execute before validation fails",
    );
  }
});

test("failed inventory processes stop immediately even with a plausible complete footer", async () => {
  let calls = 0;
  await assert.rejects(
    executeSelected("harness", {}, async () => {
      calls++;
      return { status: 17, stdout: list(allNames), stderr: "fixture failure" };
    }),
    /did not exit/u,
  );
  assert.equal(calls, 1);
});

test("inventory rejects truncation, duplicate names, missing/extra module tests and ignore-policy drift", () => {
  for (const value of [
    "",
    "plausible test: test",
    list(actualNames).replace("55 tests", "54 tests"),
    list(["same", "same"]),
  ])
    assert.throws(() => inventory(value));
  for (const names of [
    actualNames.slice(1),
    [...actualNames, `${prefixes[0]}new_test`],
  ])
    assert.throws(() =>
      validateSelection(list(names), list(names), list([ignoredStressTest])),
    );
  for (const ignored of [
    [],
    [ignoredStressTest, actualNames[0]],
    [actualNames[0]],
  ])
    assert.throws(() =>
      validateSelection(list(allNames), list(actualNames), list(ignored)),
    );
});

test("execution requires successful exit, exact 54/0/1 counts and one result for every selected name", () => {
  assert.deepEqual(validateExecution(successfulExecution(), selection()), {
    passed: 54,
    failed: 0,
    ignored: 1,
    filteredOut: 1,
  });
  const ok = successfulExecution();
  const bad = [
    { ...ok, status: 1 },
    { ...ok, status: null },
    {
      ...ok,
      stdout:
        "test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s\n",
    },
    { ...ok, stdout: ok.stdout.replace("54 passed", "53 passed") },
    { ...ok, stdout: ok.stdout.replace("0 failed", "1 failed") },
    { ...ok, stdout: ok.stdout.replace("1 ignored", "0 ignored") },
    { ...ok, stdout: ok.stdout.replace("1 filtered out", "0 filtered out") },
    { ...ok, stdout: ok.stdout.replace(/^test [^\n]+\n/u, "") },
    { ...ok, stdout: ok.stdout.replace(actualNames[0], actualNames[1]) },
    {
      ...ok,
      stdout: ok.stdout.replace(actualNames[0], "unrelated::substitute"),
    },
    { ...ok, stdout: ok.stdout.replace(" ... ok", " ... FAILED") },
    {
      ...ok,
      stdout: ok.stdout + ok.stdout.match(/^test result: .+$/mu)[0] + "\n",
    },
    {
      ...ok,
      stdout: ok.stdout.replace(
        `test ${ignoredStressTest} ... ignored, capacity-scale PocketIC regression`,
        `test ${ignoredStressTest} ... ok`,
      ),
    },
  ];
  for (const value of bad)
    assert.throws(() => validateExecution(value, selection()));
});

test("linked harness is an actual successful candidate Cargo artifact, never a guessed or stale path", () => {
  const repository = resolve("candidate");
  const harness = resolve(
    repository,
    "target/debug/deps/integration_tests-abc",
  );
  const artifact = {
    reason: "compiler-artifact",
    target: { name: "integration_tests" },
    profile: { test: true },
    manifest_path: resolve(repository, "backend/integration_tests/Cargo.toml"),
    executable: harness,
  };
  const message = (rows) => rows.map((row) => JSON.stringify(row)).join("\n");
  const complete = { reason: "build-finished", success: true };
  assert.equal(
    linkedHarness(message([artifact, complete]), repository),
    harness,
  );
  for (const rows of [
    [],
    [artifact],
    [complete],
    [artifact, { ...complete, success: false }],
    [artifact, artifact, complete],
    [
      { ...artifact, executable: resolve(repository, "../unrelated-harness") },
      complete,
    ],
    [
      { ...artifact, manifest_path: resolve(repository, "other/Cargo.toml") },
      complete,
    ],
  ])
    assert.throws(() => linkedHarness(message(rows), repository));
});

test("source attribution fails closed for tracked, staged, untracked or unreadable source state", () => {
  validateSourceStatus({ status: 0, stdout: "", stderr: "" });
  for (const stdout of [
    " M source.rs\n",
    "A  source.rs\n",
    "?? new-source.rs\n",
    " D source.rs\n",
  ])
    assert.throws(() =>
      validateSourceStatus({ status: 0, stdout, stderr: "" }),
    );
  assert.throws(() =>
    validateSourceStatus({
      status: 128,
      stdout: "",
      stderr: "cannot read repository",
    }),
  );
});

test("fixture integrity rejects wrong bytes, wrong hashes, truncated gzip and non-WASM input", () => {
  const wasm = gzipSync(Buffer.from("0061736d01000000", "hex"));
  const pin = {
    name: "fixture.wasm.gz",
    bytes: wasm.length,
    sha256: hash(wasm),
  };
  assert.deepEqual(verifyFixture(wasm, pin), wasm);
  const plain = Buffer.from("executable fixture");
  const executablePin = {
    name: "pocket-ic",
    bytes: plain.length,
    sha256: hash(plain),
    gunzip: true,
  };
  assert.deepEqual(verifyFixture(gzipSync(plain), executablePin), plain);
  for (const changed of [
    { ...pin, bytes: pin.bytes + 1 },
    { ...pin, sha256: "0".repeat(64) },
  ])
    assert.throws(() => verifyFixture(wasm, changed));
  assert.throws(() => verifyFixture(wasm.subarray(0, 10), pin));
  assert.throws(() =>
    verifyFixture(gzipSync(Buffer.alloc(100)), { ...executablePin, bytes: 10 }),
  );
  const invalidWasm = gzipSync(Buffer.from("not wasm"));
  assert.throws(() =>
    verifyFixture(invalidWasm, {
      ...pin,
      bytes: invalidWasm.length,
      sha256: hash(invalidWasm),
    }),
  );
});

test("download verification uses only injected fixture bytes and rejects HTTP downgrade or failed responses", async () => {
  const payload = Buffer.from("fixture");
  const pin = {
    name: "fixture",
    url: "https://fixture.invalid/pinned",
    bytes: payload.length,
    sha256: hash(payload),
  };
  const requests = [];
  assert.deepEqual(
    await readDownload(pin, async (url, options) => {
      requests.push({ url, options });
      return new Response(payload);
    }),
    payload,
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.redirect, "manual");
  let redirects = 0;
  await assert.rejects(
    readDownload(pin, async () => {
      redirects++;
      return new Response(null, {
        status: 302,
        headers: { location: "http://fixture.invalid/downgrade" },
      });
    }),
    /HTTPS/u,
  );
  assert.equal(redirects, 1, "Do not follow a downgraded redirect");
  await assert.rejects(
    readDownload(pin, async () => new Response(null, { status: 503 })),
    /unavailable/u,
  );
  await assert.rejects(
    readDownload(pin, async () => new Response(Buffer.from("wrong"))),
    /differs/u,
  );
});

test("fixture pins match reviewed bytes and the existing repository version sources", () => {
  assert.deepEqual(
    fixturePins.map(({ name, bytes, sha256 }) => [name, bytes, sha256]),
    [
      [
        "pocket-ic",
        114356024,
        "6bb60d58c49751aba7ac855b41595da66b0d6629f399894d70887af1b9b7b3b7",
      ],
      [
        "icp_ledger.wasm.gz",
        721325,
        "f7cf2e5a902cccf2af834c6de4d94218162c9de2949349b3bc75f77872c630f0",
      ],
      [
        "sns_wasm.wasm.gz",
        637291,
        "f1f4448e44325fd78017f3a17ca9d7a808c5d68be08ceb7f066a7ca7b784a4dd",
      ],
      [
        "icrc_ledger.wasm.gz",
        592897,
        "67698536a91a5b9b26763d58cee4ad047af2c1e865fecc149e77823977408109",
      ],
      [
        "event_store.wasm.gz",
        388113,
        "88753cdbde8e0de2d2d25bc3f0da83846fc3ceb310bd8d45bd59ce840a9bf840",
      ],
    ],
  );
  const version = read("./run-integration-tests.sh").match(
    /POCKET_IC_SERVER_VERSION="([^"]+)"/u,
  )[1];
  assert.equal(
    fixturePins[0].url,
    `https://github.com/dfinity/pocketic/releases/download/${version}/pocket-ic-x86_64-linux.gz`,
  );
  const ic = read("./download-nns-canister-wasm.sh").match(
    /COMMIT_ID=\$\{3:-([a-f0-9]{40})\}/u,
  )[1];
  for (const pin of fixturePins.slice(1, 4))
    assert.ok(
      pin.url.startsWith(
        `https://download.dfinity.systems/ic/${ic}/canisters/`,
      ),
    );
  assert.equal(
    fixturePins[4].url,
    JSON.parse(read("../dfx.json")).canisters.event_store.wasm,
  );
  const sourceCanisters = read("./generate-all-canister-wasms.sh")
    .match(/CANISTERS=\(\n([\s\S]*?)\n\)/u)[1]
    .trim()
    .split(/\s+/u);
  assert.deepEqual(
    generatedCanisters,
    sourceCanisters,
    "Do not omit any shared fixture canister",
  );
});

test("the entire real pin manifest rejects malformed hashes, omissions, duplicates, URLs and decode-policy drift", () => {
  const manifest = JSON.parse(read("./app_model_integration_fixtures.json"));
  assert.deepEqual(validateFixturePins(manifest), fixturePins);
  const edit = (change) => {
    const value = structuredClone(manifest);
    change(value);
    return value;
  };
  for (const changed of [
    edit((value) => {
      value.schemaVersion = 2;
    }),
    edit((value) => {
      value.fixtures.pop();
    }),
    edit((value) => {
      value.fixtures[4] = value.fixtures[3];
    }),
    edit((value) => {
      value.fixtures[4].sha256 = value.fixtures[4].sha256.slice(1);
    }),
    edit((value) => {
      value.fixtures[4].sha256 = "g".repeat(64);
    }),
    edit((value) => {
      value.fixtures[4].bytes = 0;
    }),
    edit((value) => {
      value.fixtures[4].name = "../escape";
    }),
    edit((value) => {
      value.fixtures[4].url = "http://fixture.invalid";
    }),
    edit((value) => {
      value.fixtures[4].url = "https://user:secret@fixture.invalid";
    }),
    edit((value) => {
      value.fixtures[0].gunzip = false;
    }),
    edit((value) => {
      value.fixtures[4].gunzip = true;
    }),
  ])
    assert.throws(() => validateFixturePins(changed));
});

// Deliberately accept only the small explicit event/step form used by this
// workflow. New conditionals or filters require review, not permissive parsing.
function workflowContract(text) {
  assert.doesNotMatch(
    text,
    /pull_request_target|secrets\.|self-hosted|cpu=|run-id=|continue-on-error/u,
  );
  const on = text.match(/^on:\n([\s\S]*?)(?=^\S)/mu)?.[1];
  assert.ok(on);
  const branches = (event) => {
    const block = on
      .match(
        new RegExp(
          `^  ${event}:\\n([\\s\\S]*?)(?=^  [a-z_]+:|$(?![\\s\\S]))`,
          "mu",
        ),
      )?.[1]
      ?.trim();
    const match = /^branches: \[([^\]\n]+)\]$/u.exec(block ?? "");
    assert.ok(match, `Unexpected ${event} routing/filter/condition`);
    return match[1].split(", ");
  };
  assert.match(on, /^  workflow_dispatch:\s*$/mu);
  assert.match(text, /^permissions:\n  contents: read\n/mu);
  assert.match(text, /^    runs-on: ubuntu-24\.04\n/mu);
  const job = text.match(/^  app-model-integration:\n([\s\S]*)$/mu)?.[1];
  assert.ok(job);
  assert.doesNotMatch(job, /^    (?:if|needs):/mu);
  const steps = [
    ...job.matchAll(
      /^      - name: ([^\n]+)\n([\s\S]*?)(?=^      - |$(?![\s\S]))/gmu,
    ),
  ];
  const runStep = (name, command) => {
    const matches = steps.filter((match) => match[1] === name);
    assert.equal(matches.length, 1);
    assert.equal(
      matches[0][2].trim(),
      `run: ${command}`,
      "Execution cannot be skipped, replaced or made advisory",
    );
  };
  runStep(
    "Verify scoped integration selection and failure handling offline",
    "node --test scripts/app_model_integration.test.mjs",
  );
  runStep(
    "Stage isolated hash-verified integration fixtures",
    'node scripts/app_model_integration.mjs prepare "$RUNNER_TEMP/openchat-app-model-integration"',
  );
  runStep(
    "Link the locked candidate test harness without running it",
    'cargo test --locked --package integration_tests --no-run --message-format=json > "$RUNNER_TEMP/openchat-app-model-integration/cargo-messages.json"',
  );
  runStep(
    "Run and verify every selected app and model integration test",
    'node scripts/app_model_integration.mjs run "$RUNNER_TEMP/openchat-app-model-integration"',
  );
  const routes = {
    pull_request: branches("pull_request"),
    push: branches("push"),
    workflow_dispatch: true,
  };
  assert.deepEqual(routes, {
    pull_request: ["codex/pr1-local-models"],
    push: ["codex/pr2-app-chat-interfaces", "codex/pr2-clean-integration"],
    workflow_dispatch: true,
  });
  return routes;
}

test("the actual workflow selects the stacked base and PR2 pushes without private runners or skipped execution", () => {
  assert.deepEqual(workflowContract(workflow), {
    pull_request: ["codex/pr1-local-models"],
    push: ["codex/pr2-app-chat-interfaces", "codex/pr2-clean-integration"],
    workflow_dispatch: true,
  });
  const frontend = read("../.github/workflows/frontend.yaml");
  const step = frontend.match(
    /- name: Check PR and release policy regressions\n([\s\S]*?)(?=\n      - name:)/u,
  )?.[1];
  assert.ok(step);
  assert.match(step, /^        working-directory: \.$/mu);
  assert.doesNotMatch(step, /^        (?:if|continue-on-error):/mu);
  const files = step
    .match(/^        run: node --test (.+)$/mu)?.[1]
    .split(/\s+/u);
  assert.equal(
    files?.filter((file) => file === "scripts/app_model_integration.test.mjs")
      .length,
    1,
  );
});

test("workflow coverage rejects misleading comments, missing routes, shell no-ops and skipped test steps", () => {
  for (const changed of [
    workflow.replace(
      "branches: [codex/pr1-local-models]",
      "branches: [master]\n    # codex/pr1-local-models",
    ),
    workflow.replace("  push:\n", '  push:\n    paths: ["unrelated/**"]\n'),
    workflow.replace(
      "  app-model-integration:\n",
      "  app-model-integration:\n    if: false\n",
    ),
    workflow.replace(
      'run: node scripts/app_model_integration.mjs run "$RUNNER_TEMP/openchat-app-model-integration"',
      'run: echo node scripts/app_model_integration.mjs run "$RUNNER_TEMP/openchat-app-model-integration"',
    ),
    workflow.replace(
      'run: node scripts/app_model_integration.mjs run "$RUNNER_TEMP/openchat-app-model-integration"',
      'if: false\n        run: node scripts/app_model_integration.mjs run "$RUNNER_TEMP/openchat-app-model-integration"',
    ),
    workflow.replace("runs-on: ubuntu-24.04", "runs-on: self-hosted"),
  ])
    assert.throws(() => workflowContract(changed));
});
