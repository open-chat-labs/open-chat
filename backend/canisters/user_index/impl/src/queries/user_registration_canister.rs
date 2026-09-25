use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_index_canister::user_registration_canister::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn user_registration_canister(_args: Args) -> Response {
    read_state(user_registration_canister_impl)
}

fn user_registration_canister_impl(state: &RuntimeState) -> Response {
    // New users go into MultiUser canisters once they are enabled, so route them to the
    // LocalUserIndex controlling the one with the fewest users. That LocalUserIndex then picks
    // whichever of its own has the fewest, since its counts may be more up to date than ours
    let multi_user_local_user_index = if state.data.multi_user_canisters_enabled {
        state
            .data
            .multi_user_canisters
            .local_user_index_for_new_user(|c| state.data.local_index_map.is_accepting_users(c))
    } else {
        None
    };

    if let Some(canister_id) = multi_user_local_user_index.or_else(|| state.data.local_index_map.index_for_new_user()) {
        Success(canister_id)
    } else {
        NewRegistrationsClosed
    }
}
