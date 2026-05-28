use canister_time::now_millis;

/// Creates a second wasm-level call site for `Box<OpenChatBotMessage>::deserialize`,
/// preventing wasm-opt's single-use function inliner from inlining it into
/// `PhantomData<Box<OpenChatBotMessage>>::deserialize`.
///
/// Background: `ic-wasm optimize` runs wasm-opt with `-Oz`, which inlines any function that
/// has exactly one call site. `UserIndexEvent::OpenChatBotMessage(Box<OpenChatBotMessage>)`
/// is deserialized only inside `c2c_notify_user_index_events_msgpack`, so wasm-opt inlines
/// `Box<OpenChatBotMessage>::deserialize` into its single caller — together with
/// `OpenChatBotMessage`'s visitor code (including `MessageContent` with 19+ variants). This
/// inflates that PhantomData function well past ICP's 1,000,000 function-complexity limit.
///
/// The fix: call this function from every exported lifecycle method (`init`, `post_upgrade`).
/// That guarantees the function is reachable from a real IC export, so neither ic-wasm nor
/// wasm-opt remove it. wasm-opt then sees **two** call sites for
/// `Box<OpenChatBotMessage>::deserialize` and leaves it as a standalone function, keeping
/// the PhantomData visitor small enough to pass the complexity check.
///
/// Note: both this call and the c2c_notify endpoint decoding use
/// `msgpack::deserialize_from_slice`, which resolves to the same concrete
/// `rmp_serde::Deserializer<SliceReader>` type. They therefore share the exact same
/// monomorphised wasm function, ensuring the second call site is effective.
pub fn anchor() {
    let now = now_millis();

    if now > i64::MAX as u64 {
        // This branch never executes at runtime (IC timestamps are far below i64::MAX),
        // but the compiler cannot prove that because now_millis() resolves to the opaque
        // ic0.time wasm import whose return value is unknown at compile time.
        // wasm-opt counts call sites statically, so the call instruction below is present
        // in the binary and counts as a second call site for
        // Box<OpenChatBotMessage>::deserialize, preventing single-use inlining regardless
        // of runtime reachability.
        assert!(msgpack::deserialize_from_slice::<local_user_index_canister::UserIndexEvent>(&now.to_be_bytes()).is_err());
    }
}
