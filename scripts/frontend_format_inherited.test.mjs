import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  classifyInheritedFormatting,
  createInheritedFormattingChecker,
  inheritedFormattingDigest as digest,
} from "./frontend_format_inherited.mjs";

const baseCommit = "d".repeat(40);
const baseSource = "const upstream = 1;   \n";
const candidateSource = baseSource + "const feature = true;\n";
const configSource = '{ "tabWidth": 4 }\n';
const edit = digest(
  JSON.stringify([["const upstream = 1;   "], ["const upstream = 1;"]]),
);
function fixture() {
  const record = {
    scope: "pr1",
    path: "frontend/app/fixture.ts",
    baseCommit,
    baseSha256: digest(baseSource),
    candidateSha256: digest(candidateSource),
    justification:
      "The exact upstream trailing whitespace is retained; feature code is formatted.",
    formatter: {
      prettierVersion: "3.8.4",
      sveltePluginVersion: "3.5.2",
      configSha256: digest(configSource),
    },
    proof: { baseEditSha256s: [edit], candidateEditSha256s: [edit] },
  };
  const registry = {
    schemaVersion: 1,
    normalization: "CRLF-to-LF-only",
    records: [record],
  };
  const input = {
    scope: record.scope,
    path: record.path,
    baseCommit,
    baseSource,
    candidateSource,
    formatter: {
      prettierVersion: "3.8.4",
      sveltePluginVersion: "3.5.2",
      configSource,
    },
  };
  return { registry, input };
}

test("accepts only the complete exact reviewed pair and reports its review identity", () => {
  const { registry, input } = fixture();
  const result = createInheritedFormattingChecker(registry)(input);
  assert.equal(result.accepted, true);
  assert.equal(result.reviewId, "pr1:frontend/app/fixture.ts");
  assert.equal(result.baseCommit, baseCommit);
  assert.equal(result.candidateSha256, digest(candidateSource));
  assert.match(result.justification, /exact upstream/);
});

test("allows Git CRLF checkout differences without trimming or broader normalization", () => {
  const { registry, input } = fixture();
  const check = createInheritedFormattingChecker(registry);
  assert.equal(
    check({
      ...input,
      baseSource: baseSource.replaceAll("\n", "\r\n"),
      candidateSource: candidateSource.replaceAll("\n", "\r\n"),
      formatter: {
        ...input.formatter,
        configSource: configSource.replaceAll("\n", "\r\n"),
      },
    }).accepted,
    true,
  );
  assert.notEqual(digest("a\rb"), digest("a\nb"));
  assert.notEqual(digest("a \n"), digest("a\n"));
  assert.throws(() => digest(new Uint8Array()), /must be text/);
});

const inputDrifts = [
  [
    "unknown path",
    (x) => {
      x.path = "frontend/app/another.ts";
    },
    "unreviewed-path",
  ],
  [
    "wrong slice",
    (x) => {
      x.scope = "pr2";
    },
    "unreviewed-path",
  ],
  [
    "unknown slice",
    (x) => {
      x.scope = "core";
    },
    "invalid-input",
  ],
  [
    "path traversal",
    (x) => {
      x.path = "frontend/app/../fixture.ts";
    },
    "invalid-input",
  ],
  [
    "Windows alternate spelling",
    (x) => {
      x.path = "frontend\\app\\fixture.ts";
    },
    "invalid-input",
  ],
  [
    "glob spelling",
    (x) => {
      x.path = "frontend/app/*.ts";
    },
    "invalid-input",
  ],
  [
    "base commit",
    (x) => {
      x.baseCommit = "e".repeat(40);
    },
    "base-commit-drift",
  ],
  [
    "missing base",
    (x) => {
      delete x.baseSource;
    },
    "missing-source",
  ],
  [
    "missing candidate",
    (x) => {
      delete x.candidateSource;
    },
    "missing-source",
  ],
  [
    "base content",
    (x) => {
      x.baseSource += "// changed\n";
    },
    "base-content-drift",
  ],
  [
    "candidate content",
    (x) => {
      x.candidateSource += "// changed\n";
    },
    "candidate-content-drift",
  ],
  [
    "candidate whitespace",
    (x) => {
      x.candidateSource += " ";
    },
    "candidate-content-drift",
  ],
  [
    "candidate missing newline",
    (x) => {
      x.candidateSource = x.candidateSource.trimEnd();
    },
    "candidate-content-drift",
  ],
  [
    "Prettier version",
    (x) => {
      x.formatter.prettierVersion = "3.8.5";
    },
    "formatter-version-drift",
  ],
  [
    "Svelte plugin version",
    (x) => {
      x.formatter.sveltePluginVersion = "3.5.3";
    },
    "formatter-version-drift",
  ],
  [
    "formatter config",
    (x) => {
      x.formatter.configSource += " ";
    },
    "formatter-config-drift",
  ],
  [
    "missing formatter",
    (x) => {
      delete x.formatter;
    },
    "missing-source",
  ],
];
for (const [name, mutate, reason] of inputDrifts) {
  test(`fails closed on ${name} drift`, () => {
    const { registry, input } = fixture();
    mutate(input);
    assert.deepEqual(createInheritedFormattingChecker(registry)(input), {
      accepted: false,
      reason,
    });
  });
}

test("does not trust an input-supplied digest in place of actual candidate text", () => {
  const { registry, input } = fixture();
  assert.equal(
    createInheritedFormattingChecker(registry)({
      ...input,
      candidateSource: "unreviewed",
      candidateSha256: digest(candidateSource),
    }).accepted,
    false,
  );
});

test("different slices may bind distinct reviewed candidate contents, never interchange them", () => {
  const { registry, input } = fixture();
  const pr2 = {
    ...structuredClone(registry.records[0]),
    scope: "pr2",
    candidateSha256: digest(candidateSource + "// pr2\n"),
  };
  registry.records.push(pr2);
  const check = createInheritedFormattingChecker(registry);
  assert.equal(check(input).accepted, true);
  assert.equal(check({ ...input, scope: "pr2" }).accepted, false);
  assert.equal(
    check({
      ...input,
      scope: "pr2",
      candidateSource: candidateSource + "// pr2\n",
    }).accepted,
    true,
  );
});

test("the checker owns a private snapshot of reviewed records", () => {
  const { registry, input } = fixture();
  const check = createInheritedFormattingChecker(registry);
  registry.records[0].candidateSha256 = digest("injected");
  registry.records[0].proof.candidateEditSha256s.push("f".repeat(64));
  registry.records.push({
    ...registry.records[0],
    path: "frontend/app/another.ts",
  });
  assert.equal(check(input).accepted, true);
  assert.equal(
    check({ ...input, candidateSource: "injected" }).accepted,
    false,
  );
  assert.equal(
    check({ ...input, path: "frontend/app/another.ts" }).accepted,
    false,
  );
});

const invalidRecords = [
  [
    "schema",
    (r) => {
      r.schemaVersion = 2;
    },
  ],
  [
    "normalization",
    (r) => {
      r.normalization = "trim-all-whitespace";
    },
  ],
  [
    "empty records",
    (r) => {
      r.records = [];
    },
  ],
  [
    "duplicate path",
    (r) => {
      r.records.push(structuredClone(r.records[0]));
    },
  ],
  [
    "path wildcard",
    (r) => {
      r.records[0].path = "frontend/**/*.ts";
    },
  ],
  [
    "short commit",
    (r) => {
      r.records[0].baseCommit = "df9d9ed";
    },
  ],
  [
    "missing candidate hash",
    (r) => {
      delete r.records[0].candidateSha256;
    },
  ],
  [
    "missing base hash",
    (r) => {
      delete r.records[0].baseSha256;
    },
  ],
  [
    "missing formatter identity",
    (r) => {
      delete r.records[0].formatter;
    },
  ],
  [
    "missing justification",
    (r) => {
      r.records[0].justification = "";
    },
  ],
  [
    "unknown format edit",
    (r) => {
      r.records[0].proof.candidateEditSha256s = ["f".repeat(64)];
    },
  ],
  [
    "extra occurrence of inherited edit",
    (r) => {
      r.records[0].proof.candidateEditSha256s.push(edit);
    },
  ],
  [
    "empty edit proof",
    (r) => {
      r.records[0].proof.candidateEditSha256s = [];
    },
  ],
];
for (const [name, mutate] of invalidRecords) {
  test(`rejects incomplete or broadened registry: ${name}`, () => {
    const { registry } = fixture();
    mutate(registry);
    assert.throws(
      () => createInheritedFormattingChecker(registry),
      /Invalid inherited formatting registry/,
    );
  });
}

test("the production checker uses only the finite committed five-record review", () => {
  const registry = JSON.parse(
    readFileSync(
      new URL("./frontend_format_inherited.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(registry.records.length, 5);
  assert.deepEqual(
    registry.records.map((r) => [r.scope, r.path]),
    [
      ["pr1", "frontend/app/src/components_mobile/onboard/OnboardModal.svelte"],
      ["pr1", "frontend/app/src/stores/settings.ts"],
      ["pr1", "frontend/openchat-client/src/openchat.ts"],
      ["pr2", "frontend/app/src/stores/settings.ts"],
      ["pr2", "frontend/openchat-client/src/state/app/stores.ts"],
    ],
  );
  for (const record of registry.records) {
    assert.equal(record.baseCommit, "df9d9ed52db00e87fbb7309280a325902c9bb2cc");
    assert.equal(record.formatter.prettierVersion, "3.8.4");
    assert.equal(record.formatter.sveltePluginVersion, "3.5.2");
  }
  assert.equal(classifyInheritedFormatting(fixture().input).accepted, false);
});
