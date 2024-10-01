use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use user_index_canister::user_registration_canister::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn user_registration_canister(_args: Args) -> Response {
    read_state(user_registration_canister_impl)
}

fn user_registration_canister_impl(state: &RuntimeState) -> Response {
    if let Some(canister_id) = state.data.local_index_map.index_for_new_user() {
        Success(canister_id)
    } else {
        NewRegistrationsClosed
    }
}
