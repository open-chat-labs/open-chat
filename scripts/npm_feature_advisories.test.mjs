import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  BULK_URL,
  planFeatureAdvisories as planWithSemver,
  evaluateFeatureAdvisories,
  fetchFeatureAdvisories,
  parseFeatureAdvisoryArgs,
} from "./npm_feature_advisories.mjs";
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const semver = require("semver");
const planFeatureAdvisories = (inventories) =>
  planWithSemver(inventories, semver);

function pkg(name, version = "1.2.3") {
  return {
    location: `node_modules/${name}`,
    name,
    version,
    resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
    integrity: "sha512-YQ==",
  };
}
function inventory(scopeId = "pr1-model-npm") {
  const items = [pkg("model-runtime")];
  return {
    schemaVersion: 1,
    status: "draft",
    scopeId,
    packages: items,
    supplementaryPeerGraph: {
      packages: [...items, pkg("optional-build-peer")],
      peerDiagnostics: [],
    },
  };
}
function advisory(overrides = {}) {
  return {
    id: 123,
    name: "model-runtime",
    title: "Synthetic regression only",
    severity: "moderate",
    url: "https://github.com/advisories/GHSA-test-test-test",
    vulnerable_versions: ">=1.0.0 <1.2.4",
    ...overrides,
  };
}

test("plans only selected registry releases and separately labels local and peer packages", () => {
  const data = inventory();
  data.supplementaryPeerGraph.packages.push({
    location: "local-model-bridge",
    name: "private-local-name",
    version: "1.0.0",
    resolved: null,
    integrity: null,
  });
  const plan = planFeatureAdvisories([data]);
  assert.deepEqual(plan.payload, {
    "model-runtime": ["1.2.3"],
    "optional-build-peer": ["1.2.3"],
  });
  assert.equal(plan.local.length, 1);
  assert(!JSON.stringify(plan.payload).includes("private-local-name"));
  assert.equal(plan.selected[1].graph, "peer-supplement");
  assert.equal(plan.wholeRepositoryCoverage, false);
});

test("composes inherited model and app scopes without dropping another selected version", () => {
  const app = inventory("pr2-app-card-ocr-npm");
  app.supplementaryPeerGraph.packages.push({
    ...pkg("model-runtime", "2.0.0"),
    location: "node_modules/app-adapter/node_modules/model-runtime",
  });
  const plan = planFeatureAdvisories([inventory(), app]);
  assert.deepEqual(plan.payload["model-runtime"], ["1.2.3", "2.0.0"]);
});

for (const [label, mutate] of [
  ["unreviewed source scope", (v) => (v.scopeId = "whole-core")],
  ["false inventory approval", (v) => (v.status = "approved")],
  [
    "Git release masquerading as npm",
    (v) =>
      (v.supplementaryPeerGraph.packages[0].resolved =
        "https://github.com/org/repo"),
  ],
  [
    "credentials in artifact URL",
    (v) =>
      (v.supplementaryPeerGraph.packages[0].resolved =
        "https://user:pass@registry.npmjs.org/x"),
  ],
  [
    "missing artifact integrity",
    (v) => (v.supplementaryPeerGraph.packages[0].integrity = null),
  ],
])
  test(`rejects ${label} before a request`, () => {
    const data = inventory();
    mutate(data);
    assert.throws(() => planFeatureAdvisories([data]));
  });

test("empty bulk result is limited no-known-advisory evidence, not whole-repository approval", () => {
  const result = evaluateFeatureAdvisories(
    planFeatureAdvisories([inventory()]),
    {},
    semver,
  );
  assert.equal(result.knownAdvisoriesPass, true);
  assert.equal(result.wholeRepositoryCoverage, false);
  assert.equal(result.peerCompatibilityVerified, false);
  assert.equal(result.remediationPerformed, false);
});

test("exact affected releases fail at every severity and retain owning graph paths", () => {
  const plan = planFeatureAdvisories([inventory()]);
  for (const severity of ["info", "low", "moderate", "high", "critical"]) {
    const result = evaluateFeatureAdvisories(
      plan,
      { "model-runtime": [advisory({ severity })] },
      semver,
    );
    assert.equal(result.knownAdvisoriesPass, false);
    assert.deepEqual(result.findings[0].versions, ["1.2.3"]);
    assert.equal(result.findings[0].contexts[0].scopeId, "pr1-model-npm");
  }
  assert.equal(
    evaluateFeatureAdvisories(
      plan,
      { "model-runtime": [advisory({ vulnerable_versions: "<1.0.0" })] },
      semver,
    ).knownAdvisoriesPass,
    true,
  );
});

for (const [label, response] of [
  ["array", []],
  ["null", null],
  ["unrequested package", { "core-only-package": [] }],
  ["wrong name", { "model-runtime": [advisory({ name: "something-else" })] }],
  [
    "invalid range",
    { "model-runtime": [advisory({ vulnerable_versions: "not-semver" })] },
  ],
  ["unknown severity", { "model-runtime": [advisory({ severity: "none" })] }],
  ["duplicate id", { "model-runtime": [advisory(), advisory()] }],
  [
    "non-HTTPS advisory link",
    { "model-runtime": [advisory({ url: "http://example.test" })] },
  ],
])
  test(`fails closed on ${label}`, () => {
    assert.throws(() =>
      evaluateFeatureAdvisories(
        planFeatureAdvisories([inventory()]),
        response,
        semver,
      ),
    );
  });

test("makes exactly one anonymous bulk POST with selected name/version pairs only", async () => {
  const payload = planFeatureAdvisories([inventory()]).payload;
  const calls = [];
  const result = await fetchFeatureAdvisories(
    payload,
    semver,
    async (url, options) => {
      calls.push({ url, options });
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, BULK_URL);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.credentials, "omit");
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);
  assert.deepEqual(Object.keys(calls[0].options.headers).sort(), [
    "Accept",
    "Content-Type",
  ]);
  assert.match(result.requestSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.response, {});
});

for (const [label, create] of [
  ["HTTP error", () => new Response("{}", { status: 503 })],
  [
    "redirect",
    () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://example.test" },
      }),
  ],
  [
    "HTML",
    () => new Response("<html>", { headers: { "content-type": "text/html" } }),
  ],
  [
    "invalid JSON",
    () =>
      new Response("{", { headers: { "content-type": "application/json" } }),
  ],
  [
    "over-limit declared response",
    () =>
      new Response("{}", {
        headers: {
          "content-type": "application/json",
          "content-length": "4194305",
        },
      }),
  ],
  [
    "over-limit streamed response",
    () =>
      new Response(" ".repeat(4194305), {
        headers: { "content-type": "application/json" },
      }),
  ],
  [
    "malformed UTF-8",
    () =>
      new Response(new Uint8Array([0xff]), {
        headers: { "content-type": "application/json" },
      }),
  ],
])
  test(`never falls back after ${label}`, async () => {
    let calls = 0;
    await assert.rejects(
      fetchFeatureAdvisories(
        { "model-runtime": ["1.2.3"] },
        semver,
        async () => {
          calls++;
          return create();
        },
      ),
    );
    assert.equal(calls, 1);
  });

test("requires explicit scope, runtime, output and a separate query mode", () => {
  const args = [
    "--repository-root",
    "/repo",
    "--scope",
    "pr1",
    "--arborist-path",
    "/npm/arborist",
    "--output-directory",
    "/temp",
    "--mode",
    "plan",
  ];
  assert.equal(parseFeatureAdvisoryArgs(args).queryBulk, false);
  assert.equal(
    parseFeatureAdvisoryArgs([...args.slice(0, -1), "query-bulk"]).queryBulk,
    true,
  );
  assert.throws(() => parseFeatureAdvisoryArgs([]));
  assert.throws(() =>
    parseFeatureAdvisoryArgs([...args.slice(0, -1), "audit"]),
  );
  assert.throws(() =>
    parseFeatureAdvisoryArgs([...args, "--fallback", "quick"]),
  );
});
