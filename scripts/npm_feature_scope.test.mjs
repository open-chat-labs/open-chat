import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { existsSync, renameSync, symlinkSync } from "node:fs";

test("explicit local seed owners are bound without collecting unrelated owner dependencies", () => {
  const f = fixture();
  const owner = f.node("local-owner", "local-owner");
  f.edge(owner, "model", f.model);
  f.edge(owner, "unrelated-core", f.node("node_modules/unrelated-core"));
  f.config.seeds = [
    {
      kind: "edge",
      from: "local-owner",
      name: "model",
      purpose: "Feature import",
    },
  ];
  const inputs = f.inputs();
  const report = collectNpmFeatureScope(inputs);
  assert.deepEqual(
    report.packages.map((p) => p.name),
    ["model"],
  );
  assert.deepEqual(report.inputs.localPackageManifests, [
    {
      location: "local-owner",
      packageJsonSha256: hash(inputs.localManifestBytes.get("local-owner")),
    },
  ]);
  const changed = new Map(inputs.localManifestBytes);
  changed.set(
    "local-owner",
    bytes({ ...f.lock.packages["local-owner"], dependencies: { model: "*" } }),
  );
  assert.throws(
    () => collectNpmFeatureScope({ ...inputs, localManifestBytes: changed }),
    /declarations differ/u,
  );
  changed.set(
    "local-owner",
    bytes({ ...f.lock.packages["local-owner"], name: "different" }),
  );
  assert.throws(
    () => collectNpmFeatureScope({ ...inputs, localManifestBytes: changed }),
    /identity differs/u,
  );
  assert.throws(
    () => collectNpmFeatureScope({ ...inputs, localManifestBytes: new Map() }),
    /manifest unavailable/u,
  );
});
test("local link targets require their own declared manifest binding", () => {
  const f = fixture();
  const target = f.node("local-model", "model");
  Object.assign(f.model, { isLink: true, target });
  f.lock.packages[f.model.location] = { link: true, resolved: target.location };
  const inputs = f.inputs();
  const report = collectNpmFeatureScope(inputs);
  assert.equal(report.inputs.localPackageManifests[0].location, "local-model");
  const changed = new Map(inputs.localManifestBytes);
  changed.set(
    "local-model",
    bytes({
      ...f.lock.packages["local-model"],
      optionalDependencies: { hidden: "*" },
    }),
  );
  assert.throws(
    () => collectNpmFeatureScope({ ...inputs, localManifestBytes: changed }),
    /declarations differ/u,
  );
  assert.throws(
    () => collectNpmFeatureScope({ ...inputs, localManifestBytes: new Map() }),
    /manifest unavailable/u,
  );
});

function peerFixture() {
  const primary = fixture({ legacyPeerDeps: true });
  const supplementary = fixture();
  return {
    primary,
    supplementary,
    collect: () =>
      collectNpmFeatureScope({
        ...primary.inputs(),
        peerTree: supplementary.root,
      }),
  };
}
test("configured legacy mode is primary while locked peer reachability remains supplementary", () => {
  const f = peerFixture();
  for (const graph of [f.primary, f.supplementary]) {
    const peer = graph.node("node_modules/peer");
    graph.edge(graph.model, "peer", peer, "peerOptional");
    graph.edge(
      peer,
      "peer-platform",
      graph.node("node_modules/peer-platform"),
      "optional",
    );
  }
  const report = f.collect();
  assert.equal(report.installMode.legacyPeerDeps, true);
  assert.equal(report.inputs.npmrcSha256, hash(f.primary.inputs().npmrcBytes));
  assert.deepEqual(
    report.packages.map((p) => p.name),
    ["model"],
  );
  assert.equal(report.supplementaryPeerGraph.packages.length, 3);
  assert.deepEqual(report.supplementaryPeerGraph.additionalPackageLocations, [
    "node_modules/peer",
    "node_modules/peer-platform",
  ]);
  assert.equal(report.supplementaryPeerGraph.status, "draft");
  assert.match(
    report.supplementaryPeerGraph.purpose,
    /not.*compatibility or security pass/u,
  );
});
test("legacy supplementary missing and incompatible peers are diagnostics, not compatibility passes", () => {
  const f = peerFixture();
  for (const graph of [f.primary, f.supplementary]) {
    Object.assign(
      graph.edge(
        graph.model,
        "yaml",
        graph.node("node_modules/yaml", "yaml", "1.10.3"),
        "peerOptional",
        "^2.4.2",
      ),
      { error: "INVALID", valid: false },
    );
    Object.assign(graph.edge(graph.model, "absent-peer", null, "peer"), {
      error: "MISSING",
      valid: false,
    });
  }
  const report = f.collect();
  assert.equal(report.peerDiagnostics.length, 0);
  const diagnostics = report.supplementaryPeerGraph.peerDiagnostics;
  assert.deepEqual(diagnostics.map((d) => d.status).sort(), [
    "invalid-peer",
    "missing-peer",
  ]);
  assert.equal(
    diagnostics.find((d) => d.name === "yaml").to,
    "node_modules/yaml",
  );
  assert.equal(report.supplementaryPeerGraph.packages.length, 2);
  assert.equal(
    report.supplementaryPeerGraph.edges.find((e) => e.name === "yaml").valid,
    false,
  );
});
test("false or default install mode remains strict and has no hidden graph differences", () => {
  for (const npmrcBytes of [
    null,
    Buffer.from(""),
    Buffer.from("legacy-peer-deps=false\n"),
  ]) {
    const f = fixture();
    const report = collectNpmFeatureScope({ ...f.inputs(), npmrcBytes });
    assert.equal(report.installMode.legacyPeerDeps, false);
    assert.deepEqual(report.supplementaryPeerGraph.packages, report.packages);
    Object.assign(
      f.edge(
        f.model,
        "yaml",
        f.node("node_modules/yaml", "yaml", "1.10.3"),
        "peerOptional",
        "^2.4.2",
      ),
      { error: "INVALID", valid: false },
    );
    assert.throws(
      () => collectNpmFeatureScope({ ...f.inputs(), npmrcBytes }),
      /invalid resolved/u,
    );
  }
});
test("legacy mode preserves missing or invalid non-peer failures in both graphs", () => {
  for (const side of ["primary", "supplementary"]) {
    for (const type of ["prod", "optional"]) {
      const f = peerFixture();
      for (const graph of [f.primary, f.supplementary]) {
        graph.edge(
          graph.model,
          "required",
          graph.node("node_modules/required"),
          type,
        );
      }
      const edge = f[side].model.edgesOut.get("required");
      Object.assign(edge, { error: "INVALID", valid: false });
      assert.throws(f.collect, /invalid resolved/u);
      Object.assign(edge, { error: "MISSING", to: null });
      assert.throws(f.collect, /invalid resolved/u);
    }
  }
  const f = peerFixture();
  for (const graph of [f.primary, f.supplementary]) {
    const peer = graph.node("node_modules/peer");
    Object.assign(graph.edge(graph.model, "peer", peer, "peerOptional"), {
      error: "INVALID",
      valid: false,
    });
    Object.assign(graph.edge(peer, "required", null), {
      error: "MISSING",
      valid: false,
    });
  }
  assert.throws(f.collect, /invalid resolved/u);
});
test("supplementary peer diagnostics never excuse lock identity or resolution gaps", () => {
  const f = peerFixture();
  for (const graph of [f.primary, f.supplementary]) {
    Object.assign(
      graph.edge(
        graph.model,
        "yaml",
        graph.node("node_modules/yaml"),
        "peerOptional",
      ),
      { error: "INVALID", valid: false },
    );
  }
  f.supplementary.root.inventory.get("node_modules/yaml").version = "2.0.0";
  assert.throws(f.collect, /version differs/u);
  f.supplementary.root.inventory.get("node_modules/yaml").version = "1.0.0";
  Object.assign(f.supplementary.model.edgesOut.get("yaml"), {
    to: null,
    error: "MISSING",
  });
  assert.throws(f.collect, /lock-present peer/u);
  Object.assign(f.supplementary.model.edgesOut.get("yaml"), {
    error: "PEER LOCAL",
  });
  assert.throws(f.collect, /invalid resolved/u);
});
test("unsupported, duplicate and inherited graph configuration is rejected", () => {
  const supported = Buffer.from(
    "# policy\nprefer-offline=true\nlegacy-peer-deps=true\n",
  );
  assert.equal(readNpmInstallMode(supported).legacyPeerDeps, true);
  for (const text of [
    "legacy-peer-deps=yes",
    "legacy-peer-deps=true\nlegacy-peer-deps=false",
    "strict-peer-deps=false",
    "registry=https://private.example",
    "[section]",
    "legacy-peer-deps=$" + "{MODE}",
  ]) {
    assert.throws(
      () => readNpmInstallMode(Buffer.from(text)),
      /unsupported or ambiguous/u,
    );
  }
  for (const name of [
    "NPM_CONFIG_LEGACY_PEER_DEPS",
    "npm_config_omit",
    "npm_config_legacy-peer-deps",
    "NPM_CONFIG_USERCONFIG",
  ]) {
    assert.throws(
      () => readNpmInstallMode(supported, { [name]: "not-reported" }),
      /ambiguous inherited/u,
    );
  }
  const f = fixture();
  assert.throws(
    () => collectNpmFeatureScope({ ...f.inputs(), npmrcBytes: supported }),
    /unsupported virtual dependency mode/u,
  );
});
import {
  collectNpmFeatureScope,
  parseScopeArgs,
  readNpmInstallMode,
  runNpmFeatureScope,
  writeNewScopeReport,
} from "./npm_feature_scope.mjs";

const bytes = (value) => Buffer.from(JSON.stringify(value));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const runtime = { name: "@npmcli/arborist", version: "9.4.0" };
function fixture({ legacyPeerDeps = false } = {}) {
  const pkg = { name: "fixture", version: "1.0.0" };
  const lock = { lockfileVersion: 3, packages: { "": pkg } };
  const root = {
    location: "",
    packageName: pkg.name,
    version: pkg.version,
    isTop: true,
    legacyPeerDeps,
    path: "/private/not-reported",
    edgesOut: new Map(),
    inventory: new Map(),
  };
  root.inventory.set("", root);
  const config = {
    schemaVersion: 1,
    status: "draft",
    scopeId: "test-model",
    seeds: [
      { kind: "edge", from: "", name: "model", purpose: "Model runtime" },
    ],
  };
  function node(
    at,
    name = at.split("node_modules/").at(-1),
    version = "1.0.0",
  ) {
    const value = {
      location: at,
      packageName: name,
      version,
      legacyPeerDeps,
      edgesOut: new Map(),
      path: "/private/not-reported/" + at,
      isTop: !at.includes("node_modules/"),
    };
    root.inventory.set(at, value);
    lock.packages[at] = {
      name,
      version,
      resolved:
        "https://registry.npmjs.org/" +
        name +
        "/-/" +
        name.replace("/", "-") +
        ".tgz",
      integrity: "sha512-YWJjZA==",
    };
    return value;
  }
  function edge(
    from,
    name,
    to,
    type = "prod",
    requested = "^1.0.0",
    effective = requested,
  ) {
    const meta = lock.packages[from.location];
    const field = {
      prod: "dependencies",
      dev: "devDependencies",
      optional: "optionalDependencies",
      peer: "peerDependencies",
      peerOptional: "peerDependencies",
    }[type];
    (meta[field] ??= {})[name] = requested;
    if (type === "peerOptional")
      (meta.peerDependenciesMeta ??= {})[name] = { optional: true };
    const result = {
      from,
      name,
      to,
      type,
      rawSpec: requested,
      spec: effective,
      valid: true,
      error: null,
    };
    if (!legacyPeerDeps || !type.startsWith("peer"))
      from.edgesOut.set(name, result);
    return result;
  }
  const model = node("node_modules/model");
  edge(root, "model", model);
  const inputs = () => ({
    tree: root,
    packageBytes: bytes(pkg),
    lockBytes: bytes(lock),
    seedBytes: bytes(config),
    arboristPackageBytes: bytes(runtime),
    npmrcBytes: Buffer.from(legacyPeerDeps ? "legacy-peer-deps=true\n" : ""),
    localManifestBytes: new Map(
      Object.entries(lock.packages)
        .filter(([at]) => at && !at.split("/").includes("node_modules"))
        .map(([at, pkg]) => [at, bytes(pkg)]),
    ),
  });
  return {
    pkg,
    lock,
    root,
    config,
    node,
    edge,
    model,
    inputs,
    collect: () => collectNpmFeatureScope(inputs()),
  };
}

test("explicit roots include transitives, not unrelated core, and bind raw inputs", () => {
  const f = fixture();
  const transitive = f.node("node_modules/transitive");
  f.edge(f.model, "transitive", transitive);
  f.edge(f.root, "unrelated-core", f.node("node_modules/unrelated-core"));
  const report = f.collect();
  assert.equal(report.status, "draft");
  assert.match(report.scopeLimit, /completeness.*not established/u);
  assert.deepEqual(report.packages.map((p) => p.name).sort(), [
    "model",
    "transitive",
  ]);
  assert.equal(report.inputs.packageJsonSha256, hash(f.inputs().packageBytes));
  assert.equal(report.inputs.packageLockSha256, hash(f.inputs().lockBytes));
  assert.equal(report.inputs.npmrcSha256, hash(f.inputs().npmrcBytes));
  assert.equal(report.inputs.seedsSha256, hash(f.inputs().seedBytes));
  assert.equal(report.inputs.arboristPackageJsonSha256, hash(bytes(runtime)));
  assert.equal(JSON.stringify(report).includes("/private"), false);
  assert.deepEqual(f.collect(), report);
  f.lock.packages["node_modules/unrelated-core"].license = "MIT";
  assert.notEqual(
    f.collect().inputs.packageLockSha256,
    report.inputs.packageLockSha256,
  );
});

test("resolved override edges retain requested and effective ranges and lock identity", () => {
  const f = fixture();
  const dep = f.node("node_modules/sharp", "sharp", "0.35.3");
  f.edge(f.model, "sharp", dep, "prod", "^0.34.5", "0.35.3");
  const report = f.collect();
  const edge = report.edges.find((entry) => entry.name === "sharp");
  assert.equal(edge.requested, "^0.34.5");
  assert.equal(edge.effective, "0.35.3");
  assert.deepEqual(
    report.packages.find((entry) => entry.name === "sharp"),
    {
      location: dep.location,
      name: "sharp",
      version: "0.35.3",
      resolved: f.lock.packages[dep.location].resolved,
      integrity: "sha512-YWJjZA==",
    },
  );
});

test("duplicate package names and versions at different lock locations are retained", () => {
  const f = fixture();
  const shared = f.node("node_modules/shared", "shared");
  const nested = f.node("node_modules/model/node_modules/shared", "shared");
  f.edge(f.model, "shared", nested);
  f.config.seeds.push({
    kind: "location",
    location: shared.location,
    purpose: "Separate imported build dependency",
  });
  assert.equal(
    f.collect().packages.filter((p) => p.name === "shared").length,
    2,
  );
  f.config.seeds.push({ ...f.config.seeds[1] });
  assert.throws(f.collect, /duplicate feature seed/u);
});

test("all locked optional platform packages are retained without host filtering", () => {
  const f = fixture();
  for (const platform of ["linux-arm64", "win32-x64"]) {
    const target = f.node("node_modules/" + platform);
    f.lock.packages[target.location].os = [platform.split("-")[0]];
    f.edge(f.model, platform, target, "optional");
  }
  assert.equal(f.collect().packages.length, 3);
});

test("only genuinely absent optional peers may be omitted", () => {
  const f = fixture();
  f.edge(f.model, "optional-peer", null, "peerOptional");
  const report = f.collect();
  assert.equal(report.omittedOptionalPeers.length, 1);
  assert.equal(report.omittedOptionalPeers[0].reason, "absent-optional-peer");
  f.node("node_modules/optional-peer");
  assert.throws(f.collect, /lock-present peer/u);
});

test("required, optional-platform, regular peer and invalid edges fail closed", () => {
  for (const type of ["prod", "optional", "peer"]) {
    const f = fixture();
    f.edge(f.model, "missing", null, type);
    assert.throws(f.collect, /missing required/u);
  }
  for (const invalid of [{ valid: false }, { error: "INVALID" }]) {
    const f = fixture();
    Object.assign(f.root.edgesOut.get("model"), invalid);
    assert.throws(f.collect, /invalid resolved/u);
  }
});

test("local links include their target and target development dependencies", () => {
  const f = fixture();
  const target = f.node("local-model", "model");
  const compiler = f.node("node_modules/compiler");
  f.edge(target, "compiler", compiler, "dev");
  Object.assign(f.model, { isLink: true, target });
  f.lock.packages[f.model.location] = { link: true, resolved: target.location };
  assert.deepEqual(
    f
      .collect()
      .packages.map((p) => p.location)
      .sort(),
    ["local-model", "node_modules/compiler", "node_modules/model"],
  );
});

test("link cycles and mismatched targets fail; dependency cycles terminate", () => {
  const f = fixture();
  const second = f.node("second", "model");
  Object.assign(f.model, { isLink: true, target: second });
  Object.assign(second, { isLink: true, target: f.model });
  f.lock.packages[f.model.location] = { link: true, resolved: second.location };
  f.lock.packages[second.location] = { link: true, resolved: f.model.location };
  assert.throws(f.collect, /cyclic package link/u);
  f.lock.packages[f.model.location].resolved = "other";
  assert.throws(f.collect, /link target differs/u);
  const cycle = fixture();
  const dependency = cycle.node("node_modules/dependency");
  cycle.edge(cycle.model, "dependency", dependency);
  cycle.edge(dependency, "model", cycle.model);
  assert.equal(cycle.collect().packages.length, 2);
});

test("external development dependencies are not invented and Arborist edge precedence is enforced", () => {
  const f = fixture();
  f.lock.packages[f.model.location].devDependencies = { unrelated: "*" };
  const optional = f.node("node_modules/optional");
  f.edge(f.model, "optional", optional, "optional", "^1");
  f.lock.packages[f.model.location].dependencies = { optional: "^0" };
  const runtimeNode = f.node("node_modules/devroot");
  f.edge(f.root, "devroot", runtimeNode, "dev", "^1");
  f.pkg.dependencies.devroot = "^0";
  f.config.seeds.push({
    kind: "edge",
    from: "",
    name: "devroot",
    purpose: "Build tooling",
  });
  assert.equal(f.collect().packages.length, 3);
  f.model.edgesOut.get("optional").type = "prod";
  assert.throws(f.collect, /bound declaration/u);
});

test("missing, mismatched and extra graph edges cannot silently shrink or expand the inventory", () => {
  const f = fixture();
  const dep = f.node("node_modules/dep");
  f.edge(f.model, "dep", dep);
  f.model.edgesOut.delete("dep");
  assert.throws(f.collect, /incomplete dependency edge set/u);
  f.edge(f.model, "dep", dep).rawSpec = "*";
  assert.throws(f.collect, /bound declaration/u);
  f.edge(f.model, "dep", dep);
  f.lock.packages[dep.location].version = "2.0.0";
  assert.throws(f.collect, /version differs/u);
  f.lock.packages[dep.location].version = "1.0.0";
  f.root.inventory.set("wrong", dep);
  assert.throws(f.collect, /mismatched inventory/u);
});

test("whole-project, private and unsupported seeds or runtime identities are rejected", () => {
  for (const mutate of [
    (f) => {
      f.config.scopeId = undefined;
    },
    (f) => {
      f.config.seeds[0].purpose = "/private/path";
    },
    (f) => {
      f.config.seeds = [
        { kind: "location", location: "", purpose: "Everything" },
      ];
    },
    (f) => {
      f.config.seeds[0].name = "../private";
    },
    (f) => {
      f.model.version = "C:/private";
    },
    (f) => {
      f.model.legacyPeerDeps = true;
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(f.collect);
  }
  const f = fixture();
  assert.throws(
    () =>
      collectNpmFeatureScope({
        ...f.inputs(),
        arboristPackageBytes: bytes({ ...runtime, version: "10.0.0" }),
      }),
    /9.4.0/u,
  );
  assert.throws(
    () =>
      collectNpmFeatureScope({
        ...f.inputs(),
        packageBytes: bytes({ ...f.pkg, dependencies: {} }),
      }),
    /manifest\/lock/u,
  );
});

test("private or unauthenticated artifact references and malformed integrity fail", () => {
  for (const resolved of [
    "C:/private",
    "/private",
    "file:../../private",
    "https://user:password@example.test/package",
    "https://example.test/package?token=secret",
    "http://example.test/package",
    "ssh://example.test/package",
  ]) {
    const f = fixture();
    f.lock.packages[f.model.location].resolved = resolved;
    assert.throws(f.collect);
  }
  for (const integrity of [null, "not-sri"]) {
    const f = fixture();
    f.lock.packages[f.model.location].integrity = integrity;
    assert.throws(f.collect);
  }
});

test("CLI requires all five explicit options with no duplicate or unknown switches", () => {
  const args = [
    "--repository-root",
    "/repo",
    "--project",
    "frontend",
    "--seeds",
    "seeds.json",
    "--arborist-path",
    "/runtime",
    "--output",
    "/outside/report.json",
  ];
  assert.deepEqual(parseScopeArgs(args), {
    repositoryRoot: "/repo",
    project: "frontend",
    seedFile: "seeds.json",
    arboristPath: "/runtime",
    outputPath: "/outside/report.json",
  });
  assert.throws(() => parseScopeArgs(args.slice(2)));
  assert.throws(() => parseScopeArgs(["--audit", "true", ...args.slice(2)]));
  for (const hostile of ["constructor", "toString", "__proto__"]) {
    assert.throws(
      () => parseScopeArgs([hostile, "true", ...args.slice(2)]),
      /unknown scope option/u,
    );
  }
  assert.throws(() => parseScopeArgs(["--project", "other", ...args.slice(2)]));
});

test("report creation is outside the repo and never overwrites an existing file", () => {
  const dir = mkdtempSync(join(tmpdir(), "npm-feature-scope-output-"));
  const repo = join(dir, "repo");
  mkdirSync(repo);
  const output = join(dir, "report.json");
  const report = fixture().collect();
  assert.throws(
    () => writeNewScopeReport(repo, join(repo, "report.json"), report),
    /outside/u,
  );
  assert.throws(
    () => writeNewScopeReport(repo, "relative.json", report),
    /absolute/u,
  );
  assert.equal(
    writeNewScopeReport(repo, output, report),
    hash(readFileSync(output)),
  );
  const before = readFileSync(output);
  assert.throws(
    () => writeNewScopeReport(repo, output, { changed: true }),
    /EEXIST/u,
  );
  assert.deepEqual(readFileSync(output), before);
});

test("runner calls only offline loadVirtual, binds inputs and rejects mid-run source changes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "npm-feature-scope-runtime-"));
  const repo = join(dir, "repo");
  const project = join(repo, "frontend");
  const runtimePath = join(dir, "runtime");
  mkdirSync(project, { recursive: true });
  mkdirSync(runtimePath);
  const f = fixture();
  writeFileSync(join(project, "package.json"), bytes(f.pkg));
  writeFileSync(join(project, "package-lock.json"), bytes(f.lock));
  writeFileSync(join(repo, "seeds.json"), bytes(f.config));
  writeFileSync(
    join(runtimePath, "package.json"),
    bytes({ ...runtime, main: "index.cjs" }),
  );
  writeFileSync(
    join(runtimePath, "index.cjs"),
    String.raw`
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
module.exports = class FakeArborist {
  static calls = [];
  constructor(options) {
    assert.equal(options.offline, true);
    assert.equal(options.audit, false);
    this.path = options.path;
    this.legacyPeerDeps = options.legacyPeerDeps;
    FakeArborist.calls.push("constructor");
  }
  async loadVirtual() {
    FakeArborist.calls.push("loadVirtual");
    const root = { location: "", isTop: true, path: this.path, inventory: new Map(), edgesOut: new Map() };
    const model = { location: "node_modules/model", packageName: "model", version: "1.0.0", edgesOut: new Map() };
    root.legacyPeerDeps = model.legacyPeerDeps = this.legacyPeerDeps;
    root.inventory.set("", root);
    root.inventory.set(model.location, model);
    root.edgesOut.set("model", { from: root, name: "model", to: model, type: "prod", rawSpec: "^1.0.0", spec: "^1.0.0", valid: true });
    if (FakeArborist.localOwner) {
      const owner = { location: "local-owner", packageName: "local-owner", version: "1.0.0",
        isTop: true, path: path.join(this.path, "local-owner"),
        legacyPeerDeps: this.legacyPeerDeps, edgesOut: new Map() };
      owner.edgesOut.set("model", { ...root.edgesOut.get("model"), from: owner });
      root.inventory.set(owner.location, owner);
      if (FakeArborist.mutateLocal) fs.appendFileSync(path.join(owner.path, "package.json"), "\n");
    }
    if (FakeArborist.mutate) fs.appendFileSync(path.join(this.path, "package-lock.json"), "\n");
    if (FakeArborist.mutateNpmrc) fs.writeFileSync(path.join(this.path, ".npmrc"), "legacy-peer-deps=false\n");
    return root;
  }
  audit() { throw new Error("forbidden"); }
  reify() { throw new Error("forbidden"); }
  loadActual() { throw new Error("forbidden"); }
};
`,
  );
  const options = {
    repositoryRoot: repo,
    project: "frontend",
    seedFile: "seeds.json",
    arboristPath: runtimePath,
    outputPath: join(dir, "report.json"),
  };
  assert.equal((await runNpmFeatureScope(options)).packages, 1);
  const FakeArborist = createRequire(import.meta.url)(runtimePath);
  assert.deepEqual(FakeArborist.calls, ["constructor", "loadVirtual"]);
  writeFileSync(join(project, ".npmrc"), "legacy-peer-deps=true\n");
  FakeArborist.calls.length = 0;
  const legacy = await runNpmFeatureScope({
    ...options,
    outputPath: join(dir, "legacy.json"),
  });
  assert.equal(legacy.packages, 1);
  assert.equal(legacy.supplementaryPackages, 1);
  assert.deepEqual(FakeArborist.calls, [
    "constructor",
    "loadVirtual",
    "constructor",
    "loadVirtual",
  ]);
  FakeArborist.mutateNpmrc = true;
  await assert.rejects(
    runNpmFeatureScope({
      ...options,
      outputPath: join(dir, "changed-config.json"),
    }),
    /npmrc input changed/u,
  );
  FakeArborist.mutateNpmrc = false;
  FakeArborist.mutate = true;
  await assert.rejects(
    runNpmFeatureScope({ ...options, outputPath: join(dir, "changed.json") }),
    /input changed/u,
  );
  FakeArborist.mutate = false;
  FakeArborist.localOwner = true;
  const ownerPackage = {
    name: "local-owner",
    version: "1.0.0",
    dependencies: { model: "^1.0.0" },
  };
  f.lock.packages["local-owner"] = ownerPackage;
  writeFileSync(join(project, "package-lock.json"), bytes(f.lock));
  writeFileSync(
    join(repo, "seeds.json"),
    bytes({
      ...f.config,
      seeds: [
        {
          kind: "edge",
          from: "local-owner",
          name: "model",
          purpose: "Feature import",
        },
      ],
    }),
  );
  const localOutput = join(dir, "local-owner.json");
  await assert.rejects(
    runNpmFeatureScope({ ...options, outputPath: localOutput }),
    /manifest unavailable/u,
  );
  assert.equal(existsSync(localOutput), false);
  const ownerPath = join(project, "local-owner");
  mkdirSync(ownerPath);
  writeFileSync(join(ownerPath, "package.json"), bytes(ownerPackage));
  await runNpmFeatureScope({ ...options, outputPath: localOutput });
  assert.deepEqual(
    JSON.parse(readFileSync(localOutput)).inputs.localPackageManifests,
    [{ location: "local-owner", packageJsonSha256: hash(bytes(ownerPackage)) }],
  );
  FakeArborist.mutateLocal = true;
  const mutatedOutput = join(dir, "local-mutated.json");
  await assert.rejects(
    runNpmFeatureScope({ ...options, outputPath: mutatedOutput }),
    /local manifest changed/u,
  );
  assert.equal(existsSync(mutatedOutput), false);
  FakeArborist.mutateLocal = false;
  renameSync(ownerPath, join(project, "local-owner-original"));
  const outside = join(dir, "outside-owner");
  mkdirSync(outside);
  writeFileSync(join(outside, "package.json"), bytes(ownerPackage));
  symlinkSync(outside, ownerPath, "junction");
  const escapedOutput = join(dir, "local-escaped.json");
  await assert.rejects(
    runNpmFeatureScope({ ...options, outputPath: escapedOutput }),
    /manifest unavailable/u,
  );
  assert.equal(existsSync(escapedOutput), false);
});
