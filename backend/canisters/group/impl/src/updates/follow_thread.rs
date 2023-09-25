use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::follow_thread::{Response::*, *};
use group_chat_core::FollowThreadResult;
use ic_cdk_macros::update;
use msgpack::serialize_then_unwrap;
use types::Empty;

#[update]
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

    let user_id = match state.data.lookup_user_id(caller) {
        Some(uid) => uid,
        None => return UserNotInGroup,
    };

    let now = state.env.now();

    match state.data.chat.follow_thread(user_id, args.thread_root_message_index, now) {
        FollowThreadResult::Success => {
            state.data.fire_and_forget_handler.send(
                user_id.into(),
                "c2c_mark_group_updated_for_user_msgpack".to_string(),
                serialize_then_unwrap(Empty {}),
            );
            Success
        }
        FollowThreadResult::AlreadyFollowing => AlreadyFollowing,
        FollowThreadResult::ThreadNotFound => ThreadNotFound,
        FollowThreadResult::UserNotInGroup => UserNotInGroup,
        FollowThreadResult::UserSuspended => UserSuspended,
    }
}
