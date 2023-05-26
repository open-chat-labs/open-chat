use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use local_user_index_canister::c2c_user_principals::{Response::*, *};

#[query_msgpack]
fn c2c_user_principals(args: Args) -> Response {
    read_state(|state| c2c_user_principals_impl(args, state))
}

fn c2c_user_principals_impl(args: Args, state: &RuntimeState) -> Response {
    let map = args
        .user_ids
        .into_iter()
        .filter_map(|id| state.data.global_users.get_by_user_id(&id).map(|u| (id, u.principal)))
        .collect();

    Success(map)
}
