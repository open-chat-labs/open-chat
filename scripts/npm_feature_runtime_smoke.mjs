// Explicit real-runtime smoke. Never queries advisories or installs dependencies.
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { Socket } from "node:net";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { loadNpmFeatureRuntime } from "./npm_feature_runtime.mjs";
import {
  runNpmFeatureScope,
  writeNewScopeReport,
} from "./npm_feature_scope.mjs";
import {
  parseFeatureAdvisoryArgs,
  runFeatureAdvisories,
} from "./npm_feature_advisories.mjs";

/** Exercise changed override semantics and unchanged virtual-graph assumptions. */
export async function verifyRealArboristSemantics(
  arboristPath,
  outputDirectory,
) {
  const runtime = loadNpmFeatureRuntime(arboristPath);
  const require = createRequire(resolve(arboristPath, "package.json"));
  const OverrideSet = require("./lib/override-set.js");
  const compatible = new OverrideSet({
    overrides: { left: { dep: "1.x" }, right: { dep: "1.x" } },
  });
  assert.equal(
    OverrideSet.findSpecificOverrideSet(
      compatible.children.get("left"),
      compatible.children.get("right"),
    ),
    compatible,
  );
  const conflicting = new OverrideSet({
    overrides: { left: { dep: "1.x" }, right: { dep: "2.x" } },
  });
  assert.equal(
    OverrideSet.findSpecificOverrideSet(
      conflicting.children.get("left"),
      conflicting.children.get("right"),
    ),
    undefined,
  );
  const directory = mkdtempSync(join(outputDirectory, "npm-runtime-contract-"));
  const cases = [];
  for (const matchingOverride of [true, false]) {
    const repo = join(directory, matchingOverride ? "matching" : "unmatched");
    const project = join(repo, "frontend");
    mkdirSync(join(project, "local-model"), { recursive: true });
    const pkg = {
      name: "runtime-contract-root",
      version: "1.0.0",
      dependencies: { "local-model": "file:./local-model", unrelated: "1.0.0" },
      overrides: matchingOverride
        ? { "fixture-dep": "2.0.0" }
        : { unused: "2.0.0" },
    };
    const local = {
      name: "local-model",
      version: "1.0.0",
      dependencies: { "fixture-dep": "1.0.0", "fixture-priority": "1.0.0" },
      optionalDependencies: {
        "fixture-optional": "1.0.0",
        "fixture-priority": "2.0.0",
      },
      devDependencies: { "fixture-dev": "1.0.0", "fixture-priority": "3.0.0" },
      peerDependencies: {
        "fixture-peer": "^1.0.0",
        "fixture-absent": "^1.0.0",
      },
      peerDependenciesMeta: { "fixture-absent": { optional: true } },
    };
    const lock = {
      name: pkg.name,
      version: pkg.version,
      lockfileVersion: 3,
      packages: {
        "": pkg,
        "local-model": local,
        "node_modules/local-model": { resolved: "local-model", link: true },
      },
    };
    for (const [name, version] of Object.entries({
      "fixture-dep": matchingOverride ? "2.0.0" : "1.0.0",
      "fixture-optional": "1.0.0",
      "fixture-dev": "1.0.0",
      "fixture-priority": "3.0.0",
      "fixture-peer": "2.0.0",
      unrelated: "1.0.0",
    })) {
      lock.packages[`node_modules/${name}`] = {
        name,
        version,
        resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
        integrity: "sha512-eA==",
      };
    }
    lock.packages["node_modules/fixture-dep"].devDependencies = {
      unrelated: "2.0.0",
    };
    const save = (file, value) =>
      writeFileSync(file, JSON.stringify(value) + "\n", { flag: "wx" });
    save(join(project, "package.json"), pkg);
    save(join(project, "package-lock.json"), lock);
    save(join(project, "local-model/package.json"), local);
    writeFileSync(join(project, ".npmrc"), "legacy-peer-deps=true\n", {
      flag: "wx",
    });
    save(join(repo, "seeds.json"), {
      schemaVersion: 1,
      status: "draft",
      scopeId: "runtime-contract",
      seeds: [
        {
          kind: "edge",
          from: "",
          name: "local-model",
          purpose: "Real engine linked dependency semantics",
        },
      ],
    });
    const outputPath = join(
      directory,
      matchingOverride ? "matching.json" : "unmatched.json",
    );
    await runNpmFeatureScope({
      repositoryRoot: repo,
      project: "frontend",
      seedFile: "seeds.json",
      arboristPath,
      outputPath,
    });
    const report = JSON.parse(readFileSync(outputPath));
    const dependency = report.edges.find(
      (edge) => edge.from === "local-model" && edge.name === "fixture-dep",
    );
    assert.equal(dependency.requested, "1.0.0");
    assert.equal(dependency.effective, matchingOverride ? "2.0.0" : "1.0.0");
    assert.equal(
      report.packages.find((item) => item.name === "fixture-dep").version,
      matchingOverride ? "2.0.0" : "1.0.0",
    );
    assert(report.packages.some((item) => item.name === "fixture-dev"));
    assert(report.packages.some((item) => item.name === "fixture-optional"));
    assert(
      report.edges.some(
        (edge) =>
          edge.name === "fixture-priority" &&
          edge.type === "dev" &&
          edge.requested === "3.0.0",
      ),
    );
    assert(
      !report.packages.some((item) =>
        ["fixture-peer", "fixture-absent", "unrelated"].includes(item.name),
      ),
    );
    assert(
      report.supplementaryPeerGraph.packages.some(
        (item) => item.name === "fixture-peer",
      ),
    );
    assert(
      report.supplementaryPeerGraph.peerDiagnostics.some(
        (item) =>
          item.name === "fixture-peer" && item.status === "invalid-peer",
      ),
    );
    assert(
      report.supplementaryPeerGraph.omittedOptionalPeers.some(
        (item) => item.name === "fixture-absent",
      ),
    );
    cases.push({
      matchingOverride,
      selected: report.packages.length,
      peerInclusive: report.supplementaryPeerGraph.packages.length,
    });
    const optional = lock.packages["node_modules/fixture-optional"];
    delete lock.packages["node_modules/fixture-optional"];
    writeFileSync(
      join(project, "package-lock.json"),
      JSON.stringify(lock) + "\n",
    );
    await assert.rejects(
      runNpmFeatureScope({
        repositoryRoot: repo,
        project: "frontend",
        seedFile: "seeds.json",
        arboristPath,
        outputPath: join(
          directory,
          `${matchingOverride}-missing-optional.json`,
        ),
      }),
      /missing required, optional-platform or lock-present peer dependency/u,
    );
    lock.packages["node_modules/fixture-optional"] = optional;
    // A local target missing from the lock must fail before any report is accepted.
    delete lock.packages["local-model"];
    writeFileSync(
      join(project, "package-lock.json"),
      JSON.stringify(lock) + "\n",
    );
    await assert.rejects(
      runNpmFeatureScope({
        repositoryRoot: repo,
        project: "frontend",
        seedFile: "seeds.json",
        arboristPath,
        outputPath: join(directory, `${matchingOverride}-missing.json`),
      }),
      /Missing target in lock file/u,
    );
  }
  runtime.verifyUnchanged();
  return {
    passed: true,
    cases,
    compatibleSiblingOverrides: true,
    conflictingSiblingOverridesRejected: true,
    missingLinkTargetsRejected: true,
    missingOptionalPackagesRejected: true,
    declarationPrecedenceVerified: true,
    externalDevelopmentDependenciesExcluded: true,
  };
}

export async function runNpmFeatureRuntimeSmoke(options) {
  assert.equal(
    options.queryBulk,
    false,
    "runtime smoke accepts offline plan mode only",
  );
  assert(
    ["pr1", "pr2"].includes(options.variant),
    "explicit smoke scope required",
  );
  const repositoryRoot = realpathSync(options.repositoryRoot);
  const outputDirectory = realpathSync(options.outputDirectory);
  const rel = relative(repositoryRoot, outputDirectory);
  assert(
    isAbsolute(options.outputDirectory) &&
      (isAbsolute(rel) || rel === ".." || rel.startsWith(".." + sep)),
    "smoke outputs must remain outside the repository",
  );
  const smokeDirectory = mkdtempSync(
    join(outputDirectory, "npm-feature-advisories-smoke-"),
  );
  let stage = "runtime";
  let Arborist;
  const methods = ["audit", "reify", "buildIdealTree", "loadActual"];
  let originalMethods = [];
  const originalFetch = globalThis.fetch;
  const originalConnect = Socket.prototype.connect;
  let forbiddenCalls = 0;
  const forbidden = () => {
    forbiddenCalls++;
    throw new Error(
      "network and mutable Arborist operations are forbidden in runtime smoke",
    );
  };
  try {
    globalThis.fetch = forbidden;
    Socket.prototype.connect = forbidden;
    const runtime = loadNpmFeatureRuntime(options.arboristPath);
    const require = createRequire(
      resolve(options.arboristPath, "package.json"),
    );
    Arborist = require(".");
    originalMethods = methods.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(Arborist.prototype, name),
    ]);
    for (const name of methods)
      Object.defineProperty(Arborist.prototype, name, {
        configurable: true,
        value: forbidden,
      });
    stage = "semantics";
    const semantics = await verifyRealArboristSemantics(
      options.arboristPath,
      options.outputDirectory,
    );
    stage = "plan";
    const plan = await runFeatureAdvisories(options);
    assert.equal(plan.mode, "offline-plan");
    assert.equal(plan.advisoryAcceptance, false);
    assert.equal(forbiddenCalls, 0);
    runtime.verifyUnchanged();
    const summary = {
      version: 1,
      passed: true,
      semantics,
      collectorRuntime: runtime.evidence,
      forbiddenCalls,
      advisoryAcceptance: false,
      planReportSha256: plan.reportSha256,
    };
    stage = "summary";
    const smokeSha256 = writeNewScopeReport(
      options.repositoryRoot,
      join(plan.outputDirectory, "runtime-smoke.json"),
      summary,
    );
    return { ...summary, outputDirectory: plan.outputDirectory, smokeSha256 };
  } catch {
    writeNewScopeReport(repositoryRoot, join(smokeDirectory, "failure.json"), {
      version: 1,
      scope: options.variant,
      mode: "offline-runtime-smoke",
      status: "failed",
      stage,
      forbiddenCalls,
      advisoryRequestAttempted: false,
      advisoryAcceptance: false,
    });
    throw new Error(
      `Offline npm runtime smoke failed at ${stage}; sanitized failure receipt written.`,
    );
  } finally {
    globalThis.fetch = originalFetch;
    Socket.prototype.connect = originalConnect;
    for (const [name, descriptor] of originalMethods) {
      if (descriptor)
        Object.defineProperty(Arborist.prototype, name, descriptor);
      else delete Arborist.prototype[name];
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(
      JSON.stringify(
        await runNpmFeatureRuntimeSmoke(
          parseFeatureAdvisoryArgs(process.argv.slice(2)),
        ),
      ),
    );
  } catch {
    console.error(
      "Offline real npm runtime smoke failed; no advisory acceptance or fallback.",
    );
    process.exitCode = 1;
  }
}
