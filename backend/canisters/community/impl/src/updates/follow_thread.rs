use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::follow_thread::*;
use oc_error_codes::OCErrorCode;
use types::{Achievement, OCResult};

#[update(msgpack = true)]
#[trace]
fn follow_thread(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| follow_thread_impl(args, state)).into()
}

fn follow_thread_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let now = state.env.now();
    let user_id = member.user_id;

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        channel.chat.follow_thread(user_id, args.thread_root_message_index, now)?;
        state.data.mark_community_updated_in_user_canister(user_id);

        if args.new_achievement && !member.user_type.is_bot() {
            state.notify_user_of_achievement(user_id, Achievement::FollowedThread, now);
        }
        Ok(())
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}
