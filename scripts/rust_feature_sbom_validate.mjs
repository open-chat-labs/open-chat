// Offline schema/graph validation for this repository's selected Rust SBOM exporter.
// Does not query advisories, discover dependencies or grant release acceptance.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMAS = Object.freeze({
  "bom-1.6.schema.json":
    "1ebcb88a2c845ecb6ff7bee7aeabdff9422cb0347f3d6875b241bd444b7e098f",
  "spdx.schema.json":
    "c87aa7bb5eb503d40b52ec6bf00de8045df15da7a13cea48d290cf6d36a8d2ea",
  "jsf-0.82.schema.json":
    "2faf5eb3651f2ae5f46091a131770d8d847bbd121139d19c85fc7051bfa58c46",
});
const AJV_VERSION = "6.15.0";
const AJV_INTEGRITY =
  "sha512-fgFx7Hfoq60ytK2c7DhnF8jIvzYgOMxfugjLOSMHjLIPgenqa7S7oaagATUq99mV6IYvN2tRmC0wnTYX6iPbMw==";
const MAX_BYTES = 32 * 1024 * 1024;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const decode = (bytes) =>
  new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
const bytesOf = (value) => {
  assert(
    typeof value === "string" || value instanceof Uint8Array,
    "Expected JSON bytes",
  );
  const bytes = Buffer.from(value);
  assert(
    bytes.length > 0 && bytes.length <= MAX_BYTES,
    "SBOM/schema byte limit",
  );
  return bytes;
};

export function verifyRustSbomSchemaBytes(name, value) {
  assert(Object.hasOwn(SCHEMAS, name), "Unreviewed schema");
  const schema = JSON.parse(decode(bytesOf(value)));
  // Normalize JSON formatting only; schema keys/values and their order remain pinned.
  assert.equal(
    hash(JSON.stringify(schema)),
    SCHEMAS[name],
    "Schema identity mismatch",
  );
  return schema;
}

let validateSchema;
function validator() {
  if (validateSchema) return validateSchema;
  const require = createRequire(
    new URL("../frontend/package.json", import.meta.url),
  );
  const installed = require("ajv/package.json");
  const lock = JSON.parse(
    readFileSync(
      new URL("../frontend/package-lock.json", import.meta.url),
      "utf8",
    ),
  );
  const locked = lock.packages["node_modules/ajv"];
  assert.equal(
    installed.version,
    AJV_VERSION,
    "Installed schema validator version changed",
  );
  assert.equal(
    locked?.version,
    AJV_VERSION,
    "Locked schema validator version changed",
  );
  assert.equal(
    locked?.integrity,
    AJV_INTEGRITY,
    "Locked schema validator integrity changed",
  );
  assert.equal(
    locked?.resolved,
    "https://registry.npmjs.org/ajv/-/ajv-" + AJV_VERSION + ".tgz",
  );
  const Ajv = require("ajv");
  const formats = require("ajv/lib/compile/formats").full;
  const ajv = new Ajv({
    allErrors: false,
    format: "full",
    // Draft-07 ignores siblings of $ref (the pinned schema has annotations and
    // one redundant type sibling). Do not apply the nonstandard extension.
    extendRefs: "ignore",
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false,
  });
  // The selected exporter emits ASCII URI references and no email contacts.
  // Validate that supported subset strictly instead of ignoring unknown formats.
  // This is not a general-purpose internationalized contact/IRI validator.
  ajv.addFormat(
    "iri-reference",
    (value) =>
      !/[^\x21-\x7e]|["<>\\^`{|}]/u.test(value) &&
      formats["uri-reference"].test(value),
  );
  ajv.addFormat(
    "idn-email",
    (value) => /^[\x21-\x7e]+$/u.test(value) && formats.email.test(value),
  );
  const schemas = Object.entries(SCHEMAS).map(([name]) =>
    verifyRustSbomSchemaBytes(
      name,
      readFileSync(new URL("./vendor/cyclonedx-1.6/" + name, import.meta.url)),
    ),
  );
  for (const schema of schemas) ajv.addSchema(schema);
  // Synchronous compilation with all references present; no loadSchema/network hook.
  validateSchema = ajv.getSchema(
    "http://cyclonedx.org/schema/bom-1.6.schema.json",
  );
  assert.equal(typeof validateSchema, "function", "Schema compilation failed");
  return validateSchema;
}

export function validateRustFeatureSbom(value) {
  const bytes = bytesOf(value);
  const bom = JSON.parse(decode(bytes));
  assert.equal(bom?.$schema, "http://cyclonedx.org/schema/bom-1.6.schema.json");
  assert.equal(bom?.specVersion, "1.6", "Expected CycloneDX 1.6");
  const validate = validator();
  assert(
    validate(bom),
    "Official CycloneDX schema rejected document: " +
      JSON.stringify(validate.errors),
  );
  assert(
    Array.isArray(bom.components) &&
      bom.components.length > 0 &&
      bom.components.length <= 8192,
    "Selected component bound",
  );
  assert(Array.isArray(bom.dependencies), "Missing selected dependency graph");
  const refs = new Set();
  for (const component of bom.components) {
    const ref = component["bom-ref"];
    assert(
      typeof ref === "string" && ref.length && !refs.has(ref),
      "Missing/duplicate component ref",
    );
    refs.add(ref);
  }
  const nodes = new Set();
  for (const edge of bom.dependencies) {
    assert(
      refs.has(edge.ref) && !nodes.has(edge.ref),
      "Unknown/duplicate graph node",
    );
    nodes.add(edge.ref);
    assert(
      Array.isArray(edge.dependsOn) &&
        new Set(edge.dependsOn).size === edge.dependsOn.length,
      "Invalid/duplicate dependency list",
    );
    for (const target of edge.dependsOn)
      assert(refs.has(target), "Dangling dependency ref");
  }
  assert.equal(nodes.size, refs.size, "Selected component missing from graph");
  return {
    assessment: "offline-selected-rust-sbom-schema-and-graph",
    officialSbomSchemaValidated: true,
    schemaVersion: "1.6",
    schemaHashes: { ...SCHEMAS },
    validatorVersion: AJV_VERSION,
    sha256: hash(bytes),
    componentCount: refs.size,
    advisoryAcceptance: false,
    releaseAcceptance: false,
    networkRequestsPerformed: false,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    assert.equal(
      process.argv.length,
      3,
      "Usage: node scripts/rust_feature_sbom_validate.mjs FILE",
    );
    const path = resolve(process.argv[2]);
    const stat = statSync(path);
    assert(
      stat.isFile() && stat.size > 0 && stat.size <= MAX_BYTES,
      "Expected bounded SBOM file",
    );
    console.log(JSON.stringify(validateRustFeatureSbom(readFileSync(path))));
  } catch (error) {
    console.error(
      "Offline selected Rust SBOM validation failed: " + error.message,
    );
    process.exitCode = 1;
  }
}
