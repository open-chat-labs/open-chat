import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertReviewedSourceFingerprint,
  featureOwnedFiles,
  reviewFeatureSeeds,
  seedSourceFingerprint,
  sourceReviewFingerprintFromBytes,
} from "./npm_feature_seed_review.mjs";

test("source review accepts CRLF/LF equivalence but rejects real content or source-set changes", () => {
  const path = "frontend/app/src/model.ts";
  const lf = Buffer.from('import model from "model";\nconst label = "مبلغ";\n');
  const crlf = Buffer.from(lf.toString("utf8").replaceAll("\n", "\r\n"));
  const fingerprint = sourceReviewFingerprintFromBytes([[path, lf]]);
  const review = {
    textIdentity: "utf8-lf",
    snapshots: [{ sha256: fingerprint.sha256 }],
  };
  assert.deepEqual(
    sourceReviewFingerprintFromBytes([[path, crlf]]),
    fingerprint,
  );
  assertReviewedSourceFingerprint(fingerprint, review);
  for (const entries of [
    [
      [
        path,
        Buffer.from(
          lf.toString("utf8").replace("const label =", "const changed ="),
        ),
      ],
    ],
    [[path, Buffer.concat([lf, Buffer.from(" ")])]],
    [[path, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), lf])]],
    [[path, Buffer.from(lf.toString("utf8").replaceAll("\n", "\r"))]],
    [
      [path, lf],
      ["frontend/app/src/added.ts", Buffer.from("export {};\n")],
    ],
  ]) {
    assert.throws(
      () =>
        assertReviewedSourceFingerprint(
          sourceReviewFingerprintFromBytes(entries),
          review,
        ),
      /source set changed/u,
    );
  }
});

test("source fingerprint rejects malformed UTF-8, duplicate paths and ambiguous normalization labels", () => {
  const path = "frontend/app/src/model.ts";
  for (const bytes of [
    Buffer.from([0xff]),
    Buffer.from([0xc3]),
    Buffer.from([0xc0, 0xaf]),
  ])
    assert.throws(
      () => sourceReviewFingerprintFromBytes([[path, bytes]]),
      /encoded data/u,
    );
  assert.throws(
    () => sourceReviewFingerprintFromBytes([[path, "source"]]),
    /UTF-8 bytes/u,
  );
  assert.throws(
    () =>
      sourceReviewFingerprintFromBytes([
        [path, Buffer.from("a")],
        [path, Buffer.from("b")],
      ]),
    /duplicate/u,
  );
  const fingerprint = sourceReviewFingerprintFromBytes([
    [path, Buffer.from("a")],
  ]);
  for (const textIdentity of [undefined, "raw-bytes", "utf8-nfc"])
    assert.throws(
      () =>
        assertReviewedSourceFingerprint(fingerprint, {
          textIdentity,
          snapshots: [{ sha256: fingerprint.sha256 }],
        }),
      /unsupported source fingerprint/u,
    );
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("all dedicated model build and runtime helpers participate in ownership discovery", () => {
  const expected = readdirSync(resolve(root, "frontend/app"))
    .filter(
      (name) =>
        /^transformersWebGpu.*\.mjs$/.test(name) &&
        !/\.(?:test|spec)\./.test(name),
    )
    .map((name) => `frontend/app/${name}`)
    .sort();
  assert(
    expected.length >= 11,
    "the qualified model helper set must not disappear",
  );
  const owned = featureOwnedFiles(root, "pr1-model-npm");
  assert.deepEqual(
    owned.filter((file) => file.startsWith("frontend/app/transformersWebGpu")),
    expected,
  );
  assert.equal(
    new Set(owned).size,
    owned.length,
    "dedicated helpers must not be counted twice",
  );
  assert(
    !featureOwnedFiles(root, "pr2-app-card-ocr-npm").some((file) =>
      expected.includes(file),
    ),
  );
});

test("the configurable catalog belongs only to the model feature source inventory", () => {
  const owned = featureOwnedFiles(root, "pr1-model-npm");
  const appOwned = featureOwnedFiles(root, "pr2-app-card-ocr-npm");
  const config = JSON.parse(
    readFileSync(resolve(root, "scripts/npm_feature_scope.pr1.json"), "utf8"),
  );
  const fingerprint = seedSourceFingerprint(root, config);
  for (const file of [
    "frontend/app/src/utils/webGpuModelCatalog.ts",
    "frontend/app/src/stores/webGpuModelCatalog.ts",
    "frontend/app/src/components_shared/WebGpuModelCatalogSettings.svelte",
  ]) {
    assert(owned.includes(file), file);
    assert(fingerprint.files.includes(file), file);
    assert(!appOwned.includes(file), file);
  }
});

for (const helper of [
  "OrtSessionConfig",
  "QwenGenerationGraph",
  "QwenGenerationRuntime",
  "QwenVisionGeometry",
  "QwenVisionGraph",
  "QwenVisionSession",
  "FeatureFlag",
]) {
  test(`model helper ${helper} cannot change outside the source-review fingerprint`, () => {
    const file = `frontend/app/transformersWebGpu${helper}.mjs`;
    const config = JSON.parse(
      readFileSync(resolve(root, "scripts/npm_feature_scope.pr1.json"), "utf8"),
    );
    const actual = seedSourceFingerprint(root, config);
    assert(featureOwnedFiles(root, config.scopeId).includes(file));
    assert(actual.files.includes(file));
    const changed = sourceReviewFingerprintFromBytes(
      actual.files.map((entry) => [
        entry,
        Buffer.concat([
          readFileSync(resolve(root, entry)),
          entry === file
            ? Buffer.from("// real helper change\n")
            : Buffer.alloc(0),
        ]),
      ]),
    );
    assert.notEqual(changed.sha256, actual.sha256);
    assert.throws(
      () =>
        assertReviewedSourceFingerprint(changed, {
          textIdentity: actual.textIdentity,
          snapshots: [{ sha256: actual.sha256 }],
        }),
      /source set changed/u,
    );
  });
}

test("dedicated session transform participates in model ownership and source fingerprint", () => {
  const file = "frontend/app/transformersWebGpuSequentialSessions.mjs";
  const config = JSON.parse(
    readFileSync(resolve(root, "scripts/npm_feature_scope.pr1.json"), "utf8"),
  );
  assert(featureOwnedFiles(root, config.scopeId).includes(file));
  const actual = seedSourceFingerprint(root, config);
  assert(actual.files.includes(file));
  const changed = sourceReviewFingerprintFromBytes(
    actual.files.map((entry) => [
      entry,
      Buffer.concat([
        readFileSync(resolve(root, entry)),
        entry === file
          ? Buffer.from("// session transform changed\n")
          : Buffer.alloc(0),
      ]),
    ]),
  );
  assert.notEqual(changed.sha256, actual.sha256);
  assert.throws(
    () =>
      assertReviewedSourceFingerprint(changed, {
        textIdentity: actual.textIdentity,
        snapshots: [{ sha256: actual.sha256 }],
      }),
    /source set changed/u,
  );
});

// PR2 scope cannot silently disappear by deleting only its seed configuration.
const scopes = [
  "pr1",
  ...(existsSync(resolve(root, ".github/workflows/openchat_pr2_security.yaml"))
    ? ["pr2"]
    : []),
];
for (const scope of scopes) {
  const config = JSON.parse(
    readFileSync(
      resolve(root, `scripts/npm_feature_scope.${scope}.json`),
      "utf8",
    ),
  );
  test(`${scope}: reviewed feature roots match source ownership and owning declarations`, () => {
    const result = reviewFeatureSeeds(root, config);
    assert.equal(result.roots, scope === "pr1" ? 18 : 17);
    assert.equal(result.advisoryAcceptance, false);
    assert.equal(result.sourceTextIdentity, "utf8-lf");
  });
  test(`${scope}: exact current source fingerprints match both Linux LF and Windows CRLF bytes`, () => {
    const actual = seedSourceFingerprint(root, config);
    const entries = actual.files.map((file) => [
      file,
      readFileSync(resolve(root, file)),
    ]);
    const lf = entries.map(([file, bytes]) => [
      file,
      Buffer.from(
        new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
          .decode(bytes)
          .replaceAll("\r\n", "\n"),
      ),
    ]);
    const crlf = lf.map(([file, bytes]) => [
      file,
      Buffer.from(bytes.toString("utf8").replaceAll("\n", "\r\n")),
    ]);
    assert.deepEqual(sourceReviewFingerprintFromBytes(lf), actual);
    assert.deepEqual(sourceReviewFingerprintFromBytes(crlf), actual);
    assertReviewedSourceFingerprint(actual, config.sourceReview);
    const changed = entries.map(([file, bytes]) => [file, Buffer.from(bytes)]);
    changed[0][1] = Buffer.concat([
      changed[0][1],
      Buffer.from("// real content change\n"),
    ]);
    assert.throws(
      () =>
        assertReviewedSourceFingerprint(
          sourceReviewFingerprintFromBytes(changed),
          config.sourceReview,
        ),
      /source set changed/u,
    );
  });
  for (const seed of config.seeds) {
    test(`${scope}: cannot silently remove root ${seed.name ?? seed.location}`, () => {
      const changed = structuredClone(config);
      changed.seeds = changed.seeds.filter(
        (value) => JSON.stringify(value) !== JSON.stringify(seed),
      );
      assert.throws(
        () => reviewFeatureSeeds(root, changed),
        /root set changed/,
      );
    });
  }
  for (const [name, mutate, error] of [
    [
      "missing source text identity",
      (c) => delete c.sourceReview.textIdentity,
      /unsupported source fingerprint/,
    ],
    [
      "legacy raw source text identity",
      (c) => (c.sourceReview.textIdentity = "raw-bytes"),
      /unsupported source fingerprint/,
    ],
    [
      "unreviewed root",
      (c) => c.seeds.push({ kind: "edge", from: "", name: "borc" }),
      /root set changed/,
    ],
    [
      "missing ownership",
      (c) => delete c.seeds[0].evidence,
      /ownership evidence/,
    ],
    [
      "stale ownership anchor",
      (c) => (c.seeds[0].evidence[0].contains = "not-a-real-feature-import"),
      /anchor changed/,
    ],
    [
      "escaped ownership path",
      (c) => (c.seeds[0].evidence[0].file = "frontend/../../private"),
      /unsafe provenance/,
    ],
    [
      "changed source fingerprint",
      (c) => (c.sourceReview.snapshots = []),
      /source set changed/,
    ],
    [
      "false inventory approval",
      (c) => (c.status = "approved"),
      /inventory status/,
    ],
  ]) {
    test(`${scope}: rejects ${name}`, () => {
      const changed = structuredClone(config);
      mutate(changed);
      assert.throws(() => reviewFeatureSeeds(root, changed), error);
    });
  }
}
