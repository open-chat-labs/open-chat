use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use local_user_index_canister::c2c_lookup_users::{Response::*, *};

#[query_msgpack]
fn c2c_lookup_users(args: Args) -> Response {
    read_state(|state| c2c_lookup_users_impl(args, state))
}

fn c2c_lookup_users_impl(args: Args, state: &RuntimeState) -> Response {
    let users = args
        .user_ids
        .iter()
        .filter_map(|user_id| state.data.global_users.get_by_user_id(user_id))
        .collect();

    Success(users)
}
