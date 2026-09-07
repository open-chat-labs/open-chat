import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const script = readFileSync(
  new URL("./validate-action-inbox-wiring.sh", import.meta.url),
  "utf8",
);
const inbox = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const relay = "rrkah-fqaaa-aaaaa-aaaaq-cai";
const localIndex = "r7inp-6aaaa-aaaaa-aaabq-cai";
const other = "rkp4c-7iaaa-aaaaa-aaaca-cai";

// Shapes from the three actual Rust query contracts. DFX JSON maps nat16/nat32
// to numbers, nat64 to strings, options to 0/1 arrays and null variants to objects.
function responses() {
  return {
    configuration: {
      Success: {
        app_id: 1,
        user_index_canister_id: relay,
        authorized_depositors: [relay],
        action_retention_millis: "604800000",
        action_capacity_fail_closed: true,
      },
    },
    action_inbox_canister: { Success: [inbox] },
    action_signing_keys: {
      Success: {
        signature_version: 4,
        purpose: "action_inbox_deposit",
        keys: [
          {
            key_id: Array(32).fill(7),
            public_key_pem:
              "fixture public metadata, not a trusted consumer pin",
            status: { Active: null },
            created_at: "1",
            verify_until: [],
          },
        ],
      },
    },
  };
}

function candid(value, field = "") {
  if (value === null) return "null";
  if (typeof value === "number")
    return `${value.toLocaleString("en-US").replaceAll(",", "_")} : ${field === "signature_version" ? "nat16" : "nat32"}`;
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") {
    if ([inbox, relay, localIndex, other].includes(value))
      return `principal ${JSON.stringify(value)}`;
    if (["created_at", "action_retention_millis"].includes(field))
      return `${value} : nat64`;
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (field === "verify_until")
      return value.length ? `opt ${candid(value[0])}` : "null";
    if (field === "Success")
      return value.length ? `opt ${candid(value[0])}` : "null";
    return `vec { ${value.map((entry) => candid(entry)).join("; ")} }`;
  }
  const entries = Object.entries(value);
  const variant = [
    "Success",
    "NotInitialised",
    "Active",
    "Staged",
    "VerifyOnly",
  ].includes(entries[0]?.[0]);
  return `${variant ? "variant" : "record"} { ${entries.map(([key, entry]) => (entry === null && variant ? key : `${key} = ${candid(entry, key)}`)).join("; ")} }`;
}

function run(options = {}) {
  const parent = realpathSync(tmpdir());
  const fixture = mkdtempSync(path.join(parent, "openchat-inbox-wiring-"));
  const shell =
    process.env.OC_TEST_BASH ??
    (process.platform === "win32"
      ? path.join(
          process.env.ProgramFiles ?? "C:/Program Files",
          "Git/bin/bash.exe",
        )
      : "bash");
  try {
    const actual = responses();
    options.change?.(actual);
    for (const [method, response] of Object.entries(actual)) {
      writeFileSync(
        path.join(fixture, `${method}.json`),
        options.raw?.[method] ?? JSON.stringify(response),
      );
      // A real pre-fix script receives Candid; the fixed script must request JSON.
      // This preserves the original numeric-prefix bug in the red run.
      writeFileSync(
        path.join(fixture, `${method}.idl`),
        `(${candid(response)})\n`,
      );
    }
    const filename = path.join(fixture, "validator with spaces & symbols.sh");
    writeFileSync(filename, script.replaceAll("\r\n", "\n"));
    const wrapper = `
${options.noNode ? "PATH=/not-a-tool-directory" : "PATH=/usr/bin:/bin:$PATH"}
dfx() {
  printf '%s\\n' "$*" >> "$OC_WIRING_EVENTS"
  if [[ "$6" == "$OC_WIRING_FAIL" ]]; then return 37; fi
  local output=idl
  local previous=''
  for word in "$@"; do
    if [[ "$previous" == --output ]]; then output="$word"; fi
    previous="$word"
  done
  case "$6" in
    configuration|action_inbox_canister|action_signing_keys) cat "$OC_WIRING_FIXTURE/$6.$output" ;;
    *) return 98 ;;
  esac
}
source "$1" fixture-network "$2" "$3" "$4" "$5"
`;
    const result = spawnSync(
      shell,
      [
        "--noprofile",
        "--norc",
        "-c",
        wrapper,
        "fixture",
        filename,
        inbox,
        relay,
        localIndex,
        options.appId ?? "1",
      ],
      {
        encoding: "utf8",
        timeout: 20_000,
        env: {
          ...process.env,
          OC_WIRING_FIXTURE: fixture.replaceAll("\\", "/"),
          OC_WIRING_EVENTS: path
            .join(fixture, "events.txt")
            .replaceAll("\\", "/"),
          OC_WIRING_FAIL: options.fail ?? "",
        },
      },
    );
    assert.ifError(result.error);
    const eventsPath = path.join(fixture, "events.txt");
    return {
      ...result,
      queries: existsSync(eventsPath)
        ? readFileSync(eventsPath, "utf8").trim().split(/\r?\n/u)
        : [],
      files: readdirSync(fixture),
    };
  } finally {
    const resolved = realpathSync(fixture);
    assert.equal(path.dirname(resolved), parent);
    assert.match(path.basename(resolved), /^openchat-inbox-wiring-/u);
    rmSync(resolved, { recursive: true, force: true });
  }
}

function reject(options, expectedQueries) {
  const result = run(options);
  assert.notEqual(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /wiring valid/u);
  if (expectedQueries !== undefined)
    assert.equal(result.queries.length, expectedQueries);
  return result;
}

test("actual wiring script accepts exact structured contracts and only issues JSON queries", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /action_inbox wiring valid: app=1/u);
  assert.match(result.stdout, /independently pinned allowlist/u);
  assert.equal(result.queries.length, 3);
  for (const query of result.queries)
    assert.match(query, /--query --output json$/u);
  assert.equal(
    result.files.length,
    8,
    "the validator must not create output/cache files",
  );
});

test("app 1 must not accept app 12", () =>
  reject(
    {
      change: (r) => {
        r.configuration.Success.app_id = 12;
      },
    },
    1,
  ));
test("signature v4 must not accept v40", () =>
  reject(
    {
      change: (r) => {
        r.action_signing_keys.Success.signature_version = 40;
      },
    },
    3,
  ));
test("typed Candid underscore formatting is normalized by DFX JSON, not parsed by grep", () => {
  const result = run({
    appId: "1000",
    change: (r) => {
      r.configuration.Success.app_id = 1000;
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.queries[0], /--output json$/u);
});

for (const [name, change, count] of [
  [
    "missing app id",
    (r) => {
      delete r.configuration.Success.app_id;
    },
    1,
  ],
  [
    "string app id",
    (r) => {
      r.configuration.Success.app_id = "1";
    },
    1,
  ],
  [
    "fractional app id",
    (r) => {
      r.configuration.Success.app_id = 1.1;
    },
    1,
  ],
  [
    "wrong relay field despite matching allowlist",
    (r) => {
      r.configuration.Success.user_index_canister_id = other;
    },
    1,
  ],
  [
    "missing allowlist",
    (r) => {
      delete r.configuration.Success.authorized_depositors;
    },
    1,
  ],
  [
    "empty allowlist",
    (r) => {
      r.configuration.Success.authorized_depositors = [];
    },
    1,
  ],
  [
    "extra authorized depositor",
    (r) => {
      r.configuration.Success.authorized_depositors.push(other);
    },
    1,
  ],
  [
    "duplicate authorized depositor",
    (r) => {
      r.configuration.Success.authorized_depositors.push(relay);
    },
    1,
  ],
  [
    "wrong route",
    (r) => {
      r.action_inbox_canister.Success = [other];
    },
    2,
  ],
  [
    "missing route",
    (r) => {
      r.action_inbox_canister.Success = [];
    },
    2,
  ],
  [
    "duplicate route option",
    (r) => {
      r.action_inbox_canister.Success.push(inbox);
    },
    2,
  ],
  [
    "wrong route type",
    (r) => {
      r.action_inbox_canister.Success = inbox;
    },
    2,
  ],
  [
    "wrong purpose with matching substring",
    (r) => {
      r.action_signing_keys.Success.purpose = "not_action_inbox_deposit";
    },
    3,
  ],
  [
    "string signature version",
    (r) => {
      r.action_signing_keys.Success.signature_version = "4";
    },
    3,
  ],
  [
    "missing signature version",
    (r) => {
      delete r.action_signing_keys.Success.signature_version;
    },
    3,
  ],
  [
    "no signing keys",
    (r) => {
      r.action_signing_keys.Success.keys = [];
    },
    3,
  ],
  [
    "no active key despite Active text",
    (r) => {
      r.action_signing_keys.Success.keys[0].status = { Staged: null };
      r.action_signing_keys.Success.keys[0].public_key_pem = "Active";
    },
    3,
  ],
  [
    "ambiguous key status",
    (r) => {
      r.action_signing_keys.Success.keys[0].status.Staged = null;
    },
    3,
  ],
  [
    "non-null active status",
    (r) => {
      r.action_signing_keys.Success.keys[0].status.Active = "text";
    },
    3,
  ],
  [
    "multiple active keys",
    (r) => {
      r.action_signing_keys.Success.keys.push({
        ...r.action_signing_keys.Success.keys[0],
        key_id: Array(32).fill(8),
      });
    },
    3,
  ],
  [
    "duplicate key identity",
    (r) => {
      r.action_signing_keys.Success.keys.push({
        ...r.action_signing_keys.Success.keys[0],
        status: { Staged: null },
      });
    },
    3,
  ],
  [
    "missing key id",
    (r) => {
      delete r.action_signing_keys.Success.keys[0].key_id;
    },
    3,
  ],
  [
    "out-of-range key byte",
    (r) => {
      r.action_signing_keys.Success.keys[0].key_id[0] = 256;
    },
    3,
  ],
  [
    "uninitialised keys",
    (r) => {
      r.action_signing_keys = { NotInitialised: null };
    },
    3,
  ],
  [
    "extra top-level variant",
    (r) => {
      r.configuration.Error = null;
    },
    1,
  ],
])
  test(`wiring rejects ${name}`, () => reject({ change }, count));

test("wiring accepts one active key beside a different staged key", () => {
  const result = run({
    change: (r) => {
      r.action_signing_keys.Success.keys.push({
        ...r.action_signing_keys.Success.keys[0],
        key_id: Array(32).fill(8),
        status: { Staged: null },
      });
    },
  });
  assert.equal(result.status, 0, result.stderr);
});

test("JSON string metadata cannot be mistaken for fields or structural delimiters", () => {
  const result = run({
    change: (r) => {
      r.action_signing_keys.Success.keys[0].public_key_pem =
        '{ "app_id": 12, "app_id": 1 } : [ { "Active": null } ]';
    },
  });
  assert.equal(result.status, 0, result.stderr);
});

const validConfiguration = JSON.stringify(responses().configuration);
for (const [label, raw] of [
  ["empty output", ""],
  ["malformed JSON", "{bad"],
  ["trailing response", '{"Success":{}} {"Success":{}}'],
  [
    "duplicate property",
    validConfiguration.replace('"app_id":1', '"app_id":12,"app_id":1'),
  ],
  [
    "escaped duplicate property",
    validConfiguration.replace('"app_id":1', '"app_id":12,"app\\u005fid":1'),
  ],
  ["oversized response", JSON.stringify({ message: "x".repeat(70_000) })],
  ["excessive nesting", "[".repeat(40) + "0" + "]".repeat(40)],
])
  test(`wiring rejects ${label}`, () => {
    const result = reject({ raw: { configuration: raw } }, 1);
    if (label.includes("duplicate"))
      assert.match(result.stderr, /duplicate fields/u);
  });

for (const method of [
  "configuration",
  "action_inbox_canister",
  "action_signing_keys",
]) {
  test(`failed ${method} query stops without later queries`, () =>
    reject(
      { fail: method },
      ["configuration", "action_inbox_canister", "action_signing_keys"].indexOf(
        method,
      ) + 1,
    ));
}

for (const appId of [
  "0",
  "-1",
  "1.1",
  "1_000",
  "4294967296",
  "1; echo unsafe",
]) {
  test(`invalid app id ${JSON.stringify(appId)} is rejected before querying`, () =>
    reject({ appId }, 0));
}

test("missing Node fails clearly before querying", () => {
  const result = run({ noNode: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Node\.js.*required/u);
  assert.deepEqual(result.queries, []);
});
