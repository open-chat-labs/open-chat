use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_index_canister::bridged_users::{Response::*, *};

#[query(msgpack = true)]
fn bridged_users(args: Args) -> Response {
    read_state(|state| bridged_users_impl(args, state))
}

fn bridged_users_impl(args: Args, state: &RuntimeState) -> Response {
    Success(
        args.users
            .iter()
            .take(MAX_BRIDGED_USERS)
            .filter_map(|id| state.data.bridged_users.get(id))
            .collect(),
    )
}
