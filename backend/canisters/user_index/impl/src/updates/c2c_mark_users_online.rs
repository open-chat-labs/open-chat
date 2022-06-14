use crate::guards::caller_is_online_users_aggregator_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_index_canister::c2c_mark_users_online::{Response::*, *};

#[update_msgpack(guard = "caller_is_online_users_aggregator_canister")]
#[trace]
fn c2c_mark_users_online(args: Args) -> Response {
    mutate_state(|state| c2c_mark_users_online_impl(args, state))
}

fn c2c_mark_users_online_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let users = &mut runtime_state.data.users;
    for user in args.users {
        users.mark_online(&user, now);
    }
    Success
}
