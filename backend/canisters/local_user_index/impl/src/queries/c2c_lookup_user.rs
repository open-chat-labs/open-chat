use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use local_user_index_canister::c2c_lookup_user::{Response::*, *};

#[query_msgpack]
fn c2c_lookup_user(args: Args) -> Response {
    read_state(|state| c2c_lookup_user_impl(args, state))
}

fn c2c_lookup_user_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(user) = state.data.global_users.get(&args.user_id_or_principal) {
        Success(user)
    } else {
        UserNotFound
    }
}
