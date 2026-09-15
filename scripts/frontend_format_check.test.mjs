import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { inheritedFormattingDigest } from "./frontend_format_inherited.mjs";
import {
  candidateFormattingPaths,
  checkFrontendFormatting,
  formatArgumentBatches,
  frontendFormattingLineEndingArgs,
  checkLfNormalizedFormatting,
} from "./frontend_format_check.mjs";

test("actual Git selects only reconciled candidate content, omitting deletions and preserving literal paths", (t) => {
  const root = mkdtempSync(join(tmpdir(), "openchat-format-scope-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync(
      "git",
      [
        "-c",
        `safe.directory=${root.replaceAll("\\", "/")}`,
        "-c",
        "user.name=Format Test",
        "-c",
        "user.email=format@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "-c",
        `core.hooksPath=${join(root, "no-hooks")}`,
        ...args,
      ],
      { cwd: root, encoding: "utf8", windowsHide: true },
    );
  git("init", "--quiet");
  mkdirSync(join(root, "frontend"));
  const write = (name, text) =>
    writeFileSync(join(root, "frontend", name), text);
  const commit = () => {
    git("add", "--all");
    git("commit", "--quiet", "-m", "fixture");
    return git("rev-parse", "HEAD").trim();
  };
  write("core.ts", "export const inherited = 1;\n");
  write("removed.ts", "export const removed = 1;\n");
  write("rename.ts", "export const renamed = 1;\n");
  const historical = commit();
  write("core.ts", "export const inherited = 2;\n");
  const reconciled = commit();
  write("model.ts", "export const model = 1;\n");
  write("space & مرحبا.ts", "export const literal = 1;\n");
  rmSync(join(root, "frontend", "removed.ts"));
  renameSync(
    join(root, "frontend", "rename.ts"),
    join(root, "frontend", "renamed.ts"),
  );
  commit();
  const expected = [
    "frontend/model.ts",
    "frontend/renamed.ts",
    "frontend/space & مرحبا.ts",
  ].sort();
  assert.deepEqual(
    candidateFormattingPaths({ root, comparisonBase: reconciled, ci: true }),
    expected,
  );
  assert(
    candidateFormattingPaths({
      root,
      comparisonBase: historical,
      ci: true,
    }).includes("frontend/core.ts"),
    "regression fixture must expose the old baseline defect",
  );
  write("untracked.ts", "export const local = 1;\n");
  assert.deepEqual(
    candidateFormattingPaths({ root, comparisonBase: reconciled, ci: true }),
    expected,
  );
  assert.deepEqual(
    candidateFormattingPaths({ root, comparisonBase: reconciled }),
    [...expected, "frontend/untracked.ts"].sort(),
  );
});

test("format scope fails closed for missing/invalid bases and Git errors without broad fallback", () => {
  for (const comparisonBase of [
    undefined,
    "",
    "HEAD",
    "-x",
    "a".repeat(39),
    "a".repeat(40) + "\n",
  ]) {
    assert.throws(
      () =>
        candidateFormattingPaths({ root: ".", comparisonBase }, () => {
          throw new Error("Git must not run");
        }),
      /explicit full formatting/,
    );
  }
  for (const result of [
    { status: 1, stderr: "unknown commit" },
    { status: null },
    { error: new Error("cannot spawn") },
  ]) {
    let calls = 0;
    assert.throws(
      () =>
        candidateFormattingPaths(
          { root: ".", comparisonBase: "a".repeat(40) },
          () => {
            calls++;
            return result;
          },
        ),
      /Git formatting scope failed/,
    );
    assert.equal(calls, 1);
  }
});

test("format batches preserve every path exactly once within the Windows argument budget", () => {
  const paths = Array.from(
    { length: 284 },
    (_, i) => `app/src/${"nested/".repeat(20)}file ${i} & literal.svelte`,
  );
  const batches = formatArgumentBatches(paths);
  assert.ok(batches.length > 1);
  assert.deepEqual(batches.flat(), paths);
  assert.ok(
    batches.every(
      (batch) => batch.reduce((n, path) => n + 2 * path.length + 3, 0) <= 16000,
    ),
  );
  assert.deepEqual(formatArgumentBatches([]), []);
  assert.throws(() => formatArgumentBatches(["x".repeat(9000)]), /exceeds/);
});

test("formatter uses the installed CLI without a shell and preserves every failure", () => {
  const paths = Array.from(
    { length: 200 },
    (_, i) => `${"long/".repeat(50)}${i}.ts`,
  );
  const batches = formatArgumentBatches(paths);
  const seen = [];
  const errors = checkFrontendFormatting(
    "fixture frontend",
    paths,
    (command, args, options) => {
      assert.equal(command, process.execPath);
      assert.ok(args[0].endsWith("prettier.cjs"));
      assert.equal(args[1], "--plugin=prettier-plugin-svelte");
      assert.equal(args[2], "--check");
      assert.equal(options.shell, undefined);
      seen.push(...args.slice(3).filter((arg) => arg !== "--end-of-line=auto"));
      return { status: 1, stdout: "format failed", stderr: "details" };
    },
  );
  assert.deepEqual(seen, paths);
  assert.equal(errors.length, batches.length);
  assert.ok(
    errors.every(
      (error) => error.includes("format failed") && error.includes("details"),
    ),
  );
});

test("spawn errors and signals cannot become successful format checks", () => {
  for (const result of [
    { error: new Error("missing executable") },
    { status: null },
    { status: 2 },
  ]) {
    assert.equal(
      checkFrontendFormatting("fixture", ["test.ts"], () => result).length,
      1,
    );
  }
  assert.deepEqual(
    checkFrontendFormatting("fixture", ["test.ts"], () => ({ status: 0 })),
    [],
  );
});

const fixtureBase = "d".repeat(40);
const fixtureSource = "const inherited = 1;   \n";
const fixtureCandidate = fixtureSource + "const model = true;\n";
const fixtureConfig = '{ "tabWidth": 4 }\n';

async function inheritedHarness(
  t,
  { repositoryScope = "pr1", reviewedScope = repositoryScope } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "openchat-format-inherited-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const frontend = join(root, "frontend");
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(frontend, "app"), { recursive: true });
  for (const name of ["prettier", "prettier-plugin-svelte"]) {
    mkdirSync(join(frontend, "node_modules", name), { recursive: true });
    writeFileSync(
      join(frontend, "node_modules", name, "package.json"),
      JSON.stringify({ version: name === "prettier" ? "3.8.4" : "3.5.2" }),
    );
  }
  writeFileSync(join(frontend, ".prettierrc"), fixtureConfig);
  writeFileSync(join(frontend, "app/fixture.ts"), fixtureCandidate);
  if (repositoryScope === "pr2")
    writeFileSync(join(root, "scripts/check_openchat_pr2_security.mjs"), "");
  const record = {
    scope: reviewedScope,
    path: "frontend/app/fixture.ts",
    baseCommit: fixtureBase,
    baseSha256: inheritedFormattingDigest(fixtureSource),
    candidateSha256: inheritedFormattingDigest(fixtureCandidate),
    justification: "Only the exact inherited upstream formatting remains.",
    formatter: {
      prettierVersion: "3.8.4",
      sveltePluginVersion: "3.5.2",
      configSha256: inheritedFormattingDigest(fixtureConfig),
    },
    proof: {
      baseEditSha256s: ["a".repeat(64)],
      candidateEditSha256s: ["a".repeat(64)],
    },
  };
  writeFileSync(
    join(root, "scripts/frontend_format_inherited.json"),
    JSON.stringify({
      schemaVersion: 1,
      normalization: "CRLF-to-LF-only",
      records: [record],
    }),
  );
  for (const name of [
    "frontend_format_check.mjs",
    "frontend_format_inherited.mjs",
  ]) {
    writeFileSync(
      join(root, "scripts", name),
      readFileSync(new URL(name, import.meta.url), "utf8"),
    );
  }
  const { checkFrontendFormatting: check } = await import(
    pathToFileURL(join(root, "scripts/frontend_format_check.mjs"))
  );
  const run = ({
    first = {
      status: 1,
      stdout: "Checking formatting...\n",
      stderr: "[warn] app/fixture.ts\n",
    },
    listed = {
      status: 1,
      stdout: "app/fixture.ts\n",
      stderr: "[warn] svelteBracketNewLine is deprecated.\n",
    },
    base = { status: 0, stdout: fixtureSource, stderr: "" },
    config = { status: 0, stdout: ".prettierrc\n", stderr: "" },
    paths = ["app/fixture.ts"],
    ...options
  } = {}) => {
    const calls = [],
      reports = [];
    const execute = (command, args, settings) => {
      assert.equal(settings.shell, undefined);
      calls.push({ command, args });
      if (command === process.execPath) {
        assert.equal(
          args[0],
          join(frontend, "node_modules/prettier/bin/prettier.cjs"),
        );
        if (args[1] === "--find-config-path") {
          assert.equal(args[2], join(frontend, paths[0]));
          return config;
        }
        assert.equal(args[1], "--plugin=prettier-plugin-svelte");
        if (args[2] === "--check") return first;
        assert.equal(args[2], "--list-different");
        return listed;
      }
      assert.match(command, /^git(?:\.exe)?$/u);
      assert.equal(args[2], "show");
      return base;
    };
    const failures = check(frontend, paths, execute, {
      inheritedBase: fixtureBase,
      report: (message) => reports.push(message),
      ...options,
    });
    return { failures, calls, reports };
  };
  return { run, frontend };
}

test("line-ending auto is strictly local Windows behavior, never CI", () => {
  assert.deepEqual(
    frontendFormattingLineEndingArgs({ platform: "win32", ci: false }),
    ["--end-of-line=auto"],
  );
  for (const platform of ["win32", "linux", "darwin"]) {
    assert.deepEqual(
      frontendFormattingLineEndingArgs({ platform, ci: true }),
      [],
    );
  }
  assert.deepEqual(
    frontendFormattingLineEndingArgs({ platform: "linux", ci: false }),
    [],
  );
});

test("normal formatter success bypasses all inherited-debt processing", async (t) => {
  const { run } = await inheritedHarness(t);
  const result = run({ first: { status: 0 } });
  assert.deepEqual(result.failures, []);
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].args[2], "--check");
  assert.deepEqual(result.reports, []);
});

for (const repositoryScope of ["pr1", "pr2"]) {
  test(`${repositoryScope}: formatter runs first and exact inherited debt is explicitly reported`, async (t) => {
    const { run } = await inheritedHarness(t, { repositoryScope });
    const result = run();
    assert.deepEqual(result.failures, []);
    assert.equal(result.calls[0].args[2], "--check");
    assert.equal(result.calls[1].args[2], "--list-different");
    assert.equal(result.calls[2].args[1], "--find-config-path");
    assert.equal(result.calls[3].args[2], "show");
    assert.equal(result.reports.length, 1);
    assert.match(
      result.reports[0],
      new RegExp(
        "retained exact reviewed inherited debt " +
          repositoryScope +
          ":frontend/app/fixture.ts",
      ),
    );
    assert.match(result.reports[0], /candidate SHA-256/);
  });
}

test("the real checkout determines scope; a caller-supplied slice cannot opt into other records", async (t) => {
  const { run } = await inheritedHarness(t, {
    repositoryScope: "pr1",
    reviewedScope: "pr2",
  });
  const result = run({ scope: "pr2" });
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /unreviewed-path/);
  assert.deepEqual(result.reports, []);
});

for (const repositoryScope of ["pr1", "pr2"]) {
  test(`${repositoryScope}: stacked comparison head never replaces the fixed inherited proof base`, async (t) => {
    const { run } = await inheritedHarness(t, { repositoryScope });
    const previous = process.env.PR_BASE_SHA;
    try {
      process.env.PR_BASE_SHA = "e".repeat(40);
      const result = run({ comparisonBase: process.env.PR_BASE_SHA });
      assert.deepEqual(result.failures, []);
      const git = result.calls.find(({ args }) => args[2] === "show");
      assert.equal(git.args[3], `${fixtureBase}:frontend/app/fixture.ts`);
      assert.equal(result.reports.length, 1);
      const noProof = run({ inheritedBase: undefined });
      assert.equal(noProof.failures.length, 1);
      assert.equal(noProof.calls.length, 1);
    } finally {
      if (previous === undefined) delete process.env.PR_BASE_SHA;
      else process.env.PR_BASE_SHA = previous;
    }
  });
}

for (const [label, config] of [
  ["nested config", { status: 0, stdout: "app/.prettierrc\n", stderr: "" }],
  ["package config", { status: 0, stdout: "app/package.json\n", stderr: "" }],
  ["no discovered config", { status: 0, stdout: "", stderr: "" }],
  [
    "multiple config paths",
    { status: 0, stdout: ".prettierrc\napp/.prettierrc\n" },
  ],
  [
    "unknown diagnostic",
    { status: 0, stdout: ".prettierrc\n", stderr: "unknown config warning\n" },
  ],
  ["nonzero config exit", { status: 1, stdout: ".prettierrc\n" }],
  [
    "config spawn failure",
    { status: 0, stdout: ".prettierrc\n", error: new Error("cannot spawn") },
  ],
  ["config signal", { status: 0, stdout: ".prettierrc\n", signal: "SIGTERM" }],
]) {
  test(`inherited review refuses unproven effective formatter config: ${label}`, async (t) => {
    const { run } = await inheritedHarness(t);
    const result = run({ config });
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], /Effective formatter config/);
    assert.equal(result.calls.length, 3);
    assert.deepEqual(result.reports, []);
  });
}

for (const location of [
  "app/.editorconfig",
  ".editorconfig",
  "../.editorconfig",
]) {
  test(`inherited review refuses unbound EditorConfig at ${location}`, async (t) => {
    const { run, frontend } = await inheritedHarness(t);
    writeFileSync(join(frontend, location), "[*]\nindent_size = 2\n");
    const result = run();
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], /Unreviewed EditorConfig influence/);
    assert.equal(result.calls.length, 3);
    assert.deepEqual(result.reports, []);
  });
}

for (const [label, listed] of [
  ["non-style exit", { status: 2, stdout: "app/fixture.ts\n" }],
  [
    "spawn error",
    { error: new Error("cannot spawn"), status: 1, stdout: "app/fixture.ts\n" },
  ],
  ["signal", { signal: "SIGTERM", status: 1, stdout: "app/fixture.ts\n" }],
  ["success contradicts first check", { status: 0, stdout: "" }],
  ["empty result", { status: 1, stdout: "" }],
  ["unexpected filename", { status: 1, stdout: "app/unselected.ts\n" }],
  [
    "duplicate filename",
    { status: 1, stdout: "app/fixture.ts\napp/fixture.ts\n" },
  ],
  [
    "unexpected output text",
    { status: 1, stdout: "Checking formatting...\napp/fixture.ts\n" },
  ],
  [
    "unknown config warning",
    {
      status: 1,
      stdout: "app/fixture.ts\n",
      stderr: "[warn] Ignored unknown option bad\n",
    },
  ],
  [
    "parse diagnostic",
    { status: 1, stdout: "app/fixture.ts\n", stderr: "[error] SyntaxError\n" },
  ],
]) {
  test(`mismatch listing fails closed: ${label}`, async (t) => {
    const { run } = await inheritedHarness(t);
    const result = run({ listed });
    assert.equal(result.failures.length, 1);
    assert.equal(result.calls.length, 2);
    assert.deepEqual(result.reports, []);
  });
}

for (const first of [
  { status: 2, stderr: "parse failure" },
  { status: null, signal: "SIGTERM" },
  { status: 1, error: new Error("missing formatter") },
]) {
  test("non-style first-check failure cannot enter the inherited-debt path", async (t) => {
    const { run } = await inheritedHarness(t);
    const result = run({ first });
    assert.equal(result.failures.length, 1);
    assert.equal(result.calls.length, 1);
    assert.deepEqual(result.reports, []);
  });
}

for (const [label, mutate, options, expected] of [
  [
    "candidate bytes",
    (f) => writeFileSync(join(f, "app/fixture.ts"), fixtureCandidate + " "),
    {},
    /candidate-content-drift/,
  ],
  ["missing candidate", (f) => rmSync(join(f, "app/fixture.ts")), {}, /ENOENT/],
  [
    "formatter version",
    (f) =>
      writeFileSync(
        join(f, "node_modules/prettier/package.json"),
        '{"version":"3.8.5"}',
      ),
    {},
    /formatter-version-drift/,
  ],
  [
    "plugin version",
    (f) =>
      writeFileSync(
        join(f, "node_modules/prettier-plugin-svelte/package.json"),
        '{"version":"3.5.3"}',
      ),
    {},
    /formatter-version-drift/,
  ],
  [
    "formatter config",
    (f) => writeFileSync(join(f, ".prettierrc"), fixtureConfig + " "),
    {},
    /formatter-config-drift/,
  ],
  [
    "invalid version JSON",
    (f) =>
      writeFileSync(join(f, "node_modules/prettier/package.json"), "not json"),
    {},
    /JSON/,
  ],
  [
    "base bytes",
    () => {},
    { base: { status: 0, stdout: fixtureSource + " " } },
    /base-content-drift/,
  ],
  [
    "base commit",
    () => {},
    { inheritedBase: "e".repeat(40) },
    /base-commit-drift/,
  ],
  [
    "base command failure",
    () => {},
    { base: { status: 1, stderr: "missing commit" } },
    /base read failed/,
  ],
]) {
  test(`actual integration refuses ${label} drift`, async (t) => {
    const { run, frontend } = await inheritedHarness(t);
    mutate(frontend);
    const result = run(options);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], expected);
    assert.deepEqual(result.reports, []);
  });
}

test("an unreviewed real formatting mismatch remains fatal", async (t) => {
  const { run, frontend } = await inheritedHarness(t);
  writeFileSync(join(frontend, "app/unreviewed.ts"), fixtureCandidate);
  const result = run({
    paths: ["app/unreviewed.ts"],
    listed: { status: 1, stdout: "app/unreviewed.ts\n", stderr: "" },
  });
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /unreviewed-path/);
  assert.deepEqual(result.reports, []);
});

test("LF diagnostic uses exact CLI filepath/config and changes only CRLF pairs", async (t) => {
  const { frontend } = await inheritedHarness(t);
  const source = "const x = 1;\r\nconst y = 2;\n// bare CR stays\r";
  writeFileSync(join(frontend, "app/fixture.ts"), source);
  let calls = 0;
  const result = checkLfNormalizedFormatting(
    frontend,
    "app/fixture.ts",
    (command, args, options) => {
      calls++;
      assert.equal(command, process.execPath);
      assert.deepEqual(args.slice(1), [
        "--plugin=prettier-plugin-svelte",
        "--check",
        "--stdin-filepath",
        join(frontend, "app/fixture.ts"),
        "--end-of-line=lf",
      ]);
      assert.equal(options.shell, undefined);
      assert.equal(
        options.input,
        "const x = 1;\nconst y = 2;\n// bare CR stays\r",
      );
      return {
        status: 0,
        stderr: "[warn] svelteBracketNewLine is deprecated.\n",
      };
    },
  );
  assert.equal(result, true);
  assert.equal(calls, 1);
  writeFileSync(join(frontend, "app/fixture.ts"), fixtureCandidate);
  assert.equal(
    checkLfNormalizedFormatting(frontend, "app/fixture.ts", () => {
      throw new Error("LF-only content does not need a checkout diagnostic");
    }),
    false,
  );
});

test("LF diagnostic cannot excuse a content formatting mismatch", async (t) => {
  const { frontend } = await inheritedHarness(t);
  writeFileSync(
    join(frontend, "app/fixture.ts"),
    fixtureCandidate.replaceAll("\n", "\r\n"),
  );
  assert.equal(
    checkLfNormalizedFormatting(frontend, "app/fixture.ts", () => ({
      status: 1,
      stdout: "Checking formatting...\n",
      stderr: "[warn] app/fixture.ts\n",
    })),
    false,
  );
});

for (const result of [
  { status: 2, stderr: "parse error" },
  { status: 0, signal: "SIGTERM" },
  { status: null, error: new Error("cannot spawn") },
  { status: 0, stderr: "[warn] Ignored unknown option bad\n" },
]) {
  test("LF diagnostic fails closed on command, parse, or unknown config diagnostics", async (t) => {
    const { frontend } = await inheritedHarness(t);
    writeFileSync(
      join(frontend, "app/fixture.ts"),
      fixtureCandidate.replaceAll("\n", "\r\n"),
    );
    assert.throws(
      () =>
        checkLfNormalizedFormatting(frontend, "app/fixture.ts", () => result),
      /formatter/,
    );
  });
}

test("CI never invokes the local EOL diagnostic even for a mixed checkout", async (t) => {
  const { run, frontend } = await inheritedHarness(t);
  writeFileSync(
    join(frontend, "app/fixture.ts"),
    fixtureCandidate.replaceAll("\n", "\r\n"),
  );
  const previous = process.env.CI;
  try {
    process.env.CI = "true";
    const result = run();
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], /CI formatter requires LF/);
    assert.equal(result.calls.length, 2);
    assert(
      result.calls.every(
        ({ args }) =>
          !args.includes("--stdin-filepath") &&
          !args.includes("--end-of-line=auto"),
      ),
    );
    assert.deepEqual(result.reports, []);
  } finally {
    if (previous === undefined) delete process.env.CI;
    else process.env.CI = previous;
  }
});
