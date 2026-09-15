// Only reviewed feature roots and their locked closure are submitted. Never invokes npm audit,
// Quick Audit, installs, remediation, user registry configuration, or authentication.
// API contract: https://docs.npmjs.com/cli/v11/commands/npm-audit/#bulk-advisory-endpoint
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, mkdtempSync } from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import {
  runNpmFeatureScope,
  writeNewScopeReport,
} from "./npm_feature_scope.mjs";
import { reviewFeatureSeeds } from "./npm_feature_seed_review.mjs";
import { loadNpmFeatureRuntime } from "./npm_feature_runtime.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const BULK_URL =
  "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";
const MAX_BYTES = 4 * 1024 * 1024;
const knownScopes = new Set(["pr1-model-npm", "pr2-app-card-ocr-npm"]);

/** Input is a freshly collected, source-reviewed inventory, not an arbitrary submitted lockfile. */
export function planFeatureAdvisories(inventories, semver) {
  assert(
    Array.isArray(inventories) &&
      inventories.length >= 1 &&
      inventories.length <= 2,
  );
  const names = new Map();
  const selected = [];
  const local = [];
  const seenScopes = new Set();
  for (const inventory of inventories) {
    assert.equal(inventory.schemaVersion, 1);
    assert.equal(inventory.status, "draft"); // Inventory and advisory outcomes are different evidence.
    assert(
      knownScopes.has(inventory.scopeId) && !seenScopes.has(inventory.scopeId),
    );
    seenScopes.add(inventory.scopeId);
    assert(Array.isArray(inventory.packages) && inventory.packages.length > 0);
    assert(Array.isArray(inventory.supplementaryPeerGraph?.packages));
    const supplement = new Map();
    for (const item of inventory.supplementaryPeerGraph.packages) {
      assert(
        record(item) && !supplement.has(item.location),
        "duplicate supplementary package",
      );
      supplement.set(item.location, item);
    }
    const configured = new Set();
    for (const item of inventory.packages) {
      assert(
        record(item) && !configured.has(item.location),
        "duplicate configured package",
      );
      configured.add(item.location);
      assert.deepEqual(
        supplement.get(item.location),
        item,
        "configured package missing or changed in supplementary coverage",
      );
    }
    const primary = new Set(inventory.packages.map((item) => item.location));
    for (const item of inventory.supplementaryPeerGraph.packages) {
      assert(record(item));
      assert(
        typeof item.name === "string" &&
          /^(?:@[a-z0-9_.~-]+\/)?[a-z0-9_.~-]+$/iu.test(item.name),
      );
      assert(
        typeof item.version === "string" &&
          /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.+-]+)*$/u.test(item.version),
      );
      assert.equal(
        semver.valid(item.version),
        item.version,
        "invalid selected version",
      );
      assert(
        typeof item.location === "string" &&
          item.location &&
          !/[\\:]/u.test(item.location),
      );
      const context = {
        scopeId: inventory.scopeId,
        location: item.location,
        name: item.name,
        version: item.version,
        graph: primary.has(item.location) ? "configured" : "peer-supplement",
      };
      if (
        item.linkTarget !== undefined ||
        (item.resolved === null && !item.location.startsWith("node_modules/"))
      ) {
        // Local source packages are not public registry releases. Their transitive registry
        // packages are still selected; source package names never enter the remote request.
        local.push(context);
        continue;
      }
      assert(
        typeof item.resolved === "string" && item.integrity,
        "unresolved artifact is not advisory coverage",
      );
      const url = new URL(item.resolved);
      assert(
        url.origin === "https://registry.npmjs.org" &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash,
        "non-npm source requires separate scoped review; do not send its name as a registry release",
      );
      selected.push(context);
      if (!names.has(item.name)) names.set(item.name, new Set());
      names.get(item.name).add(item.version);
    }
  }
  const payload = Object.fromEntries(
    [...names]
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([name, versions]) => [name, [...versions].sort()]),
  );
  assert(
    Object.keys(payload).length > 0 && Object.keys(payload).length <= 4096,
  );
  assert(Buffer.byteLength(JSON.stringify(payload)) <= MAX_BYTES);
  return { payload, selected, local, wholeRepositoryCoverage: false };
}

/** Evaluate only exact selected versions. An empty object is a valid no-known-advisory response. */
export function evaluateFeatureAdvisories(plan, response, semver) {
  validateBulkPayload(plan.payload, semver);
  assert(record(response), "invalid bulk advisory response");
  const findings = [];
  for (const [name, advisories] of Object.entries(response)) {
    assert(
      Object.hasOwn(plan.payload, name),
      "unrequested package in advisory response",
    );
    assert(
      Array.isArray(advisories) && advisories.length <= 1024,
      "invalid advisory list",
    );
    const seen = new Set();
    for (const advisory of advisories) {
      assert(
        record(advisory) && advisory.name === name,
        "advisory name mismatch",
      );
      assert(
        Number.isSafeInteger(advisory.id) &&
          advisory.id > 0 &&
          !seen.has(advisory.id),
        "invalid/duplicate advisory id",
      );
      seen.add(advisory.id);
      assert(
        ["info", "low", "moderate", "high", "critical"].includes(
          advisory.severity,
        ),
        "unknown advisory severity",
      );
      assert(
        typeof advisory.title === "string" &&
          advisory.title.length > 0 &&
          advisory.title.length <= 4096,
      );
      assert(
        typeof advisory.vulnerable_versions === "string" &&
          advisory.vulnerable_versions.length <= 8192 &&
          semver.validRange(advisory.vulnerable_versions) !== null,
        "invalid advisory range",
      );
      const url = new URL(advisory.url);
      assert(
        url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash,
        "invalid advisory URL",
      );
      const versions = plan.payload[name].filter((version) => {
        assert.equal(
          semver.valid(version),
          version,
          "invalid selected version",
        );
        return semver.satisfies(version, advisory.vulnerable_versions, {
          includePrerelease: true,
        });
      });
      if (versions.length)
        findings.push({
          name,
          versions,
          id: advisory.id,
          severity: advisory.severity,
          title: advisory.title,
          url: url.href,
          vulnerableVersions: advisory.vulnerable_versions,
          contexts: plan.selected.filter(
            (item) => item.name === name && versions.includes(item.version),
          ),
        });
    }
  }
  return {
    knownAdvisoriesPass: findings.length === 0,
    findings,
    wholeRepositoryCoverage: false,
    remediationPerformed: false,
    peerCompatibilityVerified: false,
    metaVulnerabilityRemediationComputed: false,
  };
}

/** One bounded unauthenticated request; errors never fall back to a whole-tree audit endpoint. */
export function validateBulkPayload(payload, semver) {
  assert(record(payload), "invalid scoped bulk payload");
  const entries = Object.entries(payload);
  assert(
    entries.length > 0 && entries.length <= 4096,
    "invalid scoped bulk payload size",
  );
  for (const [name, versions] of entries) {
    assert(
      /^(?:@[a-z0-9_.~-]+\/)?[a-z0-9_.~-]+$/iu.test(name),
      "invalid scoped package name",
    );
    assert(
      Array.isArray(versions) &&
        versions.length > 0 &&
        versions.length <= 256 &&
        new Set(versions).size === versions.length,
      "invalid scoped version list",
    );
    for (const version of versions)
      assert(
        typeof version === "string" &&
          version.length <= 256 &&
          semver.valid(version) === version,
        "invalid scoped package version",
      );
  }
}

function parseUniqueJson(bytes) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const parsed = JSON.parse(text);
  const stack = [];
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "{") stack.push(new Set());
    else if (char === "[") stack.push(null);
    else if (char === "}" || char === "]") stack.pop();
    else if (char === '"') {
      const start = index;
      for (index++; index < text.length; index++) {
        if (text[index] === "\\") index++;
        else if (text[index] === '"') break;
      }
      let next = index + 1;
      while (next < text.length && /\s/u.test(text[next])) next++;
      if (text[next] === ":") {
        const keys = stack.at(-1);
        const key = JSON.parse(text.slice(start, index + 1));
        assert(keys && !keys.has(key), "duplicate advisory JSON key");
        keys.add(key);
      }
    }
  }
  return parsed;
}

export async function fetchFeatureAdvisories(
  payload,
  semver,
  fetcher = globalThis.fetch,
) {
  validateBulkPayload(payload, semver);
  const body = JSON.stringify(payload);
  assert(Buffer.byteLength(body) <= MAX_BYTES);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetcher(BULK_URL, {
      method: "POST",
      redirect: "error",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
    });
    assert(
      response.status === 200,
      "bulk service failed; no fallback was attempted",
    );
    assert(
      /^application\/json(?:\s*;|$)/iu.test(
        response.headers.get("content-type") ?? "",
      ),
      "non-JSON bulk response",
    );
    const length = response.headers.get("content-length");
    assert(
      length === null || (/^\d+$/u.test(length) && Number(length) <= MAX_BYTES),
      "oversized bulk response",
    );
    assert(response.body, "missing bulk response body");
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        assert(size <= MAX_BYTES, "oversized bulk response");
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks);
    const parsed = parseUniqueJson(bytes);
    return {
      response: parsed,
      responseSha256: sha(bytes),
      requestSha256: sha(body),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runFeatureAdvisories({
  repositoryRoot,
  variant,
  arboristPath,
  outputDirectory,
  queryBulk = false,
}) {
  assert(["pr1", "pr2"].includes(variant), "explicit PR scope required");
  const root = realpathSync(repositoryRoot);
  const directory = realpathSync(outputDirectory);
  const rel = relative(root, directory);
  assert(
    isAbsolute(outputDirectory) &&
      (isAbsolute(rel) ||
        rel === ".." ||
        rel.startsWith("../") ||
        rel.startsWith("..\\")),
    "output directory must be outside the repository",
  );
  const run = mkdtempSync(join(directory, "npm-feature-advisories-"));
  let stage = "runtime";
  let advisoryRequestAttempted = false;
  try {
    const variants = variant === "pr2" ? ["pr1", "pr2"] : ["pr1"];
    const runtime = loadNpmFeatureRuntime(arboristPath);
    const semver = runtime.semver;
    const inventories = [];
    const inputs = [];
    const capture = (path, expected) => {
      const bytes = readFileSync(path);
      const digest = sha(bytes);
      if (expected !== undefined)
        assert.equal(
          digest,
          expected,
          "bound inventory input changed before query",
        );
      inputs.push({ path, sha256: digest });
      return bytes;
    };
    const reviews = [];
    for (const part of variants) {
      stage = "source-review";
      const seedFile = `scripts/npm_feature_scope.${part}.json`;
      const config = JSON.parse(
        capture(resolve(root, seedFile)).toString("utf8"),
      );
      reviews.push(reviewFeatureSeeds(root, config));
      const outputPath = join(run, `${part}-inventory.json`);
      stage = "inventory";
      const receipt = await runNpmFeatureScope({
        repositoryRoot: root,
        project: "frontend",
        seedFile,
        arboristPath,
        outputPath,
      });
      const inventory = JSON.parse(
        capture(outputPath, receipt.reportSha256).toString("utf8"),
      );
      capture(
        resolve(root, "frontend/package.json"),
        inventory.inputs.packageJsonSha256,
      );
      capture(
        resolve(root, "frontend/package-lock.json"),
        inventory.inputs.packageLockSha256,
      );
      capture(resolve(root, "frontend/.npmrc"), inventory.inputs.npmrcSha256);
      assert.equal(
        sha(readFileSync(resolve(root, seedFile))),
        inventory.inputs.seedsSha256,
      );
      for (const item of inventory.inputs.localPackageManifests)
        capture(
          resolve(root, "frontend", item.location, "package.json"),
          item.packageJsonSha256,
        );
      inventories.push(inventory);
    }
    stage = "planning";
    const plan = planFeatureAdvisories(inventories, semver);
    const requestSha256 = writeNewScopeReport(
      root,
      join(run, "request.json"),
      plan.payload,
    );
    const report = {
      version: 1,
      scope: variant,
      at: new Date().toISOString(),
      mode: queryBulk ? "bulk-query" : "offline-plan",
      sourceReviews: reviews,
      inventoryOnly: !queryBulk,
      requestFileSha256: requestSha256,
      requestedPackages: Object.keys(plan.payload).length,
      requestedVersions: Object.values(plan.payload).reduce(
        (n, values) => n + values.length,
        0,
      ),
      selectedLocations: plan.selected.length,
      localSourceLocationsNotSubmitted: plan.local,
      peerDiagnostics: inventories.flatMap((item) =>
        item.supplementaryPeerGraph.peerDiagnostics.map((entry) => ({
          scopeId: item.scopeId,
          ...entry,
        })),
      ),
      advisoryAcceptance: false,
      wholeRepositoryCoverage: false,
      collectorRuntime: runtime.evidence,
    };
    const verifyInputs = () => {
      runtime.verifyUnchanged();
      for (const input of inputs)
        assert.equal(
          sha(readFileSync(input.path)),
          input.sha256,
          "source/lock changed during check",
        );
      for (let index = 0; index < variants.length; index++)
        assert.deepEqual(
          reviewFeatureSeeds(
            root,
            JSON.parse(
              readFileSync(
                resolve(
                  root,
                  `scripts/npm_feature_scope.${variants[index]}.json`,
                ),
                "utf8",
              ),
            ),
          ),
          reviews[index],
        );
    };
    verifyInputs(); // Fail source/seed drift before any selected names leave the machine.
    if (queryBulk) {
      stage = "query";
      advisoryRequestAttempted = true;
      // Use the collector's configured npm runtime, never download or resolve another semver library.
      const fetched = await fetchFeatureAdvisories(plan.payload, semver);
      const evaluation = evaluateFeatureAdvisories(
        plan,
        fetched.response,
        semver,
      );
      report.responseFileSha256 = writeNewScopeReport(
        root,
        join(run, "response.json"),
        fetched.response,
      );
      Object.assign(report, evaluation, {
        responseSha256: fetched.responseSha256,
        submittedRequestSha256: fetched.requestSha256,
        semverVersion: runtime.evidence.semver,
        advisoryAcceptance: evaluation.knownAdvisoriesPass,
      });
    }
    stage = "verification";
    verifyInputs();
    stage = "summary";
    const reportSha256 = writeNewScopeReport(
      root,
      join(run, "summary.json"),
      report,
    );
    return { ...report, outputDirectory: run, reportSha256 };
  } catch {
    // Never serialize arbitrary exception text, paths, environment or package names.
    // The allowlisted stage distinguishes toolchain/collection failures from findings.
    const failure = {
      version: 1,
      scope: variant,
      mode: queryBulk ? "bulk-query" : "offline-plan",
      status: "failed",
      stage,
      advisoryRequestAttempted,
      advisoryAcceptance: false,
      wholeRepositoryCoverage: false,
    };
    writeNewScopeReport(root, join(run, "failure.json"), failure);
    throw new Error(
      `Feature-scoped npm check failed at ${stage}; sanitized failure receipt written.`,
    );
  }
}

export function parseFeatureAdvisoryArgs(args) {
  const names = {
    "--repository-root": "repositoryRoot",
    "--scope": "variant",
    "--arborist-path": "arboristPath",
    "--output-directory": "outputDirectory",
    "--mode": "mode",
  };
  assert.equal(args.length, 10, "five explicit options required");
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = names[args[index]];
    assert(
      key &&
        !Object.hasOwn(options, key) &&
        args[index + 1] &&
        !args[index + 1].startsWith("--"),
      "unknown/duplicate/missing option",
    );
    options[key] = args[index + 1];
  }
  assert(
    ["plan", "query-bulk"].includes(options.mode),
    "explicit mode required",
  );
  return { ...options, queryBulk: options.mode === "query-bulk" };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const report = await runFeatureAdvisories(
      parseFeatureAdvisoryArgs(process.argv.slice(2)),
    );
    console.log(JSON.stringify(report));
    if (report.mode === "bulk-query" && !report.advisoryAcceptance)
      process.exitCode = 1;
  } catch {
    console.error(
      "Feature-scoped npm check failed. No broad audit, fallback or remediation was attempted; partial output is not acceptance.",
    );
    process.exitCode = 1;
  }
}
