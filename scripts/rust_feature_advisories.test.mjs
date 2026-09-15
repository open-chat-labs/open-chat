import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  planRustFeatureAdvisories,
  RUST_ADVISORY_PLAN_LIMITS,
} from "./rust_feature_advisories.mjs";

const registry = "registry+https://github.com/rust-lang/crates.io-index";
const git =
  "git+https://github.com/example/alpha?rev=" +
  "a".repeat(40) +
  "#" +
  "a".repeat(40);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hash = (letter) => letter.repeat(64);
const key = (name, version, source = registry) =>
  JSON.stringify([name, version, source]);
const provenance = (seed = "runtime", context = "production") => [
  { seed, context },
];
function fixture() {
  const alpha = key("alpha", "1.2.3");
  const patched = key("alpha", "1.2.3", git);
  const local = "path:patch/Cargo.toml#local_patch@0.1.0";
  const beta = key("beta", "2.0.0-rc.1+build.7");
  const privateRegistry = "registry+https://registry.example.test/index";
  const privateAlpha = key("alpha", "1.2.3", privateRegistry);
  const pkg = (
    name,
    version,
    source = registry,
    context = "production",
    manifest = null,
  ) => ({
    key: source === null ? local : key(name, version, source),
    name,
    version,
    source,
    checksum: source === null || source.startsWith("git+") ? null : hash("a"),
    manifest,
    resolvedFeatures: [],
    provenance: provenance("runtime", context),
  });
  return {
    schemaVersion: 1,
    assessment: "offline-selected-external-dependency-closure",
    rootCompletenessVerified: false,
    advisoryChecksPerformed: false,
    featurePrecision: "workspace-wide-resolved-feature-union-overapproximation",
    profile: {
      target: "x86_64-pc-windows-msvc",
      features: ["native/inference"],
    },
    limitations: ["Caller-selected roots are not completeness verified."],
    identity: {
      metadataSha256: hash("a"),
      cargoLockSha256: hash("b"),
      manifestSha256: {
        "Cargo.toml": hash("c"),
        "native/Cargo.toml": hash("d"),
        "patch/Cargo.toml": hash("e"),
      },
    },
    roots: [
      {
        id: "runtime",
        ownerManifest: "native/Cargo.toml",
        ownerPackage: "native",
        dependencyName: "alpha",
        kind: "normal",
        originContext: "production",
        target: null,
        package: alpha,
        requestedFeatures: ["derive"],
        usesDefaultFeatures: false,
        optional: true,
      },
    ],
    packages: [
      pkg("alpha", "1.2.3"),
      pkg("alpha", "1.2.3", git),
      pkg("local_patch", "0.1.0", null, "production", "patch/Cargo.toml"),
      pkg("beta", "2.0.0-rc.1+build.7", registry, "build"),
      pkg("alpha", "1.2.3", privateRegistry, "test"),
    ],
    edges: [
      {
        from: alpha,
        to: patched,
        dependencyName: "patched",
        kind: "normal",
        target: null,
        provenance: provenance(),
      },
      {
        from: patched,
        to: local,
        dependencyName: "local",
        kind: "normal",
        target: null,
        provenance: provenance(),
      },
      {
        from: local,
        to: beta,
        dependencyName: "beta",
        kind: "build",
        target: "cfg(windows)",
        provenance: provenance("runtime", "build"),
      },
      {
        from: alpha,
        to: privateAlpha,
        dependencyName: "alpha_test",
        kind: "dev",
        target: null,
        provenance: provenance("runtime", "test"),
      },
    ],
  };
}
function envelope(report = fixture(), id = "pr1/windows-inference") {
  const reportJson = JSON.stringify(report);
  return { id, reportJson, sha256: digest(reportJson) };
}
function reject(mutate, message) {
  const report = fixture();
  mutate(report);
  assert.throws(() => planRustFeatureAdvisories([envelope(report)]), message);
}

test("registry and immutable Git queries stay distinct and retain full profile traces", () => {
  const report = fixture();
  const input = envelope(report);
  const before = JSON.stringify(input);
  const plan = planRustFeatureAdvisories([input]);
  assert.deepEqual(plan.request.body, {
    queries: [
      { package: { ecosystem: "crates.io", name: "alpha" }, version: "1.2.3" },
      {
        package: { ecosystem: "crates.io", name: "beta" },
        version: "2.0.0-rc.1+build.7",
      },
      { commit: "a".repeat(40) },
    ],
  });
  assert.deepEqual(plan.unqueried.map((p) => p.sourceClass).sort(), [
    "other-registry",
    "path",
  ]);
  assert.ok(plan.unqueried.every((p) => p.advisoryCoverage === "not-proven"));
  assert.equal(plan.selected.find((p) => p.sourceClass === "git").source, git);
  assert.equal(plan.selected[0].source, registry);
  assert.equal(plan.selected[0].queryIndex, 0);
  assert.deepEqual(
    plan.selected[1].occurrences[0].provenance,
    provenance("runtime", "build"),
  );
  assert.deepEqual(plan.profiles[0].edges, report.edges);
  assert.deepEqual(plan.profiles[0].roots, report.roots);
  assert.deepEqual(plan.profiles[0].identity, report.identity);
  assert.equal(plan.profiles[0].reportSha256, input.sha256);
  assert.equal(plan.request.url, "https://api.osv.dev/v1/querybatch");
  assert.equal(plan.request.method, "POST");
  assert.equal(plan.request.sha256, digest(JSON.stringify(plan.request.body)));
  assert.equal(
    plan.request.bytes,
    Buffer.byteLength(JSON.stringify(plan.request.body)),
  );
  assert.equal(plan.request.shouldSend, true);
  assert.doesNotMatch(
    JSON.stringify(plan.request.body),
    /github|native|private|profile|manifest|checksum/u,
    "request must contain only selected public crate identities, not local graph metadata",
  );
  assert.equal(plan.rootCompletenessVerified, false);
  assert.equal(plan.advisoryChecksPerformed, false);
  assert.equal(plan.wholeRepositoryCoverage, false);
  assert.equal(plan.advisoryCoverage, "not-proven");
  assert.equal(JSON.stringify(input), before, "planner must not mutate inputs");
});

test("multiple profiles deduplicate exact registry queries while preserving versions, roles and source identities", () => {
  const first = fixture();
  const second = fixture();
  second.profile.target = "aarch64-linux-android";
  second.identity.metadataSha256 = hash("f");
  second.packages[0].resolvedFeatures = ["derive", "alloc"];
  const a = envelope(first, "pr1/windows");
  const b = envelope(second, "pr2/android");
  const plan = planRustFeatureAdvisories([a, b]);
  assert.equal(plan.selected.length, 3);
  assert.equal(plan.selected[0].occurrences.length, 2);
  assert.equal(plan.unqueried.length, 4);
  assert.deepEqual(
    plan,
    planRustFeatureAdvisories([b, a]),
    "input order must not change plan",
  );
  assert.deepEqual(plan.selected[0].occurrences[1].resolvedFeatures, [
    "derive",
    "alloc",
  ]);
});

test("distinct versions of one registry crate remain distinct queries", () => {
  const report = fixture();
  const previous = report.packages[3].key;
  report.packages[3].name = "alpha";
  report.packages[3].version = "2.0.0";
  report.packages[3].key = key("alpha", "2.0.0");
  report.edges.find((e) => e.to === previous).to = report.packages[3].key;
  assert.deepEqual(
    planRustFeatureAdvisories([envelope(report)])
      .request.body.queries.filter((q) => q.package)
      .map((q) => q.version),
    ["1.2.3", "2.0.0"],
  );
});

test("noncanonical-registry graph produces an empty non-send plan, never a coverage pass", () => {
  const report = fixture();
  const old = report.packages[0].key;
  report.packages = [report.packages[4]];
  report.packages[0].provenance = provenance();
  report.roots[0].package = report.packages[0].key;
  report.edges = [];
  assert.notEqual(report.roots[0].package, old);
  const plan = planRustFeatureAdvisories([envelope(report)]);
  assert.deepEqual(plan.request.body, { queries: [] });
  assert.equal(plan.request.shouldSend, false);
  assert.equal(plan.advisoryCoverage, "not-proven");
  assert.equal(plan.unqueried.length, 1);
});

test("graph cycles retain exact propagated provenance without repeated requests", () => {
  const report = fixture();
  report.edges.push({
    from: report.packages[2].key,
    to: report.packages[0].key,
    dependencyName: "cycle",
    kind: "normal",
    target: null,
    provenance: provenance(),
  });
  assert.equal(
    planRustFeatureAdvisories([envelope(report)]).selected.length,
    3,
  );
});

test("no network, Cargo or filesystem implementation is needed even with fetch disabled", () => {
  const previous = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("network must not run");
  };
  try {
    assert.equal(planRustFeatureAdvisories([envelope()]).selected.length, 3);
  } finally {
    globalThis.fetch = previous;
  }
});

test("Git queries use the resolved fragment, not a requested branch or revision", () => {
  const report = fixture();
  const pkg = report.packages[1];
  const previous = pkg.key;
  pkg.source =
    "git+https://github.com/example/alpha?branch=main#" + "b".repeat(40);
  pkg.key = key(pkg.name, pkg.version, pkg.source);
  for (const edge of report.edges) {
    if (edge.from === previous) edge.from = pkg.key;
    if (edge.to === previous) edge.to = pkg.key;
  }
  const plan = planRustFeatureAdvisories([envelope(report)]);
  const selected = plan.selected.find((item) => item.sourceClass === "git");
  assert.equal(selected.source, pkg.source);
  assert.equal(selected.commit, "b".repeat(40));
  assert.deepEqual(plan.request.body.queries[selected.queryIndex], {
    commit: "b".repeat(40),
  });
});

test("crates at a shared Git commit retain separate source-package provenance", () => {
  const report = fixture();
  const source = report.packages[1];
  const macros = {
    ...source,
    name: "alpha-macros",
    key: key("alpha-macros", source.version, source.source),
  };
  report.packages.push(macros);
  report.edges.push({
    from: source.key,
    to: macros.key,
    dependencyName: macros.name,
    kind: "normal",
    target: null,
    provenance: provenance(),
  });
  const plan = planRustFeatureAdvisories([envelope(report)]);
  const selected = plan.selected.filter((item) => item.sourceClass === "git");
  assert.equal(selected.length, 2);
  assert.deepEqual(
    selected.map((item) => item.occurrences[0].packageKey),
    [source.key, macros.key],
  );
  assert.deepEqual(
    selected.map((item) => plan.request.body.queries[item.queryIndex]),
    [{ commit: "a".repeat(40) }, { commit: "a".repeat(40) }],
  );
});

const mutations = [
  [
    "schema version",
    (r) => {
      r.schemaVersion = 2;
    },
    /schema/u,
  ],
  [
    "assessment",
    (r) => {
      r.assessment = "whole-workspace";
    },
    /offline-selected/u,
  ],
  [
    "unearned root completeness",
    (r) => {
      r.rootCompletenessVerified = true;
    },
    /completeness/u,
  ],
  [
    "prior advisory claim",
    (r) => {
      r.advisoryChecksPerformed = true;
    },
    /unassessed/u,
  ],
  [
    "missing feature precision",
    (r) => {
      delete r.featurePrecision;
    },
    /feature-union/u,
  ],
  [
    "missing limitations",
    (r) => {
      r.limitations = [];
    },
    /limitations/u,
  ],
  [
    "missing target",
    (r) => {
      delete r.profile.target;
    },
    /target/u,
  ],
  [
    "missing feature list",
    (r) => {
      delete r.profile.features;
    },
    /features/u,
  ],
  [
    "duplicate profile features",
    (r) => {
      r.profile.features.push(r.profile.features[0]);
    },
    /Duplicate/u,
  ],
  [
    "missing metadata hash",
    (r) => {
      delete r.identity.metadataSha256;
    },
    /SHA-256/u,
  ],
  [
    "bad lock hash",
    (r) => {
      r.identity.cargoLockSha256 = "a".repeat(63);
    },
    /SHA-256/u,
  ],
  [
    "missing workspace manifest",
    (r) => {
      delete r.identity.manifestSha256["Cargo.toml"];
    },
    /workspace/u,
  ],
  [
    "manifest escape",
    (r) => {
      r.identity.manifestSha256["../Cargo.toml"] = hash("a");
    },
    /escape/u,
  ],
  [
    "missing owner manifest",
    (r) => {
      delete r.identity.manifestSha256["native/Cargo.toml"];
    },
    /owner manifest/u,
  ],
  [
    "empty roots",
    (r) => {
      r.roots = [];
    },
    /roots/u,
  ],
  [
    "duplicate root",
    (r) => {
      r.roots.push(structuredClone(r.roots[0]));
    },
    /Duplicate root/u,
  ],
  [
    "missing root package",
    (r) => {
      r.roots[0].package = "missing";
    },
    /root package/u,
  ],
  [
    "path seed",
    (r) => {
      r.roots[0].package = r.packages[2].key;
    },
    /external/u,
  ],
  [
    "downgraded root role",
    (r) => {
      r.roots[0].kind = "dev";
    },
    /Downgraded/u,
  ],
  [
    "missing root target",
    (r) => {
      delete r.roots[0].target;
    },
    /target/u,
  ],
  [
    "missing requested features",
    (r) => {
      delete r.roots[0].requestedFeatures;
    },
    /features/u,
  ],
  [
    "missing default features",
    (r) => {
      delete r.roots[0].usesDefaultFeatures;
    },
    /default-feature/u,
  ],
  [
    "missing optional",
    (r) => {
      delete r.roots[0].optional;
    },
    /optional/u,
  ],
  [
    "duplicate package source",
    (r) => {
      r.packages.push(structuredClone(r.packages[0]));
    },
    /Duplicate package/u,
  ],
  [
    "mismatched source key",
    (r) => {
      r.packages[1].source = registry;
    },
    /identity mismatch/u,
  ],
  [
    "missing registry checksum",
    (r) => {
      r.packages[0].checksum = null;
    },
    /SHA-256/u,
  ],
  [
    "unbound path",
    (r) => {
      delete r.identity.manifestSha256["patch/Cargo.toml"];
    },
    /Unbound path/u,
  ],
  [
    "path escape",
    (r) => {
      r.packages[2].manifest = "../Cargo.toml";
    },
    /escape/u,
  ],
  [
    "path with registry identity",
    (r) => {
      r.packages[2].source = registry;
    },
    /path identity/u,
  ],
  [
    "missing resolved features",
    (r) => {
      delete r.packages[0].resolvedFeatures;
    },
    /features/u,
  ],
  [
    "invalid crate name",
    (r) => {
      r.packages[0].name = "alpha/secret";
    },
    /crate name/u,
  ],
  [
    "version range",
    (r) => {
      r.packages[0].version = "^1.2.3";
    },
    /exact crate version/u,
  ],
  [
    "partial version",
    (r) => {
      r.packages[0].version = "1.2";
    },
    /exact crate version/u,
  ],
  [
    "leading-zero prerelease",
    (r) => {
      r.packages[0].version = "1.2.3-01";
    },
    /exact crate version/u,
  ],
  [
    "missing edge node",
    (r) => {
      r.edges[0].to = "missing";
    },
    /resolved edge node/u,
  ],
  [
    "duplicate edge",
    (r) => {
      r.edges.push(structuredClone(r.edges[0]));
    },
    /Duplicate graph/u,
  ],
  [
    "missing edge kind",
    (r) => {
      delete r.edges[0].kind;
    },
    /Cargo edge kind/u,
  ],
  [
    "missing edge target",
    (r) => {
      delete r.edges[0].target;
    },
    /target/u,
  ],
  [
    "missing package provenance",
    (r) => {
      r.packages[0].provenance = [];
    },
    /provenance/u,
  ],
  [
    "unknown seed",
    (r) => {
      r.packages[0].provenance[0].seed = "core";
    },
    /Unknown provenance/u,
  ],
  [
    "duplicate provenance",
    (r) => {
      r.packages[0].provenance.push(provenance()[0]);
    },
    /Duplicate provenance/u,
  ],
  [
    "downgraded package context",
    (r) => {
      r.packages[3].provenance[0].context = "production";
    },
    /Package provenance/u,
  ],
  [
    "forged edge context",
    (r) => {
      r.edges[2].provenance[0].context = "test";
    },
    /Edge provenance/u,
  ],
  [
    "disconnected graph package",
    (r) => {
      r.edges.shift();
    },
    /Package provenance/u,
  ],
];
for (const [name, mutate, message] of mutations)
  test(`fails closed: ${name}`, () => reject(mutate, message));

test("rejects mutated bytes and malformed UTF-8 before JSON interpretation", () => {
  const input = envelope();
  assert.throws(
    () =>
      planRustFeatureAdvisories([
        { ...input, reportJson: input.reportJson + " " },
      ]),
    /SHA-256 mismatch/u,
  );
  const bytes = Buffer.from([0xff]);
  assert.throws(
    () =>
      planRustFeatureAdvisories([
        { id: "bad", reportJson: bytes, sha256: digest(bytes) },
      ]),
    /encoded data/u,
  );
  assert.throws(
    () =>
      planRustFeatureAdvisories([
        { id: "bad", reportJson: "{", sha256: digest("{") },
      ]),
    SyntaxError,
  );
});

test("rejects absent profiles, duplicated IDs/reports and bounded profile overflow", () => {
  const input = envelope();
  assert.throws(() => planRustFeatureAdvisories([]), /profiles/u);
  assert.throws(
    () => planRustFeatureAdvisories([input, input]),
    /Duplicate profile ID/u,
  );
  assert.throws(
    () => planRustFeatureAdvisories([input, { ...input, id: "different" }]),
    /Duplicate source report/u,
  );
  assert.throws(
    () =>
      planRustFeatureAdvisories(
        Array(RUST_ADVISORY_PLAN_LIMITS.profiles + 1).fill(input),
      ),
    /profiles/u,
  );
  assert.throws(
    () =>
      planRustFeatureAdvisories([
        {
          ...input,
          reportJson: " ".repeat(RUST_ADVISORY_PLAN_LIMITS.reportBytes + 1),
        },
      ]),
    /byte limit/u,
  );
});

test("rejects conflicting checksum for exact same source package across profiles", () => {
  const first = fixture(),
    second = fixture();
  second.profile.target = "aarch64-linux-android";
  second.packages[0].checksum = hash("c");
  second.identity.metadataSha256 = hash("f");
  assert.throws(
    () =>
      planRustFeatureAdvisories([
        envelope(first, "one"),
        envelope(second, "two"),
      ]),
    /source\/checksum/u,
  );
});

test("rejects inconsistent production identity for the same raw metadata source", () => {
  const first = fixture(),
    second = fixture();
  second.profile.target = "aarch64-linux-android";
  assert.throws(
    () =>
      planRustFeatureAdvisories([
        envelope(first, "one"),
        envelope(second, "two"),
      ]),
    /metadata source\/profile/u,
  );
  second.profile = structuredClone(first.profile);
  second.identity.cargoLockSha256 = hash("f");
  assert.throws(
    () =>
      planRustFeatureAdvisories([
        envelope(first, "one"),
        envelope(second, "two"),
      ]),
    /metadata source\/profile/u,
  );
});

test("canonical-looking alternate registries are never silently assigned crates.io provenance", () => {
  for (const source of [
    "registry+https://github.com/rust-lang/crates.io-index/",
    "registry+https://github.com.evil.test/rust-lang/crates.io-index",
    "sparse+https://index.crates.io/",
  ]) {
    const report = fixture();
    const old = report.packages[0].key,
      next = key("alpha", "1.2.3", source);
    report.packages[0].source = source;
    report.packages[0].key = next;
    report.roots[0].package = next;
    for (const edge of report.edges) if (edge.from === old) edge.from = next;
    const plan = planRustFeatureAdvisories([envelope(report)]);
    assert.deepEqual(
      plan.request.body.queries
        .filter((q) => q.package)
        .map((q) => q.package.name),
      ["beta"],
    );
    assert.ok(
      plan.unqueried.some(
        (pkg) => pkg.source === source && pkg.sourceClass === "other-registry",
      ),
    );
  }
});

test("rejects malformed external source credentials, mutable git ref and unsupported source", () => {
  for (const source of [
    "registry+https://name:secret@registry.example.test/index",
    "registry+https://registry.example.test/index?token=secret",
    "git+https://github.com/example/alpha#main",
    "directory+https://registry.example.test/index",
  ]) {
    reject((r) => {
      const pkg = r.packages[1];
      pkg.source = source;
      pkg.key = key(pkg.name, pkg.version, source);
    }, /source|registry/u);
  }
});

test("query cap fails closed without silently dropping selected packages", () => {
  const report = fixture();
  report.packages = [report.packages[0]];
  report.edges = [];
  for (let i = 1; i <= RUST_ADVISORY_PLAN_LIMITS.queries; i++) {
    const pkg = {
      ...report.packages[0],
      name: `dependency_${i}`,
      key: key(`dependency_${i}`, "1.2.3"),
    };
    report.packages.push(pkg);
    report.edges.push({
      from: report.packages[0].key,
      to: pkg.key,
      dependencyName: pkg.name,
      kind: "normal",
      target: null,
      provenance: provenance(),
    });
  }
  assert.throws(
    () => planRustFeatureAdvisories([envelope(report)]),
    /Query count limit/u,
  );
});
