use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::follow_thread::{Response::*, *};
use group_chat_core::FollowThreadResult;
use types::Achievement;

#[update(candid = true, msgpack = true)]
#[trace]
fn follow_thread(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| follow_thread_impl(args, state))
}

fn follow_thread_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return GroupFrozen;
    }

    let caller = state.env.caller();

    let (user_id, is_bot) = match state.data.get_member(caller).map(|m| (m.user_id, m.user_type.is_bot())) {
        Some(uid) => uid,
        None => return UserNotInGroup,
    };

    let now = state.env.now();

    match state.data.chat.follow_thread(user_id, args.thread_root_message_index, now) {
        FollowThreadResult::Success => {
            if args.new_achievement && !is_bot {
                state.data.notify_user_of_achievement(user_id, Achievement::FollowedThread);
            }

            state.data.mark_group_updated_in_user_canister(user_id);
            Success
        }
        FollowThreadResult::AlreadyFollowing => AlreadyFollowing,
        FollowThreadResult::ThreadNotFound => ThreadNotFound,
        FollowThreadResult::UserNotInGroup => UserNotInGroup,
        FollowThreadResult::UserSuspended => UserSuspended,
        FollowThreadResult::UserLapsed => UserLapsed,
    }
}
