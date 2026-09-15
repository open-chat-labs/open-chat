// Explicit selected-registry transport only. Importing this module performs no IO.
// No Cargo, installation, broad audit, alternate endpoint or release acceptance.
// Collection manifests are caller-trusted producer records, not metadata produced here.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { request as httpsRequest } from "node:https";
import {
  lstatSync,
  realpathSync,
  readFileSync,
  writeFileSync,
  mkdtempSync,
} from "node:fs";
import { isAbsolute, join, parse, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { prepareRustFeatureInventory } from "./rust_feature_seed_review.mjs";
import { collectRustFeatureScope } from "./rust_feature_scope.mjs";
import {
  planRustFeatureAdvisories,
  RUST_ADVISORY_PLAN_LIMITS,
} from "./rust_feature_advisories.mjs";
import {
  validateRustFeatureAdvisoryResults,
  RUST_ADVISORY_RESULT_LIMITS,
} from "./rust_feature_advisory_results.mjs";

const ENDPOINT = "https://api.osv.dev/v1/querybatch";
export const RUST_FEATURE_RUNNER_LIMITS = Object.freeze({
  deadlineMs: 120_000,
  requestMs: 15_000,
  responseBytes: RUST_ADVISORY_RESULT_LIMITS.responseBytes,
  transcriptBytes: RUST_ADVISORY_RESULT_LIMITS.transcriptBytes,
  rounds: RUST_ADVISORY_RESULT_LIMITS.rounds,
  fileBytes: 64 * 1024 * 1024,
  inputBytes: 256 * 1024 * 1024,
  sourceFiles: 4096,
});
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const decode = (bytes) =>
  new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
const validHash = (value) =>
  assert.match(value ?? "", /^[a-f0-9]{64}$/u, "Expected lowercase SHA-256");
const sorted = (values) => [...values].sort();
const transportError = (code, status) =>
  Object.assign(new Error(code), {
    code,
    ...(Number.isInteger(status) ? { httpStatus: status } : {}),
  });
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
function noLinks(path) {
  assert(isAbsolute(path), "Absolute regular-file location required");
  const start = parse(path).root;
  let current = start;
  for (const part of relative(start, path).split(/[\\/]/u).filter(Boolean)) {
    current = join(current, part);
    assert(
      !lstatSync(current).isSymbolicLink(),
      "Linked filesystem inputs/outputs are unsupported",
    );
  }
}
function strictRelative(path) {
  assert.equal(typeof path, "string");
  assert(
    !/[\\:\0\r\n]/u.test(path) &&
      !path.startsWith("/") &&
      path.split("/").every((part) => part && part !== "." && part !== ".."),
    "Source path must remain in the selected checkout",
  );
}
function fields(value, expected, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), label);
  assert.deepEqual(sorted(Object.keys(value)), sorted(expected), label);
}
function effectiveLimits(overrides = {}) {
  const limits = { ...RUST_FEATURE_RUNNER_LIMITS };
  for (const [key, value] of Object.entries(overrides)) {
    assert(Object.hasOwn(limits, key), "Unknown limit");
    assert(
      Number.isSafeInteger(value) && value > 0 && value <= limits[key],
      "Limits can only be tightened",
    );
    limits[key] = value;
  }
  return limits;
}

// No custom agent/proxy/URL/CA hooks. Native TLS verifies api.osv.dev; redirects
// and compressed bodies are rejected rather than followed/decompressed.
function requestBatch(body, { signal, timeoutMs, responseBytes }, requestImpl) {
  assert.equal(typeof body, "string");
  assert(
    Buffer.byteLength(body) <= RUST_ADVISORY_PLAN_LIMITS.requestBytes,
    "Request byte limit exceeded",
  );
  return new Promise((resolveRequest, rejectRequest) => {
    let request,
      response,
      timer,
      settled = false,
      bytes = 0;
    const chunks = [];
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      response?.destroy();
      request?.destroy();
      rejectRequest(error);
    };
    const abort = () => fail(transportError("INVOCATION_CANCELLED"));
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(
      () => fail(transportError("REQUEST_TIMEOUT")),
      timeoutMs,
    );
    try {
      request = requestImpl(
        ENDPOINT,
        {
          method: "POST",
          agent: false,
          rejectUnauthorized: true,
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            "accept-encoding": "identity",
            "content-length": Buffer.byteLength(body),
          },
        },
        (incoming) => {
          response = incoming;
          // Even rejected or late streams may emit an error after destruction.
          response.on("error", fail);
          response.on("aborted", () =>
            fail(transportError("RESPONSE_ABORTED")),
          );
          // A timeout may win before a late socket callback.
          if (settled) {
            response.destroy();
            return;
          }
          try {
            if (
              !(
                response.socket?.encrypted === true &&
                response.socket.authorized === true
              )
            )
              throw transportError("TLS_AUTHENTICATION_FAILED");
            if (response.statusCode !== 200)
              throw transportError("HTTP_STATUS_REJECTED", response.statusCode);
            const encoding = response.headers["content-encoding"];
            if (!(encoding === undefined || encoding === "identity"))
              throw transportError("RESPONSE_ENCODING_REJECTED");
            const length = response.headers["content-length"];
            if (length !== undefined)
              assert(
                /^\d+$/u.test(length) && Number(length) <= responseBytes,
                "Response byte limit exceeded",
              );
            response.on("data", (chunk) => {
              if (settled) return;
              const buffer = Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(chunk);
              bytes += buffer.length;
              if (bytes > responseBytes) {
                fail(transportError("RESPONSE_BYTES_LIMIT"));
                return;
              }
              chunks.push(buffer);
            });
            response.on("end", () => {
              if (settled) return;
              if (length !== undefined && Number(length) !== bytes) {
                fail(transportError("RESPONSE_TRUNCATED"));
                return;
              }
              settled = true;
              cleanup();
              resolveRequest({
                status: response.statusCode,
                responseJson: Buffer.concat(chunks),
                transportAuthenticityVerified: requestImpl === httpsRequest,
              });
            });
            response.on("close", () => {
              if (!settled) fail(transportError("RESPONSE_CLOSED"));
            });
          } catch (error) {
            fail(error);
          }
        },
      );
      request.on("error", fail);
      request.end(body);
    } catch (error) {
      fail(error);
    }
  });
}

// Mandatory mock entry point: even a mock TLS socket cannot claim authenticity.
export function requestRustFeatureOsvForTest(
  body,
  {
    requestImpl,
    signal,
    timeoutMs = 1000,
    responseBytes = RUST_FEATURE_RUNNER_LIMITS.responseBytes,
  },
) {
  assert.equal(
    typeof requestImpl,
    "function",
    "Offline test request implementation required",
  );
  assert.notEqual(
    requestImpl,
    httpsRequest,
    "Test entry point cannot use the production transport",
  );
  assert(
    Number.isSafeInteger(timeoutMs) &&
      timeoutMs > 0 &&
      timeoutMs <= RUST_FEATURE_RUNNER_LIMITS.requestMs,
  );
  assert(
    Number.isSafeInteger(responseBytes) &&
      responseBytes > 0 &&
      responseBytes <= RUST_FEATURE_RUNNER_LIMITS.responseBytes,
  );
  return requestBatch(body, { signal, timeoutMs, responseBytes }, requestImpl);
}

function bindCollection(args, limits) {
  const paths = new Map();
  let totalBytes = 0;
  const capture = (path, expected) => {
    const absolute = resolve(path);
    if (expected !== undefined) validHash(expected);
    noLinks(absolute);
    const stat = lstatSync(absolute);
    assert(
      stat.isFile() && stat.size <= limits.fileBytes,
      "Bound input must be a bounded regular file",
    );
    const bytes = readFileSync(absolute);
    assert(
      bytes.length <= limits.fileBytes,
      "Bound input grew beyond its byte limit",
    );
    totalBytes += bytes.length;
    assert(
      totalBytes <= limits.inputBytes,
      "Aggregate input byte limit exceeded",
    );
    const digest = sha(bytes);
    if (expected !== undefined)
      assert.equal(digest, expected, "Input SHA-256 mismatch");
    const existing = paths.get(absolute);
    assert(
      !existing || existing.sha256 === digest,
      "Input changed while collecting",
    );
    paths.set(absolute, {
      path: absolute,
      sha256: digest,
      bytes: bytes.length,
    });
    return bytes;
  };
  const root = realpathSync(args.repositoryRoot);
  noLinks(resolve(args.repositoryRoot));
  const collectionBytes = capture(args.collectionFile, args.collectionSha256);
  const collection = JSON.parse(decode(collectionBytes));
  fields(
    collection,
    [
      "schemaVersion",
      "scope",
      "configSha256",
      "cargoLockSha256",
      "sourceSha256",
      "profiles",
    ],
    "Collection manifest fields",
  );
  assert.equal(collection.schemaVersion, 1);
  assert.equal(collection.scope, args.scope);
  const configPath = join(
    root,
    "scripts/rust_feature_scope." + args.scope + ".json",
  );
  const configBytes = capture(configPath, collection.configSha256);
  const config = JSON.parse(decode(configBytes));
  const cargoLock = capture(
    join(root, "Cargo.lock"),
    collection.cargoLockSha256,
  );
  assert(config.sourceFiles && collection.sourceSha256);
  const sourcePaths = Object.keys(config.sourceFiles);
  assert(
    sourcePaths.length > 0 && sourcePaths.length <= limits.sourceFiles,
    "Source input limit",
  );
  assert.deepEqual(
    sorted(Object.keys(collection.sourceSha256)),
    sorted(sourcePaths),
    "Exact config source set required",
  );
  const sourceBytes = {};
  for (const path of sourcePaths) {
    strictRelative(path);
    const absolute = resolve(root, path);
    assert(within(root, absolute), "Source path escaped checkout");
    sourceBytes[path] = capture(absolute, collection.sourceSha256[path]);
  }
  assert(
    Array.isArray(config.profiles) &&
      config.profiles.length > 0 &&
      config.profiles.length <= RUST_ADVISORY_PLAN_LIMITS.profiles,
  );
  assert(Array.isArray(collection.profiles), "Profile bindings required");
  assert.deepEqual(
    sorted(collection.profiles.map((p) => p.id)),
    sorted(config.profiles.map((p) => p.id)),
    "All configured profiles must be bound exactly once",
  );
  const profiles = [];
  const profileBindings = [];
  for (const bound of collection.profiles) {
    fields(
      bound,
      ["id", "target", "features", "metadataFile", "metadataSha256"],
      "Profile binding fields",
    );
    const inventory = prepareRustFeatureInventory({
      config,
      profileId: bound.id,
      sourceBytes,
      cargoLock,
    });
    assert.equal(
      bound.target,
      inventory.profile.target,
      "Profile target mismatch",
    );
    assert.deepEqual(
      bound.features,
      inventory.profile.features,
      "Profile feature mismatch",
    );
    assert(isAbsolute(bound.metadataFile), "Absolute metadata file required");
    const metadataBytes = capture(bound.metadataFile, bound.metadataSha256);
    const metadataJson = decode(metadataBytes);
    // The config's metadata hash describes historical local review evidence.
    // This invocation uses the hash-pinned producer manifest instead; it never
    // claims that Cargo was rerun or that its host command was independently observed.
    const manifests = Object.fromEntries(
      Object.entries(sourceBytes).filter(
        ([path]) => path.split("/").at(-1) === "Cargo.toml",
      ),
    );
    const report = collectRustFeatureScope({
      identity: {
        workspaceRoot: root,
        metadataSha256: bound.metadataSha256,
        cargoLockSha256: sha(cargoLock),
        manifestSha256: Object.fromEntries(
          Object.entries(manifests).map(([path, bytes]) => [path, sha(bytes)]),
        ),
        profile: { target: bound.target, features: bound.features },
      },
      inputs: { metadataJson, cargoLock, manifests },
      seeds: inventory.seeds,
    });
    const reportJson = JSON.stringify(report);
    profiles.push({
      id: args.scope + "/" + bound.id,
      reportJson,
      sha256: sha(reportJson),
    });
    profileBindings.push({
      id: bound.id,
      target: bound.target,
      features: bound.features,
      metadataSha256: bound.metadataSha256,
    });
  }
  const verify = () => {
    for (const input of paths.values()) {
      noLinks(input.path);
      const stat = lstatSync(input.path);
      assert(
        stat.isFile() && stat.size === input.bytes,
        "Input type/size changed",
      );
      assert.equal(
        sha(readFileSync(input.path)),
        input.sha256,
        "Bound inputs changed",
      );
    }
  };
  verify();
  return {
    profiles,
    verify,
    binding: {
      collectionSha256: sha(collectionBytes),
      configSha256: sha(configBytes),
      cargoLockSha256: sha(cargoLock),
      sourceSha256: collection.sourceSha256,
      profiles: profileBindings,
      inputFiles: [...paths.values()],
      collectionProducerExecuted: false,
      producerTrust:
        "caller-pinned-collection-manifest; no fresh Cargo or omitted-edge attestation",
      completeness: config.completeness,
    },
  };
}

function boundedTransport(transport, body, options) {
  return new Promise((resolveRequest, rejectRequest) => {
    const abort = () => rejectRequest(transportError("INVOCATION_CANCELLED"));
    if (options.signal.aborted) return abort();
    options.signal.addEventListener("abort", abort, { once: true });
    Promise.resolve()
      .then(() => transport(body, options))
      .then(
        (value) => {
          options.signal.removeEventListener("abort", abort);
          resolveRequest(value);
        },
        (error) => {
          options.signal.removeEventListener("abort", abort);
          rejectRequest(error);
        },
      );
  });
}

async function run(args, transport, kind, limitOverrides) {
  fields(
    args,
    [
      "repositoryRoot",
      "scope",
      "collectionFile",
      "collectionSha256",
      "outputDirectory",
      "mode",
    ],
    "Explicit runner arguments required",
  );
  assert(
    ["pr1", "pr2"].includes(args.scope),
    "Explicit feature scope required",
  );
  assert.equal(
    args.mode,
    "query-selected-identities",
    "Explicit selected-registry query authorization required",
  );
  validHash(args.collectionSha256);
  for (const path of [
    args.repositoryRoot,
    args.collectionFile,
    args.outputDirectory,
  ])
    assert(isAbsolute(path));
  const limits = effectiveLimits(limitOverrides);
  noLinks(resolve(args.repositoryRoot));
  noLinks(resolve(args.outputDirectory));
  const root = realpathSync(args.repositoryRoot);
  const output = realpathSync(args.outputDirectory);
  assert(!within(root, output), "Evidence output must be outside the checkout");
  assert(lstatSync(output).isDirectory());
  const directory = mkdtempSync(join(output, "rust-feature-advisories-"));
  const directoryPath = realpathSync(directory);
  const directoryStat = lstatSync(directory, { bigint: true });
  const assertOutputIdentity = () => {
    noLinks(directory);
    const current = lstatSync(directory, { bigint: true });
    assert(
      current.isDirectory() &&
        current.dev === directoryStat.dev &&
        current.ino === directoryStat.ino &&
        realpathSync(directory) === directoryPath,
      "Owned evidence directory changed",
    );
  };
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.deadlineMs);
  const transcript = [];
  const rawRounds = [];
  let rawTranscriptBytes = 0;
  const report = {
    schemaVersion: 1,
    assessment: "selected-rust-identity-transport-capture",
    status: "failed",
    invocationId: randomUUID(),
    startedAt: new Date().toISOString(),
    outputDirectory: directory,
    passed: false,
    advisoryAcceptance: false,
    releaseAcceptance: false,
    rootCompletenessVerified: false,
    wholeRepositoryCoverage: false,
    collectionProducerExecuted: false,
    inputsUnchanged: false,
    responsesComplete: false,
    selectedNoKnownFindings: false,
    gitIndexCoverageVerified: false,
    registryResponsesComplete: false,
    selectedRegistryNoKnownFindings: false,
    networkRequestsPerformed: false,
    transportAuthenticityVerified: false,
    advisoryDatabaseFreshnessVerified: false,
    capture: {
      kind,
      attemptedRequests: 0,
      completedRequests: 0,
      currentInvocationOnly: true,
    },
    nonAcceptanceReasons: ["incomplete-feature-scope", "no-release-acceptance"],
  };
  let stage = "input-binding",
    binding,
    plan;
  const write = (name, value) => {
    const bytes = JSON.stringify(value, null, 2) + "\n";
    assertOutputIdentity();
    writeFileSync(join(directory, name), bytes, { flag: "wx" });
    return sha(bytes);
  };
  try {
    binding = bindCollection(args, limits);
    report.binding = binding.binding;
    plan = planRustFeatureAdvisories(binding.profiles);
    assert.equal(plan.request.url, ENDPOINT);
    report.unqueried = plan.unqueried;
    if (plan.unqueried.length)
      report.nonAcceptanceReasons.push("unqueried-source-identities");
    report.planSha256 = write("plan.json", plan);
    report.profileReportsSha256 = write("profiles.json", binding.profiles);
    let pending = plan.selected.map((entry) => ({ index: entry.queryIndex }));
    stage = "transport";
    while (pending.length) {
      assert(
        transcript.length < limits.rounds,
        "Pagination round limit exceeded",
      );
      assert(
        performance.now() - started < limits.deadlineMs &&
          !controller.signal.aborted,
        "Invocation deadline exceeded",
      );
      binding.verify(); // Check current source immediately before every export.
      const body = JSON.stringify({
        queries: pending.map(({ index, token }) => ({
          ...plan.request.body.queries[index],
          ...(token === undefined ? {} : { page_token: token }),
        })),
      });
      assert(Buffer.byteLength(body) <= RUST_ADVISORY_PLAN_LIMITS.requestBytes);
      report.capture.attemptedRequests++;
      report.networkRequestsPerformed = kind === "node-https";
      const response = await boundedTransport(transport, body, {
        signal: controller.signal,
        timeoutMs: Math.min(
          limits.requestMs,
          Math.max(1, limits.deadlineMs - (performance.now() - started)),
        ),
        responseBytes: limits.responseBytes,
      });
      assert.equal(response.status, 200, "Redirect/unsuccessful HTTP response");
      assert(
        typeof response.responseJson === "string" ||
          response.responseJson instanceof Uint8Array,
      );
      const bytes = Buffer.from(response.responseJson);
      assert(
        bytes.length <= limits.responseBytes,
        "Response byte limit exceeded",
      );
      rawTranscriptBytes += Buffer.byteLength(body) + bytes.length;
      assert(
        rawTranscriptBytes <= limits.transcriptBytes,
        "Aggregate transcript byte limit exceeded",
      );
      // Preserve bounded raw bytes even if UTF-8/schema validation then fails.
      // These files are evidence only, never inputs to a later acceptance path.
      const prefix = "round-" + String(rawRounds.length + 1).padStart(3, "0");
      assertOutputIdentity();
      writeFileSync(join(directory, prefix + ".request.json"), body, {
        flag: "wx",
      });
      assertOutputIdentity();
      writeFileSync(join(directory, prefix + ".response.bin"), bytes, {
        flag: "wx",
      });
      rawRounds.push({
        requestFile: prefix + ".request.json",
        requestSha256: sha(body),
        responseFile: prefix + ".response.bin",
        responseSha256: sha(bytes),
      });
      const responseJson = decode(bytes);
      transcript.push({
        method: "POST",
        url: ENDPOINT,
        status: response.status,
        requestJson: body,
        requestSha256: sha(body),
        responseJson,
        responseSha256: sha(bytes),
      });
      report.capture.completedRequests++;
      if (kind === "node-https")
        assert.equal(
          response.transportAuthenticityVerified,
          true,
          "TLS capture is not authenticated",
        );
      // Reuse the strict validator on every real prefix. Its sole expected
      // intermediate failure is the final pending-pagination assertion; malformed
      // JSON, duplicate keys/tokens, wrong order and limits still fail immediately.
      try {
        validateRustFeatureAdvisoryResults(binding.profiles, transcript);
      } catch (error) {
        if (
          !(
            error.code === "ERR_ASSERTION" &&
            error.expected === 0 &&
            error.actual > 0 &&
            error.message.startsWith(
              "Incomplete pagination or missing initial response",
            )
          )
        )
          throw error;
      }
      binding.verify();
      const results = JSON.parse(responseJson).results;
      pending = pending.flatMap((state, index) =>
        Object.hasOwn(results[index], "next_page_token")
          ? [{ index: state.index, token: results[index].next_page_token }]
          : [],
      );
    }
    stage = "result-validation";
    const validated = validateRustFeatureAdvisoryResults(
      binding.profiles,
      transcript,
    );
    binding.verify();
    report.inputsUnchanged = true;
    report.validation = validated;
    report.responsesComplete = validated.responsesComplete;
    report.selectedNoKnownFindings = validated.selectedNoKnownFindings;
    report.registryResponsesComplete = validated.registryResponsesComplete;
    report.selectedRegistryNoKnownFindings =
      validated.selectedRegistryNoKnownFindings;
    report.findings = validated.findings;
    if (validated.findings.length)
      report.nonAcceptanceReasons.push("known-advisory-findings");
    report.transportAuthenticityVerified =
      kind === "node-https" && transcript.length > 0;
    report.status = "completed";
  } catch (error) {
    // Avoid echoing private source/metadata or a network error's response body.
    const code =
      /^[A-Z_]{3,64}$/u.test(error?.code ?? "") &&
      error.code !== "ERR_ASSERTION"
        ? error.code
        : stage === "input-binding"
          ? "INPUT_BINDING_FAILED"
          : "CAPTURE_VALIDATION_FAILED";
    report.failure = {
      stage,
      code,
      message: "Scoped capture failed; partial evidence is not acceptance.",
      ...(Number.isInteger(error?.httpStatus)
        ? { httpStatus: error.httpStatus }
        : {}),
    };
    if (binding) {
      try {
        binding.verify();
        report.inputsUnchanged = true;
      } catch {
        report.inputsUnchanged = false;
      }
    }
  } finally {
    controller.abort();
    clearTimeout(timer);
    report.finishedAt = new Date().toISOString();
    report.elapsedMs = performance.now() - started;
    report.rawRounds = rawRounds;
    report.transcriptSha256 = write("transcript.json", transcript);
    write("summary.json", report);
  }
  return report;
}

// This is the only real transport entry point. No injectable fetch/URL/proof flags.
export function runRustFeatureAdvisories(args) {
  return run(
    args,
    (body, options) => requestBatch(body, options, httpsRequest),
    "node-https",
  );
}
// Offline tests can exercise orchestration without claiming TLS or network proof.
export function runRustFeatureAdvisoryFixture(
  args,
  { transport, limits } = {},
) {
  assert.equal(
    typeof transport,
    "function",
    "An explicit offline fixture transport is required",
  );
  return run(args, transport, "offline-fixture", limits);
}

export function parseRustFeatureRunnerArgs(argv) {
  const names = {
    "--repository-root": "repositoryRoot",
    "--scope": "scope",
    "--collection-file": "collectionFile",
    "--collection-sha256": "collectionSha256",
    "--output-directory": "outputDirectory",
    "--mode": "mode",
  };
  const args = {};
  assert(
    Array.isArray(argv) && argv.length === 12,
    "All six explicit argument pairs are required",
  );
  for (let i = 0; i < argv.length; i += 2) {
    const name = names[argv[i]];
    assert(
      name &&
        !Object.hasOwn(args, name) &&
        typeof argv[i + 1] === "string" &&
        argv[i + 1],
      "Unknown/duplicate runner argument",
    );
    args[name] = argv[i + 1];
  }
  assert(["pr1", "pr2"].includes(args.scope));
  assert.equal(args.mode, "query-selected-identities");
  validHash(args.collectionSha256);
  return args;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const report = await runRustFeatureAdvisories(
      parseRustFeatureRunnerArgs(process.argv.slice(2)),
    );
    console.log(JSON.stringify(report));
    // Capture success is deliberately not scoped advisory/release acceptance.
    process.exitCode = 1;
  } catch {
    console.error(
      "Scoped Rust advisory invocation failed; no fallback or broad audit was attempted.",
    );
    process.exitCode = 1;
  }
}
