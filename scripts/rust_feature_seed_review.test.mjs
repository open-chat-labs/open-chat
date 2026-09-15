import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  prepareRustFeatureInventory,
  verifyRustFeatureScopeReview,
} from "./rust_feature_seed_review.mjs";

function reviewedFixture() {
  const value = fixture();
  value.configBytes = JSON.stringify(value.config);
  value.review = {
    schemaVersion: 1,
    configSha256: hash(value.configBytes),
    boundary:
      "Fixture-only selected encryption calls and their reviewed nested schema.",
    units: [
      {
        id: "manifests",
        disposition: "no-additional-external-owner-edge",
        explanation:
          "Fixture workspace registration contributes no additional external owner edge.",
        profiles: ["wasm", "native"],
        sources: [{ path: "Cargo.toml", lines: [1] }],
        seeds: [],
      },
      ...value.config.seeds.map((seed) => ({
        id: seed.id,
        disposition: "external-owner-edges",
        explanation:
          "Fixture encryption call retains its exact owner and deployment context.",
        profiles: [...seed.profiles],
        sources: [
          { path: seed.ownerManifest, lines: [1] },
          ...structuredClone(seed.evidence),
        ],
        seeds: [seed.id],
      })),
    ],
    resolutions: [
      {
        id: "nested-types",
        explanation:
          "Fixture nested schema review confirms the listed encryption owner and no further edge.",
        units: ["feature.cipher", "native.cipher"],
      },
    ],
  };
  return value;
}

test("actual PR2 source review binds app payloads and module glue without widening dependency profiles", () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const configBytes = readFileSync(
    resolve(repo, "scripts/rust_feature_scope.pr2.json"),
  );
  const config = JSON.parse(configBytes);
  const review = JSON.parse(
    readFileSync(resolve(repo, "scripts/rust_feature_review.pr2.json")),
  );
  const sourceBytes = Object.fromEntries(
    Object.keys(config.sourceFiles).map((path) => [
      path,
      readFileSync(resolve(repo, path)),
    ]),
  );
  const value = {
    config,
    configBytes,
    review,
    sourceBytes,
    cargoLock: readFileSync(resolve(repo, "Cargo.lock")),
  };
  const result = verifyRustFeatureScopeReview(value);
  assert.equal(config.seeds.length, 255);
  assert.equal(config.profiles.length, 7);
  assert.equal(result.reviewedSourceCount, 347);
  assert.equal(result.reviewedSeedProfileCount, 436);
  assert.equal(result.reviewedUnitCount, 67);
  assert.equal(result.rootCompletenessVerified, true);
  assert.deepEqual(result.completeness, { status: "complete", unresolved: [] });
  assert.equal(result.automaticSourceAnalysis, false);
  assert.equal(result.wholeRepositoryCoverage, false);
  assert.equal(result.advisoryChecksPerformed, false);
  assert.equal(result.releaseAcceptance, false);
  assert.equal(config.completeness.status, "incomplete");
  for (const profile of config.profiles)
    assert.equal(
      prepareRustFeatureInventory({ ...value, profileId: profile.id })
        .rootCompletenessVerified,
      false,
    );
  const moduleUnit = review.units.find(
    (unit) => unit.id === "changed-app-module-declarations",
  );
  assert.equal(moduleUnit.disposition, "no-additional-external-owner-edge");
  for (const source of moduleUnit.sources) {
    const lines = sourceBytes[source.path].toString("utf8").split(/\r?\n/u);
    for (const line of source.lines)
      assert.match(lines[line - 1], /^(?:pub )?mod [a-z0-9_]+;$/u);
  }
  for (const id of [
    "nested-card-identifiers",
    "http-metrics-and-memory-leaves",
    "inbox-configuration-and-guards",
    "card-core-forwarding-and-wrappers",
  ]) {
    assert.ok(review.units.some((unit) => unit.id === id));
    const missing = { ...value, review: structuredClone(review) };
    missing.review.units = missing.review.units.filter(
      (unit) => unit.id !== id,
    );
    assert.throws(() => verifyRustFeatureScopeReview(missing));
  }
  const cardSource = "backend/libraries/types/src/chat_id.rs";
  assert.throws(() =>
    verifyRustFeatureScopeReview({
      ...value,
      sourceBytes: {
        ...sourceBytes,
        [cardSource]: Buffer.concat([
          sourceBytes[cardSource],
          Buffer.from("\n// drift\n"),
        ]),
      },
    }),
  );
  assert.ok(
    !Object.keys(config.sourceFiles).some((path) =>
      path.includes("dynamodb_index_store"),
    ),
  );
});

test("separate source-review receipt can close a fully bound inventory without approving a release", () => {
  const value = reviewedFixture();
  const before = JSON.stringify(value);
  const result = verifyRustFeatureScopeReview(value);
  assert.equal(JSON.stringify(value), before);
  assert.equal(result.rootCompletenessVerified, true);
  assert.deepEqual(result.completeness, { status: "complete", unresolved: [] });
  assert.equal(result.reviewedSourceCount, 3);
  assert.equal(result.reviewedSeedProfileCount, 2);
  assert.equal(result.automaticSourceAnalysis, false);
  assert.equal(result.wholeRepositoryCoverage, false);
  assert.equal(result.advisoryChecksPerformed, false);
  assert.equal(result.releaseAcceptance, false);
  assert.equal(
    prepareRustFeatureInventory(value).rootCompletenessVerified,
    false,
  );
});

test("source-review receipt binds portable config bytes without changing Cargo/source raw identities", () => {
  const value = reviewedFixture();
  value.configBytes = JSON.stringify(value.config, null, 2) + "\n";
  value.review.configSha256 = hash(value.configBytes);
  const before = verifyRustFeatureScopeReview(value);
  value.configBytes = value.configBytes.replaceAll("\n", "\r\n");
  assert.deepEqual(verifyRustFeatureScopeReview(value), before);
});

test("source-review acceptance rejects incomplete, stale, foreign or unsubstantiated dispositions", () => {
  const mutations = [
    (v) => {
      v.review.configSha256 = "f".repeat(64);
    },
    (v) => {
      v.config.sourceRevision.head = "c".repeat(40);
    },
    (v) => {
      v.sourceBytes["feature/src/lib.rs"] += "// changed";
    },
    (v) => {
      v.cargoLock += "\n";
    },
    (v) => {
      v.review.rootCompletenessVerified = true;
    },
    (v) => {
      v.review.boundary = "";
    },
    (v) => {
      v.review.units = [];
    },
    (v) => {
      v.review.units[0].sources = [];
    },
    (v) => {
      v.review.units.shift();
    },
    (v) => {
      v.review.units[1].sources[0].path = "../outside";
    },
    (v) => {
      v.review.units[1].sources[0].path = "unknown.rs";
    },
    (v) => {
      v.review.units[1].sources[1].lines = [999];
    },
    (v) => {
      v.review.units[1].sources[1].lines = [2];
    },
    (v) => {
      v.review.units[1].sources.shift();
    },
    (v) => {
      v.review.units[1].seeds = ["unknown"];
    },
    (v) => {
      v.review.units[1].seeds = [];
    },
    (v) => {
      v.review.units[1].seeds.push("feature.cipher");
    },
    (v) => {
      v.review.units[1].profiles.push("native");
    },
    (v) => {
      v.review.units[1].profiles = ["unknown"];
    },
    (v) => {
      v.review.units[0].seeds = ["feature.cipher"];
    },
    (v) => {
      v.review.units[2].disposition = "no-additional-external-owner-edge";
      v.review.units[2].seeds = [];
    },
    (v) => {
      v.review.units[1].disposition = "approve";
    },
    (v) => {
      v.review.units[1].id = v.review.units[0].id;
    },
    (v) => {
      v.review.resolutions = [];
    },
    (v) => {
      v.review.resolutions[0].id = "different-gap";
    },
    (v) => {
      v.review.resolutions[0].explanation = "";
    },
    (v) => {
      v.review.resolutions[0].units = ["unknown"];
    },
    (v) => {
      v.review.resolutions[0].units = [];
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const value = reviewedFixture();
    mutate(value);
    assert.throws(
      () => verifyRustFeatureScopeReview(value),
      undefined,
      "Mutation " + index,
    );
  }
});

// Local APK scope is distinct from the historical native-inference/store graph.
// PR2 rebinds the model roots to its own source/lock, then adds its app-only roots.
function assertLocalWebGpuRoots(config, scope) {
  const id = "android-arm64-transformers-webgpu";
  const profile = config.profiles.find((item) => item.id === id);
  assert.ok(profile, "Missing the tested local all-WebGPU APK profile");
  assert.equal(profile.target, "aarch64-linux-android");
  assert.deepEqual(profile.features, ["open-chat/transformers-webgpu-android"]);
  const expected = [
    "native-model-command-build-registration.tauri-plugin-oc.tauri_plugin.build.build",
    "native-model-ipc-schema-and-commands.tauri-plugin-oc.serde.normal.production",
    "native-model-ipc-schema-and-commands.tauri-plugin-oc.tauri.normal.production",
    ...[
      "futures_util",
      "hex",
      "reqwest",
      "serde_json",
      "serde",
      "sha2",
      "sysinfo",
      "tauri",
      "tokio",
    ].map(
      (dependency) =>
        `native-model-manager.tauri-plugin-oc.${dependency}.normal.production`,
    ),
    "native-model-packaging-support.open-chat.tauri_build.build.build",
    ...(scope === "pr2"
      ? ["semver", "serde_json", "serde", "tauri"].map(
          (dependency) =>
            `app-native-handoff-and-apk-cache-policy.tauri-plugin-oc.${dependency}.normal.production`,
        )
      : []),
  ].sort();
  const seeds = config.seeds.filter((seed) => seed.profiles.includes(id));
  assert.deepEqual(
    seeds.map((seed) => seed.id).sort(),
    expected,
    "Local WebGPU scope must retain model/build roots and only mobile app roots",
  );
  for (const seed of seeds) {
    assert.ok(seed.ownerManifest.startsWith("frontend/"));
    assert.equal(
      seed.originContext,
      seed.kind === "build" ? "build" : "production",
    );
    assert.notEqual(seed.kind, "dev");
    assert.doesNotMatch(seed.dependencyName, /llama|minijinja|devtools/iu);
    if (scope === "pr2" && seed.feature.startsWith("native-model-"))
      assert.deepEqual(
        seed.profiles,
        [id],
        "Rebound local model roots do not qualify other PR2 profiles",
      );
  }
  for (const path of [
    "frontend/src-tauri/Cargo.toml",
    "frontend/src-tauri/build.rs",
    "frontend/src-tauri/src/lib.rs",
    "frontend/tauri-plugin-oc/Cargo.toml",
    "frontend/tauri-plugin-oc/build.rs",
    "frontend/tauri-plugin-oc/src/lib.rs",
    "frontend/tauri-plugin-oc/src/model_manager.rs",
    "frontend/tauri-plugin-oc/src/models.rs",
    "frontend/tauri-plugin-oc/src/commands.rs",
  ])
    assert.ok(
      Object.hasOwn(config.sourceFiles, path),
      `Missing local profile source: ${path}`,
    );
}

test("actual local all-WebGPU profile owns exact model/app roots without inference or devtools", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const scope = existsSync(resolve(root, "scripts/rust_feature_scope.pr2.json"))
    ? "pr2"
    : "pr1";
  const config = JSON.parse(
    readFileSync(
      resolve(root, `scripts/rust_feature_scope.${scope}.json`),
      "utf8",
    ),
  );
  assertLocalWebGpuRoots(config, scope);
  for (const mutate of [
    (value) =>
      value.profiles
        .find((item) => item.id === "android-arm64-transformers-webgpu")
        .features.push("open-chat/inference"),
    (value) =>
      value.profiles
        .find((item) => item.id === "android-arm64-transformers-webgpu")
        .features.push("open-chat/devtools"),
    (value) => {
      value.seeds = value.seeds.filter(
        (seed) => !seed.id.startsWith("native-model-packaging-support."),
      );
    },
    (value) =>
      value.seeds
        .find((seed) => seed.profiles.includes("wasm-default"))
        .profiles.push("android-arm64-transformers-webgpu"),
    (value) => {
      value.seeds.find((seed) =>
        seed.id.startsWith("native-model-manager."),
      ).originContext = "test";
    },
  ]) {
    const changed = structuredClone(config);
    mutate(changed);
    assert.throws(() => assertLocalWebGpuRoots(changed, scope));
  }
});

function assertReleaseToolRoots(config) {
  const profiles = [
    ["windows-release-tool", "x86_64-pc-windows-msvc"],
    ["linux-release-tool", "x86_64-unknown-linux-gnu"],
  ];
  for (const [id, target] of profiles) {
    const profile = config.profiles.find((item) => item.id === id);
    assert.ok(profile, `Missing release-tool profile: ${id}`);
    assert.equal(profile.target, target);
    assert.deepEqual(profile.features, []);
    const seeds = config.seeds.filter((seed) => seed.profiles.includes(id));
    assert.deepEqual(
      seeds.map((seed) => `${seed.ownerPackage}/${seed.dependencyName}`).sort(),
      [
        "canister_agent_utils/itertools",
        "canister_upgrader/clap",
        "sha256/sha2",
      ],
      "Hash guard scope must include its three external edges, not whole tool crates",
    );
    for (const seed of seeds) {
      assert.equal(seed.kind, "normal");
      assert.equal(seed.originContext, "build");
      assert.deepEqual(
        [...seed.profiles].sort(),
        profiles.map(([name]) => name).sort(),
      );
    }
  }
  for (const path of [
    "backend/tools/canister_upgrader/Cargo.toml",
    "backend/tools/canister_upgrader/src/main.rs",
    "backend/tools/canister_upgrader/src/lib.rs",
    "backend/libraries/canister_agent_utils/Cargo.toml",
    "backend/libraries/canister_agent_utils/src/lib.rs",
    "scripts/upgrade-canister.sh",
  ])
    assert.ok(
      Object.hasOwn(config.sourceFiles, path),
      `Missing guard source pin: ${path}`,
    );
}

test("PR2 release-tool hash guard owns exact host profiles and no sibling core roots", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const config = JSON.parse(
    readFileSync(resolve(root, "scripts/rust_feature_scope.pr2.json"), "utf8"),
  );
  assertReleaseToolRoots(config);
  const missing = structuredClone(config);
  missing.seeds = missing.seeds.filter(
    (seed) => !seed.id.startsWith("release-wasm-hash-guard.canister_upgrader."),
  );
  assert.throws(() => assertReleaseToolRoots(missing));
  const expanded = structuredClone(config);
  expanded.seeds
    .find((seed) => seed.profiles.includes("wasm-default"))
    .profiles.push("linux-release-tool");
  assert.throws(() => assertReleaseToolRoots(expanded));
  const shipping = structuredClone(config);
  shipping.seeds.find((seed) =>
    seed.profiles.includes("linux-release-tool"),
  ).originContext = "production";
  assert.throws(() => assertReleaseToolRoots(shipping));
});

// These exact caller-side schema edges were independently traced from the feature
// tests. This boundary includes no fixture implementation/runtime crates,
// Android roots or general core inventory.
function assertSharedTestSchemaRoots(config, scope) {
  const fixtureOwners = [
    "group_index",
    "openchat_installer",
    "translations",
    "online_users",
    "proposals_bot",
    "storage_index",
    "cycles_dispenser",
    "registry",
    "escrow",
    "event_relay",
    "airdrop_bot",
    "sign_in_with_email",
  ];
  const expected = fixtureOwners.flatMap((owner) =>
    ["candid", "serde"].map((dependency) => ({
      feature: "shared-feature-test-fixture-schema",
      owner: `${owner}_canister`,
      manifest: `backend/canisters/${owner}/api/Cargo.toml`,
      dependency,
      kind: "normal",
    })),
  );
  expected.push({
    feature: "shared-feature-test-external-schema",
    owner: "integration_tests",
    manifest: "backend/integration_tests/Cargo.toml",
    dependency: "event_store_canister",
    kind: "dev",
  });
  for (const [owner, dependencies] of [
    ["identity", ["candid", "serde", "serde_bytes", "ts_rs"]],
    ["user_index", ["candid", "serde", "ts_rs"]],
    [
      "local_user_index",
      ["candid", "serde", "serde_bytes", "ts_rs", "ic_ledger_types"],
    ],
  ]) {
    expected.push(
      ...dependencies.map((dependency) => ({
        feature: "shared-feature-test-user-registration-schema",
        owner: `${owner}_canister`,
        manifest: `backend/canisters/${owner}/api/Cargo.toml`,
        dependency,
        kind: "normal",
      })),
    );
  }
  if (scope === "pr2") {
    expected.push({
      feature: "shared-feature-test-user-registration-conversion",
      owner: "types",
      manifest: "backend/libraries/types/Cargo.toml",
      dependency: "icrc_ledger_types",
      kind: "normal",
    });
  } else {
    assert.ok(
      !config.seeds.some(
        (seed) =>
          seed.feature === "shared-feature-test-user-registration-conversion",
      ),
    );
  }
  const features = new Set(expected.map((edge) => edge.feature));
  const actual = config.seeds.filter((seed) => features.has(seed.feature));
  assert.equal(
    actual.length,
    expected.length,
    "Reviewed test-schema edge set changed",
  );
  for (const edge of expected) {
    const id = `${edge.feature}.${edge.owner}.${edge.dependency}.${edge.kind}.test`;
    const seed = actual.find((candidate) => candidate.id === id);
    assert.ok(seed, `Missing reviewed test-schema edge: ${id}`);
    assert.equal(seed.ownerManifest, edge.manifest);
    assert.equal(seed.ownerPackage, edge.owner);
    assert.equal(seed.dependencyName, edge.dependency);
    assert.equal(seed.kind, edge.kind);
    assert.equal(seed.target, null);
    assert.equal(seed.originContext, "test");
    assert.deepEqual(seed.profiles, ["windows-default"]);
    assert.ok(
      seed.evidence.some((item) =>
        item.path.startsWith("backend/integration_tests/src/"),
      ),
    );
  }
  const external = actual.find(
    (seed) => seed.dependencyName === "event_store_canister",
  );
  assert.equal(external.expected.version, "0.12.0");
  assert.equal(
    external.expected.source,
    "git+https://github.com/open-chat-labs/event-store?tag=v0.12.0#b97b6ecd12b62af6387cb7e5084bf4db7ff75ae0",
  );
  assert.equal(external.expected.checksum ?? null, null);
}

test("actual shared test-schema roots cannot silently disappear or become shipping roots", () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const scope = existsSync(resolve(repo, "scripts/rust_feature_scope.pr2.json"))
    ? "pr2"
    : "pr1";
  const config = JSON.parse(
    readFileSync(
      resolve(repo, `scripts/rust_feature_scope.${scope}.json`),
      "utf8",
    ),
  );
  assertSharedTestSchemaRoots(config, scope);
  assert.deepEqual(
    config.completeness.unresolved.map((gap) => gap.id),
    ["nested-state-generated-owner-completeness"],
    "Do not reintroduce whole-core/artifact exclusions as Rust-root review obligations",
  );
  assert.ok(
    config.profiles.every((profile) =>
      profile.features.every((feature) => !feature.includes("devtools")),
    ),
  );
  const reviewed = config.seeds.find(
    (seed) => seed.feature === "shared-feature-test-external-schema",
  );
  for (const mutate of [
    (value) => {
      value.seeds = value.seeds.filter((seed) => seed.id !== reviewed.id);
    },
    (value) => {
      value.seeds.find((seed) => seed.id === reviewed.id).originContext =
        "production";
    },
    (value) => {
      value.seeds
        .find((seed) => seed.id === reviewed.id)
        .profiles.push("wasm-default");
    },
    (value) => {
      value.seeds.find((seed) => seed.id === reviewed.id).ownerManifest =
        "backend/canisters/event_relay/impl/Cargo.toml";
    },
    (value) => {
      value.seeds.find(
        (seed) =>
          seed.id ===
          "shared-feature-test-fixture-schema.group_index_canister.candid.normal.test",
      ).originContext = "production";
    },
    (value) => {
      value.seeds
        .find(
          (seed) =>
            seed.id ===
            "shared-feature-test-fixture-schema.group_index_canister.serde.normal.test",
        )
        .profiles.push("android-arm64-transformers-webgpu");
    },
    (value) => {
      value.seeds = value.seeds.filter(
        (seed) =>
          seed.id !==
          "shared-feature-test-user-registration-schema.user_index_canister.ts_rs.normal.test",
      );
    },
    (value) => {
      value.seeds
        .find(
          (seed) =>
            seed.id ===
            "shared-feature-test-user-registration-schema.user_index_canister.ts_rs.normal.test",
        )
        .profiles.push("wasm-default");
    },
  ]) {
    const changed = structuredClone(config);
    mutate(changed);
    assert.throws(() => assertSharedTestSchemaRoots(changed, scope));
  }
});

test("PR2 app-state schema evidence cannot silently disappear", () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const config = JSON.parse(
    readFileSync(resolve(repo, "scripts/rust_feature_scope.pr2.json"), "utf8"),
  );
  const required = [
    ...["group", "community", "group_index", "local_user_index"].map(
      (owner) => `backend/canisters/${owner}/impl/src/lib.rs`,
    ),
    ...[
      "ai_app_call_throttle",
      "ai_app_card_tokens",
      "ai_app_chat_link_tokens",
      "ai_app_link_codes",
      "ai_app_private_match_tokens",
    ].map((name) => `backend/canisters/user_index/impl/src/model/${name}.rs`),
  ];
  const check = (candidate) => {
    for (const path of required)
      assert.ok(
        Object.hasOwn(candidate.sourceFiles, path),
        `Missing reviewed app-state source: ${path}`,
      );
    const fieldRoots = candidate.seeds.filter(
      (seed) => seed.feature === "app-state-field-serialization",
    );
    assert.deepEqual(fieldRoots.map((seed) => seed.ownerPackage).sort(), [
      "community_canister_impl",
      "group_canister_impl",
    ]);
    for (const seed of fieldRoots)
      assert.deepEqual(
        seed.profiles,
        ["wasm-default", "windows-default"],
        "Canister state serialization must not leak into native/mobile profiles",
      );
    for (const [owner, dependency] of [
      ["user_index_canister_impl", "serde"],
      ["user_index_canister_impl", "serde_bytes"],
      ["user_index_canister_impl", "candid"],
      ["user_index_canister_impl", "hex"],
      ["sha256", "sha2"],
      ["group_canister_impl", "serde"],
      ["community_canister_impl", "serde"],
      ["group_index_canister_impl", "serde"],
      ["local_user_index_canister_impl", "serde"],
    ])
      assert.ok(
        candidate.seeds.some(
          (seed) =>
            seed.ownerPackage === owner &&
            seed.dependencyName === dependency &&
            seed.kind === "normal" &&
            seed.originContext === "production" &&
            seed.profiles.includes("wasm-default") &&
            seed.profiles.includes("windows-default"),
        ),
        `Missing reviewed app-state owner: ${owner}/${dependency}`,
      );
  };
  check(config);
  for (const path of required) {
    const missing = structuredClone(config);
    delete missing.sourceFiles[path];
    assert.throws(() => check(missing), /Missing reviewed app-state source/u);
  }
  const missingSerde = structuredClone(config);
  missingSerde.seeds = missingSerde.seeds.filter(
    (seed) =>
      seed.ownerPackage !== "user_index_canister_impl" ||
      seed.dependencyName !== "serde",
  );
  assert.throws(() => check(missingSerde), /Missing reviewed app-state owner/u);
  const mobileLeak = structuredClone(config);
  mobileLeak.seeds
    .find((seed) => seed.feature === "app-state-field-serialization")
    .profiles.push("android-arm64-transformers-webgpu");
  assert.throws(() => check(mobileLeak), /must not leak/u);
});

// Bounded regression over already reviewed sources, not a Rust parser or an
// assertion that every unrelated type in a mixed-purpose crate is in scope.
function assertGeneratedTsOwners(config, sourceBytes) {
  const owners = new Set();
  for (const [path, bytes] of Object.entries(sourceBytes)) {
    if (
      !path.endsWith(".rs") ||
      !/^\s*#\[ts_export(?:\(|\])/mu.test(Buffer.from(bytes).toString("utf8"))
    )
      continue;
    let directory = path.slice(0, path.lastIndexOf("/"));
    let manifest;
    while (directory) {
      const candidate = directory + "/Cargo.toml";
      if (Object.hasOwn(sourceBytes, candidate)) {
        manifest = candidate;
        break;
      }
      directory = directory.includes("/")
        ? directory.slice(0, directory.lastIndexOf("/"))
        : "";
    }
    assert.ok(manifest, `Generated TS consumer has no pinned owner: ${path}`);
    assert.ok(
      config.seeds.some(
        (seed) =>
          seed.ownerManifest === manifest &&
          seed.dependencyName === "ts_rs" &&
          seed.kind === "normal",
      ),
      `Generated TS consumer lacks its own ts_rs edge: ${path}`,
    );
    owners.add(manifest);
  }
  return owners;
}

test("every pinned direct ts_export consumer retains its generated owner dependency", () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const scope = existsSync(resolve(repo, "scripts/rust_feature_scope.pr2.json"))
    ? "pr2"
    : "pr1";
  const config = JSON.parse(
    readFileSync(
      resolve(repo, `scripts/rust_feature_scope.${scope}.json`),
      "utf8",
    ),
  );
  const sources = Object.fromEntries(
    Object.keys(config.sourceFiles).map((path) => [
      path,
      readFileSync(resolve(repo, path)),
    ]),
  );
  const owners = assertGeneratedTsOwners(config, sources);
  assert.ok(
    owners.size > 0,
    "Regression must exercise actual generated consumers",
  );
  assert.ok(owners.has("backend/canisters/user_index/api/Cargo.toml"));
  for (const owner of owners) {
    const missing = structuredClone(config);
    missing.seeds = missing.seeds.filter(
      (seed) => seed.ownerManifest !== owner || seed.dependencyName !== "ts_rs",
    );
    assert.throws(
      () => assertGeneratedTsOwners(missing, sources),
      /lacks its own ts_rs edge/u,
    );
  }
  // The macro produces a derive in the consuming crate. Its own crate must not
  // be assigned that runtime edge merely because the generated token text names TS.
  assert.deepEqual(
    [
      ...assertGeneratedTsOwners(
        { seeds: [] },
        {
          "macro/Cargo.toml": '[package]\nname="schema_macro"\n',
          "macro/src/lib.rs": "parse_quote!(\n #[derive(::ts_rs::TS)]\n);\n",
        },
      ),
    ],
    [],
  );
});

const hash = (value) => createHash("sha256").update(value).digest("hex");
function fixture() {
  const sourceBytes = {
    "Cargo.toml": '[workspace]\nmembers=["feature"]\n',
    "feature/Cargo.toml": '[package]\nname="host"\nversion="0.1.0"\n',
    "feature/src/lib.rs": "use cipher::Encrypt;\n",
  };
  const cargoLock =
    'version = 4\n\n[[package]]\nname = "cipher"\nversion = "1.0.0"\nsource = "registry+https://example.invalid/index"\nchecksum = "' +
    "1".repeat(64) +
    '"\n';
  const seed = {
    id: "feature.cipher",
    ownerManifest: "feature/Cargo.toml",
    ownerPackage: "host",
    dependencyName: "cipher",
    kind: "normal",
    target: null,
    originContext: "production",
    expected: {
      name: "cipher",
      version: "1.0.0",
      source: "registry+https://example.invalid/index",
      checksum: "1".repeat(64),
    },
    profiles: ["wasm"],
    review: {
      status: "source-traced",
      basis: "source-call-or-schema",
      notes: "Selected encryption call",
    },
    evidence: [{ path: "feature/src/lib.rs", lines: [1] }],
  };
  return {
    config: {
      schemaVersion: 1,
      reviewTextIdentity: "utf8-lf",
      sourceRevision: { base: "a".repeat(40), head: "b".repeat(40) },
      cargoLockSha256: hash(cargoLock),
      completeness: {
        status: "incomplete",
        unresolved: [
          {
            id: "nested-types",
            description: "Unreviewed nested schema boundary",
          },
        ],
      },
      profiles: [
        {
          id: "wasm",
          target: "wasm32-unknown-unknown",
          features: [],
          metadataSha256: null,
        },
        {
          id: "native",
          target: "x86_64-pc-windows-msvc",
          features: ["host/inference"],
          metadataSha256: "2".repeat(64),
        },
      ],
      sourceFiles: Object.fromEntries(
        Object.entries(sourceBytes).map(([path, bytes]) => [path, hash(bytes)]),
      ),
      seeds: [
        seed,
        {
          ...structuredClone(seed),
          id: "native.cipher",
          originContext: "build",
          profiles: ["native"],
        },
      ],
    },
    profileId: "wasm",
    sourceBytes,
    cargoLock,
  };
}

test("source-pinned review selects exact nonempty profile roots without a completeness or advisory pass", () => {
  const value = fixture(),
    before = JSON.stringify(value);
  const report = prepareRustFeatureInventory(value);
  assert.equal(JSON.stringify(value), before);
  assert.deepEqual(
    report.seeds.map((seed) => seed.id),
    ["feature.cipher"],
  );
  assert.equal(report.rootCompletenessVerified, false);
  assert.equal(report.advisoryChecksPerformed, false);
  assert.equal(report.completeness.status, "incomplete");
  assert.deepEqual(Object.keys(report.identity.manifestSha256).sort(), [
    "Cargo.toml",
    "feature/Cargo.toml",
  ]);
  value.profileId = "native";
  const native = prepareRustFeatureInventory(value);
  assert.equal(native.seeds[0].kind, "normal");
  assert.equal(native.seeds[0].originContext, "build");
  native.seeds[0].expected.version = "changed";
  assert.equal(value.config.seeds[1].expected.version, "1.0.0");
});

test("modified or missing source, manifest, lock and expected resolved identity fail closed", () => {
  for (const change of [
    (value) => {
      value.sourceBytes["feature/src/lib.rs"] += "// change";
    },
    (value) => {
      value.sourceBytes["feature/Cargo.toml"] += "// change";
    },
    (value) => {
      delete value.sourceBytes["feature/src/lib.rs"];
    },
    (value) => {
      value.sourceBytes["extra.rs"] = "";
    },
    (value) => {
      value.cargoLock += "\n";
    },
    (value) => {
      value.config.seeds[0].expected.version = "2.0.0";
    },
    (value) => {
      value.config.seeds[0].expected.checksum = "3".repeat(64);
    },
    (value) => {
      value.config.seeds[0].expected.source = null;
    },
    (value) => {
      delete value.config.sourceFiles["Cargo.toml"];
      delete value.sourceBytes["Cargo.toml"];
    },
  ]) {
    const value = fixture();
    change(value);
    assert.throws(() => prepareRustFeatureInventory(value));
  }
});

test("review hashes are LF-portable while collector input identities retain exact raw bytes", () => {
  const value = fixture();
  const before = prepareRustFeatureInventory(value);
  value.cargoLock = value.cargoLock.replaceAll("\n", "\r\n");
  for (const path of Object.keys(value.sourceBytes))
    value.sourceBytes[path] = value.sourceBytes[path].replaceAll("\n", "\r\n");
  const after = prepareRustFeatureInventory(value);
  assert.deepEqual(after.seeds, before.seeds);
  assert.notEqual(
    after.identity.cargoLockSha256,
    before.identity.cargoLockSha256,
  );
  assert.equal(after.identity.cargoLockSha256, hash(value.cargoLock));
  assert.equal(
    after.identity.manifestSha256["Cargo.toml"],
    hash(value.sourceBytes["Cargo.toml"]),
  );
  value.sourceBytes["feature/src/lib.rs"] = Buffer.from([0xff]);
  assert.throws(() => prepareRustFeatureInventory(value), /encoded data/u);
});

test("unknown, duplicate and empty profile selections fail before producing a partial inventory", () => {
  for (const change of [
    (value) => {
      value.profileId = "typo";
    },
    (value) => {
      value.config.profiles.push(structuredClone(value.config.profiles[0]));
    },
    (value) => {
      value.config.seeds[0].profiles = ["typo"];
    },
    (value) => {
      value.config.seeds[0].profiles = [];
    },
    (value) => {
      value.config.seeds[0].profiles = ["native"];
    },
    (value) => {
      value.config.seeds.push(structuredClone(value.config.seeds[0]));
    },
    (value) => {
      value.config.profiles[0].features = ["a", "a"];
    },
    (value) => {
      value.config.profiles[0].metadataSha256 = "bad";
    },
  ]) {
    const value = fixture();
    change(value);
    assert.throws(() => prepareRustFeatureInventory(value));
  }
});

test("all seeds, including currently unselected ones, require reviewed valid source provenance", () => {
  for (const change of [
    (value) => {
      value.config.seeds[1].review.status = "candidate";
    },
    (value) => {
      value.config.seeds[1].evidence = [];
    },
    (value) => {
      value.config.seeds[1].evidence[0].lines = [0];
    },
    (value) => {
      value.config.seeds[1].evidence[0].lines = [999];
    },
    (value) => {
      value.config.seeds[1].evidence[0].path = "../outside.rs";
    },
    (value) => {
      value.config.seeds[1].ownerManifest = "C:/outside/Cargo.toml";
    },
    (value) => {
      value.config.seeds[1].kind = "dev";
    },
    (value) => {
      value.config.seeds[1].originContext = "shipping";
    },
  ]) {
    const value = fixture();
    change(value);
    assert.throws(() => prepareRustFeatureInventory(value));
  }
});

test("the inventory API has no incomplete-scope acceptance override", () => {
  const value = fixture();
  value.allowIncomplete = true;
  value.config.allowIncomplete = true;
  value.config.rootCompletenessVerified = true;
  const report = prepareRustFeatureInventory(value);
  assert.equal(report.rootCompletenessVerified, false);
  assert.equal(report.completeness.status, "incomplete");
  value.config.completeness.status = "reviewed-complete";
  assert.throws(
    () => prepareRustFeatureInventory(value),
    /never a release approval/u,
  );
  value.config.completeness.status = "incomplete";
  value.config.completeness.unresolved = [];
  assert.throws(
    () => prepareRustFeatureInventory(value),
    /remaining review gaps/u,
  );
});

// Validate the actual checked-in config belonging to this checkout, without Cargo,
// network, dependency installation or selecting an unrelated workspace/core root.
test("actual versioned config validates all source pins and every exact profile selection", () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const scope = existsSync(resolve(repo, "scripts/rust_feature_scope.pr2.json"))
    ? "pr2"
    : "pr1";
  const config = JSON.parse(
    readFileSync(
      resolve(repo, `scripts/rust_feature_scope.${scope}.json`),
      "utf8",
    ),
  );
  const sourceBytes = Object.fromEntries(
    Object.keys(config.sourceFiles).map((path) => [
      path,
      readFileSync(resolve(repo, path)),
    ]),
  );
  const cargoLock = readFileSync(resolve(repo, "Cargo.lock"));
  for (const profile of config.profiles) {
    const result = prepareRustFeatureInventory({
      config,
      profileId: profile.id,
      sourceBytes,
      cargoLock,
    });
    assert.deepEqual(
      result.seeds.map((seed) => seed.id),
      config.seeds
        .filter((seed) => seed.profiles.includes(profile.id))
        .map((seed) => seed.id),
    );
    assert.ok(result.seeds.length > 0);
    if (profile.id === "android-inference-store")
      assert.ok(
        result.seeds.every(
          (seed) =>
            seed.ownerManifest.startsWith("frontend/") &&
            seed.originContext !== "test",
        ),
      );
    if (profile.id === "windows-inference")
      assert.ok(
        result.seeds.every((seed) =>
          seed.ownerManifest.startsWith("frontend/"),
        ),
      );
    assert.equal(result.rootCompletenessVerified, false);
  }
  const mutated = structuredClone(config);
  mutated.seeds[0].expected.checksum = "0".repeat(64);
  assert.throws(() =>
    prepareRustFeatureInventory({
      config: mutated,
      profileId: config.profiles[0].id,
      sourceBytes,
      cargoLock,
    }),
  );
  assert.ok(
    config.seeds.some(
      (seed) => seed.kind === "normal" && seed.originContext === "build",
    ),
  );
  assert.ok(
    config.seeds.some(
      (seed) => seed.kind === "normal" && seed.originContext === "test",
    ),
  );
  if (scope === "pr2") {
    assert.ok(!config.seeds.some((seed) => seed.dependencyName === "futures"));
    assert.ok(
      !config.seeds.some(
        (seed) =>
          seed.ownerPackage === "chat_events" &&
          seed.dependencyName === "tracing",
      ),
    );
  }
});
