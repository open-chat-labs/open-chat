# Cycles refunder

A ~700 byte canister, written directly in WebAssembly text format, which sends all of its
spare cycles to the CyclesDispenser (`gonut-hqaaa-aaaaf-aby7a-cai`).

When a user is deleted their canister is uninstalled but not deleted, so it still holds its
cycles. To recover them, for each such canister:

1. install this wasm on it (`install_code` with mode `install` or `reinstall`, no init args),
2. call `refund`, which replies with the number of cycles sent,
3. uninstall it again.

`refund` keeps back only what the canister needs in order to make the `deposit_cycles` call,
as reported by `ic0.cost_call`, plus a little slack. The slack starts at 16M cycles and is
doubled each time `call_perform` refuses the call (the cycles are returned on failure), so it
adapts to the subnet's fees and the canister's freezing threshold rather than being tuned by
hand. It returns 0 without making any call if there is nothing worth sending, and if
`deposit_cycles` is rejected the reject is forwarded to the caller. Anyone can call `refund`,
since all it can do is move the canister's cycles to the CyclesDispenser.

The slack is mostly needed because the reserved response slot (2 MiB) raises the freezing
threshold for the duration of the call. Setting the canister's freezing threshold to 0 via
`update_settings` before calling `refund` therefore makes the first attempt succeed and saves
about 1B cycles per canister, at the cost of one extra management canister call each.

Note that a floor of roughly 80B cycles is left in each canister regardless. The IC withholds
the execution prepayment for the update (~40B) and the reservation for the call's response and
callback (~42B) until after they complete, so they cannot be attached to the call, and any call
made later would need the same reservations again.

## Building

```
wat2wasm cycles_refunder.wat -o cycles_refunder.wasm
```

`wat2wasm` is part of [wabt](https://github.com/WebAssembly/wabt) (`brew install wabt`).
`wasm-tools parse` works too. The integration test compiles the `.wat` itself, so no build
step is needed to run it:

```
cargo test --package integration_tests cycles_refunder
```
