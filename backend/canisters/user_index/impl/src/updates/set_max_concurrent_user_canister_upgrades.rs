use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::{MaxConcurrentCanisterUpgradesChanged, UserIndexEvent};
use tracing::info;
use user_index_canister::set_max_concurrent_user_canister_upgrades::{Response::*, *};

// dfx --identity openchat canister --network ic call user_index set_max_concurrent_user_canister_upgrades '(record { value=N:nat32 })'
#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn set_max_concurrent_user_canister_upgrades(args: Args) -> Response {
    mutate_state(|state| set_max_concurrent_user_canister_upgrades_impl(args, state))
}

fn set_max_concurrent_user_canister_upgrades_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::MaxConcurrentCanisterUpgradesChanged(MaxConcurrentCanisterUpgradesChanged { value: args.value }),
        None,
    );

    info!("Max concurrent canister upgrades set to {}", args.value);
    Success
}
