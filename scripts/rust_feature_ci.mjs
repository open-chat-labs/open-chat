// Executable scoped Rust CI composition. No installation, broad audit, scope
// waiver or release approval. An incomplete source review stops before egress.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectRustFeatureMetadata,
  collectRustFeatureMetadataFixture,
  prepareRustFeatureCollection,
} from "./rust_feature_collection.mjs";
import {
  runRustFeatureAdvisories,
  runRustFeatureAdvisoryFixture,
} from "./rust_feature_advisory_runner.mjs";
import { validateRustFeatureSbom } from "./rust_feature_sbom_validate.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const decode = (bytes) =>
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const keys = (value) => Object.keys(value).sort();
const within = (root, path) => {
  const rel = relative(root, path);
  return (
    rel &&
    !isAbsolute(rel) &&
    rel !== ".." &&
    !rel.startsWith("../") &&
    !rel.startsWith("..\\")
  );
};

export function assessRustFeatureCi({ collection, advisory, sbomValidation }) {
  const reasons = [];
  if (
    collection?.collectionPassed !== true ||
    collection.collectionProducerExecuted !== true ||
    collection.producerKind !== "installed-cargo" ||
    collection.sourceUnchanged !== true
  )
    reasons.push("collection-not-verified");
  if (
    collection?.rootCompletenessVerified !== true ||
    collection.completeness?.status !== "complete" ||
    !Array.isArray(collection.completeness?.unresolved) ||
    collection.completeness.unresolved.length !== 0
  )
    reasons.push("incomplete-feature-scope");
  if (
    collection?.officialSbomSchemaValidated !== true ||
    sbomValidation?.officialSbomSchemaValidated !== true ||
    sbomValidation.sha256 !== collection?.sbom?.sha256
  )
    reasons.push("sbom-not-verified");
  if (
    advisory?.status !== "completed" ||
    advisory.capture?.kind !== "node-https" ||
    advisory.capture?.currentInvocationOnly !== true ||
    advisory.networkRequestsPerformed !== true ||
    !Number.isSafeInteger(advisory.capture?.completedRequests) ||
    advisory.capture.completedRequests < 1 ||
    advisory.capture.attemptedRequests !== advisory.capture.completedRequests ||
    advisory.inputsUnchanged !== true ||
    advisory.transportAuthenticityVerified !== true ||
    advisory.responsesComplete !== true ||
    advisory.selectedNoKnownFindings !== true ||
    !Array.isArray(advisory.findings) ||
    advisory.findings.length !== 0
  )
    reasons.push("advisories-not-verified");
  if (!Array.isArray(advisory?.unqueried) || advisory.unqueried.length !== 0)
    reasons.push("unqueried-source-identities");
  if (advisory?.binding?.collectionSha256 !== collection?.collection?.sha256)
    reasons.push("advisory-collection-mismatch");
  return {
    assessment: "scoped-rust-ci-requirements",
    passed: reasons.length === 0,
    nonAcceptanceReasons: reasons,
    // This gate does not attest runtime accuracy, license notices, APKs, final
    // PR heads, or anything else required by the overall release decision.
    releaseAcceptance: false,
    wholeRepositoryCoverage: false,
  };
}

export function parseRustFeatureCiArgs(argv) {
  const names = {
    "--repository-root": "repositoryRoot",
    "--scope": "scope",
    "--config-sha256": "configSha256",
    "--output-directory": "outputDirectory",
    "--cargo-executable": "cargoExecutable",
    "--mode": "mode",
  };
  assert(
    Array.isArray(argv) && argv.length === 12,
    "All six explicit scoped CI argument pairs are required",
  );
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = names[argv[i]];
    assert(
      name &&
        !Object.hasOwn(args, name) &&
        typeof argv[i + 1] === "string" &&
        argv[i + 1],
      "Unknown/duplicate scoped CI argument",
    );
    args[name] = argv[i + 1];
  }
  validateArgs(args);
  return args;
}
function validateArgs(args) {
  assert.deepEqual(keys(args), [
    "cargoExecutable",
    "configSha256",
    "mode",
    "outputDirectory",
    "repositoryRoot",
    "scope",
  ]);
  assert(["pr1", "pr2"].includes(args.scope));
  assert.equal(
    args.mode,
    "check-scoped",
    "Explicit scoped CI mode required; no plan-only or broad-audit fallback",
  );
  assert.match(args.configSha256, /^[a-f0-9]{64}$/u);
  for (const name of ["repositoryRoot", "outputDirectory", "cargoExecutable"])
    assert(isAbsolute(args[name]), "Absolute scoped CI path required");
}

async function run(args, collect, capture, kind) {
  validateArgs(args);
  const collectionArgs = { ...args, mode: "collect-offline" };
  // Reject stale/missing sources, unsafe paths and proxies before subprocesses,
  // evidence creation or network activity. This reuses the actual producer rules.
  const prepared = prepareRustFeatureCollection(collectionArgs);
  const directory = mkdtempSync(join(prepared.output, "rust-feature-ci-"));
  const identity = lstatSync(directory, { bigint: true });
  const verifyOutput = () => {
    const current = lstatSync(directory, { bigint: true });
    assert(
      !current.isSymbolicLink() &&
        current.isDirectory() &&
        current.dev === identity.dev &&
        current.ino === identity.ino &&
        realpathSync(directory) === directory,
      "Owned CI output directory changed",
    );
  };
  const readBound = (record) => {
    assert(
      record && isAbsolute(record.path) && within(directory, record.path),
      "CI evidence escaped its invocation directory",
    );
    let current = record.path;
    while (current !== directory) {
      assert(!lstatSync(current).isSymbolicLink(), "Linked CI evidence");
      current = resolve(current, "..");
    }
    const stat = lstatSync(record.path);
    assert(
      stat.isFile() &&
        stat.size === record.bytes &&
        stat.size <= 32 * 1024 * 1024,
      "Invalid bounded CI evidence file",
    );
    const bytes = readFileSync(record.path);
    assert.equal(hash(bytes), record.sha256, "CI evidence hash mismatch");
    return bytes;
  };
  const report = {
    schemaVersion: 1,
    assessment: "scoped-rust-ci-execution",
    scope: args.scope,
    executionKind: kind,
    startedAt: new Date().toISOString(),
    outputDirectory: directory,
    passed: false,
    releaseAcceptance: false,
    wholeRepositoryCoverage: false,
    networkRequestsPerformed: false,
    nonAcceptanceReasons: [],
  };
  let stage = "collection";
  try {
    const collection = collect({
      ...collectionArgs,
      outputDirectory: directory,
    });
    report.collection = collection;
    prepared.verify();
    if (!collection.collectionPassed) {
      report.nonAcceptanceReasons = ["collection-not-verified"];
      return report;
    }
    stage = "sbom-validation";
    readBound(collection.collection);
    const validationBytes = readBound(collection.sbomValidation);
    const sbom = readBound(collection.sbom);
    const validation = validateRustFeatureSbom(sbom);
    assert.deepEqual(
      JSON.parse(decode(validationBytes)),
      validation,
      "Stored SBOM receipt differs from current official validation",
    );
    report.sbomValidation = validation;
    // Do not export package identities until a bound versioned source review
    // resolves the declared boundary. An incomplete inventory alone cannot do so.
    if (
      collection.rootCompletenessVerified !== true ||
      collection.completeness?.status !== "complete" ||
      !Array.isArray(collection.completeness?.unresolved) ||
      collection.completeness.unresolved.length !== 0
    ) {
      report.nonAcceptanceReasons = ["incomplete-feature-scope"];
      return report;
    }
    stage = "selected-advisories";
    prepared.verify();
    const advisory = await capture({
      repositoryRoot: prepared.root,
      scope: args.scope,
      collectionFile: collection.collection.path,
      collectionSha256: collection.collection.sha256,
      outputDirectory: directory,
      mode: "query-selected-identities",
    });
    report.advisory = advisory;
    report.networkRequestsPerformed =
      advisory.networkRequestsPerformed === true;
    prepared.verify();
    readBound(collection.collection);
    readBound(collection.sbom);
    readBound(collection.sbomValidation);
    Object.assign(report, {
      assessmentResult: assessRustFeatureCi({
        collection,
        advisory,
        sbomValidation: validation,
      }),
    });
    report.nonAcceptanceReasons = report.assessmentResult.nonAcceptanceReasons;
    report.passed =
      kind === "installed-tools" && report.assessmentResult.passed;
    if (kind !== "installed-tools")
      report.nonAcceptanceReasons = [
        ...report.nonAcceptanceReasons,
        "offline-fixture",
      ];
  } catch {
    report.failure = {
      stage,
      code: "SCOPED_CI_FAILED",
      message:
        "Scoped CI failed; no fallback or partial evidence grants acceptance.",
    };
    report.passed = false;
    report.nonAcceptanceReasons = ["scoped-ci-failed"];
  } finally {
    try {
      prepared.verify();
    } catch {
      report.passed = false;
      report.nonAcceptanceReasons = [
        ...new Set([...report.nonAcceptanceReasons, "inputs-changed"]),
      ];
    }
    report.finishedAt = new Date().toISOString();
    verifyOutput();
    writeFileSync(
      join(directory, "summary.json"),
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx" },
    );
  }
  return report;
}

export function runRustFeatureCi(args) {
  return run(
    args,
    collectRustFeatureMetadata,
    runRustFeatureAdvisories,
    "installed-tools",
  );
}
export function runRustFeatureCiFixture(args, { spawn, transport }) {
  assert.equal(typeof spawn, "function", "Explicit fixture producer required");
  assert.equal(
    typeof transport,
    "function",
    "Explicit fixture transport required",
  );
  return run(
    args,
    (input) => collectRustFeatureMetadataFixture(input, spawn),
    (input) => runRustFeatureAdvisoryFixture(input, { transport }),
    "offline-fixture",
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const report = await runRustFeatureCi(
      parseRustFeatureCiArgs(process.argv.slice(2)),
    );
    console.log(JSON.stringify(report));
    process.exitCode = report.passed ? 0 : 1;
  } catch {
    console.error(
      "Scoped Rust CI refused invalid inputs; no broad audit or fallback attempted.",
    );
    process.exitCode = 1;
  }
}
