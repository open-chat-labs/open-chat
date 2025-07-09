use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::follow_thread::*;
use types::{Achievement, OCResult};

#[update(msgpack = true)]
#[trace]
fn follow_thread(args: Args) -> Response {
    execute_update(|state| follow_thread_impl(args, state)).into()
}

fn follow_thread_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let user_id = member.user_id();
    let now = state.env.now();

    state.data.chat.follow_thread(user_id, args.thread_root_message_index, now)?;

    if !member.user_type().is_bot() {
        if args.new_achievement {
            state.notify_user_of_achievement(user_id, Achievement::FollowedThread, now);
        }

        state.mark_activity_for_user(user_id);
    }
    Ok(())
}
