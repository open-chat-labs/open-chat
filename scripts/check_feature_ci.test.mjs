import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  checkFeatureCi,
  checkRustFeatureCi,
  RUST_FEATURE_FETCH_COMMAND,
  rustFeatureCiCommand,
  checkNpmFeatureCi,
  NPM_FEATURE_CI_TEST_COMMAND,
  npmFeatureQueryCommand,
  npmFeatureSmokeCommand,
  checkOfflineFeatureHelpers,
  FEATURE_CI_NODE_VERSION,
  OFFLINE_FEATURE_HELPER_TESTS,
  readFeatureWorkflows,
} from "./check_feature_ci.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const slice = existsSync(
  resolve(root, ".github/workflows/openchat_pr2_security.yaml"),
)
  ? "pr2"
  : "pr1";
const actual = readFeatureWorkflows(root, slice);
test("actual scoped npm workflows retain advisory, license and report gates", () => {
  assert.equal(checkNpmFeatureCi({ slice, workflows: actual }).pass, true);
});

test("workflow wiring is not completed Rust advisory or release acceptance", () => {
  const report = checkNpmFeatureCi({ slice, workflows: actual });
  assert.equal(report.advisoryAcceptance, false);
  assert.equal(report.rustSbomAcceptance, false);
  const rust = checkRustFeatureCi({ slice, workflows: actual });
  assert.equal(rust.pass, true);
  assert.equal(rust.advisoryAcceptance, false);
  assert.equal(rust.releaseAcceptance, false);
  assert.equal(checkFeatureCi({ slice, workflows: actual }).pass, true);
});

test("npm CI checks the exact execution runtime and checkout line endings", () => {
  assert.equal(
    checkNpmFeatureCi({
      slice,
      workflows: actual,
      ci: true,
      runtime: FEATURE_CI_NODE_VERSION,
    }).runtimeChecked,
    true,
  );
  assert.throws(
    () =>
      checkNpmFeatureCi({
        slice,
        workflows: actual,
        ci: true,
        runtime: "24.14.1",
      }),
    /CI Node runtime pin/u,
  );
  assert.equal(
    checkNpmFeatureCi({
      slice,
      workflows: Object.fromEntries(
        Object.entries(actual).map(([key, text]) => [
          key,
          text.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n"),
        ]),
      ),
    }).pass,
    true,
  );
});

for (const key of ["model", ...(slice === "pr2" ? ["security"] : [])]) {
  const scope = key === "model" ? "pr1" : "pr2";
  const query = npmFeatureQueryCommand(scope);
  const smoke = npmFeatureSmokeCommand(scope);
  for (const [label, mutate] of [
    [
      "missing real offline runtime smoke",
      (text) => text.replace(smoke.split("\n").at(-1), "true"),
    ],
    [
      "network-enabled runtime smoke",
      (text) => text.replace("--mode plan", "--mode query-bulk"),
    ],
    [
      "smoke moved after advisory query",
      (text) => {
        const indent = (command) => command.replaceAll("\n", "\n          ");
        return text
          .replace(indent(smoke), "__SMOKE_SWAP__")
          .replace(indent(query), indent(smoke))
          .replace("__SMOKE_SWAP__", indent(query));
      },
    ],
    ["missing query", (text) => text.replace(query.split("\n").at(-1), "true")],
    [
      "plan-only query",
      (text) => text.replace("--mode query-bulk", "--mode plan"),
    ],
    [
      "wrong scope",
      (text) =>
        text.replace(
          "--scope " + scope,
          "--scope " + (scope === "pr1" ? "pr2" : "pr1"),
        ),
    ],
    [
      "changed lock checkout",
      (text) =>
        text.replace(
          '--repository-root "$GITHUB_WORKSPACE"',
          '--repository-root "$RUNNER_TEMP"',
        ),
    ],
    [
      "wrong runtime tools",
      (text) =>
        text.replace(
          "$npm_root/npm/node_modules/@npmcli/arborist",
          "$RUNNER_TEMP/arborist",
        ),
    ],
    [
      "missing strict shell",
      (text) => text.replace("set -euo pipefail", "set +e"),
    ],
    [
      "folded query",
      (text) =>
        text.replace(
          "run: |\n          set -euo pipefail",
          "run: >-\n          set -euo pipefail",
        ),
    ],
    [
      "ignored query failure",
      (text) =>
        text.replace(
          "run: |\n          set -euo pipefail",
          "continue-on-error: true\n        run: |\n          set -euo pipefail",
        ),
    ],
    [
      "conditional query",
      (text) =>
        text.replace(
          "run: |\n          set -euo pipefail",
          "if: false\n        run: |\n          set -euo pipefail",
        ),
    ],
    [
      "suppressed query failure",
      (text) => text.replace("--mode query-bulk", "--mode query-bulk || true"),
    ],
    [
      "missing offline regression",
      (text) =>
        text.replace(
          NPM_FEATURE_CI_TEST_COMMAND,
          "node --test scripts/security_mode_scope.test.mjs",
        ),
    ],
    [
      "missing wiring check",
      (text) =>
        text.replace(
          "run: node scripts/check_feature_ci.mjs npm-" + scope,
          "run: true",
        ),
    ],
    [
      "missing independent license gate",
      (text) =>
        text.replace(
          "run: node scripts/check_openchat_" +
            scope +
            "_security.mjs licenses",
          "run: true",
        ),
    ],
    [
      "whole-workspace license query",
      (text) =>
        text.replace(
          "run: node scripts/check_openchat_" +
            scope +
            "_security.mjs licenses",
          "run: cargo audit --json",
        ),
    ],
    [
      "missing report",
      (text) =>
        text.replace(
          "name: openchat-" + scope + "-scoped-npm-report",
          "name: unrelated",
        ),
    ],
    [
      "wrong report directory",
      (text) => text.replace("/npm-feature-advisories-*", "/**"),
    ],
    [
      "ignored missing report",
      (text) =>
        text.replace("if-no-files-found: error", "if-no-files-found: ignore"),
    ],
    [
      "missing failed-check diagnostics",
      (text) => text.replace("if: always()", "if: success()"),
    ],
    [
      "unreviewed Node",
      (text) => text.replace('node-version: "24.18.1"', 'node-version: "22"'),
    ],
    [
      "implicit install audit",
      (text) => text.replace("npm ci --no-audit", "npm ci"),
    ],
    [
      "wrong command directory",
      (text) =>
        text.replace(
          "working-directory: .\n        run: node scripts/check_feature_ci",
          "working-directory: frontend\n        run: node scripts/check_feature_ci",
        ),
    ],
    [
      "shell override",
      (text) =>
        text.replace(
          "run: node scripts/check_feature_ci.mjs npm-",
          "shell: node {0}\n        run: node scripts/check_feature_ci.mjs npm-",
        ),
    ],
    ...(key === "model"
      ? [
          [
            "missing scope-change route",
            (text) => text.replace('      - "scripts/npm_feature*"\n', ""),
          ],
          [
            "missing Rust scope-change route",
            (text) => text.replace('      - "scripts/rust_feature*"\n', ""),
          ],
          [
            "missing SBOM schema-change route",
            (text) =>
              text.replace('      - "scripts/vendor/cyclonedx-1.6/**"\n', ""),
          ],
          [
            "missing gate-change route",
            (text) => text.replace('      - "scripts/check_feature_ci*"\n', ""),
          ],
          [
            "missing install-mode route",
            (text) => text.replace('      - "frontend/.npmrc"\n', ""),
          ],
        ]
      : [
          [
            "consumer-only PR path exclusion",
            (text) =>
              text.replace(
                "  pull_request:\n",
                '  pull_request:\n    paths:\n      - "frontend/package-lock.json"\n',
              ),
          ],
          [
            "consumer-only PR event exclusion",
            (text) =>
              text.replace(
                "  pull_request:\n",
                "  pull_request:\n    types: [opened]\n",
              ),
          ],
          [
            "missing stacked PR route",
            (text) =>
              text.replace(
                "branches: [master, codex/pr1-local-models]",
                "branches: [master]",
              ),
          ],
        ]),
    [
      "inherited execution override",
      (text) =>
        text.replace(
          "jobs:",
          "defaults:\n  run:\n    shell: node {0}\n\njobs:",
        ),
    ],
  ]) {
    test(key + " npm migration rejects " + label, () => {
      const original = actual[key].replaceAll("\r\n", "\n");
      const changed = mutate(original);
      assert.notEqual(
        changed,
        original,
        "Mutation must hit the actual workflow",
      );
      assert.throws(() =>
        checkNpmFeatureCi({ slice, workflows: { ...actual, [key]: changed } }),
      );
    });
  }
}
// Check actual executable workflow wiring, not a sanitized replacement fixture.
// Structural success is not the runtime gate's source/advisory acceptance.
const safe = actual;
const rustWorkflowKey = slice === "pr1" ? "model" : "security";
for (const [label, mutate] of [
  [
    "deleted replacement",
    (text) =>
      text.replace(rustFeatureCiCommand(slice).split("\n").at(-1), "true"),
  ],
  [
    "plan-only replacement",
    (text) => text.replace("--mode check-scoped", "--mode collect-offline"),
  ],
  [
    "wrong Rust scope",
    (text) =>
      text.replace(
        rustFeatureCiCommand(slice).split("\n").at(-1),
        rustFeatureCiCommand(slice === "pr1" ? "pr2" : "pr1")
          .split("\n")
          .at(-1),
      ),
  ],
  [
    "unlocked Rust preparation",
    (text) => text.replace("fetch --locked", "fetch"),
  ],
  [
    "different Rust toolchain",
    (text) =>
      text.replace(
        "rustup toolchain install 1.95.0",
        "rustup toolchain install stable",
      ),
  ],
  [
    "ignored Rust gate",
    (text) =>
      text.replace(
        "--mode check-scoped",
        "--mode check-scoped\n        continue-on-error: true",
      ),
  ],
  [
    "conditional Rust gate",
    (text) =>
      text.replace(
        "--mode check-scoped",
        "--mode check-scoped\n        if: false",
      ),
  ],
  [
    "suppressed Rust failure",
    (text) =>
      text.replace("--mode check-scoped", "--mode check-scoped || true"),
  ],
  [
    "unchecked output",
    (text) =>
      text.replace(
        "rust-feature-ci-*/rust-feature-collection-*/selected-rust.cdx*.json",
        "rust-feature-ci-*/rust-feature-collection-*/*.metadata.json",
      ),
  ],
  [
    "missing failed-run evidence",
    (text) =>
      text.replace(
        "      - name: Upload scoped Rust evidence, including failed checks\n        if: always()",
        "      - name: Upload scoped Rust evidence, including failed checks",
      ),
  ],
])
  test("Rust CI wiring rejects " + label, () => {
    const original = actual[rustWorkflowKey].replaceAll("\r\n", "\n");
    const changed = mutate(original);
    assert.notEqual(
      changed,
      original,
      "Negative control must change the actual workflow",
    );
    assert.throws(() =>
      checkRustFeatureCi({
        slice,
        workflows: { ...actual, [rustWorkflowKey]: changed },
      }),
    );
  });
test("Rust CI uses explicit fetch and does not accept removed old commands as its replacement", () => {
  assert.equal(checkRustFeatureCi({ slice, workflows: actual }).pass, true);
  assert.ok(RUST_FEATURE_FETCH_COMMAND.endsWith("fetch --locked"));
  const original = actual[rustWorkflowKey].replaceAll("\r\n", "\n");
  const changed = original.replace(
    rustFeatureCiCommand(slice).split("\n").at(-1),
    "node scripts/check_feature_ci.mjs " + slice,
  );
  assert.throws(
    () =>
      checkFeatureCi({
        slice,
        workflows: { ...actual, [rustWorkflowKey]: changed },
      }),
    /executable scoped Rust gate/u,
  );
});

for (const [label, mutate] of [
  [
    "wrong preparation checkout",
    (text) =>
      text.replace(
        "      - name: Prepare locked Rust metadata inputs explicitly\n        working-directory: .",
        "      - name: Prepare locked Rust metadata inputs explicitly\n        working-directory: frontend",
      ),
  ],
  [
    "missing full workflow check",
    (text) =>
      text.replace(
        "run: node scripts/check_feature_ci.mjs " + slice,
        "run: true",
      ),
  ],
  [
    "commented report path",
    (text) =>
      text.replace(
        "          path: |\n            ${{ runner.temp }}/rust-feature-ci-*/summary.json",
        "          # path: |\n            ${{ runner.temp }}/rust-feature-ci-*/summary.json",
      ),
  ],
  [
    "ignored report upload",
    (text) =>
      text.replace(
        "      - name: Upload scoped Rust evidence, including failed checks\n        if: always()",
        "      - name: Upload scoped Rust evidence, including failed checks\n        if: always()\n        continue-on-error: true",
      ),
  ],
])
  test("Rust CI wiring rejects " + label, () => {
    const original = actual[rustWorkflowKey].replaceAll("\r\n", "\n");
    const changed = mutate(original);
    assert.notEqual(changed, original);
    assert.throws(() =>
      checkRustFeatureCi({
        slice,
        workflows: { ...actual, [rustWorkflowKey]: changed },
      }),
    );
  });

const check = (workflows = safe, extra = {}) =>
  checkFeatureCi({ slice, workflows, ...extra });

test("the actual frontend workflow executes all offline feature helpers without advisory queries", () => {
  assert.deepEqual(checkOfflineFeatureHelpers(actual.frontend), [
    "scripts/npm_feature_scope.test.mjs",
    "scripts/npm_feature_seed_review.test.mjs",
    "scripts/npm_feature_advisories.test.mjs",
    "scripts/npm_feature_advisories.review.test.mjs",
    "scripts/npm_feature_runtime.test.mjs",
    "scripts/rust_feature_scope.test.mjs",
    "scripts/rust_feature_seed_review.test.mjs",
    "scripts/rust_feature_advisories.test.mjs",
    "scripts/rust_feature_advisory_results.test.mjs",
    "scripts/rust_feature_advisory_runner.test.mjs",
    "scripts/rust_feature_sbom.test.mjs",
    "scripts/rust_feature_sbom_validate.test.mjs",
    "scripts/rust_feature_collection.test.mjs",
    "scripts/rust_feature_ci.test.mjs",
    "scripts/check_feature_ci.test.mjs",
    "scripts/security_mode_scope.test.mjs",
    "scripts/security_owned_rules.test.mjs",
  ]);
  for (const file of OFFLINE_FEATURE_HELPER_TESTS)
    assert(existsSync(resolve(root, file)), file);
});

for (const file of OFFLINE_FEATURE_HELPER_TESTS) {
  test("offline CI rejects omission of " + file, () => {
    const expected = "node --test " + OFFLINE_FEATURE_HELPER_TESTS.join(" ");
    const changed = actual.frontend.replace(
      expected,
      expected.replace(file, ""),
    );
    assert.notEqual(changed, actual.frontend);
    assert.throws(() => checkOfflineFeatureHelpers(changed));
  });
}

for (const [label, transform] of [
  [
    "commented run",
    (step) => step.replace("run: node --test", "# run: node --test"),
  ],
  ["conditional step", (step) => step + "\n        if: false"],
  ["ignored failure", (step) => step + "\n        continue-on-error: true"],
  ["suppressed exit", (step) => step + " || true"],
  [
    "wrong directory",
    (step) =>
      step.replace("working-directory: .", "working-directory: frontend"),
  ],
  [
    "missing directory",
    (step) => step.replace("        working-directory: .\n", ""),
  ],
  ["shell override", (step) => step + "\n        shell: node {0}"],
  ["extra network mode", (step) => step + " --mode query-bulk"],
  ["duplicate step", (step) => step + "\n" + step],
]) {
  test("offline CI rejects " + label, () => {
    const text = actual.frontend.replaceAll("\r\n", "\n");
    const step =
      / {6}- name: Check offline feature inventory and CI contracts\n {8}working-directory: \.\n {8}run: [^\n]+/u.exec(
        text,
      )?.[0];
    assert(step);
    const changed = text.replace(step, transform(step));
    assert.notEqual(changed, text);
    assert.throws(() => checkOfflineFeatureHelpers(changed));
  });
}

test("offline CI rejects inherited workflow and job shell overrides", () => {
  for (const changed of [
    actual.frontend.replace(
      "jobs:",
      "defaults:\n  run:\n    shell: node {0}\n\njobs:",
    ),
    actual.frontend.replace(
      "working-directory: frontend",
      "working-directory: frontend\n        shell: node {0}",
    ),
  ]) {
    assert.notEqual(changed, actual.frontend);
    assert.throws(
      () => checkOfflineFeatureHelpers(changed),
      /inherited helper/,
    );
  }
});

for (const [style, comment] of [
  [">-", true],
  [">-", false],
  ["|", true],
  ["|", false],
]) {
  test(
    "offline CI rejects block-scalar run " + style + " with comment=" + comment,
    () => {
      const command = "node --test " + OFFLINE_FEATURE_HELPER_TESTS.join(" ");
      const block =
        "run: " +
        style +
        "\n" +
        (comment ? "          # fixture-only no-op\n" : "") +
        "          " +
        command;
      const changed = actual.frontend.replace("run: " + command, block);
      assert.notEqual(changed, actual.frontend);
      assert.throws(() => checkOfflineFeatureHelpers(changed));
    },
  );
}

test("current feature workflow structure passes after replacing legacy broad entrypoints", () => {
  assert.deepEqual(check(), {
    pass: true,
    slice,
    mode: "offline-feature-ci-contract",
    nodeVersion: "24.18.1",
    runtimeChecked: false,
    advisoryAcceptance: false,
    buildExecuted: false,
  });
});

test("baseline-free scope check never reads the historical security policies", () => {
  const source = readFileSync(
    new URL("./check_feature_ci.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /security-baseline|expiresOn|reviewedDependencyDigest|node:child_process|node:https|fetch\(/u,
  );
  assert.doesNotMatch(
    source,
    /(?:from|import\()\s*["'][^"']*(?:npm_feature_scope|rust_feature_scope)/u,
  );
});

test("CI verifies the running Node pin without blocking a local structural review on another runtime", () => {
  assert.equal(
    check(safe, { ci: true, runtime: FEATURE_CI_NODE_VERSION }).runtimeChecked,
    true,
  );
  assert.throws(
    () => check(safe, { ci: true, runtime: "22.0.0" }),
    /CI runtime/,
  );
  assert.equal(
    check(safe, { ci: false, runtime: "22.0.0" }).runtimeChecked,
    false,
  );
});

for (const [label, mutate] of [
  [
    "wrong Node pin",
    (value) =>
      value.replace('node-version: "24.18.1"', 'node-version: "22.0.0"'),
  ],
  [
    "missing Node setup",
    (value) => value.replace("actions/setup-node@", "actions/not-node@"),
  ],
  [
    "conditional setup",
    (value) =>
      value.replace(
        'node-version: "24.18.1"',
        'node-version: "24.18.1"\n        if: false',
      ),
  ],
  [
    "implicit install audit",
    (value) => value.replace("npm ci --no-audit", "npm ci"),
  ],
  [
    "overridden install audit",
    (value) => value.replace("npm ci --no-audit", "npm ci --no-audit --audit"),
  ],
  [
    "alternate install",
    (value) => value.replace("npm ci --no-audit", "npm install --no-audit"),
  ],
  [
    "commented install",
    (value) =>
      value.replace("run: npm ci --no-audit", "# run: npm ci --no-audit"),
  ],
  [
    "ignored install failure",
    (value) =>
      value.replace(
        "run: npm ci --no-audit",
        "run: npm ci --no-audit\n        continue-on-error: true",
      ),
  ],
  [
    "conditional feature job",
    (value) =>
      value.replace(
        "  frontend-contracts:",
        "  frontend-contracts:\n    if: false",
      ),
  ],
  [
    "missing model family",
    (value) =>
      value
        .replace("          app/src/utils/localAudioInput\r\n", "")
        .replace("          app/src/utils/localAudioInput\n", ""),
  ],
  [
    "missing catalog utility family",
    (value) =>
      value.replace(
        /^          app\/src\/utils\/webGpuModelCatalog\r?\n/mu,
        "",
      ),
  ],
  [
    "missing catalog UI family",
    (value) =>
      value.replace(
        /^          app\/src\/components_shared\/WebGpuModelCatalog\r?\n/mu,
        "",
      ),
  ],
  [
    "missing native job",
    (value) => value.replace("  native-hermetic:", "  renamed-native:"),
  ],
  [
    "commented real inference",
    (value) =>
      value.replace(
        "          cargo test --locked -p tauri-plugin-oc --features inference",
        "          # cargo test --locked -p tauri-plugin-oc --features inference",
      ),
  ],
  [
    "missing ignored selection",
    (value) =>
      value.replace("--ignored --exact --nocapture", "--exact --nocapture"),
  ],
  [
    "unlocked native tests",
    (value) =>
      value.replace(
        "cargo test --locked -p tauri-plugin-oc --lib",
        "cargo test -p tauri-plugin-oc --lib",
      ),
  ],
  [
    "legacy broad entrypoint",
    (value) =>
      value.replace(
        "run: npm ci --no-audit",
        "run: node scripts/check_openchat_pr1_security.mjs ci npm",
      ),
  ],
  [
    "direct npm audit",
    (value) => value.replace("run: npm ci --no-audit", "run: npm audit --json"),
  ],
  [
    "direct Rust audit",
    (value) =>
      value.replace("run: npm ci --no-audit", "run: cargo audit --json"),
  ],
]) {
  test("rejects " + label, () => {
    const changed = mutate(safe.model);
    assert.notEqual(
      changed,
      safe.model,
      "mutation must reach the actual fixture",
    );
    assert.throws(() => check({ ...safe, model: changed }));
  });
}

for (const [label, mutate] of [
  [
    "path-filtered frontend route",
    (value) =>
      value.replace(
        "  pull_request:",
        "  pull_request:\n    paths: [frontend/**]",
      ),
  ],
  [
    "missing stacked/base route",
    (value) => value.replace("      - master", "      - absent-base"),
  ],
  [
    "missing published branch route",
    (value) =>
      value.replaceAll(
        "      - codex/pr1-local-models",
        "      - absent-feature",
      ),
  ],
  [
    "disabled frontend build",
    (value) =>
      value.replace("run: npm run build:ci", "# run: npm run build:ci"),
  ],
  [
    "omitted guard tests",
    (value) =>
      value.replace(
        "scripts/security_mode_scope.test.mjs",
        "scripts/unrelated.test.mjs",
      ),
  ],
]) {
  test("rejects " + label, () =>
    assert.throws(() => check({ ...safe, frontend: mutate(safe.frontend) })),
  );
}

test("missing/unknown workflow scope cannot silently shrink coverage", () => {
  assert.throws(() => checkFeatureCi({ slice: "pr3", workflows: safe }));
  assert.throws(() => check({ ...safe, unexpected: safe.model }));
  const missing = { ...safe };
  delete missing.model;
  assert.throws(() => check(missing));
  assert.throws(() => check({ ...safe, model: "" }));
});

test("CRLF is equivalent to LF", () => {
  const windows = Object.fromEntries(
    Object.entries(safe).map(([key, value]) => [
      key,
      value.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n"),
    ]),
  );
  assert.deepEqual(check(windows), check());
});

if (slice === "pr2") {
  for (const [label, mutate] of [
    [
      "missing stacked route",
      (value) =>
        value.replace(
          "branches: [codex/pr1-local-models]",
          "branches: [master]",
        ),
    ],
    [
      "filtered integration route",
      (value) =>
        value.replace(
          "  pull_request:",
          "  pull_request:\n    paths: [backend/**]",
        ),
    ],
    [
      "missing scoped runner",
      (value) =>
        value.replace(
          "run: node scripts/app_model_integration.mjs run",
          "# run: node scripts/app_model_integration.mjs run",
        ),
    ],
    [
      "conditional scoped runner",
      (value) =>
        value.replace(
          "      - name: Run and verify",
          "      - if: false\n        name: Run and verify",
        ),
    ],
    [
      "unlocked harness",
      (value) =>
        value.replace(
          "cargo test --locked --package integration_tests",
          "cargo test --package integration_tests",
        ),
    ],
  ]) {
    test("PR2 rejects " + label, () =>
      assert.throws(() =>
        check({ ...safe, integration: mutate(safe.integration) }),
      ),
    );
  }
}
