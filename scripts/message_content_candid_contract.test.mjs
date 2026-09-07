import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const rust = read("backend/libraries/types/src/message_content.rs");
const candid = read("backend/libraries/types/can.did");
const aiActions = read("backend/libraries/types/src/ai_actions.rs");
const userIndexCandid = read("backend/canisters/user_index/api/can.did");

// A deliberately bounded source contract, not a Rust/Candid parser. Only the
// flat declarations used below are supported; unknown syntax fails closed.
// Generated-interface didc comparisons remain the semantic authority.
function body(source, language, kind, name) {
  const declaration =
    language === "rust"
      ? `^pub ${kind} ${name}\\s*\\{([^{}]*)^\\}`
      : `^type ${name}\\s*=\\s*${kind}\\s*\\{([^{}]*)\\}\\s*;`;
  const matches = [...source.matchAll(new RegExp(declaration, "gm"))];
  assert.equal(matches.length, 1, `expected one flat ${language} ${name}`);
  return matches[0][1];
}

function entries(text, separator, expression) {
  const parts = text.trim().split(separator);
  if (parts.at(-1).trim() === "") parts.pop();
  assert.ok(parts.length, "empty declaration");
  const result = new Map();
  for (const part of parts) {
    const match = expression.exec(part.trim());
    assert.ok(match, `unsupported declaration entry: ${part}`);
    const [, name, type] = match;
    assert.ok(!result.has(name), `duplicate declaration member: ${name}`);
    result.set(name, type?.replace(/\s+/gu, " ").trim() ?? "null");
  }
  return result;
}

function rustEntries(source, kind, name) {
  const text = body(source, "rust", kind, name)
    .replace(/\/\/[^\r\n]*/gu, "")
    .replace(/^\s*#\[serde\(default\)\]\s*$/gmu, "")
    .replace(/^\s*#\[ts\([^\r\n]*\)\]\s*$/gmu, "");
  return entries(
    text,
    ",",
    kind === "enum"
      ? /^([A-Za-z_]\w*)(?:\(([A-Za-z_]\w*)\))?$/u
      : /^pub ([a-z_]\w*)\s*:\s*([A-Za-z_]\w*(?:<[A-Za-z_]\w*>)?)$/u,
  );
}

function candidEntries(source, kind, name) {
  return entries(
    body(source, "candid", kind, name).replace(/\/\/[^\r\n]*/gu, ""),
    ";",
    /^([A-Za-z_]\w*)(?:\s*:\s*((?:(?:opt|vec)\s+)*[A-Za-z_]\w*))?$/u,
  );
}

function wireType(type) {
  const wrapped = /^(Option|Vec)<([A-Za-z_]\w*)>$/u.exec(type);
  if (wrapped) {
    return `${wrapped[1] === "Option" ? "opt" : "vec"} ${wireType(wrapped[2])}`;
  }
  assert.match(type, /^[A-Za-z_]\w*$/u, "unsupported Rust field type");
  return (
    { String: "text", ByteBuf: "blob", u32: "nat32", u64: "nat64" }[type] ??
    type
  );
}

const sorted = (map) =>
  [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
for (const name of ["MessageContentInitial", "MessageContent"]) {
  test(`${name} has exactly the Rust variants in shared Candid`, () => {
    const actualRust = rustEntries(rust, "enum", name);
    const actualCandid = candidEntries(candid, "variant", name);
    assert.deepEqual(
      [...actualCandid.keys()].sort(),
      [...actualRust.keys()].sort(),
    );
    // Other existing variants intentionally use different Rust/Candid alias names.
    assert.equal(actualCandid.get("ActionCard"), actualRust.get("ActionCard"));
  });
}

for (const name of [
  "ActionCardRow",
  "ActionCardContentInitial",
  "ActionCardContent",
]) {
  test(`${name} shared Candid fields and types match actual Rust`, () => {
    const expected = new Map(
      [...rustEntries(rust, "struct", name)].map(([field, type]) => [
        field,
        wireType(type),
      ]),
    );
    assert.deepEqual(
      sorted(candidEntries(candid, "record", name)),
      sorted(expected),
    );
  });
}

test("ActionCardState shared Candid states match actual Rust", () => {
  assert.deepEqual(
    sorted(candidEntries(candid, "variant", "ActionCardState")),
    sorted(rustEntries(rust, "enum", "ActionCardState")),
  );
});

test("shared AiAppId alias preserves the actual Rust integer width", () => {
  const aliases = [
    ...read("backend/libraries/types/src/ai_actions.rs").matchAll(
      /^pub type AiAppId = (u32|u64);$/gm,
    ),
  ];
  assert.equal(aliases.length, 1, "expected one supported Rust AiAppId alias");
  const sharedAliases = [
    ...candid.matchAll(/^type AiAppId\s*=\s*([A-Za-z_]\w*)\s*;$/gm),
  ];
  assert.equal(sharedAliases.length, 1, "expected one shared AiAppId alias");
  assert.equal(sharedAliases[0][1], wireType(aliases[0][1]));
});

test("bounded readers reject duplicate members and unsupported wire-changing syntax", () => {
  assert.throws(
    () => rustEntries("pub enum E {\n A, A,\n}", "enum", "E"),
    /duplicate/u,
  );
  assert.throws(
    () =>
      rustEntries(
        "pub struct R {\n pub a: bool, pub a: bool,\n}",
        "struct",
        "R",
      ),
    /duplicate/u,
  );
  for (const kind of ["variant", "record"]) {
    assert.throws(
      () => candidEntries(`type C = ${kind} { a: text; a: text; };`, kind, "C"),
      /duplicate/u,
    );
  }
  assert.throws(
    () =>
      rustEntries('pub enum E {\n #[serde(rename = "B")]\n A,\n}', "enum", "E"),
    /unsupported/u,
  );
  assert.throws(
    () =>
      candidEntries(
        "type C = record { a: record { b: text }; };",
        "record",
        "C",
      ),
    /expected one flat/u,
  );
});

test("AiActionDefinition user-index fields and types match actual Rust", () => {
  const expected = new Map(
    [...rustEntries(aiActions, "struct", "AiActionDefinition")].map(
      ([field, type]) => [field, wireType(type)],
    ),
  );
  assert.deepEqual(
    sorted(candidEntries(userIndexCandid, "record", "AiActionDefinition")),
    sorted(expected),
  );
});

function recipientWireStates() {
  // Only this enum's explicit per-variant renames are supported. Do not discard
  // arbitrary serde attributes in the general Rust reader above.
  const renamed = entries(
    body(aiActions, "rust", "enum", "AiActionRecipientScope"),
    ",",
    /^#\[serde\(rename\s*=\s*"([a-z_]+)"\)\]\s*([A-Z]\w*)$/u,
  );
  assert.equal(
    new Set(renamed.values()).size,
    renamed.size,
    "duplicate Rust recipient state",
  );
  return renamed;
}

test("AiActionRecipientScope preserves the actual serde wire labels", () => {
  const expected = [...recipientWireStates().keys()].sort();
  const actual = candidEntries(
    userIndexCandid,
    "variant",
    "AiActionRecipientScope",
  );
  assert.deepEqual([...actual.keys()].sort(), expected);
  assert.ok([...actual.values()].every((type) => type === "null"));
  // A PascalCase declaration looks plausible but is a different Candid variant.
  assert.throws(() =>
    assert.deepEqual([...recipientWireStates().values()].sort(), expected),
  );
});

// Mask strings and comments before examining braces or export calls. Nested
// block comments and escaped quotes must not invent methods or close a service.
function codeOnly(source) {
  let result = "";
  for (let i = 0; i < source.length; ) {
    const start = i;
    if (source.startsWith("//", i)) {
      while (i < source.length && source[i] !== "\n") i++;
    } else if (source.startsWith("/*", i)) {
      i += 2;
      let depth = 1;
      while (i < source.length && depth) {
        if (source.startsWith("/*", i)) {
          depth++;
          i += 2;
        } else if (source.startsWith("*/", i)) {
          depth--;
          i += 2;
        } else i++;
      }
      assert.equal(depth, 0, "unterminated block comment");
    } else if (source[i] === '"') {
      i++;
      while (i < source.length && source[i] !== '"') {
        i += source[i] === "\\" ? 2 : 1;
      }
      assert.ok(i < source.length, "unterminated string");
      i++;
    } else {
      result += source[i++];
      continue;
    }
    result += source.slice(start, i).replace(/[^\r\n]/gu, " ");
  }
  return result;
}

function rustMethods(source) {
  const code = codeOnly(source);
  assert.doesNotMatch(
    code,
    /#\s*\[/u,
    "conditional/annotated exports require explicit review",
  );
  const mains = [...code.matchAll(/\bfn\s+main\s*\(\s*\)\s*\{/gu)];
  const exports = [...code.matchAll(/\bcandid::export_service!\(\s*\)\s*;/gu)];
  assert.equal(mains.length, 1, "expected one API main");
  assert.equal(exports.length, 1, "expected one supported service export");
  const start = mains[0].index + mains[0][0].length;
  assert.ok(exports[0].index >= start);
  const methods = new Set();
  const declaration =
    /\bgenerate_candid_method(?:_no_args)?!\(\s*[A-Za-z_]\w*\s*,\s*([A-Za-z_]\w*)\s*,\s*(?:query|update)\s*\)\s*;/gu;
  // Some APIs generate TypeScript before export_service. That setup is not a
  // Candid export; still require every Candid call at main's top brace level.
  for (const call of code.matchAll(declaration)) {
    assert.ok(
      call.index >= start && call.index < exports[0].index,
      "out-of-order Candid export",
    );
    let depth = 0;
    for (const char of code.slice(start, call.index)) {
      if (char === "{") depth++;
      else if (char === "}") depth--;
      assert.ok(depth >= 0, "Candid export is outside main");
    }
    assert.equal(depth, 0, "conditional/nested Candid export");
    assert.ok(!methods.has(call[1]), `duplicate Rust method: ${call[1]}`);
    methods.add(call[1]);
  }
  const supportedMacros = new Set([
    "generate_candid_method",
    "generate_candid_method_no_args",
    "generate_ts_method",
    "export_service",
    "print",
  ]);
  for (const macro of code.matchAll(/\b([A-Za-z_]\w*)\s*!/gu)) {
    assert.ok(
      supportedMacros.has(macro[1]),
      `unsupported API macro: ${macro[1]}`,
    );
  }
  assert.equal(
    [...code.matchAll(/\bgenerate_candid_\w*\s*!/gu)].length,
    methods.size,
    "unsupported/out-of-order Candid export macro",
  );
  return [...methods].sort();
}

function serviceEntries(source) {
  const code = codeOnly(source);
  const services = [...code.matchAll(/\bservice\s*:\s*\{/gu)];
  assert.equal(services.length, 1, "expected one supported service block");
  let start = services[0].index + services[0][0].length;
  const stack = ["}"];
  const methods = new Map();
  const closing = { "{": "}", "(": ")", "[": "]" };
  for (let i = start; i < code.length; i++) {
    const char = code[i];
    if (char in closing) stack.push(closing[char]);
    else if ("})]".includes(char))
      assert.equal(stack.pop(), char, "unbalanced service delimiters");
    if ((char === ";" && stack.length === 1) || stack.length === 0) {
      const entry = code.slice(start, i).trim();
      if (entry) {
        const match =
          /^([A-Za-z_]\w*)\s*:\s*\([\s\S]*\)\s*->\s*\([\s\S]*\)(?:\s+(?:query|composite_query|oneway))?$/u.exec(
            entry,
          );
        assert.ok(match, `unsupported service method: ${entry}`);
        assert.ok(
          !methods.has(match[1]),
          `duplicate Candid method: ${match[1]}`,
        );
        methods.set(match[1], entry);
      } else assert.equal(stack.length, 0, "empty service entry");
      start = i + 1;
    }
    if (stack.length === 0) {
      assert.match(
        code.slice(i + 1),
        /^\s*;?\s*$/u,
        "unexpected content after service",
      );
      return methods;
    }
  }
  assert.fail("unterminated service block");
}

// Mirror the real checker's ./backend/*canisters/*/api/can.did selection rather
// than maintaining a canister allowlist that can silently omit a new interface.
const directory = (path) =>
  readdirSync(new URL(`../${path}/`, import.meta.url), { withFileTypes: true });
const interfaces = directory("backend")
  .filter((entry) => entry.isDirectory() && entry.name.endsWith("canisters"))
  .flatMap((parent) =>
    directory(`backend/${parent.name}`)
      .filter((entry) => entry.isDirectory())
      .map((entry) => `backend/${parent.name}/${entry.name}/api`),
  )
  .filter((path) => existsSync(new URL(`../${path}/can.did`, import.meta.url)))
  .sort();

test("method contracts cover the actual parity script's complete interface selection", () => {
  assert.match(
    read("scripts/validate-candid-matches-rust.sh"),
    /for canister_path in \.\/backend\/\*canisters\/\*\//u,
  );
  assert.ok(
    interfaces.length >= 25,
    "do not lose the current 25-interface coverage",
  );
});

for (const path of interfaces) {
  test(`${path}: Candid method names match actual Rust exports`, () => {
    assert.deepEqual(
      [...serviceEntries(read(`${path}/can.did`)).keys()].sort(),
      rustMethods(read(`${path}/src/main.rs`)),
    );
  });
}

test("actual user-index omission is rejected without editing product schema", () => {
  const methods = serviceEntries(userIndexCandid);
  const missing = "c2c_redeem_ai_app_private_match_capability";
  assert.ok(
    methods.delete(missing),
    "the repaired method must exist before mutation",
  );
  const fixture = `service : { ${[...methods.values()].join(";\n")}; }`;
  assert.throws(() =>
    assert.deepEqual(
      [...serviceEntries(fixture).keys()].sort(),
      rustMethods(read("backend/canisters/user_index/api/src/main.rs")),
    ),
  );
});

test("method readers handle inline records, comments and intentional empty services", () => {
  const source =
    '/* service : { /* nested } */ } */ service : {\n a: (record { "}" : text; b : text }) -> (record {}) query; // }\n b: () -> (); }';
  assert.deepEqual([...serviceEntries(source).keys()], ["a", "b"]);
  const main = (calls) => `fn main() { ${calls} candid::export_service!(); }`;
  assert.deepEqual(
    rustMethods(main("/* generate_candid_method!(p, fake, query); */")),
    [],
  );
  assert.deepEqual([...serviceEntries("service : {}").keys()], []);
  assert.deepEqual(
    rustMethods(main("generate_candid_method_no_args!(p, a, query);")),
    ["a"],
  );
  for (const calls of [
    "generate_candid_method!(p, a, query); generate_candid_method!(p, a, update);",
    "generate_candid_method_other!(p, a, query);",
    "generate_candid_method!(p, a, unknown);",
    "if false { generate_candid_method!(p, a, query); }",
    "unrecognized_export!(p, a);",
  ])
    assert.throws(() => rustMethods(main(calls)));
  for (const source of [
    "service : { a: () -> (); a: () -> (); }",
    "service : { a: (record {}) -> ();",
    "service : { a: [text] -> (); }",
    "service : {} service : {}",
    "/* unclosed service : {}",
    'service : { a: ("unclosed) -> (); }',
  ])
    assert.throws(() => serviceEntries(source));
});
