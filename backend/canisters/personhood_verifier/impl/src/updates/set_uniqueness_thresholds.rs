use crate::engine::UniquenessThresholds;
use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use personhood_verifier_canister::set_uniqueness_thresholds::{Response::*, *};
use tracing::info;

// Tunes the uniqueness bands live (SNS proposal). The right value tracks the
// enrolled population size, which grows, so this stays governable rather than
// baked into the wasm.
#[update(guard = "caller_is_governance_principal", candid = true, msgpack = true)]
#[trace]
fn set_uniqueness_thresholds(args: Args) -> Response {
    mutate_state(|state| set_uniqueness_thresholds_impl(args, state))
}

fn set_uniqueness_thresholds_impl(args: Args, state: &mut RuntimeState) -> Response {
    for (name, value) in [("duplicate", args.duplicate), ("clear", args.clear), ("duplicate_retry", args.duplicate_retry)] {
        if !(0.0..=1.0).contains(&value) {
            return Invalid(format!("{name} must be in [0, 1], got {value}"));
        }
    }
    if !(args.clear <= args.duplicate_retry && args.duplicate_retry <= args.duplicate) {
        return Invalid(format!(
            "must satisfy clear <= duplicate_retry <= duplicate (got {} <= {} <= {})",
            args.clear, args.duplicate_retry, args.duplicate
        ));
    }
    state.data.uniqueness_thresholds = UniquenessThresholds {
        duplicate: args.duplicate,
        clear: args.clear,
        duplicate_retry: args.duplicate_retry,
    };
    info!(
        duplicate = args.duplicate,
        clear = args.clear,
        duplicate_retry = args.duplicate_retry,
        "Uniqueness thresholds updated"
    );
    Success
}
