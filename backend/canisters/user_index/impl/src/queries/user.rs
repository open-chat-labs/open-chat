use crate::{read_state, RuntimeState};
use canister_api_macros::query_candid_and_msgpack;
use user_index_canister::user::{Response::*, *};

#[query_candid_and_msgpack]
fn user(args: Args) -> Response {
    read_state(|state| user_impl(args, state))
}

fn user_impl(args: Args, state: &RuntimeState) -> Response {
    state.trap_if_caller_not_openchat_user();

    let mut user = None;
    if let Some(user_id) = args.user_id {
        user = state.data.users.get_by_user_id(&user_id);
    } else if let Some(username) = args.username {
        user = state.data.users.get_by_username(&username);
    }

    if let Some(user) = user {
        let now = state.env.now();
        Success(user.to_summary(now))
    } else {
        UserNotFound
    }
}
