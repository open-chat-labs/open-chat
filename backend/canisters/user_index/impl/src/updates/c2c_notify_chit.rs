use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::UserId;
use user_index_canister::c2c_notify_chit::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn c2c_notify_chit(args: Args) -> Response {
    mutate_state(|state| c2c_notify_chit_impl(args, state))
}

fn c2c_notify_chit_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let user_id: UserId = state.env.caller().into();

    if state.data.users.set_chit(
        &user_id,
        args.timestamp,
        args.chit_balance,
        args.streak,
        args.streak_ends,
        now,
    ) {
        if let Some(user) = state.data.users.get_by_user_id(&user_id) {
            state.data.chit_leaderboard.update_position(
                user_id,
                user.total_chit_earned(),
                args.chit_balance,
                args.timestamp,
                now,
            );
        }
        Success
    } else {
        UserNotFound
    }
}
