// Pure offline validation of a caller-supplied, byte-bound OSV transcript.
// No network/client/CLI, advisory authentication, freshness or release gate.
// https://google.github.io/osv.dev/post-v1-querybatch/ (ordered ID/modified results)
// https://google.github.io/osv.dev/post-v1-query/ (including token-only pages)
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  planRustFeatureAdvisories,
  RUST_ADVISORY_PLAN_LIMITS,
} from "./rust_feature_advisories.mjs";

export const RUST_ADVISORY_RESULT_LIMITS = Object.freeze({
  rounds: 64,
  responseBytes: 4 * 1024 * 1024,
  transcriptBytes: 32 * 1024 * 1024,
  tokenBytes: 8192,
  findings: 10000,
  jsonDepth: 64,
  jsonNodes: 1000000,
});
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const own = (value, key) => Object.hasOwn(value, key);
function fields(value, allowed, required, label) {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    `Invalid ${label}`,
  );
  assert.ok(
    Object.keys(value).every((key) => allowed.includes(key)) &&
      required.every((key) => own(value, key)),
    `Invalid ${label} fields`,
  );
}

// JSON.parse alone silently accepts duplicate keys. Check decoded keys (including
// escaped equivalents) and bounded nesting before accepting the parsed value.
function uniqueJson(source) {
  const value = JSON.parse(source);
  let pos = 0,
    nodes = 0;
  const whitespace = () => {
    while (/[\t\n\r ]/u.test(source[pos] ?? "x")) pos++;
  };
  const string = () => {
    const start = pos++;
    while (pos < source.length) {
      const ch = source[pos++];
      if (ch === "\\") pos++;
      else if (ch === '"') return JSON.parse(source.slice(start, pos));
    }
    assert.fail("Invalid JSON string");
  };
  const visit = (depth) => {
    assert.ok(
      depth <= RUST_ADVISORY_RESULT_LIMITS.jsonDepth,
      "JSON depth limit exceeded",
    );
    assert.ok(
      ++nodes <= RUST_ADVISORY_RESULT_LIMITS.jsonNodes,
      "JSON node limit exceeded",
    );
    whitespace();
    if (source[pos] === '"') {
      string();
      return;
    }
    if (source[pos] === "{" || source[pos] === "[") {
      const object = source[pos++] === "{";
      const end = object ? "}" : "]";
      const seen = new Set();
      whitespace();
      if (source[pos] === end) {
        pos++;
        return;
      }
      while (true) {
        whitespace();
        if (object) {
          const key = string();
          assert.ok(!seen.has(key), "Duplicate JSON key");
          seen.add(key);
          whitespace();
          pos++; // colon, grammar already validated by JSON.parse
        }
        visit(depth + 1);
        whitespace();
        if (source[pos++] === end) return;
      }
    }
    while (pos < source.length && !/[\s,}\]]/u.test(source[pos])) pos++;
  };
  visit(0);
  return value;
}
function rawJson(raw, expectedSha256, limit, label) {
  assert.ok(
    typeof raw === "string" || raw instanceof Uint8Array,
    `Missing raw ${label} bytes`,
  );
  const byteLength =
    typeof raw === "string" ? Buffer.byteLength(raw) : raw.byteLength;
  assert.ok(byteLength <= limit, `${label} byte limit exceeded`);
  const bytes = Buffer.from(raw);
  assert.match(
    expectedSha256 ?? "",
    /^[a-f0-9]{64}$/u,
    `Invalid ${label} SHA-256`,
  );
  assert.equal(sha(bytes), expectedSha256, `${label} SHA-256 mismatch`);
  const source = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  return { value: uniqueJson(source), bytes: bytes.length };
}
function modified(value) {
  const match =
    typeof value === "string" &&
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/u,
    );
  assert.ok(match, "Invalid vulnerability modified timestamp");
  const [, year, month, day, hour, minute, second, zone] = match;
  const y = Number(year),
    m = Number(month),
    d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  assert.ok(
    y > 0 &&
      m >= 1 &&
      m <= 12 &&
      d >= 1 &&
      d <= days[m - 1] &&
      Number(hour) < 24 &&
      Number(minute) < 60 &&
      Number(second) < 60 &&
      (zone === "Z" ||
        (Number(zone.slice(1, 3)) < 24 && Number(zone.slice(4)) < 60)),
    "Invalid vulnerability modified timestamp",
  );
}

// Each transcript entry contains method/url/status, raw requestJson/responseJson
// and each raw body's SHA-256. These caller-supplied pins establish consistency,
// not trusted transport: a caller must separately authenticate and date a capture.
// Subsequent batches must contain all still-pending queries in original order.
export function validateRustFeatureAdvisoryResults(profiles, transcript) {
  assert.ok(
    Array.isArray(profiles) &&
      profiles.length > 0 &&
      profiles.length <= RUST_ADVISORY_PLAN_LIMITS.profiles,
    "Invalid profiles",
  );
  let reportBytes = 0;
  for (const input of profiles) {
    fields(
      input,
      ["id", "reportJson", "sha256"],
      ["id", "reportJson", "sha256"],
      "profile envelope",
    );
    reportBytes += rawJson(
      input.reportJson,
      input.sha256,
      RUST_ADVISORY_PLAN_LIMITS.reportBytes,
      "Collector report",
    ).bytes;
    assert.ok(
      reportBytes <= RUST_ADVISORY_PLAN_LIMITS.totalBytes,
      "Report byte limit exceeded",
    );
  }
  const plan = planRustFeatureAdvisories(profiles);
  assert.ok(
    Array.isArray(transcript) &&
      transcript.length <= RUST_ADVISORY_RESULT_LIMITS.rounds,
    "Transcript round limit exceeded",
  );
  const states = plan.selected.map(({ queryIndex }) => ({
    queryIndex,
    token: undefined,
    tokens: new Set(),
    ids: new Set(),
  }));
  let pending = states;
  let transcriptBytes = 0;
  const findings = [],
    traces = [];
  for (const round of transcript) {
    assert.ok(pending.length, "Extra transcript after all queries completed");
    const envelopeFields = [
      "method",
      "url",
      "status",
      "requestJson",
      "requestSha256",
      "responseJson",
      "responseSha256",
    ];
    fields(round, envelopeFields, envelopeFields, "transcript envelope");
    assert.equal(round.method, plan.request.method, "Invalid request method");
    assert.equal(round.url, plan.request.url, "Invalid request URL");
    assert.equal(round.status, 200, "Unsuccessful HTTP response");
    const request = rawJson(
      round.requestJson,
      round.requestSha256,
      RUST_ADVISORY_PLAN_LIMITS.requestBytes,
      "Request",
    );
    const response = rawJson(
      round.responseJson,
      round.responseSha256,
      RUST_ADVISORY_RESULT_LIMITS.responseBytes,
      "Response",
    );
    transcriptBytes += request.bytes + response.bytes;
    assert.ok(
      transcriptBytes <= RUST_ADVISORY_RESULT_LIMITS.transcriptBytes,
      "Transcript byte limit exceeded",
    );
    const expected = {
      queries: pending.map(({ queryIndex, token }) => ({
        ...plan.request.body.queries[queryIndex],
        ...(token === undefined ? {} : { page_token: token }),
      })),
    };
    assert.deepEqual(
      request.value,
      expected,
      "Mismatched exact ordered request",
    );
    fields(response.value, ["results"], ["results"], "response");
    const results = response.value.results;
    assert.ok(
      Array.isArray(results) && results.length === pending.length,
      "Invalid ordered result count",
    );
    const next = [];
    results.forEach((result, index) => {
      fields(result, ["vulns", "next_page_token"], [], "result");
      const state = pending[index];
      if (own(result, "vulns")) {
        assert.ok(
          Array.isArray(result.vulns) &&
            result.vulns.length <= RUST_ADVISORY_RESULT_LIMITS.findings,
          "Invalid vulns list",
        );
        for (const vuln of result.vulns) {
          fields(vuln, ["id", "modified"], ["id", "modified"], "vulnerability");
          assert.ok(
            typeof vuln.id === "string" &&
              /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(vuln.id),
            "Invalid vulnerability ID",
          );
          modified(vuln.modified);
          assert.ok(
            !state.ids.has(vuln.id),
            "Duplicate finding within query/pages",
          );
          state.ids.add(vuln.id);
          assert.ok(
            findings.length < RUST_ADVISORY_RESULT_LIMITS.findings,
            "Finding count limit exceeded",
          );
          const { queryIndex, name, version, sourceClass, source, commit } =
            plan.selected[state.queryIndex];
          findings.push({
            queryIndex,
            name,
            version,
            ...(sourceClass === "git" ? { sourceClass, source, commit } : {}),
            id: vuln.id,
            modified: vuln.modified,
          });
        }
      }
      if (own(result, "next_page_token")) {
        const token = result.next_page_token;
        assert.ok(
          typeof token === "string" &&
            token.length > 0 &&
            Buffer.byteLength(token) <=
              RUST_ADVISORY_RESULT_LIMITS.tokenBytes &&
            !/[\u0000-\u0020\u007f]/u.test(token),
          "Invalid pagination token",
        );
        assert.ok(!state.tokens.has(token), "Repeated pagination token");
        state.tokens.add(token);
        state.token = token;
        next.push(state);
      }
    });
    traces.push({
      queryIndices: pending.map(({ queryIndex }) => queryIndex),
      requestSha256: round.requestSha256,
      responseSha256: round.responseSha256,
      requestBytes: request.bytes,
      responseBytes: response.bytes,
    });
    pending = next;
  }
  assert.equal(
    pending.length,
    0,
    "Incomplete pagination or missing initial response",
  );
  return {
    schemaVersion: 1,
    assessment: "offline-selected-rust-osv-transcript-validation",
    transcriptValid: true,
    responsesComplete: true,
    selectedNoKnownFindings: plan.selected.length > 0 && findings.length === 0,
    registryResponsesComplete: true,
    selectedRegistryNoKnownFindings:
      plan.selected.some((item) => item.sourceClass === "crates.io") &&
      !findings.some(
        (item) => plan.selected[item.queryIndex].sourceClass === "crates.io",
      ),
    gitIndexCoverageVerified: false,
    passed: false,
    releaseAcceptance: false,
    rootCompletenessVerified: false,
    wholeRepositoryCoverage: false,
    freshnessVerified: false,
    transportAuthenticityVerified: false,
    networkRequestsPerformed: false,
    advisoryCoverage: "not-proven",
    profiles: plan.profiles,
    selected: plan.selected,
    unqueried: plan.unqueried,
    findings,
    transcript: traces,
    limitations: [
      "This validates supplied transcript consistency, not service authenticity or freshness.",
      "Caller-selected roots, omitted edges and shipping-binary reachability are not proven.",
      "Canonical crates.io package/version and immutable Git commit queries are bound; path/other-registry identities remain unqueried.",
      "Git findings apply to a repository commit, not proven crate-level applicability; an empty response does not establish index coverage or security.",
      "Any finding is conservatively nonpass; no severity, withdrawal or applicability waiver is inferred.",
      "No network, security clearance, whole-repository audit or release acceptance is performed.",
    ],
  };
}
