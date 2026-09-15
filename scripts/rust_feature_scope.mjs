// Pure offline inventory API. Callers supply a trusted metadata-production identity
// record and the corresponding bytes. This neither runs Cargo nor contacts an advisory
// service, and does not assert that the caller's selected roots cover an entire feature.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { posix, win32 } from "node:path";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha = (value) =>
  assert.match(value, /^[a-fA-F0-9]{64}$/u, "Invalid SHA-256 identity");
const kindOf = (kind) => {
  assert.ok(
    kind === null || kind === "build" || kind === "dev",
    "Unknown dependency kind",
  );
  return kind ?? "normal";
};
const tuple = ({ name, version, source }) =>
  JSON.stringify([name, version, source ?? null]);
const ordered = (values) => [...values].sort();

function checkedBytes(bytes, expected, label) {
  assert.ok(
    typeof bytes === "string" || bytes instanceof Uint8Array,
    `Missing ${label} bytes`,
  );
  sha(expected);
  assert.equal(
    digest(bytes),
    expected.toLowerCase(),
    `${label} identity mismatch`,
  );
}

function locations(root) {
  assert.equal(typeof root, "string");
  assert.doesNotMatch(
    root,
    /[\0\r\n]|^(?:\\\\|\/\/)/u,
    "Unsupported workspace location",
  );
  const path = /^[A-Za-z]:[\\/]/u.test(root) ? win32 : posix;
  assert.ok(path.isAbsolute(root), "Workspace root must be absolute");
  const canonical = (value) => {
    assert.equal(typeof value, "string");
    assert.doesNotMatch(value, /[\0\r\n]/u);
    assert.ok(path.isAbsolute(value), "Manifest location must be absolute");
    const normalized = path
      .normalize(value)
      .replaceAll("\\", "/")
      .replace(/\/$/u, "");
    return path === win32 ? normalized.toLowerCase() : normalized;
  };
  const base = canonical(root);
  const relativeManifest = (value) => {
    assert.equal(typeof value, "string");
    assert.equal(
      value.split("/").at(-1),
      "Cargo.toml",
      "Expected a Cargo manifest path",
    );
    assert.doesNotMatch(
      value,
      /[\\\0\r\n:]|^\//u,
      "Manifest must use a relative repository path",
    );
    assert.ok(
      value.split("/").every((part) => part && part !== "." && part !== ".."),
      "Manifest path escapes its workspace",
    );
    return value;
  };
  const absoluteManifest = (value) => {
    const relative = path.relative(root, value).replaceAll("\\", "/");
    relativeManifest(relative);
    assert.equal(canonical(path.join(root, relative)), canonical(value));
    assert.ok(
      canonical(value).startsWith(`${base}/`),
      "Manifest location escapes its workspace",
    );
    return relative;
  };
  return { canonical, base, relativeManifest, absoluteManifest };
}

// Cargo's generated lockfile has simple package identity scalars. Unsupported or
// ambiguous identities fail closed; dependency resolution itself comes from Cargo.
export function lockIdentities(bytes) {
  const text = Buffer.from(bytes).toString("utf8").replaceAll("\r\n", "\n");
  assert.match(text, /^version = [34]$/mu, "Unsupported Cargo.lock format");
  const packages = new Map();
  const blocks = text.split(/^\[\[package\]\]\n/mu).slice(1);
  assert.ok(blocks.length, "Cargo.lock contains no package identities");
  for (const block of blocks) {
    const scalar = (key, required = true) => {
      const entries = [
        ...block.matchAll(new RegExp(`^${key} = "([^"\\\\\\n]+)"$`, "gmu")),
      ];
      const declarations = [
        ...block.matchAll(new RegExp(`^${key}\\s*=`, "gmu")),
      ];
      assert.equal(
        entries.length,
        declarations.length,
        `Malformed lock ${key}`,
      );
      assert.ok(
        entries.length === 1 || (!required && entries.length === 0),
        `Missing/ambiguous lock ${key}`,
      );
      return entries[0]?.[1] ?? null;
    };
    const value = {
      name: scalar("name"),
      version: scalar("version"),
      source: scalar("source", false),
      checksum: scalar("checksum", false),
    };
    if (value.checksum !== null) sha(value.checksum);
    const key = tuple(value);
    assert.ok(!packages.has(key), "Duplicate lock package identity");
    packages.set(key, value);
  }
  return packages;
}

function uniqueMap(values, key, label) {
  assert.ok(Array.isArray(values), `Missing ${label}`);
  const result = new Map();
  for (const value of values) {
    assert.equal(typeof value[key], "string", `Invalid ${label} identity`);
    assert.ok(!result.has(value[key]), `Duplicate ${label} identity`);
    result.set(value[key], value);
  }
  return result;
}

/**
 * identity: {metadataSha256, cargoLockSha256, workspaceRoot,
 *   manifestSha256: {"Cargo.toml": SHA, "owner/Cargo.toml": SHA},
 *   profile: {target: string, features: string[]}}
 * inputs: {metadataJson: string, cargoLock: bytes, manifests: {relativePath: bytes}}
 * seeds: [{id, ownerManifest, ownerPackage, dependencyName (Cargo resolve alias),
 *   kind: "normal"|"build"|"dev", target: null|string,
 *   originContext?: "production"|"build"|"test",
 *   expected: {name, version, source, checksum?: SHA}}]
 *
 * Profile provenance is supplied by the producer: Cargo metadata does not encode
 * its command line. Paths are checked lexically; this API performs no filesystem IO.
 */
export function collectRustFeatureScope({ identity, inputs, seeds }) {
  assert.ok(identity && inputs);
  assert.equal(typeof inputs.metadataJson, "string");
  checkedBytes(inputs.metadataJson, identity.metadataSha256, "Metadata");
  checkedBytes(inputs.cargoLock, identity.cargoLockSha256, "Cargo.lock");
  assert.ok(identity.manifestSha256 && inputs.manifests);
  const loc = locations(identity.workspaceRoot);
  const manifests = Object.keys(identity.manifestSha256).sort();
  assert.ok(
    manifests.includes("Cargo.toml"),
    "Workspace manifest identity is required",
  );
  assert.deepEqual(
    Object.keys(inputs.manifests).sort(),
    manifests,
    "Manifest identity/bytes set differs",
  );
  for (const manifest of manifests) {
    loc.relativeManifest(manifest);
    checkedBytes(
      inputs.manifests[manifest],
      identity.manifestSha256[manifest],
      manifest,
    );
  }
  assert.equal(typeof identity.profile?.target, "string");
  assert.match(identity.profile.target, /^[A-Za-z0-9_.-]+$/u);
  assert.ok(Array.isArray(identity.profile.features));
  assert.equal(
    new Set(identity.profile.features).size,
    identity.profile.features.length,
  );
  for (const feature of identity.profile.features)
    assert.match(feature, /^[A-Za-z0-9_./-]+$/u);
  const metadata = JSON.parse(inputs.metadataJson);
  assert.equal(metadata.version, 1, "Unsupported metadata format");
  assert.equal(
    loc.canonical(metadata.workspace_root),
    loc.base,
    "Metadata workspace identity mismatch",
  );
  const packages = uniqueMap(metadata.packages, "id", "package");
  const nodes = uniqueMap(metadata.resolve?.nodes, "id", "resolved node");
  assert.ok(
    Array.isArray(metadata.workspace_members),
    "Missing workspace membership",
  );
  const members = new Set(metadata.workspace_members);
  const locks = lockIdentities(inputs.cargoLock);
  assert.ok(
    Array.isArray(seeds) && seeds.length,
    "At least one explicit external seed is required",
  );
  assert.equal(
    new Set(seeds.map((seed) => seed.id)).size,
    seeds.length,
    "Duplicate seed identity",
  );
  const foundPackages = new Map(),
    foundEdges = new Map(),
    roots = [];
  const queue = [],
    visited = new Set();

  function packageRecord(id) {
    assert.ok(packages.has(id), `Resolved package is missing: ${id}`);
    assert.ok(nodes.has(id), `Resolved node is missing: ${id}`);
    const pkg = packages.get(id),
      node = nodes.get(id);
    assert.equal(typeof pkg.name, "string");
    assert.equal(typeof pkg.version, "string");
    assert.ok(pkg.source === null || typeof pkg.source === "string");
    const lock = locks.get(tuple(pkg));
    assert.ok(
      lock,
      `Resolved package is absent from the verified lock: ${pkg.name}@${pkg.version}`,
    );
    if (pkg.checksum != null) {
      sha(pkg.checksum);
      assert.equal(
        pkg.checksum.toLowerCase(),
        lock.checksum?.toLowerCase(),
        "Metadata/lock checksum mismatch",
      );
    }
    const manifest =
      pkg.source === null ? loc.absoluteManifest(pkg.manifest_path) : null;
    if (manifest !== null)
      assert.ok(
        manifests.includes(manifest),
        `Missing local dependency manifest identity: ${manifest}`,
      );
    assert.ok(
      Array.isArray(node.features) &&
        node.features.every((feature) => typeof feature === "string"),
    );
    assert.ok(
      Array.isArray(node.deps),
      `Missing active dependency edges: ${pkg.name}`,
    );
    const key =
      pkg.source === null
        ? `path:${manifest}#${pkg.name}@${pkg.version}`
        : tuple(pkg);
    if (!foundPackages.has(id))
      foundPackages.set(id, {
        key,
        name: pkg.name,
        version: pkg.version,
        source: pkg.source,
        checksum: lock.checksum,
        manifest,
        resolvedFeatures: ordered(new Set(node.features)),
        provenance: new Set(),
      });
    return { pkg, node, record: foundPackages.get(id) };
  }

  for (const seed of seeds) {
    assert.match(seed.id, /^[A-Za-z0-9_.-]+$/u);
    loc.relativeManifest(seed.ownerManifest);
    assert.ok(
      manifests.includes(seed.ownerManifest),
      "Seed owner lacks a verified manifest",
    );
    assert.ok(["normal", "build", "dev"].includes(seed.kind));
    const defaultContext =
      seed.kind === "dev"
        ? "test"
        : seed.kind === "build"
          ? "build"
          : "production";
    const originContext =
      seed.originContext === undefined ? defaultContext : seed.originContext;
    assert.ok(
      ["production", "build", "test"].includes(originContext),
      "Unknown seed origin context",
    );
    const contextRank = { production: 0, build: 1, test: 2 };
    assert.ok(
      contextRank[originContext] >= contextRank[defaultContext],
      "Seed origin context cannot downgrade the declared dependency kind",
    );
    assert.ok(seed.target === null || typeof seed.target === "string");
    assert.equal(typeof seed.dependencyName, "string");
    assert.ok(
      seed.expected &&
        typeof seed.expected.source === "string" &&
        seed.expected.source,
      "Seeds must name an external dependency, not an entire workspace/core crate",
    );
    const owners = metadata.packages.filter(
      (pkg) =>
        pkg.source === null &&
        members.has(pkg.id) &&
        pkg.name === seed.ownerPackage &&
        loc.canonical(pkg.manifest_path) ===
          loc.canonical(
            posix.join(
              identity.workspaceRoot.replaceAll("\\", "/"),
              seed.ownerManifest,
            ),
          ),
    );
    assert.equal(owners.length, 1, "Missing/ambiguous seed owner");
    const [owner] = owners;
    loc.absoluteManifest(owner.manifest_path);
    assert.ok(
      locks.has(tuple(owner)),
      "Seed owner is absent from the verified lock",
    );
    assert.ok(
      Array.isArray(owner.dependencies),
      "Missing seed owner dependency declarations",
    );
    const declarations = owner.dependencies.filter(
      (dep) =>
        (dep.rename ?? dep.name).replaceAll("-", "_") === seed.dependencyName &&
        kindOf(dep.kind) === seed.kind &&
        dep.target === seed.target,
    );
    assert.equal(
      declarations.length,
      1,
      "Missing/ambiguous declared seed dependency",
    );
    const declaration = declarations[0];
    assert.equal(
      declaration.name,
      seed.expected.name,
      "Declared dependency identity mismatch",
    );
    assert.ok(
      Array.isArray(declaration.features) &&
        declaration.features.every((feature) => typeof feature === "string"),
      "Missing requested feature provenance",
    );
    assert.equal(
      typeof declaration.uses_default_features,
      "boolean",
      "Missing default feature provenance",
    );
    assert.equal(
      typeof declaration.optional,
      "boolean",
      "Missing optional dependency provenance",
    );
    assert.ok(nodes.has(owner.id), "Seed owner has no resolved node");
    assert.ok(
      Array.isArray(nodes.get(owner.id).deps),
      "Missing seed owner resolved edges",
    );
    const ownerEdges = nodes
      .get(owner.id)
      .deps.filter(
        (dep) =>
          dep.name === seed.dependencyName &&
          dep.dep_kinds.some(
            (kind) =>
              kindOf(kind.kind) === seed.kind && kind.target === seed.target,
          ),
      );
    assert.equal(
      ownerEdges.length,
      1,
      "Missing/ambiguous active seed dependency",
    );
    const { pkg, record } = packageRecord(ownerEdges[0].pkg);
    assert.equal(
      tuple(pkg),
      tuple(seed.expected),
      "Resolved seed identity mismatch",
    );
    if (seed.expected.checksum != null) {
      sha(seed.expected.checksum);
      assert.equal(
        record.checksum?.toLowerCase(),
        seed.expected.checksum.toLowerCase(),
        "Resolved seed checksum mismatch",
      );
    }
    roots.push({
      id: seed.id,
      ownerManifest: seed.ownerManifest,
      ownerPackage: seed.ownerPackage,
      dependencyName: seed.dependencyName,
      kind: seed.kind,
      originContext,
      target: seed.target,
      package: record.key,
      requestedFeatures: ordered(declaration.features),
      usesDefaultFeatures: declaration.uses_default_features,
      optional: declaration.optional,
    });
    queue.push({
      id: pkg.id,
      seed: seed.id,
      context: originContext,
    });
  }

  for (let index = 0; index < queue.length; index++) {
    const state = queue[index],
      mark = JSON.stringify(state);
    if (visited.has(mark)) continue;
    visited.add(mark);
    const { node, record } = packageRecord(state.id);
    record.provenance.add(JSON.stringify([state.seed, state.context]));
    for (const dependency of node.deps) {
      assert.equal(typeof dependency.name, "string");
      assert.ok(
        Array.isArray(dependency.dep_kinds) && dependency.dep_kinds.length,
        "Missing edge provenance",
      );
      const to = packageRecord(dependency.pkg).record;
      for (const raw of dependency.dep_kinds) {
        const kind = kindOf(raw.kind);
        assert.ok(
          raw.target === null || typeof raw.target === "string",
          "Missing target provenance",
        );
        const context =
          state.context === "test" || kind === "dev"
            ? "test"
            : state.context === "build" || kind === "build"
              ? "build"
              : "production";
        const key = JSON.stringify([
          record.key,
          to.key,
          dependency.name,
          kind,
          raw.target,
        ]);
        if (!foundEdges.has(key))
          foundEdges.set(key, {
            from: record.key,
            to: to.key,
            dependencyName: dependency.name,
            kind,
            target: raw.target,
            provenance: new Set(),
          });
        foundEdges
          .get(key)
          .provenance.add(JSON.stringify([state.seed, context]));
        queue.push({ id: dependency.pkg, seed: state.seed, context });
      }
    }
  }
  const provenance = (set) =>
    ordered(set).map((value) => {
      const [seed, context] = JSON.parse(value);
      return { seed, context };
    });
  return {
    schemaVersion: 1,
    assessment: "offline-selected-external-dependency-closure",
    rootCompletenessVerified: false,
    advisoryChecksPerformed: false,
    featurePrecision: "workspace-wide-resolved-feature-union-overapproximation",
    profile: {
      target: identity.profile.target,
      features: ordered(identity.profile.features),
    },
    limitations: [
      "Root completeness remains the caller's review responsibility.",
      "Metadata profile comes from the supplied production record, not an embedded Cargo command line.",
      "Activated features may include requirements of unrelated workspace consumers.",
      "Normal/build/dev and target conditions are retained per edge; this is not shipping-binary reachability.",
      "Seed origin contexts preserve source-reviewed host or test roles separately from Cargo dependency kinds.",
      "Manifest boundaries are checked lexically; no filesystem or symlink inspection is performed.",
    ],
    identity: {
      metadataSha256: identity.metadataSha256.toLowerCase(),
      cargoLockSha256: identity.cargoLockSha256.toLowerCase(),
      manifestSha256: Object.fromEntries(
        manifests.map((manifest) => [
          manifest,
          identity.manifestSha256[manifest].toLowerCase(),
        ]),
      ),
    },
    roots: roots.sort((a, b) => a.id.localeCompare(b.id)),
    packages: [...foundPackages.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((record) => ({
        ...record,
        provenance: provenance(record.provenance),
      })),
    edges: [...foundEdges.values()]
      .sort((a, b) =>
        JSON.stringify([
          a.from,
          a.to,
          a.dependencyName,
          a.kind,
          a.target,
        ]).localeCompare(
          JSON.stringify([b.from, b.to, b.dependencyName, b.kind, b.target]),
        ),
      )
      .map((edge) => ({ ...edge, provenance: provenance(edge.provenance) })),
  };
}
