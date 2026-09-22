use crate::guards::caller_is_user_index;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Timestamped;
use user_canister::c2c_set_user_suspended::{Response::*, *};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_set_user_suspended(args: Args) -> Response {
    mutate_state(|state| c2c_set_user_suspended_impl(args, state))
}

fn c2c_set_user_suspended_impl(args: Args, state: &mut RuntimeState) -> Response {
    // Traps for a user who isn't in this canister, rather than letting the UserIndex go on to
    // record a suspension which was never applied
    let user_index = state
        .index_of_local_user(args.user_id)
        .unwrap_or_else(|| ic_cdk::trap("User not found"));

    let now = state.env.now();
    state
        .data
        .users
        .with_user_mut(user_index, |user| {
            user.suspended = Timestamped::new(args.suspended, now);

            // The user's groups and communities, which the UserIndex suspends them in
            Success(SuccessResult {
                groups: user.group_chats.iter().map(|g| g.chat_id).collect(),
                communities: user.communities.iter().map(|c| c.community_id).collect(),
            })
        })
        .unwrap_or_else(|| ic_cdk::trap("User not found"))
}
