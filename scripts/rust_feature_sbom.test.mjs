import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { collectRustFeatureScope } from "./rust_feature_scope.mjs";
import { exportRustFeatureSbom as exportUnchecked } from "./rust_feature_sbom.mjs";
import { validateRustFeatureSbom } from "./rust_feature_sbom_validate.mjs";

// Every successful exporter fixture must satisfy the real pinned schema too.
function exportRustFeatureSbom(profiles) {
  const result = exportUnchecked(profiles);
  assert.equal(
    validateRustFeatureSbom(result.bomJson).officialSbomSchemaValidated,
    true,
  );
  return result;
}

const registry = "registry+https://github.com/rust-lang/crates.io-index";
const git =
  "git+https://github.com/example/feature?rev=" +
  "a".repeat(40) +
  "#" +
  "a".repeat(40);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const key = (name, source = registry) =>
  JSON.stringify([name, "1.0.0", source]);
const clone = (value) => structuredClone(value);

function fixture(profileId = "windows", alteredPath = false) {
  const root = "/fixture";
  const sourceBytes = {
    "Cargo.toml": '[workspace]\nmembers = ["feature", "patch"]\n',
    "feature/Cargo.toml":
      '[package]\nname = "feature"\nversion = "1.0.0"\n[dependencies]\nalpha = "1"\n',
    "patch/Cargo.toml":
      '[package]\nname = "patch"\nversion = "1.0.0"\n' +
      (alteredPath ? "# separately bound source\n" : ""),
    "feature/src/lib.rs": "pub fn selected() { alpha::call(); }\n",
    "patch/src/lib.rs": "pub fn local_version() -> u8 { 1 }\n",
  };
  const crates = [
    ["feature", null],
    ["alpha", registry],
    ["git_feature", git],
    ["patch", null],
    ["build_tool", registry],
    ["test_tool", registry],
    ["unrelated", registry],
  ];
  const checksum = "1".repeat(64);
  const cargoLock =
    "version = 4\n" +
    crates
      .map(
        ([name, source]) =>
          '\n[[package]]\nname = "' +
          name +
          '"\nversion = "1.0.0"\n' +
          (source === null ? "" : 'source = "' + source + '"\n') +
          (source === registry ? 'checksum = "' + checksum + '"\n' : ""),
      )
      .join("");
  const declaration = (name) => ({
    name,
    rename: null,
    kind: null,
    target: null,
    features: ["selected"],
    uses_default_features: false,
    optional: true,
  });
  const packages = crates.map(([name, source]) => ({
    id: name,
    name,
    version: "1.0.0",
    source,
    manifest_path:
      source === null
        ? root + "/" + name + "/Cargo.toml"
        : "/cache/" + name + "/Cargo.toml",
    dependencies:
      name === "feature"
        ? [declaration("alpha"), declaration("unrelated")]
        : [],
  }));
  const edge = (name, kind = null, target = null) => ({
    name,
    pkg: name,
    dep_kinds: [{ kind, target }],
  });
  const nodes = packages.map((pkg) => ({
    id: pkg.id,
    features: pkg.id === "alpha" ? ["selected"] : [],
    deps:
      pkg.id === "feature"
        ? [edge("alpha"), edge("unrelated")]
        : pkg.id === "alpha"
          ? [
              edge("git_feature"),
              edge("build_tool", "build", "cfg(windows)"),
              edge("test_tool", "dev"),
            ]
          : pkg.id === "git_feature"
            ? [edge("patch")]
            : [],
  }));
  const profile = {
    target:
      profileId === "windows"
        ? "x86_64-pc-windows-msvc"
        : "aarch64-linux-android",
    features: ["feature/inference"],
  };
  const metadataJson = JSON.stringify({
    version: 1,
    workspace_root: root,
    workspace_members: ["feature", "patch"],
    target_directory: root + "/target/" + profileId,
    packages,
    resolve: { nodes },
  });
  const manifests = Object.fromEntries(
    Object.entries(sourceBytes).filter(([path]) => path.endsWith("Cargo.toml")),
  );
  const identity = {
    metadataSha256: digest(metadataJson),
    cargoLockSha256: digest(cargoLock),
    workspaceRoot: root,
    manifestSha256: Object.fromEntries(
      Object.entries(manifests).map(([path, text]) => [path, digest(text)]),
    ),
    profile,
  };
  const seed = {
    id: "selected-alpha",
    ownerPackage: "feature",
    ownerManifest: "feature/Cargo.toml",
    dependencyName: "alpha",
    kind: "normal",
    target: null,
    originContext: "production",
    expected: { name: "alpha", version: "1.0.0", source: registry, checksum },
  };
  const config = {
    schemaVersion: 1,
    feature: "fixture-feature",
    reviewTextIdentity: "utf8-lf",
    sourceRevision: { base: "b".repeat(40), head: "c".repeat(40) },
    cargoLockSha256: digest(cargoLock),
    completeness: {
      status: "incomplete",
      unresolved: [
        {
          id: "native-components",
          description: "Native C/C++ inventory is not claimed.",
        },
      ],
    },
    sourceFiles: Object.fromEntries(
      Object.entries(sourceBytes).map(([path, text]) => [path, digest(text)]),
    ),
    profiles: ["windows", "android"].map((id) => ({
      id,
      target:
        id === "windows" ? "x86_64-pc-windows-msvc" : "aarch64-linux-android",
      features: ["feature/inference"],
      metadataSha256: "e".repeat(64),
    })),
    seeds: [
      {
        ...seed,
        profiles: ["windows", "android"],
        review: { status: "source-traced", basis: "source-call-or-schema" },
        evidence: [{ path: "feature/src/lib.rs", lines: [1] }],
      },
    ],
  };
  const configJson = JSON.stringify(config);
  const inputs = { metadataJson, cargoLock, manifests };
  const reportJson = JSON.stringify(
    collectRustFeatureScope({ identity, inputs, seeds: [seed] }),
  );
  return {
    id: "pr1/" + profileId,
    reportJson,
    sha256: digest(reportJson),
    binding: {
      configJson,
      configSha256: digest(configJson),
      profileId,
      sourceBytes,
      collection: { identity, inputs },
    },
  };
}

function mutateGraph(input, change) {
  const report = JSON.parse(input.reportJson);
  change(report);
  input.reportJson = JSON.stringify(report);
  input.sha256 = digest(input.reportJson);
}
function mutateConfig(input, change) {
  const config = JSON.parse(input.binding.configJson);
  change(config);
  input.binding.configJson = JSON.stringify(config);
  input.binding.configSha256 = digest(input.binding.configJson);
}
const metadataProperty = (bom, name) =>
  bom.metadata.properties.find((p) => p.name === "openchat:" + name)?.value;
const componentProperty = (component, name) =>
  component.properties.find((p) => p.name === "openchat:" + name)?.value;
function rederive(input) {
  const config = JSON.parse(input.binding.configJson);
  const report = collectRustFeatureScope({
    ...input.binding.collection,
    seeds: config.seeds.filter((seed) =>
      seed.profiles.includes(input.binding.profileId),
    ),
  });
  input.reportJson = JSON.stringify(report);
  input.sha256 = digest(input.reportJson);
}

test("exports only selected components, exact checksums and Git identities without native/release claims", () => {
  const input = fixture();
  const before = JSON.stringify(input);
  const result = exportRustFeatureSbom([input]);
  const bom = result.bom;
  assert.equal(bom.bomFormat, "CycloneDX");
  assert.equal(bom.specVersion, "1.6");
  assert.equal(result.componentCount, 5);
  assert.deepEqual(bom.components.map((c) => c.name).sort(), [
    "alpha",
    "build_tool",
    "git_feature",
    "patch",
    "test_tool",
  ]);
  assert(
    !bom.components.some((c) => ["feature", "unrelated"].includes(c.name)),
  );
  const alpha = bom.components.find((c) => c.name === "alpha");
  assert.deepEqual(alpha.hashes, [{ alg: "SHA-256", content: "1".repeat(64) }]);
  assert.equal(alpha.purl, "pkg:cargo/alpha@1.0.0");
  const gitComponent = bom.components.find((c) => c.name === "git_feature");
  assert.equal(gitComponent.purl, undefined);
  assert.equal(gitComponent.hashes, undefined);
  assert.deepEqual(gitComponent.externalReferences, [
    { type: "vcs", url: git.slice(4) },
  ]);
  assert.equal(componentProperty(gitComponent, "git-revision"), "a".repeat(40));
  assert.equal(
    componentProperty(gitComponent, "advisory-coverage"),
    "not-proven",
  );
  for (const claim of [
    "advisoryAcceptance",
    "releaseAcceptance",
    "rootCompletenessVerified",
    "wholeRepositoryCoverage",
    "completeApkNativeInventory",
    "networkRequestsPerformed",
  ])
    assert.equal(result[claim], false);
  for (const claim of [
    "root-completeness-verified",
    "release-acceptance",
    "whole-repository-coverage",
    "complete-apk-native-inventory",
    "collection-freshness-verified",
    "producer-authenticity-verified",
  ])
    assert.equal(metadataProperty(bom, claim), "false");
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.sha256, digest(result.bomJson));
  assert.deepEqual(JSON.parse(result.bomJson), bom);
  assert(
    !result.bomJson.includes("/fixture"),
    "Absolute producer workspace paths must not leak into output",
  );
});

test("preserves dependency edges, source roles, feature requests and all binding identities", () => {
  const input = fixture();
  const result = exportRustFeatureSbom([input]);
  const trace = JSON.parse(metadataProperty(result.bom, "profile-graphs"))[0];
  const report = JSON.parse(input.reportJson);
  assert.equal(trace.reportSha256, input.sha256);
  assert.equal(trace.configSha256, input.binding.configSha256);
  assert.deepEqual(trace.identity, report.identity);
  assert.equal(trace.completeness.status, "incomplete");
  assert.deepEqual(
    trace.roots.map(({ componentRef, ...root }) => root),
    report.roots,
  );
  assert.deepEqual(
    trace.edges.map(({ fromRef, toRef, ...edge }) => edge),
    report.edges,
  );
  const refs = new Set(result.bom.components.map((c) => c["bom-ref"]));
  for (const root of trace.roots) assert(refs.has(root.componentRef));
  for (const edge of trace.edges) {
    assert(refs.has(edge.fromRef) && refs.has(edge.toRef));
    assert(
      result.bom.dependencies
        .find((d) => d.ref === edge.fromRef)
        .dependsOn.includes(edge.toRef),
    );
  }
  assert.deepEqual(
    [
      ...new Set(
        trace.edges.flatMap((edge) => edge.provenance.map((p) => p.context)),
      ),
    ].sort(),
    ["build", "production", "test"],
  );
  assert(
    trace.edges.some(
      (edge) => edge.kind === "build" && edge.target === "cfg(windows)",
    ),
  );
  assert(trace.edges.some((edge) => edge.kind === "dev"));
  assert.equal(result.bom.dependencies.length, refs.size);
});

test("deterministic profile ordering merges identical identities but not different path sources", () => {
  const a = fixture(),
    b = fixture("android");
  assert.equal(
    exportRustFeatureSbom([a, b]).bomJson,
    exportRustFeatureSbom([b, a]).bomJson,
  );
  assert.equal(exportRustFeatureSbom([a, b]).componentCount, 5);
  const changed = exportRustFeatureSbom([a, fixture("android", true)]);
  assert.equal(changed.componentCount, 6);
  const paths = changed.bom.components.filter((c) => c.name === "patch");
  assert.notEqual(paths[0]["bom-ref"], paths[1]["bom-ref"]);
  assert.notEqual(
    componentProperty(paths[0], "path-manifest-sha256"),
    componentProperty(paths[1], "path-manifest-sha256"),
  );
});

for (const revisionOnly of [false, true]) {
  test(
    "same-manifest path packages retain distinct " +
      (revisionOnly ? "review revisions" : "reviewed source snapshots"),
    () => {
      const first = fixture();
      const second = fixture("android");
      if (revisionOnly) {
        mutateConfig(second, (config) => {
          config.sourceRevision.head = "d".repeat(40);
        });
      } else {
        second.binding.sourceBytes["patch/src/lib.rs"] =
          "pub fn local_version() -> u8 { 2 }\n";
        mutateConfig(second, (config) => {
          config.sourceFiles["patch/src/lib.rs"] = digest(
            second.binding.sourceBytes["patch/src/lib.rs"],
          );
        });
      }
      assert.equal(
        first.binding.sourceBytes["patch/Cargo.toml"],
        second.binding.sourceBytes["patch/Cargo.toml"],
      );
      const single = exportRustFeatureSbom([first]);
      const result = exportRustFeatureSbom([first, second]);
      const paths = result.bom.components.filter(
        (component) => component.name === "patch",
      );
      assert.equal(
        paths.length,
        2,
        "Same manifest is not a complete path-package source identity",
      );
      assert.notEqual(paths[0]["bom-ref"], paths[1]["bom-ref"]);
      assert.notEqual(
        componentProperty(paths[0], "reviewed-source-snapshot-sha256"),
        componentProperty(paths[1], "reviewed-source-snapshot-sha256"),
      );
      for (const original of single.bom.components.filter(
        (component) => component.name !== "patch",
      )) {
        const merged = result.bom.components.filter(
          (component) => component.name === original.name,
        );
        assert.equal(
          merged.length,
          1,
          "Canonical registry/Git identities must still deduplicate",
        );
        assert.equal(
          merged[0]["bom-ref"],
          original["bom-ref"],
          "Canonical external refs must remain stable",
        );
      }
      const traces = JSON.parse(metadataProperty(result.bom, "profile-graphs"));
      const targets = traces.map(
        (trace) =>
          trace.edges.find((edge) =>
            edge.to.startsWith("path:patch/Cargo.toml#"),
          ).toRef,
      );
      assert.notEqual(
        targets[0],
        targets[1],
        "Per-profile edges must retain their own path source",
      );
      assert.equal(
        result.bomJson,
        exportRustFeatureSbom([second, first]).bomJson,
      );
    },
  );
}

test("test-only source origin stays distinct from normal Cargo dependency kind", () => {
  const input = fixture();
  mutateConfig(input, (config) => {
    config.seeds[0].originContext = "test";
  });
  rederive(input);
  const result = exportRustFeatureSbom([input]);
  const trace = JSON.parse(metadataProperty(result.bom, "profile-graphs"))[0];
  assert.equal(trace.roots[0].kind, "normal");
  assert.equal(trace.roots[0].originContext, "test");
  assert(
    trace.edges.every((edge) =>
      edge.provenance.every((p) => p.context === "test"),
    ),
  );
});

test("portable normalized source review still preserves current raw-byte bindings", () => {
  const input = fixture();
  const { collection, sourceBytes } = input.binding;
  for (const path of Object.keys(sourceBytes)) {
    sourceBytes[path] = sourceBytes[path].replaceAll("\n", "\r\n");
    if (path.endsWith("Cargo.toml")) {
      collection.inputs.manifests[path] = sourceBytes[path];
      collection.identity.manifestSha256[path] = digest(sourceBytes[path]);
    }
  }
  collection.inputs.cargoLock = collection.inputs.cargoLock.replaceAll(
    "\n",
    "\r\n",
  );
  collection.identity.cargoLockSha256 = digest(collection.inputs.cargoLock);
  rederive(input);
  const result = exportRustFeatureSbom([input]);
  const trace = JSON.parse(metadataProperty(result.bom, "profile-graphs"))[0];
  assert.equal(
    trace.identity.cargoLockSha256,
    digest(collection.inputs.cargoLock),
  );
  assert.equal(
    trace.sourceRawSha256["feature/src/lib.rs"],
    digest(sourceBytes["feature/src/lib.rs"]),
  );
  assert.notEqual(
    trace.sourceRawSha256["feature/src/lib.rs"],
    JSON.parse(input.binding.configJson).sourceFiles["feature/src/lib.rs"],
  );
});

for (const [label, change] of [
  [
    "report bytes",
    (v) => {
      v.reportJson += " ";
    },
  ],
  [
    "config bytes",
    (v) => {
      v.binding.configJson += " ";
    },
  ],
  [
    "source bytes",
    (v) => {
      v.binding.sourceBytes["feature/src/lib.rs"] += "// drift";
    },
  ],
  [
    "source set",
    (v) => {
      v.binding.sourceBytes["unrelated.rs"] = "unrelated";
    },
  ],
  [
    "lock bytes",
    (v) => {
      v.binding.collection.inputs.cargoLock += "# drift";
    },
  ],
  [
    "metadata bytes",
    (v) => {
      v.binding.collection.inputs.metadataJson += " ";
    },
  ],
  [
    "metadata identity",
    (v) => {
      v.binding.collection.identity.metadataSha256 = "f".repeat(64);
    },
  ],
  [
    "manifest bytes",
    (v) => {
      v.binding.collection.inputs.manifests["patch/Cargo.toml"] += "# drift";
    },
  ],
  [
    "profile selection",
    (v) => {
      v.binding.profileId = "android";
    },
  ],
  [
    "config target",
    (v) =>
      mutateConfig(v, (c) => {
        c.profiles[0].target = "other-target";
      }),
  ],
  [
    "config features",
    (v) =>
      mutateConfig(v, (c) => {
        c.profiles[0].features = [];
      }),
  ],
  [
    "root subset",
    (v) =>
      mutateConfig(v, (c) => {
        c.seeds[0].dependencyName = "unrelated";
        c.seeds[0].expected.name = "unrelated";
      }),
  ],
  [
    "graph feature request",
    (v) =>
      mutateGraph(v, (r) => {
        r.roots[0].requestedFeatures = [];
      }),
  ],
  [
    "graph checksum",
    (v) =>
      mutateGraph(v, (r) => {
        r.packages.find((p) => p.name === "alpha").checksum = "2".repeat(64);
      }),
  ],
  [
    "omitted transitive component",
    (v) =>
      mutateGraph(v, (r) => {
        const removed = r.packages.find((p) => p.name === "build_tool").key;
        r.packages = r.packages.filter((p) => p.key !== removed);
        r.edges = r.edges.filter((edge) => edge.to !== removed);
      }),
  ],
  [
    "false root completeness",
    (v) =>
      mutateGraph(v, (r) => {
        r.rootCompletenessVerified = true;
      }),
  ],
  [
    "false complete review",
    (v) =>
      mutateConfig(v, (c) => {
        c.completeness.status = "complete";
      }),
  ],
  [
    "missing source binding",
    (v) => {
      delete v.binding;
    },
  ],
]) {
  test("rejects " + label + " mismatch without exporting", () => {
    const input = fixture();
    change(input);
    assert.throws(() => exportRustFeatureSbom([input]));
  });
}

test("unrelated workspace component injection cannot become part of selected SBOM", () => {
  const input = fixture();
  mutateGraph(input, (r) => {
    const pkg = clone(r.packages.find((p) => p.name === "alpha"));
    pkg.name = "unrelated";
    pkg.key = key("unrelated");
    r.packages.push(pkg);
  });
  assert.throws(
    () => exportRustFeatureSbom([input]),
    /reach|provenance|Selected graph/iu,
  );
});

test("source context downgrade cannot turn build tooling into production", () => {
  const input = fixture();
  mutateGraph(input, (r) => {
    r.packages.find((p) => p.name === "build_tool").provenance[0].context =
      "production";
  });
  assert.throws(() => exportRustFeatureSbom([input]), /provenance/iu);
});

test("historical profile metadata hash is not incorrectly required for a new bound collection", () => {
  const input = fixture();
  assert.notEqual(
    JSON.parse(input.binding.configJson).profiles[0].metadataSha256,
    input.binding.collection.identity.metadataSha256,
  );
  assert.equal(exportRustFeatureSbom([input]).componentCount, 5);
});

test("exporter has no IO/transport or caller-controlled acceptance escape hatch", () => {
  const source = readFileSync(
    new URL("./rust_feature_sbom.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /node:(?:fs|child_process|https|http)|fetch\(|process\.env|process\.argv/u,
  );
  const input = fixture();
  input.releaseAcceptance = true;
  const result = exportRustFeatureSbom([input]);
  assert.equal(result.releaseAcceptance, false);
  assert.equal(result.advisoryAcceptance, false);
});
