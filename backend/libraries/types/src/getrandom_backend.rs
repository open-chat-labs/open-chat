// getrandom (0.3+) requires a backend to be selected on wasm32-unknown-unknown. We route it to a
// custom backend via `--cfg getrandom_backend="custom"` in .cargo/config.toml, which calls the
// extern function below. Canisters never actually need entropy from getrandom - they seed their
// RNGs from the IC's `raw_rand` - so if anything ever does call getrandom on the canister we want
// to know about it loudly rather than silently return non-random bytes.
#[cfg(target_arch = "wasm32")]
#[unsafe(no_mangle)]
unsafe extern "Rust" fn __getrandom_v03_custom(_dest: *mut u8, _len: usize) -> Result<(), getrandom::Error> {
    // SAFETY note: unreachable in practice. Trap rather than fabricate randomness.
    ic_cdk::trap("getrandom was called on the canister but no entropy source is available");
}
