import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const scopes = new Set(["pr1", "pr2"]);

export function inheritedFormattingDigest(source) {
  if (typeof source !== "string")
    throw new TypeError("Formatting source must be text");
  // Match Git's checkout normalization only. Never trim or normalize other whitespace.
  return createHash("sha256")
    .update(source.replaceAll("\r\n", "\n"), "utf8")
    .digest("hex");
}

function check(condition, message) {
  if (!condition)
    throw new Error(`Invalid inherited formatting registry: ${message}`);
}

function canonicalPath(path) {
  return (
    typeof path === "string" &&
    path.startsWith("frontend/") &&
    !/[\\\x00*?\[\]]/u.test(path) &&
    path
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

function inheritedEdits(proof) {
  if (
    !proof ||
    !Array.isArray(proof.baseEditSha256s) ||
    !Array.isArray(proof.candidateEditSha256s) ||
    proof.baseEditSha256s.length === 0 ||
    proof.candidateEditSha256s.length === 0 ||
    ![...proof.baseEditSha256s, ...proof.candidateEditSha256s].every((hash) =>
      SHA256.test(hash),
    )
  ) {
    return false;
  }
  const remaining = new Map();
  for (const hash of proof.baseEditSha256s)
    remaining.set(hash, (remaining.get(hash) ?? 0) + 1);
  for (const hash of proof.candidateEditSha256s) {
    const count = remaining.get(hash) ?? 0;
    if (!count) return false;
    remaining.set(hash, count - 1);
  }
  return true;
}

// The factory permits isolated fixture tests. Production callers use the fixed-registry
// classifyInheritedFormatting export below, not a caller-supplied exemption registry.
export function createInheritedFormattingChecker(registry) {
  check(registry?.schemaVersion === 1, "unsupported schema");
  check(
    registry.normalization === "CRLF-to-LF-only",
    "unsupported normalization",
  );
  check(
    Array.isArray(registry.records) && registry.records.length > 0,
    "records missing",
  );
  const records = new Map();
  for (const original of registry.records) {
    const record = structuredClone(original);
    check(
      scopes.has(record.scope) && canonicalPath(record.path),
      "scope/path is not exact",
    );
    check(COMMIT.test(record.baseCommit), "full upstream commit required");
    check(
      SHA256.test(record.baseSha256) && SHA256.test(record.candidateSha256),
      "source digests missing",
    );
    check(
      typeof record.justification === "string" &&
        record.justification.trim().length > 0,
      "review justification missing",
    );
    check(
      /^\d+\.\d+\.\d+$/u.test(record.formatter?.prettierVersion ?? "") &&
        /^\d+\.\d+\.\d+$/u.test(record.formatter?.sveltePluginVersion ?? "") &&
        SHA256.test(record.formatter?.configSha256 ?? ""),
      "formatter identity missing",
    );
    check(
      inheritedEdits(record.proof),
      "candidate formatting edits are not all inherited",
    );
    const key = `${record.scope}:${record.path}`;
    check(!records.has(key), "duplicate scope/path");
    records.set(key, record);
  }
  return (input) => {
    const reject = (reason) => ({ accepted: false, reason });
    if (!input || !scopes.has(input.scope) || !canonicalPath(input.path))
      return reject("invalid-input");
    const key = `${input.scope}:${input.path}`;
    const record = records.get(key);
    if (!record) return reject("unreviewed-path");
    if (input.baseCommit !== record.baseCommit)
      return reject("base-commit-drift");
    if (
      typeof input.baseSource !== "string" ||
      typeof input.candidateSource !== "string" ||
      typeof input.formatter?.configSource !== "string"
    )
      return reject("missing-source");
    if (inheritedFormattingDigest(input.baseSource) !== record.baseSha256)
      return reject("base-content-drift");
    if (
      inheritedFormattingDigest(input.candidateSource) !==
      record.candidateSha256
    )
      return reject("candidate-content-drift");
    if (
      input.formatter.prettierVersion !== record.formatter.prettierVersion ||
      input.formatter.sveltePluginVersion !==
        record.formatter.sveltePluginVersion
    )
      return reject("formatter-version-drift");
    if (
      inheritedFormattingDigest(input.formatter.configSource) !==
      record.formatter.configSha256
    )
      return reject("formatter-config-drift");
    return {
      accepted: true,
      reason: "exact-reviewed-inherited-formatting",
      reviewId: key,
      baseCommit: record.baseCommit,
      candidateSha256: record.candidateSha256,
      justification: record.justification,
    };
  };
}

const registry = JSON.parse(
  readFileSync(
    new URL("./frontend_format_inherited.json", import.meta.url),
    "utf8",
  ),
);

// Call only after the normal formatter reports a mismatch. This does not make an
// unformatted file generally acceptable; it recognizes one exact reviewed pair.
export const classifyInheritedFormatting =
  createInheritedFormattingChecker(registry);
