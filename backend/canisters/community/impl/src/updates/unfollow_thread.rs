use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::unfollow_thread::{Response::*, *};
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
    state.data.verify_not_frozen()?;

    let user_id = state.get_calling_member(false)?.user_id;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

    channel.chat.unfollow_thread(user_id, args.thread_root_message_index, now)?;
    state.data.mark_community_updated_in_user_canister(user_id);
    Ok(())
}
