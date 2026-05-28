use canister_time::now_millis;

/// Creates a second wasm-level call site for `Box<types::Message>::deserialize`,
/// preventing wasm-opt's single-use function inliner from inlining it into
/// `ChatEvent::visit_enum`.
///
/// Background: `ic-wasm optimize` runs wasm-opt with `-Oz`, which inlines any function that
/// has exactly one call site. The `ChatEvent::Message(Box<Message>)` variant's deserialiser is
/// called only from `ChatEvent::visit_enum`, so wasm-opt inlines it there — together with all
/// of Message's own visitor code (including MessageContent with 19 variants). This inflates
/// `ChatEvent::visit_enum` well past ICP's 1,000,000 function-complexity limit.
///
/// The fix: call this function from every exported lifecycle method (`init`, `post_upgrade`).
/// That guarantees the function is reachable from a real IC export, so neither ic-wasm nor
/// wasm-opt remove it.  wasm-opt then sees **two** call sites for
/// `Box<types::Message>::deserialize` and leaves it as a standalone function, keeping
/// `ChatEvent::visit_enum` small enough to pass the complexity check.
///
/// Note: both this call and the c2c response decoding use `msgpack::deserialize_from_slice`,
/// which resolves to the same concrete `rmp_serde::Deserializer<SliceReader>` type. They
/// therefore share the exact same monomorphised wasm function. See msgpack/src/lib.rs for
/// why `msgpack::deserialize` (the `R: Read` variant) was changed to go through SliceReader
/// too — ensuring any future callers also share the same monomorphisation.
pub fn anchor() {
    let now = now_millis();

    if now > i64::MAX as u64 {
        // This branch never executes at runtime (IC timestamps are far below i64::MAX),
        // but the compiler cannot prove that because now_millis() resolves to the opaque
        // ic0.time wasm import whose return value is unknown at compile time.
        // wasm-opt counts call sites statically, so the call instruction below is present
        // in the binary and counts as a second call site for Box<types::Message>::deserialize,
        // preventing single-use inlining regardless of runtime reachability.
        let _ = msgpack::deserialize_from_slice::<Box<types::Message>>(&now.to_be_bytes());
    }
}
