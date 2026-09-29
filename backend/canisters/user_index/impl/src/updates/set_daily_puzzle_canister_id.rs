use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::UserIndexEvent;
use tracing::info;
use user_index_canister::set_daily_puzzle_canister_id::*;

// Recorded here and fanned out to every LocalUserIndex over the event queue, so a new
// LocalUserIndex is seeded with it and an existing one picks it up even if it is mid-upgrade when
// the proposal executes. Each LocalUserIndex also keeps its own platform-operator
// `set_daily_puzzle_canister_id` endpoint as a fallback
#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn set_daily_puzzle_canister_id(args: Args) -> Response {
    mutate_state(|state| set_daily_puzzle_canister_id_impl(args, state))
}

fn set_daily_puzzle_canister_id_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.daily_puzzle_canister_id = Some(args.canister_id);

    state.push_event_to_all_local_user_indexes(UserIndexEvent::SetDailyPuzzleCanisterId(args.canister_id), None);

    info!(canister_id = %args.canister_id, "Daily puzzle canister id set");
    Response::Success
}
