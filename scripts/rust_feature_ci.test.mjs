import assert from "node:assert/strict";
import test from "node:test";
import {
  assessRustFeatureCi,
  parseRustFeatureCiArgs,
} from "./rust_feature_ci.mjs";

function evidence() {
  const digest = "a".repeat(64);
  return {
    collection: {
      collectionPassed: true,
      collectionProducerExecuted: true,
      producerKind: "installed-cargo",
      sourceUnchanged: true,
      rootCompletenessVerified: true,
      completeness: { status: "complete", unresolved: [] },
      officialSbomSchemaValidated: true,
      sbom: { sha256: digest },
      collection: { sha256: "b".repeat(64) },
    },
    sbomValidation: { officialSbomSchemaValidated: true, sha256: digest },
    advisory: {
      status: "completed",
      capture: {
        kind: "node-https",
        currentInvocationOnly: true,
        attemptedRequests: 1,
        completedRequests: 1,
      },
      networkRequestsPerformed: true,
      inputsUnchanged: true,
      transportAuthenticityVerified: true,
      responsesComplete: true,
      selectedNoKnownFindings: true,
      registryResponsesComplete: true,
      selectedRegistryNoKnownFindings: true,
      findings: [],
      unqueried: [],
      binding: { collectionSha256: "b".repeat(64) },
    },
  };
}

test("requirement assessment can pass complete evidence but never qualifies the overall release", () => {
  // Synthetic policy input only, not a claim that current configs are complete.
  const result = assessRustFeatureCi(evidence());
  assert.equal(result.passed, true);
  assert.deepEqual(result.nonAcceptanceReasons, []);
  assert.equal(result.releaseAcceptance, false);
  assert.equal(result.wholeRepositoryCoverage, false);
});

test("legacy registry-only flags cannot qualify unverified Git results", () => {
  const input = evidence();
  delete input.advisory.responsesComplete;
  delete input.advisory.selectedNoKnownFindings;
  const result = assessRustFeatureCi(input);
  assert.equal(result.passed, false);
  assert(result.nonAcceptanceReasons.includes("advisories-not-verified"));
});

for (const [name, mutate, reason] of [
  [
    "missing collector",
    (v) => {
      delete v.collection;
    },
    "collection-not-verified",
  ],
  [
    "partial collection",
    (v) => {
      v.collection.collectionPassed = false;
    },
    "collection-not-verified",
  ],
  [
    "no producer",
    (v) => {
      v.collection.collectionProducerExecuted = false;
    },
    "collection-not-verified",
  ],
  [
    "fixture producer",
    (v) => {
      v.collection.producerKind = "offline-fixture";
    },
    "collection-not-verified",
  ],
  [
    "changed source",
    (v) => {
      v.collection.sourceUnchanged = false;
    },
    "collection-not-verified",
  ],
  [
    "incomplete roots",
    (v) => {
      v.collection.rootCompletenessVerified = false;
    },
    "incomplete-feature-scope",
  ],
  [
    "incomplete declaration",
    (v) => {
      v.collection.completeness.status = "incomplete";
    },
    "incomplete-feature-scope",
  ],
  [
    "missing unresolved list",
    (v) => {
      delete v.collection.completeness.unresolved;
    },
    "incomplete-feature-scope",
  ],
  [
    "unresolved gap",
    (v) => {
      v.collection.completeness.unresolved.push({ id: "missing-owner" });
    },
    "incomplete-feature-scope",
  ],
  [
    "missing SBOM validation",
    (v) => {
      delete v.sbomValidation;
    },
    "sbom-not-verified",
  ],
  [
    "collector skipped schema",
    (v) => {
      v.collection.officialSbomSchemaValidated = false;
    },
    "sbom-not-verified",
  ],
  [
    "failed schema",
    (v) => {
      v.sbomValidation.officialSbomSchemaValidated = false;
    },
    "sbom-not-verified",
  ],
  [
    "different SBOM",
    (v) => {
      v.sbomValidation.sha256 = "c".repeat(64);
    },
    "sbom-not-verified",
  ],
  [
    "missing advisory",
    (v) => {
      delete v.advisory;
    },
    "advisories-not-verified",
  ],
  [
    "failed capture",
    (v) => {
      v.advisory.status = "failed";
    },
    "advisories-not-verified",
  ],
  [
    "offline transport",
    (v) => {
      v.advisory.capture.kind = "offline-fixture";
    },
    "advisories-not-verified",
  ],
  [
    "replayed capture",
    (v) => {
      v.advisory.capture.currentInvocationOnly = false;
    },
    "advisories-not-verified",
  ],
  [
    "changed advisory inputs",
    (v) => {
      v.advisory.inputsUnchanged = false;
    },
    "advisories-not-verified",
  ],
  [
    "unverified TLS",
    (v) => {
      v.advisory.transportAuthenticityVerified = false;
    },
    "advisories-not-verified",
  ],
  [
    "no network execution",
    (v) => {
      v.advisory.networkRequestsPerformed = false;
    },
    "advisories-not-verified",
  ],
  [
    "zero requests",
    (v) => {
      v.advisory.capture.completedRequests = 0;
    },
    "advisories-not-verified",
  ],
  [
    "incomplete request",
    (v) => {
      v.advisory.capture.attemptedRequests = 2;
    },
    "advisories-not-verified",
  ],
  [
    "incomplete pagination",
    (v) => {
      v.advisory.responsesComplete = false;
    },
    "advisories-not-verified",
  ],
  [
    "known finding flag",
    (v) => {
      v.advisory.selectedNoKnownFindings = false;
    },
    "advisories-not-verified",
  ],
  [
    "finding despite pass flag",
    (v) => {
      v.advisory.findings.push({ id: "TEST-1" });
    },
    "advisories-not-verified",
  ],
  [
    "missing findings",
    (v) => {
      delete v.advisory.findings;
    },
    "advisories-not-verified",
  ],
  [
    "missing unqueried list",
    (v) => {
      delete v.advisory.unqueried;
    },
    "unqueried-source-identities",
  ],
  [
    "unqueried Git source",
    (v) => {
      v.advisory.unqueried.push({
        source: "git+https://example.invalid/repo#rev",
      });
    },
    "unqueried-source-identities",
  ],
  [
    "different collection",
    (v) => {
      v.advisory.binding.collectionSha256 = "c".repeat(64);
    },
    "advisory-collection-mismatch",
  ],
])
  test("scoped CI rejects " + name, () => {
    const value = evidence();
    mutate(value);
    const result = assessRustFeatureCi(value);
    assert.equal(result.passed, false);
    assert.ok(result.nonAcceptanceReasons.includes(reason));
    assert.equal(result.releaseAcceptance, false);
  });

test("missing evidence is never successful or downgraded to a collection-only pass", () => {
  assert.equal(assessRustFeatureCi({}).passed, false);
});

test("CLI requires exact explicit scope, producer, pin and executable mode", () => {
  const argv = [
    "--repository-root",
    process.cwd(),
    "--scope",
    "pr1",
    "--config-sha256",
    "a".repeat(64),
    "--output-directory",
    process.cwd(),
    "--cargo-executable",
    process.execPath,
    "--mode",
    "check-scoped",
  ];
  assert.equal(parseRustFeatureCiArgs(argv).mode, "check-scoped");
  for (const changed of [
    argv.slice(0, -2),
    [...argv, "--allow-incomplete", "true"],
    argv.map((v) => (v === "check-scoped" ? "collect-offline" : v)),
    argv.map((v) => (v === "check-scoped" ? "plan" : v)),
    argv.map((v) => (v === "pr1" ? "whole-repository" : v)),
    argv.map((v) => (v === "a".repeat(64) ? "bad-hash" : v)),
    argv.map((v) => (v === "--mode" ? "--scope" : v)),
  ])
    assert.throws(() => parseRustFeatureCiArgs(changed));
});
