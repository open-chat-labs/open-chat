use canister_time::now_nanos;

/// Creates a second wasm-level call site for `local_user_index_canister::UserIndexEvent::Visitor::visit_enum`
/// and its callees, preventing wasm-opt from inlining single-use functions into it and exceeding
/// ICP's 1,000,000 function-complexity limit.
///
/// Background: wasm-opt (`ic-wasm optimize Oz`) inlines any function that has exactly one call site.
/// In the user_index binary, `UserIndexEvent::visit_enum` calls many `rmp_serde` sub-functions that
/// each have only one call site, causing wasm-opt to inline them all and balloon the function past
/// the ICP complexity limit.
///
/// Why `now_nanos()` (not `now_millis()`): `now_millis()` divides by 1,000,000, and LLVM's value-range
/// analysis can prove the result fits in i64, making `now > i64::MAX as u64` always-false → dead branch
/// → anchor call eliminated. `now_nanos()` is a raw `ic0::time() as u64` cast which LLVM treats as
/// opaque, so the branch cannot be proven false and survives to the binary.
pub fn anchor() {
    let now = now_nanos();

    if now > i64::MAX as u64 {
        // This branch never executes at runtime, but the call instruction below gives
        // `UserIndexEvent::visit_enum` and its sub-functions a second call site, preventing
        // single-use inlining by wasm-opt.
        assert!(msgpack::deserialize_from_slice::<local_user_index_canister::UserIndexEvent>(&now.to_be_bytes()).is_err());
    }
}
