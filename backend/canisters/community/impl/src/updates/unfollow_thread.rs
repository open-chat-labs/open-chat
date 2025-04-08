use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::unfollow_thread::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn unfollow_thread(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| unfollow_thread_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn unfollow_thread_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if state.data.is_frozen() {
        return Err(OCErrorCode::CommunityFrozen.into());
    }

    let caller = state.env.caller();
    let now = state.env.now();
    let user_id = state.data.members.get_verified_member(caller)?.user_id;

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        channel.chat.unfollow_thread(user_id, args.thread_root_message_index, now)?;
        state.data.mark_community_updated_in_user_canister(user_id);
        Ok(())
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}
