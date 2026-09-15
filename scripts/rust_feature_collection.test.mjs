import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  collectRustFeatureMetadataFixture,
  parseRustCollectionArgs,
  prepareRustFeatureCollection,
  RUST_COLLECTION_LIMITS,
} from "./rust_feature_collection.mjs";
import { runRustFeatureAdvisoryFixture } from "./rust_feature_advisory_runner.mjs";
import { runRustFeatureCiFixture } from "./rust_feature_ci.mjs";

test("reviewed scope reaches fixture advisories through the executable CI without granting real acceptance", async (t) => {
  const f = fixture(t);
  addFixtureReview(f);
  let requests = 0;
  const report = await runRustFeatureCiFixture(
    { ...f.args, mode: "check-scoped" },
    {
      spawn: f.spawn,
      transport: async (body) => {
        requests++;
        return {
          status: 200,
          responseJson: JSON.stringify({
            results: JSON.parse(body).queries.map(() => ({})),
          }),
        };
      },
    },
  );
  assert.equal(report.collection.rootCompletenessVerified, true);
  assert.equal(report.advisory.status, "completed");
  assert.equal(requests, 1);
  assert.equal(report.networkRequestsPerformed, false);
  assert.equal(report.passed, false);
  assert.equal(report.releaseAcceptance, false);
  assert.ok(!report.nonAcceptanceReasons.includes("incomplete-feature-scope"));
  assert.ok(report.nonAcceptanceReasons.includes("offline-fixture"));
});

function addFixtureReview(f) {
  const receipt = {
    schemaVersion: 1,
    configSha256: hash(readFileSync(f.configPath)),
    boundary:
      "Fixture-only feature call, exact dependency owner and both declared profiles.",
    units: [
      {
        id: "fixture-owner",
        disposition: "external-owner-edges",
        explanation:
          "Fixture source review selects alpha and excludes the unrelated sibling dependency.",
        profiles: ["default", "inference"],
        sources: Object.keys(f.config.sourceFiles).map((path) => ({
          path,
          lines: [1],
        })),
        seeds: ["alpha"],
      },
    ],
    resolutions: [
      {
        id: "fixture-gap",
        explanation:
          "Fixture nested ownership is resolved by the explicit feature owner unit.",
        units: ["fixture-owner"],
      },
    ],
  };
  const path = join(
    f.repo,
    "scripts/rust_feature_review." + f.args.scope + ".json",
  );
  writeFileSync(path, JSON.stringify(receipt));
  return { path, receipt };
}

test("actual collector carries a validated versioned source review after every offline stage passes", (t) => {
  const f = fixture(t);
  const { path } = addFixtureReview(f);
  const report = collectRustFeatureMetadataFixture(f.args, f.spawn);
  assert.equal(report.collectionPassed, true);
  assert.equal(report.rootCompletenessVerified, true);
  assert.deepEqual(report.completeness, { status: "complete", unresolved: [] });
  assert.equal(report.sourceReview.receipt.path, resolve(path));
  assert.equal(report.sourceReview.receipt.sha256, hash(readFileSync(path)));
  assert.ok(report.inputs.some((input) => input.path === resolve(path)));
  assert.equal(report.sourceReview.automaticSourceAnalysis, false);
  assert.equal(report.producerKind, "offline-fixture");
  assert.equal(report.collectionProducerExecuted, false);
  assert.equal(report.advisoryChecksPerformed, false);
  assert.equal(report.releaseAcceptance, false);
});

test("stale review is rejected before collection subprocesses or evidence creation", (t) => {
  const f = fixture(t);
  const { path, receipt } = addFixtureReview(f);
  receipt.configSha256 = "e".repeat(64);
  writeFileSync(path, JSON.stringify(receipt));
  assert.throws(
    () => collectRustFeatureMetadataFixture(f.args, f.spawn),
    /Stale source-review/,
  );
  assert.equal(f.calls.length, 0);
  assert.deepEqual(readdirSync(f.output), []);
});

test("a review changed during collection cannot produce a complete source-scope result", (t) => {
  const f = fixture(t);
  const { path } = addFixtureReview(f);
  const report = collectRustFeatureMetadataFixture(f.args, (...args) => {
    const output = f.spawn(...args);
    writeFileSync(path, "{}");
    return output;
  });
  assert.equal(report.collectionPassed, false);
  assert.equal(report.sourceUnchanged, false);
  assert.equal(report.rootCompletenessVerified, false);
  assert.equal(report.completeness.status, "incomplete");
  assert.equal(report.collection, null);
});

test("executable CI composes actual offline collection/schema gates and refuses incomplete scope before egress", async (t) => {
  const f = fixture(t);
  let networkCalls = 0;
  const report = await runRustFeatureCiFixture(
    { ...f.args, mode: "check-scoped" },
    {
      spawn: f.spawn,
      transport: async () => {
        networkCalls++;
        throw new Error("No network permitted");
      },
    },
  );
  assert.equal(report.collection.collectionPassed, true);
  assert.equal(report.sbomValidation.officialSbomSchemaValidated, true);
  assert.equal(report.passed, false);
  assert.equal(report.releaseAcceptance, false);
  assert.deepEqual(report.nonAcceptanceReasons, ["incomplete-feature-scope"]);
  assert.equal(report.networkRequestsPerformed, false);
  assert.equal(networkCalls, 0);
  assert.ok(existsSync(join(report.outputDirectory, "summary.json")));
});

test("executable CI never calls advisory transport after a real collector failure", async (t) => {
  const f = fixture(t);
  let calls = 0;
  const report = await runRustFeatureCiFixture(
    { ...f.args, mode: "check-scoped" },
    {
      spawn: () => ({ status: 2, stdout: "", stderr: "fixture failure" }),
      transport: async () => {
        calls++;
        throw new Error("No network permitted");
      },
    },
  );
  assert.equal(report.collection.collectionPassed, false);
  assert.equal(report.passed, false);
  assert.equal(calls, 0);
  assert.deepEqual(report.nonAcceptanceReasons, ["collection-not-verified"]);
});

test("executable CI rejects stale pins before producer, network or report creation", async (t) => {
  const f = fixture(t);
  let calls = 0;
  await assert.rejects(() =>
    runRustFeatureCiFixture(
      { ...f.args, configSha256: "b".repeat(64), mode: "check-scoped" },
      {
        spawn: () => {
          calls++;
          throw new Error("No producer permitted");
        },
        transport: async () => {
          calls++;
          throw new Error("No network permitted");
        },
      },
    ),
  );
  assert.equal(calls, 0);
  assert.deepEqual(readdirSync(f.args.outputDirectory), []);
});

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const registry = "registry+https://github.com/rust-lang/crates.io-index";
const root = fileURLToPath(new URL("../", import.meta.url));
function fixture(t, scope = "pr1") {
  const base = mkdtempSync(join(tmpdir(), "rust-collection-test-"));
  t.after(() => {
    assert(relative(tmpdir(), base).startsWith("rust-collection-test-"));
    rmSync(base, { recursive: true });
  });
  const repo = join(base, "repo"),
    output = join(base, "reports"),
    tools = join(base, "tools");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(repo, "feature"));
  mkdirSync(output);
  mkdirSync(tools);
  writeFileSync(join(tools, "cargo"), "fixture cargo: never executed");
  writeFileSync(join(tools, "rustc"), "fixture rustc: never executed");
  const source = {
    "Cargo.toml": '[workspace]\nmembers = ["feature"]\n',
    "feature/Cargo.toml":
      '[package]\nname = "feature_host"\nversion = "0.1.0"\n',
    "feature/lib.rs": "pub fn feature() {}\n",
  };
  for (const [path, bytes] of Object.entries(source))
    writeFileSync(join(repo, path), bytes);
  const packages = ["alpha", "unrelated"].map((name) => ({
    id: name,
    name,
    version: "1.2.3",
    source: registry,
    dependencies: [],
  }));
  const owner = {
    id: "owner",
    name: "feature_host",
    version: "0.1.0",
    source: null,
    manifest_path: join(repo, "feature/Cargo.toml"),
    dependencies: packages.map(({ name }) => ({
      name,
      rename: null,
      kind: null,
      target: null,
      features: [],
      uses_default_features: true,
      optional: false,
    })),
  };
  const lock =
    "version = 4\n\n" +
    [owner, ...packages]
      .map(
        (pkg) =>
          '[[package]]\nname = "' +
          pkg.name +
          '"\nversion = "' +
          pkg.version +
          '"\n' +
          (pkg.source
            ? 'source = "' +
              pkg.source +
              '"\nchecksum = "' +
              "a".repeat(64) +
              '"\n'
            : ""),
      )
      .join("\n");
  writeFileSync(join(repo, "Cargo.lock"), lock);
  const metadata = {
    version: 1,
    workspace_root: repo,
    workspace_members: ["owner"],
    packages: [owner, ...packages],
    resolve: {
      nodes: [
        {
          id: "owner",
          features: [],
          deps: packages.map((pkg) => ({
            name: pkg.name,
            pkg: pkg.id,
            dep_kinds: [{ kind: null, target: null }],
          })),
        },
        ...packages.map((pkg) => ({ id: pkg.id, features: [], deps: [] })),
      ],
    },
  };
  const config = {
    schemaVersion: 1,
    feature: "fixture-" + scope,
    reviewTextIdentity: "utf8-lf",
    sourceRevision: { base: "a".repeat(40), head: "b".repeat(40) },
    cargoLockSha256: hash(lock),
    completeness: {
      status: "incomplete",
      unresolved: [{ id: "fixture-gap", description: "No release coverage." }],
    },
    sourceFiles: Object.fromEntries(
      Object.entries(source).map(([path, bytes]) => [path, hash(bytes)]),
    ),
    profiles: [
      {
        id: "default",
        target: "x86_64-pc-windows-msvc",
        features: [],
        metadataSha256: null,
      },
      {
        id: "inference",
        target: "aarch64-linux-android",
        features: ["feature_host/inference"],
        metadataSha256: null,
      },
    ],
    seeds: [
      {
        id: "alpha",
        ownerManifest: "feature/Cargo.toml",
        ownerPackage: "feature_host",
        dependencyName: "alpha",
        kind: "normal",
        target: null,
        originContext: "production",
        profiles: ["default", "inference"],
        expected: {
          name: "alpha",
          version: "1.2.3",
          source: registry,
          checksum: "a".repeat(64),
        },
        review: { status: "source-traced", basis: "source-call-or-schema" },
        evidence: [{ path: "feature/lib.rs", lines: [1] }],
      },
    ],
  };
  const configPath = join(
    repo,
    "scripts/rust_feature_scope." + scope + ".json",
  );
  const args = {
    repositoryRoot: repo,
    outputDirectory: output,
    cargoExecutable: join(tools, "cargo"),
    scope,
    configSha256: "",
    mode: "collect-offline",
  };
  function saveConfig() {
    writeFileSync(configPath, JSON.stringify(config));
    args.configSha256 = hash(readFileSync(configPath));
  }
  saveConfig();
  const calls = [];
  const spawn = (executable, argv, options) => {
    calls.push({ executable, argv, options });
    const emitted = structuredClone(metadata);
    emitted.resolve.nodes[0].features = argv.includes("--features")
      ? ["inference"]
      : [];
    return {
      status: 0,
      signal: null,
      stdout: Buffer.from(JSON.stringify(emitted)),
      stderr: Buffer.alloc(0),
    };
  };
  return {
    base,
    repo,
    output,
    tools,
    configPath,
    config,
    args,
    metadata,
    saveConfig,
    calls,
    spawn,
  };
}
for (const scope of ["pr1", "pr2"]) {
  test(
    scope +
      ": collects every configured profile with fixed offline commands and exports selected SBOM only",
    (t) => {
      const f = fixture(t, scope);
      const report = collectRustFeatureMetadataFixture(f.args, f.spawn);
      assert.equal(
        report.collectionPassed,
        true,
        JSON.stringify(report.failure),
      );
      assert.equal(report.collectionProducerExecuted, false);
      assert.equal(report.producerKind, "offline-fixture");
      for (const field of [
        "advisoryChecksPerformed",
        "releaseAcceptance",
        "rootCompletenessVerified",
        "wholeRepositoryCoverage",
        "completeApkNativeInventory",
      ])
        assert.equal(report[field], false, field);
      assert.equal(report.officialSbomSchemaValidated, true);
      assert.equal(report.sourceUnchanged, true);
      assert.deepEqual(report.completeness, f.config.completeness);
      assert.equal(f.calls.length, 2);
      for (let i = 0; i < f.calls.length; i++) {
        const call = f.calls[i],
          profile = f.config.profiles[i];
        assert.equal(call.executable, f.args.cargoExecutable);
        assert.deepEqual(call.argv, [
          "metadata",
          "--locked",
          "--offline",
          "--format-version",
          "1",
          "--manifest-path",
          join(f.repo, "Cargo.toml"),
          "--filter-platform",
          profile.target,
          ...(profile.features.length
            ? ["--features", profile.features.join(",")]
            : []),
        ]);
        assert.equal(call.options.cwd, f.repo);
        assert.equal(call.options.shell, false);
        assert.equal(call.options.windowsHide, true);
        assert.equal(
          call.options.timeout,
          RUST_COLLECTION_LIMITS.profileTimeoutMs,
        );
        assert.equal(call.options.env.CARGO_NET_OFFLINE, "true");
        assert.equal(call.options.env.RUSTC, join(f.tools, "rustc"));
        assert.equal(call.options.env.RUSTC_WRAPPER, "");
        assert.equal(call.options.env.RUSTC_WORKSPACE_WRAPPER, "");
      }
      const collectionBytes = readFileSync(report.collection.path);
      assert.equal(hash(collectionBytes), report.collection.sha256);
      const collection = JSON.parse(collectionBytes);
      assert.deepEqual(Object.keys(collection).sort(), [
        "cargoLockSha256",
        "configSha256",
        "profiles",
        "schemaVersion",
        "scope",
        "sourceSha256",
      ]);
      assert.deepEqual(
        collection.profiles.map(({ id }) => id),
        ["default", "inference"],
      );
      for (const profile of collection.profiles)
        assert.equal(
          hash(readFileSync(profile.metadataFile)),
          profile.metadataSha256,
        );
      const sbomBytes = readFileSync(report.sbom.path);
      assert.equal(hash(sbomBytes), report.sbom.sha256);
      const validationBytes = readFileSync(report.sbomValidation.path);
      assert.equal(hash(validationBytes), report.sbomValidation.sha256);
      const validation = JSON.parse(validationBytes);
      assert.equal(validation.sha256, report.sbom.sha256);
      assert.equal(validation.officialSbomSchemaValidated, true);
      assert.equal(validation.releaseAcceptance, false);
      assert.equal(validation.advisoryAcceptance, false);
      assert.deepEqual(
        JSON.parse(sbomBytes).components.map(({ name }) => name),
        ["alpha"],
      );
    },
  );
}

test("produced manifest is accepted by the unchanged transport binding using fixture-only transport", async (t) => {
  const f = fixture(t);
  const collected = collectRustFeatureMetadataFixture(f.args, f.spawn);
  let requests = 0;
  const result = await runRustFeatureAdvisoryFixture(
    {
      repositoryRoot: f.repo,
      scope: "pr1",
      collectionFile: collected.collection.path,
      collectionSha256: collected.collection.sha256,
      outputDirectory: f.output,
      mode: "query-selected-identities",
    },
    {
      transport: async (body) => {
        requests++;
        return {
          status: 200,
          responseJson: JSON.stringify({
            results: JSON.parse(body).queries.map(() => ({})),
          }),
        };
      },
    },
  );
  assert.equal(requests, 1);
  assert.equal(result.status, "completed");
  assert.equal(result.registryResponsesComplete, true);
  assert.equal(result.networkRequestsPerformed, false);
  assert.equal(result.releaseAcceptance, false);
  assert.equal(result.rootCompletenessVerified, false);
});

for (const [name, mutate] of [
  [
    "wrong pinned config",
    (f) => {
      f.args.configSha256 = "0".repeat(64);
    },
  ],
  [
    "source drift",
    (f) => writeFileSync(join(f.repo, "feature/lib.rs"), "changed"),
  ],
  ["lock drift", (f) => writeFileSync(join(f.repo, "Cargo.lock"), "changed")],
  [
    "missing scope config",
    (f) => {
      f.args.scope = "pr2";
    },
  ],
  [
    "unreviewed seed",
    (f) => {
      f.config.seeds[0].review.status = "pending";
      f.saveConfig();
    },
  ],
  [
    "forged completeness",
    (f) => {
      f.config.completeness.status = "complete";
      f.saveConfig();
    },
  ],
  [
    "missing profile",
    (f) => {
      f.config.profiles.pop();
      f.saveConfig();
    },
  ],
  [
    "duplicate profile",
    (f) => {
      f.config.profiles.push(f.config.profiles[0]);
      f.saveConfig();
    },
  ],
  [
    "unsafe source path",
    (f) => {
      f.config.sourceFiles["../escape"] = "a".repeat(64);
      f.saveConfig();
    },
  ],
  [
    "output inside checkout",
    (f) => {
      f.args.outputDirectory = f.repo;
    },
  ],
  [
    "rustup proxies",
    (f) =>
      writeFileSync(
        join(f.tools, "rustc"),
        readFileSync(join(f.tools, "cargo")),
      ),
  ],
  [
    "unrecognized mode",
    (f) => {
      f.args.mode = "query-selected-registry";
    },
  ],
  [
    "extra override",
    (f) => {
      f.args.allowIncomplete = true;
    },
  ],
]) {
  test(
    "rejects " + name + " before any subprocess or evidence directory",
    (t) => {
      const f = fixture(t);
      mutate(f);
      assert.throws(() => collectRustFeatureMetadataFixture(f.args, f.spawn));
      assert.equal(f.calls.length, 0);
      assert.equal(readdirSync(f.output).length, 0);
    },
  );
}

for (const [name, mutateResult] of [
  ["nonzero exit", (result) => ({ ...result, status: 1 })],
  [
    "timeout",
    (result) => ({
      ...result,
      status: null,
      signal: "SIGKILL",
      error: { code: "ETIMEDOUT" },
    }),
  ],
  ["malformed JSON", (result) => ({ ...result, stdout: Buffer.from("{") })],
  ["malformed UTF8", (result) => ({ ...result, stdout: Buffer.from([0xff]) })],
  [
    "wrong workspace",
    (result) => {
      const metadata = JSON.parse(result.stdout);
      metadata.workspace_root += "-other";
      return { ...result, stdout: Buffer.from(JSON.stringify(metadata)) };
    },
  ],
  [
    "omitted selected dependency",
    (result) => {
      const metadata = JSON.parse(result.stdout);
      metadata.resolve.nodes[0].deps = [];
      return { ...result, stdout: Buffer.from(JSON.stringify(metadata)) };
    },
  ],
]) {
  test(name + " stops without retry or success manifest/SBOM", (t) => {
    const f = fixture(t);
    const report = collectRustFeatureMetadataFixture(f.args, (...args) =>
      mutateResult(f.spawn(...args)),
    );
    assert.equal(report.collectionPassed, false);
    assert.equal(f.calls.length, 1);
    assert.equal(report.collection, null);
    assert.equal(report.sbom, null);
    assert(!existsSync(join(report.outputDirectory, "collection.json")));
    assert(!existsSync(join(report.outputDirectory, "selected-rust.cdx.json")));
    assert(existsSync(join(report.outputDirectory, "summary.json")));
    assert.equal(report.releaseAcceptance, false);
  });
}

test("source or tool mutation during the process invalidates collection before the next profile", (t) => {
  for (const file of ["feature/lib.rs", "cargo"]) {
    const f = fixture(t);
    const report = collectRustFeatureMetadataFixture(f.args, (...args) => {
      const result = f.spawn(...args);
      writeFileSync(
        file === "cargo" ? f.args.cargoExecutable : join(f.repo, file),
        "changed",
      );
      return result;
    });
    assert.equal(report.collectionPassed, false);
    assert.equal(report.sourceUnchanged, false);
    assert.equal(f.calls.length, 1);
    assert.equal(report.collection, null);
  }
});

test("real current config preparation validates all existing sources/profiles without invoking Cargo", (t) => {
  const scope = existsSync(join(root, "scripts/rust_feature_scope.pr2.json"))
    ? "pr2"
    : "pr1";
  const f = fixture(t);
  const configPath = join(
    root,
    "scripts/rust_feature_scope." + scope + ".json",
  );
  const prepared = prepareRustFeatureCollection({
    ...f.args,
    repositoryRoot: resolve(root),
    scope,
    configSha256: hash(readFileSync(configPath)),
  });
  assert.deepEqual(
    prepared.commands.map((command) => command.id).sort(),
    [
      "android-arm64-transformers-webgpu",
      "android-inference-store",
      "wasm-default",
      "windows-default",
      "windows-inference",
      ...(scope === "pr2"
        ? ["linux-release-tool", "windows-release-tool"]
        : []),
    ].sort(),
    "Every declared feature/host profile must have a real offline metadata command",
  );
  assert(
    prepared.inventories.every(
      (inventory) => inventory.rootCompletenessVerified === false,
    ),
  );
  prepared.verify();
  assert.equal(f.calls.length, 0);
  assert.equal(readdirSync(f.output).length, 0);
});

test("CLI requires exact explicit paths, scope, pin and offline mode without executable arguments", (t) => {
  const f = fixture(t);
  const argv = [
    "--repository-root",
    f.repo,
    "--scope",
    "pr1",
    "--config-sha256",
    f.args.configSha256,
    "--output-directory",
    f.output,
    "--cargo-executable",
    f.args.cargoExecutable,
    "--mode",
    "collect-offline",
  ];
  assert.deepEqual(parseRustCollectionArgs(argv), f.args);
  for (const bad of [
    [],
    argv.slice(2),
    [...argv, "--profile", "default"],
    argv.map((value) => (value === "collect-offline" ? "query" : value)),
    argv.map((value) => (value === "--scope" ? "--mode" : value)),
  ])
    assert.throws(() => parseRustCollectionArgs(bad));
  assert.throws(() => collectRustFeatureMetadataFixture(f.args));
  const source = readFileSync(
    new URL("./rust_feature_collection.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /node:https|node:http|fetch\(|cargo install|cargo audit|npm audit|safe\.directory/u,
  );
});
