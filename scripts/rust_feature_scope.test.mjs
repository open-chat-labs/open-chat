import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  collectRustFeatureScope,
  lockIdentities,
} from "./rust_feature_scope.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const registry = "registry+https://example.invalid/index";
const identity = (name, version) => ({ name, version, source: registry });
const dependency = (name, pkg, kind = null, target = null) => ({
  name,
  pkg,
  dep_kinds: [{ kind, target }],
});
const declaration = (name, kind = null, target = null) => ({
  name,
  rename: null,
  kind,
  target,
  features: [],
  uses_default_features: true,
  optional: false,
});

function fixture(root = "/checkout") {
  const owner = {
    id: "owner",
    name: "feature_host",
    version: "0.1.0",
    source: null,
    manifest_path: `${root}/feature/Cargo.toml`,
    dependencies: [declaration("cipher")],
  };
  const packages = [
    owner,
    { id: "cipher1", ...identity("cipher", "1.0.0"), dependencies: [] },
    { id: "shared1", ...identity("shared", "1.0.0"), dependencies: [] },
    { id: "shared2", ...identity("shared", "2.0.0"), dependencies: [] },
    { id: "tester", ...identity("tester", "1.0.0"), dependencies: [] },
    {
      id: "core",
      ...identity("unrelated_core_only", "1.0.0"),
      dependencies: [],
    },
  ];
  const metadata = {
    version: 1,
    workspace_root: root,
    workspace_members: ["owner"],
    packages,
    resolve: {
      nodes: [
        {
          id: "owner",
          features: [],
          deps: [dependency("cipher", "cipher1"), dependency("core", "core")],
        },
        {
          id: "cipher1",
          features: ["default", "workspace-unified"],
          deps: [
            dependency("shared", "shared1"),
            dependency("shared_build", "shared2", "build", "cfg(unix)"),
            dependency("tester", "tester", "dev"),
          ],
        },
        { id: "shared1", features: [], deps: [dependency("cycle", "cipher1")] },
        { id: "shared2", features: [], deps: [] },
        { id: "tester", features: [], deps: [dependency("shared", "shared1")] },
        { id: "core", features: [], deps: [] },
      ],
    },
  };
  const lock = `version = 4\n\n${packages.map((pkg) => `[[package]]\nname = "${pkg.name}"\nversion = "${pkg.version}"\n${pkg.source ? `source = "${pkg.source}"\nchecksum = "${"1".repeat(64)}"\n` : ""}`).join("\n")}`;
  const manifests = {
    "Cargo.toml": '[workspace]\nmembers = ["feature"]\n',
    "feature/Cargo.toml":
      '[package]\nname = "feature_host"\nversion = "0.1.0"\n',
  };
  const json = JSON.stringify(metadata);
  return {
    identity: {
      workspaceRoot: root,
      metadataSha256: hash(json),
      cargoLockSha256: hash(lock),
      manifestSha256: Object.fromEntries(
        Object.entries(manifests).map(([path, bytes]) => [path, hash(bytes)]),
      ),
      profile: { target: "wasm32-unknown-unknown", features: [] },
    },
    inputs: { metadataJson: json, cargoLock: lock, manifests },
    seeds: [
      {
        id: "encryption",
        ownerManifest: "feature/Cargo.toml",
        ownerPackage: "feature_host",
        dependencyName: "cipher",
        kind: "normal",
        target: null,
        expected: identity("cipher", "1.0.0"),
      },
    ],
  };
}

function mutateMetadata(value, change) {
  const metadata = JSON.parse(value.inputs.metadataJson);
  change(metadata);
  value.inputs.metadataJson = JSON.stringify(metadata);
  value.identity.metadataSha256 = hash(value.inputs.metadataJson);
  return value;
}

test("full selected closure retains version, checksum, edge kinds/targets, cycles and shared provenance without core siblings", () => {
  const input = fixture();
  const before = JSON.stringify(input);
  const report = collectRustFeatureScope(input);
  assert.equal(
    JSON.stringify(input),
    before,
    "Collector must not mutate supplied evidence",
  );
  assert.deepEqual(
    report.packages.map(({ name, version }) => `${name}@${version}`).sort(),
    ["cipher@1.0.0", "shared@1.0.0", "shared@2.0.0", "tester@1.0.0"],
  );
  assert.equal(report.edges.length, 5);
  assert.deepEqual(
    [
      report.roots[0].requestedFeatures,
      report.roots[0].usesDefaultFeatures,
      report.roots[0].optional,
    ],
    [[], true, false],
  );
  assert.ok(
    report.packages.every(
      (pkg) => pkg.checksum === "1".repeat(64) && pkg.source === registry,
    ),
  );
  const shared = report.packages.find(
    (pkg) => pkg.name === "shared" && pkg.version === "1.0.0",
  );
  assert.deepEqual(shared.provenance, [
    { seed: "encryption", context: "production" },
    { seed: "encryption", context: "test" },
  ]);
  const build = report.edges.find((edge) => edge.kind === "build");
  assert.equal(build.target, "cfg(unix)");
  assert.deepEqual(build.provenance, [
    { seed: "encryption", context: "build" },
    { seed: "encryption", context: "test" },
  ]);
  assert.equal(
    report.featurePrecision,
    "workspace-wide-resolved-feature-union-overapproximation",
  );
  assert.equal(report.rootCompletenessVerified, false);
  assert.equal(report.advisoryChecksPerformed, false);
  assert.ok(
    report.packages
      .find((pkg) => pkg.name === "cipher")
      .resolvedFeatures.includes("workspace-unified"),
  );
});

test("multiple explicit external roots retain separate production/test reachability", () => {
  const value = mutateMetadata(fixture(), (metadata) => {
    metadata.packages[0].dependencies.push({
      ...declaration("shared", "dev"),
      rename: "test-shared",
    });
    metadata.resolve.nodes[0].deps.push(
      dependency("test_shared", "shared2", "dev"),
    );
  });
  value.seeds.push({
    ...value.seeds[0],
    id: "test-fixture",
    dependencyName: "test_shared",
    kind: "dev",
    expected: identity("shared", "2.0.0"),
  });
  const report = collectRustFeatureScope(value);
  assert.equal(report.roots.length, 2);
  assert.ok(
    report.packages
      .find((pkg) => pkg.name === "shared" && pkg.version === "2.0.0")
      .provenance.some(
        (entry) => entry.seed === "test-fixture" && entry.context === "test",
      ),
  );
});

test("normal proc-macro and fixture roots preserve reviewed build/test origin without changing Cargo kind", () => {
  for (const originContext of ["build", "test"]) {
    const input = fixture();
    input.seeds[0].originContext = originContext;
    const report = collectRustFeatureScope(input);
    assert.equal(report.roots[0].kind, "normal");
    assert.equal(report.roots[0].originContext, originContext);
    assert.ok(
      report.packages.every((pkg) =>
        pkg.provenance.every((entry) => entry.context !== "production"),
      ),
    );
    if (originContext === "test")
      assert.ok(
        report.packages.every((pkg) =>
          pkg.provenance.every((entry) => entry.context === "test"),
        ),
      );
    assert.ok(report.edges.some((edge) => edge.kind === "normal"));
    assert.equal(report.rootCompletenessVerified, false);
  }
  assert.equal(
    collectRustFeatureScope(fixture()).roots[0].originContext,
    "production",
  );
});

test("origin contexts reject unknown values and cannot downgrade Cargo build/dev roles", () => {
  for (const [kind, originContext] of [
    ["normal", "shipping"],
    ["normal", null],
    ["build", "production"],
    ["dev", "production"],
    ["dev", "build"],
  ]) {
    const input = fixture();
    input.seeds[0].kind = kind;
    input.seeds[0].originContext = originContext;
    assert.throws(() => collectRustFeatureScope(input), /origin context/u);
  }
});

test("metadata, manifest and lock bytes must match the supplied production identity record", () => {
  for (const change of [
    (value) => {
      value.inputs.metadataJson += " ";
    },
    (value) => {
      value.inputs.cargoLock += "\n";
    },
    (value) => {
      value.inputs.manifests["feature/Cargo.toml"] += "\n";
    },
    (value) => {
      value.inputs.manifests["outside/Cargo.toml"] = "extra";
    },
    (value) => {
      delete value.identity.manifestSha256["Cargo.toml"];
      delete value.inputs.manifests["Cargo.toml"];
    },
    (value) => {
      value.identity.metadataSha256 = "not a hash";
    },
    (value) => {
      value.identity.workspaceRoot = "/different";
    },
  ]) {
    const value = fixture();
    change(value);
    assert.throws(() => collectRustFeatureScope(value));
  }
});

test("missing/ambiguous explicit roots, aliases, kinds, targets or identities fail closed", () => {
  for (const change of [
    (value) => {
      value.seeds = [];
    },
    (value) => {
      value.seeds.push(structuredClone(value.seeds[0]));
    },
    (value) => {
      value.seeds[0].ownerPackage = "missing";
    },
    (value) => {
      value.seeds[0].dependencyName = "missing";
    },
    (value) => {
      value.seeds[0].kind = "dev";
    },
    (value) => {
      value.seeds[0].target = "cfg(windows)";
    },
    (value) => {
      value.seeds[0].expected.version = "2.0.0";
    },
    (value) => {
      value.seeds[0].expected.source = null;
    },
    (value) => {
      value.seeds[0].expected.checksum = "2".repeat(64);
    },
  ]) {
    const value = fixture();
    change(value);
    assert.throws(() => collectRustFeatureScope(value));
  }
  for (const change of [
    (metadata) => {
      metadata.packages[0].dependencies.push(declaration("cipher"));
    },
    (metadata) => {
      delete metadata.packages[0].dependencies[0].features;
    },
    (metadata) => {
      delete metadata.packages[0].dependencies[0].uses_default_features;
    },
    (metadata) => {
      delete metadata.packages[0].dependencies[0].optional;
    },
    (metadata) => {
      metadata.resolve.nodes[0].deps.push(dependency("cipher", "shared1"));
    },
    (metadata) => {
      metadata.packages.push({ ...metadata.packages[0], id: "second-owner" });
      metadata.workspace_members.push("second-owner");
    },
  ])
    assert.throws(() =>
      collectRustFeatureScope(mutateMetadata(fixture(), change)),
    );
});

test("missing active nodes/packages and unknown edge provenance cannot produce a partial-success report", () => {
  for (const change of [
    (metadata) => {
      metadata.resolve = null;
    },
    (metadata) => {
      metadata.resolve.nodes = metadata.resolve.nodes.filter(
        (node) => node.id !== "shared2",
      );
    },
    (metadata) => {
      metadata.packages = metadata.packages.filter(
        (pkg) => pkg.id !== "shared2",
      );
    },
    (metadata) => {
      metadata.resolve.nodes.push(metadata.resolve.nodes[1]);
    },
    (metadata) => {
      metadata.packages.push(metadata.packages[1]);
    },
    (metadata) => {
      metadata.resolve.nodes[1].deps[0].dep_kinds = [];
    },
    (metadata) => {
      metadata.resolve.nodes[1].deps[0].dep_kinds[0].kind = "unknown";
    },
    (metadata) => {
      delete metadata.resolve.nodes[1].deps[0].dep_kinds[0].target;
    },
    (metadata) => {
      metadata.packages[1].checksum = "2".repeat(64);
    },
    (metadata) => {
      metadata.packages[1].version = "9.0.0";
    },
  ])
    assert.throws(() =>
      collectRustFeatureScope(mutateMetadata(fixture(), change)),
    );
});

test("relative and metadata owner escapes are rejected on POSIX and Windows", () => {
  for (const root of ["/checkout", "F:/Temp/project"]) {
    assert.equal(collectRustFeatureScope(fixture(root)).roots.length, 1);
    for (const escaped of [
      "../other/Cargo.toml",
      "/other/Cargo.toml",
      "C:/other/Cargo.toml",
      "feature/../../Cargo.toml",
      "feature\\Cargo.toml",
      "feature/notCargo.toml",
    ])
      assert.throws(() => {
        const value = fixture(root);
        value.seeds[0].ownerManifest = escaped;
        collectRustFeatureScope(value);
      });
    assert.throws(() =>
      collectRustFeatureScope(
        mutateMetadata(fixture(root), (metadata) => {
          metadata.packages[0].manifest_path = `${root}/../other/Cargo.toml`;
        }),
      ),
    );
  }
});

test("source and checksum identity parser preserves distinct package versions and rejects ambiguity", () => {
  const lock = fixture().inputs.cargoLock;
  assert.equal(lockIdentities(lock).size, 6);
  assert.throws(() =>
    lockIdentities(lock.replace("version = 4", "version = 99")),
  );
  assert.throws(() =>
    lockIdentities(
      lock +
        '\n[[package]]\nname = "cipher"\nversion = "1.0.0"\nsource = "registry+https://example.invalid/index"\n',
    ),
  );
  assert.throws(() =>
    lockIdentities(
      lock.replace('checksum = "' + "1".repeat(64) + '"', 'checksum = "bad"'),
    ),
  );
  assert.throws(() =>
    lockIdentities(
      lock.replace('checksum = "' + "1".repeat(64) + '"', "checksum = 123"),
    ),
  );
  assert.throws(() =>
    lockIdentities(lock.replace(`source = "${registry}"`, "source = false")),
  );
});

test("reachable local patches require verified in-workspace manifest identities", () => {
  const value = mutateMetadata(fixture(), (metadata) => {
    metadata.packages.push({
      id: "patch",
      name: "local_patch",
      version: "1.0.0",
      source: null,
      manifest_path: "/checkout/patch/Cargo.toml",
      dependencies: [],
    });
    metadata.resolve.nodes.push({ id: "patch", features: [], deps: [] });
    metadata.resolve.nodes[1].deps.push(dependency("patch", "patch"));
  });
  value.inputs.cargoLock +=
    '\n[[package]]\nname = "local_patch"\nversion = "1.0.0"\n';
  value.identity.cargoLockSha256 = hash(value.inputs.cargoLock);
  value.inputs.manifests["patch/Cargo.toml"] =
    '[package]\nname = "local_patch"\nversion = "1.0.0"\n';
  value.identity.manifestSha256["patch/Cargo.toml"] = hash(
    value.inputs.manifests["patch/Cargo.toml"],
  );
  const report = collectRustFeatureScope(value);
  assert.equal(
    report.packages.find((pkg) => pkg.name === "local_patch").manifest,
    "patch/Cargo.toml",
  );
  const missing = structuredClone(value);
  delete missing.inputs.manifests["patch/Cargo.toml"];
  delete missing.identity.manifestSha256["patch/Cargo.toml"];
  assert.throws(
    () => collectRustFeatureScope(missing),
    /Missing local dependency manifest identity/u,
  );
  const escaped = mutateMetadata(structuredClone(value), (metadata) => {
    metadata.packages.at(-1).manifest_path = "/checkout/../other/Cargo.toml";
  });
  assert.throws(() => collectRustFeatureScope(escaped), /escapes/u);
});

test("deterministic output is independent of resolved/package/dependency ordering", () => {
  const expected = collectRustFeatureScope(fixture());
  const value = mutateMetadata(fixture(), (metadata) => {
    metadata.packages.reverse();
    metadata.resolve.nodes.reverse();
    for (const node of metadata.resolve.nodes) node.deps.reverse();
  });
  const actual = collectRustFeatureScope(value);
  delete expected.identity.metadataSha256;
  delete actual.identity.metadataSha256;
  assert.deepEqual(actual, expected);
});
