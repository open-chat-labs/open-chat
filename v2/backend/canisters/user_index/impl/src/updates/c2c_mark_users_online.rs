use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use user_index_canister::c2c_mark_users_online::{Response::*, *};

#[update]
fn c2c_mark_users_online(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_mark_users_online_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_mark_users_online_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if !runtime_state.data.online_users_agg_canister_ids.contains(&caller) {
        panic!("Only an 'online_users_aggregator canister' can call 'c2c_mark_users_online'");
    }
    let now = runtime_state.env.now();
    let users = &mut runtime_state.data.users;
    for user in args.users.into_iter() {
        users.mark_online(&user, now);
    }
    Success
}
