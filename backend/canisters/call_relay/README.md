# Call relay

A <1KB canister, written directly in WebAssembly text format, which relays calls from its
controllers, making them as itself.

When a user is migrated to a MultiUser canister their old canister is uninstalled, but any
funds in its accounts stay where they are, since only the canister itself can move them. To
recover them, for each such canister which holds funds:

1. install this wasm on it (`install_code` with mode `install`, no init arg needed),
2. relay a transfer to each ledger the canister holds funds on, sending them to the user's new
   account,
3. uninstall it again.

Only a controller can call `relay`, which gives them nothing they don't already have, since they
could install any code they like on the canister. While it is installed, calls to any of the
User canister's methods fail as "method not found", which callers already treat as meaning the
user may have been migrated.

## Interface

`relay` takes raw (not candid) args:

```
callee length (1 byte) | callee | method length (1 byte) | method | payload
```

It calls `method` on `callee` with `payload`, as a guaranteed response call with no cycles
attached. An empty callee is the management canister. Once the callee responds, `relay` replies
(also raw) with:

```
reject code (4 bytes, u32 LE) | the callee's reply or reject message
```

where the reject code is 0 if the callee replied. So its outcome, reply or reject, comes back
exactly as the callee gave it, and a reject from `relay` itself means the call was never made:
the caller isn't a controller, the args are invalid, or `call_perform` failed. The one exception
is a reply within 4 bytes of the 2MiB limit, which can't be relayed since the relay's reply is 4
bytes longer, so the relay traps having made the call.

Being a guaranteed response call, `relay` always learns the outcome, but the caller, if it makes
a bounded wait call, may not. A transfer can be retried safely by setting `created_at_time`, in
which case the ledger returns a `Duplicate` error rather than making the transfer twice.

## Building

```
wat2wasm call_relay.wat -o call_relay.wasm
```

`wat2wasm` is part of [wabt](https://github.com/WebAssembly/wabt) (`brew install wabt`). The
built `call_relay.wasm` is committed alongside the `.wat` so that it can be embedded at compile
time, and an integration test checks the two match:

```
cargo test --package integration_tests call_relay
```
