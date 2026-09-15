// Scoped offline Cargo metadata producer with optional versioned source-review binding.
// No source review, dependency installation, advisory transport or release approval.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  realpathSync,
  readFileSync,
  writeFileSync,
  mkdtempSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareRustFeatureInventory,
  verifyRustFeatureScopeReview,
} from "./rust_feature_seed_review.mjs";
import { collectRustFeatureScope } from "./rust_feature_scope.mjs";
import { exportRustFeatureSbom } from "./rust_feature_sbom.mjs";
import { validateRustFeatureSbom } from "./rust_feature_sbom_validate.mjs";

export const RUST_COLLECTION_LIMITS = Object.freeze({
  profiles: 8,
  sourceFiles: 4096,
  fileBytes: 32 * 1024 * 1024,
  inputBytes: 128 * 1024 * 1024,
  metadataBytes: 32 * 1024 * 1024,
  metadataTotalBytes: 128 * 1024 * 1024,
  profileTimeoutMs: 30_000,
});
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const decode = (bytes) =>
  new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
const within = (root, path) => {
  const rel = relative(root, path);
  return (
    rel === "" ||
    (!isAbsolute(rel) &&
      rel !== ".." &&
      !rel.startsWith("../") &&
      !rel.startsWith("..\\"))
  );
};
function ordinary(path, directory = false) {
  assert(isAbsolute(path), "Absolute path required");
  let part = parse(path).root;
  for (const name of relative(part, path).split(/[\\/]/u).filter(Boolean)) {
    part = join(part, name);
    assert(!lstatSync(part).isSymbolicLink(), "Linked paths are unsupported");
  }
  const stat = lstatSync(path);
  assert(
    directory ? stat.isDirectory() : stat.isFile(),
    "Expected ordinary file/directory",
  );
  return stat;
}
function relativeSource(path) {
  assert.equal(typeof path, "string");
  assert(
    !/[\\:\0\r\n]/u.test(path) &&
      !path.startsWith("/") &&
      path.split("/").every((part) => part && part !== "." && part !== ".."),
    "Source path must remain inside checkout",
  );
}
function exactArgs(args) {
  assert.deepEqual(Object.keys(args).sort(), [
    "cargoExecutable",
    "configSha256",
    "mode",
    "outputDirectory",
    "repositoryRoot",
    "scope",
  ]);
  assert(
    ["pr1", "pr2"].includes(args.scope),
    "Explicit feature scope required",
  );
  assert.equal(
    args.mode,
    "collect-offline",
    "Only offline metadata collection is supported",
  );
  assert.match(args.configSha256, /^[a-f0-9]{64}$/u);
  for (const name of ["repositoryRoot", "outputDirectory", "cargoExecutable"])
    assert(isAbsolute(args[name]), "Absolute explicit path required");
}

/** Arguments are intentionally the same for real collection and offline fixtures.
 * No profile subset, arbitrary Cargo argument, missing-source override or query mode.
 */
export function prepareRustFeatureCollection(args) {
  exactArgs(args);
  ordinary(args.repositoryRoot, true);
  ordinary(args.outputDirectory, true);
  const root = realpathSync(args.repositoryRoot);
  const output = realpathSync(args.outputDirectory);
  assert(
    !within(root, output),
    "Evidence must be outside the selected checkout",
  );
  const bindings = new Map();
  let inputBytes = 0;
  const capture = (path, expected) => {
    path = resolve(path);
    const stat = ordinary(path);
    assert(
      stat.size <= RUST_COLLECTION_LIMITS.fileBytes,
      "Input exceeds byte limit",
    );
    const bytes = readFileSync(path);
    inputBytes += bytes.length;
    assert(
      bytes.length <= RUST_COLLECTION_LIMITS.fileBytes &&
        inputBytes <= RUST_COLLECTION_LIMITS.inputBytes,
      "Input byte limit",
    );
    const sha256 = hash(bytes);
    if (expected !== undefined)
      assert.equal(sha256, expected, "Input hash mismatch");
    bindings.set(path, { path, bytes: bytes.length, sha256 });
    return bytes;
  };
  const configFile = join(
    root,
    "scripts/rust_feature_scope." + args.scope + ".json",
  );
  const configBytes = capture(configFile, args.configSha256);
  const config = JSON.parse(decode(configBytes));
  const cargoLock = capture(join(root, "Cargo.lock"));
  const paths = Object.keys(config.sourceFiles ?? {});
  assert(
    paths.length > 0 && paths.length <= RUST_COLLECTION_LIMITS.sourceFiles,
    "Bounded source set required",
  );
  const sourceBytes = Object.fromEntries(
    paths.map((path) => {
      relativeSource(path);
      return [path, capture(join(root, path))];
    }),
  );
  assert(
    Array.isArray(config.profiles) &&
      config.profiles.length > 0 &&
      config.profiles.length <= RUST_COLLECTION_LIMITS.profiles,
    "Bounded configured profiles required",
  );
  // This unchanged adapter checks every source/lock/review/seed, including seeds
  // not selected by an individual profile. Incomplete remains incomplete.
  const inventories = config.profiles.map((profile) =>
    prepareRustFeatureInventory({
      config,
      profileId: profile.id,
      sourceBytes,
      cargoLock,
    }),
  );
  // A fixed, versioned receipt can close the reviewed base inventory. An absent
  // receipt preserves the incomplete result; no CLI override can grant review.
  const reviewFile = join(
    root,
    "scripts/rust_feature_review." + args.scope + ".json",
  );
  let sourceReview = null;
  if (existsSync(reviewFile)) {
    const reviewBytes = capture(reviewFile);
    sourceReview = {
      ...verifyRustFeatureScopeReview({
        config,
        configBytes,
        review: JSON.parse(decode(reviewBytes)),
        sourceBytes,
        cargoLock,
      }),
      receipt: bindings.get(resolve(reviewFile)),
    };
  }
  const cargoExecutable = realpathSync(args.cargoExecutable);
  assert(
    /^(?:cargo|cargo\.exe)$/u.test(basename(cargoExecutable)),
    "Installed Cargo executable required",
  );
  capture(args.cargoExecutable);
  const suffix = basename(cargoExecutable).endsWith(".exe") ? ".exe" : "";
  const rustcExecutable = join(dirname(cargoExecutable), "rustc" + suffix);
  capture(rustcExecutable);
  // Require direct toolchain binaries, not rustup's identically-backed launcher
  // proxies, so a missing toolchain cannot cause implicit installation.
  assert.notEqual(
    bindings.get(resolve(args.cargoExecutable)).sha256,
    bindings.get(rustcExecutable).sha256,
    "Use direct installed toolchain binaries, not rustup proxies",
  );
  for (const file of [
    "rust_feature_collection.mjs",
    "rust_feature_seed_review.mjs",
    "rust_feature_scope.mjs",
    "rust_feature_sbom.mjs",
    "rust_feature_advisories.mjs",
  ])
    capture(fileURLToPath(new URL("./" + file, import.meta.url)));
  const commands = inventories.map(({ profile }) => ({
    id: profile.id,
    target: profile.target,
    features: [...profile.features],
    executable: cargoExecutable,
    args: [
      "metadata",
      "--locked",
      "--offline",
      "--format-version",
      "1",
      "--manifest-path",
      join(root, "Cargo.toml"),
      "--filter-platform",
      profile.target,
      ...(profile.features.length
        ? ["--features", profile.features.join(",")]
        : []),
    ],
  }));
  const verify = () => {
    for (const bound of bindings.values()) {
      assert.equal(
        ordinary(bound.path).size,
        bound.bytes,
        "Bound input size changed",
      );
      assert.equal(
        hash(readFileSync(bound.path)),
        bound.sha256,
        "Bound input changed",
      );
    }
  };
  verify();
  return {
    root,
    output,
    configBytes,
    config,
    cargoLock,
    sourceBytes,
    inventories,
    sourceReview,
    commands,
    rustcExecutable,
    bindings: [...bindings.values()],
    verify,
  };
}

function collect(args, spawn, kind) {
  const prepared = prepareRustFeatureCollection(args);
  const directory = mkdtempSync(
    join(prepared.output, "rust-feature-collection-"),
  );
  const directoryIdentity = lstatSync(directory, { bigint: true });
  const assertOutput = () => {
    const current = ordinary(directory, true);
    const identity = lstatSync(directory, { bigint: true });
    assert(
      current.isDirectory() &&
        identity.dev === directoryIdentity.dev &&
        identity.ino === directoryIdentity.ino &&
        realpathSync(directory) === directory,
      "Owned output directory changed",
    );
  };
  const write = (name, bytes) => {
    assertOutput();
    const path = join(directory, name);
    writeFileSync(path, bytes, { flag: "wx" });
    return { path, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) };
  };
  const report = {
    schemaVersion: 1,
    assessment: "offline-selected-rust-feature-collection",
    collectionPassed: false,
    collectionProducerExecuted: kind === "installed-cargo",
    producerKind: kind,
    advisoryChecksPerformed: false,
    releaseAcceptance: false,
    rootCompletenessVerified: false,
    wholeRepositoryCoverage: false,
    completeApkNativeInventory: false,
    officialSbomSchemaValidated: false,
    sourceUnchanged: false,
    scope: args.scope,
    completeness: prepared.config.completeness,
    sourceReview: prepared.sourceReview,
    inputs: prepared.bindings,
    outputDirectory: directory,
    calls: [],
    collection: null,
    sbom: null,
    sbomValidation: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    failure: null,
  };
  const profiles = [];
  const exports = [];
  let totalMetadata = 0;
  let stage = "metadata";
  try {
    for (const command of prepared.commands) {
      prepared.verify();
      const call = {
        ...command,
        status: null,
        signal: null,
        errorCode: null,
        elapsedMs: null,
        metadata: null,
        stderr: null,
      };
      report.calls.push(call);
      const start = performance.now();
      const result = spawn(command.executable, command.args, {
        cwd: prepared.root,
        shell: false,
        windowsHide: true,
        timeout: RUST_COLLECTION_LIMITS.profileTimeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: RUST_COLLECTION_LIMITS.metadataBytes,
        encoding: null,
        // Command flags also require offline/locked operation. Explicit direct
        // rustc avoids rustup proxy discovery; no build scripts are executed by metadata.
        env: {
          ...process.env,
          CARGO_NET_OFFLINE: "true",
          RUSTC: prepared.rustcExecutable,
          RUSTC_WRAPPER: "",
          RUSTC_WORKSPACE_WRAPPER: "",
        },
      });
      call.elapsedMs = performance.now() - start;
      call.status = result.status ?? null;
      call.signal = result.signal ?? null;
      call.errorCode =
        typeof result.error?.code === "string" ? result.error.code : null;
      const stdout = Buffer.from(result.stdout ?? "");
      const stderr = Buffer.from(result.stderr ?? "");
      totalMetadata += stdout.length + stderr.length;
      assert(
        stdout.length <= RUST_COLLECTION_LIMITS.metadataBytes &&
          stderr.length <= RUST_COLLECTION_LIMITS.metadataBytes &&
          totalMetadata <= RUST_COLLECTION_LIMITS.metadataTotalBytes,
        "Metadata byte limit",
      );
      call.metadata = write(command.id + ".metadata.json", stdout);
      call.stderr = write(command.id + ".stderr.txt", stderr);
      assert(
        !result.error &&
          result.status === 0 &&
          !result.signal &&
          call.elapsedMs < RUST_COLLECTION_LIMITS.profileTimeoutMs,
        "Cargo metadata did not finish successfully within its deadline",
      );
      prepared.verify();
      const metadataJson = decode(stdout);
      const manifests = Object.fromEntries(
        Object.entries(prepared.sourceBytes).filter(
          ([path]) => path.split("/").at(-1) === "Cargo.toml",
        ),
      );
      const identity = {
        workspaceRoot: prepared.root,
        metadataSha256: call.metadata.sha256,
        cargoLockSha256: hash(prepared.cargoLock),
        manifestSha256: Object.fromEntries(
          Object.entries(manifests).map(([path, bytes]) => [path, hash(bytes)]),
        ),
        profile: { target: command.target, features: command.features },
      };
      const inputs = { metadataJson, cargoLock: prepared.cargoLock, manifests };
      const inventory = prepared.inventories.find(
        ({ profile }) => profile.id === command.id,
      );
      const selected = collectRustFeatureScope({
        identity,
        inputs,
        seeds: inventory.seeds,
      });
      const reportJson = JSON.stringify(selected);
      call.selected = write(command.id + ".selected.json", reportJson);
      profiles.push({
        id: command.id,
        target: command.target,
        features: command.features,
        metadataFile: call.metadata.path,
        metadataSha256: call.metadata.sha256,
      });
      exports.push({
        id: args.scope + "/" + command.id,
        reportJson,
        sha256: hash(reportJson),
        binding: {
          configJson: prepared.configBytes,
          configSha256: args.configSha256,
          profileId: command.id,
          sourceBytes: prepared.sourceBytes,
          collection: { identity, inputs },
        },
      });
    }
    stage = "selected-sbom";
    const sbom = exportRustFeatureSbom(exports);
    assert.equal(sbom.releaseAcceptance, false);
    assert.equal(sbom.rootCompletenessVerified, false);
    stage = "selected-sbom-schema";
    const validation = validateRustFeatureSbom(sbom.bomJson);
    assert.equal(validation.sha256, sbom.sha256);
    prepared.verify();
    report.sbom = write("selected-rust.cdx.json", sbom.bomJson);
    report.sbomValidation = write(
      "selected-rust.cdx.validation.json",
      JSON.stringify(validation, null, 2) + "\n",
    );
    report.officialSbomSchemaValidated = true;
    const collection = {
      schemaVersion: 1,
      scope: args.scope,
      configSha256: args.configSha256,
      cargoLockSha256: hash(prepared.cargoLock),
      sourceSha256: Object.fromEntries(
        Object.entries(prepared.sourceBytes).map(([path, bytes]) => [
          path,
          hash(bytes),
        ]),
      ),
      profiles,
    };
    // Only publish the consumer-compatible manifest after every configured
    // profile and both unchanged validators have succeeded.
    report.collection = write(
      "collection.json",
      JSON.stringify(collection, null, 2) + "\n",
    );
    prepared.verify();
    report.sourceUnchanged = true;
    report.collectionPassed = true;
    if (prepared.sourceReview?.rootCompletenessVerified === true) {
      report.rootCompletenessVerified = true;
      report.completeness = prepared.sourceReview.completeness;
    }
  } catch (error) {
    report.failure = {
      stage,
      message:
        "Offline collection failed; no partial evidence grants acceptance.",
      code: typeof error?.code === "string" ? error.code : "COLLECTION_FAILED",
    };
    try {
      prepared.verify();
      report.sourceUnchanged = true;
    } catch {
      report.sourceUnchanged = false;
    }
  } finally {
    report.finishedAt = new Date().toISOString();
    write("summary.json", JSON.stringify(report, null, 2) + "\n");
  }
  return report;
}
export function collectRustFeatureMetadata(args) {
  return collect(args, spawnSync, "installed-cargo");
}
export function collectRustFeatureMetadataFixture(args, spawn) {
  assert.equal(typeof spawn, "function", "Explicit fixture process required");
  assert.notEqual(
    spawn,
    spawnSync,
    "Fixtures cannot use the real process launcher",
  );
  return collect(args, spawn, "offline-fixture");
}
export function parseRustCollectionArgs(argv) {
  const names = {
    "--repository-root": "repositoryRoot",
    "--scope": "scope",
    "--config-sha256": "configSha256",
    "--output-directory": "outputDirectory",
    "--cargo-executable": "cargoExecutable",
    "--mode": "mode",
  };
  assert(
    Array.isArray(argv) && argv.length === 12,
    "All six explicit argument pairs required",
  );
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = names[argv[i]];
    assert(
      name &&
        !Object.hasOwn(args, name) &&
        typeof argv[i + 1] === "string" &&
        argv[i + 1],
      "Unknown/duplicate collection argument",
    );
    args[name] = argv[i + 1];
  }
  exactArgs(args);
  return args;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const report = collectRustFeatureMetadata(
      parseRustCollectionArgs(process.argv.slice(2)),
    );
    console.log(JSON.stringify(report));
    // Zero means collection only. No workflow may use this as advisory/release approval.
    process.exitCode = report.collectionPassed ? 0 : 1;
  } catch {
    console.error(
      "Offline Rust collection refused before metadata; no install, query or fallback attempted.",
    );
    process.exitCode = 1;
  }
}
