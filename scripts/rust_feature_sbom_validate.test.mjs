import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  validateRustFeatureSbom,
  verifyRustSbomSchemaBytes,
} from "./rust_feature_sbom_validate.mjs";

function fixture() {
  return {
    $schema: "http://cyclonedx.org/schema/bom-1.6.schema.json",
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      properties: [{ name: "test:note", value: "نص / Unicode retained" }],
    },
    components: [
      {
        type: "library",
        "bom-ref": "example",
        name: "example",
        version: "1.0.0",
        hashes: [{ alg: "SHA-256", content: "a".repeat(64) }],
        purl: "pkg:cargo/example@1.0.0",
        externalReferences: [
          { type: "vcs", url: "https://example.invalid/repo?tag=v1#abcdef" },
        ],
      },
    ],
    dependencies: [{ ref: "example", dependsOn: [] }],
  };
}
test("validates official CycloneDX schema offline without granting audit or release acceptance", () => {
  const bytes = Buffer.from(JSON.stringify(fixture()));
  const result = validateRustFeatureSbom(bytes);
  assert.equal(result.officialSbomSchemaValidated, true);
  assert.equal(result.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(result.advisoryAcceptance, false);
  assert.equal(result.releaseAcceptance, false);
  assert.equal(result.networkRequestsPerformed, false);
  assert.equal(result.validatorVersion, "6.15.0");
});
for (const [label, mutate] of [
  [
    "wrong format",
    (v) => {
      v.bomFormat = "other";
    },
  ],
  [
    "wrong schema version",
    (v) => {
      v.specVersion = "1.5";
    },
  ],
  [
    "unexpected root field",
    (v) => {
      v.unrecognized = true;
    },
  ],
  [
    "missing component name",
    (v) => {
      delete v.components[0].name;
    },
  ],
  [
    "invalid component type",
    (v) => {
      v.components[0].type = "imaginary";
    },
  ],
  [
    "unexpected component field",
    (v) => {
      v.components[0].unrecognized = true;
    },
  ],
  [
    "invalid hash length",
    (v) => {
      v.components[0].hashes[0].content = "abc";
    },
  ],
  [
    "invalid hash characters",
    (v) => {
      v.components[0].hashes[0].content = "z".repeat(64);
    },
  ],
  [
    "non-string property",
    (v) => {
      v.metadata.properties[0].value = false;
    },
  ],
  [
    "invalid timestamp",
    (v) => {
      v.metadata.timestamp = "2026-02-30T12:00:00Z";
    },
  ],
  [
    "malformed URI",
    (v) => {
      v.components[0].externalReferences[0].url = "https://example.invalid/a b";
    },
  ],
  [
    "malformed escape",
    (v) => {
      v.components[0].externalReferences[0].url = "https://example.invalid/%zz";
    },
  ],
  [
    "unsupported non-ASCII URI",
    (v) => {
      v.components[0].externalReferences[0].url = "https://example.invalid/ع";
    },
  ],
  [
    "invalid SPDX identifier",
    (v) => {
      v.components[0].licenses = [{ license: { id: "not-a-license" } }];
    },
  ],
  [
    "duplicate component identity",
    (v) => {
      v.components.push({ ...v.components[0], name: "other" });
    },
  ],
  [
    "missing component identity",
    (v) => {
      delete v.components[0]["bom-ref"];
    },
  ],
  [
    "dangling dependency",
    (v) => {
      v.dependencies[0].dependsOn = ["missing"];
    },
  ],
  [
    "duplicate dependency",
    (v) => {
      v.dependencies[0].dependsOn = ["example", "example"];
    },
  ],
  [
    "missing graph node",
    (v) => {
      v.dependencies = [];
    },
  ],
  [
    "duplicate graph node",
    (v) => {
      v.dependencies.push({ ref: "example", dependsOn: ["example"] });
    },
  ],
]) {
  test("rejects " + label, () => {
    const value = fixture();
    mutate(value);
    assert.throws(() => validateRustFeatureSbom(JSON.stringify(value)));
  });
}
test("valid SPDX identifiers resolve from the pinned local reference schema", () => {
  const value = fixture();
  value.components[0].licenses = [{ license: { id: "Apache-2.0" } }];
  assert.equal(
    validateRustFeatureSbom(JSON.stringify(value)).officialSbomSchemaValidated,
    true,
  );
});
test("invalid JSON, UTF-8 and oversized input fail before validation", () => {
  for (const value of [
    "{",
    Buffer.from([0xff]),
    Buffer.alloc(32 * 1024 * 1024 + 1),
  ])
    assert.throws(() => validateRustFeatureSbom(value));
});
test("schema identities fail closed and checkout formatting is immaterial", () => {
  const name = "bom-1.6.schema.json";
  const bytes = readFileSync(
    new URL("./vendor/cyclonedx-1.6/" + name, import.meta.url),
  );
  const schema = verifyRustSbomSchemaBytes(name, bytes);
  assert.deepEqual(
    verifyRustSbomSchemaBytes(
      name,
      JSON.stringify(schema, null, 2).replaceAll("\n", "\r\n"),
    ),
    schema,
  );
  schema.additionalProperties = true;
  assert.throws(() => verifyRustSbomSchemaBytes(name, JSON.stringify(schema)));
  assert.throws(() =>
    verifyRustSbomSchemaBytes("unreviewed.schema.json", bytes),
  );
});
