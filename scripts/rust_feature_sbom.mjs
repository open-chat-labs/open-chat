// Pure offline CycloneDX export of caller-selected, source/lock-bound Rust graphs.
// No filesystem, Cargo, network, publishing, advisory or release-acceptance actions.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { collectRustFeatureScope } from "./rust_feature_scope.mjs";
import { prepareRustFeatureInventory } from "./rust_feature_seed_review.mjs";
import { planRustFeatureAdvisories } from "./rust_feature_advisories.mjs";

const CRATES_IO = "registry+https://github.com/rust-lang/crates.io-index";
export const RUST_FEATURE_SBOM_LIMITS = Object.freeze({
  bindingBytes: 128 * 1024 * 1024,
  singleInputBytes: 32 * 1024 * 1024,
  sourceFiles: 4096,
});
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ordered = (values) => [...values].sort();
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const json = (value) => JSON.stringify(canonical(value));
const property = (name, value) => ({
  name: "openchat:" + name,
  value: typeof value === "string" ? value : json(value),
});
const decode = (bytes) =>
  new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);

/**
 * Each item extends the existing planner envelope {id, reportJson, sha256} with:
 * binding: {configJson, configSha256, profileId, sourceBytes,
 *   collection: {identity, inputs: {metadataJson, cargoLock, manifests}}}.
 *
 * configSha256 and collection.identity must come from the caller's trusted
 * collection receipt, not be invented from the supplied files to bypass review.
 * The pure API checks supplied bytes, not filesystem freshness or producer trust.
 * Historical config profile.metadataSha256 is NOT a current metadata pin.
 */
export function exportRustFeatureSbom(profiles) {
  // Reuse all bounded graph/source-class/provenance/reachability validation.
  const plan = planRustFeatureAdvisories(profiles);
  let bindingBytes = 0;
  const bytes = (value, label) => {
    assert(
      typeof value === "string" || value instanceof Uint8Array,
      "Missing " + label + " bytes",
    );
    const copy = Buffer.from(value);
    bindingBytes += copy.length;
    assert(
      copy.length <= RUST_FEATURE_SBOM_LIMITS.singleInputBytes &&
        bindingBytes <= RUST_FEATURE_SBOM_LIMITS.bindingBytes,
      "SBOM binding byte limit exceeded",
    );
    return copy;
  };
  const components = new Map();
  const dependencies = new Map();
  const traces = [];
  for (const input of [...profiles].sort((a, b) => a.id.localeCompare(b.id))) {
    const binding = input.binding;
    assert(
      binding && binding.collection && binding.sourceBytes,
      "Missing source/config/collection binding",
    );
    const configBytes = bytes(binding.configJson, "config");
    assert.match(
      binding.configSha256,
      /^[a-f0-9]{64}$/u,
      "Invalid config SHA-256",
    );
    assert.equal(
      sha(configBytes),
      binding.configSha256,
      "Config SHA-256 mismatch",
    );
    const config = JSON.parse(decode(configBytes));
    assert(
      typeof config.feature === "string" &&
        /^[A-Za-z0-9_.-]+$/u.test(config.feature),
      "Invalid feature identity",
    );
    const sourcePaths = Object.keys(binding.sourceBytes);
    assert(
      sourcePaths.length <= RUST_FEATURE_SBOM_LIMITS.sourceFiles,
      "Source file limit exceeded",
    );
    const sourceBytes = Object.fromEntries(
      sourcePaths.map((path) => [
        path,
        bytes(binding.sourceBytes[path], "source"),
      ]),
    );
    const collection = binding.collection;
    assert(
      collection.identity && collection.inputs,
      "Missing metadata production identity/inputs",
    );
    const cargoLock = bytes(collection.inputs.cargoLock, "Cargo.lock");
    const metadataJson = decode(
      bytes(collection.inputs.metadataJson, "metadata"),
    );
    const manifestPaths = Object.keys(collection.inputs.manifests ?? {});
    assert(
      manifestPaths.length <= RUST_FEATURE_SBOM_LIMITS.sourceFiles,
      "Manifest file limit exceeded",
    );
    const manifests = Object.fromEntries(
      manifestPaths.map((path) => [
        path,
        bytes(collection.inputs.manifests[path], "manifest"),
      ]),
    );
    const prepared = prepareRustFeatureInventory({
      config,
      profileId: binding.profileId,
      sourceBytes,
      cargoLock,
    });
    assert.deepEqual(
      {
        target: collection.identity.profile?.target,
        features: ordered(collection.identity.profile?.features ?? []),
      },
      {
        target: prepared.profile.target,
        features: ordered(prepared.profile.features),
      },
      "Collection/config target or feature mismatch",
    );
    assert.equal(
      collection.identity.cargoLockSha256,
      prepared.identity.cargoLockSha256,
      "Collection/config lock mismatch",
    );
    for (const [path, expected] of Object.entries(
      prepared.identity.manifestSha256,
    )) {
      assert.equal(
        collection.identity.manifestSha256?.[path],
        expected,
        "Collection/source manifest mismatch: " + path,
      );
    }
    const report = collectRustFeatureScope({
      identity: collection.identity,
      inputs: { metadataJson, cargoLock, manifests },
      seeds: prepared.seeds,
    });
    const supplied = JSON.parse(decode(Buffer.from(input.reportJson)));
    assert.deepEqual(
      supplied,
      report,
      "Selected graph differs from bound source/config/metadata collection",
    );
    const sourceRawSha256 = Object.fromEntries(
      ordered(sourcePaths).map((path) => [path, sha(sourceBytes[path])]),
    );
    // A manifest does not identify local implementation bytes. Conservatively
    // scope path refs to the entire supplied review snapshot, not just Cargo.toml.
    // This is still only the reviewed source set, not complete path-package proof.
    const reviewedSourceSnapshotSha256 = sha(
      json({
        configSha256: binding.configSha256,
        sourceRevision: config.sourceRevision,
        sourceRawSha256,
      }),
    );
    const refs = new Map();
    for (const pkg of report.packages) {
      // Path packages from different checkouts must not merge by name/version.
      const manifestSha256 =
        pkg.manifest === null
          ? null
          : report.identity.manifestSha256[pkg.manifest];
      const identity = [pkg.key, pkg.checksum, manifestSha256];
      if (pkg.manifest !== null) identity.push(reviewedSourceSnapshotSha256);
      const ref = "urn:openchat:rust-feature:" + sha(json(identity));
      refs.set(pkg.key, ref);
      if (!components.has(ref))
        components.set(ref, {
          pkg,
          manifestSha256,
          reviewedSourceSnapshotSha256,
          occurrences: [],
        });
      components.get(ref).occurrences.push({
        profile: input.id,
        packageKey: pkg.key,
        resolvedFeatures: ordered(pkg.resolvedFeatures),
        provenance: pkg.provenance,
      });
      if (!dependencies.has(ref)) dependencies.set(ref, new Set());
    }
    for (const edge of report.edges)
      dependencies.get(refs.get(edge.from)).add(refs.get(edge.to));
    traces.push({
      id: input.id,
      feature: config.feature,
      profileId: binding.profileId,
      profile: report.profile,
      reportSha256: input.sha256,
      configSha256: binding.configSha256,
      sourceRevision: config.sourceRevision,
      sourceRawSha256,
      reviewedSourceSnapshotSha256,
      identity: report.identity,
      completeness: prepared.completeness,
      featurePrecision: report.featurePrecision,
      limitations: report.limitations,
      roots: report.roots.map((root) => ({
        ...root,
        componentRef: refs.get(root.package),
      })),
      // CDX dependsOn is intentionally supplemented: it cannot express Cargo
      // edge kind, target, renamed dependency, seed and production/build/test role.
      edges: report.edges.map((edge) => ({
        ...edge,
        fromRef: refs.get(edge.from),
        toRef: refs.get(edge.to),
      })),
    });
  }
  const bom = {
    $schema: "http://cyclonedx.org/schema/bom-1.6.schema.json",
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      properties: [
        property("assessment", "offline-selected-rust-feature-sbom"),
        property("root-completeness-verified", false),
        property("advisory-checks-performed", false),
        property("advisory-coverage", "not-proven"),
        property("release-acceptance", false),
        property("whole-repository-coverage", false),
        property("complete-apk-native-inventory", false),
        property("collection-freshness-verified", false),
        property("producer-authenticity-verified", false),
        property("license-assessment-performed", false),
        property(
          "dependency-graph-semantics",
          "Union of selected per-profile edges; exact Cargo kinds, targets and source roles are retained in profile-graphs.",
        ),
        property("profile-graphs", traces),
        property("limitations", [
          "Only explicitly supplied selected feature dependency graphs are represented.",
          "Incomplete source review remains incomplete; no advisory or release approval is granted.",
          "Cargo.lock checksums identify registry source archives, not compiled native binaries.",
          "Git revisions remain exact identities, not registry substitutions or advisory assessments.",
          "Cargo metadata omits native C/C++/llama.cpp components and does not prove APK contents.",
          "Profile features are a workspace-wide union overapproximation; source roles are not shipping reachability.",
          "Byte bindings are verified offline; filesystem freshness and collection-producer trust are not established.",
        ]),
      ],
    },
    components: [...components.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ref, value]) => {
        const {
          pkg,
          manifestSha256,
          reviewedSourceSnapshotSha256,
          occurrences,
        } = value;
        const sourceClass =
          pkg.source === null
            ? "path"
            : pkg.source.startsWith("git+")
              ? "git"
              : pkg.source === CRATES_IO
                ? "crates.io"
                : "other-registry";
        return {
          type: "library",
          "bom-ref": ref,
          name: pkg.name,
          version: pkg.version,
          ...(pkg.checksum === null
            ? {}
            : { hashes: [{ alg: "SHA-256", content: pkg.checksum }] }),
          ...(sourceClass === "crates.io"
            ? {
                purl:
                  "pkg:cargo/" +
                  encodeURIComponent(pkg.name) +
                  "@" +
                  encodeURIComponent(pkg.version),
              }
            : {}),
          ...(sourceClass === "git"
            ? {
                externalReferences: [{ type: "vcs", url: pkg.source.slice(4) }],
              }
            : {}),
          properties: [
            property("cargo-package-key", pkg.key),
            property("cargo-source", pkg.source),
            property("source-class", sourceClass),
            property("path-manifest-sha256", manifestSha256),
            ...(pkg.manifest === null
              ? []
              : [
                  property(
                    "reviewed-source-snapshot-sha256",
                    reviewedSourceSnapshotSha256,
                  ),
                ]),
            property(
              "git-revision",
              sourceClass === "git"
                ? new URL(pkg.source.slice(4)).hash.slice(1)
                : null,
            ),
            property("advisory-coverage", "not-proven"),
            property("occurrences", occurrences),
          ],
        };
      }),
    dependencies: [...dependencies.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ref, targets]) => ({ ref, dependsOn: ordered(targets) })),
  };
  // No timestamp or random serial number: identical bound input yields exact bytes.
  const bomJson = json(bom) + "\n";
  return {
    assessment: "offline-selected-rust-feature-sbom",
    advisoryAcceptance: false,
    releaseAcceptance: false,
    rootCompletenessVerified: false,
    wholeRepositoryCoverage: false,
    completeApkNativeInventory: false,
    networkRequestsPerformed: false,
    profileCount: plan.profiles.length,
    componentCount: bom.components.length,
    bom,
    bomJson,
    sha256: sha(bomJson),
  };
}
