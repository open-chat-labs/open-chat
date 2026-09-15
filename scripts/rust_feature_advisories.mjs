// Pure offline request planning; no filesystem, Cargo, advisory lookup, or network.
// API contract: https://google.github.io/osv.dev/post-v1-querybatch/
// Ecosystem identity: https://ossf.github.io/osv-schema/#affectedpackage-field
// The caller must obtain expected report hashes from its trusted collection receipt.
// This validates a supplied graph, not omitted edges, root completeness, or freshness.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const CRATES_IO = "registry+https://github.com/rust-lang/crates.io-index";
export const RUST_ADVISORY_PLAN_LIMITS = Object.freeze({
  profiles: 16,
  reportBytes: 32 * 1024 * 1024,
  totalBytes: 128 * 1024 * 1024,
  packages: 4096,
  roots: 4096,
  edges: 32768,
  traversalStates: 1000000,
  queries: 1000,
  requestBytes: 1024 * 1024,
});
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = JSON.stringify;
const sorted = (values) => [...values].sort();
const text = (value, label, max = 512) => {
  assert.ok(
    typeof value === "string" &&
      value.length &&
      value.length <= max &&
      !/[\u0000-\u001f\u007f]/u.test(value),
    `Invalid ${label}`,
  );
  return value;
};
const hash = (value) => {
  assert.match(text(value, "SHA-256"), /^[a-f0-9]{64}$/u, "Invalid SHA-256");
  return value;
};
const object = (value, label) =>
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    `Missing ${label}`,
  );
function list(value, label, max, nonempty = false) {
  assert.ok(
    Array.isArray(value) && value.length <= max && (!nonempty || value.length),
    `Invalid ${label}`,
  );
  return value;
}
function strings(value, label, nonempty = false) {
  list(value, label, 4096, nonempty).forEach((v) => text(v, label));
  assert.equal(new Set(value).size, value.length, `Duplicate ${label}`);
}
function manifest(value) {
  text(value, "manifest");
  assert.ok(
    value.split("/").every((part) => part && part !== "." && part !== "..") &&
      !/[\\:]/u.test(value) &&
      value.split("/").at(-1) === "Cargo.toml",
    "Manifest location escape",
  );
  return value;
}
function kind(value) {
  assert.ok(
    ["normal", "build", "dev"].includes(value),
    "Invalid Cargo edge kind",
  );
}
function context(value) {
  assert.ok(
    ["production", "build", "test"].includes(value),
    "Invalid source context",
  );
}
function target(value) {
  assert.ok(
    value === null || (typeof value === "string" && value.length > 0),
    "Missing target provenance",
  );
  if (value !== null) text(value, "target");
}
function propagated(origin, edgeKind) {
  return origin === "test" || edgeKind === "dev"
    ? "test"
    : origin === "build" || edgeKind === "build"
      ? "build"
      : "production";
}
function provenance(values, roots) {
  list(values, "provenance", roots.size * 3, true);
  const marks = new Set();
  for (const p of values) {
    object(p, "provenance item");
    assert.ok(roots.has(p.seed), "Unknown provenance root");
    context(p.context);
    const mark = json([p.seed, p.context]);
    assert.ok(!marks.has(mark), "Duplicate provenance");
    marks.add(mark);
  }
  return marks;
}
function packageIdentity(pkg, identity) {
  object(pkg, "package");
  assert.match(
    text(pkg.name, "crate name", 128),
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/u,
    "Invalid crate name",
  );
  const number = "(?:0|[1-9][0-9]*)";
  const pre = "(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)";
  assert.match(
    text(pkg.version, "exact crate version", 256),
    new RegExp(
      `^${number}\\.${number}\\.${number}(?:-${pre}(?:\\.${pre})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
      "u",
    ),
    "Invalid exact crate version",
  );
  strings(pkg.resolvedFeatures, "resolved features");
  if (pkg.source === null) {
    manifest(pkg.manifest);
    assert.ok(
      Object.hasOwn(identity.manifestSha256, pkg.manifest),
      "Unbound path manifest",
    );
    assert.equal(pkg.checksum, null, "Unexpected path checksum");
    assert.equal(
      pkg.key,
      `path:${pkg.manifest}#${pkg.name}@${pkg.version}`,
      "Path source identity mismatch",
    );
    return "path";
  }
  const source = text(pkg.source, "Cargo source", 2048);
  assert.equal(pkg.manifest, null, "External package has path identity");
  assert.equal(
    pkg.key,
    json([pkg.name, pkg.version, source]),
    "Package source identity mismatch",
  );
  const prefix = source.match(/^(registry|sparse|git)\+/u)?.[1];
  assert.ok(prefix, "Unsupported Cargo source");
  const url = new URL(source.slice(prefix.length + 1));
  assert.ok(
    ["https:", "http:", "ssh:"].includes(url.protocol) &&
      url.hostname &&
      !url.username &&
      !url.password,
    "Invalid Cargo source URL",
  );
  if (prefix === "git") {
    assert.match(
      url.hash,
      /^#[a-f0-9]{40}$/u,
      "Missing immutable Git source revision",
    );
    assert.equal(pkg.checksum, null, "Unexpected Git checksum");
    return "git";
  }
  assert.ok(
    ["https:", "http:"].includes(url.protocol) && !url.hash && !url.search,
    "Invalid registry source",
  );
  hash(pkg.checksum);
  return source === CRATES_IO ? "crates.io" : "other-registry";
}

function validateReport(report) {
  object(report, "collector report");
  assert.equal(report.schemaVersion, 1, "Unsupported report schema");
  assert.equal(
    report.assessment,
    "offline-selected-external-dependency-closure",
  );
  assert.equal(
    report.rootCompletenessVerified,
    false,
    "Unsupported root completeness claim",
  );
  assert.equal(
    report.advisoryChecksPerformed,
    false,
    "Expected unassessed collector report",
  );
  assert.equal(
    report.featurePrecision,
    "workspace-wide-resolved-feature-union-overapproximation",
  );
  strings(report.limitations, "collector limitations", true);
  object(report.profile, "profile");
  text(report.profile.target, "profile target");
  strings(report.profile.features, "profile features");
  object(report.identity, "report identity");
  hash(report.identity.metadataSha256);
  hash(report.identity.cargoLockSha256);
  object(report.identity.manifestSha256, "manifest identities");
  const identities = Object.entries(report.identity.manifestSha256);
  assert.ok(
    identities.length && identities.length <= 4096,
    "Missing manifest identities",
  );
  for (const [file, digest] of identities) {
    manifest(file);
    hash(digest);
  }
  assert.ok(
    Object.hasOwn(report.identity.manifestSha256, "Cargo.toml"),
    "Missing workspace manifest identity",
  );

  const roots = new Map();
  for (const root of list(
    report.roots,
    "roots",
    RUST_ADVISORY_PLAN_LIMITS.roots,
    true,
  )) {
    object(root, "root");
    text(root.id, "root ID");
    assert.ok(!roots.has(root.id), "Duplicate root");
    roots.set(root.id, root);
    manifest(root.ownerManifest);
    assert.ok(
      Object.hasOwn(report.identity.manifestSha256, root.ownerManifest),
      "Unbound owner manifest",
    );
    text(root.ownerPackage, "root owner");
    text(root.dependencyName, "root dependency");
    kind(root.kind);
    context(root.originContext);
    target(root.target);
    assert.equal(
      propagated(root.originContext, root.kind),
      root.originContext,
      "Downgraded root context",
    );
    strings(root.requestedFeatures, "requested features");
    assert.equal(
      typeof root.usesDefaultFeatures,
      "boolean",
      "Missing default-feature provenance",
    );
    assert.equal(
      typeof root.optional,
      "boolean",
      "Missing optional provenance",
    );
  }
  const packages = new Map(),
    packageMarks = new Map(),
    classes = new Map();
  for (const pkg of list(
    report.packages,
    "packages",
    RUST_ADVISORY_PLAN_LIMITS.packages,
    true,
  )) {
    const classification = packageIdentity(pkg, report.identity);
    assert.ok(!packages.has(pkg.key), "Duplicate package source identity");
    packages.set(pkg.key, pkg);
    classes.set(pkg.key, classification);
    packageMarks.set(pkg.key, provenance(pkg.provenance, roots));
  }
  const edges = new Map(),
    outgoing = new Map(),
    edgeMarks = new Map();
  for (const edge of list(
    report.edges,
    "edges",
    RUST_ADVISORY_PLAN_LIMITS.edges,
  )) {
    object(edge, "edge");
    assert.ok(
      packages.has(edge.from) && packages.has(edge.to),
      "Missing resolved edge node",
    );
    text(edge.dependencyName, "edge dependency");
    kind(edge.kind);
    target(edge.target);
    const key = json([
      edge.from,
      edge.to,
      edge.dependencyName,
      edge.kind,
      edge.target,
    ]);
    assert.ok(!edges.has(key), "Duplicate graph edge");
    edges.set(key, edge);
    edgeMarks.set(key, provenance(edge.provenance, roots));
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from).push([key, edge]);
  }
  // Replay the selected graph to reject disconnected additions and missing,
  // forged or downgraded provenance. Expected report hashes bind omitted edges.
  const expectedPackages = new Map(),
    expectedEdges = new Map(),
    queue = [];
  const enqueue = (state) => {
    assert.ok(
      queue.length < RUST_ADVISORY_PLAN_LIMITS.traversalStates,
      "Graph traversal limit exceeded",
    );
    queue.push(state);
  };
  const add = (map, key, mark) => {
    if (!map.has(key)) map.set(key, new Set());
    if (map.get(key).has(mark)) return false;
    map.get(key).add(mark);
    return true;
  };
  for (const root of roots.values()) {
    assert.ok(packages.has(root.package), "Missing root package");
    assert.notEqual(classes.get(root.package), "path", "Seed must be external");
    enqueue([root.package, root.id, root.originContext]);
  }
  for (let i = 0; i < queue.length; i++) {
    const [key, seed, origin] = queue[i];
    if (!add(expectedPackages, key, json([seed, origin]))) continue;
    for (const [edgeKey, edge] of outgoing.get(key) ?? []) {
      const next = propagated(origin, edge.kind);
      add(expectedEdges, edgeKey, json([seed, next]));
      enqueue([edge.to, seed, next]);
    }
  }
  for (const [key, marks] of packageMarks)
    assert.deepEqual(
      sorted(marks),
      sorted(expectedPackages.get(key) ?? []),
      "Package provenance/graph mismatch",
    );
  for (const [key, marks] of edgeMarks)
    assert.deepEqual(
      sorted(marks),
      sorted(expectedEdges.get(key) ?? []),
      "Edge provenance/graph mismatch",
    );
  return { report, classes };
}

// Inputs are explicitly selected, hash-bound collection outputs, not an entire
// Cargo.lock or workspace metadata inventory. No caller override enables a pass.
export function planRustFeatureAdvisories(profiles) {
  list(profiles, "profiles", RUST_ADVISORY_PLAN_LIMITS.profiles, true);
  const ids = new Set(),
    hashes = new Set(),
    packageSources = new Map(),
    metadataSources = new Map();
  const traces = [],
    selected = new Map(),
    unqueried = [];
  let totalBytes = 0;
  for (const input of profiles) {
    object(input, "profile envelope");
    assert.match(
      text(input.id, "profile ID", 128),
      /^[A-Za-z0-9][A-Za-z0-9._/-]*$/u,
    );
    assert.ok(!ids.has(input.id), "Duplicate profile ID");
    ids.add(input.id);
    hash(input.sha256);
    assert.ok(!hashes.has(input.sha256), "Duplicate source report");
    hashes.add(input.sha256);
    assert.ok(
      typeof input.reportJson === "string" ||
        input.reportJson instanceof Uint8Array,
      "Missing raw report bytes",
    );
    const bytes = Buffer.from(input.reportJson);
    totalBytes += bytes.length;
    assert.ok(
      bytes.length <= RUST_ADVISORY_PLAN_LIMITS.reportBytes &&
        totalBytes <= RUST_ADVISORY_PLAN_LIMITS.totalBytes,
      "Report byte limit exceeded",
    );
    assert.equal(sha(bytes), input.sha256, "Collector report SHA-256 mismatch");
    const { report, classes } = validateReport(
      JSON.parse(
        new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          bytes,
        ),
      ),
    );
    const productionIdentity = json([
      report.identity.cargoLockSha256,
      report.profile.target,
      sorted(report.profile.features),
    ]);
    assert.ok(
      !metadataSources.has(report.identity.metadataSha256) ||
        metadataSources.get(report.identity.metadataSha256) ===
          productionIdentity,
      "Mismatched metadata source/profile identity",
    );
    metadataSources.set(report.identity.metadataSha256, productionIdentity);
    const trace = {
      id: input.id,
      reportSha256: input.sha256,
      profile: report.profile,
      identity: report.identity,
      featurePrecision: report.featurePrecision,
      rootCompletenessVerified: false,
      limitations: report.limitations,
      roots: report.roots,
      edges: report.edges,
    };
    traces.push(trace);
    for (const pkg of report.packages) {
      const sourceClass = classes.get(pkg.key);
      if (sourceClass !== "path") {
        const identity = json([
          pkg.name,
          pkg.version,
          pkg.source,
          pkg.checksum,
        ]);
        assert.ok(
          !packageSources.has(pkg.key) ||
            packageSources.get(pkg.key) === identity,
          "Mismatched package source/checksum across profiles",
        );
        packageSources.set(pkg.key, identity);
      }
      const occurrence = {
        profile: input.id,
        packageKey: pkg.key,
        resolvedFeatures: pkg.resolvedFeatures,
        provenance: pkg.provenance,
      };
      if (sourceClass !== "crates.io" && sourceClass !== "git") {
        unqueried.push({
          ...pkg,
          profile: input.id,
          sourceClass,
          advisoryCoverage: "not-proven",
          reason:
            "Neither canonical crates.io nor an immutable Git identity; no name/version substitution.",
        });
        continue;
      }
      // Keep one query per source package, even when a repository contains
      // several crates at the same commit. This preserves package provenance;
      // a Git finding is commit-wide, not proof of crate-level applicability.
      const commit =
        sourceClass === "git"
          ? new URL(pkg.source.slice(4)).hash.slice(1)
          : undefined;
      const key = json([sourceClass, pkg.name, pkg.version, pkg.source]);
      if (!selected.has(key))
        selected.set(key, {
          name: pkg.name,
          version: pkg.version,
          source: pkg.source,
          checksum: pkg.checksum,
          sourceClass,
          ...(commit === undefined ? {} : { commit }),
          occurrences: [],
        });
      selected.get(key).occurrences.push(occurrence);
    }
  }
  assert.ok(
    selected.size <= RUST_ADVISORY_PLAN_LIMITS.queries,
    "Query count limit exceeded",
  );
  const ordered = [...selected.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, value], index) => ({
      queryIndex: index,
      ...value,
      occurrences: value.occurrences.sort((a, b) =>
        a.profile.localeCompare(b.profile),
      ),
    }));
  const body = {
    queries: ordered.map(({ name, version, sourceClass, commit }) =>
      sourceClass === "git"
        ? { commit }
        : { package: { ecosystem: "crates.io", name }, version },
    ),
  };
  const requestJson = json(body);
  assert.ok(
    Buffer.byteLength(requestJson) <= RUST_ADVISORY_PLAN_LIMITS.requestBytes,
    "Request byte limit exceeded",
  );
  return {
    schemaVersion: 1,
    assessment: "offline-selected-rust-osv-request-plan",
    advisoryChecksPerformed: false,
    rootCompletenessVerified: false,
    wholeRepositoryCoverage: false,
    advisoryCoverage: "not-proven",
    limitations: [
      "This is a request plan, not an advisory result or release acceptance.",
      "Caller-selected root completeness and collection freshness are not established.",
      "Canonical crates.io identities use package/version; Git identities use their resolved immutable commit, never a registry substitute.",
      "Path and other-registry dependencies remain unqueried and unproven.",
      "A commit query applies to the repository revision, not an individual crate; index coverage and security are not proven by an empty response.",
      "Workspace feature unions and source contexts are not shipping-binary reachability.",
      "A later caller must validate ordered results and exhaust per-query pagination.",
    ],
    profiles: traces.sort((a, b) => a.id.localeCompare(b.id)),
    selected: ordered,
    unqueried: unqueried.sort((a, b) =>
      json([a.profile, a.key]).localeCompare(json([b.profile, b.key])),
    ),
    request: {
      method: "POST",
      url: "https://api.osv.dev/v1/querybatch",
      body,
      sha256: sha(requestJson),
      bytes: Buffer.byteLength(requestJson),
      shouldSend: body.queries.length > 0,
    },
  };
}
