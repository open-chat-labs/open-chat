use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::follow_thread::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};
use types::Achievement;

#[update(msgpack = true)]
#[trace]
fn follow_thread(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| follow_thread_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn follow_thread_impl(args: Args, state: &mut RuntimeState) -> Result<(), OCError> {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let member = state.data.members.get_then_verify(caller)?;
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
