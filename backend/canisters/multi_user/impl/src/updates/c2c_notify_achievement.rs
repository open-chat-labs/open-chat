use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_achievement::{Response::*, *};

// TODO: Remove this once groups/communities have been updated to use c2c_notify_group|community_canister_events

#[update(msgpack = true)]
#[trace]
fn c2c_notify_achievement(args: Args) -> Response {
    mutate_state(|state| c2c_notify_achievement_impl(args, state))
}

fn c2c_notify_achievement_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();

    // The response has no variant for the user being unknown, so a caller naming one this canister
    // doesn't hold is answered as it would be for a user it isn't a group or community of
    let Some(user_index) = state.index_of_local_user(args.user_id) else {
        return CallerNotFound;
    };
    let awarded = state.data.users.with_user_mut(user_index, |user| {
        user_core::updates::c2c_notify_achievement(user, caller, args.achievements, now)
    });
    match awarded.flatten() {
        Some(awarded) => {
            if awarded {
                state.notify_user_index_of_chit(user_index, now);
            }
            Success
        }
        None => CallerNotFound,
    }
}
