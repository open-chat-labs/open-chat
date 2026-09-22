use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_achievement::{Response::*, *};

// TODO: Remove this once groups/communities have been updated to use c2c_notify_group|community_canister_events

#[update(msgpack = true)]
#[trace]
fn c2c_notify_achievement(args: Args) -> Response {
    execute_update(|state| c2c_notify_achievement_impl(args, state))
}

fn c2c_notify_achievement_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();

    match user_core::updates::c2c_notify_achievement(&mut state.data.user, caller, args.achievements, now) {
        Some(awarded) => {
            if awarded {
                state.notify_user_index_of_chit(now);
            }
            Success
        }
        None => CallerNotFound,
    }
}
