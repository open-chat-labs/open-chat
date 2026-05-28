use canister_time::now_nanos;

/// Creates a second wasm-level call site for `local_user_index_canister::UserIndexEvent::Visitor::visit_enum`
/// and its callees, preventing wasm-opt from inlining single-use functions into it and exceeding
/// ICP's 1,000,000 function-complexity limit.
///
/// # Background
///
/// `ic-wasm optimize Oz` uses wasm-opt's single-use inliner, which inlines any function that has
/// exactly one call site. `UserIndexEvent::visit_enum` calls many serde sub-functions (e.g.
/// `MessageContentInitial::visit_enum`) that would otherwise each have only one call site,
/// causing wasm-opt to inline them all and balloon the function past the ICP limit.
///
/// # Why this works
///
/// All deserialization in this codebase goes through `msgpack::deserialize`, which internally
/// uses a concrete `ErasedReader` wrapper (`&mut dyn Read`) before calling `rmp_serde::from_read`.
/// Because `ErasedReader` is a single non-generic type, every call to `msgpack::deserialize<T, _>`
/// — regardless of the underlying reader — produces the **same** serde monomorphization. This
/// means sub-functions like `MessageContentInitial::visit_enum` are shared between the
/// `UserIndexEvent` and `LocalUserIndexEvent` deserialization paths, giving them multiple call
/// sites so wasm-opt does not inline them.
///
/// This anchor adds a second call site for the `UserIndexEvent` path itself (the first is in
/// `post_upgrade`), ensuring `UserIndexEvent::visit_enum` also keeps multiple call sites.
///
/// # Why `now_nanos()` and not `now_millis()`
///
/// `now_millis()` divides by 1,000,000 and LLVM's value-range analysis can prove the result
/// fits in `i64`, making `now > i64::MAX as u64` always-false → dead branch → anchor eliminated.
/// `now_nanos()` is a raw `ic0::time() as u64` cast that LLVM treats as opaque, so the branch
/// cannot be proven false and survives to the final binary.
pub fn anchor() {
    let now = now_nanos();

    if now > i64::MAX as u64 {
        // This branch never executes at runtime, but the call below gives
        // `UserIndexEvent::visit_enum` a second call site via the same ErasedReader
        // monomorphization as post_upgrade, preventing single-use inlining by wasm-opt.
        let bytes = now.to_be_bytes();
        let cursor = std::io::Cursor::new(bytes.as_slice());
        assert!(
            msgpack::deserialize::<local_user_index_canister::UserIndexEvent, _>(cursor).is_err()
        );
    }
}
