import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { planRustFeatureAdvisories } from "./rust_feature_advisories.mjs";
import {
  validateRustFeatureAdvisoryResults,
  RUST_ADVISORY_RESULT_LIMITS,
} from "./rust_feature_advisory_results.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const registry = "registry+https://github.com/rust-lang/crates.io-index";
function profiles({ gitOnly = false, otherRegistry = false } = {}) {
  const packages = ["alpha", "beta"].map((name) => {
    const source = gitOnly
      ? `git+https://github.com/example/${name}?rev=${"a".repeat(40)}#${"a".repeat(40)}`
      : otherRegistry
        ? "registry+https://registry.example.test/index"
        : registry;
    return {
      key: JSON.stringify([name, "1.2.3", source]),
      name,
      version: "1.2.3",
      source,
      checksum: gitOnly ? null : "a".repeat(64),
      manifest: null,
      resolvedFeatures: [],
      provenance: [{ seed: name, context: "production" }],
    };
  });
  const reportJson = JSON.stringify({
    schemaVersion: 1,
    assessment: "offline-selected-external-dependency-closure",
    rootCompletenessVerified: false,
    advisoryChecksPerformed: false,
    featurePrecision: "workspace-wide-resolved-feature-union-overapproximation",
    profile: { target: "x86_64-pc-windows-msvc", features: [] },
    limitations: ["Caller-selected roots are not completeness verified."],
    identity: {
      metadataSha256: "a".repeat(64),
      cargoLockSha256: "b".repeat(64),
      manifestSha256: {
        "Cargo.toml": "c".repeat(64),
        "native/Cargo.toml": "d".repeat(64),
      },
    },
    roots: packages.map((pkg) => ({
      id: pkg.name,
      ownerManifest: "native/Cargo.toml",
      ownerPackage: "native",
      dependencyName: pkg.name,
      kind: "normal",
      originContext: "production",
      target: null,
      package: pkg.key,
      requestedFeatures: [],
      usesDefaultFeatures: true,
      optional: false,
    })),
    packages,
    edges: [],
  });
  return [
    { id: "pr2/windows-default", reportJson, sha256: digest(reportJson) },
  ];
}
function entry(body, response) {
  const requestJson = JSON.stringify(body);
  const responseJson = JSON.stringify(response);
  return {
    method: "POST",
    url: "https://api.osv.dev/v1/querybatch",
    status: 200,
    requestJson,
    requestSha256: digest(requestJson),
    responseJson,
    responseSha256: digest(responseJson),
  };
}
function fixture() {
  const inputs = profiles();
  const body = planRustFeatureAdvisories(inputs).request.body;
  return { inputs, body, transcript: [entry(body, { results: [{}, {}] })] };
}
function reject(mutate, message) {
  const f = fixture();
  mutate(f);
  assert.throws(
    () => validateRustFeatureAdvisoryResults(f.inputs, f.transcript),
    message,
  );
}
const finding = {
  id: "RUSTSEC-2026-0001",
  modified: "2026-09-09T12:34:56.123456Z",
};

test("complete empty registry responses are not a security or release pass", () => {
  const { inputs, transcript } = fixture();
  const before = JSON.stringify({ inputs, transcript });
  const result = validateRustFeatureAdvisoryResults(inputs, transcript);
  assert.equal(result.registryResponsesComplete, true);
  assert.equal(result.responsesComplete, true);
  assert.equal(result.selectedNoKnownFindings, true);
  assert.equal(result.selectedRegistryNoKnownFindings, true);
  assert.equal(result.findings.length, 0);
  for (const field of [
    "passed",
    "releaseAcceptance",
    "rootCompletenessVerified",
    "wholeRepositoryCoverage",
    "freshnessVerified",
    "transportAuthenticityVerified",
    "networkRequestsPerformed",
  ])
    assert.equal(result[field], false, field);
  assert.equal(result.profiles[0].reportSha256, inputs[0].sha256);
  assert.equal(
    result.transcript[0].responseSha256,
    transcript[0].responseSha256,
  );
  assert.equal(JSON.stringify({ inputs, transcript }), before);
});

test("known findings bind the exact query and conservatively remain nonpass", () => {
  const { inputs, body } = fixture();
  const result = validateRustFeatureAdvisoryResults(inputs, [
    entry(body, { results: [{}, { vulns: [finding] }] }),
  ]);
  assert.equal(result.selectedRegistryNoKnownFindings, false);
  assert.equal(result.passed, false);
  assert.deepEqual(result.findings, [
    { queryIndex: 1, name: "beta", version: "1.2.3", ...finding },
  ]);
});

test("ordered pending queries exhaust token-only pages without requerying completed items", () => {
  const { inputs, body } = fixture();
  const transcript = [
    entry(body, {
      results: [{ next_page_token: "a" }, { next_page_token: "b" }],
    }),
    entry(
      {
        queries: [
          { ...body.queries[0], page_token: "a" },
          { ...body.queries[1], page_token: "b" },
        ],
      },
      { results: [{}, { next_page_token: "c" }] },
    ),
    entry(
      { queries: [{ ...body.queries[1], page_token: "c" }] },
      { results: [{ vulns: [finding] }] },
    ),
  ];
  const result = validateRustFeatureAdvisoryResults(inputs, transcript);
  assert.equal(result.registryResponsesComplete, true);
  assert.deepEqual(
    result.transcript.map((round) => round.queryIndices),
    [[0, 1], [0, 1], [1]],
  );
  assert.equal(result.findings[0].queryIndex, 1);
});

test("nonregistry-only inputs require no transcript and cannot vacuously pass", () => {
  const result = validateRustFeatureAdvisoryResults(
    profiles({ otherRegistry: true }),
    [],
  );
  assert.equal(result.selected.length, 0);
  assert.equal(result.unqueried.length, 2);
  assert.equal(result.selectedRegistryNoKnownFindings, false);
  assert.equal(result.passed, false);
  assert.ok(result.unqueried.every((p) => p.advisoryCoverage === "not-proven"));
});

test("Git-only empty results require real transcript entries and do not prove index coverage", () => {
  const inputs = profiles({ gitOnly: true });
  const body = planRustFeatureAdvisories(inputs).request.body;
  assert.throws(
    () => validateRustFeatureAdvisoryResults(inputs, []),
    /missing initial response/u,
  );
  const result = validateRustFeatureAdvisoryResults(inputs, [
    entry(body, { results: [{}, {}] }),
  ]);
  assert.equal(result.responsesComplete, true);
  assert.equal(result.selectedNoKnownFindings, true);
  assert.equal(result.selectedRegistryNoKnownFindings, false);
  assert.equal(result.gitIndexCoverageVerified, false);
  assert.equal(result.passed, false);
  assert.deepEqual(result.unqueried, []);
});

test("mixed-source pagination binds Git findings even when every registry result is empty", () => {
  const gitInputs = profiles({ gitOnly: true });
  gitInputs[0].id = "pr2/git";
  const inputs = [...profiles(), ...gitInputs];
  const plan = planRustFeatureAdvisories(inputs);
  const index = plan.selected.find(
    (item) => item.sourceClass === "git",
  ).queryIndex;
  const results = plan.selected.map((_, i) =>
    i === index ? { next_page_token: "git-page" } : {},
  );
  const result = validateRustFeatureAdvisoryResults(inputs, [
    entry(plan.request.body, { results }),
    entry(
      {
        queries: [
          { ...plan.request.body.queries[index], page_token: "git-page" },
        ],
      },
      { results: [{ vulns: [finding] }] },
    ),
  ]);
  assert.equal(result.selectedRegistryNoKnownFindings, true);
  assert.equal(result.selectedNoKnownFindings, false);
  assert.equal(result.responsesComplete, true);
  assert.deepEqual(result.findings, [
    {
      queryIndex: index,
      name: plan.selected[index].name,
      version: "1.2.3",
      sourceClass: "git",
      source: plan.selected[index].source,
      commit: "a".repeat(40),
      ...finding,
    },
  ]);
});

test("a rehashed Git transcript cannot replace the commit or add registry version fields", () => {
  const inputs = profiles({ gitOnly: true });
  for (const mutate of [
    (query) => {
      query.commit = "b".repeat(40);
    },
    (query) => {
      query.version = "1.2.3";
    },
    (query) => {
      delete query.commit;
      query.package = { ecosystem: "crates.io", name: "alpha" };
      query.version = "1.2.3";
    },
  ]) {
    const body = structuredClone(
      planRustFeatureAdvisories(inputs).request.body,
    );
    mutate(body.queries[0]);
    assert.throws(
      () =>
        validateRustFeatureAdvisoryResults(inputs, [
          entry(body, { results: [{}, {}] }),
        ]),
      /ordered request/u,
    );
  }
});

test("the supplied profile bytes, request bytes and response bytes must match their pins", () => {
  for (const field of ["requestSha256", "responseSha256"])
    reject((f) => {
      f.transcript[0][field] = "0".repeat(64);
    }, /SHA-256 mismatch/);
  reject((f) => {
    f.inputs[0].sha256 = "0".repeat(64);
  }, /SHA-256 mismatch/);
});

test("reordered, substituted, injected or incomplete query bodies fail even when rehashed", () => {
  for (const alter of [
    (b) => b.queries.reverse(),
    (b) => {
      b.queries[0].package.ecosystem = "npm";
    },
    (b) => {
      b.queries[0].version = "9.9.9";
    },
    (b) => b.queries.pop(),
    (b) => {
      b.limit = 1;
    },
    (b) => {
      b.queries[0].page_token = "unsolicited";
    },
  ])
    reject((f) => {
      alter(f.body);
      f.transcript[0] = entry(f.body, { results: [{}, {}] });
    }, /ordered request/);
});

test("pagination cannot be omitted, repeated, looped or continued after completion", () => {
  reject((f) => {
    f.transcript = [];
  }, /missing initial response/);
  reject((f) => {
    f.transcript[0] = entry(f.body, {
      results: [{ next_page_token: "a" }, {}],
    });
  }, /Incomplete pagination/);
  reject((f) => {
    f.transcript.push(f.transcript[0]);
  }, /Extra transcript/);
  reject((f) => {
    f.transcript[0] = entry(f.body, {
      results: [{ next_page_token: "a" }, {}],
    });
    f.transcript.push(
      entry(
        { queries: [{ ...f.body.queries[0], page_token: "a" }] },
        { results: [{ next_page_token: "a" }] },
      ),
    );
  }, /Repeated pagination token/);
  reject((f) => {
    f.transcript[0] = entry(f.body, {
      results: [{ next_page_token: "a" }, {}],
    });
    f.transcript.push(entry(f.body, { results: [{}, {}] }));
  }, /ordered request/);
});

test("HTTP failures and unrecognized transport envelope fields fail closed", () => {
  for (const [field, value] of [
    ["status", 429],
    ["method", "GET"],
    ["url", "https://example.test"],
    ["redirected", true],
  ])
    reject((f) => {
      f.transcript[0][field] = value;
    }, /HTTP|method|URL|fields/);
});

test("malformed result shapes, errors, lengths and extra fields fail closed", () => {
  for (const response of [
    null,
    [],
    { error: "unavailable" },
    { results: [] },
    { results: [{}, {}, {}] },
    { results: [null, {}] },
    { results: [{ error: "partial" }, {}] },
    { results: [{ vulns: null }, {}] },
    { results: [{ next_page_token: "" }, {}] },
    { results: [{ vulns: [], unexpected: true }, {}] },
  ])
    reject((f) => {
      f.transcript[0] = entry(f.body, response);
    }, /response|result|fields|vulns|token/);
});

test("vulnerability identities, timestamps and per-query duplicates are strict", () => {
  for (const vulns of [
    [{}],
    [{ id: finding.id }],
    [{ ...finding, id: "bad\nvalue" }],
    [{ ...finding, modified: "2026-02-30T00:00:00Z" }],
    [{ ...finding, modified: "2026-09-09" }],
    [{ ...finding, severity: "LOW" }],
    [finding, finding],
  ])
    reject((f) => {
      f.transcript[0] = entry(f.body, { results: [{ vulns }, {}] });
    }, /vulnerability|modified|fields|Duplicate finding/);
  const { inputs, body } = fixture();
  assert.equal(
    validateRustFeatureAdvisoryResults(inputs, [
      entry(body, { results: [{ vulns: [finding] }, { vulns: [finding] }] }),
    ]).findings.length,
    2,
  );
});

test("duplicate JSON keys including escaped equivalents cannot hide errors or query changes", () => {
  for (const responseJson of [
    '{"results":[{},{}],"results":[{},{}]}',
    '{"results":[{"vulns":[],"vul\\u006es":[]},{}]}',
  ])
    reject((f) => {
      Object.assign(f.transcript[0], {
        responseJson,
        responseSha256: digest(responseJson),
      });
    }, /Duplicate JSON key/);
  reject((f) => {
    const requestJson = f.transcript[0].requestJson.replace(
      '"ecosystem":"crates.io"',
      '"ecosystem":"npm","ecosystem":"crates.io"',
    );
    Object.assign(f.transcript[0], {
      requestJson,
      requestSha256: digest(requestJson),
    });
  }, /Duplicate JSON key/);
  reject((f) => {
    const reportJson = f.inputs[0].reportJson.replace(
      '"schemaVersion":1',
      '"schemaVersion":0,"schemaVersion":1',
    );
    Object.assign(f.inputs[0], { reportJson, sha256: digest(reportJson) });
  }, /Duplicate JSON key/);
});

test("invalid UTF-8, malformed JSON and resource limits reject before acceptance", () => {
  for (const responseJson of [
    Buffer.from([0xff]),
    "{",
    "[".repeat(65) + "0" + "]".repeat(65),
    " ".repeat(RUST_ADVISORY_RESULT_LIMITS.responseBytes + 1),
  ])
    reject((f) => {
      Object.assign(f.transcript[0], {
        responseJson,
        responseSha256: digest(responseJson),
      });
    }, /utf-8|JSON|depth|byte limit/i);
  reject((f) => {
    f.transcript = Array(RUST_ADVISORY_RESULT_LIMITS.rounds + 1).fill(
      f.transcript[0],
    );
  }, /round limit/);
  reject((f) => {
    f.transcript[0] = entry(f.body, {
      results: [
        {
          next_page_token: "a".repeat(
            RUST_ADVISORY_RESULT_LIMITS.tokenBytes + 1,
          ),
        },
        {},
      ],
    });
  }, /pagination token/);
});

test("pagination has aggregate byte and finding limits, not only per-page limits", () => {
  reject((f) => {
    f.transcript = Array.from({ length: 9 }, (_, index) => {
      const queries =
        index === 0
          ? f.body.queries
          : [{ ...f.body.queries[0], page_token: String(index) }];
      const results = [
        { next_page_token: String(index + 1) },
        ...(index === 0 ? [{}] : []),
      ];
      const round = entry({ queries }, { results });
      round.responseJson += " ".repeat(
        RUST_ADVISORY_RESULT_LIMITS.responseBytes -
          Buffer.byteLength(round.responseJson),
      );
      round.responseSha256 = digest(round.responseJson);
      return round;
    });
  }, /Transcript byte limit/);
  reject((f) => {
    const vulns = Array.from(
      { length: RUST_ADVISORY_RESULT_LIMITS.findings },
      (_, index) => ({ ...finding, id: `RUSTSEC-${index}` }),
    );
    f.transcript[0] = entry(f.body, {
      results: [{ vulns }, { vulns: [finding] }],
    });
  }, /Finding count limit/);
});

test("offline validation succeeds with networking disabled and does not modify globals", () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    assert.fail("No advisory network call is authorized");
  };
  try {
    const { inputs, transcript } = fixture();
    assert.equal(
      validateRustFeatureAdvisoryResults(inputs, transcript)
        .networkRequestsPerformed,
      false,
    );
  } finally {
    globalThis.fetch = original;
  }
});
