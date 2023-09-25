use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::unfollow_thread::{Response::*, *};
use group_chat_core::UnfollowThreadResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn unfollow_thread(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| unfollow_thread_impl(args, state))
}

fn unfollow_thread_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return GroupFrozen;
    }

    let caller = state.env.caller();

    let user_id = match state.data.lookup_user_id(caller) {
        Some(uid) => uid,
        None => return UserNotInGroup,
    };

    let now = state.env.now();

    match state.data.chat.unfollow_thread(user_id, args.thread_root_message_index, now) {
        UnfollowThreadResult::Success => {
            state.data.mark_group_updated_in_user_canister(user_id);
            Success
        }
        UnfollowThreadResult::NotFollowing => NotFollowing,
        UnfollowThreadResult::ThreadNotFound => ThreadNotFound,
        UnfollowThreadResult::UserNotInGroup => UserNotInGroup,
        UnfollowThreadResult::UserSuspended => UserSuspended,
    }
}
