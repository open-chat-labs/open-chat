use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use local_user_index_canister::c2c_lookup_users::{Response::*, *};

#[query(msgpack = true)]
fn c2c_lookup_users(args: Args) -> Response {
    read_state(|state| c2c_lookup_users_impl(args, state))
}

fn c2c_lookup_users_impl(args: Args, state: &RuntimeState) -> Response {
    Success(
        args.user_ids
            .into_iter()
            .filter_map(|user_id| state.data.global_users.get_by_user_id(&user_id).map(|user| (user_id, user)))
            .collect(),
    )
}
