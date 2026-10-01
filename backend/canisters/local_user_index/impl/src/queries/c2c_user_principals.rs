use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use local_user_index_canister::c2c_user_principals::{Response::*, *};

// Replaced by `c2c_user_principals_v2`
// TODO: Remove this once every Community canister has been upgraded
#[query(msgpack = true)]
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
