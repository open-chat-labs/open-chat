use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::UserId;
use user_index_canister::c2c_notify_chit::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_notify_chit(args: Args) -> Response {
    mutate_state(|state| c2c_notify_chit_impl(args, state))
}

fn c2c_notify_chit_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let user_id: UserId = state.env.caller().into();

    if state
        .data
        .users
        .set_chit(&user_id, args.chit_balance, args.streak, args.streak_ends, now)
    {
        Success
    } else {
        UserNotFound
    }
}
