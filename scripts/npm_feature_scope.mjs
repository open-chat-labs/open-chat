import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  openSync,
  closeSync,
  writeFileSync,
  readFileSync,
  realpathSync,
  lstatSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep, posix } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { assertReviewedArborist } from "./npm_feature_runtime.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (bytes) => JSON.parse(Buffer.from(bytes).toString("utf8"));
const types = new Set([
  "prod",
  "dev",
  "optional",
  "peer",
  "peerOptional",
  "workspace",
]);
function check(condition, message) {
  assert.ok(condition, message);
}
function location(value) {
  check(
    typeof value === "string" &&
      !value.includes("\\") &&
      !value.includes(":") &&
      !value.startsWith("/") &&
      (value === "" ||
        value.split("/").every((p) => p && p !== "." && p !== "..")),
    "unsupported or private package location",
  );
  return value;
}
function reference(value) {
  if (value == null) return null;
  check(
    typeof value === "string" &&
      !/[\\\\\r\n]/u.test(value) &&
      !/^[A-Za-z]:/u.test(value) &&
      !value.startsWith("/"),
    "unsupported or private dependency reference",
  );
  if (/^(?:git\+)?https?:/u.test(value)) {
    const url = new URL(value.replace(/^git\+/u, ""));
    check(
      url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.search,
      "dependency URL contains credentials, query data or an unsupported protocol",
    );
  } else if (value.startsWith("file:")) {
    location(posix.normalize(value.slice(5)));
  } else {
    check(
      !/^[a-z][a-z0-9+.-]*:/iu.test(value) ||
        value.startsWith("npm:") ||
        value.startsWith("workspace:"),
      "unsupported dependency reference protocol",
    );
  }
  return value;
}
function packageName(value) {
  check(
    typeof value === "string" &&
      /^(?:@[a-z0-9_.~-]+\/)?[a-z0-9_.~-]+$/iu.test(value),
    "invalid package name",
  );
  return value;
}
function declared(pkg, node, legacyPeerDeps) {
  check(
    Boolean(node.legacyPeerDeps) === legacyPeerDeps &&
      !node.sourceReference &&
      !node.globalTop,
    "unsupported virtual dependency mode",
  );
  const result = new Map();
  // Reviewed Arborist 9.7.0 Node._loadDeps precedence (unchanged from 9.4.0);
  // real-engine coverage is in npm_feature_runtime_smoke.mjs. Registry packages do
  // not acquire their development dependency graph.
  const sections = legacyPeerDeps ? [] : [["peerDependencies", "peer"]];
  sections.push(["dependencies", "prod"], ["optionalDependencies", "optional"]);
  if (node.isTop && node.path) sections.push(["devDependencies", "dev"]);
  for (const [field, type] of sections) {
    for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
      packageName(name);
      const effectiveType =
        type === "peer" && pkg.peerDependenciesMeta?.[name]?.optional === true
          ? "peerOptional"
          : type;
      result.set(name, { type: effectiveType, spec });
    }
  }
  return result;
}
function optionalPeerExistsInLock(packages, from, name) {
  let at = from;
  while (true) {
    if (
      posix.basename(at) !== "node_modules" &&
      Object.hasOwn(packages, (at ? at + "/" : "") + "node_modules/" + name)
    )
      return true;
    if (!at) return false;
    const parent = posix.dirname(at);
    at = parent === "." ? "" : parent;
  }
}

/** Draft lock inventory only: no advisory lookup, installation or completeness approval. */
function collectGraph({
  tree,
  packageBytes,
  lockBytes,
  seedBytes,
  arboristPackageBytes,
  legacyPeerDeps,
  allowPeerDiagnostics = false,
}) {
  const pkg = json(packageBytes);
  const lock = json(lockBytes);
  const config = json(seedBytes);
  const runtime = json(arboristPackageBytes);
  assertReviewedArborist(runtime);
  check(
    [2, 3].includes(lock.lockfileVersion) && lock.packages && lock.packages[""],
    "expected a complete npm v2/v3 packages lock",
  );
  check(
    config.schemaVersion === 1 &&
      config.status === "draft" &&
      typeof config.scopeId === "string" &&
      /^[a-z0-9-]+$/u.test(config.scopeId) &&
      Array.isArray(config.seeds) &&
      config.seeds.length,
    "expected explicit draft feature seeds",
  );
  check(
    tree?.inventory instanceof Map && tree.location === "",
    "expected a virtual root inventory",
  );
  const inventory = new Map();
  for (const [key, node] of tree.inventory) {
    location(key);
    check(
      node && key === node.location && !inventory.has(key),
      "duplicate or mismatched inventory location",
    );
    inventory.set(key, node);
  }
  check(inventory.get("") === tree, "virtual root identity mismatch");
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
    "peerDependenciesMeta",
  ]) {
    assert.deepEqual(
      pkg[field] ?? {},
      lock.packages[""][field] ?? {},
      "root manifest/lock declaration mismatch",
    );
  }
  const selected = new Map();
  const edges = [];
  const omittedOptionalPeers = [];
  const peerDiagnostics = [];
  const seeds = [];
  const seenSeeds = new Set();
  function metadata(node) {
    const at = location(node.location);
    check(
      inventory.get(at) === node && Object.hasOwn(lock.packages, at),
      "node absent from bound lock inventory",
    );
    return at === "" ? pkg : lock.packages[at];
  }
  function edgeRecord(node, key, edge) {
    const meta = metadata(node);
    packageName(key);
    const expected = declared(meta, node, legacyPeerDeps).get(key);
    check(
      edge &&
        edge.from === node &&
        edge.name === key &&
        types.has(edge.type) &&
        expected &&
        edge.rawSpec === expected.spec &&
        (edge.type === expected.type ||
          (edge.type === "workspace" && expected.type === "prod")),
      "dependency edge does not match its bound declaration",
    );
    const record = {
      from: node.location,
      name: key,
      type: edge.type,
      requested: reference(edge.rawSpec),
      effective: reference(edge.spec),
    };
    const peer = edge.type === "peer" || edge.type === "peerOptional";
    const invalidPeer =
      allowPeerDiagnostics &&
      peer &&
      edge.valid === false &&
      ((edge.error === "INVALID" && edge.to) ||
        (edge.error === "MISSING" && !edge.to));
    check(
      (edge.error == null && edge.valid === true) || invalidPeer,
      "invalid resolved dependency edge",
    );
    if (invalidPeer) {
      peerDiagnostics.push({
        ...record,
        to: edge.to?.location ?? null,
        status: edge.to ? "invalid-peer" : "missing-peer",
        error: edge.error,
      });
    }
    if (!edge.to) {
      check(
        (edge.type === "peerOptional" || invalidPeer) &&
          !optionalPeerExistsInLock(lock.packages, node.location, key),
        "missing required, optional-platform or lock-present peer dependency",
      );
      if (!invalidPeer)
        omittedOptionalPeers.push({
          ...record,
          reason: "absent-optional-peer",
        });
      return null;
    }
    metadata(edge.to);
    edges.push({
      ...record,
      to: edge.to.location,
      valid: edge.valid,
      error: edge.error ?? null,
    });
    return edge.to;
  }
  function visit(node, linkChain = new Set()) {
    const meta = metadata(node);
    const at = node.location;
    if (linkChain.has(at)) throw new Error("cyclic package link");
    if (selected.has(at)) return;
    packageName(node.packageName);
    check(
      typeof node.version === "string" &&
        /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.+-]+)*$/u.test(node.version),
      "missing or invalid package version",
    );
    if (meta.name !== undefined)
      check(meta.name === node.packageName, "package name differs from lock");
    if (meta.version !== undefined)
      check(meta.version === node.version, "package version differs from lock");
    const record = {
      location: at,
      name: node.packageName,
      version: node.version,
      resolved: reference(meta.resolved),
      integrity: meta.integrity ?? null,
    };
    check(
      record.integrity === null ||
        (typeof record.integrity === "string" &&
          /^(?:sha(?:1|256|384|512)-[A-Za-z0-9+/=]+)(?: (?:sha(?:1|256|384|512)-[A-Za-z0-9+/=]+))*$/u.test(
            record.integrity,
          )),
      "invalid locked integrity",
    );
    check(
      !record.resolved?.startsWith("https:") || record.integrity,
      "registry artifact lacks locked integrity",
    );
    selected.set(at, record);
    if (node.isLink) {
      check(
        meta.link === true && node.target && node.target !== node,
        "invalid local package link",
      );
      metadata(node.target);
      check(
        posix.normalize(meta.resolved) === node.target.location,
        "link target differs from bound lock",
      );
      record.linkTarget = node.target.location;
      visit(node.target, new Set([...linkChain, at]));
      return;
    }
    check(
      meta.link !== true && node.edgesOut instanceof Map,
      "expected resolved dependency map",
    );
    const expected = declared(meta, node, legacyPeerDeps);
    assert.deepEqual(
      [...node.edgesOut.keys()].sort(),
      [...expected.keys()].sort(),
      "incomplete dependency edge set",
    );
    for (const [key, edge] of node.edgesOut) {
      const to = edgeRecord(node, key, edge);
      if (to) visit(to);
    }
  }
  for (const seed of config.seeds) {
    check(
      seed &&
        ["edge", "location"].includes(seed.kind) &&
        typeof seed.purpose === "string" &&
        seed.purpose.length <= 512 &&
        /^[A-Za-z0-9][A-Za-z0-9 .,:;()+-]*$/u.test(seed.purpose),
      "seed needs a non-private purpose",
    );
    let node;
    let identity;
    if (seed.kind === "edge") {
      const from = location(seed.from);
      packageName(seed.name);
      const parent = inventory.get(from);
      check(parent && parent.edgesOut instanceof Map, "seed parent is missing");
      const edge = parent.edgesOut.get(seed.name);
      check(edge?.to, "seed edge must resolve; it cannot be omitted");
      identity = JSON.stringify(["edge", from, seed.name]);
      node = edgeRecord(parent, seed.name, edge);
      seeds.push({
        kind: "edge",
        from,
        name: seed.name,
        purpose: seed.purpose,
        to: node.location,
      });
    } else {
      const at = location(seed.location);
      check(at !== "", "whole-project roots are not feature scope");
      node = inventory.get(at);
      check(node, "seed location is absent");
      identity = JSON.stringify(["location", at]);
      seeds.push({ kind: "location", location: at, purpose: seed.purpose });
    }
    check(!seenSeeds.has(identity), "duplicate feature seed");
    seenSeeds.add(identity);
    visit(node);
  }
  const ordered = (items) =>
    items.sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b), "en"),
    );
  // A seed edge can also occur through another selected root; emit each edge once.
  const unique = (items) => [
    ...new Map(items.map((item) => [JSON.stringify(item), item])).values(),
  ];
  return {
    schemaVersion: 1,
    status: "draft",
    scopeId: config.scopeId,
    scopeLimit:
      "Explicit reviewed seeds and locked reachable dependencies only; root completeness and advisory acceptance are not established.",
    runtime: { name: runtime.name, version: runtime.version },
    inputs: {
      packageJsonSha256: sha256(packageBytes),
      packageLockSha256: sha256(lockBytes),
      seedsSha256: sha256(seedBytes),
      arboristPackageJsonSha256: sha256(arboristPackageBytes),
    },
    seeds: ordered(seeds),
    packages: ordered([...selected.values()]),
    edges: ordered(unique(edges)),
    omittedOptionalPeers: ordered(unique(omittedOptionalPeers)),
    peerDiagnostics: ordered(unique(peerDiagnostics)),
  };
}

/** Only repository policy is loaded; user/global npm configuration is not read. */
export function readNpmInstallMode(npmrcBytes, environment = {}) {
  check(
    npmrcBytes === null || Buffer.isBuffer(npmrcBytes),
    "explicit npmrc bytes or absence required",
  );
  const settings = new Map();
  const text = npmrcBytes?.toString("utf8") ?? "";
  for (const line of text.split(/\r?\n/u)) {
    const entry = line.trim();
    if (!entry || entry.startsWith("#") || entry.startsWith(";")) continue;
    const match =
      /^(legacy-peer-deps|prefer-offline)\s*=\s*(true|false)$/u.exec(entry);
    check(
      match && !settings.has(match[1]),
      "unsupported or ambiguous repository npm configuration",
    );
    settings.set(match[1], match[2] === "true");
  }
  // Do not let an inherited npm execution context silently override this
  // repository-only policy. No environment values are included in the report.
  const graphOptions = new Set([
    "legacy_peer_deps",
    "strict_peer_deps",
    "force",
    "omit",
    "include",
    "only",
    "production",
    "optional",
    "global",
    "workspace",
    "workspaces",
    "include_workspace_root",
    "install_links",
    "install_strategy",
    "package_lock",
    "package_lock_only",
    "userconfig",
    "globalconfig",
    "prefix",
    "location",
    "before",
  ]);
  for (const name of Object.keys(environment)) {
    const normalized = name.toLowerCase().replaceAll("-", "_");
    if (normalized.startsWith("npm_config_")) {
      check(
        !graphOptions.has(normalized.slice(11)),
        "ambiguous inherited npm graph configuration",
      );
    }
  }
  return {
    source: npmrcBytes === null ? "repository-default" : "repository-npmrc",
    legacyPeerDeps: settings.get("legacy-peer-deps") ?? false,
    preferOffline: settings.get("prefer-offline") ?? false,
    network: "disabled",
    userAndGlobalConfig: "not-loaded",
  };
}

const isLocalOwner = (at) =>
  at !== "" && !at.split("/").includes("node_modules");
function bindLocalManifests(
  primary,
  supplementary,
  tree,
  peerTree,
  lockBytes,
  manifests,
) {
  check(manifests instanceof Map, "expected local manifest byte map");
  const lock = json(lockBytes);
  const owners = new Set();
  for (const graph of [primary, supplementary]) {
    for (const seed of graph.seeds) {
      if (seed.kind === "edge" && isLocalOwner(seed.from))
        owners.add(seed.from);
    }
    for (const item of graph.packages) {
      if (isLocalOwner(item.location)) owners.add(item.location);
      if (item.linkTarget) owners.add(item.linkTarget);
    }
  }
  return [...owners].sort().map((at) => {
    location(at);
    const raw = manifests.get(at);
    check(
      Buffer.isBuffer(raw),
      "selected local manifest unavailable or outside repository",
    );
    const pkg = json(raw);
    const locked = lock.packages[at];
    const node = tree.inventory.get(at) ?? peerTree.inventory.get(at);
    check(
      locked && node && !node.isLink,
      "local manifest owner is not a locked target",
    );
    packageName(pkg.name);
    check(
      pkg.name === node.packageName &&
        pkg.version === node.version &&
        (locked.name === undefined || pkg.name === locked.name) &&
        pkg.version === locked.version,
      "local manifest package identity differs from lock",
    );
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
      "peerDependenciesMeta",
      "acceptDependencies",
      "workspaces",
      "bundledDependencies",
      "bundleDependencies",
    ]) {
      assert.deepEqual(
        pkg[field] ?? null,
        locked[field] ?? null,
        "local manifest dependency declarations differ from lock",
      );
    }
    return { location: at, packageJsonSha256: sha256(raw) };
  });
}

/** Configured installation graph plus a separately labelled peer-inclusive draft. */
export function collectNpmFeatureScope({
  tree,
  peerTree,
  npmrcBytes,
  localManifestBytes = new Map(),
  ...inputs
}) {
  const installMode = readNpmInstallMode(npmrcBytes);
  const primary = collectGraph({
    ...inputs,
    tree,
    legacyPeerDeps: installMode.legacyPeerDeps,
  });
  check(
    !installMode.legacyPeerDeps || peerTree,
    "peer-inclusive virtual graph required",
  );
  const supplementary = collectGraph({
    ...inputs,
    tree: peerTree ?? tree,
    legacyPeerDeps: false,
    allowPeerDiagnostics: installMode.legacyPeerDeps,
  });
  const primaryLocations = new Set(
    primary.packages.map((item) => item.location),
  );
  const supplementaryByLocation = new Map(
    supplementary.packages.map((item) => [item.location, item]),
  );
  for (const item of primary.packages) {
    assert.deepEqual(
      supplementaryByLocation.get(item.location),
      item,
      "configured and supplementary lock identities differ",
    );
  }
  return {
    ...primary,
    installMode,
    inputs: {
      ...primary.inputs,
      npmrcSha256: npmrcBytes === null ? null : sha256(npmrcBytes),
      localPackageManifests: bindLocalManifests(
        primary,
        supplementary,
        tree,
        peerTree ?? tree,
        inputs.lockBytes,
        localManifestBytes,
      ),
    },
    supplementaryPeerGraph: {
      status: "draft",
      purpose:
        "Peer-inclusive locked reachability only; this is not the configured install graph or a compatibility or security pass.",
      legacyPeerDeps: false,
      packages: supplementary.packages,
      edges: supplementary.edges,
      omittedOptionalPeers: supplementary.omittedOptionalPeers,
      peerDiagnostics: supplementary.peerDiagnostics,
      additionalPackageLocations: supplementary.packages
        .map((item) => item.location)
        .filter((at) => !primaryLocations.has(at))
        .sort(),
    },
  };
}

const inside = (base, path) => {
  const rel = relative(base, path);
  return (
    rel === "" ||
    (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep))
  );
};
export function writeNewScopeReport(repositoryRoot, outputPath, report) {
  check(
    isAbsolute(outputPath) && outputPath.endsWith(".json"),
    "output must be an explicit absolute JSON path",
  );
  const repository = realpathSync(repositoryRoot);
  const canonical = resolve(
    realpathSync(dirname(outputPath)),
    outputPath.split(/[\\/]/u).at(-1),
  );
  check(
    !inside(repository, canonical),
    "output must be outside the repository",
  );
  const bytes = Buffer.from(JSON.stringify(report, null, 2) + "\n");
  const fd = openSync(canonical, "wx", 0o600);
  try {
    writeFileSync(fd, bytes);
  } finally {
    closeSync(fd);
  }
  return sha256(bytes);
}

export async function runNpmFeatureScope({
  repositoryRoot,
  project,
  seedFile,
  arboristPath,
  outputPath,
}) {
  const repository = realpathSync(repositoryRoot);
  location(project);
  location(seedFile);
  check(
    project && seedFile,
    "project and seed file must be explicit repository-relative paths",
  );
  const projectPath = realpathSync(resolve(repository, project));
  const seedsPath = realpathSync(resolve(repository, seedFile));
  check(
    inside(repository, projectPath) && inside(repository, seedsPath),
    "input resolves outside the repository",
  );
  const runtimePath = realpathSync(arboristPath);
  const inputs = [
    resolve(projectPath, "package.json"),
    resolve(projectPath, "package-lock.json"),
    seedsPath,
    resolve(runtimePath, "package.json"),
  ];
  for (const input of inputs.slice(0, 2))
    check(
      inside(repository, realpathSync(input)),
      "input link escapes repository",
    );
  const bytes = inputs.map((path) => readFileSync(path));
  // Snapshot local lock candidates before constructing either graph. Only selected
  // owners/targets are validated and reported; this never adds dependency roots.
  const readLocalManifest = (at) => {
    location(at);
    const path = realpathSync(resolve(projectPath, at, "package.json"));
    check(inside(repository, path), "local manifest escapes repository");
    return { path, bytes: readFileSync(path) };
  };
  const localSnapshots = new Map();
  for (const at of Object.keys(json(bytes[1]).packages ?? {}).filter(
    isLocalOwner,
  )) {
    try {
      localSnapshots.set(at, readLocalManifest(at));
    } catch {
      localSnapshots.set(at, null);
    }
  }
  const npmrcPath = resolve(projectPath, ".npmrc");
  const readNpmrc = () => {
    try {
      lstatSync(npmrcPath);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    check(
      inside(repository, realpathSync(npmrcPath)),
      "npmrc link escapes repository",
    );
    return readFileSync(npmrcPath);
  };
  const npmrcBytes = readNpmrc();
  const installMode = readNpmInstallMode(npmrcBytes, process.env);
  const runtime = json(bytes[3]);
  assertReviewedArborist(runtime);
  const require = createRequire(import.meta.url);
  const Arborist = require(runtimePath);
  // Do not replace this with loadActual, buildIdealTree, reify or audit.
  const tree = await new Arborist({
    path: projectPath,
    offline: true,
    audit: false,
    legacyPeerDeps: installMode.legacyPeerDeps,
  }).loadVirtual();
  const peerTree = installMode.legacyPeerDeps
    ? await new Arborist({
        path: projectPath,
        offline: true,
        audit: false,
        legacyPeerDeps: false,
      }).loadVirtual()
    : tree;
  const report = collectNpmFeatureScope({
    tree,
    peerTree,
    npmrcBytes,
    localManifestBytes: new Map(
      [...localSnapshots]
        .filter(([, value]) => value)
        .map(([at, value]) => [at, value.bytes]),
    ),
    packageBytes: bytes[0],
    lockBytes: bytes[1],
    seedBytes: bytes[2],
    arboristPackageBytes: bytes[3],
  });
  inputs.forEach((path, index) =>
    check(
      readFileSync(path).equals(bytes[index]),
      "inventory input changed during collection",
    ),
  );
  const afterNpmrc = readNpmrc();
  check(
    npmrcBytes === null ? afterNpmrc === null : afterNpmrc?.equals(npmrcBytes),
    "npmrc input changed during collection",
  );
  assert.deepEqual(
    readNpmInstallMode(afterNpmrc, process.env),
    installMode,
    "effective install mode changed during collection",
  );
  for (const { location: at } of report.inputs.localPackageManifests) {
    const before = localSnapshots.get(at);
    const after = readLocalManifest(at);
    check(
      before && before.path === after.path && before.bytes.equals(after.bytes),
      "selected local manifest changed during collection",
    );
  }
  const reportSha256 = writeNewScopeReport(repository, outputPath, report);
  return {
    status: report.status,
    packages: report.packages.length,
    omittedOptionalPeers: report.omittedOptionalPeers.length,
    supplementaryPackages: report.supplementaryPeerGraph.packages.length,
    peerDiagnostics: report.supplementaryPeerGraph.peerDiagnostics.length,
    reportSha256,
  };
}
export function parseScopeArgs(args) {
  const options = {};
  const names = {
    "--repository-root": "repositoryRoot",
    "--project": "project",
    "--seeds": "seedFile",
    "--arborist-path": "arboristPath",
    "--output": "outputPath",
  };
  check(args.length === 10, "expected exactly five explicit scope options");
  for (let i = 0; i < args.length; i += 2) {
    check(Object.hasOwn(names, args[i]), "unknown scope option");
    const key = names[args[i]];
    check(
      key &&
        !Object.hasOwn(options, key) &&
        args[i + 1] &&
        !args[i + 1].startsWith("--"),
      "unknown, duplicate or missing scope option",
    );
    options[key] = args[i + 1];
  }
  return options;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(
      JSON.stringify(
        await runNpmFeatureScope(parseScopeArgs(process.argv.slice(2))),
      ),
    );
  } catch {
    // Runtime errors may contain private local paths or configured registry data.
    console.error(
      "Offline npm feature inventory failed; no inventory is accepted. Check inputs, graph completeness and create-new output.",
    );
    process.exitCode = 1;
  }
}
