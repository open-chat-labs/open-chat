/// This module creates a second wasm-level call site for `Box<types::Message>::deserialize`,
/// which prevents wasm-opt's single-use function inliner from inlining it into
/// `ChatEvent::visit_enum`.
///
/// Background: `ic-wasm optimize` runs wasm-opt with `-Oz`, which inlines any function that
/// has exactly one call site. The `ChatEvent` enum has a `Message(Box<Message>)` variant.
/// When deserialised (via msgpack), `Box<Message>::deserialize` is called from exactly one
/// place inside `ChatEvent::visit_enum`. wasm-opt therefore inlines it there, together with
/// all of Message's own visitors (including MessageContent with 19 variants). This inflates
/// `ChatEvent::visit_enum` well past ICP's 1,000,000 function-complexity limit.
///
/// The fix: this exported wasm function calls the same monomorphisation of
/// `Box<types::Message>::deserialize` (both use `&mut rmp_serde::Deserializer<SliceReader>`).
/// wasm-opt now sees **two** call sites and leaves the function standalone, keeping
/// `ChatEvent::visit_enum` small enough to pass the complexity check.
#[cfg(target_arch = "wasm32")]
#[unsafe(export_name = "__no_inline_anchor_message_deserialize")]
pub extern "C" fn anchor() {
    // Passing an empty slice will produce a decode error, which we discard.
    // All that matters is that this call instruction appears in the wasm binary.
    let _: Result<Box<types::Message>, _> = msgpack::deserialize_from_slice(&[]);
}

