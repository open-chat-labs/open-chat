#!/usr/bin/env bash
# Read-only, fail-closed validation for a deployed generic action inbox. No canister state is changed.
# Requires Node.js and the repository's dfx (0.31.0-beta.1 supports --output json).
# DFX owns Candid decoding, including typed/underscore-formatted numeric values:
# https://legacy.internetcomputer.org/docs/building-apps/developer-tools/dfx/dfx-canister#json-output
set -euo pipefail

NETWORK=${1:?"usage: validate-action-inbox-wiring.sh <dfx-network> [action-inbox-id] [user-index-id] [local-user-index-id] <app-id>"}
command -v node >/dev/null 2>&1 || { echo "Node.js is required to validate structured dfx JSON responses" >&2; exit 1; }
ACTION_INBOX_ID=${2:-$(dfx canister --network "$NETWORK" id action_inbox)}
USER_INDEX_ID=${3:-$(dfx canister --network "$NETWORK" id user_index)}
LOCAL_USER_INDEX_ID=${4:-$(dfx canister --network "$NETWORK" id local_user_index)}
APP_ID=${5:?"the immutable registered app id is required"}

for value in "$ACTION_INBOX_ID" "$USER_INDEX_ID" "$LOCAL_USER_INDEX_ID"; do
  test -n "$value" || { echo "required canister id is empty" >&2; exit 1; }
done
test "$ACTION_INBOX_ID" != "$USER_INDEX_ID" || { echo "action_inbox and user_index ids must differ" >&2; exit 1; }
if [[ ! "$APP_ID" =~ ^[1-9][0-9]{0,9}$ ]] || (( APP_ID > 4294967295 )); then
  echo "app id must be a positive nat32 integer" >&2
  exit 1
fi

validate_response() {
  # Responses are public discovery metadata, never credentials. Keep them out of
  # command arguments and diagnostics, and create no temporary files.
  OC_WIRING_RESPONSE="$2" node - "$1" "$APP_ID" "$USER_INDEX_ID" "$ACTION_INBOX_ID" <<'NODE'
const [kind, appId, relay, inbox] = process.argv.slice(2);
function requireValue(ok, message) { if (!ok) throw new Error(message); }
function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function nat64(value) {
  return typeof value === "string" && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n;
}
try {
  const text = process.env.OC_WIRING_RESPONSE ?? "";
  requireValue(Buffer.byteLength(text, "utf8") <= 65536, "response exceeds 64 KiB");
  const response = JSON.parse(text);
  // JSON.parse validates syntax but otherwise silently keeps the last duplicate
  // key. Scan only structural tokens after parsing to reject duplicate decoded
  // keys (including escaped aliases) and deeply nested responses. This is not a
  // Candid parser; strings containing braces/colons remain one JSON token.
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/gu) ?? [];
  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "{" || token === "[") {
      stack.push(token === "{" ? new Set() : null);
      requireValue(stack.length <= 32, "response nesting exceeds 32 levels");
    } else if (token === "}" || token === "]") {
      stack.pop();
    } else if (token.startsWith('"') && tokens[i + 1] === ":") {
      const key = JSON.parse(token);
      const keys = stack.at(-1);
      requireValue(keys instanceof Set && !keys.has(key), "response contains duplicate fields");
      keys.add(key);
    }
  }
  requireValue(record(response) && Object.keys(response).length === 1 && Object.hasOwn(response, "Success"), "expected one Success variant");
  const value = response.Success;
  if (kind === "configuration") {
    requireValue(record(value), "expected configuration record");
    requireValue(Number.isInteger(value.app_id) && value.app_id === Number(appId), "action_inbox is not bound to the expected app id");
    requireValue(value.user_index_canister_id === relay, "action_inbox has an unexpected UserIndex");
    requireValue(Array.isArray(value.authorized_depositors) && value.authorized_depositors.length === 1 && value.authorized_depositors[0] === relay, "action_inbox must authorize only the expected UserIndex relay");
  } else if (kind === "route") {
    requireValue(Array.isArray(value) && value.length === 1 && value[0] === inbox, "local_user_index is not routed to the expected action_inbox");
  } else if (kind === "keys") {
    requireValue(record(value), "expected action-signing metadata record");
    requireValue(value.signature_version === 4, "user_index does not advertise signature version 4");
    requireValue(value.purpose === "action_inbox_deposit", "user_index does not expose the dedicated action-inbox signing-key purpose");
    // The actual keyring permits at most three distinct, 32-byte key identities.
    // This validates metadata shape/status, NOT public-key trust or a signature.
    requireValue(Array.isArray(value.keys) && value.keys.length >= 1 && value.keys.length <= 3, "invalid action-signing key list");
    let active = 0;
    const identities = new Set();
    for (const key of value.keys) {
      requireValue(record(key) && record(key.status) && Object.keys(key.status).length === 1, "invalid action-signing key status");
      const status = Object.keys(key.status)[0];
      requireValue(["Active", "Staged", "VerifyOnly"].includes(status) && key.status[status] === null, "invalid action-signing key status");
      requireValue(Array.isArray(key.key_id) && key.key_id.length === 32 && key.key_id.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255), "invalid action-signing key identity");
      const identity = key.key_id.join(",");
      requireValue(!identities.has(identity), "duplicate action-signing key identity");
      identities.add(identity);
      requireValue(typeof key.public_key_pem === "string" && key.public_key_pem.trim().length > 0, "missing public signing-key metadata");
      requireValue(nat64(key.created_at) && Array.isArray(key.verify_until) && (key.verify_until.length === 0 || (key.verify_until.length === 1 && nat64(key.verify_until[0]))), "invalid action-signing key timestamps");
      if (status === "Active") active++;
    }
    requireValue(active === 1, "user_index must expose exactly one active action-inbox signing key");
  } else {
    throw new Error("unknown response contract");
  }
} catch (error) {
  // JSON parser errors can include response snippets; never echo those bytes.
  console.error(`${kind} validation failed: ${error instanceof SyntaxError ? "invalid JSON response" : error.message}`);
  process.exitCode = 1;
}
NODE
}

CONFIG=$(dfx canister --network "$NETWORK" call "$ACTION_INBOX_ID" configuration '(record {})' --query --output json)
validate_response configuration "$CONFIG"
LUI_ROUTE=$(dfx canister --network "$NETWORK" call "$LOCAL_USER_INDEX_ID" action_inbox_canister '(record {})' --query --output json)
validate_response route "$LUI_ROUTE"
SIGNING_KEYS=$(dfx canister --network "$NETWORK" call "$USER_INDEX_ID" action_signing_keys '(record {})' --query --output json)
validate_response keys "$SIGNING_KEYS"

echo "action_inbox wiring valid: app=$APP_ID inbox=$ACTION_INBOX_ID relay=$USER_INDEX_ID local_user_index=$LOCAL_USER_INDEX_ID"
echo "action_signing_keys is discovery metadata only; verify the active key id against the consumer's independently pinned allowlist"
