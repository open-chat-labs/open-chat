import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  readdirSync,
  renameSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";
import test from "node:test";
import {
  runRustFeatureAdvisoryFixture,
  requestRustFeatureOsvForTest,
  parseRustFeatureRunnerArgs,
} from "./rust_feature_advisory_runner.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const registry = "registry+https://github.com/rust-lang/crates.io-index";
const endpoint = "https://api.osv.dev/v1/querybatch";

function fixture(t, { git = false, scope = "pr1" } = {}) {
  const base = mkdtempSync(join(tmpdir(), "rust-feature-runner-test-"));
  t.after(() => {
    assert(relative(tmpdir(), base).startsWith("rust-feature-runner-test-"));
    rmSync(base, { recursive: true });
  });
  const root = join(base, "repo");
  const output = join(base, "reports");
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "feature"));
  mkdirSync(output);
  const source = {
    "Cargo.toml": '[workspace]\nmembers = ["feature"]\n',
    "feature/Cargo.toml":
      '[package]\nname = "feature_host"\nversion = "0.1.0"\n',
    "feature/lib.rs": "pub fn feature() {}\n",
  };
  for (const [path, bytes] of Object.entries(source))
    writeFileSync(join(root, path), bytes);
  const packages = ["alpha", "beta"].map((name, i) => ({
    id: name,
    name,
    version: "1.2.3",
    source:
      git && i === 1
        ? "git+https://example.invalid/repo?rev=" +
          "a".repeat(40) +
          "#" +
          "a".repeat(40)
        : registry,
    dependencies: [],
  }));
  const owner = {
    id: "owner",
    name: "feature_host",
    version: "0.1.0",
    source: null,
    manifest_path: join(root, "feature/Cargo.toml"),
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
        (p) =>
          '[[package]]\nname = "' +
          p.name +
          '"\nversion = "' +
          p.version +
          '"\n' +
          (p.source ? 'source = "' + p.source + '"\n' : "") +
          (p.source === registry
            ? 'checksum = "' + "a".repeat(64) + '"\n'
            : ""),
      )
      .join("\n");
  writeFileSync(join(root, "Cargo.lock"), lock);
  const metadata = {
    version: 1,
    workspace_root: root,
    workspace_members: ["owner"],
    packages: [owner, ...packages],
    resolve: {
      nodes: [
        {
          id: "owner",
          features: [],
          deps: packages.map((p) => ({
            name: p.name,
            pkg: p.id,
            dep_kinds: [{ kind: null, target: null }],
          })),
        },
        ...packages.map((p) => ({ id: p.id, features: [], deps: [] })),
      ],
    },
  };
  const metadataFile = join(base, "metadata.json");
  writeFileSync(metadataFile, JSON.stringify(metadata));
  const config = {
    schemaVersion: 1,
    reviewTextIdentity: "utf8-lf",
    sourceRevision: { base: "a".repeat(40), head: "b".repeat(40) },
    cargoLockSha256: hash(lock),
    completeness: {
      status: "incomplete",
      unresolved: [
        { id: "bounded-scope", description: "No whole-binary inventory." },
      ],
    },
    sourceFiles: Object.fromEntries(
      Object.entries(source).map(([path, bytes]) => [path, hash(bytes)]),
    ),
    profiles: [
      {
        id: "windows-default",
        target: "x86_64-pc-windows-msvc",
        features: [],
        metadataSha256: hash(JSON.stringify(metadata)),
      },
    ],
    seeds: packages.map((p) => ({
      id: p.name,
      ownerManifest: "feature/Cargo.toml",
      ownerPackage: "feature_host",
      dependencyName: p.name,
      kind: "normal",
      target: null,
      originContext: "production",
      profiles: ["windows-default"],
      expected: {
        name: p.name,
        version: p.version,
        source: p.source,
        checksum: p.source === registry ? "a".repeat(64) : null,
      },
      review: { status: "source-traced", basis: "source-call-or-schema" },
      evidence: [{ path: "feature/lib.rs", lines: [1] }],
    })),
  };
  const configFile = join(
    root,
    "scripts/rust_feature_scope." + scope + ".json",
  );
  writeFileSync(configFile, JSON.stringify(config));
  const manifest = {
    schemaVersion: 1,
    scope,
    configSha256: hash(readFileSync(configFile)),
    cargoLockSha256: hash(lock),
    sourceSha256: Object.fromEntries(
      Object.entries(source).map(([path, bytes]) => [path, hash(bytes)]),
    ),
    profiles: [
      {
        id: "windows-default",
        target: "x86_64-pc-windows-msvc",
        features: [],
        metadataFile,
        metadataSha256: hash(readFileSync(metadataFile)),
      },
    ],
  };
  const collectionFile = join(base, "collection.json");
  writeFileSync(collectionFile, JSON.stringify(manifest));
  const args = {
    repositoryRoot: root,
    scope,
    collectionFile,
    collectionSha256: hash(readFileSync(collectionFile)),
    outputDirectory: output,
    mode: "query-selected-identities",
  };
  const updateManifest = (change) => {
    change(manifest);
    writeFileSync(collectionFile, JSON.stringify(manifest));
    args.collectionSha256 = hash(readFileSync(collectionFile));
  };
  return {
    args,
    root,
    output,
    metadataFile,
    metadata,
    config,
    configFile,
    collectionFile,
    manifest,
    updateManifest,
  };
}
const empty = async (body) => ({
  status: 200,
  responseJson: JSON.stringify({
    results: JSON.parse(body).queries.map(() => ({})),
  }),
});

test("offline fixture captures bound registry results but never authenticates transport or approves release", async (t) => {
  const f = fixture(t);
  const result = await runRustFeatureAdvisoryFixture(f.args, {
    transport: empty,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.registryResponsesComplete, true);
  assert.equal(result.selectedRegistryNoKnownFindings, true);
  assert.equal(result.inputsUnchanged, true);
  for (const key of [
    "passed",
    "advisoryAcceptance",
    "releaseAcceptance",
    "rootCompletenessVerified",
    "networkRequestsPerformed",
    "transportAuthenticityVerified",
  ])
    assert.equal(result[key], false, key);
  assert.equal(result.capture.kind, "offline-fixture");
  assert.equal(result.capture.completedRequests, 1);
  assert.equal(result.collectionProducerExecuted, false);
  assert(existsSync(join(result.outputDirectory, "summary.json")));
  assert(existsSync(join(result.outputDirectory, "transcript.json")));
});

test("pagination reissues only pending original queries and retains exact raw bodies", async (t) => {
  const f = fixture(t);
  const bodies = [];
  const result = await runRustFeatureAdvisoryFixture(f.args, {
    transport: async (body) => {
      bodies.push(JSON.parse(body));
      return {
        status: 200,
        responseJson: JSON.stringify({
          results:
            bodies.length === 1 ? [{}, { next_page_token: "next" }] : [{}],
        }),
      };
    },
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(bodies[1], {
    queries: [
      {
        package: { ecosystem: "crates.io", name: "beta" },
        version: "1.2.3",
        page_token: "next",
      },
    ],
  });
  const transcript = JSON.parse(
    readFileSync(join(result.outputDirectory, "transcript.json")),
  );
  assert.equal(transcript.length, 2);
  assert.equal(hash(transcript[1].requestJson), transcript[1].requestSha256);
});

test("Git packages query their immutable commit without claiming fixture or index acceptance", async (t) => {
  const f = fixture(t, { git: true });
  let queries;
  const result = await runRustFeatureAdvisoryFixture(f.args, {
    transport: async (body) => {
      queries = JSON.parse(body).queries;
      return empty(body);
    },
  });
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[1], { commit: "a".repeat(40) });
  assert.deepEqual(result.unqueried, []);
  assert.equal(result.responsesComplete, true);
  assert.equal(result.selectedNoKnownFindings, true);
  assert.equal(result.gitIndexCoverageVerified, false);
  assert.equal(result.advisoryAcceptance, false);
  assert(!result.nonAcceptanceReasons.includes("unqueried-source-identities"));
});

test("a Git finding after a token-only page is not hidden by clean registry results", async (t) => {
  const f = fixture(t, { git: true });
  const queries = [];
  const result = await runRustFeatureAdvisoryFixture(f.args, {
    transport: async (body) => {
      queries.push(JSON.parse(body).queries);
      return {
        status: 200,
        responseJson: JSON.stringify({
          results:
            queries.length === 1
              ? [{}, { next_page_token: "git-next" }]
              : [
                  {
                    vulns: [
                      { id: "OSV-2026-1", modified: "2026-09-14T00:00:00Z" },
                    ],
                  },
                ],
        }),
      };
    },
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(queries[1], [
    { commit: "a".repeat(40), page_token: "git-next" },
  ]);
  assert.equal(result.selectedRegistryNoKnownFindings, true);
  assert.equal(result.selectedNoKnownFindings, false);
  assert.equal(result.findings[0].commit, "a".repeat(40));
  assert(result.nonAcceptanceReasons.includes("known-advisory-findings"));
  assert.equal(result.advisoryAcceptance, false);
});

test("PR2 uses its own exact source-reviewed scope rather than relabelling PR1", async (t) => {
  const f = fixture(t, { scope: "pr2" });
  const result = await runRustFeatureAdvisoryFixture(f.args, {
    transport: empty,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.validation.profiles[0].id, "pr2/windows-default");
  assert.equal(result.binding.configSha256, hash(readFileSync(f.configFile)));
});

for (const [name, mutate] of [
  [
    "config",
    (f) =>
      writeFileSync(f.configFile, readFileSync(f.configFile, "utf8") + " "),
  ],
  ["lock", (f) => writeFileSync(join(f.root, "Cargo.lock"), "changed")],
  ["source", (f) => writeFileSync(join(f.root, "feature/lib.rs"), "changed")],
  ["metadata", (f) => writeFileSync(f.metadataFile, "{}")],
  ["manifest", (f) => writeFileSync(f.collectionFile, "{}")],
  [
    "missing profile",
    (f) =>
      f.updateManifest((m) => {
        m.profiles = [];
      }),
  ],
  [
    "wrong target",
    (f) =>
      f.updateManifest((m) => {
        m.profiles[0].target = "other";
      }),
  ],
  [
    "wrong features",
    (f) =>
      f.updateManifest((m) => {
        m.profiles[0].features = ["extra"];
      }),
  ],
  [
    "extra source",
    (f) =>
      f.updateManifest((m) => {
        m.sourceSha256["unrelated.rs"] = "a".repeat(64);
      }),
  ],
  [
    "escaping source",
    (f) =>
      f.updateManifest((m) => {
        m.sourceSha256["../outside"] = "a".repeat(64);
      }),
  ],
])
  test("binding rejects " + name + " before transport", async (t) => {
    const f = fixture(t);
    mutate(f);
    let calls = 0;
    const result = await runRustFeatureAdvisoryFixture(f.args, {
      transport: async (...args) => {
        calls++;
        return empty(...args);
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(calls, 0);
    assert.equal(result.advisoryAcceptance, false);
  });

test("changed inputs after a response invalidate the entire capture and preserve failure evidence", async (t) => {
  const f = fixture(t);
  const result = await runRustFeatureAdvisoryFixture(f.args, {
    transport: async (body) => {
      writeFileSync(join(f.root, "feature/lib.rs"), "changed");
      return empty(body);
    },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.inputsUnchanged, false);
  assert.equal(result.capture.completedRequests, 1);
  assert(existsSync(join(result.outputDirectory, "transcript.json")));
});

test("rehashed producer metadata cannot silently drop a configured root", async (t) => {
  const f = fixture(t);
  let calls = 0;
  f.metadata.resolve.nodes[0].deps.pop();
  writeFileSync(f.metadataFile, JSON.stringify(f.metadata));
  f.updateManifest((m) => {
    m.profiles[0].metadataSha256 = hash(readFileSync(f.metadataFile));
  });
  const result = await runRustFeatureAdvisoryFixture(f.args, {
    transport: async (body) => {
      calls++;
      return empty(body);
    },
  });
  assert.equal(result.status, "failed");
  assert.equal(calls, 0);
});

test("linked source files are refused before transport", async (t) => {
  const f = fixture(t);
  let calls = 0;
  const original = join(f.root, "feature");
  const moved = join(f.root, "feature-real");
  renameSync(original, moved);
  symlinkSync(moved, original, "junction");
  const result = await runRustFeatureAdvisoryFixture(f.args, {
    transport: async (body) => {
      calls++;
      return empty(body);
    },
  });
  assert.equal(result.status, "failed");
  assert.equal(calls, 0);
});

for (const link of [false, true])
  test(
    "evidence directory replacement cannot redirect writes; link=" + link,
    async (t) => {
      const f = fixture(t);
      const alternate = join(f.output, "replacement-target");
      mkdirSync(alternate);
      await assert.rejects(
        runRustFeatureAdvisoryFixture(f.args, {
          transport: async (body) => {
            const name = readdirSync(f.output).find((entry) =>
              entry.startsWith("rust-feature-advisories-"),
            );
            const run = join(f.output, name);
            renameSync(run, run + "-moved");
            if (link) symlinkSync(alternate, run, "junction");
            else mkdirSync(run);
            return empty(body);
          },
        }),
      );
      assert.deepEqual(readdirSync(alternate), []);
    },
  );

for (const [name, response] of [
  ["redirect", { status: 302, responseJson: "{}" }],
  ["HTTP failure", { status: 500, responseJson: "{}" }],
  ["wrong count", { status: 200, responseJson: '{"results":[{}]}' }],
  [
    "duplicate JSON fields",
    { status: 200, responseJson: '{"results":[{},{}],"results":[{},{}]}' },
  ],
  ["bad UTF8", { status: 200, responseJson: Buffer.from([0xff]) }],
])
  test("rejects " + name + " without acceptance", async (t) => {
    const f = fixture(t);
    const result = await runRustFeatureAdvisoryFixture(f.args, {
      transport: async () => response,
    });
    assert.equal(result.status, "failed");
    assert.equal(result.advisoryAcceptance, false);
    if (name === "bad UTF8") {
      assert.equal(result.rawRounds.length, 1);
      assert.deepEqual(
        readFileSync(
          join(result.outputDirectory, result.rawRounds[0].responseFile),
        ),
        Buffer.from([0xff]),
      );
    }
  });

test("known findings remain nonacceptance", async (t) => {
  const f = fixture(t);
  const result = await runRustFeatureAdvisoryFixture(f.args, {
    transport: async () => ({
      status: 200,
      responseJson:
        '{"results":[{"vulns":[{"id":"RUSTSEC-2026-0001","modified":"2026-09-09T12:00:00Z"}]},{}]}',
    }),
  });
  assert.equal(result.status, "completed");
  assert.equal(result.findings.length, 1);
  assert.equal(result.selectedRegistryNoKnownFindings, false);
});

test("a never-settling fixture is bounded by the invocation deadline", async (t) => {
  const f = fixture(t);
  let calls = 0;
  const result = await runRustFeatureAdvisoryFixture(f.args, {
    transport: () => {
      calls++;
      return new Promise(() => {});
    },
    limits: { deadlineMs: 150 },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.capture.completedRequests, 0);
  assert.equal(calls, 1);
});

test("repeated pagination and fixture byte/round limits fail closed", async (t) => {
  for (const options of [
    {
      transport: async () => ({
        status: 200,
        responseJson:
          '{"results":[{"next_page_token":"x"},{"next_page_token":"x"}]}',
      }),
    },
    { transport: empty, limits: { responseBytes: 3 } },
    { transport: empty, limits: { transcriptBytes: 3 } },
    {
      transport: async () => ({
        status: 200,
        responseJson:
          '{"results":[{"next_page_token":"x"},{"next_page_token":"y"}]}',
      }),
      limits: { rounds: 1 },
    },
  ]) {
    const f = fixture(t);
    const result = await runRustFeatureAdvisoryFixture(f.args, options);
    assert.equal(result.status, "failed");
  }
});

function mockRequest({
  status = 200,
  authorized = true,
  encrypted = true,
  headers = {},
  chunks = [Buffer.from("{}")],
  hang = false,
  aborted = false,
  hangBody = false,
  lateError = false,
} = {}) {
  const observed = {};
  const impl = (url, options, callback) => {
    observed.url = url;
    observed.options = options;
    const request = new EventEmitter();
    request.destroy = () => {
      observed.destroyed = true;
    };
    request.end = (body) => {
      observed.body = body;
      if (hang) return;
      queueMicrotask(() => {
        const response = new EventEmitter();
        response.statusCode = status;
        response.headers = headers;
        response.socket = { authorized, encrypted };
        response.destroy = () => {
          observed.responseDestroyed = true;
          if (lateError)
            queueMicrotask(() =>
              response.emit("error", new Error("late stream error")),
            );
        };
        callback(response);
        if (hangBody) return;
        for (const chunk of chunks) response.emit("data", chunk);
        if (aborted) response.emit("aborted");
        else response.emit("end");
      });
    };
    return request;
  };
  return { impl, observed };
}

test("HTTPS adapter uses one exact authenticated endpoint with no redirect/proxy override", async () => {
  const { impl, observed } = mockRequest();
  const result = await requestRustFeatureOsvForTest('{"queries":[]}', {
    requestImpl: impl,
  });
  assert.equal(observed.url, endpoint);
  assert.equal(observed.options.rejectUnauthorized, true);
  assert.equal(observed.options.method, "POST");
  assert.equal(observed.options.agent, false);
  assert.equal(observed.options.headers["accept-encoding"], "identity");
  assert.equal(result.transportAuthenticityVerified, false);
});

for (const [name, config, options] of [
  ["redirect", { status: 302 }, {}],
  ["untrusted TLS", { authorized: false }, {}],
  ["plaintext socket", { encrypted: false }, {}],
  ["compressed response", { headers: { "content-encoding": "gzip" } }, {}],
  ["oversized response", { chunks: [Buffer.alloc(11)] }, { responseBytes: 10 }],
  ["aborted body", { aborted: true }, {}],
  ["timeout before headers", { hang: true }, { timeoutMs: 10 }],
  ["timeout while reading body", { hangBody: true }, { timeoutMs: 10 }],
  ["truncated content length", { headers: { "content-length": "10" } }, {}],
  ["rejected response late error", { status: 302, lateError: true }, {}],
])
  test(
    "HTTPS adapter rejects " + name + " and destroys owned request",
    async () => {
      const { impl, observed } = mockRequest(config);
      await assert.rejects(
        requestRustFeatureOsvForTest('{"queries":[]}', {
          requestImpl: impl,
          ...options,
        }),
      );
      assert.equal(observed.destroyed, true);
    },
  );

test("pre-aborted request never starts the transport", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    requestRustFeatureOsvForTest('{"queries":[]}', {
      signal: controller.signal,
      requestImpl: () => {
        calls++;
        throw new Error("unexpected request");
      },
    }),
  );
  assert.equal(calls, 0);
});

test("output inside the checkout, missing fixture transport and looser limits are rejected", async (t) => {
  const f = fixture(t);
  await assert.rejects(
    runRustFeatureAdvisoryFixture(
      { ...f.args, outputDirectory: f.root },
      { transport: empty },
    ),
  );
  assert.throws(() => runRustFeatureAdvisoryFixture(f.args));
  await assert.rejects(
    runRustFeatureAdvisoryFixture(f.args, {
      transport: empty,
      limits: { deadlineMs: 99999999 },
    }),
  );
});

test("CLI requires an explicit selected-registry query and denies arbitrary endpoints or bypass flags", () => {
  const argv = [
    "--repository-root",
    "/repo",
    "--scope",
    "pr1",
    "--collection-file",
    "/collection.json",
    "--collection-sha256",
    "a".repeat(64),
    "--output-directory",
    "/reports",
    "--mode",
    "query-selected-identities",
  ];
  assert.equal(parseRustFeatureRunnerArgs(argv).scope, "pr1");
  for (const bad of [
    argv.slice(0, -2),
    [...argv, "--url", endpoint],
    [...argv, "--allow-incomplete", "true"],
    [...argv, "--scope", "pr2"],
  ])
    assert.throws(() => parseRustFeatureRunnerArgs(bad));
});
