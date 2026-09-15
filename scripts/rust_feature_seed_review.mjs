// Pure source binding for base inventories and separately versioned reviewer receipts.
// No automated Rust analysis, audit authorization or release approval.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lockIdentities } from "./rust_feature_scope.mjs";

/**
 * Validates a separately versioned reviewer receipt against an incomplete base
 * inventory. The receipt records the human/source-review conclusion; this is
 * not an automatic Rust parser or proof that the reviewer chose every file.
 * Every configured source and seed/profile must have an explicit disposition,
 * and every unresolved base-inventory gap must cite reviewed coverage units.
 * Advisory, binary, runtime and release acceptance remain separate.
 */
export function verifyRustFeatureScopeReview({
  config,
  configBytes,
  review,
  sourceBytes,
  cargoLock,
}) {
  assert.deepEqual(
    JSON.parse(Buffer.from(configBytes).toString("utf8")),
    config,
    "Review config object differs from its bound bytes",
  );
  // Preserve the v1 inventory API and validate all of its source/lock/seed rules.
  for (const profile of config.profiles)
    prepareRustFeatureInventory({
      config,
      profileId: profile.id,
      sourceBytes,
      cargoLock,
    });
  const exact = (value, expected, label) =>
    assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
  exact(
    review,
    ["schemaVersion", "configSha256", "boundary", "units", "resolutions"],
    "Unknown or missing source-review fields",
  );
  assert.equal(review.schemaVersion, 1);
  validHash(review.configSha256);
  assert.equal(
    review.configSha256,
    reviewHash(configBytes),
    "Stale source-review config",
  );
  const explanation = (value) =>
    assert.ok(
      typeof value === "string" &&
        value.trim().length >= 20 &&
        value.length <= 8000,
      "A substantive bounded review explanation is required",
    );
  explanation(review.boundary);
  unique(
    review.units.map((unit) => unit.id),
    "source-review units",
  );
  assert.ok(review.units.length <= 4096, "Too many source-review units");
  const knownProfiles = new Set(config.profiles.map((profile) => profile.id));
  const knownSeeds = new Map(config.seeds.map((seed) => [seed.id, seed]));
  const coveredSources = new Set();
  const coveredSeedProfiles = new Set();
  const units = new Map();
  for (const unit of review.units) {
    exact(
      unit,
      ["id", "disposition", "explanation", "profiles", "sources", "seeds"],
      "Unknown or missing source-review unit fields",
    );
    identifier(unit.id);
    explanation(unit.explanation);
    assert.ok(
      ["external-owner-edges", "no-additional-external-owner-edge"].includes(
        unit.disposition,
      ),
      "Unknown review disposition",
    );
    unique(unit.profiles, "review-unit profiles");
    for (const profile of unit.profiles)
      assert.ok(knownProfiles.has(profile), "Unknown review-unit profile");
    unique(
      unit.sources.map((source) => source.path),
      "review-unit sources",
    );
    assert.ok(unit.sources.length <= 4096, "Too many review-unit sources");
    const evidence = new Map();
    for (const source of unit.sources) {
      exact(
        source,
        ["path", "lines"],
        "Unknown or missing review-source fields",
      );
      relativePath(source.path);
      assert.ok(
        Object.hasOwn(config.sourceFiles, source.path),
        "Unbound review source",
      );
      unique(source.lines, "review-source lines");
      assert.ok(source.lines.length <= 10000, "Too many review-source lines");
      const lineCount = Buffer.from(sourceBytes[source.path])
        .toString("utf8")
        .split(/\r?\n/u).length;
      for (const line of source.lines)
        assert.ok(
          Number.isSafeInteger(line) && line > 0 && line <= lineCount,
          "Invalid review-source line",
        );
      coveredSources.add(source.path);
      evidence.set(source.path, new Set(source.lines));
    }
    assert.ok(Array.isArray(unit.seeds), "Missing reviewed seed dispositions");
    assert.equal(
      new Set(unit.seeds).size,
      unit.seeds.length,
      "Duplicate reviewed seed",
    );
    if (unit.disposition === "no-additional-external-owner-edge") {
      assert.equal(
        unit.seeds.length,
        0,
        "No-edge review cannot assign dependency roots",
      );
    } else {
      assert.ok(unit.seeds.length > 0, "Owner-edge review has no roots");
      for (const id of unit.seeds) {
        const seed = knownSeeds.get(id);
        assert.ok(seed, "Unknown reviewed seed");
        assert.ok(
          evidence.has(seed.ownerManifest),
          "Reviewed seed owner manifest is absent",
        );
        for (const item of seed.evidence)
          for (const line of item.lines)
            assert.ok(
              evidence.get(item.path)?.has(line),
              "Reviewed seed source evidence is incomplete",
            );
        for (const profile of unit.profiles) {
          assert.ok(
            seed.profiles.includes(profile),
            "Reviewed seed leaks into another profile",
          );
          coveredSeedProfiles.add(JSON.stringify([id, profile]));
        }
      }
    }
    units.set(unit.id, unit);
  }
  assert.deepEqual(
    [...coveredSources].sort(),
    Object.keys(config.sourceFiles).sort(),
    "Source review does not cover the entire configured boundary",
  );
  const expectedSeedProfiles = config.seeds.flatMap((seed) =>
    seed.profiles.map((profile) => JSON.stringify([seed.id, profile])),
  );
  assert.deepEqual(
    [...coveredSeedProfiles].sort(),
    expectedSeedProfiles.sort(),
    "Source review omits a seed/profile",
  );
  unique(
    review.resolutions.map((resolution) => resolution.id),
    "review-gap resolutions",
  );
  assert.deepEqual(
    review.resolutions.map((resolution) => resolution.id).sort(),
    config.completeness.unresolved.map((gap) => gap.id).sort(),
    "Source review must resolve every inventory gap, and only those gaps",
  );
  for (const resolution of review.resolutions) {
    exact(
      resolution,
      ["id", "explanation", "units"],
      "Unknown or missing review-resolution fields",
    );
    explanation(resolution.explanation);
    unique(resolution.units, "gap-resolution units");
    for (const id of resolution.units)
      assert.ok(units.has(id), "Gap resolution cites an unknown review unit");
  }
  return {
    assessment: "validated-versioned-source-review",
    rootCompletenessVerified: true,
    completeness: { status: "complete", unresolved: [] },
    configSha256: review.configSha256,
    reviewedSourceCount: coveredSources.size,
    reviewedSeedProfileCount: coveredSeedProfiles.size,
    reviewedUnitCount: units.size,
    boundary: review.boundary,
    automaticSourceAnalysis: false,
    wholeRepositoryCoverage: false,
    advisoryChecksPerformed: false,
    releaseAcceptance: false,
  };
}

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const reviewHash = (bytes) =>
  hash(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
      .decode(typeof bytes === "string" ? Buffer.from(bytes) : bytes)
      .replaceAll("\r\n", "\n"),
  );
const validHash = (value) => assert.match(value, /^[a-f0-9]{64}$/u);
const identifier = (value) => assert.match(value, /^[A-Za-z0-9_.-]+$/u);
const relativePath = (value) => {
  assert.equal(typeof value, "string");
  assert.doesNotMatch(value, /[\\\0\r\n:]|^\//u, "Invalid provenance location");
  assert.ok(
    value.split("/").every((part) => part && part !== "." && part !== ".."),
    "Provenance location escapes the repository",
  );
};
const unique = (values, label) => {
  assert.ok(Array.isArray(values) && values.length, `Missing ${label}`);
  assert.equal(new Set(values).size, values.length, `Duplicate ${label}`);
};

/**
 * Validates the entire source review before selecting collector-compatible seeds.
 * sourceBytes contains exactly the config's relative sourceFiles keys (including
 * Cargo.toml and selected owner manifests). No filesystem, Cargo or network IO.
 * This v1 adapter deliberately supports incomplete INVENTORIES ONLY: there is no
 * allowIncomplete/acceptance override and rootCompletenessVerified is always false.
 * A release/advisory caller must independently reject this incomplete result.
 */
export function prepareRustFeatureInventory({
  config,
  profileId,
  sourceBytes,
  cargoLock,
}) {
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.reviewTextIdentity, "utf8-lf");
  assert.equal(
    config.completeness?.status,
    "incomplete",
    "This API accepts incomplete inventories only, never a release approval",
  );
  const unresolved = config.completeness.unresolved;
  assert.ok(
    Array.isArray(unresolved) && unresolved.length,
    "Incomplete inventory must identify its remaining review gaps",
  );
  unique(
    unresolved.map((gap) => gap.id),
    "review gaps",
  );
  for (const gap of unresolved) {
    identifier(gap.id);
    assert.ok(typeof gap.description === "string" && gap.description.trim());
  }
  assert.match(config.sourceRevision?.base, /^[a-f0-9]{40}$/u);
  assert.match(config.sourceRevision?.head, /^[a-f0-9]{40}$/u);
  validHash(config.cargoLockSha256);
  assert.equal(
    reviewHash(cargoLock),
    config.cargoLockSha256,
    "Cargo.lock identity mismatch",
  );
  const locks = lockIdentities(cargoLock);
  assert.ok(config.sourceFiles && sourceBytes);
  const paths = Object.keys(config.sourceFiles).sort();
  assert.ok(paths.includes("Cargo.toml"), "Workspace manifest is required");
  assert.deepEqual(
    Object.keys(sourceBytes).sort(),
    paths,
    "Source identity/bytes set differs",
  );
  for (const path of paths) {
    relativePath(path);
    validHash(config.sourceFiles[path]);
    assert.equal(
      reviewHash(sourceBytes[path]),
      config.sourceFiles[path],
      `Source identity mismatch: ${path}`,
    );
  }
  assert.ok(Array.isArray(config.profiles));
  unique(
    config.profiles.map((profile) => profile.id),
    "profiles",
  );
  const profiles = new Map();
  for (const profile of config.profiles) {
    identifier(profile.id);
    identifier(profile.target);
    assert.ok(Array.isArray(profile.features));
    assert.equal(
      new Set(profile.features).size,
      profile.features.length,
      "Duplicate profile feature",
    );
    for (const feature of profile.features)
      assert.match(feature, /^[A-Za-z0-9_.\/-]+$/u);
    if (profile.metadataSha256 !== null) validHash(profile.metadataSha256);
    profiles.set(profile.id, profile);
  }
  assert.ok(profiles.has(profileId), "Unknown selected profile");
  assert.ok(Array.isArray(config.seeds));
  unique(
    config.seeds.map((seed) => seed.id),
    "seed identities",
  );
  for (const seed of config.seeds) {
    identifier(seed.id);
    identifier(seed.ownerPackage);
    identifier(seed.dependencyName);
    relativePath(seed.ownerManifest);
    assert.equal(seed.ownerManifest.split("/").at(-1), "Cargo.toml");
    assert.ok(
      Object.hasOwn(config.sourceFiles, seed.ownerManifest),
      "Owner manifest lacks provenance",
    );
    assert.ok(["normal", "build", "dev"].includes(seed.kind));
    assert.ok(seed.target === null || typeof seed.target === "string");
    const rank = { production: 0, build: 1, test: 2 };
    assert.ok(
      Object.hasOwn(rank, seed.originContext),
      "Unknown seed origin context",
    );
    assert.ok(
      rank[seed.originContext] >=
        rank[
          seed.kind === "dev"
            ? "test"
            : seed.kind === "build"
              ? "build"
              : "production"
        ],
      "Seed origin context downgrades Cargo kind",
    );
    assert.ok(
      typeof seed.expected?.source === "string" && seed.expected.source,
      "Only explicit external dependency edges may be roots",
    );
    const expected = seed.expected;
    const locked = locks.get(
      JSON.stringify([expected.name, expected.version, expected.source]),
    );
    assert.ok(locked, "Expected external identity is absent from this lock");
    assert.equal(
      expected.checksum ?? null,
      locked.checksum,
      "Expected checksum differs from lock",
    );
    unique(seed.profiles, "seed profiles");
    for (const profile of seed.profiles)
      assert.ok(profiles.has(profile), "Unknown seed profile");
    assert.equal(
      seed.review?.status,
      "source-traced",
      "Unreviewed seed cannot be selected",
    );
    assert.ok(
      ["source-call-or-schema", "new-feature-exclusive-manifest"].includes(
        seed.review.basis,
      ),
    );
    assert.ok(
      Array.isArray(seed.evidence) && seed.evidence.length,
      "Seed has no source evidence",
    );
    for (const evidence of seed.evidence) {
      relativePath(evidence.path);
      assert.ok(
        Object.hasOwn(config.sourceFiles, evidence.path),
        "Evidence source lacks identity",
      );
      unique(evidence.lines, "evidence lines");
      const lines = Buffer.from(sourceBytes[evidence.path])
        .toString("utf8")
        .split(/\r?\n/u);
      for (const line of evidence.lines)
        assert.ok(
          Number.isInteger(line) && line > 0 && line <= lines.length,
          "Invalid evidence line",
        );
    }
  }
  const selected = config.seeds.filter((seed) =>
    seed.profiles.includes(profileId),
  );
  assert.ok(selected.length, "Selected profile has no roots");
  return {
    schemaVersion: 1,
    assessment: "offline-source-reviewed-seed-inventory",
    rootCompletenessVerified: false,
    advisoryChecksPerformed: false,
    completeness: structuredClone(config.completeness),
    profile: structuredClone(profiles.get(profileId)),
    identity: {
      cargoLockSha256: hash(cargoLock),
      manifestSha256: Object.fromEntries(
        paths
          .filter((path) => path.split("/").at(-1) === "Cargo.toml")
          .map((path) => [path, hash(sourceBytes[path])]),
      ),
    },
    seeds: selected.map(
      ({
        id,
        ownerManifest,
        ownerPackage,
        dependencyName,
        kind,
        target,
        originContext,
        expected,
      }) => ({
        id,
        ownerManifest,
        ownerPackage,
        dependencyName,
        kind,
        target,
        originContext,
        expected: structuredClone(expected),
      }),
    ),
  };
}
