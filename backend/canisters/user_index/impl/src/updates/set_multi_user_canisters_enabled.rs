use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::UserIndexEvent;
use tracing::info;
use user_index_canister::set_multi_user_canisters_enabled::*;

// Kill switch for the MultiUser canister rollout. Recorded here and fanned out to every
// LocalUserIndex over the event queue, so a new LocalUserIndex is seeded with it and an existing
// one picks it up even if it is mid-upgrade when the proposal executes. Nothing acts on it yet,
// it is only surfaced in metrics
#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn set_multi_user_canisters_enabled(args: Args) -> Response {
    mutate_state(|state| set_multi_user_canisters_enabled_impl(args, state))
}

fn set_multi_user_canisters_enabled_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.multi_user_canisters_enabled = args.enabled;

    state.push_event_to_all_local_user_indexes(UserIndexEvent::SetMultiUserCanistersEnabled(args.enabled), None);

    info!("MultiUser canisters enabled set to {}", args.enabled);
    Response::Success
}
