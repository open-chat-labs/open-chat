# Cycles refunder

A ~1KB canister, written directly in WebAssembly text format, which sends all of its spare
cycles to the CyclesDispenser.

When a user is deleted their canister is uninstalled but not deleted, so it still holds its
cycles. To recover them, for each such canister:

1. install this wasm on it (`install_code` with mode `install` or `reinstall`),
2. call `refund`, which replies with the number of cycles sent,
3. uninstall it again.

The target defaults to the production CyclesDispenser (`gonut-hqaaa-aaaaf-aby7a-cai`). **On
any other network pass the CyclesDispenser's principal as the init arg**, eg.
`(principal "mq2tp-baaaa-aaaaf-aucva-cai")` on ic_test, otherwise the cycles are silently sent
to production.

`refund` keeps back only what the canister needs in order to make the `deposit_cycles` call,
as reported by `ic0.cost_call`, plus a little slack. The slack starts at 16M cycles and is
doubled each time `call_perform` refuses the call (the cycles are returned on failure), so it
adapts to the subnet's fees and the canister's freezing threshold rather than being tuned by
hand. The call is made with a best-effort response, since a guaranteed response would reserve a
2 MiB slot which raises the freezing threshold and so costs about 1B cycles per canister.

It returns 0 without making any call if there is nothing worth sending, and if `deposit_cycles`
is rejected the reject is forwarded to the caller. A `SYS_UNKNOWN` reject means the best-effort
response was lost, in which case the cycles have most likely still arrived; calling `refund`
again is always safe. Anyone can call `refund`, since all it can do is move the canister's
cycles to the CyclesDispenser.

Note that a floor of roughly 80B cycles is left in each canister regardless. The IC withholds
the execution prepayment for the update (~40B) and the reservation for the call's response and
callback (~42B) until after they complete, so they cannot be attached to the call, and any call
made later would need the same reservations again. Deleting a canister discards its cycles, so
leaving them uninstalled costs nothing more.

## Building

```
wat2wasm cycles_refunder.wat -o cycles_refunder.wasm
```

`wat2wasm` is part of [wabt](https://github.com/WebAssembly/wabt) (`brew install wabt`).
`wasm-tools parse` works too. The integration tests compile the `.wat` themselves, so no build
step is needed to run them:

```
cargo test --package integration_tests cycles_refunder
```
