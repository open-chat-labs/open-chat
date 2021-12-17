use crate::guards::caller_is_online_users_aggregator_canister;
use crate::{RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::c2c_mark_users_online::{Response::*, *};

#[update(guard = "caller_is_online_users_aggregator_canister")]
#[trace]
fn c2c_mark_users_online(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_mark_users_online_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_mark_users_online_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let users = &mut runtime_state.data.users;
    for user in args.users {
        users.mark_online(&user, now);
    }
    Success
}
